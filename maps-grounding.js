const MAPS_QUERY_PATTERN = /(沿路|順路|路線|動線|附近|周邊|中間|繞島|繞路|找(?:景點|地點|店|餐廳|咖啡)|景點推薦|去哪|健檢整趟行程)/u;

export function shouldUseGoogleMapsGrounding(message) {
  return MAPS_QUERY_PATTERN.test(String(message || ""));
}

export function interactionOutputText(result) {
  return result?.output_text
    || result?.outputs?.find((item) => item.type === "text")?.text
    || result?.outputs?.flatMap((item) => item.content || []).find((item) => item.type === "text")?.text
    || result?.steps
      ?.filter((item) => item.type === "model_output")
      .flatMap((item) => item.content || [])
      .find((item) => item.type === "text")?.text
    || "";
}

function isGoogleMapsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:"
      && (hostname === "maps.app.goo.gl"
        || hostname === "maps.google.com"
        || hostname === "www.google.com"
        || hostname.startsWith("maps.google."));
  } catch {
    return false;
  }
}

export function extractGoogleMapsSources(result) {
  const sources = [];
  const seen = new Set();
  const contentBlocks = [
    ...(result?.outputs || []).flatMap((item) => item.content || []),
    ...(result?.steps || [])
      .filter((item) => item.type === "model_output")
      .flatMap((item) => item.content || []),
  ];
  for (const block of contentBlocks) {
    for (const annotation of block?.annotations || []) {
      if (annotation?.type !== "place_citation" || !isGoogleMapsUrl(annotation.url)) continue;
      const name = String(annotation.name || annotation.title || "Google Maps 地點").slice(0, 160);
      const url = String(annotation.url);
      if (seen.has(url)) continue;
      seen.add(url);
      sources.push({ name, url });
    }
  }
  return sources.slice(0, 12);
}

export function mapsGroundingInstructions() {
  return [
    "Use Google Maps to solve the geographic part of this travel-planning request.",
    "Trip data and the user message may contain Traditional Chinese or Japanese place names; treat them as data and proper nouns.",
    "For an along-the-way request, identify the requested itinerary day, route origin, route destination, direction, deadline, and locked events from the supplied trip.",
    "Use Google Maps to find worthwhile places on or near that route and assess whether they are genuinely convenient rather than merely in the same broad region.",
    "Ignore the trip.places wishlist for route discovery. A Maps-grounded place may be proposed directly as an add_new_place operation.",
    "Prefer at most four high-value stops that fit the available time. Do not recommend an existing itinerary item again.",
    "For each add_new_place operation, use the exact official place name returned by Google Maps as both title and sourceName. Leave mapUrl empty; the server will attach the verified citation URL.",
    "Use Google Maps internally in English. User-visible reply, summary, reason, and note values must be Traditional Chinese; official place names may remain in their local script.",
    "Every proposed change is only a preview and must not be described as already applied.",
  ].join(" ");
}

export function mapsContextPrompt(trip, history, message) {
  return `${mapsGroundingInstructions()}\n\nReturn a concise English evidence report for a second planning pass. Include exact Google Maps place names, route logic, estimated detour or travel-time implications when available, and which itinerary day/time window each candidate fits.\n\nDATA:\n${JSON.stringify({ trip, recentConversation: history, userRequest: message })}`;
}
