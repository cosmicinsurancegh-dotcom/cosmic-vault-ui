import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await mobile.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

const overflow = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));
console.log("OVERFLOW", JSON.stringify(overflow));

const essential = page.getByRole("button", { name: /essential only/i });
if (await essential.count()) {
  await essential.first().click();
  await page.waitForTimeout(600);
}

for (const [name, selector] of [
  ["store", "#store"],
  ["cover", "#cover"],
  ["tracking", "#tracking"],
  ["process", "#process"],
  ["review", "#review"],
]) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `artifacts/mobile-${name}.png` });
}

await page.getByRole("button", { name: /request a vault review/i }).last().click();
await page.waitForTimeout(900);
await page.screenshot({ path: "artifacts/mobile-dialog.png" });

await browser.close();
console.log("DONE");
