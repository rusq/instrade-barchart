import assert from "node:assert/strict";
import test from "node:test";

import {
  runPageExport,
  symbolFromInsiderTradesUrl,
} from "../extension/background.js";

function response(status, payload, extraHeaders = {}) {
  const headers = new Map(
    Object.entries(extraHeaders).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {get: (name) => headers.get(name.toLowerCase()) || null},
    text: async () => typeof payload === "string" ? payload : JSON.stringify(payload),
  };
}

function fakeDocument() {
  const attributes = new Set();
  return {
    documentElement: {
      hasAttribute: (name) => attributes.has(name),
      setAttribute: (name) => attributes.add(name),
      removeAttribute: (name) => attributes.delete(name),
    },
  };
}

function dependencies(fetchFunction, overrides = {}) {
  const updates = [];
  const downloads = [];
  return {
    value: {
      locationHref: "https://www.barchart.com/stocks/quotes/MSFT/insider-trades?page=1",
      cookieHeader: "other=1; XSRF-TOKEN=token%20value",
      documentObject: fakeDocument(),
      fetchFunction,
      now: new Date(2026, 8, 21),
      ui: {update: (message, kind) => updates.push({message, kind})},
      download: async (body, filename) => downloads.push({body, filename}),
      ...overrides,
    },
    updates,
    downloads,
  };
}

test("recognizes and decodes supported insider-trades URLs", () => {
  assert.equal(
    symbolFromInsiderTradesUrl(
      "https://www.barchart.com/stocks/quotes/BRK.B/insider-trades?page=1",
    ),
    "BRK.B",
  );
  assert.equal(symbolFromInsiderTradesUrl("https://www.barchart.com/"), null);
  assert.equal(
    symbolFromInsiderTradesUrl(
      "https://example.com/stocks/quotes/MSFT/insider-trades",
    ),
    null,
  );
});

test("paginates raw records and downloads newline-terminated NDJSON", async () => {
  const firstPage = Array.from({length: 100}, (_, index) => ({
    raw: {symbol: "MSFT", index},
  }));
  const requested = [];
  const setup = dependencies(async (url, options) => {
    requested.push({url: new URL(url), options});
    return requested.length === 1
      ? response(200, {data: firstPage})
      : response(200, {data: [{raw: {symbol: "MSFT", index: 100}}]});
  });

  const result = await runPageExport(setup.value);

  assert.deepEqual(result, {
    ok: true,
    symbol: "MSFT",
    count: 101,
    pages: 2,
    filename: "barchart-insider-trades-MSFT-2026-09-21.ndjson",
  });
  assert.equal(requested.length, 2);
  assert.equal(requested[0].url.searchParams.get("limit"), "100");
  assert.equal(requested[1].url.searchParams.get("page"), "2");
  assert.equal(requested[0].options.credentials, "include");
  assert.equal(requested[0].options.headers["X-XSRF-TOKEN"], "token value");
  assert.equal(setup.downloads.length, 1);
  assert.equal(setup.downloads[0].body.split("\n").length, 102);
  assert.ok(setup.downloads[0].body.endsWith("\n"));
  assert.deepEqual(JSON.parse(setup.downloads[0].body.split("\n")[100]), {
    symbol: "MSFT",
    index: 100,
  });
});

test("downloads an empty file when no trades are returned", async () => {
  const setup = dependencies(async () => response(200, {data: []}));
  const result = await runPageExport(setup.value);

  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.equal(setup.downloads[0].body, "");
});

test("uses empty objects when a result has no raw record", async () => {
  const setup = dependencies(async () => response(200, {data: [{}]}));
  const result = await runPageExport(setup.value);

  assert.equal(result.ok, true);
  assert.equal(setup.downloads[0].body, "{}\n");
});

test("uses the browser session when no XSRF token is exposed", async () => {
  let requestOptions;
  const setup = dependencies(async (_url, options) => {
    requestOptions = options;
    return response(200, {data: [{raw: {symbol: "MSFT"}}]});
  }, {cookieHeader: "other=1"});

  const result = await runPageExport(setup.value);

  assert.equal(result.ok, true);
  assert.equal(result.count, 1);
  assert.deepEqual(requestOptions.headers, {Accept: "application/json"});
  assert.equal(requestOptions.credentials, "include");
});

for (const [name, mockResponse, expected] of [
  ["WAF challenge", response(202, "", {"x-amzn-waf-action": "challenge"}), /another browser challenge/],
  ["forbidden session", response(403, {error: "Forbidden"}), /rejected the browser session/],
  ["rate limit", response(429, {error: "Too Many Requests"}), /rate-limited/],
  ["invalid JSON", response(200, "not json"), /not valid JSON/],
  ["unexpected payload", response(200, {count: 0}), /unexpected API response shape/],
]) {
  test(`reports ${name}`, async () => {
    const setup = dependencies(async () => mockResponse);
    const result = await runPageExport(setup.value);
    assert.equal(result.ok, false);
    assert.match(result.error, expected);
    assert.equal(setup.downloads.length, 0);
  });
}

test("rejects duplicate invocation in one document", async () => {
  const documentObject = fakeDocument();
  documentObject.documentElement.setAttribute("data-instrade-export-running", "");
  const setup = dependencies(async () => response(200, {data: []}), {
    documentObject,
  });

  const result = await runPageExport(setup.value);

  assert.deepEqual(result, {
    ok: false,
    error: "An export is already running in this tab.",
  });
});

test("stops when Barchart repeats a full page", async () => {
  const fullPage = Array.from({length: 100}, (_, index) => ({raw: {index}}));
  const setup = dependencies(async () => response(200, {data: fullPage}));

  const result = await runPageExport(setup.value);

  assert.equal(result.ok, false);
  assert.match(result.error, /repeated a full result page/);
});
