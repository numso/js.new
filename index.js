#!/usr/bin/env node
const Convert = require('ansi-to-html')
const childProcess = require('child_process')
const fs = require('fs')
const http = require('http')
const path = require('path')
const chokidar = require('chokidar')
const mime = require('mime-types')
const open = require('open')
const lexer = require('es-module-lexer')
const babel = require('@babel/core')
const bblJsx = require('@babel/plugin-transform-react-jsx')
const bblCp = require('@babel/plugin-syntax-class-properties')
const bblMeta = require('@babel/plugin-syntax-import-meta')
const bblTS = require('@babel/preset-typescript')
// const bblRR = require('react-refresh/babel.js')
const { EsmHmrEngine } = require('./esm-hmr/server.js')

const p = process.argv[2] || '.'
const BASE = path.isAbsolute(p) ? p : path.join(process.cwd(), p)
const templatePath = path.join(__dirname, 'template', 'react')
const SUFFIX = '.$js_new$.js'

if (!fs.existsSync(BASE)) fs.mkdirSync(BASE)
if (fs.readdirSync(BASE).length === 0) {
  fs.readdirSync(templatePath).forEach(file => {
    fs.copyFileSync(path.join(templatePath, file), path.join(BASE, file))
  })
}

const fg = '#CCC'
const bg = '#0C0C0C'
const colors = {
  1: '#FF3366',
  2: '#13A10E',
  3: '#C19C00',
  6: '#3A96DD',
  8: '#767676'
}
const convert = new Convert({ fg, bg, colors })
const fmt = error => convert.toHtml(error.toString())

// const c = { plugins: [bblJsx, bblCp, bblMeta, bblRR], presets: [bblTS] }
const c = { plugins: [bblJsx, bblCp, bblMeta], presets: [bblTS] }
// const reactRefreshCode = fs
//   .readFileSync(
//     path.join(
//       __dirname,
//       'node_modules',
//       'react-refresh',
//       'cjs',
//       'react-refresh-runtime.development.js'
//     ),
//     'utf8'
//   )
//   .replace(`process.env.NODE_ENV`, JSON.stringify('development'))
const ourIndex = fs.readFileSync(path.join(templatePath, 'index.html'), 'utf8')
let indexFile
const checkFile = p => fs.existsSync(p) && fs.lstatSync(p).isFile()
const tryLoadIndex = () => {
  const p = path.join(BASE, 'index.html')
  indexFile = (checkFile(p) ? fs.readFileSync(p, 'utf8') : ourIndex).replace(
    /<body.*?>/,
    `$&\n    <script>
      window.$js_new_error$ = error => {
        const pre = document.createElement('pre')
        pre.style = "font-family: 'Cascadia Code', monospace; background: ${bg}; color: ${fg}; padding: 32px; margin: 0; height: 100vh; box-sizing: border-box;"
        pre.innerHTML = error
        document.body.replaceWith(pre)
      }
    </script>
    <script type="module" src="/hmr.js"></script>`
  )
  //   .replace(
  //     /<body.*?>/,
  //     `$&
  //   <script>
  // function debounce(e,t){let u;return()=>{clearTimeout(u),u=setTimeout(e,t)}}
  // const exports = {}
  // ${reactRefreshCode}
  // exports.performReactRefresh = debounce(exports.performReactRefresh, 30)
  // window.$RefreshRuntime$ = exports
  // window.$RefreshRuntime$.injectIntoGlobalHook(window)
  // window.$RefreshReg$ = () => {}
  // window.$RefreshSig$ = () => type => type
  //   </script>`
  //   )
}
tryLoadIndex()
const hmrClient = fs.readFileSync(
  path.join(__dirname, './esm-hmr/client.js'),
  'utf8'
)
const hmr = new EsmHmrEngine()

const load = url => fs.readFileSync(path.join(BASE, url), 'utf8')
const transformers = {
  '.js': load,
  '.jsx': load,
  '.ts': load,
  '.tsx': load,
  '.css': path => `const styleTag = document.createElement('style')
  styleTag.appendChild(document.createTextNode(${JSON.stringify(load(path))}))
  document.head.appendChild(styleTag)
  import.meta.hot.accept()
  import.meta.hot.dispose(() => {
    document.head.removeChild(styleTag)
  })`,
  '.json': path => `let json = ${load(path)}
  export default json
  import.meta.hot.accept(({ module }) => {
    json = module.default
  })`,
  '.jpg': path => `export default ${JSON.stringify(path)}`,
  '.png': path => `export default ${JSON.stringify(path)}`,
  '.bmp': path => `export default ${JSON.stringify(path)}`,
  default: ext => () => `throw new Error("No transformer for ${ext} found")`
}

