export const CHAT_INSTRUCTIONS =
  "你是旅伴共用的繁體中文行程協作助手。回答內容、summary 與 operations 必須完全一致：每一個聲稱會調整、加入、移除或移動的地點，都必須有一項對應 operation；沒有出現在 operations 的景點，不得聲稱會加入路線或已安排，只能明確標示為未套用的參考建議。先分析，再提出由使用者確認後才會套用的 operations；禁止在確認前聲稱已完成變更。每個既有 itemId 最多一項 operation。update 只能修改原日期上的時間、備註或地址；要換天必須用 move。使用者提出抵達飯店等時間限制時，不能把該時間誤設為景點的開始時間。既有行程只能使用 days 中的 itemId；add_place 只能使用 places 中的 id。當輸入包含 googleMapsGrounding 時，沿路找點、附近推薦與動線規劃必須忽略 places 收藏清單，應依 Google Maps 的路線與地點證據直接產生 add_new_place；title 與 sourceName 必須使用 Google Maps 來源的正式地點名稱，不得用其他既有項目代替。add_new_place 不得自行產生座標，mapUrl 留空並由伺服器附上 Google Maps 驗證連結。locked 項目絕對不可修改。move_to_places 表示從行程移除並保留在想去的地方。檢查地理動線、15分鐘時間刻度、交通緩衝與衝突；時間必須為 HH:MM 且分鐘為 00/15/30/45，無需變更的字串填空字串。最多 10 項；只有單純詢問意見、資料不足或確實無需修改時，operations 才能是空陣列。";

const ACTIONABLE_TYPES = new Set(["move", "update", "move_to_places", "add_place", "add_new_place", "reconsider"]);
const VALID_TIME = /^(?:|(?:[01]\d|2[0-3]):(?:00|15|30|45))$/;

function operationTime(operation) {
  if (!operation.startTime) return "";
  return operation.endTime ? `${operation.startTime}－${operation.endTime}` : operation.startTime;
}

function operationDescription(operation, entity) {
  const name = entity.name || operation.title || "未命名行程";
  const time = operationTime(operation);
  if (operation.type === "move_to_places") return `從行程移除「${name}」，並保留在想去的地方`;
  if (operation.type === "add_place") return `將「${name}」加入第 ${operation.targetDay} 天${time ? ` ${time}` : ""}`;
  if (operation.type === "add_new_place") return `將 Google Maps 找到的「${name}」加入第 ${operation.targetDay} 天${time ? ` ${time}` : ""}`;
  if (operation.type === "move") return `將「${name}」移到第 ${operation.targetDay} 天${time ? ` ${time}` : ""}`;
  if (operation.type === "update") return `調整第 ${operation.targetDay} 天「${name}」${time ? `為 ${time}` : "的資料"}`;
  return `重新確認第 ${operation.targetDay} 天「${name}」`;
}

function normalizedName(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[\s・·()（）\-—_]/g, "");
}

function cleanMapsPlaceName(value) {
  return String(value || "").replace(/\s*[-–—]\s*Google Maps\s*$/i, "").trim() || String(value || "");
}

function matchMapsSource(operation, sources, usedUrls) {
  const candidates = [operation.sourceName, operation.title].map(normalizedName).filter(Boolean);
  const exact = sources.find((source) => !usedUrls.has(source.url) && candidates.includes(normalizedName(source.name)));
  if (exact) return exact;
  const partial = sources.find((source) => {
    if (usedUrls.has(source.url)) return false;
    const sourceName = normalizedName(source.name);
    return candidates.some((candidate) => sourceName.includes(candidate) || candidate.includes(sourceName));
  });
  if (partial) return partial;
  const unused = sources.filter((source) => !usedUrls.has(source.url));
  return unused.length === 1 ? unused[0] : null;
}

