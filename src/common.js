const fs = require('fs')

exports.fileExists = function fileExists (path) {
  return fs.existsSync(path) && fs.lstatSync(path).isFile()
}

exports.SUFFIX = '.$js_new$.js'

exports.NOT_FOUND = '$js_new_404$'
