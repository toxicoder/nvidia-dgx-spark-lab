/*
 * Browser verification for the Fumadocs documentation site.
 *
 * Drives a real Chromium through the exported (or dev-served) site and asserts the things
 * a reader would notice: every navigation page renders, search finds pages by title and by
 * tag, the ported MkDocs widgets still work, and both colour schemes use the Overeazy
 * Voltage palette rather than the Material indigo the old theme shipped.
 *
 * Run against the dev server or a static export:
 *   node scripts/verify_site.mjs                 # http://localhost:3140
 *   VERIFY_BASE=http://localhost:3141 node scripts/verify_site.mjs
 *
 * Navigations use `waitUntil: "commit"` plus an explicit settle: the hydrated client router
 * keeps link prefetches in flight, so `networkidle` never fires on this site.  The base URL
 * has to carry a host the dev server accepts (localhost, not 127.0.0.1) or Next blocks the
 * dev resource requests and no client component ever hydrates.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";

import { chromium } from "playwright";

const BASE = process.env.VERIFY_BASE ?? "http://localhost:3140";
const CHROME =
  process.env.VERIFY_CHROME ??
  `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/` +
    "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const problems = [];

/** Returned by a probe whose page died mid-flight, so the checks below report failure. */
const PROBE_FAILED = Symbol("probe-failed");

