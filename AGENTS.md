# Repository Guidelines

## Project Structure & Module Organization

This repository is a compact experiment for collecting and exploring Barchart
insider-trade data. The supported live collector is now a local Manifest V3
Chrome/Brave extension.

- `extension/manifest.json` declares the unpacked extension and its minimal
  `activeTab` and `scripting` permissions.
- `extension/background.js` validates the active Barchart page, injects the
  exporter, paginates API results, reports progress, and downloads NDJSON.
- `tests/extension.test.js` contains deterministic offline tests using Node's
  built-in test runner.
- `README.md` documents unpacked installation, operation, and troubleshooting.
- `scrape.py`, `browser.py`, and `testreq.py` are legacy Python experiments;
  direct HTTP requests no longer pass Barchart's browser-side AWS WAF flow.
- `obsolete/experiments.ipynb` is exploratory work. Captured datasets and
  generated analysis artifacts are kept out of the public source tree.

Keep reusable live behavior in the extension rather than only in the notebook.
Do not commit `__pycache__/`, `.venv/`, browser profiles, downloaded exports,
credentials, cookies, XSRF values, or WAF tokens.

## Build, Test, and Development Commands

The extension is dependency-free and has no build step. Use Node for its tests
and uv for legacy Python checks:

```sh
npm test
node --check extension/background.js
uv run python -m json.tool extension/manifest.json >/dev/null
uv run python -m compileall browser.py scrape.py testreq.py
```

For a live check, load `extension/` unpacked from `chrome://extensions` or
`brave://extensions`, reload it after edits, open a Barchart insider-trades
page, and click the toolbar action. Live checks are opt-in because they use the
current browser session and Barchart may challenge or rate-limit requests.

## Coding Style & Naming Conventions

Use modern plain JavaScript with two-space indentation, semicolons, `const` by
default, camelCase functions and variables, and uppercase module constants.
Keep `runPageExport` self-contained: `chrome.scripting.executeScript` serializes
the function for the page's `MAIN` world, so it cannot depend on module-scope
bindings. Preserve the small explicit permission set and avoid third-party
runtime dependencies unless the repository guide and validation workflow are
updated with them.

For legacy Python, follow PEP 8 with four-space indentation, `snake_case`
functions and variables, `PascalCase` classes, uppercase constants, explicit
imports, and type annotations on reusable public parameters.

## Data and Browser-Session Semantics

Export only each API item's `raw` object, one compact JSON object per line, and
end non-empty NDJSON files with a newline. Keep pagination sequential with a
page size of 100 and retain the repeated-page and maximum-page safeguards.

Barchart currently succeeds with same-origin browser cookies even when
`document.cookie` exposes no `XSRF-TOKEN`. Always send requests with
`credentials: "include"`; add `X-XSRF-TOKEN` only when that cookie exists. Do
not attempt to manufacture tokens, bypass challenges, automate CAPTCHAs, or
move session credentials outside the browser. Keep explicit errors for WAF
challenges, rejected sessions, rate limits, malformed JSON, and unexpected API
shapes.

## Testing Guidelines

Add extension tests to `tests/extension.test.js` using `node:test` and strict
assertions. Inject fake fetch, UI, document, clock, and download dependencies so
routine tests remain offline. Cover URL and symbol parsing, request headers,
token-present and token-absent sessions, pagination boundaries, NDJSON output,
duplicate invocation, API failures, and loop safeguards. Do not make normal
test runs depend on Barchart or an installed browser extension.

## Commit & Pull Request Guidelines

This directory is not currently a Git checkout, so no local commit convention
can be inferred. Use short imperative subjects such as
`Support tokenless browser sessions`. Pull requests should explain behavioral
changes, list validation commands, and identify generated-data changes. Include
screenshots only when they clarify an extension UI change, and never include
session data or secrets.