export function normalizeChatResult(trip, result, { googleMapsSources = [], mapsRequested = false } = {}) {
  const itemById = new Map();
  (trip.days || []).forEach((day, dayIndex) => {
    (day.items || []).forEach((item) => itemById.set(item.id, { ...item, day: dayIndex + 1 }));
  });
  const placeById = new Map((trip.places || []).map((place) => [place.id, place]));
  const operations = [];
  const seenEntities = new Set();
  const usedMapsUrls = new Set();
  const existingNames = new Set(
    [...itemById.values()].map((entity) => normalizedName(entity.name)).filter(Boolean),
  );

  for (const rawOperation of Array.isArray(result?.operations) ? result.operations : []) {
    const type = String(rawOperation?.type || "");
    let itemId = String(rawOperation?.itemId || "");
    if (!ACTIONABLE_TYPES.has(type)) continue;
    let mapsSource = null;
    if (type === "add_new_place") {
      mapsSource = matchMapsSource(rawOperation, googleMapsSources, usedMapsUrls);
      if (!mapsSource || existingNames.has(normalizedName(mapsSource.name))) continue;
      itemId = `google-maps-${operations.length + 1}`;
    }
    if (!itemId || seenEntities.has(itemId)) continue;
    const item = itemById.get(itemId);
    const place = placeById.get(itemId);
    if (type === "add_place" ? !place : type === "add_new_place" ? false : !item) continue;
    if (item?.locked) continue;
    const entity = type === "add_place" ? place : type === "add_new_place" ? { name: cleanMapsPlaceName(mapsSource.name) } : item;
    let targetDay = Number(rawOperation.targetDay);
    if (["update", "move_to_places", "reconsider"].includes(type)) targetDay = item.day;
    if (!Number.isInteger(targetDay) || targetDay < 1 || targetDay > trip.days.length) continue;
    let startTime = VALID_TIME.test(String(rawOperation.startTime || "")) ? String(rawOperation.startTime || "") : "";
    let endTime = VALID_TIME.test(String(rawOperation.endTime || "")) ? String(rawOperation.endTime || "") : "";
    if (startTime && endTime && endTime <= startTime) endTime = "";
    if (type === "move_to_places" || type === "reconsider") {
      startTime = "";
      endTime = "";
    }
    const operation = {
      type,
      itemId,
      title: String(type === "add_new_place" ? cleanMapsPlaceName(mapsSource.name) : rawOperation.title || entity.name || "行程修改").slice(0, 160),
      reason: String(rawOperation.reason || "").slice(0, 500),
      targetDay,
      startTime,
      endTime,
      note: String(rawOperation.note || "").slice(0, 1000),
      address: String(rawOperation.address || "").slice(0, 500),
      area: String(rawOperation.area || "").slice(0, 240),
      sourceName: type === "add_new_place" ? mapsSource.name : "",
      mapUrl: type === "add_new_place" ? mapsSource.url : "",
    };
    operations.push(operation);
    seenEntities.add(itemId);
    if (mapsSource) usedMapsUrls.add(mapsSource.url);
  }

  if (!operations.length) {
    return {
      reply: String(result?.reply || "目前沒有可安全套用的行程修改。"),
      summary: String(result?.summary || "這次沒有產生行程修改。"),
      operations: [],
      mapsGrounded: googleMapsSources.length > 0,
      mapsRequested,
      googleMapsSources,
    };
  }

  const descriptions = operations.map((operation) =>
    operationDescription(operation, operation.type === "add_place" ? placeById.get(operation.itemId) : operation.type === "add_new_place" ? { name: operation.title } : itemById.get(operation.itemId)),
  );
  return {
    reply: `我已準備 ${operations.length} 項與下方預覽一致的修改：${descriptions.join("；")}。請逐項確認後套用。`,
    summary: `實際可套用 ${operations.length} 項修改：${descriptions.join("；")}。未列在下方的景點不會自動加入行程。`,
    operations,
    mapsGrounded: googleMapsSources.length > 0,
    mapsRequested,
    googleMapsSources: googleMapsSources.filter((source) => usedMapsUrls.has(source.url)),
  };
}
