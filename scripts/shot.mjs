// Visual QA: node scripts/shot.mjs <path> [more paths] [--mobile] [--fold] [--as=<persona>]
// Saves screenshots to .qa/ using the locally installed Chrome or Edge. `--as` enters through the demo personas.
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const mobile = args.includes("--mobile");
const fold = args.includes("--fold");
const as = args.find((a) => a.startsWith("--as="))?.slice(5);
const base = process.env.BASE_URL ?? "http://localhost:3200";
const paths = args.filter((a) => !a.startsWith("--"));
const executablePath = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((p) => p && existsSync(p));

mkdirSync(".qa", { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext(
  mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } },
);
const page = await context.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));

if (as) {
  await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.click(`[data-persona="${as}"]`);
  await page.waitForURL((u) => !u.pathname.startsWith("/demo"), { timeout: 120_000 });
}

for (const p of paths) {
  const res = await page.goto(base + p, { waitUntil: "networkidle", timeout: 180_000 }).catch(async () => null);
  await page.waitForTimeout(900);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const name = `${(as ? `${as}_` : "") + p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}${mobile ? "-mobile" : ""}${fold ? "-fold" : ""}.png`;
  await page.screenshot({ path: `.qa/${name}`, fullPage: !fold });
  console.log(`${res?.status() ?? "?"} ${p} → .qa/${name}${overflow > 0 ? `  OVERFLOW ${overflow}px` : ""}`);
}
if (errors.length) console.log("Console errors:\n" + [...new Set(errors)].map((e) => "  " + e.slice(0, 300)).join("\n"));
await browser.close();
