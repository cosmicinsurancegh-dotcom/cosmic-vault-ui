import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0, 200)); });
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: "artifacts/landing-hero.png" });

// Dismiss the consent banner so the rest of the page is unobstructed.
const essential = page.getByRole("button", { name: /essential only/i });
if (await essential.count()) {
  await essential.first().click();
  await page.waitForTimeout(500);
}

// Sections reveal on scroll, so a full-page capture has to pass over them
// first; otherwise everything below the fold is still at opacity 0.
const pageHeight = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < pageHeight; y += 700) {
  await page.evaluate((offset) => window.scrollTo({ top: offset, behavior: "instant" }), y);
  await page.waitForTimeout(140);
}
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await page.waitForTimeout(700);

await page.screenshot({ path: "artifacts/landing-full.png", fullPage: true });

for (const [name, selector] of [
  ["custody", "#custody"],
  ["store", "#store"],
  ["standards", "#standards"],
  ["evidence", "#evidence"],
  ["cover", "#cover"],
  ["tracking", "#tracking"],
  ["process", "#process"],
  ["review", "#review"],
]) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `artifacts/landing-${name}.png` });
}

// Open the review dialog from the closing CTA
const review = page.getByRole("button", { name: /request a vault review/i }).last();
await review.click();
await page.waitForTimeout(900);
await page.screenshot({ path: "artifacts/landing-dialog.png" });

// Mobile hero and store
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const mpage = await mobile.newPage();
await mpage.goto(base + "/", { waitUntil: "networkidle" });
await mpage.waitForTimeout(2200);
await mpage.screenshot({ path: "artifacts/landing-mobile-hero.png" });
await mpage.screenshot({ path: "artifacts/landing-mobile-full.png", fullPage: true });

await browser.close();
console.log("DONE");
