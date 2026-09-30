import { runStructuredAi } from "../_shared.js";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "無法讀取送出的資料。" }, { status: 400 });
  }
  if (!body?.trip || !Array.isArray(body.trip.days) || !body.trip.days.length) {
    return Response.json({ error: "行程資料不完整。" }, { status: 400 });
  }
  const trip = {
    title: String(body.trip.title || "").slice(0, 120),
    destination: String(body.trip.destination || "").slice(0, 120),
    days: body.trip.days.slice(0, 14).map((day, dayIndex) => ({
      day: dayIndex + 1,
      title: String(day.title || "").slice(0, 80),
      date: String(day.date || "").slice(0, 20),
      items: (day.items || []).slice(0, 20).map((item) => ({
        id: String(item.id || "").slice(0, 100),
        time: String(item.time || "").slice(0, 20),
        name: String(item.name || "").slice(0, 120),
        area: String(item.area || "").slice(0, 120),
        note: String(item.note || "").slice(0, 300),
      })),
    })),
    places: (body.trip.places || []).slice(0, 50).map((place) => ({
      id: String(place.id || "").slice(0, 100),
      name: String(place.name || "").slice(0, 120),
      area: String(place.area || "").slice(0, 120),
      note: String(place.note || "").slice(0, 300),
    })),
  };
  const schema = {
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
            type: { type: "string", enum: ["move", "move_to_places", "add_place", "reconsider"] },
            itemId: { type: "string" },
            title: { type: "string" },
            reason: { type: "string" },
            targetDay: { type: "integer", minimum: 1, maximum: trip.days.length },
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
  return runStructuredAi({
    name: "trip_review",
    schema,
    instructions:
      "你是務實的繁體中文旅遊行程顧問。檢查地理動線、日期、時間密度與固定行程，也考慮尚未安排的想去地點。只引用輸入中存在的 item id。move 是改天，move_to_places 是暫時移出行程，add_place 是把收藏加入行程，reconsider 只提供提醒。最多 8 項建議，不要憑空加入景點。targetDay 必須是現有天數。",
    input: { trip, question: String(body.question || "").slice(0, 1000) },
  });
}
