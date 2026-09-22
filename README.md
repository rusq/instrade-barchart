# Barchart insider-trades exporter

This repository now includes a local Chrome/Brave extension for exporting
Barchart insider-trade data from a normal browser session. The browser handles
Barchart's AWS WAF challenge; the extension does not bypass or synthesize WAF
tokens.

## Install the unpacked extension

### Brave

1. Open `brave://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository's `extension` directory.

### Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository's `extension` directory.

After changing an extension file, return to the extensions page and click the
extension's **Reload** button.

## Export trades

1. Open a URL such as
   `https://www.barchart.com/stocks/quotes/MSFT/insider-trades?page=1`.
2. Wait for the page to load and complete any challenge or CAPTCHA shown by
   Barchart.
3. Click **Barchart Insider Trades Exporter** in the browser toolbar.
4. Follow progress in the panel at the bottom-right of the page.

The extension requests pages sequentially in batches of 100 and downloads
`barchart-insider-trades-<SYMBOL>-<YYYY-MM-DD>.ndjson`. Each line is the API
result's `raw` trade object. A non-empty file ends with a newline.

The current site can authorize API requests using the browser session without
exposing an XSRF cookie. If an older session does expose `XSRF-TOKEN`, the
extension sends it as well. If the extension reports a challenge or rejected
session, reload the Barchart page, finish any browser prompt, and retry. For
HTTP 429, wait before retrying. Brave Shields can also be disabled for
`barchart.com` as a diagnostic if the page itself does not load correctly.

The extension has temporary access only to the tab where its toolbar button is
clicked. It does not request persistent cookie or browsing permissions.

## Load an export into DuckDB

The recommended loader is the cross-platform Python script. Install the one
runtime dependency in a virtual environment:

```sh
python -m venv .venv
# Linux/macOS:
. .venv/bin/activate
# Windows PowerShell:
# .venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Pass the NDJSON export downloaded by the extension:

```sh
python load_data.py \
  --database msft.duckdb \
  barchart-insider-trades-MSFT-2026-09-21.ndjson
```

If the database does not exist, the script creates the `insiders` table and
views from `initialise.sql`. When it already exists, the current `insiders`
rows are replaced inside a transaction; the views remain available. A failed
load is rolled back. The input file is never modified.

The DuckDB command-line workflow remains available for users who already have
the DuckDB CLI installed:

```sh
duckdb msft.duckdb < load.sql
```

## Development checks

The extension has no runtime packages or build step. Run its offline tests with:

```sh
npm test
```

Validate the manifest and legacy Python syntax with:

```sh
uv run python -m json.tool extension/manifest.json >/dev/null
uv run python -m compileall obsolete/browser.py obsolete/scrape.py obsolete/testreq.py
```

## Legacy Python experiment

The scripts in `obsolete/` remain for reference. Their direct HTTP requests
cannot complete Barchart's current browser-side AWS WAF challenge, so the
extension is the supported live export path.
