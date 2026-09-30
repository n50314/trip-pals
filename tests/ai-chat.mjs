import assert from "node:assert/strict";
import { normalizeChatResult } from "../ai-chat.js";

const trip = {
  days: [
    { items: [{ id: "open-item", name: "寒霞溪", locked: false }] },
    { items: [{ id: "locked-item", name: "飯店入住", locked: true }] },
  ],
  places: [{ id: "saved-place", name: "橄欖公園" }],
};

const normalized = normalizeChatResult(trip, {
  reply: "會加入不存在的沿途景點並修改飯店。",
  summary: "與修改內容不一致的摘要",
  operations: [
    { type: "update", itemId: "open-item", title: "修改寒霞溪", reason: "避開尖峰", targetDay: 2, startTime: "13:00", endTime: "14:30", note: "", address: "" },
    { type: "move", itemId: "locked-item", title: "移動飯店", reason: "錯誤修改鎖定項目", targetDay: 1, startTime: "18:00", endTime: "19:00", note: "", address: "" },
    { type: "add_place", itemId: "missing-place", title: "不存在景點", reason: "無效 ID", targetDay: 1, startTime: "15:00", endTime: "16:00", note: "", address: "" },
    { type: "add_place", itemId: "saved-place", title: "加入橄欖公園", reason: "同區順遊", targetDay: 2, startTime: "15:00", endTime: "16:00", note: "", address: "" },
    { type: "update", itemId: "open-item", title: "重複修改", reason: "應被過濾", targetDay: 1, startTime: "16:00", endTime: "17:00", note: "", address: "" },
  ],
});

assert.equal(normalized.operations.length, 2);
assert.equal(normalized.operations[0].itemId, "open-item");
assert.equal(normalized.operations[0].targetDay, 1);
assert.equal(normalized.operations[1].itemId, "saved-place");
assert.match(normalized.reply, /寒霞溪/);
assert.match(normalized.reply, /橄欖公園/);
assert.doesNotMatch(normalized.reply, /不存在的沿途景點/);
assert.match(normalized.summary, /未列在下方的景點不會自動加入行程/);

const mapsNormalized = normalizeChatResult(trip, {
  reply: "請先放進想去的地方。",
  summary: "錯誤摘要",
  operations: [
    {
      type: "add_new_place",
      itemId: "invented-id",
      title: "小豆島大觀音",
      sourceName: "小豆島大觀音 - Google Maps",
      reason: "位於寒霞溪往北的順路方向",
      targetDay: 1,
      startTime: "15:00",
      endTime: "15:45",
      note: "停留 45 分鐘",
      address: "日本香川縣小豆郡土庄町",
      area: "土庄町",
      mapUrl: "https://example.com/should-not-be-trusted",
    },
  ],
}, {
  mapsRequested: true,
  googleMapsSources: [{ name: "小豆島大觀音 - Google Maps", url: "https://maps.google.com/?cid=123" }],
});

assert.equal(mapsNormalized.operations.length, 1);
assert.equal(mapsNormalized.operations[0].type, "add_new_place");
assert.equal(mapsNormalized.operations[0].title, "小豆島大觀音");
assert.equal(mapsNormalized.operations[0].sourceName, "小豆島大觀音 - Google Maps");
assert.equal(mapsNormalized.operations[0].mapUrl, "https://maps.google.com/?cid=123");
assert.equal(mapsNormalized.mapsGrounded, true);
assert.match(mapsNormalized.reply, /Google Maps 找到/);
assert.doesNotMatch(mapsNormalized.reply, /想去的地方/);

const ungroundedNewPlace = normalizeChatResult(trip, {
  reply: "虛構建議",
  summary: "虛構建議",
  operations: [{
    type: "add_new_place", itemId: "fake", title: "不存在景點", sourceName: "不存在景點",
    reason: "沒有來源", targetDay: 1, startTime: "15:00", endTime: "16:00", note: "", address: "", area: "", mapUrl: "",
  }],
}, { mapsRequested: true, googleMapsSources: [] });
assert.equal(ungroundedNewPlace.operations.length, 0);

console.log("AI chat operation consistency test passed.");
