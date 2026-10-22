# powerhouse-site

The one-screen site for [powerhouse](https://github.com/frankievalentine/powerhouse): the live orb and a scripted demo of what powerhouse does, in light and dark.

Plain HTML, CSS and JavaScript in `public/`, with no build step, served by a Cloudflare Worker as static assets (what Cloudflare now calls Pages).

```sh
bun install
bun run dev      # http://localhost:8787
bun run deploy   # deploy public/ to Cloudflare
```

## What's where

- `public/index.html`: the page.
- `public/styles.css`: color tokens (the app's own light and dark values) and layout.
- `public/theme.js`: applies a picked theme before the first paint.
- `public/main.js`: the theme switch, the orb (the app's metaball shader in plain WebGL 2) and the demo script, one chapter per feature.
- `public/_headers`: security headers and the Content-Security-Policy.

Everything in the demo is an example: the roles, jobs, people and costs are made up.
