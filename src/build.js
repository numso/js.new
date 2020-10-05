const lexer = require('es-module-lexer')
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')

const { fileExists, SUFFIX } = require('./common')
const getConfig = require('./config')
const { transform } = require('./transform')

const configPath = a => (path.isAbsolute(a) ? a : path.join(process.cwd(), a))

const onError = error => {
  console.error(error)
  process.exit(1)
}

module.exports = async dir => {
  await lexer.init
  const base = configPath(dir)

  let config = getConfig()
  const customizePath = path.join(base, '.js.new.js')
  try {
    config = require(customizePath)(config)
  } catch (error) {
    onError(error)
  }

  const outDir = configPath(config.outputDir)

  const opts = { base, config, dev: false, onError }

  fs.rmdirSync(outDir, { recursive: true })
  // TODO:: Don't recurse through the outDir when copying over :P
  recurseThrough(base, outDir, (inputFile, outputFile) => {
    if (!inputFile.endsWith('.js')) {
      // TODO:: Builder should define whether or not this should be output
      fs.copyFileSync(inputFile, outputFile)
      outputFile += SUFFIX
    }
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

function recurseThrough (IN, OUT, cb) {
  fs.mkdirSync(OUT)
  fs.readdirSync(IN).forEach(file => {
    if (file.startsWith('.')) return
    const next = path.join(IN, file)
    const nextOut = path.join(OUT, file)
    if (fs.lstatSync(next).isFile()) cb(next, nextOut)
    else recurseThrough(next, nextOut, cb)
  })
}