/** Report one assertion, keeping the failure text for the summary. */
function check(name, ok, detail) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? `  ::  ${detail}` : ""}`);
  if (!ok) problems.push(`${name}${detail ? `  ::  ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true, executablePath: CHROME });

/** Console/page errors seen across the run, reported at the end. */
const collectedErrors = [];

/** Open a page with error capture; `scheme` pins the colour scheme via the media query. */
async function open(scheme = "light", viewport = { width: 1440, height: 950 }) {
  const context = await browser.newContext({ viewport, baseURL: BASE, colorScheme: scheme });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  const errors = [];
  page.__errors = errors;
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // Keep the originating URL: the filter below has to tell a harness-induced abort apart
    // from a real page error, and the message alone does not say which request failed.
    errors.push(`console: ${m.text()} @${m.location()?.url ?? ""}`);
  });
  // The client router prefetches the targets of every visible link.  Those requests are
  // never awaited, hold sockets open, and exhaust Chromium's six-per-host pool, which
  // wedges a crawl partway.  The harness always performs real navigations, so the
  // prefetched RSC payloads are not needed here.
  const aborted = [];
  await page.route((url) => url.searchParams.has("_rsc"), (route) => {
    aborted.push(route.request().url());
    void route.abort();
  });
  page.__aborted = aborted;
  page.on("requestfailed", (r) => {
    if (/_rsc/.test(r.url())) return;
    // The router prefetches the targets of visible links; those are in flight when the
    // context closes, so Chromium reports them as aborted.  Record the failure text so the
    // console gate can tell that teardown artefact apart from a request that really failed.
    errors.push(`requestfailed: ${r.url()} [${r.failure()?.errorText ?? "unknown"}]`);
  });
  // A missing asset is a response, not a failed request, so it never reaches the two
  // listeners above.  This is the check that catches an export whose baked asset prefix
  // does not match where it is served: every chunk comes back 404 and hydration dies
  // silently, which no string check on the HTML notices.
  page.on("response", (res) => {
    const status = res.status();
    if (status < 400) return;
    const url = res.url();
    if (!url.startsWith(BASE)) return;
    errors.push(`http ${status}: ${url}`);
  });
  return page;
}

/**
 * Run one assertion pass against a throwaway page.
 *
 * Each navigation leaves link prefetches in flight; reusing a context across the whole
 * crawl exhausts the browser's per-host socket pool and later navigations then time out,
 * so every crawled page gets its own context.
 */
async function withPage(run, scheme = "light", viewport = { width: 1440, height: 950 }) {
  const page = await open(scheme, viewport);
  try {
    return await run(page);
  } catch (error) {
    // A probe that cannot complete is a failure, but must not stop the other checks.
    const detail = String(error).split("\n")[0];
    console.log(`ERR   ${detail}`);
    return PROBE_FAILED;
  } finally {
    collectedErrors.push(...(page.__errors ?? []).map((line) => ({ line, aborted: page.__aborted ?? [] })));
    await page.context().close().catch(() => undefined);
  }
}

/** Commit a navigation and wait until the document is actually usable. */
async function goto(page, path, settleMs = 2200) {
  const res = await page.goto(BASE + path, { waitUntil: "commit" });
  await page
    .waitForSelector("h1, [data-fd-page], main", { state: "attached", timeout: 30000 })
    .catch(() => undefined);
  await page.waitForTimeout(settleMs);
  return res;
}

const css = (page, selector, prop) =>
  page.evaluate(([s, p]) => {
    const el = document.querySelector(s);
    return el ? getComputedStyle(el)[p] : null;
  }, [selector, prop]);

const count = (page, selector) => page.evaluate((s) => document.querySelectorAll(s).length, selector);

const text = (page, selector) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
  }, selector);

/** Collapse an `rgb()`/`#hex` colour to `r,g,b` so palettes can be compared exactly. */
function toRgb(value) {
  if (!value) return null;
  const match = value.match(/([\d.]+),\s*([\d.]+),\s*([\d.]+)/u);
  if (!match) return value.toLowerCase();
  return [match[1], match[2], match[3]].map((n) => Math.round(Number(n))).join(",");
}

/** True for bluer-than-red tones, i.e. the Material indigo the old theme used. */
function isIndigo(rgb) {
  if (!rgb || !rgb.includes(",")) return false;
  const [r, g, b] = rgb.split(",").map((n) => Number(n.trim()));
  return b > 120 && b > r + 25 && b > g + 25;
}

const VOLTAGE = {
  light: { background: "247,243,235", foreground: "22,19,17", primary: "#c67a0a" },
  dark: { background: "18,16,14", foreground: "243,237,227", primary: "#e8a317" },
};

/**
 * Turn a content path into the address the site serves it at.
 *
 * Mirrors `keepAuthorSlugs` in `lib/source.ts`: the extension goes and an `index` page is
 * reachable at its directory address, which is how MkDocs published them.
 */
function urlFor(file) {
  const segments = file.replace(/\.mdx?$/u, "").split("/").filter(Boolean);
  if (segments.at(-1) === "index") segments.pop();
  return segments.length === 0 ? "/" : `/${segments.join("/")}/`;
}

// ------------------------------------------------------------------ navigation
const nav = JSON.parse(await readFile("lib/nav.json", "utf8"));
const routes = [];
for (const tab of nav) {
  for (const pg of tab.pages) routes.push({ tab: tab.title, file: pg.path, title: pg.title, url: urlFor(pg.path) });
}

console.log(`\n### NAVIGATION  ${routes.length} pages / ${nav.length} tabs`);
const badPages = [];
for (const route of routes) {
  const outcome = await withPage(async (page) => {
    const res = await page.goto(BASE + route.url, { waitUntil: "commit" });
    await page.waitForSelector("h1", { state: "attached", timeout: 30000 }).catch(() => undefined);
    return { status: res ? res.status() : 0, heading: await text(page, "h1") };
  });
  if (outcome.status !== 200 || !outcome.heading) {
    badPages.push(`${route.url} status=${outcome.status} h1=${JSON.stringify(outcome.heading)}`);
  }
}
check(`every navigation page renders with a heading (${routes.length})`, badPages.length === 0, badPages.slice(0, 5).join(" | "));

// The tab strip is collapsed into a switcher button on this layout; open it to see all six.
const tabTitles = nav.map((t) => t.title);
const home = await open();
await goto(home, "/");
// The switcher is labelled with the tab the reader is on, which on the home page is the
// first tab rather than any of the others, so match whichever label it currently shows.
const switcher = home.locator("button").filter({ hasText: new RegExp(`^(${tabTitles.join("|")})`, "u") }).first();
for (let attempt = 0; attempt < 2; attempt += 1) {
  if (await count(home, '[role="dialog"]') > 0) break;
  if ((await switcher.count()) === 0) break;
  await switcher.click({ timeout: 10000 }).catch(() => undefined);
  await home.waitForSelector('[role="dialog"]', { state: "attached", timeout: 10000 }).catch(() => undefined);
  await home.waitForTimeout(900);
}
const dialogState = await home.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) return { items: [], text: null };
  return {
    items: Array.from(dialog.querySelectorAll("button, a, [role=\"option\"], [role=\"menuitem\"]"))
      .map((el) => (el.textContent ?? "").replace(/\s+/gu, " ").trim()),
    text: (dialog.textContent ?? "").replace(/\s+/gu, "").trim()
  };
});
const collapsedDialogText = dialogState.text;
for (const want of tabTitles) {
  const seen = dialogState.items.includes(want) || (collapsedDialogText ?? "").includes(want);
  check(`tab "${want}" is offered`, seen, `items=${JSON.stringify(dialogState.items.slice(0, 8))} dialog=${JSON.stringify(collapsedDialogText)?.slice(0, 90)}`);
}
await home.keyboard.press("Escape");
await home.waitForTimeout(400);

