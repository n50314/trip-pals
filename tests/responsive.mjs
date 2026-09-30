import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const baseUrl = process.env.TEST_URL || "http://127.0.0.1:3000";
const output = process.env.RWD_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

async function noOverflow(label) {
  const result = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
  assert.ok(result.page <= result.viewport + 1, `${label}: horizontal overflow ${JSON.stringify(result)}`);
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "開啟香川旅遊" }).click();
  for (const width of [320, 390, 620, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const tab of ["overview", "schedule", "map", "places", "shopping", "memos"]) {
      await page.locator(`[data-tab="${tab}"]`).click();
      await noOverflow(`${width} ${tab}`);
      if (output && [390, 1440].includes(width) && ["overview", "schedule"].includes(tab)) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `${output}/${tab}-${width}.png`, fullPage: tab === "overview" });
      }
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator('[data-tab="schedule"]').click();
  const arrival = page.locator(".timeline-event").filter({ hasText: "搭乘星宇航空 JX300" });
  await arrival.locator("summary").click();
  assert.equal(await arrival.locator(".event-note p").isVisible(), true);
  await arrival.getByRole("button", { name: /更多行程操作/ }).click();
  assert.equal(await page.locator("#eventActionsBackdrop").isVisible(), true);
  await page.getByRole("button", { name: "提前15分鐘", exact: true }).click();
  assert.match(await arrival.locator(".event-time-label").innerText(), /12:05/);
  await arrival.getByRole("button", { name: /編輯行程/ }).click();
  await noOverflow("mobile edit modal");
  await page.getByLabel("項目名稱", { exact: true }).fill("長標題測試：搭乘星宇航空抵達高松機場與旅伴集合後前往租車櫃檯");
  await page.getByLabel("備註", { exact: true }).filter({ visible: true }).fill("集合資訊與提醒".repeat(20));
  await page.getByRole("button", { name: "儲存修改" }).click();
  await noOverflow("long itinerary");
  const events = await page.locator(".timeline-event").evaluateAll((nodes) => nodes.map((node) => ({ top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom })));
  for (let i = 1; i < events.length; i++) assert.ok(events[i].top >= events[i - 1].bottom, "Mobile cards must not overlap");

  // Two short, overlapping visits remain reachable on a phone and readable in
  // the desktop timeline. Resizing must retain an unfinished quick-add entry.
  const firstEvent = page.locator(".timeline-event").first();
  await firstEvent.getByRole("button", { name: /編輯行程/ }).click();
  await page.getByLabel("開始時間", { exact: true }).fill("12:05");
  await page.getByLabel("結束時間", { exact: true }).fill("12:10");
  await page.getByLabel("鎖定行程（不可拖曳，AI 也不會修改）").check();
  await page.getByRole("button", { name: "儲存修改" }).click();
  await firstEvent.getByRole("button", { name: /更多行程操作/ }).click();
  assert.equal(await page.getByRole("button", { name: "提前15分鐘", exact: true }).isDisabled(), true);
  await page.keyboard.press("Escape");
  const nextEvent = page.locator(".timeline-event").filter({ hasText: "Budget 高松機場店取車出發" });
  await nextEvent.getByRole("button", { name: /編輯行程/ }).click();
  await page.getByLabel("開始時間", { exact: true }).fill("12:05");
  await page.getByLabel("結束時間", { exact: true }).fill("12:15");
  await page.getByRole("button", { name: "儲存修改" }).click();
  assert.equal(await page.locator(".timeline-event.has-conflict").count(), 2);
  const conflicts = await page.locator(".timeline-event.has-conflict").evaluateAll((nodes) => nodes.map((node) => ({ top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom })));
  assert.ok(conflicts[1].top >= conflicts[0].bottom);
  await page.getByLabel("新增行程", { exact: true }).fill("尚未送出的行程");
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.equal(await page.getByLabel("新增行程", { exact: true }).inputValue(), "尚未送出的行程");
  const clipped = await page.locator(".timeline-event").evaluateAll((nodes) => nodes.filter((node) => node.scrollHeight > node.clientHeight + 1).length);
  assert.equal(clipped, 0, "Desktop short visits must not clip text or actions");
  await page.setViewportSize({ width: 390, height: 844 });

  await page.locator('[data-tab="shopping"]').click();
  await page.getByTitle("管理名字").click();
  await page.getByPlaceholder("輸入名字").fill("旅伴小安");
  await page.locator("#nameForm").getByRole("button", { name: "加入", exact: true }).click();
  await page.getByRole("button", { name: "關閉", exact: true }).click();
  await page.locator("#shoppingForm").getByLabel("想買的東西", { exact: true }).fill("日本限定伴手禮與季節限定口味巧克力禮盒");
  await page.locator("#shoppingNote").fill("預算 ¥3,000 / 兩盒，請留意賞味期限");
  await page.getByRole("button", { name: "加入清單", exact: true }).click();
  const row = page.locator(".shopping-row").filter({ hasText: "日本限定伴手禮" });
  await row.getByRole("button", { name: "✓ 已購買", exact: true }).click();
  assert.equal(await row.getByRole("button", { name: "✓ 已購買", exact: true }).getAttribute("aria-pressed"), "true");
  assert.match(await page.locator("#shoppingSummary").innerText(), /已購買 1 件/);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(`${width} populated shopping`);
    if (output && [390, 1440].includes(width)) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${output}/shopping-${width}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 320, height: 600 });
  await row.getByRole("button", { name: /編輯代購項目/ }).click();
  await noOverflow("320 shopping modal");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#editShoppingModalBackdrop").isVisible(), false);
  await page.getByRole("button", { name: "回到旅程首頁" }).click();
  await noOverflow("320 home");
  assert.deepEqual(errors, []);
  console.log("Responsive checks passed: 6 viewport widths, all 6 panels, itinerary details/actions, long content, shopping status, dialogs, and mobile home.");
} finally {
  await browser.close();
}
