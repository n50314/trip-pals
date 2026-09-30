import { runStructuredAi } from "../_shared.js";
import { CHAT_INSTRUCTIONS, normalizeChatResult } from "../../../../ai-chat.js";

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
    places: (body.trip.places || []).slice(0, 50).map((place) => ({
      id: String(place.id || "").slice(0, 100),
      name: String(place.name || "").slice(0, 120),
      area: String(place.area || "").slice(0, 120),
      note: String(place.note || "").slice(0, 300),
      address: String(place.address || "").slice(0, 240),
    })),
  };
  const schema = {
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
            itemId: { type: "string" }, title: { type: "string" }, reason: { type: "string" },
            targetDay: { type: "integer", minimum: 1, maximum: trip.days.length },
            startTime: { type: "string", pattern: "^(?:|(?:[01]\\d|2[0-3]):(?:00|15|30|45))$" },
            endTime: { type: "string", pattern: "^(?:|(?:[01]\\d|2[0-3]):(?:00|15|30|45))$" },
            note: { type: "string" }, address: { type: "string" }, area: { type: "string" },
            sourceName: { type: "string" }, mapUrl: { type: "string" },
          },
          required: ["type", "itemId", "title", "reason", "targetDay", "startTime", "endTime", "note", "address", "area", "sourceName", "mapUrl"],
          additionalProperties: false,
        },
      },
    },
    required: ["reply", "summary", "operations"],
    additionalProperties: false,
  };
  const response = await runStructuredAi({
    name: "trip_chat",
    schema,
    instructions: CHAT_INSTRUCTIONS,
    input: {
      trip,
      history: (Array.isArray(body.history) ? body.history : []).slice(-20),
      message: String(body.message || "請檢查整趟行程").slice(0, 1600),
    },
  });
  if (!response.ok) return response;
  return Response.json(normalizeChatResult(trip, await response.json()));
}