// Every internal link the sidebar offers has to resolve.
const sidebarLinks = await home.evaluate(() => {
  const seen = new Set();
  for (const a of Array.from(document.querySelectorAll("a[href]"))) {
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname.startsWith("/_next")) continue;
    seen.add(url.pathname);
  }
  return Array.from(seen);
});
collectedErrors.push(...(home.__errors ?? []).map((line) => ({ line, aborted: home.__aborted ?? [] })));
await home.context().close();

const deadLinks = [];
for (const path of sidebarLinks) {
  const status = await withPage(async (page) => {
    const res = await page.goto(BASE + path, { waitUntil: "commit" });
    return res ? res.status() : 0;
  });
  if (status !== 200) deadLinks.push(`${path}=${status}`);
}
check(`every sidebar link resolves (${sidebarLinks.length} crawled)`, deadLinks.length === 0, deadLinks.slice(0, 6).join(" "));

// ------------------------------------------------------------------ theme
console.log("\n### THEME  Overeazy Voltage");
for (const scheme of ["light", "dark"]) {
  const page = await open(scheme);
  await goto(page, "/");
  const cls = await page.evaluate(() => document.documentElement.className);
  check(`[${scheme}] scheme class applied`, cls.split(/\s+/u).includes(scheme), `class="${cls}"`);
  const bg = toRgb(await css(page, "body", "backgroundColor"));
  const fg = toRgb(await css(page, "body", "color"));
  check(`[${scheme}] background is Voltage`, bg === VOLTAGE[scheme].background, `got ${bg} want ${VOLTAGE[scheme].background}`);
  check(`[${scheme}] text is Voltage`, fg === VOLTAGE[scheme].foreground, `got ${fg} want ${VOLTAGE[scheme].foreground}`);
  const primary = (await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-fd-primary")
  )).trim().toLowerCase();
  check(`[${scheme}] --color-fd-primary is Voltage`, primary === VOLTAGE[scheme].primary, `got ${primary} want ${VOLTAGE[scheme].primary}`);
  const painted = await page.evaluate(() => {
    const out = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const s = getComputedStyle(el);
      out.push(s.backgroundColor, s.color, s.borderColor);
    }
    return out;
  });
  const indigo = painted.filter(isIndigo);
  check(`[${scheme}] no indigo left anywhere`, indigo.length === 0, `${indigo.length} value(s), e.g. ${indigo.slice(0, 3).join(" / ")}`);
  const wordmark = await text(page, "aside, header");
  check(`[${scheme}] wordmark shows brand + project`, /overeazy/u.test(wordmark ?? "") && /nvidia-dgx-spark-lab/u.test(wordmark ?? ""), JSON.stringify(wordmark)?.slice(0, 70));
  const repoLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href*="github.com"]')).map((a) => a.getAttribute("href"))
  );
  check(`[${scheme}] repository link present`, repoLinks.length > 0, JSON.stringify(repoLinks.slice(0, 2)));
  const edit = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a")).find((x) => /edit this page/i.test(x.textContent ?? ""));
    return a?.getAttribute("href") ?? null;
  });
  check(`[${scheme}] edit link targets the repo`, /\/blob\/(main|development)\/docs\//u.test(edit ?? ""), JSON.stringify(edit)?.slice(0, 120));
  await page.context().close();
}

