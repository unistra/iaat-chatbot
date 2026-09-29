# AGENTS.md

## Repo layout
- `src/js/chatbot.ts` — the entire library (single file). Bundled via esbuild, exposes the class on `window.IaatChatbot` **and** as an ES default export. Tests rely on the global, so keep the `(window as any).IaatChatbot = IaatChatbot` line.
- `src/js/chatbot.test.js` — the only test file (jsdom via `@jest-environment` docblock, transformed by esbuild-jest; jest config is inline in `package.json`).
- `src/css/chatbot.css` — minified to `dist/css/chatbot.min.css` by postcss.
- `demo/index.html` — static demo page for manual verification in a browser.
- `dist/` and `docs/` are gitignored build artifacts. `dist/` is the npm publish target (`files: ["dist"]`, package `@iaat/chatbot`, consumed via unpkg by host pages).

## Commands
- `npm run build` — full pipeline with a fixed order: `test` → `lint:js` (eslint --fix) → `rm -rf dist` → esbuild bundle + css minify. Use this before publishing; a failing test or lint blocks the build.
- `npm test` — run the single Jest suite.
- `npm run type:js` — `tsc --noEmit` (only type-checks `src/js/chatbot.ts` per tsconfig `include`).
- `npm run lint:js` — eslint **with `--fix`** on `src/js/` (includes the test file); it rewrites files.
- `npm run doc` — regenerate `docs/` with typedoc.

## Testing conventions
- The test stubs `global.fetch` at file scope with an OpenAI-style response (`{ choices: [{ message: { content } }] }`) and builds the DOM fixture by injecting the `cb-*` class names from the README template.
- `chatbot.ts` is loaded via `require('./chatbot.ts')` and accessed through `global.IaatChatbot` after `jest.resetModules()`.
- Keep backend calls OpenAI-API-shaped; tests mock fetch, no real network or services needed.

## Notes
- ESLint enforces 2-space indent, single quotes, semicolons, `eqeqeq`, `no-console` (warn/error allowed) — `lint:js` auto-fixes these.
- UI element IDs/classes (e.g. `#iaat-chatbot`, `cb-chat-*`) are a public API for host pages; don't rename without updating the README template and `demo/index.html`.
- `.npmrc` (gitignored) holds a real npm auth token — never stage or print it.
