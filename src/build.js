const lexer = require('es-module-lexer')
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')

const { fileExists, SUFFIX } = require('./common')
const getConfig = require('./config')
const { transform } = require('./transform')

const configPath = (a, b) => (path.isAbsolute(a) ? a : path.join(b, a))

const onError = error => {
  console.error(error)
  process.exit(1)
}

module.exports = async dir => {
  await lexer.init
  const base = configPath(dir, process.cwd())

  let config = getConfig()
  const customizePath = path.join(base, '.js.new.js')
  try {
    config = require(customizePath)(config)
  } catch (error) {
    onError(error)
  }

  const outDir = configPath(config.outputDir, base)

  const opts = { base, config, dev: false, onError }

  fs.rmdirSync(outDir, { recursive: true })
  fs.mkdirSync(path.dirname(outDir), { recursive: true })
  recurseThrough(config, base, outDir, (inputFile, outputFile, skip) => {
    if (!inputFile.endsWith('.js')) {
      // TODO:: Builder should define whether or not this should be output
      fs.copyFileSync(inputFile, outputFile)
      outputFile += SUFFIX
    }
    if (skip) return
    const url = pathToFileURL(`${path.sep}${path.relative(base, inputFile)}`)
    const contents = transform(url.pathname, inputFile, opts)[0]
    fs.writeFileSync(outputFile, contents)
  })

  // TODO:: should handle index.html here instead of up there
  if (!fileExists(path.join(base, 'index.html'))) {
    const index2 = path.join(
      __dirname,
      'templates',
      config.template,
      'index.html'
    )
    const contents = fs.readFileSync(index2, 'utf8')
    fs.writeFileSync(path.join(outDir, 'index.html'), contents)
  }
}

function recurseThrough (config, IN, OUT, cb, outDir = OUT) {
  if (IN === outDir) return
  fs.mkdirSync(OUT)
  fs.readdirSync(IN).forEach(file => {
    if (config.ignore.test(file)) return
    const skip = config.skipTransform.test(file)
    const next = path.join(IN, file)
    const nextOut = path.join(OUT, file)
    if (fs.lstatSync(next).isFile()) cb(next, nextOut, skip)
    else recurseThrough(config, next, nextOut, cb, outDir)
  })
}