// ------------------------------------------------------------------ widgets
// Each widget page gets its own context: the router's in-flight prefetches are tied to a
// context, and reusing one across many navigations exhausts the per-host socket pool.
console.log("\n### WIDGETS");

const diagrams = await withPage(async (page) => {
  await goto(page, "/architecture/", 4500);
  return page.evaluate(() => {
    const hosts = Array.from(document.querySelectorAll('[aria-label="Mermaid diagram"]'));
    return { hosts: hosts.length, drawn: hosts.filter((h) => h.querySelector("svg")).length };
  });
});
check(
  "mermaid fences render as SVG",
  diagrams !== PROBE_FAILED && diagrams.hosts >= 5 && diagrams.drawn === diagrams.hosts,
  JSON.stringify(diagrams)
);

const tabState = await withPage(async (page) => {
  await goto(page, "/getting-started/", 2500);
  const total = await count(page, '[role="tab"]');
  if (total < 2) return { total, before: null, after: null };
  const before = await text(page, '[role="tabpanel"]');
  await page.locator('[role="tab"]').nth(1).click();
  await page.waitForTimeout(600);
  return { total, before, after: await text(page, '[role="tabpanel"]') };
});
const okTabs = tabState !== PROBE_FAILED;
check("tabs render", okTabs && tabState.total > 1, `role=tab count ${okTabs ? tabState.total : "unreachable"}`);
check(
  "clicking a tab swaps its panel",
  okTabs && Boolean(tabState.before) && tabState.before !== tabState.after,
  `${JSON.stringify(tabState.before)?.slice(0, 45)} -> ${JSON.stringify(tabState.after)?.slice(0, 45)}`
);

/**
 * Find a page whose source actually contains a callout, so the probe is not asserting on a
 * page that never had one.  The codemod rewrote every MkDocs `!!!` admonition into
 * `<Callout type=…>`, so the source is the authority on where they are.
 */
async function pageWithCallouts() {
  for (const route of routes) {
    for (const ext of [".mdx", ".md"]) {
      const file = `../docs/${route.file.replace(/\.mdx?$/u, "")}${ext}`;
      try {
        if ((await readFile(file, "utf8")).includes("<Callout")) return route;
      } catch {
        /* that extension is not the one on disk */
      }
    }
  }
  return null;
}

const calloutRoute = await pageWithCallouts();
const callouts = calloutRoute
  ? await withPage(async (page) => {
      await goto(page, urlFor(calloutRoute.file), 2500);
      return page.evaluate(() => {
        // The library marks the callout container through its --callout-color custom property.
        const boxes = Array.from(document.querySelectorAll("div")).filter((d) =>
          (d.getAttribute("style") ?? "").includes("--callout-color"));
        return {
          count: boxes.length,
          titled: boxes.filter((d) => d.querySelector("p")).length,
          colour: boxes.length ? (boxes[0].getAttribute("style") ?? "").replace(/\s+/gu, " ").trim() : null
        };
      });
    })
  : PROBE_FAILED;
const okCallouts = callouts !== PROBE_FAILED && callouts !== null;
check(
  "callouts render on a page that has admonitions",
  okCallouts && callouts.count > 0 && callouts.titled === callouts.count,
  calloutRoute
    ? `${urlFor(calloutRoute.file)} :: ${JSON.stringify(okCallouts ? callouts : "unreachable")}`.slice(0, 190)
    : "no page in the content tree contains <Callout>"
);

