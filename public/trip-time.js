const PERIOD_LABELS = ["凌晨", "早上", "上午", "中午", "下午", "傍晚", "晚上", "彈性"];

export function minutesFromTime(value) {
  const match = String(value || "").match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function timeFromMinutes(value) {
  const minutes = Math.max(0, Math.min(23 * 60 + 59, Math.round(Number(value) || 0)));
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function snapMinutes(value, step = 15) {
  return Math.round((Number(value) || 0) / step) * step;
}

export function parseLegacyTime(value) {
  const source = String(value || "").trim();
  const matches = [...source.matchAll(/(?:^|\D)([01]\d|2[0-3]):([0-5]\d)(?=\D|$)/g)];
  if (matches.length) {
    return {
      startTime: `${matches[0][1]}:${matches[0][2]}`,
      endTime: matches.length > 1 ? `${matches[1][1]}:${matches[1][2]}` : null,
      timeLabel: null,
    };
  }
  return {
    startTime: null,
    endTime: null,
    timeLabel: PERIOD_LABELS.find((label) => source.includes(label)) || "彈性",
  };
}

export function normalizeItineraryItem(item = {}) {
  const legacy = parseLegacyTime(item.time);
  const startTime = minutesFromTime(item.startTime) === null ? legacy.startTime : item.startTime;
  let endTime = minutesFromTime(item.endTime) === null ? legacy.endTime : item.endTime;
  if (startTime && endTime && minutesFromTime(endTime) <= minutesFromTime(startTime)) endTime = null;
  if (startTime && !endTime) endTime = timeFromMinutes(minutesFromTime(startTime) + 15);
  const timeLabel = startTime ? null : String(item.timeLabel || legacy.timeLabel || "彈性");
  return {
    ...item,
    startTime: startTime || null,
    endTime: endTime || null,
    timeLabel,
    locked: Boolean(item.locked),
    includeInMap: item.includeInMap !== false,
    address: String(item.address || ""),
    mapUrl: String(item.mapUrl || ""),
    placeId: String(item.placeId || ""),
    lat: item.lat !== null && item.lat !== "" && Number.isFinite(Number(item.lat)) ? Number(item.lat) : null,
    lng: item.lng !== null && item.lng !== "" && Number.isFinite(Number(item.lng)) ? Number(item.lng) : null,
    time: formatTimeRange({ startTime, endTime, timeLabel }),
  };
}

export function formatTimeRange(item) {
  if (!item?.startTime) return item?.timeLabel || "彈性";
  return item.endTime ? `${item.startTime}－${item.endTime}` : item.startTime;
}

export function itemDuration(item, fallback = 15) {
  const start = minutesFromTime(item?.startTime);
  const end = minutesFromTime(item?.endTime);
  return start !== null && end !== null && end > start ? end - start : fallback;
}

export function syncLegacyTime(item) {
  item.time = formatTimeRange(item);
  return item;
}

export function sortTimelineItems(items) {
  return items.sort((left, right) => {
    const leftTime = minutesFromTime(left.startTime);
    const rightTime = minutesFromTime(right.startTime);
    if (leftTime === null && rightTime === null) return 0;
    if (leftTime === null) return 1;
    if (rightTime === null) return -1;
    return leftTime - rightTime;
  });
}

export function hasTimeConflict(item, items) {
  const start = minutesFromTime(item?.startTime);
  if (start === null) return false;
  const end = start + itemDuration(item);
  return items.some((candidate) => {
    if (candidate === item || candidate.id === item.id) return false;
    const candidateStart = minutesFromTime(candidate.startTime);
    if (candidateStart === null) return false;
    const candidateEnd = candidateStart + itemDuration(candidate);
    return start < candidateEnd && candidateStart < end;
  });
}
