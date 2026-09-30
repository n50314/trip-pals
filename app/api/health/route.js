export function GET() {
  return Response.json({
    ok: true,
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
  });
}
