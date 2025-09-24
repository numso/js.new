module.exports = config => {
  return {
    ...config,
    template: '{{TEMPLATE}}',
    outputDir: '.dist',
    ignore: /^\./,
    skipTransform: /\.html$|\.toml$/,
    tailwind: { input: 'input.css', output: 'tailwind.css' }
  }
}