const panel = await withPage(async (page) => {
  await goto(page, "/dev-workspaces/", 2500);
  const shape = await page.evaluate(() => {
    const box = document.querySelector(".cluster-config");
    const inputs = Array.from(document.querySelectorAll(".cluster-config input"));
    return { present: Boolean(box), inputs: inputs.length, values: inputs.map((i) => i.value).slice(0, 4) };
  });
  if (shape.inputs === 0) return { ...shape, before: null, after: null, prose: "" };
  const field = page.locator(".cluster-config input").first();
  const before = await field.inputValue();
  await field.fill("10.0.0.99");
  await field.dispatchEvent("input");
  await page.waitForTimeout(400);
  return {
    ...shape,
    before,
    after: await field.inputValue(),
    prose: await page.evaluate(() => document.body.innerText),
  };
});
const okPanel = panel !== PROBE_FAILED;
check("command-vars panel renders with editable tokens", okPanel && panel.present && panel.inputs > 0, JSON.stringify(panel));
check("token stays user-editable (not frozen)", okPanel && panel.after === "10.0.0.99" && panel.before !== panel.after, `${okPanel ? panel.before : "?"} -> ${okPanel ? panel.after : "?"}`);
check(
  "tokens still appear as placeholders in prose",
  okPanel && (/\{\{[A-Z][A-Z0-9_]+\}\}/u.test(panel.prose) || /<[a-z][a-z-]*>/u.test(panel.prose)),
  "no placeholder left in body"
);

const abbr = await withPage(async (page) => {
  await goto(page, "/glossary/", 2500);
  return page.evaluate(() => ({
    total: document.querySelectorAll("abbr").length,
    titled: document.querySelectorAll("abbr[title]").length,
    sample: Array.from(document.querySelectorAll("abbr[title]")).slice(0, 3).map((a) => `${a.textContent}=${(a.getAttribute("title") ?? "").slice(0, 24)}`),
  }));
});
const okAbbr = abbr !== PROBE_FAILED;
check("glossary tooltips are injected", okAbbr && abbr.titled > 0, JSON.stringify(abbr));
const abbrStyle = await withPage(async (page) => {
  await goto(page, "/glossary/", 2000);
  return css(page, "abbr[title]", "text-decoration-line");
});
check("glossary tooltips are styled", Boolean(abbrStyle) && abbrStyle !== "none" && abbrStyle !== PROBE_FAILED, String(abbrStyle));

