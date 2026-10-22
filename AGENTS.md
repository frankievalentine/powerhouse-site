# Instructions for coding agents

- Static site in `public/`, deployed to Cloudflare Pages. No build step and no frameworks; keep it that way unless asked.
- Use `bun`/`bunx`, not npm or npx. `bun run dev` serves the site locally.
- Colors come from the tokens at the top of `public/styles.css`, which mirror the powerhouse app (`src/client/styles/global.css` there). Every color needs a light and a dark value; define light on `:root` and dark in both the `prefers-color-scheme: dark` block and `[data-theme="dark"]`.
- The orb in `public/main.js` ports the app's `src/client/pulse/blob.ts`; keep the shader in step with it.
- External requests are limited by the CSP in `public/_headers` (Google Fonts only). Update it with anything new the page loads.
- Demo content is made up; never present it as real customers or results.
