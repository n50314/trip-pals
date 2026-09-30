import OpenAI from "openai";

export async function POST(request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "尚未設定 OPENAI_API_KEY，請先在伺服器環境變數加入你的 API key。" },
      { status: 503 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "無法讀取送出的資料。" }, { status: 400 });
  }

  const trip = body?.trip;
  const place = body?.place;
  if (!trip || !place?.name || !Array.isArray(trip.days) || trip.days.length === 0) {
    return Response.json({ error: "行程或地點資料不完整。" }, { status: 400 });
  }

  const compactTrip = {
    title: String(trip.title || "").slice(0, 120),
    destination: String(trip.destination || "").slice(0, 120),
    days: trip.days.slice(0, 14).map((day, index) => ({
      day: index + 1,
      date: String(day.date || "").slice(0, 20),
      title: String(day.title || "").slice(0, 80),
      items: (day.items || []).slice(0, 20).map((item) => ({
        time: String(item.time || "").slice(0, 20),
        name: String(item.name || "").slice(0, 120),
        area: String(item.area || "").slice(0, 120),
        note: String(item.note || "").slice(0, 300),
      })),
    })),
  };

  const compactPlace = {
    name: String(place.name).slice(0, 120),
    area: String(place.area || "").slice(0, 120),
    note: String(place.note || "").slice(0, 300),
  };

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const aiResponse = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      instructions:
        "你是精簡、務實的旅遊行程規劃助手。根據地理區域、既有景點、營業時段線索、交通時間與動線，把新地點排進最合理的一天與大約開始時間。只能選擇提供的 day 數字；time 必須是 24 小時制 HH:MM，並以 00 或 30 分為單位。避免與既有行程衝突，並預留合理移動時間。請用繁體中文，理由不超過 60 字。若資訊不足，仍選最可能合理的時間並在理由中明確說明是假設。",
      input: JSON.stringify({ trip: compactTrip, newPlace: compactPlace }),
      text: {
        format: {
          type: "json_schema",
          name: "trip_placement",
          strict: true,
          schema: {
            type: "object",
            properties: {
              day: {
                type: "integer",
                minimum: 1,
                maximum: compactTrip.days.length,
              },
              time: {
                type: "string",
                pattern: "^([01]\\d|2[0-3]):(?:00|30)$",
              },
              reason: { type: "string" },
            },
            required: ["day", "time", "reason"],
            additionalProperties: false,
          },
        },
      },
    });

    return Response.json(JSON.parse(aiResponse.output_text));
  } catch (error) {
    console.error("OpenAI request failed:", error?.message || error);
    const message =
      error?.status === 401
        ? "API key 無效，請檢查伺服器上的 OPENAI_API_KEY。"
        : "AI 暫時無法分析，請稍後再試。";
    return Response.json({ error: message }, { status: error?.status === 401 ? 401 : 502 });
  }
}
