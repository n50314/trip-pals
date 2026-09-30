const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_GEMINI_FALLBACK_MODELS = "gemini-3.1-flash-lite";

export function geminiModelChain(env) {
  const configuredModels = [
    env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    ...(env.GEMINI_FALLBACK_MODELS || DEFAULT_GEMINI_FALLBACK_MODELS).split(","),
  ];

  return [
    ...new Set(configuredModels.map((model) => model.trim()).filter(Boolean)),
  ];
}

function shouldTryNextGeminiModel(status) {
  return status === 404 || status === 429 || status >= 500;
}

export async function requestGeminiWithFallback(env, body, fetchImpl = fetch) {
  const attemptedModels = [];
  let lastFailure;

  for (const model of geminiModelChain(env)) {
    attemptedModels.push(model);
    let response;
    let result;
    try {
      response = await fetchImpl(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          headers: {
            "x-goog-api-key": env.GEMINI_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...body, model }),
        },
      );
      result = await response.json().catch(() => ({}));
    } catch (error) {
      console.error("Gemini request failed", model, error?.message || "network error");
      lastFailure = { ok: false, status: 503, result: {}, model, attemptedModels };
      continue;
    }

    if (response.ok) {
      return { ok: true, result, model, attemptedModels };
    }

    lastFailure = { ok: false, status: response.status, result, model, attemptedModels };
    console.error(
      "Gemini request failed",
      model,
      response.status,
      result?.error?.message || result?.error?.status || "unknown",
    );

    if (!shouldTryNextGeminiModel(response.status)) break;
  }

  return lastFailure;
}
