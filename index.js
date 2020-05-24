#!/usr/bin/env node
import fs from 'fs'
import http from 'http'
import path from 'path'
import lexer from 'es-module-lexer'
import babel from '@babel/core'
import jsx from '@babel/plugin-transform-react-jsx'
import cp from '@babel/plugin-syntax-class-properties'

const BASE = path.join(process.cwd(), process.argv[2] || '.')
const c = { plugins: [jsx, cp] }
const mimedb = { '.html': 'text/html', '.js': 'application/javascript' }

const server = http.createServer((req, res) => {
  if (req.url === '/') req.url = '/index.html'
  const fullPath = path.join(BASE, req.url)
  if (!checkFile(fullPath)) return res.writeHead(404).end()
  let ext = getExt(path.extname(fullPath))
  let contents = fs.readFileSync(fullPath, 'utf8')
  if (ext === '.json') [ext, contents] = ['.js', `export default ${contents}`]
  if (ext === '.js') {
    contents = babel.transformSync(contents, { filename: fullPath, ...c }).code
    const imports = lexer.parse(contents, fullPath)[0].reverse()
    imports.forEach(({ s, e }) => {
      const name = contents.substring(s, e)
      contents = contents.slice(0, s) + rewrite(name, req) + contents.slice(e)
    })
  }
  const mime = mimedb[ext]
  if (!mime) console.warn(`missing mime type for ${ext}`)
  if (mime) res.setHeader('Content-Type', mime)
  res.end(contents)
})

const getExt = ext => (ext === '.jsx' ? '.js' : ext)
const checkFile = p => fs.existsSync(p) && fs.lstatSync(p).isFile()
const rewrite = (name, { url }) => {
  if (name[0] !== '.' && name[0] !== '/') return `https://cdn.pika.dev/${name}`
  // TODO:: handle absolute paths better
  const base = path.join(BASE, path.dirname(url), name)
  if (checkFile(base)) return name
  for (const ext of ['.js', '.jsx', '.json']) {
    if (checkFile(`${base}${ext}`)) return `${name}${ext}`
    if (checkFile(`${base}/index${ext}`)) return `${name}/index${ext}`
  }
  console.warn(`missing file "${name}" requested by "${path.join(BASE, url)}"`)
  return name
}

lexer.init.then(() =>
  server.listen(3000, () => console.log('Listening on 3000'))
)
