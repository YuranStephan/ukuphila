import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

// Read-only checks against the existing server. Optional credentials add authenticated navigation.
const base = process.env.BASE_URL ?? "http://localhost:3200";
const executablePath = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((path) => path && existsSync(path));
if (!executablePath) throw new Error("Indica CHROME_PATH para executar a verificação de navegador.");
const browser = await chromium.launch({ executablePath, headless: true });
mkdirSync(".qa/e2e", { recursive: true });
let checks = 0;
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    for (const route of ["/", "/como-funciona", "/comerciantes", "/agentes", "/fornecedores", "/seguranca", "/entrar", "/registar", "/pitch"]) {
      const response = await page.goto(base + route, { waitUntil: "networkidle", timeout: 120_000 });
      assert.equal(response?.status(), 200, route);
      assert.ok(await page.locator("h1").first().isVisible(), `Título em ${route}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, `Largura em ${route}, ${width}px`);
      assert.doesNotMatch(await page.locator("body").innerText(), /ambiente de demonstração|dados sintéticos|simulador|ainda falta revisão independente|antes de uma operação real/i, route);
      checks += 4;
    }
    await page.goto(`${base}/demo`, { waitUntil: "networkidle" });
    assert.equal(new URL(page.url()).pathname, "/entrar");
    checks++;
    for (const route of ["/app", "/agente", "/gestao", "/risco", "/fornecedor"]) {
      await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 120_000 });
      // /app is a cacheable shell with no personal data; its API enforces the session after hydration.
      await page.waitForURL((url) => url.pathname === "/entrar", { timeout: 30_000 });
      assert.equal(new URL(page.url()).pathname, "/entrar", `Sessão exigida em ${route}`);
      checks++;
    }
    assert.equal((await context.request.get(`${base}/api/app/snapshot`)).status(), 401);
    assert.equal((await context.request.post(`${base}/api/app/action`, { data: { action: "support.open", title: "Não deve ser gravado" } })).status(), 401);
    assert.equal((await context.request.get(`${base}/api/cron/daily`)).status(), 401);
    checks += 3;
    await page.goto(`${base}/entrar`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Equipa", exact: true }).click();
    assert.equal(await page.locator("#email").getAttribute("type"), "text");
    checks++;
    await page.screenshot({ path: `.qa/e2e/entrada-${width}.png`, fullPage: true });
    if (process.env.E2E_USERNAME && process.env.E2E_PASSWORD) {
      await page.locator("#email").fill(process.env.E2E_USERNAME);
      await page.locator("#password").fill(process.env.E2E_PASSWORD);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await page.waitForTimeout(1500);
      if (await page.locator("#totp").isVisible()) {
        if (!process.env.E2E_TOTP) throw new Error("A conta exige autenticação forte. Fornece E2E_TOTP para este acesso.");
        await page.locator("#totp").fill(process.env.E2E_TOTP);
        await page.getByRole("button", { name: "Entrar", exact: true }).click();
      }
      await page.waitForURL((url) => url.pathname !== "/entrar", { timeout: 30_000 });
      const routes = (process.env.E2E_ROUTES ?? "/gestao,/gestao/agentes,/gestao/comerciantes,/gestao/fornecedores,/gestao/ia,/risco").split(",");
      for (const route of routes) {
        const response = await page.goto(base + route, { waitUntil: "networkidle", timeout: 120_000 });
        assert.equal(response?.status(), 200, route);
        assert.equal(new URL(page.url()).pathname, route);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, route);
        checks += 3;
      }
    }
    await context.close();
  }
  console.log(`${checks} verificações de navegador passaram.`);
  if (!process.env.E2E_USERNAME || !process.env.E2E_PASSWORD) console.log("Navegação autenticada não executada: faltam E2E_USERNAME e E2E_PASSWORD.");
} finally {
  await browser.close();
}
