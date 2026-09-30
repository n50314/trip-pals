import { runStructuredAi } from "../_shared.js";
import { xlsxToText } from "../../../../sheet-xlsx.js";

const schema = {
  type: "object",
  properties: {
    title: { type: "string" },
    destination: { type: "string" },
    days: {
      type: "array",
      minItems: 1,
      maxItems: 31,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          date: { type: "string" },
          items: {
            type: "array",
            maxItems: 30,
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

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "無法讀取送出的資料。" }, { status: 400 });
  }
  const source = String(body?.rawText || "").trim();
  if (!source) {
    return Response.json({ error: "請先貼上要匯入的行程內容。" }, { status: 400 });
  }
  let rawText;
  try {
    rawText = await resolveImportSource(source);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return runStructuredAi({
    name: "trip_import",
    schema,
    instructions:
      "你是繁體中文旅遊資料整理助手。把貼上的文字、試算表儲存格或聊天訊息整理成依日期分組的每日行程。忠實保留時間、地點、區域、備註與原始網址，不要憑空補景點。無法判斷時間時填彈性，未知欄位填空字串，日期可判斷時用 YYYY-MM-DD。",
    input: {
      destination: String(body.destination || "").slice(0, 120),
      rawText,
    },
  });
}

async function resolveImportSource(source) {
  if (!/^https:\/\//i.test(source)) return source.slice(0, 30000);
  let url;
  try {
    url = new URL(source);
  } catch {
    throw new Error("Google Sheet 連結格式不正確。");
  }
  const match = url.pathname.match(/^\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)/);
  if (url.hostname !== "docs.google.com" || !match) {
    throw new Error("目前只支援 Google Sheet 連結，或直接貼上行程文字。");
  }
  const response = await fetch(
    `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`,
    {
      headers: {
        Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    },
  );
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
