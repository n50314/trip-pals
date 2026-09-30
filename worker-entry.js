import openNextWorker from "./.open-next/worker.js";
import { xlsxToText } from "./sheet-xlsx.js";
import { geminiModelChain, requestGeminiWithFallback } from "./ai-provider.js";
import { CHAT_INSTRUCTIONS, normalizeChatResult } from "./ai-chat.js";
import {
  extractGoogleMapsSources,
  interactionOutputText,
  mapsContextPrompt,
  mapsGroundingInstructions,
  shouldUseGoogleMapsGrounding,
} from "./maps-grounding.js";

const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

function compactTrip(trip) {
  return {
    title: String(trip.title || "").slice(0, 120),
    destination: String(trip.destination || "").slice(0, 120),
    days: trip.days.slice(0, 14).map((day, index) => ({
      day: index + 1,
      date: String(day.date || "").slice(0, 20),
      title: String(day.title || "").slice(0, 80),
      items: (day.items || []).slice(0, 20).map((item) => ({
        id: String(item.id || "").slice(0, 100),
        time: String(item.time || "").slice(0, 20),
        startTime: String(item.startTime || "").slice(0, 5),
        endTime: String(item.endTime || "").slice(0, 5),
        timeLabel: String(item.timeLabel || "").slice(0, 20),
        locked: Boolean(item.locked),
        name: String(item.name || "").slice(0, 120),
        area: String(item.area || "").slice(0, 120),
        note: String(item.note || "").slice(0, 300),
        address: String(item.address || "").slice(0, 240),
      })),
    })),
    places: (trip.places || []).slice(0, 50).map((place) => ({
      id: String(place.id || "").slice(0, 100),
      name: String(place.name || "").slice(0, 120),
      area: String(place.area || "").slice(0, 120),
      note: String(place.note || "").slice(0, 300),
      address: String(place.address || "").slice(0, 240),
    })),
  };
}

const AI_INSTRUCTIONS =
  "你是精簡、務實的旅遊行程規劃助手。根據地理區域、既有景點、營業時段線索、交通時間與動線，把新地點排進最合理的一天與大約開始時間。只能選擇提供的 day 數字；time 必須是 24 小時制 HH:MM，並以 00 或 30 分為單位。避免與既有行程衝突，並預留合理移動時間。請用繁體中文，理由不超過 60 字。若資訊不足，仍選最可能合理的時間並在理由中明確說明是假設。";

function placementSchema(dayCount) {
  return {
    type: "object",
    properties: {
      day: { type: "integer", minimum: 1, maximum: dayCount },
      time: {
        type: "string",
        pattern: "^([01]\\d|2[0-3]):(?:00|30)$",
      },
      reason: { type: "string" },
    },
    required: ["day", "time", "reason"],
    additionalProperties: false,
  };
}

async function callGemini(env, safeTrip, safePlace) {
  const attempt = await requestGeminiWithFallback(env, {
    system_instruction: AI_INSTRUCTIONS,
    input: JSON.stringify({ trip: safeTrip, newPlace: safePlace }),
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: placementSchema(safeTrip.days.length),
    },
  });

  if (!attempt.ok) return null;

  const result = attempt.result;
  const outputText =
    result.output_text ||
    result.outputs?.find((item) => item.type === "text")?.text ||
    result.outputs?.flatMap((item) => item.content || []).find((item) => item.type === "text")
      ?.text ||
    result.steps
      ?.filter((item) => item.type === "model_output")
      .flatMap((item) => item.content || [])
      .find((item) => item.type === "text")?.text;
  if (!outputText) return json({ error: "Gemini 沒有傳回可讀取的安排。" }, 502);
  return json(JSON.parse(outputText));
}

async function callOpenAI(env, safeTrip, safePlace) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-5.6",
      store: false,
      instructions: AI_INSTRUCTIONS,
      input: JSON.stringify({ trip: safeTrip, newPlace: safePlace }),
      text: {
        format: {
          type: "json_schema",
          name: "trip_placement",
          strict: true,
          schema: placementSchema(safeTrip.days.length),
        },
      },
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    console.error("OpenAI request failed", response.status, result?.error?.type || "unknown");
    const usageLimited = response.status === 429;
    return json(
      {
        error: usageLimited
          ? "OpenAI API 額度不足或已達使用限制，請由網站管理者檢查 OpenAI Platform 的 Billing 與 Usage。"
          : response.status === 401
            ? "API key 無效，請聯絡網站管理者。"
            : "AI 暫時無法分析，請稍後再試。",
      },
      usageLimited ? 429 : response.status === 401 ? 401 : 502,
    );
  }

  const outputText =
    result.output_text ||
    result.output
      ?.flatMap((item) => item.content || [])
      .find((item) => item.type === "output_text")?.text;
  if (!outputText) return json({ error: "AI 沒有傳回可讀取的安排。" }, 502);
  return json(JSON.parse(outputText));
}

