const BARCHART_PAGE_RE = /^https:\/\/www\.barchart\.com\/stocks\/quotes\/([^/?#]+)\/insider-trades(?:[/?#]|$)/;

export function symbolFromInsiderTradesUrl(value) {
  const match = BARCHART_PAGE_RE.exec(value);
  if (!match) {
    return null;
  }

  try {
    const symbol = decodeURIComponent(match[1]).trim();
    return symbol || null;
  } catch {
    return null;
  }
}

// This function is deliberately self-contained. chrome.scripting serializes it
// before running it in the page's MAIN world, so it cannot use module globals.
export async function runPageExport(testDependencies) {
  const PAGE_RE = /^https:\/\/www\.barchart\.com\/stocks\/quotes\/([^/?#]+)\/insider-trades(?:[/?#]|$)/;
  const FIELDS = [
    "symbol",
    "symbolName",
    "fullName",
    "shortJobTitle",
    "transactionType",
    "transactionDate",
    "amount",
    "reportedPrice",
    "usdValue",
    "eodHolding",
    "eodHoldingPercentage",
    "symbolCode",
    "hasOptions",
    "symbolType",
    "lastPrice",
    "dailyLastPrice",
  ];
  const PAGE_SIZE = 100;
  const RUNNING_ATTRIBUTE = "data-instrade-export-running";

  function parseSymbol(value) {
    const match = PAGE_RE.exec(value);
    if (!match) {
      throw new Error("Open a Barchart insider-trades page before exporting.");
    }

    let symbol;
    try {
      symbol = decodeURIComponent(match[1]).trim();
    } catch {
      throw new Error("The symbol in the current page URL is invalid.");
    }
    if (!symbol) {
      throw new Error("The current page URL does not contain a symbol.");
    }
    return symbol;
  }

  function cookieValue(cookieHeader, name) {
    for (const part of cookieHeader.split(";")) {
      const separator = part.indexOf("=");
      if (separator === -1) {
        continue;
      }
      if (part.slice(0, separator).trim() === name) {
        try {
          return decodeURIComponent(part.slice(separator + 1));
        } catch {
          throw new Error(`${name} contains invalid URL encoding.`);
        }
      }
    }
    return null;
  }

  function apiUrl(symbol, page) {
    const url = new URL(
      "https://www.barchart.com/proxies/core-api/v1/insiderTrades/get",
    );
    url.searchParams.set("fields", FIELDS.join(","));
    url.searchParams.set("orderBy", "transactionDate");
    url.searchParams.set("orderDir", "desc");
    url.searchParams.set(`eq(symbol,${symbol})`, "");
    url.searchParams.set(
      "notIn(shortJobTitle,(US Congressman,US Senator))",
      "",
    );
    url.searchParams.set(
      "meta",
      "field.shortName,field.type,field.description",
    );
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("raw", "1");
    url.searchParams.set("page", String(page));
    return url.toString();
  }

  function safeFilenameSymbol(symbol) {
    const safe = symbol.replace(/[^A-Za-z0-9._-]+/g, "_");
    return safe || "unknown";
  }

  function localDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function createPanel(documentObject) {
    const oldPanel = documentObject.getElementById("instrade-export-status");
    if (oldPanel) {
      oldPanel.remove();
    }

    const host = documentObject.createElement("div");
    host.id = "instrade-export-status";
    host.style.cssText = [
      "all:initial",
      "position:fixed",
      "z-index:2147483647",
      "right:16px",
      "bottom:16px",
    ].join(";");
    const shadow = host.attachShadow({mode: "open"});
    const style = documentObject.createElement("style");
    style.textContent = `
      .panel {
        box-sizing: border-box;
        width: min(360px, calc(100vw - 32px));
        padding: 14px 42px 14px 16px;
        border: 1px solid #c8d1dc;
        border-radius: 10px;
        background: #fff;
        box-shadow: 0 6px 24px rgb(0 0 0 / 24%);
        color: #17202a;
        font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .title { margin-bottom: 5px; font-weight: 650; }
      .message { overflow-wrap: anywhere; white-space: pre-wrap; }
      .panel[data-kind="error"] { border-color: #c62828; }
      .panel[data-kind="success"] { border-color: #2e7d32; }
      button {
        position: absolute;
        top: 7px;
        right: 8px;
        border: 0;
        background: transparent;
        color: #52606d;
        cursor: pointer;
        font: 20px/1 sans-serif;
      }
    `;
    const panel = documentObject.createElement("div");
    panel.className = "panel";
    panel.dataset.kind = "progress";
    const title = documentObject.createElement("div");
    title.className = "title";
    title.textContent = "Barchart export";
    const message = documentObject.createElement("div");
    message.className = "message";
    const close = documentObject.createElement("button");
    close.type = "button";
    close.title = "Close";
    close.setAttribute("aria-label", "Close export status");
    close.textContent = "\u00d7";
    close.addEventListener("click", () => host.remove());
    panel.append(title, message, close);
    shadow.append(style, panel);
    (documentObject.body || documentObject.documentElement).append(host);

    return {
      update(text, kind = "progress") {
        panel.dataset.kind = kind;
        message.textContent = text;
      },
    };
  }

  function browserDownload(documentObject, body, filename) {
    const blob = new Blob([body], {type: "application/x-ndjson;charset=utf-8"});
    const objectUrl = URL.createObjectURL(blob);
    const anchor = documentObject.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.hidden = true;
    (documentObject.body || documentObject.documentElement).append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  const dependencies = testDependencies || {
    locationHref: globalThis.location.href,
    cookieHeader: globalThis.document.cookie,
    documentObject: globalThis.document,
    fetchFunction: globalThis.fetch.bind(globalThis),
    now: new Date(),
  };
  const root = dependencies.documentObject?.documentElement;

  if (root?.hasAttribute(RUNNING_ATTRIBUTE)) {
    dependencies.ui?.update(
      "An export is already running in this tab.",
      "error",
    );
    return {ok: false, error: "An export is already running in this tab."};
  }
  const ui = dependencies.ui || createPanel(dependencies.documentObject);
  root?.setAttribute(RUNNING_ATTRIBUTE, "");

  try {
    const symbol = parseSymbol(dependencies.locationHref);
    const token = cookieValue(dependencies.cookieHeader || "", "XSRF-TOKEN");

    const records = [];
    let page = 1;
    let previousPageSignature = null;
    while (true) {
      ui.update(`Exporting ${symbol}: page ${page}, ${records.length} records`);
      const headers = {Accept: "application/json"};
      if (token) {
        headers["X-XSRF-TOKEN"] = token;
      }
      const response = await dependencies.fetchFunction(apiUrl(symbol, page), {
        method: "GET",
        credentials: "include",
        headers,
      });

      const wafAction = response.headers?.get?.("x-amzn-waf-action");
      if (response.status === 202 || wafAction === "challenge") {
        throw new Error(
          "Barchart requested another browser challenge. Reload the page, finish the challenge, and try again.",
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Barchart rejected the browser session (HTTP ${response.status}). Reload the page and try again.`,
        );
      }
      if (response.status === 429) {
        throw new Error("Barchart rate-limited the export (HTTP 429). Wait and try again.");
      }
      if (!response.ok) {
        throw new Error(`Barchart API request failed with HTTP ${response.status}.`);
      }

      let payload;
      try {
        payload = JSON.parse(await response.text());
      } catch {
        throw new Error("Barchart returned a response that was not valid JSON.");
      }
      if (!payload || !Array.isArray(payload.data)) {
        throw new Error("Barchart returned an unexpected API response shape.");
      }

      const pageRecords = payload.data.map((item) => {
        return item && item.raw && typeof item.raw === "object" ? item.raw : {};
      });
      const signature = JSON.stringify(pageRecords);
      if (pageRecords.length === PAGE_SIZE && signature === previousPageSignature) {
        throw new Error("Barchart repeated a full result page; export stopped to avoid an infinite loop.");
      }
      previousPageSignature = signature;
      records.push(...pageRecords);

      if (pageRecords.length < PAGE_SIZE) {
        break;
      }
      page += 1;
      if (page > 1000) {
        throw new Error("Export exceeded the 1,000-page safety limit.");
      }
    }

    const ndjson = records.map((record) => JSON.stringify(record)).join("\n") +
      (records.length ? "\n" : "");
    const filename = `barchart-insider-trades-${safeFilenameSymbol(symbol)}-${localDate(dependencies.now)}.ndjson`;
    if (dependencies.download) {
      await dependencies.download(ndjson, filename);
    } else {
      browserDownload(dependencies.documentObject, ndjson, filename);
    }
    ui.update(
      `Downloaded ${filename}\n${records.length} records from ${page} page${page === 1 ? "" : "s"}.`,
      "success",
    );
    return {ok: true, symbol, count: records.length, pages: page, filename};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ui.update(message, "error");
    return {ok: false, error: message};
  } finally {
    root?.removeAttribute(RUNNING_ATTRIBUTE);
  }
}

async function showBadgeError(tabId, message) {
  await chrome.action.setBadgeBackgroundColor({tabId, color: "#b3261e"});
  await chrome.action.setBadgeText({tabId, text: "ERR"});
  await chrome.action.setTitle({tabId, title: message});
  setTimeout(async () => {
    try {
      await chrome.action.setBadgeText({tabId, text: ""});
      await chrome.action.setTitle({
        tabId,
        title: "Export Barchart insider trades",
      });
    } catch {
      // The tab might have been closed.
    }
  }, 5000);
}

if (typeof chrome !== "undefined" && chrome.action) {
  chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id || !tab.url || !symbolFromInsiderTradesUrl(tab.url)) {
      if (tab.id) {
        await showBadgeError(
          tab.id,
          "Open a Barchart insider-trades page before exporting.",
        );
      }
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        world: "MAIN",
        func: runPageExport,
      });
    } catch (error) {
      await showBadgeError(
        tab.id,
        `Could not start export: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
}
