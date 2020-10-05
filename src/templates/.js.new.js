module.exports = config => {
  return {
    ...config,
    template: '{{TEMPLATE}}',
    outputDir: '{{OUTPUT}}'
  }
}