async function handleAiPlace(request, env) {
  if (!env.GEMINI_API_KEY && !env.OPENAI_API_KEY) {
    return json({ error: "尚未設定 AI API key，請聯絡網站管理者。" }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "無法讀取送出的資料。" }, 400);
  }

  const trip = body?.trip;
  const place = body?.place;
  if (!trip || !place?.name || !Array.isArray(trip.days) || trip.days.length === 0) {
    return json({ error: "行程或地點資料不完整。" }, 400);
  }

  const safeTrip = compactTrip(trip);
  const safePlace = {
    name: String(place.name).slice(0, 120),
    area: String(place.area || "").slice(0, 120),
    note: String(place.note || "").slice(0, 300),
  };

  try {
    if (env.GEMINI_API_KEY) {
      const geminiResponse = await callGemini(env, safeTrip, safePlace);
      if (geminiResponse) return geminiResponse;
    }
    if (env.OPENAI_API_KEY) return callOpenAI(env, safeTrip, safePlace);
    return json({ error: "Gemini 模型額度已滿或暫時無法使用，請稍後再試。" }, 429);
  } catch (error) {
    console.error("AI route failed", error?.message || "unknown");
    return json({ error: "AI 暫時無法分析，請稍後再試。" }, 502);
  }
}

function reviewSchema(dayCount) {
  return {
    type: "object",
    properties: {
      summary: { type: "string" },
      answer: { type: "string" },
      suggestions: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["move", "move_to_places", "add_place", "reconsider"],
            },
            itemId: { type: "string" },
            title: { type: "string" },
            reason: { type: "string" },
            targetDay: { type: "integer", minimum: 1, maximum: dayCount },
            targetTime: {
              type: "string",
              enum: ["早上", "中午", "下午", "晚上", "彈性"],
            },
          },
          required: ["type", "itemId", "title", "reason", "targetDay", "targetTime"],
          additionalProperties: false,
        },
      },
    },
    required: ["summary", "answer", "suggestions"],
    additionalProperties: false,
  };
}

function chatSchema(dayCount) {
  return {
    type: "object",
    properties: {
      reply: { type: "string" },
      summary: { type: "string" },
      operations: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["move", "update", "move_to_places", "add_place", "add_new_place", "reconsider"] },
            itemId: { type: "string" },
            title: { type: "string" },
            reason: { type: "string" },
            targetDay: { type: "integer", minimum: 1, maximum: dayCount },
            startTime: { type: "string", pattern: "^(?:|(?:[01]\\d|2[0-3]):(?:00|15|30|45))$" },
            endTime: { type: "string", pattern: "^(?:|(?:[01]\\d|2[0-3]):(?:00|15|30|45))$" },
            note: { type: "string" },
            address: { type: "string" },
            area: { type: "string" },
            sourceName: { type: "string" },
            mapUrl: { type: "string" },
          },
          required: ["type", "itemId", "title", "reason", "targetDay", "startTime", "endTime", "note", "address", "area", "sourceName", "mapUrl"],
          additionalProperties: false,
        },
      },
    },
    required: ["reply", "summary", "operations"],
    additionalProperties: false,
  };
}

const importSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    destination: { type: "string" },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          date: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                time: { type: "string" },
                name: { type: "string" },
                area: { type: "string" },
                note: { type: "string" },
                url: { type: "string" },
              },
              required: ["time", "name", "area", "note", "url"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "date", "items"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "destination", "days"],
  additionalProperties: false,
};

