const fs = require('fs')

const load = ({ filePath }) => fs.readFileSync(filePath, 'utf8')

const loadPath = ({ url }) => `export default ${JSON.stringify(url)}`

const css = ({ filePath, dev }) => {
  const contents = fs.readFileSync(filePath, 'utf8')
  let data = `const styleTag = document.createElement('style')
styleTag.appendChild(document.createTextNode(${JSON.stringify(contents)}))
document.head.appendChild(styleTag)`
  if (dev) {
    data += `
/**/
import.meta.hot.accept()
import.meta.hot.dispose(() => {
  document.head.removeChild(styleTag)
})`
  }
  return data
}

const json = ({ filePath, dev }) => {
  const contents = fs.readFileSync(filePath, 'utf8')
  let data = `let json = ${contents}\nexport default json`
  if (dev) {
    data += `
/**/
import.meta.hot.accept(({ module }) => {
  json = module.default
})`
  }
  return data
}

module.exports = () => ({
  template: 'react',
  outputDir: '.dist',
  theme: {
    fg: '#CCC',
    bg: '#0C0C0C',
    colors: {
      1: '#FF3366',
      2: '#13A10E',
      3: '#C19C00',
      6: '#3A96DD',
      8: '#767676'
    }
  },
  builders: {
    '.js': load,
    '.jsx': load,
    '.ts': load,
    '.tsx': load,
    '.css': css,
    '.json': json,
    '.jpg': loadPath,
    '.png': loadPath,
    '.bmp': loadPath
  }
})
