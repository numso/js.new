const babel = require('@babel/core')
const bblJsx = require('@babel/plugin-transform-react-jsx')
const bblCp = require('@babel/plugin-syntax-class-properties')
const bblMeta = require('@babel/plugin-syntax-import-meta')
const bblTS = require('@babel/preset-typescript')
const Convert = require('ansi-to-html')
const path = require('path')
const lexer = require('es-module-lexer')

const { fileExists, SUFFIX, NOT_FOUND } = require('./common')

module.exports = function transform ({ BASE, hmr, config, dev }) {
  return (req, res) => {
    const convert = new Convert(config.theme)
    let contents = build(req.url, req.filePath, config, dev)
    try {
      contents = babel.transformSync(contents, {
        filename: req.filePath,
        plugins: [bblJsx, bblCp, bblMeta],
        presets: [bblTS]
      }).code
    } catch (error) {
      console.error(error)
      const pretty = convert.toHtml(error.toString())
      contents = `window.$js_new_error$(\`${pretty.replace(/\\/g, '\\\\')}\`)`
      hmr.error(pretty)
    }

    const imports = lexer.parse(contents, req.filePath)[0].reverse()
    const parsedImports = []
    imports.forEach(({ s, e, d }) => {
      if (d === -2) return
      // TODO:: Test out dynamic imports. what happens?
      let [name, isLocal] = rewrite(BASE, contents.substring(s, e), req, config)
      if (isLocal) parsedImports.push(path.join(path.dirname(req.url), name))
      if (isLocal && !name.endsWith('.js')) name = name + SUFFIX
      contents = contents.slice(0, s) + name + contents.slice(e)
    })
    contents = hmr.apply(contents, req.originalUrl, parsedImports)
    res.send(contents, '.js')
  }
}

const rewrite = (BASE, name, { url }, config) => {
  if (name[0] !== '.') return [`https://cdn.skypack.dev/${name}`, false]
  // TODO:: handle absolute paths better
  const base = path.join(BASE, path.dirname(url), name)
  if (fileExists(base)) return [name, true]
  for (const ext in config.builders) {
    if (fileExists(`${base}${ext}`)) return [`${name}${ext}`, true]
    if (fileExists(`${base}/index${ext}`)) return [`${name}/index${ext}`, true]
  }
  console.error(`missing file "${name}" requested by ${path.join(BASE, url)}`)
  return [`${name}?${NOT_FOUND}`, false]
}

const notFound = ({ url }) => {
  // TODO:: if !dev fail the build
  const error = `No builder found for ${url}`
  console.error(error)
  return `throw new Error("${error}")`
}

function build (url, filePath, config, dev) {
  let fn = notFound
  for (const suffix in config.builders) {
    if (url.endsWith(suffix)) {
      fn = config.builders[suffix]
      break
    }
  }
  return fn({ url, filePath, dev })
}
