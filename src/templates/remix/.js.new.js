module.exports = config => {
  return {
    ...config,
    template: 'remix',
    outputDir: '.dist',
    jsx: { runtime: 'automatic', importSource: '@remix-run/dom' },
    ignore: /^\./,
    skipTransform: /\.html$|\.toml$/,
    tailwind: { input: 'input.css', output: 'tailwind.css' }
  }
}