const server = http.createServer((req, res) => {
  req.url = req.url.split('?mtime')[0]
  const isJS = req.url.endsWith('.js')
  req.url = req.url.replace(SUFFIX, '')
  if (req.url === '/hmr.js') return send(res, hmrClient, '.js')
  const fullPath = path.join(BASE, req.url)
  const ext = path.extname(fullPath)
  if (!checkFile(fullPath)) return send(res, indexFile, '.html')
  if (!isJS) return send(res, fs.readFileSync(fullPath), ext)
  const transformer = transformers[ext] || transformers.default(ext)
  let contents = transformer(req.url)
  try {
    contents = babel.transformSync(contents, { filename: fullPath, ...c }).code
  } catch (error) {
    console.error(error)
    contents = `window.$js_new_error$(\`${fmt(error).replace(/\\/g, '\\\\')}\`)`
    hmr.broadcastMessage({ type: 'error', error: fmt(error) })
  }
  const imports = lexer.parse(contents, fullPath)[0].reverse()
  const parsedImports = []
  // let isReact = false
  imports.forEach(({ s, e, d }) => {
    if (d === -2) return
    // if (contents.substring(s, e) === 'react') isReact = true
    // TODO:: Test out dynamic imports. what happens?
    let [name, isLocal] = rewrite(contents.substring(s, e), req)
    if (isLocal) parsedImports.push(path.join(path.dirname(req.url), name))
    if (isLocal && !name.endsWith('.js')) name = name + SUFFIX
    contents = contents.slice(0, s) + name + contents.slice(e)
  })
  //     if (isReact) {
  //       contents = `var $RefreshRegPrev$ = window.$RefreshReg$
  // var $RefreshSigPrev$ = window.$RefreshSig$
  // window.$RefreshReg$ = (type, id) => {
  //   window.$RefreshRuntime$.register(type, ${JSON.stringify(req.url)} + " " + id)
  // }
  // window.$RefreshSig$ = window.$RefreshRuntime$.createSignatureFunctionForTransform
  // ${contents}
  // window.$RefreshReg$ = $RefreshRegPrev$
  // window.$RefreshSig$ = $RefreshSigPrev$
  // import.meta.hot.accept(() => {
  //   window.$RefreshRuntime$.performReactRefresh()
  // })
  // `
  //     }
  const isHmrEnabled = contents.includes('import.meta.hot')
  if (isHmrEnabled) {
    contents = `import * as $js_new_hmr$ from '/hmr.js'
import.meta.hot = $js_new_hmr$.createHotContext(import.meta.url)
${contents}`
  }
  hmr.setEntry(req.url, parsedImports, isHmrEnabled)
  send(res, contents, '.js')
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
const handleWatch = file => {
  if (file === path.join(BASE, 'index.html')) tryLoadIndex()
  triggerHMR(file.replace(BASE, ''), new Set())
}
const watcher = chokidar.watch(BASE, { persistent: true, ignoreInitial: true })
watcher.on('add', handleWatch)
watcher.on('change', handleWatch)
watcher.on('unlink', handleWatch)

const rewrite = (name, { url }) => {
  if (name[0] !== '.') return [`https://cdn.pika.dev/${name}`, false]
  // TODO:: handle absolute paths better
  const base = path.join(BASE, path.dirname(url), name)
  if (checkFile(base)) return [name, true]
  for (const ext in transformers) {
    if (checkFile(`${base}${ext}`)) return [`${name}${ext}`, true]
    if (checkFile(`${base}/index${ext}`)) return [`${name}/index${ext}`, true]
  }
  console.warn(`missing file "${name}" requested by "${path.join(BASE, url)}"`)
  return [name, false]
}
const send = (res, contents, ext) =>
  res.writeHead(200, { 'Content-Type': mime.lookup(ext) }).end(contents)

lexer.init.then(() =>
  server.listen(3000, () => console.log('Listening on 3000'))
)

open('http://localhost:3000', { wait: false, url: true }).catch(() => {})
childProcess
  .spawn('code', [BASE], { detached: true, stdio: 'ignore', shell: true })
  .on('error', () => null)
  .unref()
