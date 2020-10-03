const fs = require('fs')
const path = require('path')

const { EsmHmrEngine } = require('./server')
const { SUFFIX } = require('../common')

const hmrClient = fs.readFileSync(path.join(__dirname, 'client.js'), 'utf8')

module.exports = () => {
  const hmr = new EsmHmrEngine()

  function apply (contents, url, imports) {
    const isHmrEnabled = contents.includes('import.meta.hot')
    if (isHmrEnabled) {
      contents = `import * as $js_new_hmr$ from '/hmr.js'
import.meta.hot = $js_new_hmr$.createHotContext(import.meta.url)

${contents}`
    }
    hmr.setEntry(url, imports, isHmrEnabled)
    return contents
  }

  function applyIndex (contents) {
    return contents.replace(
      /<body.*?>/,
      '$&\n<script type="module" src="/hmr.js"></script>'
    )
  }

  function trigger (url) {
    if (!url.endsWith('.js')) url = url + SUFFIX
    doTrigger(url, new Set())
  }

  function doTrigger (url, visited) {
    if (visited.has(url)) return
    visited.add(url)
    const node = hmr.getEntry(url)
    if (node && node.isHmrEnabled) {
      hmr.broadcastMessage({ type: 'update', url })
    } else if (node && node.dependents.size > 0) {
      hmr.markEntryForReplacement(node, true)
      node.dependents.forEach(dep => doTrigger(dep, visited))
    } else {
      hmr.broadcastMessage({ type: 'reload' })
    }
  }

  function mount (req, res) {
    if (req.url === '/hmr.js') {
      res.send(hmrClient, '.js')
      return true
    }
  }

  function error (error) {
    hmr.broadcastMessage({ type: 'error', error })
  }

  return { apply, applyIndex, trigger, mount, error }
}
