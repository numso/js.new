#!/usr/bin/env node

const argv = require('yargs')
  .command(['dev [path]', '*'], 'create and/or start a project', yargs => {
    yargs
      .positional('path', {
        describe: 'Path to your project',
        type: 'string',
        default: '.'
      })
      .option('template', {
        alias: 't',
        describe: 'Template to use',
        choices: ['react', 'react-ts'],
        default: 'react'
      })
      .option('port', {
        alias: 'p',
        describe: 'Port to listen on',
        number: true,
        default: 3000
      })
  })
  .command('build [path]', 'build a project', yargs => {
    yargs
      .positional('path', {
        describe: 'Path to your project',
        type: 'string',
        default: '.'
      })
      .option('output', {
        alias: 'o',
        describe: 'Output directory',
        default: '.dist'
      })
  }).argv

if (argv._.includes('build')) {
  require('./build')(argv.path, argv.output)
} else {
  require('./dev')(argv.path, argv.template, argv.port)
}
