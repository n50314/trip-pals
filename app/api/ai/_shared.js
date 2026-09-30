import OpenAI from "openai";

export async function runStructuredAi({ instructions, input, name, schema }) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "尚未設定 OPENAI_API_KEY，請先在伺服器環境變數加入你的 API key。" },
      { status: 503 },
    );
  }
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      store: false,
      instructions,
      input: JSON.stringify(input),
      text: { format: { type: "json_schema", name, strict: true, schema } },
    });
    return Response.json(JSON.parse(response.output_text));
  } catch (error) {
    console.error(`${name} failed:`, error?.message || error);
    const status = error?.status === 401 ? 401 : error?.status === 429 ? 429 : 502;
    const message =
      status === 401
        ? "API key 無效，請檢查伺服器上的 OPENAI_API_KEY。"
        : status === 429
          ? "OpenAI API 額度不足或已達使用限制。"
          : "AI 暫時無法分析，請稍後再試。";
    return Response.json({ error: message }, { status });
  }
}
