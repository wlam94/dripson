/**
 * Localhost Monitor — style-ai
 * Screenshots every page, checks for common issues, writes a flagged report.
 * Usage: node scripts/check-localhost.mjs [--url http://localhost:3000]
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT   = join(__dir, "..");
const SS_DIR = join(ROOT, "screenshots");
const REPORT = join(ROOT, "screenshots", "report.json");

const BASE_URL = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : "http://localhost:3000";

const PAGES = [
  { path: "/",        name: "dashboard" },
  { path: "/upload",  name: "upload" },
  { path: "/wardrobe",name: "wardrobe" },
  { path: "/outfits", name: "outfits" },
  { path: "/history", name: "history" },
  { path: "/gaps",    name: "gaps" },
];

// Known non-fatal errors to suppress (expected when Supabase not configured)
const IGNORED_ERRORS = [
  "supabaseUrl is required",
  "Download the React DevTools",
  "Warning:",
  "Failed to load resource: the server responded with a status of 404",
  "Failed to load resource: the server responded with a status of 400",
];

function isIgnored(msg) {
  return IGNORED_ERRORS.some(s => msg.includes(s));
}

// ── Check helpers ────────────────────────────────────────────────────────────

async function checkPage(page, name) {
  const flags = [];

  // 1. Runtime / Next.js error overlay — only flag if the dialog is VISIBLE
  //    nextjs-portal always exists in DOM; check for visible error dialog content
  const hasVisibleError = await page.evaluate(() => {
    // Next.js 13+ error overlay: look for a visible dialog with error content
    const dialogs = document.querySelectorAll("[data-nextjs-dialog], nextjs-portal");
    for (const el of dialogs) {
      const shadow = el.shadowRoot;
      if (shadow) {
        const inner = shadow.querySelector("[data-nextjs-dialog]");
        if (inner && getComputedStyle(inner).display !== "none") return true;
      }
    }
    // Fallback: look for the error toast/badge ("N Issues" button)
    const issueBtn = document.querySelector("[data-nextjs-toast]");
    if (issueBtn && issueBtn.textContent && /\d+ issue/i.test(issueBtn.textContent)) return true;
    return false;
  });
  if (hasVisibleError) {
    flags.push({ severity: "ERROR", issue: "Next.js runtime error overlay is visible" });
  }

  // 2. Unhandled React error boundary
  const errorBoundary = await page.locator("text=Something went wrong").count();
  if (errorBoundary > 0) flags.push({ severity: "ERROR", issue: "React error boundary triggered" });

  // 3. Sidebar clipping — main content must start AFTER the sidebar
  const h1Clip = await page.evaluate(() => {
    const sidebar = document.querySelector("aside");
    if (!sidebar) return false;
    const sidebarRight = sidebar.getBoundingClientRect().right;
    const main = document.getElementById("main-content") || document.querySelector("main");
    if (!main) return false;
    const mainLeft = main.getBoundingClientRect().left;
    // Flag if main content area starts more than 20px inside the sidebar
    return mainLeft < sidebarRight - 20;
  });
  if (h1Clip) flags.push({ severity: "ERROR", issue: "Main content area overlaps fixed sidebar (layout broken)" });

  // 4. Blank / empty content area
  const mainText = await page.evaluate(() => {
    const main = document.getElementById("main-content") || document.querySelector("main");
    return main ? main.innerText.trim().length : 0;
  });
  if (mainText < 20) flags.push({ severity: "ERROR", issue: "Main content area appears blank or nearly empty" });

  // 5. Broken images (only external URLs that 404'd)
  const brokenImgs = await page.evaluate(() => {
    return [...document.querySelectorAll("img[src]")].filter(img => {
      return img.src.startsWith("http") && img.complete && img.naturalWidth === 0 && img.naturalHeight === 0;
    }).length;
  });
  if (brokenImgs > 0) flags.push({ severity: "WARN", issue: `${brokenImgs} broken image(s) detected` });

  // 6. Button/CTA present (regression: no interactive elements)
  const ctaCount = await page.locator("button, a[class*='btn']").count();
  if (ctaCount === 0) flags.push({ severity: "WARN", issue: "No buttons or CTAs found on page" });

  // Note: Font check removed — Playwright headless doesn't trigger lazy font loading,
  // causing false positives. Fonts verified manually via screenshots.

  return flags;
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  mkdirSync(SS_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page    = await context.newPage();

  const consoleErrors = [];
  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", err => consoleErrors.push(err.message));

  const report = {
    url:       BASE_URL,
    timestamp: new Date().toISOString(),
    summary:   { ok: 0, warn: 0, error: 0 },
    pages:     [],
  };

  for (const { path, name } of PAGES) {
    const url = BASE_URL + path;
    const ssPath = join(SS_DIR, `${name}.png`);
    consoleErrors.length = 0;

    let navError = null;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 12000 });
      await page.waitForTimeout(500); // allow animations to settle
    } catch (e) {
      navError = e.message;
    }

    const screenshot = await page.screenshot({ path: ssPath, fullPage: false }).catch(() => null);
    const flags = navError
      ? [{ severity: "ERROR", issue: `Navigation failed: ${navError}` }]
      : await checkPage(page, name);

    // include console errors (skip known non-fatal ones)
    for (const ce of consoleErrors) {
      if (!isIgnored(ce)) {
        flags.push({ severity: "ERROR", issue: `Console error: ${ce.slice(0, 120)}` });
      }
    }

    const status = flags.some(f => f.severity === "ERROR") ? "ERROR"
                 : flags.some(f => f.severity === "WARN")  ? "WARN"
                 : "OK";

    if (status === "OK")    report.summary.ok++;
    if (status === "WARN")  report.summary.warn++;
    if (status === "ERROR") report.summary.error++;

    report.pages.push({ name, url, status, flags, screenshot: ssPath });

    const icon = status === "ERROR" ? "✗" : status === "WARN" ? "⚠" : "✓";
    console.log(`${icon}  ${name.padEnd(12)} ${status}`);
    for (const f of flags) console.log(`   [${f.severity}] ${f.issue}`);
  }

  await browser.close();

  writeFileSync(REPORT, JSON.stringify(report, null, 2));

  const { ok, warn, error } = report.summary;
  console.log(`\n── Summary ─────────────────────────────`);
  console.log(`   OK: ${ok}  WARN: ${warn}  ERROR: ${error}`);
  console.log(`   Report: ${REPORT}`);

  if (error > 0) process.exit(1);
})();
