import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const executablePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = process.env.TEST_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseUrl });

await context.route("**/api/ai/place", (route) => route.fulfill({
  contentType: "application/json",
  body: JSON.stringify({ day: 2, time: "14:30", reason: "安排在同區域午後並保留交通時間。" }),
}));
await context.route("**/api/ai/chat", async (route) => {
  const body = route.request().postDataJSON();
  const items = body.trip.days[0].items.filter((candidate) => !candidate.locked);
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (body.message.includes("沿路")) {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        reply: "我已用 Google Maps 找到一個順路景點，請確認後加入。",
        summary: "Google Maps 建議加入皇居外苑。",
        mapsGrounded: true,
        mapsRequested: true,
        googleMapsSources: [{ name: "皇居外苑", url: "https://maps.google.com/?cid=123" }],
        operations: [{
          type: "add_new_place", itemId: "google-maps-1", title: "皇居外苑", sourceName: "皇居外苑",
          reason: "位於前往飯店的方向，可短暫停留。", targetDay: 1, startTime: "11:00", endTime: "11:45",
          note: "Google Maps 沿路建議", address: "東京都千代田區皇居外苑", area: "丸之內", mapUrl: "https://maps.google.com/?cid=123",
        }],
      }),
    });
    return;
  }
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      reply: "第一天有時間重疊風險，建議將其中一項延後十五分鐘。",
      summary: "預計調整第一天一項行程。",
      operations: [{
        type: "update", itemId: items[0].id, title: "延後十五分鐘", reason: "避免與前一項重疊。",
        targetDay: 1, startTime: "14:15", endTime: "15:00", note: "AI 建議調整", address: "",
      }, {
        type: "move_to_places", itemId: (items[1] || items[0]).id, title: "移除不順行程", reason: "這一站會讓當天動線不順。",
        targetDay: 1, startTime: "", endTime: "", note: "", address: "",
      }],
    }),
  });
});
await context.route("**/api/ai/import", (route) => route.fulfill({
  contentType: "application/json",
  body: JSON.stringify({
    title: "測試匯入", destination: "日本・香川",
    days: [
      { title: "高松散步", date: "2026-09-03", items: [
        { time: "上午", name: "上午自由活動", area: "高松", note: "可彈性調整", url: "" },
        { time: "10:00－11:30", name: "栗林公園", area: "高松", note: "從表格匯入", url: "https://example.com/ritsurin" },
      ] },
      { title: "自由活動", date: "2026-09-04", items: [] },
    ],
  }),
}));

