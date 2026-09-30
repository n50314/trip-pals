import assert from "node:assert/strict";
import { geminiModelChain, requestGeminiWithFallback } from "../ai-provider.js";

const env = {
  GEMINI_API_KEY: "test-key",
  GEMINI_MODEL: "gemini-3.5-flash-lite",
  GEMINI_FALLBACK_MODELS: "gemini-3.1-flash-lite, gemini-3.5-flash-lite",
};

assert.deepEqual(geminiModelChain(env), [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
]);

const requestedModels = [];
const attempt = await requestGeminiWithFallback(
  env,
  { input: "test" },
  async (_url, options) => {
    const model = JSON.parse(options.body).model;
    requestedModels.push(model);
    if (model === "gemini-3.5-flash-lite") {
      return Response.json({ error: { status: "RESOURCE_EXHAUSTED" } }, { status: 429 });
    }
    return Response.json({ output_text: '{"ok":true}' });
  },
);

assert.equal(attempt.ok, true);
assert.equal(attempt.model, "gemini-3.1-flash-lite");
assert.deepEqual(requestedModels, [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
]);

console.log("AI fallback test passed.");
