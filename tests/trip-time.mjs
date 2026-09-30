import assert from "node:assert/strict";
import {
  formatTimeRange,
  hasTimeConflict,
  normalizeItineraryItem,
  snapMinutes,
  sortTimelineItems,
} from "../public/trip-time.js";

assert.deepEqual(normalizeItineraryItem({ time: "14:00－14:30" }), {
  time: "14:00－14:30",
  startTime: "14:00",
  endTime: "14:30",
  timeLabel: null,
  locked: false,
  includeInMap: true,
  address: "",
  mapUrl: "",
  placeId: "",
  lat: null,
  lng: null,
});
assert.equal(normalizeItineraryItem({ time: "上午" }).timeLabel, "上午");
assert.equal(normalizeItineraryItem({ time: "14:00" }).endTime, "14:15");
assert.equal(normalizeItineraryItem({ startTime: "12:07", endTime: "12:32" }).endTime, "12:32");
assert.equal(normalizeItineraryItem({ startTime: "12:07" }).endTime, "12:22");
const shortA = normalizeItineraryItem({ id: "a", time: "14:00" });
const shortB = normalizeItineraryItem({ id: "b", time: "14:30" });
assert.equal(hasTimeConflict(shortA, [shortA, shortB]), false);
assert.equal(formatTimeRange({ startTime: "09:15", endTime: "10:45" }), "09:15－10:45");
assert.equal(snapMinutes(608), 615);
const items = [
  normalizeItineraryItem({ id: "flex", time: "彈性" }),
  normalizeItineraryItem({ id: "late", time: "18:00" }),
  normalizeItineraryItem({ id: "early", time: "08:00" }),
];
sortTimelineItems(items);
assert.deepEqual(items.map((item) => item.id), ["early", "late", "flex"]);
console.log("Trip time migration and sorting test passed.");