async function callStructuredAi(env, { instructions, input, schema, name }) {
  if (env.GEMINI_API_KEY) {
    const attempt = await requestGeminiWithFallback(env, {
      system_instruction: instructions,
      input: JSON.stringify(input),
      response_format: { type: "text", mime_type: "application/json", schema },
    });
    if (attempt.ok) {
      const result = attempt.result;
      const outputText =
        result.output_text ||
        result.outputs?.find((item) => item.type === "text")?.text ||
        result.outputs?.flatMap((item) => item.content || []).find((item) => item.type === "text")
          ?.text ||
        result.steps
          ?.filter((item) => item.type === "model_output")
          .flatMap((item) => item.content || [])
          .find((item) => item.type === "text")?.text;
      if (!outputText) return json({ error: "Gemini 沒有傳回可讀取的結果。" }, 502);
      return json(JSON.parse(outputText));
    }
  }

  if (!env.OPENAI_API_KEY) {
    return json({ error: "Gemini 模型額度已滿或暫時無法使用，請稍後再試。" }, 429);
  }
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-5.6",
      store: false,
      instructions,
      input: JSON.stringify(input),
      text: { format: { type: "json_schema", name, strict: true, schema } },
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    return json(
      {
        error:
          response.status === 429
            ? "OpenAI API 額度不足或已達使用限制。"
            : response.status === 401
              ? "API key 無效，請聯絡網站管理者。"
              : "AI 暫時無法分析，請稍後再試。",
      },
      response.status === 429 ? 429 : response.status === 401 ? 401 : 502,
    );
  }
  const outputText =
    result.output_text ||
    result.output
      ?.flatMap((item) => item.content || [])
      .find((item) => item.type === "output_text")?.text;
  if (!outputText) return json({ error: "AI 沒有傳回可讀取的結果。" }, 502);
  return json(JSON.parse(outputText));
}

async function handleAiReview(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "無法讀取送出的資料。" }, 400);
  }
  if (!body?.trip || !Array.isArray(body.trip.days) || !body.trip.days.length) {
    return json({ error: "行程資料不完整。" }, 400);
  }
  const safeTrip = compactTrip(body.trip);
  const question = String(body.question || "").slice(0, 1000);
  try {
    return await callStructuredAi(env, {
      name: "trip_review",
      schema: reviewSchema(safeTrip.days.length),
      instructions:
        "你是務實的繁體中文旅遊行程顧問。檢查地理動線、日期、時間密度與固定行程，也考慮尚未安排的想去地點。只引用輸入中真實存在的 item id。move 是改天，move_to_places 是暫時移出行程，add_place 是把收藏加入行程，reconsider 只提供提醒。最多提出 8 項高價值建議；不要憑空加入景點。若使用者有問題，先直接回答。targetDay 必須是現有天數，沒有適用時間則用彈性。",
      input: { trip: safeTrip, question },
    });
  } catch (error) {
    console.error("AI review failed", error?.message || "unknown");
    return json({ error: "AI 健檢暫時失敗，請稍後再試。" }, 502);
  }
}

async function handleAiChat(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "無法讀取送出的資料。" }, 400);
  }
  if (!body?.trip || !Array.isArray(body.trip.days) || !body.trip.days.length) {
    return json({ error: "行程資料不完整。" }, 400);
  }
  const safeTrip = compactTrip(body.trip);
  const history = (Array.isArray(body.history) ? body.history : []).slice(-20).map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: String(message.content || "").slice(0, 1200),
  }));
  const message = String(body.message || "請檢查整趟行程").slice(0, 1600);
  try {
    const mapsRequested = Boolean(env.GEMINI_API_KEY && shouldUseGoogleMapsGrounding(message));
    if (mapsRequested) {
      const schema = chatSchema(safeTrip.days.length);
      const groundedAttempt = await requestGeminiWithFallback(env, {
        system_instruction: `${mapsGroundingInstructions()} ${CHAT_INSTRUCTIONS}`,
        input: JSON.stringify({ trip: safeTrip, history, message, googleMapsGrounding: true }),
        tools: [{ type: "google_maps" }],
        response_format: { type: "text", mime_type: "application/json", schema },
      });
      if (groundedAttempt?.ok) {
        const googleMapsSources = extractGoogleMapsSources(groundedAttempt.result);
        try {
          const result = JSON.parse(interactionOutputText(groundedAttempt.result));
          if (googleMapsSources.length || !(result.operations || []).some((operation) => operation.type === "add_new_place")) {
            return json(normalizeChatResult(safeTrip, result, { googleMapsSources, mapsRequested: true }));
          }
        } catch (error) {
          console.error("Maps structured response could not be parsed", error?.message || "unknown");
        }
      }

      const evidenceAttempt = await requestGeminiWithFallback(env, {
        system_instruction: mapsGroundingInstructions(),
        input: mapsContextPrompt(safeTrip, history, message),
        tools: [{ type: "google_maps" }],
      });
      if (evidenceAttempt?.ok) {
        const googleMapsSources = extractGoogleMapsSources(evidenceAttempt.result);
        const evidence = interactionOutputText(evidenceAttempt.result);
        if (googleMapsSources.length && evidence) {
          const response = await callStructuredAi(env, {
            name: "trip_chat_maps_grounded",
            schema,
            instructions: CHAT_INSTRUCTIONS,
            input: {
              trip: safeTrip,
              history,
              message,
              googleMapsGrounding: { evidence, sources: googleMapsSources },
            },
          });
          if (!response.ok) return response;
          return json(normalizeChatResult(safeTrip, await response.json(), { googleMapsSources, mapsRequested: true }));
        }
      }
    }

    const response = await callStructuredAi(env, {
      name: "trip_chat",
      schema: chatSchema(safeTrip.days.length),
      instructions: CHAT_INSTRUCTIONS,
      input: { trip: safeTrip, history, message },
    });
    if (!response.ok) return response;
    return json(normalizeChatResult(safeTrip, await response.json(), { mapsRequested: shouldUseGoogleMapsGrounding(message) }));
  } catch (error) {
    console.error("AI chat failed", error?.message || "unknown");
    return json({ error: "AI 討論暫時失敗，請稍後再試。" }, 502);
  }
}

