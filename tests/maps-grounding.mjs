import assert from "node:assert/strict";
import {
  extractGoogleMapsSources,
  interactionOutputText,
  shouldUseGoogleMapsGrounding,
} from "../maps-grounding.js";

assert.equal(shouldUseGoogleMapsGrounding("寒霞溪到飯店中間有什麼順路景點？"), true);
assert.equal(shouldUseGoogleMapsGrounding("請把第二天的午餐改到 12:30"), false);
assert.equal(shouldUseGoogleMapsGrounding("幫我健檢整趟行程的動線"), true);

const interaction = {
  steps: [{
    type: "model_output",
    content: [{
      type: "text",
      text: '{"reply":"ok"}',
      annotations: [
        { type: "place_citation", name: "小豆島大觀音", url: "https://maps.google.com/?cid=123" },
        { type: "place_citation", name: "惡意來源", url: "https://example.com/not-maps" },
        { type: "url_citation", name: "一般網頁", url: "https://maps.google.com/?cid=999" },
      ],
    }],
  }],
};

assert.equal(interactionOutputText(interaction), '{"reply":"ok"}');
assert.deepEqual(extractGoogleMapsSources(interaction), [
  { name: "小豆島大觀音", url: "https://maps.google.com/?cid=123" },
]);

console.log("Google Maps grounding helpers test passed.");
