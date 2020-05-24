#!/usr/bin/env node --experimental-top-level-await
import fs from 'fs'
import http from 'http'
import path from 'path'
import lexer from 'es-module-lexer'
import babel from '@babel/core'
import jsx from '@babel/plugin-transform-react-jsx'

const [, , srcDir = '.'] = process.argv
const mimedb = { '.html': 'text/html', '.js': 'application/javascript', '.jsx': 'application/javascript' }
await lexer.init

http.createServer((req, res) => {
  const fullPath = findFile(req.url === '/' ? '/index.html' : req.url)
  if (!fullPath) return res.writeHead(404).end()
  let contents = fs.readFileSync(fullPath, 'utf8')
  const mime = mimedb[path.extname(fullPath)]
  if (!mime) console.warn(`missing mime type for ${path.extname(fullPath)}`)
  if (mime === 'application/javascript') {
    contents = babel.transformSync(contents, { filename: fullPath, plugins: [jsx] }).code
    lexer.parse(contents, fullPath)[0].reverse().forEach(({ s, e }) => {
      const name = contents.substring(s, e)
      contents = contents.slice(0, s) + updateDep(name) + contents.slice(e)
    })
  }
  if (mime) res.setHeader('Content-Type', mime)
  res.end(contents)
}).listen(3000, () => console.log('Listening on 3000'))

function findFile (url) {
  const base = path.join(process.cwd(), srcDir, url)
  if (checkFile(base)) return base
  for (const ext in mimedb) {
    if (checkFile(`${base}${ext}`)) return `${base}${ext}`
    if (checkFile(`${base}/index${ext}`)) return `${base}/index${ext}`
  }
}

const checkFile = p => fs.existsSync(p) && fs.lstatSync(p).isFile()
const updateDep = n => n[0] === '.' ? n : `https://cdn.pika.dev/${n}`