async function resolveImportSource(source) {
  const value = String(source || "").trim();
  if (!/^https:\/\//i.test(value)) return value.slice(0, 30000);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Google Sheet 連結格式不正確。");
  }
  const match = url.pathname.match(/^\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)/);
  if (url.hostname !== "docs.google.com" || !match) {
    throw new Error("目前只支援 Google Sheet 連結，或直接貼上行程文字。");
  }
  const exportUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;
  const response = await fetch(exportUrl, {
    headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  });
  const file = await response.arrayBuffer();
  const preview = new TextDecoder().decode(file.slice(0, 1000));
  if (!response.ok || /<(?:!doctype|html|form)\b/i.test(preview)) {
    throw new Error("無法讀取這份 Google Sheet；請設為「知道連結的任何人可檢視」，或改貼儲存格內容。");
  }
  try {
    return xlsxToText(file);
  } catch {
    throw new Error("無法解析這份 Google Sheet；請確認下載權限已開啟，或改貼儲存格內容。");
  }
}

async function handleAiImport(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "無法讀取送出的資料。" }, 400);
  }
  const source = String(body?.rawText || "").trim();
  if (!source) return json({ error: "請先貼上要匯入的行程內容。" }, 400);
  let rawText;
  try {
    rawText = await resolveImportSource(source);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  try {
    return await callStructuredAi(env, {
      name: "trip_import",
      schema: importSchema,
      instructions:
        "你是繁體中文旅遊資料整理助手。把貼上的文字、試算表儲存格或聊天訊息整理成依日期分組的每日行程。忠實保留時間、地點、區域、備註與原始網址，不要憑空補景點。無法判斷時間時填彈性，未知欄位填空字串，日期可判斷時用 YYYY-MM-DD。至少產生一天。",
      input: { destination: String(body.destination || "").slice(0, 120), rawText },
    });
  } catch (error) {
    console.error("AI import failed", error?.message || "unknown");
    return json({ error: "AI 暫時無法整理這份內容，請稍後再試。" }, 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        aiConfigured: Boolean(env.GEMINI_API_KEY || env.OPENAI_API_KEY),
        provider: env.GEMINI_API_KEY ? "gemini" : env.OPENAI_API_KEY ? "openai" : null,
        models: env.GEMINI_API_KEY ? geminiModelChain(env) : [env.OPENAI_MODEL || "gpt-5.6"],
        mapsConfigured: Boolean(env.GOOGLE_MAPS_BROWSER_KEY),
        googleMapsGroundingConfigured: Boolean(env.GEMINI_API_KEY),
      });
    }
    if (url.pathname === "/api/maps/config") {
      return json({ enabled: Boolean(env.GOOGLE_MAPS_BROWSER_KEY), browserKey: env.GOOGLE_MAPS_BROWSER_KEY || "" });
    }
    if (url.pathname === "/api/ai/place" && request.method === "POST") {
      return handleAiPlace(request, env);
    }
    if (url.pathname === "/api/ai/review" && request.method === "POST") {
      return handleAiReview(request, env);
    }
    if (url.pathname === "/api/ai/chat" && request.method === "POST") {
      return handleAiChat(request, env);
    }
    if (url.pathname === "/api/ai/import" && request.method === "POST") {
      return handleAiImport(request, env);
    }
    return openNextWorker.fetch(request, env, ctx);
  },
};
