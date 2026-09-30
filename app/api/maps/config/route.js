export function GET() {
  return Response.json(
    {
      enabled: Boolean(process.env.GOOGLE_MAPS_BROWSER_KEY),
      browserKey: process.env.GOOGLE_MAPS_BROWSER_KEY || "",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
