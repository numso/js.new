#!/usr/bin/env node
import childProcess from 'child_process'
import fs from 'fs'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import chokidar from 'chokidar'
import open from 'open'
import lexer from 'es-module-lexer'
import babel from '@babel/core'
import bblJsx from '@babel/plugin-transform-react-jsx'
import bblCp from '@babel/plugin-syntax-class-properties'
import bblMeta from '@babel/plugin-syntax-import-meta'
import bblRR from 'react-refresh/babel.js'
import { EsmHmrEngine } from './esm-hmr/server.js'

const p = process.argv[2] || '.'
const BASE = path.isAbsolute(p) ? p : path.join(process.cwd(), p)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

if (!fs.existsSync(BASE)) {
  fs.mkdirSync(BASE)
  const templatePath = path.join(__dirname, 'template', 'react')
  fs.readdirSync(templatePath).forEach(file => {
    fs.copyFileSync(path.join(templatePath, file), path.join(BASE, file))
  })
}

const c = { plugins: [bblJsx, bblCp, bblMeta, bblRR] }
const mimedb = { '.html': 'text/html', '.js': 'application/javascript' }
const reactRefreshCode = fs
  .readFileSync(
    path.join(
      __dirname,
      'node_modules',
      'react-refresh',
      'cjs',
      'react-refresh-runtime.development.js'
    ),
    'utf8'
  )
  .replace(`process.env.NODE_ENV`, JSON.stringify('development'))
const indexFile = fs
  .readFileSync(path.join(BASE, 'index.html'), 'utf8')
  .replace(
    /<body.*?>/,
    `$&
  <script>
function debounce(e,t){let u;return()=>{clearTimeout(u),u=setTimeout(e,t)}}
const exports = {}
${reactRefreshCode}
exports.performReactRefresh = debounce(exports.performReactRefresh, 30)
window.$RefreshRuntime$ = exports
window.$RefreshRuntime$.injectIntoGlobalHook(window)
window.$RefreshReg$ = () => {}
window.$RefreshSig$ = () => type => type
  </script>`
  )
const hmrClient = fs.readFileSync(
  path.join(__dirname, './esm-hmr/client.js'),
  'utf8'
)
const hmr = new EsmHmrEngine()

const server = http.createServer((req, res) => {
  req.url = req.url.split('?mtime')[0]
  if (req.url === '/hmr.js') return send(res, hmrClient, '.js')
  const fullPath = path.join(BASE, req.url)
  if (!checkFile(fullPath)) return send(res, indexFile, '.html')
  let ext = getExt(path.extname(fullPath))
  let contents = fs.readFileSync(fullPath, 'utf8')
  if (ext === '.css') {
    ext = '.js'
    contents = `const styleTag = document.createElement('style')
styleTag.appendChild(document.createTextNode(${JSON.stringify(contents)}))
document.head.appendChild(styleTag)
import.meta.hot.accept()
import.meta.hot.dispose(() => {
  document.head.removeChild(styleTag)
})`
  }
  if (ext === '.json') {
    ext = '.js'
    contents = `let json = ${contents}
export default json
import.meta.hot.accept(({ module }) => {
  json = module.default
})`
  }
  if (ext === '.js') {
    contents = babel.transformSync(contents, { filename: fullPath, ...c }).code
    const imports = lexer.parse(contents, fullPath)[0].reverse()
    const parsedImports = []
    let isReact = false
    imports.forEach(({ s, e, d }) => {
      if (d === -2) return
      if (contents.substring(s, e) === 'react') isReact = true
      // TODO:: Test out dynamic imports. what happens?
      const [name, isLocal] = rewrite(contents.substring(s, e), req)
      // TODO:: append .$hoh$.js if it isn't a js or jsx file
      // TODO:: check for that at the top and do special stuff to make everything work
      // TODO:: then you can proxy images and stuff down. yay.
      if (isLocal) parsedImports.push(path.join(path.dirname(req.url), name))
      contents = contents.slice(0, s) + name + contents.slice(e)
    })
    if (isReact) {
      contents = `var $RefreshRegPrev$ = window.$RefreshReg$
var $RefreshSigPrev$ = window.$RefreshSig$
window.$RefreshReg$ = (type, id) => {
  window.$RefreshRuntime$.register(type, ${JSON.stringify(req.url)} + " " + id)
}
window.$RefreshSig$ = window.$RefreshRuntime$.createSignatureFunctionForTransform
${contents}
window.$RefreshReg$ = $RefreshRegPrev$
window.$RefreshSig$ = $RefreshSigPrev$
import.meta.hot.accept(() => {
  window.$RefreshRuntime$.performReactRefresh()
})
`
    }
    const isHmrEnabled = contents.includes('import.meta.hot')
    if (isHmrEnabled) {
      contents = `import * as $hoh_hmr$ from '/hmr.js'
import.meta.hot = $hoh_hmr$.createHotContext(import.meta.url)
${contents}`
    }
    hmr.setEntry(req.url, parsedImports, isHmrEnabled)
  }
  send(res, contents, ext)
})

function triggerHMR (url, visited) {
  if (visited.has(url)) return
  visited.add(url)
  const node = hmr.getEntry(url)
  if (node && node.isHmrEnabled) {
    hmr.broadcastMessage({ type: 'update', url })
  } else if (node && node.dependents.size > 0) {
    hmr.markEntryForReplacement(node, true)
    node.dependents.forEach(dep => triggerHMR(dep, visited))
  } else {
    hmr.broadcastMessage({ type: 'reload' })
  }
}
const handleWatch = file => triggerHMR(file.replace(BASE, ''), new Set())
const watcher = chokidar.watch(BASE, { persistent: true, ignoreInitial: true })
watcher.on('add', handleWatch)
watcher.on('change', handleWatch)
watcher.on('unlink', handleWatch)

const getExt = ext => (ext === '.jsx' ? '.js' : ext)
const checkFile = p => fs.existsSync(p) && fs.lstatSync(p).isFile()
const rewrite = (name, { url }) => {
  if (name[0] !== '.') return [`https://cdn.pika.dev/${name}`, false]
  // TODO:: handle absolute paths better
  const base = path.join(BASE, path.dirname(url), name)
  if (checkFile(base)) return [name, true]
  for (const ext of ['.js', '.jsx', '.json']) {
    if (checkFile(`${base}${ext}`)) return [`${name}${ext}`, true]
    if (checkFile(`${base}/index${ext}`)) return [`${name}/index${ext}`, true]
  }
  console.warn(`missing file "${name}" requested by "${path.join(BASE, url)}"`)
  return [name, false]
}
const send = (res, contents, ext) => {
  if (!mimedb[ext]) console.warn(`missing mime type for ${ext}`)
  res.writeHead(200, { 'Content-Type': mimedb[ext] }).end(contents)
}

lexer.init.then(() =>
  server.listen(3000, () => console.log('Listening on 3000'))
)

open('http://localhost:3000', { wait: false, url: true }).catch(() => {})
childProcess
  .spawn('code', [BASE], { detached: true, stdio: 'ignore' })
  .on('error', () => null)
  .unref()