// ------------------------------------------------------------------ search
console.log("\n### SEARCH");
const search = await withPage(async (page) => {
  await goto(page, "/");
  // The header renders two search triggers and only one of them is laid out at a given
  // breakpoint; the shortcut the dialog advertises (Ctrl-K) is the one path that always
  // reaches the same handler, so drive that rather than guess which button is visible.
  await page.keyboard.press("Control+k");
  await page
    .waitForSelector('[role="dialog"]', { state: "attached", timeout: 15000 })
    .catch(() => undefined);
  await page.waitForTimeout(800);
  const opened = await count(page, '[role="dialog"]');
  const box = page.locator('[role="dialog"] input').first();

  /**
   * Read the dialog's current result signature: an emptiness marker plus the row texts.
   *
   * Result rows are buttons (activating one pushes the route), not anchors.
   */
  const signature = () =>
    page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return "NO-DIALOG";
      const rows = Array.from(dialog.querySelectorAll('button[aria-selected], [role="option"], a[href]'))
        .map((el) => (el.textContent ?? "").replace(/\s+/gu, " ").trim())
        .filter((line) => line.length > 1 && !/^(close search)$/iu.test(line));
      return `${/no results found/iu.test(dialog.textContent ?? "") ? "EMPTY" : "HITS"}::${rows.join("|")}`;
    });

  /**
   * Make the client load its index before any assertion runs.
   *
   * The index is a multi-megabyte static export that the client fetches and loads lazily on
   * the first query, so the very first term typed would otherwise be read back as "no
   * results" while that load is still in flight.  Querying a term known to exist, and
   * waiting for hits, proves the engine is live before the real checks start.
   */
  async function warmIndex() {
    await box.fill("kubernetes");
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      if (await signature() !== "NO-DIALOG") {
        const sig = await signature();
        if (sig.startsWith("HITS::")) return true;
      }
      await page.waitForTimeout(300);
    }
    return false;
  }

  const warmed = await warmIndex();
  check("search index loads on first query", warmed, warmed ? "engine ready" : "no hits for a known term within 90s");

  /**
   * Type a term and wait for the result list to reflect *that* term.
   *
   * The client debounces input and the multi-megabyte index is fetched on first query, so
   * the list keeps showing the previous term's hits for a moment.  Waiting on "is there a
   * result" would therefore be satisfied by leftovers, so poll until the rendered signature
   * stops changing and only then read it.  Result rows are buttons (activating one pushes
   * the route), not anchors.
   */
  async function resultsFor(term) {
    await box.fill("");
    const before = await signature();
    await box.fill(term);
    let previous = await signature();
    let changed = previous !== before;
    let stableFor = 0;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const now = await signature();
      if (now !== previous) {
        changed = true;
        previous = now;
        stableFor = 0;
      } else {
        stableFor += 1;
      }
      // Wait for the term to have taken effect and the list to stop moving.
      if (changed && stableFor >= 4) break;
      await page.waitForTimeout(250);
    }
    const final = await signature();
    if (final.startsWith("EMPTY")) return [];
    return final.split("::").slice(1).join("::").split("|").filter(Boolean);
  }

  const byTitle = await resultsFor("Resource Guard");
  const byTag = await resultsFor("kubernetes");
  const byBody = await resultsFor("nccl");
  const nonsense = await resultsFor("zzqxvjsfvj");

  // Activating the top hit has to take the reader to that page.
  let navigatedTo = null;
  if (byTitle.length > 0) {
    await box.fill("");
    await box.fill("Resource Guard");
    await page
      .waitForFunction(
        () => {
          const dialog = document.querySelector('[role="dialog"]');
          if (!dialog) return false;
          const rows = Array.from(dialog.querySelectorAll('button[aria-selected], [role="option"], a[href]'))
            .map((el) => (el.textContent ?? "").replace(/\s+/gu, " ").trim());
          return rows.some((line) => /resource guard/iu.test(line));
        },
        undefined,
        { timeout: 30000 }
      )
      .catch(() => undefined);
    await page.keyboard.press("Enter");
    await page
      .waitForFunction(() => location.pathname.replace(/\/+$/u, "").length > 0, undefined, { timeout: 30000 })
      .catch(() => undefined);
    await page.waitForTimeout(1200);
    navigatedTo = await page.evaluate(() => location.pathname);
  }

  return { opened, byTitle, byTag, byBody, nonsense, navigatedTo };
});
const okSearch = search !== PROBE_FAILED;
check("search opens", okSearch && search.opened > 0, `dialog ${okSearch ? search.opened : "unreachable"}`);
check("search finds a page by its title", okSearch && search.byTitle.some((r) => /resource guard/iu.test(r)), okSearch ? search.byTitle.slice(0, 3).join(" | ") : "unreachable");
check("search matches tag-derived text", okSearch && search.byTag.length > 0, okSearch ? search.byTag.slice(0, 3).join(" | ") : "unreachable");
check("search finds content inside a page", okSearch && search.byBody.length > 0, okSearch ? search.byBody.slice(0, 3).join(" | ") : "unreachable");
check("search shows an empty state for a nonsense term", okSearch && search.nonsense.length === 0, okSearch ? JSON.stringify(search.nonsense).slice(0, 120) : "unreachable");
check("activating a result navigates to that page", okSearch && Boolean(search.navigatedTo) && search.navigatedTo !== "/", String(okSearch ? search.navigatedTo : "unreachable"));

