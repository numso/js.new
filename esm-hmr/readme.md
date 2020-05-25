copied from https://github.com/pikapkg/esm-hmr
copied at 85216b54920876eac7320a0a49c629de66cf3a73
we should switch to esm-hmr from npm if they publish non-typescript source
if we do switch to it, we can remove ws from our deps

the client does check for id.endsWith('.js') and forces a reload if it's not a js file. could be a problem for us. or maybe we rewrite all our other assets to .js?