const page = await context.newPage();
try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await assertVisibleText(page, "下一趟，去哪裡？");
  await page.getByRole("button", { name: "開啟香川旅遊" }).click();

  assert.ok(await page.locator('[data-tab="overview"]').evaluate((node) => node.classList.contains("active")));
  assert.equal(await page.locator(".overview-day").count(), 7);
  await assertVisibleText(page, "抵達高松・丸龜");
  assert.equal(await page.locator(".day-card").count(), 1);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-tab="schedule"]').click();
  const firstDay = page.locator(".day-card");
  const mobileDayJump = page.getByLabel("快速選擇第幾天");
  assert.ok((await mobileDayJump.boundingBox()).width >= 300);
  assert.equal(await page.locator(".schedule-day-sticky .day-jump span").evaluate((node) => getComputedStyle(node).display), "none");
  const mobileArrival = firstDay.locator(".timeline-item").filter({ hasText: "搭乘星宇航空 JX300" });
  assert.ok((await mobileArrival.boundingBox()).height >= 120);
  assert.equal(await mobileArrival.getByRole("button", { name: /編輯行程/ }).isVisible(), true);
  await assertVisibleText(mobileArrival, "地點");
  await assertVisibleText(mobileArrival, "備註");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('[data-tab="overview"]').click();
  await page.locator('[data-tab="schedule"]').click();
  const stickyDayJump = page.locator(".schedule-day-sticky");
  assert.equal(await stickyDayJump.evaluate((node) => getComputedStyle(node).position), "sticky");
  assert.ok((await page.getByLabel("快速選擇第幾天").boundingBox()).width >= 350);
  const castle = firstDay.locator(".timeline-item").filter({ hasText: "參觀丸龜城" });
  assert.ok((await castle.getByRole("link").getAttribute("href")).includes("google.com/maps/search"));
  assert.ok((await castle.boundingBox()).width > 850);
  assert.ok((await castle.boundingBox()).height >= 100);
  assert.equal(await castle.getByRole("button", { name: /編輯行程/ }).isVisible(), true);
  await assertVisibleText(castle, "地點");
  assert.equal(await castle.locator(".note-label").isVisible(), true);
  assert.equal(await castle.evaluate((node) => getComputedStyle(node, "::after").display), "none");
  assert.ok((await page.locator(".day-time-axis").boundingBox()).height < 1800);
  assert.ok((await castle.locator(".timeline-resize-handle").boundingBox()).width <= 40);
  await castle.scrollIntoViewIfNeeded();
  const stickyDayJumpBox = await stickyDayJump.boundingBox();
  assert.ok(stickyDayJumpBox.y >= 75 && stickyDayJumpBox.y <= 105);
  const arrival = firstDay.locator(".timeline-item").filter({ hasText: "搭乘星宇航空 JX300" });
  await arrival.getByRole("button", { name: /編輯行程/ }).click();
  const editModal = page.locator(".edit-itinerary-modal");
  const timeSteppers = editModal.locator(".time-stepper");
  const startStepperBox = await timeSteppers.nth(0).boundingBox();
  const endStepperBox = await timeSteppers.nth(1).boundingBox();
  assert.ok(Math.abs(startStepperBox.width - endStepperBox.width) < 2);
  assert.equal(await editModal.getByLabel("開始時間", { exact: true }).inputValue(), "12:20");
  assert.equal(await editModal.getByLabel("加入地圖與當日路線").isChecked(), true);
  await editModal.getByRole("button", { name: "開始時間延後15分鐘" }).click();
  assert.equal(await editModal.getByLabel("開始時間", { exact: true }).inputValue(), "12:35");
  await editModal.getByLabel("開始時間", { exact: true }).fill("12:30");
  await editModal.getByLabel("結束時間", { exact: true }).fill("13:15");
  await editModal.getByLabel("地址").fill("香川県高松市香南町岡1312-7");
  await editModal.getByLabel("備註", { exact: true }).fill("修改後的集合提醒");
  await editModal.getByLabel(/鎖定行程/).check();
  await editModal.getByRole("button", { name: "儲存修改" }).click();
  await assertVisibleText(arrival, "12:30－13:15");
  await assertVisibleText(arrival, "已鎖定");

  await page.getByRole("button", { name: "＋ 新增一天" }).click();
  assert.equal(await page.getByLabel("快速選擇第幾天").locator("option").count(), 8);
  assert.equal(await page.getByLabel("快速選擇第幾天").inputValue(), "7");
  const blankAxis = page.locator(".day-time-axis");
  await blankAxis.scrollIntoViewIfNeeded();
  const blankAxisBox = await blankAxis.boundingBox();
  await page.mouse.move(blankAxisBox.x + 120, blankAxisBox.y + blankAxisBox.height / 2);
  await assertVisibleText(page.locator(".timeline-add-hint"), "＋");
  await page.mouse.click(blankAxisBox.x + 120, blankAxisBox.y + blankAxisBox.height / 2);
  assert.match(await firstDay.getByLabel("行程時間").inputValue(), /^\d{2}:(00|15|30|45)$/);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "新增行程");
  assert.ok((await firstDay.getByLabel("行程時間").boundingBox()).width >= 135);
  assert.ok((await firstDay.getByLabel("行程結束時間").boundingBox()).width >= 135);
  await firstDay.getByLabel("行程時間").fill("16:07");
  await firstDay.getByLabel("行程結束時間").fill("17:32");
  await firstDay.getByLabel("新增行程").fill("測試景點");
  await firstDay.getByLabel("行程備註").fill("快速新增的備註內容");
  await firstDay.getByLabel("行程連結").fill("https://example.com/test-place");
  await firstDay.getByRole("button", { name: "加入" }).click();
  const added = firstDay.locator(".timeline-item").filter({ hasText: "測試景點" });
  await assertVisibleText(added, "16:07－17:32");
  await assertVisibleText(added, "快速新增的備註內容");
  assert.equal(await added.getByRole("link").getAttribute("href"), "https://example.com/test-place");
  page.once("dialog", (dialog) => dialog.dismiss());
  await added.getByRole("button", { name: /更多行程操作/ }).click();
  await page.locator("#deleteEventAction").click();
  assert.equal(await added.count(), 1);

  await page.locator('[data-tab="places"]').click();
  await page.getByLabel("地點名稱").fill("根津美術館");
  await page.locator("#placeForm").getByLabel("區域").fill("表參道");
  await page.locator("#placeForm").getByLabel("地址（選填）").fill("東京都港区南青山6-5-1");
  await page.locator("#placeForm").getByLabel("連結（選填）").fill("https://example.com/nezu");
  await page.getByRole("button", { name: "＋ 收藏這個地點" }).click();
  const place = page.locator(".place-row").filter({ hasText: "根津美術館" });
  await assertVisibleText(place, "東京都港区南青山6-5-1");
  await place.getByRole("button", { name: "✦ AI 幫我安排" }).click();
  await assertEventually(() => assertVisibleText(place, "第 2 天・14:30"));
  await place.getByRole("button", { name: "加入行程" }).click();
  assert.equal(await page.getByLabel("快速選擇第幾天").inputValue(), "1");
  const aiAdded = page.locator(".timeline-item").filter({ hasText: "根津美術館" });
  await assertVisibleText(aiAdded, "14:30－15:30");

  await page.locator('[data-tab="schedule"]').click();
  await page.getByLabel("快速選擇第幾天").selectOption("0");
  const aiRemovalName = (await storedTrip(page)).days[0].items.filter((item) => !item.locked)[1].name;
  await page.getByLabel("想和 AI 討論什麼？").fill("幫我調整第一天重疊的時間");
  await page.getByRole("button", { name: "送出問題" }).click();
  assert.equal(await page.getByLabel("想和 AI 討論什麼？").inputValue(), "");
  await assertVisibleText(page.getByRole("button", { name: "AI 思考中…" }), "AI 思考中…");
  await assertEventually(() => assertVisibleText(page, "第一天有時間重疊風險"));
  await assertVisibleText(page, "AI 已準備 2 項行程修改");
  await page.getByRole("button", { name: "套用這項修改" }).first().click();
  await assertVisibleText(page, "AI 已準備 1 項行程修改");
  await assertVisibleText(page, "套用後：從行程移除，並保留在想去的地方");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "從行程移除" }).click();
  assert.ok(await page.locator('[data-tab="places"]').evaluate((element) => element.classList.contains("active")));
  await assertEventually(() => assertVisibleText(page.locator("#placesList"), aiRemovalName));
  await page.locator('[data-tab="schedule"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "清除對話" }).click();
  await assertVisibleText(page.locator("#aiChatLog"), "可以請 AI 檢查動線");
  assert.equal((await storedTrip(page)).aiChat.length, 0);
  assert.ok(await page.getByRole("button", { name: "清除對話" }).isDisabled());

  await page.getByRole("button", { name: "✦ AI 匯入行程" }).click();
  await page.getByLabel("Google Sheet 連結、行程文字或表格").fill("9/3 10:00 栗林公園\n9/4 自由活動");
  await page.getByRole("button", { name: "✦ 產生預覽" }).click();
  await assertEventually(() => assertVisibleText(page, "匯入預覽：測試匯入"));
  await page.getByRole("button", { name: "確認加入目前行程" }).click();
  assert.equal(await page.getByLabel("快速選擇第幾天").locator("option").count(), 10);
  const storedAfterImport = await storedTrip(page);
  const imported = storedAfterImport.days.find((day) => day.date === "2026-09-03");
  assert.equal(imported.items.find((item) => item.name === "栗林公園").startTime, "10:00");
  assert.equal(imported.items.find((item) => item.name === "栗林公園").endTime, "11:30");
  assert.equal(imported.items.find((item) => item.name === "上午自由活動").timeLabel, "上午");

  await page.locator('[data-tab="map"]').click();
  await assertEventually(() => assertVisibleText(page, "尚未設定 Google Maps Browser Key"));
  assert.equal(await page.getByLabel("地圖日期篩選").locator("option").count(), 11);
  assert.equal(await page.getByLabel("地圖日期篩選").inputValue(), "0");
  await page.getByLabel("地圖日期篩選").selectOption("1");
  await assertVisibleText(page.locator("#mapLocationList"), "根津美術館");
  await assertVisibleText(page.locator("#mapLocationList"), "自動辨識");
  const mapPlace = page.locator(".map-location").filter({ hasText: "根津美術館" });
  await assertVisibleText(mapPlace.locator(".map-location-time"), "14:30－15:30");
  assert.equal(await mapPlace.getByText(/D\d+-\d+/).count(), 0);
  assert.ok((await page.getByRole("link", { name: /Google Maps 開啟當日路線/ }).getAttribute("href")).includes("google.com/maps/dir"));
  await page.getByLabel("沒貼連結時，自動辨識 Google Maps").uncheck();
  assert.equal(await mapPlace.getByLabel("根津美術館的 Google Maps 連結").inputValue(), "");
  assert.equal(await mapPlace.locator(".automatic-map-link").count(), 0);
  await page.getByLabel("沒貼連結時，自動辨識 Google Maps").check();
  const mapToggle = mapPlace.getByLabel("加入地圖");
  await mapToggle.uncheck();
  assert.equal((await storedTrip(page)).days[1].items.find((item) => item.name === "根津美術館").includeInMap, false);
  await mapPlace.getByLabel("根津美術館的 Google Maps 連結").fill("https://maps.app.goo.gl/abc123");
  await mapPlace.getByRole("button", { name: "儲存連結" }).click();
  const mapPlaceAfterSave = page.locator(".map-location").filter({ hasText: "根津美術館" });
  assert.equal(await mapPlaceAfterSave.getByLabel("加入地圖").isChecked(), true);
  assert.equal(await mapPlaceAfterSave.locator(".map-saved-link").getAttribute("href"), "https://maps.app.goo.gl/abc123");
  assert.equal(await mapPlaceAfterSave.locator(".map-saved-link").textContent(), "https://maps.app.goo.gl/abc123");
  await mapPlaceAfterSave.getByRole("button", { name: "編輯連結" }).click();
  assert.equal(await mapPlaceAfterSave.getByLabel("根津美術館的 Google Maps 連結").inputValue(), "https://maps.app.goo.gl/abc123");
  await mapPlaceAfterSave.getByRole("button", { name: "取消" }).click();
  assert.equal(await mapPlaceAfterSave.locator(".map-saved-link").isVisible(), true);
  const storedMapPlace = (await storedTrip(page)).days[1].items.find((item) => item.name === "根津美術館");
  assert.equal(storedMapPlace.mapUrl, "https://maps.app.goo.gl/abc123");
  assert.equal(storedMapPlace.includeInMap, true);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("trip-pals-map-filters-v1"))["kagawa-2026"]), "1");

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "開啟香川旅遊" }).click();
  await page.locator('[data-tab="map"]').click();
  assert.equal(await page.getByLabel("地圖日期篩選").inputValue(), "1");

  await page.locator('[data-tab="shopping"]').click();
  await page.getByTitle("管理名字").click();
  await page.getByPlaceholder("輸入名字").fill("阿芳");
  await page.getByRole("button", { name: "加入", exact: true }).click();
  await page.getByRole("button", { name: "關閉" }).click();
  await page.getByLabel("選擇名字").selectOption("阿芳");
  await page.locator("#shoppingForm").getByLabel("想買的東西").fill("白色戀人");
  await page.getByRole("button", { name: "加入清單" }).click();
  await page.getByRole("button", { name: "✓ 已購買" }).click();

  await page.locator('[data-tab="memos"]').click();
  await page.locator("#memoForm").getByLabel("標題", { exact: true }).fill("住宿資料");
  await page.locator("#memoForm").getByLabel("參考內容").fill("入住時間 16:00");
  await page.getByRole("button", { name: "加入備忘錄" }).click();

  const stored = await storedTrip(page);
  assert.equal(stored.days.length, 10);
  assert.equal(stored.aiChat.length, 0);
  assert.equal(stored.days[0].items[0].locked, true);
  assert.equal(stored.shopping[0].status, "purchased");
  assert.equal(stored.memos[0].title, "住宿資料");

  await page.getByRole("button", { name: "回到旅程首頁" }).click();
  await page.getByLabel("旅程名稱").fill("東京旅行");
  await page.locator("#newTripDestination").fill("日本・東京");
  await page.getByRole("button", { name: "建立旅程" }).click();
  assert.ok(await page.locator('[data-tab="overview"]').evaluate((node) => node.classList.contains("active")));
  await page.locator('[data-tab="schedule"]').click();
  const tokyoDay = page.locator("#daysGrid .day-card");
  await tokyoDay.getByLabel("行程時間").fill("10:00");
  await tokyoDay.getByLabel("新增行程").fill("東京車站");
  await tokyoDay.getByRole("button", { name: "加入", exact: true }).click();
  await page.getByRole("button", { name: /分享行程/ }).click();
  const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(sharedUrl, /#s=[A-Za-z0-9_-]{12}$/);
  const sharedPage = await context.newPage();
  await sharedPage.goto(sharedUrl, { waitUntil: "networkidle" });
  await sharedPage.locator('[data-tab="schedule"]').click();
  await sharedPage.getByLabel("想和 AI 討論什麼？").fill("請用 Google Maps 找東京車站到飯店沿路的景點");
  await sharedPage.getByRole("button", { name: "送出問題" }).click();
  await assertEventually(() => assertVisibleText(sharedPage, "AI 已準備 1 項行程修改"));
  await assertVisibleText(sharedPage, "Google Maps");
  await assertVisibleText(sharedPage, "皇居外苑");
  await sharedPage.getByRole("button", { name: "直接加入第 1 天" }).click();
  await assertEventually(() => assertVisibleText(sharedPage.locator("#daysGrid"), "皇居外苑"));
  await assertEventually(() => assertVisibleText(page.locator("#aiChatLog"), "Google Maps 找到一個順路景點"));
  // Wait for the applied operation to reach this tab before making the next edit.
  await assertEventually(() => assertVisibleText(page.locator("#daysGrid"), "皇居外苑"), 8000);
  await page.getByLabel("行程名稱").fill("東京同行測試");
  await assertEventually(async () => assert.equal(await sharedPage.getByLabel("行程名稱").inputValue(), "東京同行測試"), 8000);
  await assertEventually(() => assertVisibleText(page.locator("#daysGrid"), "皇居外苑"), 8000);
  await sharedPage.close();

  console.log("Smoke test passed: overview, timeline, AI chat, import, map fallback, lists, and realtime sharing.");
} finally {
  await browser.close();
}

async function storedTrip(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("trip-pals-trips-v3")).trips.find((trip) => trip.id === "kagawa-2026"));
}

async function assertVisibleText(pageOrLocator, text) {
  const locator = pageOrLocator.getByText(text, { exact: false });
  assert.ok(await locator.first().isVisible(), `Expected visible text: ${text}`);
}

async function assertEventually(assertion, timeoutMs = 5000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try { await assertion(); return; } catch (error) { lastError = error; await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  throw lastError;
}
