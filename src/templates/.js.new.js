module.exports = config => {
  return {
    ...config,
    template: '{{TEMPLATE}}',
    outputDir: '.dist',
    ignore: /^\./,
    skipTransform: /\.html$|\.toml$/
  }
}