// ------------------------------------------------------------------ mobile
console.log("\n### MOBILE (390px)");
const mobile = await withPage(async (page) => {
  // The landing page is a hub with no sidebar tree on desktop either, so measure the drawer
  // on a content page where the navigation is actually expected to be populated.
  await goto(page, "/operate/dashboard/");
  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    let widest = 0;
    let culprit = "";
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const box = el.getBoundingClientRect();
      if (box.width > widest) {
        widest = box.width;
        culprit = `${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 40)}`;
      }
    }
    return { client: de.clientWidth, widest: Math.round(widest), culprit };
  });
  const burger = await count(page, 'button[aria-label="Open Sidebar"]');
  let drawerLinks = 0;
  let drawerSample = [];
  if (burger > 0) {
    await page.locator('button[aria-label="Open Sidebar"]').first().click({ timeout: 15000 });
    await page.waitForTimeout(1200);
    const drawer = await page.evaluate(() => {
      const el = document.getElementById("nd-sidebar-mobile");
      if (!el) return null;
      return Array.from(el.querySelectorAll("a[href]")).map((a) => (a.textContent ?? "").replace(/\s+/gu, " ").trim()).filter(Boolean);
    });
    if (drawer) {
      drawerLinks = drawer.length;
      drawerSample = drawer.slice(0, 6);
    }
  }
  return { overflow, burger, drawerLinks, drawerSample, heading: await text(page, "h1") };
}, "light", { width: 390, height: 844 });
const okMobile = mobile !== PROBE_FAILED;
check("no horizontal overflow", okMobile && mobile.overflow.widest <= mobile.overflow.client + 1, JSON.stringify(mobile.overflow));
check("mobile menu button exists", okMobile && mobile.burger > 0, `buttons ${okMobile ? mobile.burger : "unreachable"}`);
check("mobile drawer opens with navigation", okMobile && mobile.drawerLinks > 3, `links ${okMobile ? mobile.drawerLinks : "unreachable"} :: ${okMobile ? mobile.drawerSample.join(" | ") : ""}`.slice(0, 160));
check("mobile renders the page content", okMobile && Boolean(mobile.heading), JSON.stringify(mobile.heading));

// ------------------------------------------------------------------ console
console.log("\n### CONSOLE");
/** Console noise that is unrelated to the site itself. */
const HARNESS_NOISE = /favicon|DevTools|istanbul|Download the React|Launch|Web Vitals|_next\/hmr|WebSocket|non-Error|Failed to fetch/iu;

/**
 * Decide whether a console error is an artefact of this harness rather than of the site.
 *
 * Two artefacts are excused, and only these:
 *  - `open()` aborts the router's `_rsc` prefetches on purpose (see the comment there), and
 *    Chromium reports each abort as a failed load plus a follow-up "Failed to fetch RSC
 *    payload" — excused only when the entry names a URL this harness really did abort.
 *  - prefetches still in flight when a context closes come back `net::ERR_ABORTED`; the
 *    harness closes every context the moment a probe finishes, so those are not page faults.
 *
 * A 4xx/5xx response is never excused: that is how a bad asset prefix shows up.
 */
function harnessInduced(entry) {
  if (HARNESS_NOISE.test(entry.line)) return true;
  if (/net::ERR_ABORTED\]$/u.test(entry.line)) return true;
  return entry.aborted.some((url) => entry.line.includes(url));
}

const noise = collectedErrors.filter((entry) => !harnessInduced(entry));
check(
  "no console errors on the pages exercised",
  noise.length === 0,
  noise.slice(0, 5).map((entry) => entry.line).join(" | ")
);

await browser.close();

console.log(`\n${"=".repeat(64)}`);
if (problems.length === 0) {
  console.log("ALL CHECKS PASSED");
} else {
  console.log(`${problems.length} FAILURE(S):`);
  for (const p of problems) console.log(`  - ${p}`);
}
process.exitCode = problems.length === 0 ? 0 : 1;
await browser.close().catch(() => undefined);
process.exit(process.exitCode);
