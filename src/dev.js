const childProcess = require('child_process')
const chokidar = require('chokidar')
const lexer = require('es-module-lexer')
const fs = require('fs')
const http = require('http')
const mime = require('mime-types')
const open = require('open')
const path = require('path')

const { fileExists, SUFFIX, NOT_FOUND } = require('./common')
const getConfig = require('./config')
const startHMR = require('./hmr')
const { transformMW } = require('./transform')

module.exports = async (dir, template, netlify, port) => {
  await lexer.init
  const BASE = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir)
  createProject(BASE, template, netlify)

  const hmr = startHMR()
  let config
  const refreshConfig = () => {
    config = getConfig()
    const customizePath = path.join(BASE, '.js.new.js')
    try {
      config = require(customizePath)(config)
      delete require.cache[require.resolve(customizePath)]
    } catch (error) {
      console.error(error)
    }
    refreshIndex()
  }

  let indexFile
  const refreshIndex = () => {
    const index = path.join(BASE, 'index.html')
    const index2 = path.join(
      __dirname,
      'templates',
      config.template,
      'index.html'
    )
    indexFile = fs.readFileSync(fileExists(index) ? index : index2, 'utf8')
    indexFile = hmr.applyIndex(indexFile)
    indexFile = indexFile.replace(
      /<body.*?>/,
      `$&\n    <script>
      window.$js_new_error$ = error => {
        const pre = document.createElement('pre')
        pre.style = "font-family: 'Cascadia Code', monospace; background: ${config.theme.bg}; color: ${config.theme.fg}; padding: 32px; margin: 0; height: 100vh; box-sizing: border-box;"
        pre.innerHTML = error
        document.body.replaceWith(pre)
      }
    </script>`
    )
  }
  refreshConfig()

  const server = http.createServer((req, res) => {
    initServer({ BASE })(req, res)
    if (req.url.includes(NOT_FOUND)) return res.writeHead(404).end()
    if (hmr.mount(req, res)) return
    if (!fileExists(req.filePath)) return res.send(indexFile, '.html')
    if (config.ignore.test(req.fileName)) return res.send(indexFile, '.html')
    if (!req.originalUrl.endsWith('.js')) return res.sendFile(req.filePath)
    transformMW({ BASE, hmr, config, dev: true })(req, res)
  })
  server.listen(port, () => console.log(`Listening on ${port}`))

  const handleWatch = file => {
    if (file === path.join(BASE, '.js.new.js')) refreshConfig()
    if (file === path.join(BASE, 'index.html')) refreshIndex()
    hmr.trigger(file.replace(BASE, ''))
  }
  const watcher = chokidar.watch(BASE, {
    persistent: true,
    ignoreInitial: true
  })
  watcher.on('add', handleWatch)
  watcher.on('change', handleWatch)
  watcher.on('unlink', handleWatch)

  openBrowser(port)
  openEditor(BASE)
}

function createProject (dir, template, netlify) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (fs.readdirSync(dir).length === 0) {
    const templatePath = path.join(__dirname, 'templates', template)
    fs.readdirSync(templatePath).forEach(file => {
      fs.copyFileSync(path.join(templatePath, file), path.join(dir, file))
    })
    if (netlify && !fileExists(path.join(dir, 'netlify.toml'))) {
      const netlifyPath = path.join(__dirname, 'templates', 'netlify.toml')
      fs.copyFileSync(netlifyPath, path.join(dir, 'netlify.toml'))
    }
  }
  if (!fileExists(path.join(dir, '.js.new.js'))) {
    const configPath = path.join(__dirname, 'templates', '.js.new.js')
    const contents = fs
      .readFileSync(configPath, 'utf8')
      .replace(/\{\{TEMPLATE\}\}/g, template)
    fs.writeFileSync(path.join(dir, '.js.new.js'), contents)
  }
}

function initServer ({ BASE }) {
  return (req, res) => {
    req.originalUrl = req.url.split('?mtime')[0]
    req.url = req.originalUrl.replace(SUFFIX, '')
    req.filePath = path.join(BASE, req.url)
    req.fileName = path.basename(req.filePath)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.send = (contents, ext) => {
      res.writeHead(200, { 'Content-Type': mime.lookup(ext) }).end(contents)
    }
    res.sendFile = filePath => {
      res.send(fs.readFileSync(filePath), path.extname(filePath))
    }
  }
}

function openBrowser (port) {
  open(`http://localhost:${port}`, { wait: false, url: true }).catch(() => {})
}

function openEditor (dir) {
  if (process.env.NO_EDITOR) return
  dir = dir.replace(/\\/g, '\\\\')
  childProcess
    .spawn('code', [dir], { detached: true, stdio: 'ignore', shell: true })
    .on('error', () => null)
    .unref()
}
