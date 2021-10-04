# js.new

This is the easiest way to get a prototyping environment up locally. All you've gotta do is run `npx js.new my-cool-app`. This'll create a new folder with a basic react app, start it up, and bring up vscode and a browser. You can run the exact same command to get the environment back up later.

## Features

- Dead simple (zero-install) to set up and run
- Live Reload included with HMR
- No `npm install` needed, dependencies are pulled straight from skypack
- Auto-generated Netlify config
- Blazing Fast!! Emoji, emoji, something, something... Did I do that right?

## Dependencies

You can pull in dependencies by just importing them. For example, when you type `import shortid from 'shortid'`, you'll pull in that dep automatically. There is no step 2! If you're having issues with versions you can pin to a specific version: `import shortid from 'shortid@2.2.16'`.

## Builders

We support loading the following filetypes: js, jsx, ts, tsx, css, json, jpg, png, bmp. If you want to support a different file type, you can add this to your `.js.new.js` file.

```js
  builders: {
    ...config.builders,
    '.svg': ({ url, filePath, babel, dev }) => `export default ${JSON.stringify(url)}`
  }
```

- `url` is a string you can use to reach your file from the browser
- `filepath` is a string you can use to read your file contents from the builder
- `babel` is a synchronous function you can call to transpile js/ts code. It's mainly used for macros (see below)
- `dev` is a boolean. whether or not you're running the build command (see below)

## Macros

If you name your file with a `.macro.js` or `.macro.ts` suffix, then we'll run your code server-side and whatever you `export default` from that file will be sent to the client. In this case, you will actually have to npm install your dependencies. We aren't pulling macro dependencies from skypack cuz it's not running in the browser.

## Deploying

This tool is meant for extremely rapid prototyping. We don't have bundling, minifying, etc. With that in mind, you can still run `npx js.new build` from within your project folder to generate a folder of your built assets. This folder can be hosted without the js.new server. Throw it on netlify, cloudfront, whatever. Remember though that your dependencies aren't pinned to a specific version by default. One of your dependencies might update and break you.

## Error Theming

If you don't like how the errors look you're in luck! You can re-theme them by adding something like this to your `.js.new.js` file. You'll have to mess with the colors to see what they affect.

```js
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
  }
```

## Typescript

You can start a typescript project with `npx js.new my-cool-app -t react-ts`. That's experimental though. I don't use typescript. Please file bugs.
