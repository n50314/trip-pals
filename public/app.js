import {
  formatTimeRange,
  hasTimeConflict,
  itemDuration,
  minutesFromTime,
  normalizeItineraryItem,
  snapMinutes,
  sortTimelineItems,
  syncLegacyTime,
  timeFromMinutes,
} from "./trip-time.js";

const STORAGE_KEY = "trip-pals-trips-v3";
const LEGACY_STORAGE_KEY = "trip-pals-data-v2";
const MAP_FILTER_STORAGE_KEY = "trip-pals-map-filters-v1";
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDviC1gImehUPj1XrSG9-UPLrxM6Lf-SXA",
  authDomain: "trip-pals-tw-093817.firebaseapp.com",
  projectId: "trip-pals-tw-093817",
  storageBucket: "trip-pals-tw-093817.firebasestorage.app",
  messagingSenderId: "1032075575897",
  appId: "1:1032075575897:web:c0403402a116bff41a2748",
};
const FIREBASE_VERSION = "12.16.0";
const TIMELINE_SLOT_MINUTES = 15;
const TIMELINE_CONTINUATION_SLOT_HEIGHT = 36;
const TIMELINE_START_SLOT_HEIGHT = 108;
const TIMELINE_COMPRESSED_SLOT_HEIGHT = 4;

const defaultState = {
  title: "香川旅遊",
  destination: "日本・香川",
  days: [
    {
      title: "抵達高松・丸龜",
      date: "2026-08-27",
      items: [
        { time: "12:20", name: "搭乘星宇航空 JX300 抵達高松機場（TAK）", area: "高松機場", note: "預留入境、領行李與前往租車櫃檯時間" },
        { time: "13:30", name: "Budget 高松機場店取車出發", area: "Budget 高松機場店", note: "固定取車時間" },
        { time: "14:00－14:40", name: "綾川町呆呆獸公園（ひだまり公園あやがわ）", area: "呆呆獸公園", note: "機場至公園約20～30分鐘；14:40前離開" },
        { time: "15:10－16:15", name: "參觀丸龜城", area: "丸龜城", note: "天守最後入場16:00；需預留上坡步行時間" },
        { time: "17:00－18:50", name: "父母濱欣賞夕陽", area: "父母濱", note: "丸龜城至父母濱約40分鐘；8/27日落約18:39" },
        { time: "19:30", name: "入住丸龜站前大通 APA 飯店", area: "APA 丸龜站前大通", note: "入住前確認訂房資訊與交通方式" },
        { time: "20:00", name: "丸龜晚餐：骨付鳥或讚岐烏龍麵", area: "丸龜晚餐", note: "看完父母濱夕陽後再用餐較合理" },
      ],
    },
    {
      title: "瀨戶大橋・高松",
      date: "2026-08-28",
      items: [
        { time: "09:30", name: "APA 退房，從丸龜出發", area: "", note: "直接前往瀨戶大橋紀念公園，不再繞五色台" },
        { time: "10:00－11:00", name: "瀨戶大橋紀念公園", area: "瀨戶大橋紀念公園", note: "動線較順，可控制停留時間" },
        { time: "11:15－12:00", name: "坂出／高松方向享用讚岐烏龍麵", area: "坂出讚岐烏龍麵", note: "先選主要店家與備用店，避免排隊過久" },
        { time: "12:50", name: "加油並前往 Budget 高松站前店", area: "Budget 高松站前店", note: "預留加油、塞車與還車檢查時間" },
        { time: "13:20", name: "抵達 Budget 高松站前店", area: "Budget 高松站前店", note: "預約還車時間13:30，建議提早10分鐘抵達" },
        { time: "14:30", name: "前往海が見える隠れ家寄放行李／入住", area: "海が見える隠れ家", note: "事先確認寄放行李與入住時間" },
        { time: "18:00", name: "丸龜町商店街、瓦町逛街與晚餐", area: "丸龜町商店街／瓦町", note: "晚間自由活動" },
      ],
    },
    {
      title: "櫻坂46演唱會",
      date: "2026-08-29",
      items: [
        { time: "10:00", name: "前往あなぶきアリーナ香川排物販", area: "あなぶきアリーナ香川", note: "全天以演唱會為主，記得補充水分" },
        { time: "16:00", name: "參與櫻坂46演唱會", area: "", note: "固定時間" },
        { time: "20:00", name: "演唱會結束後返回海が見える隠れ家", area: "海が見える隠れ家", note: "散場時人潮多，預留交通時間" },
      ],
    },
    {
      title: "高松自由活動・演唱會",
      date: "2026-08-30",
      items: [
        { time: "上午", name: "休息、咖啡或高松市區自由活動", area: "", note: "若不排物販，不需要中午就到會場" },
        { time: "14:00－14:30", name: "抵達あなぶきアリーナ香川", area: "あなぶきアリーナ香川", note: "最晚15:00前抵達" },
        { time: "16:00", name: "參與櫻坂46演唱會", area: "", note: "固定時間" },
        { time: "20:00", name: "演唱會結束後返回海が見える隠れ家", area: "海が見える隠れ家", note: "散場時人潮多，預留交通時間" },
      ],
    },
    {
      title: "前往小豆島",
      date: "2026-08-31",
      items: [
        { time: "07:20", name: "從海が見える隠れ家出發前往高松港", area: "高松港渡輪碼頭", note: "預留步行、行李與購票時間" },
        { time: "07:40", name: "抵達高松港，購票並候船", area: "高松港渡輪碼頭", note: "建議至少提前20分鐘到碼頭" },
        { time: "08:02－09:02", name: "搭乘渡輪：高松港 → 土庄港", area: "小豆島土庄港", note: "固定船班" },
        { time: "10:00", name: "ORIX Rent-a-car Shodoshima 取車", area: "ORIX 小豆島店", note: "固定取車時間；抵達後先辦理手續" },
        { time: "10:30－12:00", name: "土庄港周邊休息、早午餐", area: "土庄港", note: "取車後先補給，不急著趕景點" },
        { time: "12:30－13:50", name: "小豆島 Olive Park", area: "小豆島 Olive Park", note: "土庄港往島東南方向移動" },
        { time: "14:15－15:00", name: "Marukin 醬油紀念館", area: "Marukin 醬油紀念館", note: "8/31營業至16:30，時間充足" },
        { time: "15:15－16:30", name: "沿途休息／咖啡／提早前往飯店", area: "前往飯店", note: "中山千枚田改為有餘裕再去" },
        { time: "17:00", name: "アクアホテル小豆島リゾート Check-in", area: "Aqua Hotel 小豆島", note: "指定入住時間" },
        { time: "18:30", name: "飯店夕食", area: "", note: "固定時間" },
      ],
    },
    {
      title: "小豆島環島",
      date: "2026-09-01",
      items: [
        { time: "08:30", name: "飯店早餐", area: "", note: "早餐供應至09:30" },
        { time: "10:00", name: "飯店 Check-out", area: "", note: "固定退房時間" },
        { time: "10:15－11:45", name: "二十四の瞳映画村", area: "二十四の瞳映画村", note: "安排90分鐘，較適合拍照與逛展覽" },
        { time: "12:00－13:00", name: "午餐", area: "", note: "映画村往寒霞溪途中用餐；希望之道列備選" },
        { time: "13:30－15:10", name: "寒霞溪（纜車＋展望台）", area: "寒霞溪纜車", note: "纜車營業至17:00；15:10準時離開" },
        { time: "15:10－16:20", name: "返回土庄港方向、加油與快速採買", area: "返回土庄港", note: "優先完成加油；伴手禮視剩餘時間" },
        { time: "16:45－17:05", name: "Angel Road 天使之路", area: "Angel Road 天使之路", note: "9/1可通行時段16:45開始；17:05離開" },
        { time: "17:20", name: "ORIX Rent-a-car Shodoshima 還車", area: "ORIX 小豆島店", note: "預約最晚18:00；提早完成檢查" },
        { time: "18:40－19:40", name: "搭乘渡輪：土庄港 → 高松港", area: "小豆島土庄港", note: "固定船班" },
        { time: "20:10", name: "入住多美迎高松中央公園前飯店", area: "Dormy Inn 高松中央公園前", note: "抵達後辦理入住並整理隔日行程" },
      ],
    },
    {
      title: "高松・返回台灣",
      date: "2026-09-02",
      items: [
        { time: "08:00", name: "使用飯店溫泉、早餐與最後採買", area: "", note: "行李先整理完成" },
        { time: "09:45", name: "飯店 Check-out", area: "", note: "比原計畫提早，避免趕不上國際線" },
        { time: "10:00－10:20前後", name: "前往縣廳通・中央公園前搭機場巴士", area: "縣廳通・中央公園前站", note: "班次每月調整；出發前依9月正式時刻表確認" },
        { time: "11:00－11:15", name: "抵達高松機場", area: "高松機場", note: "最晚建議11:15前抵達，預留國際線報到時間" },
        { time: "13:20", name: "搭乘星宇航空 JX301 返回台灣", area: "", note: "報到櫃檯起飛前1小時關閉" },
      ],
    },
  ],
  places: [],
  names: [],
  shopping: [],
  memos: [],
  autoMapLinks: true,
};

let collection = loadCollection();
let state = null;
let currentTripId = null;
let sharedView = false;
let toastTimer;
let firestoreClient;
let stopRemoteSync;
let currentUser = null;
let aiReviewSnapshot = "";
let pendingImport = null;
let editingItemId = "";
let editingShoppingId = "";
let editingMemoId = "";
let selectedDayIndex = 0;
let selectedMapFilter = "0";
let mapFilterTripKey = "";
let highlightItemId = "";
let mapApiPromise;
let googleMap;
let googleMapMarkers = [];

const $ = (selector) => document.querySelector(selector);
const elements = {
  tripTitle: $("#tripTitle"),
  destination: $("#destination"),
  tripLength: $("#tripLength"),
  scheduleCount: $("#scheduleCount"),
  placesCount: $("#placesCount"),
  shoppingCount: $("#shoppingCount"),
  memosCount: $("#memosCount"),
  daysGrid: $("#daysGrid"),
  dayJumpSelect: $("#dayJumpSelect"),
  overviewGrid: $("#overviewGrid"),
  mapDayFilter: $("#mapDayFilter"),
  mapNotice: $("#mapNotice"),
  tripMap: $("#tripMap"),
  mapLocationList: $("#mapLocationList"),
  mapRouteLink: $("#mapRouteLink"),
  autoMapLinksToggle: $("#autoMapLinksToggle"),
  placesList: $("#placesList"),
  shoppingList: $("#shoppingList"),
  memoList: $("#memoList"),
  buyerName: $("#buyerName"),
  namesList: $("#namesList"),
  saveStatus: $("#saveStatus"),
  toast: $("#toast"),
  tripsHome: $("#tripsHome"),
  tripApp: $("#tripApp"),
  tripActions: $("#tripActions"),
  tripCards: $("#tripCards"),
  tripCount: $("#tripCount"),
  loginButton: $("#loginButton"),
  userBadge: $("#userBadge"),
  userPhoto: $("#userPhoto"),
  userName: $("#userName"),
  storageMode: $("#storageMode"),
};

function makeTripId() {
  return globalThis.crypto?.randomUUID?.() || `trip-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeEntityId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function fixedTimeValue(value) {
  const match = String(value || "").match(/(?:^|\D)([01]\d|2[0-3]):([0-5]\d)(?:\D|$)/);
  return match ? `${match[1]}:${match[2]}` : "";
}

function itineraryTimeValue(value) {
  const fixedTime = fixedTimeValue(value);
  if (fixedTime) {
    const [hour, minute] = fixedTime.split(":").map(Number);
    return hour * 60 + minute;
  }
  const periodValue = String(value || "").trim();
  const periods = [
    ["凌晨", 5 * 60],
    ["早上", 8 * 60],
    ["上午", 9 * 60],
    ["中午", 12 * 60],
    ["下午", 15 * 60],
    ["傍晚", 17 * 60],
    ["晚上", 19 * 60],
  ];
  return periods.find(([period]) => periodValue.includes(period))?.[1] ?? Number.MAX_SAFE_INTEGER;
}

function sortItineraryItems(items) {
  const sorted = sortTimelineItems(items.map((item) => normalizeItineraryItem(item)));
  items.splice(0, items.length, ...sorted);
  return items;
}

function loadCollection() {
  const localPreview = ["localhost", "127.0.0.1"].includes(location.hostname);
  const starterTrips = localPreview
    ? [{ ...normalizeState(structuredClone(defaultState)), id: "kagawa-2026" }]
    : [];
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.trips?.length) {
      return {
        trips: saved.trips.map((trip) => ({ ...normalizeState(trip), id: trip.id || makeTripId() })),
      };
    }

    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    if (legacy) {
      return { trips: [{ ...normalizeState(legacy), id: "kagawa-2026" }] };
    }
    return { trips: starterTrips };
  } catch {
    return { trips: starterTrips };
  }
}

function normalizeState(value) {
  const sourceDays =
    Array.isArray(value.days) && value.days.length ? value.days : structuredClone(defaultState.days);
  return {
    shareId: typeof value.shareId === "string" ? value.shareId : "",
    shortCode: typeof value.shortCode === "string" ? value.shortCode : "",
    title: String(value.title || defaultState.title),
    destination: String(value.destination || ""),
    autoMapLinks: value.autoMapLinks !== false,
    days: sourceDays.map((day, dayIndex) => {
      const items = Array.isArray(day.items)
        ? day.items.map((item, itemIndex) =>
            normalizeItineraryItem({
              ...item,
              id: String(item.id || `item-${dayIndex + 1}-${itemIndex + 1}`),
            }),
          )
        : [];
      return {
        ...day,
        id: String(day.id || `day-${dayIndex + 1}`),
        items: sortItineraryItems(items),
      };
    }),
    places: Array.isArray(value.places)
      ? value.places.map((place, index) => ({
          ...place,
          id: String(place.id || `place-${index + 1}`),
          address: String(place.address || ""),
          mapUrl: normalizeExternalUrl(place.mapUrl),
          includeInMap: place.includeInMap !== false,
          placeId: String(place.placeId || ""),
          lat: place.lat !== null && place.lat !== "" && Number.isFinite(Number(place.lat)) ? Number(place.lat) : null,
          lng: place.lng !== null && place.lng !== "" && Number.isFinite(Number(place.lng)) ? Number(place.lng) : null,
        }))
      : [],
    names: Array.isArray(value.names) ? value.names : [],
    shopping: Array.isArray(value.shopping)
      ? value.shopping.map((entry, index) => ({
          ...entry,
          id: String(entry.id || `shopping-${index + 1}`),
          status: ["pending", "confirmed", "purchased"].includes(entry.status)
            ? entry.status
            : "pending",
        }))
      : [],
    memos: Array.isArray(value.memos)
      ? value.memos.map((memo, index) => ({
          ...memo,
          id: String(memo.id || `memo-${index + 1}`),
          title: String(memo.title || ""),
          url: normalizeExternalUrl(memo.url),
          content: String(memo.content || ""),
        }))
      : [],
    aiChat: Array.isArray(value.aiChat)
      ? value.aiChat.slice(-20).map((message) => ({
          id: String(message.id || makeEntityId("chat")),
          role: message.role === "assistant" ? "assistant" : "user",
          content: String(message.content || message.text || "").slice(0, 4000),
          name: String(message.name || message.author || "旅伴").slice(0, 80),
          createdAt: String(message.createdAt || new Date().toISOString()),
        }))
      : [],
  };
}

function decodeSharedState() {
  if (!location.hash.startsWith("#trip=")) return null;
  try {
    const encoded = location.hash.slice(6).replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      Array.from(atob(encoded), (character) =>
        `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`,
      ).join(""),
    );
    return JSON.parse(json);
  } catch {
    showToast("分享連結無法讀取");
    return null;
  }
}

function editShareId() {
  if (!location.hash.startsWith("#edit=")) return "";
  const value = location.hash.slice(6);
  return /^[A-Za-z0-9_-]{40,80}$/.test(value) ? value : "";
}

function shortShareCode() {
  if (!location.hash.startsWith("#s=")) return "";
  const value = location.hash.slice(3);
  return /^[A-Za-z0-9_-]{10,20}$/.test(value) ? value : "";
}

function encodeState() {
  const bytes = encodeURIComponent(JSON.stringify(state)).replace(
    /%([0-9A-F]{2})/g,
    (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)),
  );
  return btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function save() {
  if (!state) return;
  state.days.forEach((day) => sortItineraryItems(day.items));
  if (!sharedView && !currentUser) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
  }
  elements.saveStatus.textContent = state.shareId || currentUser ? "正在同步…" : "儲存中…";
  window.clearTimeout(save.timer);
  save.timer = window.setTimeout(() => {
    if (state.shareId) {
      syncTripToCloud().catch((error) => {
        console.error(error);
        elements.saveStatus.textContent = "同步失敗";
        showToast("共用資料同步失敗，請稍後再試");
      });
    } else if (currentUser) {
      writeAccountTrip(state)
        .then(() => {
          elements.saveStatus.textContent = "已同步到 Google 帳號";
        })
        .catch((error) => {
          console.error(error);
          elements.saveStatus.textContent = "同步失敗";
          showToast("Google 帳號同步失敗，請稍後再試");
        });
    } else {
      elements.saveStatus.textContent = sharedView ? "分享快照・變更只存在此頁" : "已自動儲存";
    }
  }, state.shareId || currentUser ? 700 : 450);
  updateCounts();
}

function showToast(message) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeExternalUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value).trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function googleMapsUrl(query) {
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : "";
}

function normalizeGoogleMapsUrl(value) {
  const normalized = normalizeExternalUrl(value);
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    const hostname = url.hostname.toLowerCase();
    const isGoogleMaps =
      hostname === "maps.app.goo.gl" ||
      hostname === "goo.gl" ||
      ((hostname.startsWith("maps.google.") || hostname.startsWith("www.google.") || hostname === "google.com") &&
        (url.pathname.includes("/maps") || url.searchParams.has("q") || url.searchParams.has("query")));
    return isGoogleMaps ? normalized : "";
  } catch {
    return "";
  }
}

function isUsefulMapQuery(value) {
  const query = String(value || "").trim();
  if (query.length < 2) return false;
  return !/(自由活動|自由時間|休息|午餐|晚餐|早餐|用餐|逛街|採買|購物|前往飯店|返回飯店|回飯店|check-?in|check-?out|搭乘航班|搭飛機|彈性安排|待定)/i.test(
    query,
  );
}

function automaticMapQuery(item) {
  if (isUsefulMapQuery(item.area)) return item.area.trim();
  if (isUsefulMapQuery(item.name)) return item.name.trim();
  return "";
}

function mapLinkFor(item) {
  const pastedMapUrl = normalizeGoogleMapsUrl(item.mapUrl);
  if (pastedMapUrl) return pastedMapUrl;
  const generalUrl = normalizeGoogleMapsUrl(item.url);
  if (generalUrl) return generalUrl;
  return state?.autoMapLinks === false ? "" : googleMapsUrl(automaticMapQuery(item));
}

function itineraryUrl(item) {
  const explicitUrl = normalizeExternalUrl(item.url);
  if (explicitUrl) return explicitUrl;
  if (item.includeInMap === false) return "";
  return mapLinkFor(item);
}

function isLocalPreview() {
  return ["localhost", "127.0.0.1"].includes(location.hostname);
}

function makeShareId() {
  const bytes = crypto.getRandomValues(new Uint8Array(36));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeShortCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getFirestoreClient() {
  if (isLocalPreview()) return null;
  if (firestoreClient) return firestoreClient;
  const [{ initializeApp }, firestore, authModule] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
  ]);
  const app = initializeApp(FIREBASE_CONFIG);
  firestoreClient = {
    db: firestore.getFirestore(app),
    auth: authModule.getAuth(app),
    ...firestore,
    ...authModule,
  };
  return firestoreClient;
}

function renderAuthState() {
  const loggedIn = Boolean(currentUser);
  elements.loginButton.classList.toggle("hidden", loggedIn);
  elements.userBadge.classList.toggle("hidden", !loggedIn);
  if (loggedIn) {
    elements.userName.textContent = currentUser.displayName || currentUser.email || "Google 帳號";
    elements.userPhoto.src = currentUser.photoURL || "";
    elements.userPhoto.classList.toggle("hidden", !currentUser.photoURL);
    elements.storageMode.textContent = "已登入・旅程同步到你的 Google 帳號";
  } else {
    elements.userName.textContent = "";
    elements.userPhoto.removeAttribute("src");
    elements.storageMode.textContent = "未登入・資料保存在這個瀏覽器";
  }
}

async function readAccountTrips(user) {
  const client = await getFirestoreClient();
  const snapshot = await client.getDocs(
    client.collection(client.db, "users", user.uid, "trips"),
  );
  return snapshot.docs.map((entry) => ({
    ...normalizeState(entry.data().trip),
    id: entry.id,
  }));
}

async function writeAccountTrip(trip) {
  if (!currentUser || !trip?.id) return;
  const client = await getFirestoreClient();
  const cleanTrip = structuredClone(trip);
  await client.setDoc(
    client.doc(client.db, "users", currentUser.uid, "trips", trip.id),
    { trip: cleanTrip, updatedAt: client.serverTimestamp() },
  );
}

async function deleteAccountTrip(id) {
  if (!currentUser) return;
  const client = await getFirestoreClient();
  await client.deleteDoc(client.doc(client.db, "users", currentUser.uid, "trips", id));
}

async function loadAccountCollection({ mergeLocal = false } = {}) {
  if (!currentUser) return;
  const cloudTrips = await readAccountTrips(currentUser);
  if (!mergeLocal) {
    collection = { trips: cloudTrips };
    return;
  }

  const merged = [...cloudTrips];
  for (const localTrip of collection.trips) {
    const exists = merged.some(
      (cloudTrip) =>
        cloudTrip.id === localTrip.id ||
        (localTrip.shareId && cloudTrip.shareId === localTrip.shareId),
    );
    if (!exists) {
      merged.push(localTrip);
      await writeAccountTrip(localTrip);
    }
  }
  collection = { trips: merged };
}

async function initializeAuth() {
  if (isLocalPreview()) {
    renderAuthState();
    return;
  }
  const client = await getFirestoreClient();
  await client.auth.authStateReady();
  currentUser = client.auth.currentUser;
  renderAuthState();
  if (currentUser) await loadAccountCollection();
}

async function signInWithGoogle() {
  const client = await getFirestoreClient();
  const provider = new client.GoogleAuthProvider();
  const result = await client.signInWithPopup(client.auth, provider);
  currentUser = result.user;
  renderAuthState();
  await loadAccountCollection({ mergeLocal: true });
  showHome();
  showToast("已登入，旅程已同步到 Google 帳號");
}

async function signOutGoogle() {
  const client = await getFirestoreClient();
  await client.signOut(client.auth);
  currentUser = null;
  collection = loadCollection();
  renderAuthState();
  showHome();
  showToast("已登出，現在使用這個瀏覽器的本機旅程");
}

async function writeSharedTrip(shareId, trip) {
  const cleanTrip = structuredClone(trip);
  cleanTrip.shareId = shareId;
  if (isLocalPreview()) {
    localStorage.setItem(`trip-pals-shared-${shareId}`, JSON.stringify(cleanTrip));
    window.dispatchEvent(new StorageEvent("storage", { key: `trip-pals-shared-${shareId}` }));
    return;
  }
  const client = await getFirestoreClient();
  await client.setDoc(client.doc(client.db, "trips", shareId), {
    trip: cleanTrip,
    updatedAt: client.serverTimestamp(),
  });
}

async function readSharedTrip(shareId) {
  if (isLocalPreview()) {
    const value = localStorage.getItem(`trip-pals-shared-${shareId}`);
    return value ? JSON.parse(value) : null;
  }
  const client = await getFirestoreClient();
  const snapshot = await client.getDoc(client.doc(client.db, "trips", shareId));
  return snapshot.exists() ? snapshot.data().trip : null;
}

async function readShortLink(code) {
  if (isLocalPreview()) {
    return localStorage.getItem(`trip-pals-short-${code}`) || "";
  }
  const client = await getFirestoreClient();
  const snapshot = await client.getDoc(client.doc(client.db, "shortLinks", code));
  return snapshot.exists() ? snapshot.data().shareId || "" : "";
}

async function writeShortLink(code, shareId) {
  if (isLocalPreview()) {
    localStorage.setItem(`trip-pals-short-${code}`, shareId);
    return;
  }
  const client = await getFirestoreClient();
  await client.setDoc(client.doc(client.db, "shortLinks", code), {
    shareId,
    createdAt: client.serverTimestamp(),
  });
}

async function createShortLink(shareId) {
  if (state.shortCode) {
    const existingShareId = await readShortLink(state.shortCode);
    if (existingShareId === shareId) return state.shortCode;
    if (!existingShareId) {
      await writeShortLink(state.shortCode, shareId);
      return state.shortCode;
    }
    state.shortCode = "";
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeShortCode();
    if (await readShortLink(code)) continue;
    await writeShortLink(code, shareId);
    state.shortCode = code;
    return code;
  }
  throw new Error("無法建立不重複的短連結");
}

async function syncTripToCloud() {
  if (!state?.shareId) return;
  await writeSharedTrip(state.shareId, state);
  if (currentUser) await writeAccountTrip(state);
  elements.saveStatus.textContent = currentUser ? "已同步到共用旅程與 Google 帳號" : "已同步";
}

function acceptRemoteTrip(nextTrip, shareId) {
  const next = normalizeState(nextTrip);
  if (aiReviewSnapshot && aiReviewSnapshot !== reviewFingerprint(next)) clearAiReview();
  next.shareId = shareId;
  if (currentTripId) {
    next.id = currentTripId;
    const index = collection.trips.findIndex((trip) => trip.id === currentTripId);
    if (index >= 0) {
      collection.trips[index] = next;
      if (currentUser) {
        writeAccountTrip(next).catch(console.error);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
      }
    }
  }
  state = next;
  if (editingItemId) openEditItineraryModal(editingItemId, false);
  renderAll();
  elements.saveStatus.textContent = "已同步最新修改";
}

async function watchSharedTrip(shareId) {
  stopRemoteSync?.();
  if (isLocalPreview()) {
    const listener = (event) => {
      if (event.key !== `trip-pals-shared-${shareId}`) return;
      const next = JSON.parse(localStorage.getItem(event.key));
      if (JSON.stringify(next) === JSON.stringify(state)) return;
      acceptRemoteTrip(next, shareId);
    };
    window.addEventListener("storage", listener);
    stopRemoteSync = () => window.removeEventListener("storage", listener);
    return;
  }
  const client = await getFirestoreClient();
  stopRemoteSync = client.onSnapshot(client.doc(client.db, "trips", shareId), (snapshot) => {
    if (!snapshot.exists() || snapshot.metadata.hasPendingWrites) return;
    const next = normalizeState(snapshot.data().trip);
    next.shareId = shareId;
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    acceptRemoteTrip(next, shareId);
  });
}

function tripDateRange(trip) {
  const dates = trip.days.map((day) => day.date).filter(Boolean).sort();
  if (!dates.length) return "日期未定";
  const format = (value) => {
    const [, month, day] = value.split("-");
    return `${Number(month)}/${Number(day)}`;
  };
  return dates.length === 1 ? format(dates[0]) : `${format(dates[0])}－${format(dates.at(-1))}`;
}

function renderTripCards() {
  elements.tripCards.innerHTML = "";
  elements.tripCount.textContent = `${collection.trips.length} 個旅程`;

  if (!collection.trips.length) {
    elements.tripCards.innerHTML =
      '<div class="empty-state">還沒有旅程。先在上方建立下一趟旅行吧。</div>';
    return;
  }

  collection.trips.forEach((trip) => {
    const card = document.createElement("article");
    card.className = "trip-card card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `開啟${trip.title}`);
    card.innerHTML = `
      <span class="trip-card-destination">${escapeHtml(trip.destination || "目的地未定")}</span>
      <h3>${escapeHtml(trip.title)}</h3>
      <div class="trip-card-meta">${escapeHtml(tripDateRange(trip))}<br>${trip.days.length} 天・${trip.places.length} 個收藏地點</div>
      <div class="trip-card-footer">
        <span class="trip-card-open">查看旅程 ↗</span>
        <button class="more-button delete-trip" type="button" aria-label="刪除${escapeHtml(trip.title)}">×</button>
      </div>
    `;
    const open = () => openTrip(trip.id);
    card.addEventListener("click", (event) => {
      if (!event.target.closest(".delete-trip")) open();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
    card.querySelector(".delete-trip").addEventListener("click", async () => {
      if (!window.confirm(`確定刪除「${trip.title}」？`)) return;
      try {
        if (currentUser) {
          await deleteAccountTrip(trip.id);
        } else {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              trips: collection.trips.filter((item) => item.id !== trip.id),
            }),
          );
        }
        collection.trips = collection.trips.filter((item) => item.id !== trip.id);
        renderTripCards();
        showToast("旅程已刪除");
      } catch (error) {
        console.error(error);
        showToast("刪除失敗，請稍後再試");
      }
    });
    elements.tripCards.append(card);
  });
}

function showHome() {
  stopRemoteSync?.();
  stopRemoteSync = null;
  $("#sharedNote")?.remove();
  state = null;
  currentTripId = null;
  sharedView = false;
  history.replaceState(null, "", location.pathname + location.search);
  elements.tripsHome.classList.remove("hidden");
  elements.tripApp.classList.add("hidden");
  elements.tripActions.classList.add("hidden");
  renderTripCards();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function openTrip(id) {
  const trip = collection.trips.find((item) => item.id === id);
  if (!trip) return;
  stopRemoteSync?.();
  stopRemoteSync = null;
  state = trip;
  currentTripId = id;
  sharedView = false;
  $("#sharedNote")?.remove();
  elements.saveStatus.textContent = currentUser ? "已同步到 Google 帳號" : "已自動儲存";
  elements.tripsHome.classList.add("hidden");
  elements.tripApp.classList.remove("hidden");
  elements.tripActions.classList.remove("hidden");
  renderAll();
  switchTab("overview");
  if (trip.shareId) {
    try {
      const remoteTrip = await readSharedTrip(trip.shareId);
      if (remoteTrip) {
        const next = normalizeState(remoteTrip);
        next.id = trip.id;
        next.shareId = trip.shareId;
        const index = collection.trips.findIndex((item) => item.id === trip.id);
        collection.trips[index] = next;
        state = next;
        if (currentUser) {
          await writeAccountTrip(next);
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
        }
        renderAll();
      }
      await watchSharedTrip(trip.shareId);
    } catch (error) {
      console.error(error);
      elements.saveStatus.textContent = "共用資料連線失敗";
    }
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openSharedTrip(sharedState) {
  stopRemoteSync?.();
  stopRemoteSync = null;
  $("#sharedNote")?.remove();
  state = normalizeState(sharedState);
  currentTripId = null;
  sharedView = true;
  elements.saveStatus.textContent = "分享快照";
  elements.tripsHome.classList.add("hidden");
  elements.tripApp.classList.remove("hidden");
  elements.tripActions.classList.remove("hidden");
  renderAll();
  switchTab("overview");
  const note = document.createElement("div");
  note.className = "shared-note";
  note.id = "sharedNote";
  note.textContent = "這是單一旅程的分享快照；其他旅程不會出現在這個連結中。";
  elements.tripApp.prepend(note);
}

async function openCollaborativeTrip(shareId) {
  elements.tripsHome.classList.add("hidden");
  elements.tripApp.classList.add("hidden");
  elements.tripActions.classList.add("hidden");
  try {
    const remoteTrip = await readSharedTrip(shareId);
    if (!remoteTrip) {
      showHome();
      return showToast("找不到這個共用旅程");
    }
    const remoteState = normalizeState(remoteTrip);
    remoteState.shareId = shareId;
    let localTrip = collection.trips.find((trip) => trip.shareId === shareId);
    if (!localTrip) {
      localTrip = collection.trips.find(
        (trip) =>
          !trip.shareId &&
          trip.title === remoteState.title &&
          trip.destination === remoteState.destination,
      );
    }
    if (localTrip) {
      remoteState.id = localTrip.id;
      const index = collection.trips.findIndex((trip) => trip.id === localTrip.id);
      collection.trips[index] = remoteState;
    } else {
      remoteState.id = makeTripId();
      collection.trips.push(remoteState);
    }
    state = remoteState;
    currentTripId = remoteState.id;
    sharedView = false;
    if (currentUser) {
      await writeAccountTrip(remoteState);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
    }
    elements.saveStatus.textContent = "已連上共用旅程";
    elements.tripApp.classList.remove("hidden");
    elements.tripActions.classList.remove("hidden");
    renderAll();
    const note = document.createElement("div");
    note.className = "shared-note";
    note.id = "sharedNote";
    note.textContent = "這是共用編輯旅程；知道這個連結的人可以查看並修改，變更會自動同步。";
    elements.tripApp.prepend(note);
    await watchSharedTrip(shareId);
  } catch (error) {
    console.error(error);
    showHome();
    showToast("共用旅程載入失敗，請稍後再試");
  }
}

function updateCounts() {
  elements.tripLength.textContent = `${state.days.length} 天`;
  elements.scheduleCount.textContent = state.days.length;
  elements.placesCount.textContent = state.places.length;
  elements.shoppingCount.textContent = state.shopping.length;
  elements.memosCount.textContent = state.memos.length;
}

function renderDayJumpOptions() {
  elements.dayJumpSelect.replaceChildren();
  state.days.forEach((day, dayIndex) => {
    const option = document.createElement("option");
    option.value = String(dayIndex);
    const details = [day.date, day.title].filter(Boolean).join("｜");
    option.textContent = `第 ${dayIndex + 1} 天${details ? `・${details}` : ""}`;
    elements.dayJumpSelect.append(option);
  });
  selectedDayIndex = Math.min(selectedDayIndex, state.days.length - 1);
  elements.dayJumpSelect.value = String(selectedDayIndex);
}

function itemTimelineContent(item) {
  const itemLink = itineraryUrl(item);
  const mapNote = !normalizeExternalUrl(item.url) && itemLink
    ? '<span class="auto-map-note">自動辨識・Google Maps</span>'
    : "";
  const title = itemLink
    ? `<a class="timeline-name timeline-link" href="${escapeHtml(itemLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.name)}<span class="external-arrow" aria-hidden="true">↗</span></a>`
    : `<span class="timeline-name">${escapeHtml(item.name)}</span>`;
  return `${title}<span class="timeline-area"><span class="timeline-meta-line"><em>地點</em><span>${escapeHtml(item.area || "尚未設定")}</span></span>${mapNote}</span>
    <details class="event-note" ${window.matchMedia("(min-width: 621px)").matches ? "open" : ""}><summary>備註</summary><p><span class="note-label">備註 </span>${escapeHtml(item.note || "尚無備註")}</p></details>`;
}

let actionItemId = "";
function openEventActions(itemId) {
  const found = findItineraryItem(itemId);
  if (!found) return;
  actionItemId = itemId;
  const item = state.days[found.dayIndex].items[found.itemIndex];
  $("#eventActionsName").textContent = item.name;
  document.querySelectorAll("[data-event-delta]").forEach((button) => { button.disabled = item.locked; });
  $("#eventActionsBackdrop").classList.remove("hidden");
}

function closeEventActions() {
  $("#eventActionsBackdrop").classList.add("hidden");
  actionItemId = "";
}

function deleteItineraryItem(dayIndex, item) {
  if (!window.confirm(`確定要刪除「${item.name}」嗎？\n刪除後會同步給所有旅伴。`)) return;
  state.days[dayIndex].items = state.days[dayIndex].items.filter((candidate) => candidate.id !== item.id);
  save();
  renderAll();
  showToast("行程已刪除");
}

function createTimelineScale(items) {
  const slotCount = (24 * 60) / TIMELINE_SLOT_MINUTES;
  const expanded = Array(slotCount).fill(false);
  const starts = Array(slotCount).fill(false);
  items.forEach((item) => {
    const start = minutesFromTime(item.startTime);
    if (start === null) return;
    starts[Math.min(slotCount - 1, Math.floor(start / TIMELINE_SLOT_MINUTES))] = true;
    const end = Math.min(24 * 60, start + itemDuration(item));
    for (let slot = 0; slot < slotCount; slot += 1) {
      const slotStart = slot * TIMELINE_SLOT_MINUTES;
      const slotEnd = slotStart + TIMELINE_SLOT_MINUTES;
      if (slotStart < end && start < slotEnd) expanded[slot] = true;
    }
  });
  const heights = expanded.map((isExpanded, index) => {
    if (!isExpanded) return TIMELINE_COMPRESSED_SLOT_HEIGHT;
    if (starts[index]) return TIMELINE_START_SLOT_HEIGHT;
    return TIMELINE_CONTINUATION_SLOT_HEIGHT;
  });
  // Include exact event boundaries so even a five-minute visit has room for its
  // controls, without stretching every other visit in the same 15-minute slot.
  const boundaries = [...new Set([
    ...Array.from({ length: slotCount + 1 }, (_, index) => index * TIMELINE_SLOT_MINUTES),
    ...items.flatMap((item) => {
      const start = minutesFromTime(item.startTime);
      return start === null ? [] : [start, Math.min(1440, start + itemDuration(item))];
    }),
  ])].sort((a, b) => a - b);
  const segments = boundaries.slice(0, -1).map((minute, index) =>
    heights[Math.floor(minute / TIMELINE_SLOT_MINUTES)] * (boundaries[index + 1] - minute) / TIMELINE_SLOT_MINUTES,
  );
  items.forEach((item) => {
    const start = minutesFromTime(item.startTime);
    if (start === null) return;
    const first = boundaries.indexOf(start);
    const last = boundaries.indexOf(Math.min(1440, start + itemDuration(item)));
    const currentHeight = segments.slice(first, last).reduce((sum, value) => sum + value, 0);
    const minimum = item.locked || hasTimeConflict(item, items) ? 164 : 136;
    if (currentHeight > 0 && currentHeight < minimum) {
      for (let index = first; index < last; index += 1) segments[index] *= minimum / currentHeight;
    }
  });
  const offsets = [0];
  segments.forEach((height) => offsets.push(offsets.at(-1) + height));
  return {
    height: offsets.at(-1),
    isExpanded(minute) {
      const slot = Math.max(0, Math.min(slotCount - 1, Math.floor(minute / TIMELINE_SLOT_MINUTES)));
      return expanded[slot];
    },
    y(minute) {
      const bounded = Math.max(0, Math.min(24 * 60, Number(minute) || 0));
      if (bounded === 24 * 60) return offsets.at(-1);
      const segment = boundaries.findIndex((minute, index) => bounded >= minute && bounded < boundaries[index + 1]);
      const fraction = (bounded - boundaries[segment]) / (boundaries[segment + 1] - boundaries[segment]);
      return offsets[segment] + segments[segment] * fraction;
    },
    minuteAt(y) {
      const bounded = Math.max(0, Math.min(offsets.at(-1), Number(y) || 0));
      let segment = offsets.findIndex((offset, index) => index < segments.length && bounded < offsets[index + 1]);
      if (segment < 0) segment = segments.length - 1;
      const fraction = segments[segment] ? (bounded - offsets[segment]) / segments[segment] : 0;
      return Math.max(0, Math.min(23 * 60 + 45, snapMinutes(boundaries[segment] + fraction * (boundaries[segment + 1] - boundaries[segment]))));
    },
  };
}

function startTimelinePointer(event, { item, block, axis, scale, mode, dayIndex }) {
  if (item.locked) return showToast("這個行程已鎖定，請先到編輯視窗解除鎖定");
  event.preventDefault();
  const pointerStartY = event.clientY;
  const sourceStart = minutesFromTime(item.startTime);
  const sourceDuration = itemDuration(item);
  const sourceY = sourceStart === null ? null : scale.y(sourceStart);
  block.classList.add("timeline-moving");
  document.body.classList.add("is-dragging-timeline");

  const move = (moveEvent) => {
    const deltaY = moveEvent.clientY - pointerStartY;
    if (mode === "resize") {
      const nextEnd = scale.minuteAt(scale.y(sourceStart + sourceDuration) + deltaY);
      const nextDuration = Math.max(15, snapMinutes(nextEnd - sourceStart));
      block.style.height = `${Math.max(40, scale.y(sourceStart + nextDuration) - sourceY)}px`;
      block.querySelector(".event-time-label").textContent = `${item.startTime}－${timeFromMinutes(sourceStart + nextDuration)}`;
    } else if (sourceStart !== null) {
      const nextStart = Math.max(0, Math.min(23 * 60 + 45 - sourceDuration, scale.minuteAt(sourceY + deltaY)));
      block.style.top = `${scale.y(nextStart)}px`;
      block.querySelector(".event-time-label").textContent = `${timeFromMinutes(nextStart)}－${timeFromMinutes(nextStart + sourceDuration)}`;
    } else {
      block.style.transform = `translateY(${moveEvent.clientY - pointerStartY}px)`;
    }
  };

  const end = (upEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    block.classList.remove("timeline-moving");
    document.body.classList.remove("is-dragging-timeline");
    block.style.transform = "";
    if (mode === "resize" && sourceStart !== null) {
      const nextEnd = scale.minuteAt(scale.y(sourceStart + sourceDuration) + (upEvent.clientY - pointerStartY));
      item.endTime = timeFromMinutes(sourceStart + Math.max(15, snapMinutes(nextEnd - sourceStart)));
    } else if (sourceStart !== null) {
      const nextStart = Math.max(0, Math.min(23 * 60 + 45 - sourceDuration, scale.minuteAt(sourceY + (upEvent.clientY - pointerStartY))));
      item.startTime = timeFromMinutes(nextStart);
      item.endTime = timeFromMinutes(nextStart + sourceDuration);
      item.timeLabel = null;
    } else {
      const bounds = axis.getBoundingClientRect();
      if (upEvent.clientY < bounds.top || upEvent.clientY > bounds.bottom) return renderDays();
      const nextStart = scale.minuteAt(upEvent.clientY - bounds.top);
      item.startTime = timeFromMinutes(nextStart);
      item.endTime = timeFromMinutes(nextStart + 15);
      item.timeLabel = null;
    }
    syncLegacyTime(item);
    sortItineraryItems(state.days[dayIndex].items);
    save();
    renderAll();
    showToast("時間已更新");
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end, { once: true });
}

function renderDays() {
  renderDayJumpOptions();
  elements.daysGrid.innerHTML = "";
  const dayIndex = selectedDayIndex;
  const day = state.days[dayIndex];
  if (!day) return;
  const fragment = $("#dayTemplate").content.cloneNode(true);
  const card = fragment.querySelector(".day-card");
  card.dataset.index = dayIndex;
  fragment.querySelector(".day-number").textContent = `DAY ${String(dayIndex + 1).padStart(2, "0")}`;
  const title = fragment.querySelector(".day-title");
  title.value = day.title || `第 ${dayIndex + 1} 天`;
  title.addEventListener("input", (changeEvent) => {
    day.title = changeEvent.target.value;
    save();
    renderOverview();
  });
  const date = fragment.querySelector(".day-date");
  date.value = day.date || "";
  date.addEventListener("change", (changeEvent) => {
    day.date = changeEvent.target.value;
    save();
    renderOverview();
    renderMapControls();
  });
  fragment.querySelector(".delete-day").addEventListener("click", () => {
    if (state.days.length === 1) return showToast("至少保留一天行程");
    if (!window.confirm(`確定要刪除第 ${dayIndex + 1} 天及其中所有行程嗎？`)) return;
    state.days.splice(dayIndex, 1);
    selectedDayIndex = Math.max(0, Math.min(selectedDayIndex, state.days.length - 1));
    save();
    renderAll();
  });

  const timeline = fragment.querySelector(".timeline");
  const scheduled = day.items.filter((item) => minutesFromTime(item.startTime) !== null);
  const unscheduled = day.items.filter((item) => minutesFromTime(item.startTime) === null);
  const scale = createTimelineScale(scheduled);
  timeline.innerHTML = `
    <section class="unscheduled-zone ${unscheduled.length ? "" : "is-empty"}">
      <div class="unscheduled-heading"><strong>待安排</strong><span>把彈性行程拖進下方時間軸，會先安排 15 分鐘</span></div>
      <div class="unscheduled-items"></div>
    </section>
    <div class="day-time-axis" style="--axis-height:${scale.height}px"></div>
  `;
  const axis = timeline.querySelector(".day-time-axis");
  const pending = timeline.querySelector(".unscheduled-items");
  for (let minute = 0; minute <= 24 * 60; minute += 15) {
    const line = document.createElement("div");
    const expanded = minute < 24 * 60 && scale.isExpanded(minute);
    line.className = `time-grid-line ${minute % 60 === 0 ? "is-hour" : ""} ${expanded ? "is-expanded" : "is-compressed"}`;
    line.style.top = `${scale.y(minute)}px`;
    const showLabel = minute % (6 * 60) === 0 || (expanded && minute % 60 === 0);
    if (showLabel) line.innerHTML = `<span>${minute === 24 * 60 ? "24:00" : timeFromMinutes(minute)}</span>`;
    axis.append(line);
  }

  unscheduled.forEach((item) => {
    const block = document.createElement("article");
    block.className = `pending-itinerary ${item.locked ? "is-locked" : ""}`;
    block.dataset.itemId = item.id;
    block.innerHTML = `<span class="timeline-drag-handle" title="拖入時間軸">⠿</span><span><strong>${escapeHtml(item.timeLabel || "彈性")}｜${escapeHtml(item.name)}</strong><small>${escapeHtml(item.area || "尚未設定區域")}</small></span><button class="more-button edit-item" type="button" aria-label="編輯行程：${escapeHtml(item.name)}">✎</button>`;
    block.querySelector(".timeline-drag-handle").addEventListener("pointerdown", (pointerEvent) =>
      startTimelinePointer(pointerEvent, { item, block, axis, scale, mode: "move", dayIndex }),
    );
    block.querySelector(".edit-item").addEventListener("click", () => openEditItineraryModal(item.id));
    pending.append(block);
  });

  [...scheduled].sort((a, b) => minutesFromTime(a.startTime) - minutesFromTime(b.startTime)).forEach((item) => {
    const start = minutesFromTime(item.startTime);
    const duration = itemDuration(item);
    const conflict = hasTimeConflict(item, scheduled);
    const block = document.createElement("article");
    block.className = `timeline-event timeline-item ${conflict ? "has-conflict" : ""} ${item.locked ? "is-locked" : ""} ${item.id === highlightItemId ? "is-highlighted" : ""}`;
    if (conflict) {
      const conflictIndex = scheduled.filter((candidate) => candidate !== item && hasTimeConflict(item, [candidate])).findIndex((candidate) => candidate.id < item.id);
      block.style.width = "calc(50% - 48px)";
      block.style.left = conflictIndex >= 0 ? "calc(50% + 44px)" : "76px";
    }
    block.dataset.itemId = item.id;
    block.style.top = `${scale.y(start)}px`;
    block.style.height = `${Math.max(40, scale.y(start + duration) - scale.y(start) - 8)}px`;
    block.innerHTML = `
      <span class="timeline-drag-handle" title="以15分鐘拖移">${item.locked ? "●" : "⠿"}</span>
      <div class="timeline-event-body"><span class="event-time-label">${escapeHtml(formatTimeRange(item))}${item.endTime ? "" : "・未設定結束"}</span>${itemTimelineContent(item)}</div>
      <div class="timeline-event-actions">
        <button class="more-button edit-item" type="button" aria-label="編輯行程：${escapeHtml(item.name)}">✎</button>
        <button class="more-button event-more" type="button" aria-haspopup="dialog" aria-label="更多行程操作：${escapeHtml(item.name)}">⋯</button>
      </div>
      ${conflict ? '<span class="conflict-badge">時間重疊</span>' : ""}
      ${item.locked ? '<span class="locked-badge">已鎖定</span>' : '<span class="timeline-resize-handle" title="拖曳調整結束時間"></span>'}
    `;
    block.querySelector(".timeline-drag-handle").addEventListener("pointerdown", (pointerEvent) =>
      startTimelinePointer(pointerEvent, { item, block, axis, scale, mode: "move", dayIndex }),
    );
    block.querySelector(".timeline-resize-handle")?.addEventListener("pointerdown", (pointerEvent) =>
      startTimelinePointer(pointerEvent, { item, block, axis, scale, mode: "resize", dayIndex }),
    );
    block.querySelector(".edit-item").addEventListener("click", () => openEditItineraryModal(item.id));
    block.querySelector(".event-more").addEventListener("click", () => openEventActions(item.id));
    axis.append(block);
  });

  const quickAddForm = fragment.querySelector(".quick-add");
  const timelineAddHint = document.createElement("div");
  timelineAddHint.className = "timeline-add-hint";
  timelineAddHint.setAttribute("aria-hidden", "true");
  axis.append(timelineAddHint);
  const timelineMinuteAtPointer = (pointerEvent) => {
    const bounds = axis.getBoundingClientRect();
    return Math.min(23 * 60 + 30, scale.minuteAt(Math.max(0, Math.min(bounds.height, pointerEvent.clientY - bounds.top))));
  };
  axis.addEventListener("pointermove", (pointerEvent) => {
    if (window.matchMedia("(max-width: 620px)").matches) return;
    if (pointerEvent.target.closest(".timeline-event") || document.body.classList.contains("is-dragging-timeline")) {
      timelineAddHint.classList.remove("is-visible");
      return;
    }
    const minute = timelineMinuteAtPointer(pointerEvent);
    timelineAddHint.textContent = `＋ ${timeFromMinutes(minute)}`;
    timelineAddHint.style.top = `${scale.y(minute)}px`;
    timelineAddHint.classList.add("is-visible");
  });
  axis.addEventListener("pointerleave", () => timelineAddHint.classList.remove("is-visible"));
  axis.addEventListener("click", (clickEvent) => {
    if (window.matchMedia("(max-width: 620px)").matches) return;
    if (clickEvent.target.closest(".timeline-event") || document.body.classList.contains("is-dragging-timeline")) return;
    const minute = timelineMinuteAtPointer(clickEvent);
    const startInput = quickAddForm.querySelector('[aria-label="行程時間"]');
    const endInput = quickAddForm.querySelector('[aria-label="行程結束時間"]');
    const nameInput = quickAddForm.querySelector('[aria-label="新增行程"]');
    startInput.value = timeFromMinutes(minute);
    endInput.value = timeFromMinutes(Math.min(24 * 60 - 1, minute + 15));
    quickAddForm.scrollIntoView({ behavior: "smooth", block: "center" });
    nameInput.focus({ preventScroll: true });
    showToast(`已選擇 ${timeFromMinutes(minute)}，請輸入行程名稱`);
  });

  quickAddForm.addEventListener("submit", (submitEvent) => {
    submitEvent.preventDefault();
    const form = submitEvent.currentTarget;
    const startInput = form.querySelector('[aria-label="行程時間"]');
    const endInput = form.querySelector('[aria-label="行程結束時間"]');
    const nameInput = form.querySelector('[aria-label="新增行程"]');
    const noteInput = form.querySelector('[aria-label="行程備註"]');
    const urlInput = form.querySelector('[aria-label="行程連結"]');
    if (endInput.value && !startInput.value) return showToast("請先設定開始時間");
    if (startInput.value && endInput.value && minutesFromTime(endInput.value) <= minutesFromTime(startInput.value)) return showToast("結束時間必須晚於開始時間");
    const item = normalizeItineraryItem({
      id: makeEntityId("item"),
      startTime: startInput.value || null,
      endTime: endInput.value || null,
      timeLabel: startInput.value ? null : "彈性",
      name: nameInput.value.trim(),
      area: "",
      note: noteInput.value.trim(),
      url: normalizeExternalUrl(urlInput.value),
    });
    day.items.push(item);
    sortItineraryItems(day.items);
    form.reset();
    save();
    renderAll();
  });
  elements.daysGrid.append(fragment);
  if (highlightItemId) {
    requestAnimationFrame(() => elements.daysGrid.querySelector(".is-highlighted")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    window.setTimeout(() => { highlightItemId = ""; }, 1800);
  }
}

function renderOverview() {
  elements.overviewGrid.innerHTML = "";
  state.days.forEach((day, dayIndex) => {
    const card = document.createElement("article");
    card.className = "overview-day card";
    const items = sortTimelineItems([...day.items]);
    card.innerHTML = `
      <div class="overview-day-heading">
        <button class="overview-open-day" type="button"><span>DAY ${String(dayIndex + 1).padStart(2, "0")}</span><strong>${escapeHtml(day.title || `第 ${dayIndex + 1} 天`)}</strong><small>${escapeHtml(day.date || "日期未定")}</small></button>
        <button class="overview-map-day" type="button">查看地圖 ↗</button>
      </div>
      <div class="overview-items"></div>
    `;
    const list = card.querySelector(".overview-items");
    if (!items.length) list.innerHTML = '<div class="empty-state">這天還沒有行程</div>';
    items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "overview-item";
      button.innerHTML = `<span>${escapeHtml(formatTimeRange(item))}</span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.area || "")}</small>${item.locked ? '<i aria-label="已鎖定">●</i>' : ""}`;
      button.addEventListener("click", () => {
        selectedDayIndex = dayIndex;
        highlightItemId = item.id;
        switchTab("schedule");
        renderDays();
      });
      list.append(button);
    });
    card.querySelector(".overview-open-day").addEventListener("click", () => {
      selectedDayIndex = dayIndex;
      switchTab("schedule");
      renderDays();
    });
    card.querySelector(".overview-map-day").addEventListener("click", () => {
      selectedMapFilter = String(dayIndex);
      rememberMapFilter();
      switchTab("map");
    });
    elements.overviewGrid.append(card);
  });
}

function renderMapControls() {
  const preferenceKey = currentTripId || state.shareId || state.id || "current-trip";
  if (preferenceKey !== mapFilterTripKey) {
    mapFilterTripKey = preferenceKey;
    try {
      const preferences = JSON.parse(localStorage.getItem(MAP_FILTER_STORAGE_KEY) || "{}");
      selectedMapFilter = String(preferences[preferenceKey] ?? "0");
    } catch {
      selectedMapFilter = "0";
    }
  }
  elements.mapDayFilter.innerHTML = [
    ...state.days.map((day, index) => `<option value="${index}">第 ${index + 1} 天${day.date ? `・${escapeHtml(day.date)}` : ""}</option>`),
    '<option value="places">想去的地方</option>',
  ].join("");
  if (![...elements.mapDayFilter.options].some((option) => option.value === selectedMapFilter)) {
    selectedMapFilter = state.days.length ? "0" : "places";
    rememberMapFilter();
  }
  elements.mapDayFilter.value = selectedMapFilter;
  elements.autoMapLinksToggle.checked = state.autoMapLinks !== false;
}

function rememberMapFilter() {
  const preferenceKey = currentTripId || state?.shareId || state?.id || "current-trip";
  mapFilterTripKey = preferenceKey;
  try {
    const preferences = JSON.parse(localStorage.getItem(MAP_FILTER_STORAGE_KEY) || "{}");
    preferences[preferenceKey] = selectedMapFilter;
    localStorage.setItem(MAP_FILTER_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Browser privacy settings may disable local storage; the current tab still remembers the selection.
  }
}

function mapLocations({ includedOnly = false } = {}) {
  let locations;
  if (selectedMapFilter === "places") {
    locations = state.places.map((place, index) => ({ ...place, dayIndex: null, order: index + 1, type: "place" }));
    return includedOnly ? locations.filter((location) => location.includeInMap !== false) : locations;
  }
  const dayIndexes = [Number(selectedMapFilter)];
  locations = dayIndexes.flatMap((dayIndex) =>
    (state.days[dayIndex]?.items || []).map((item, index) => ({ ...item, dayIndex, order: index + 1, type: "item" })),
  );
  return includedOnly ? locations.filter((location) => location.includeInMap !== false) : locations;
}

function mapLocationTarget(location) {
  return location.type === "place"
    ? state.places.find((place) => place.id === location.id)
    : state.days[location.dayIndex]?.items.find((item) => item.id === location.id);
}

function googleDirectionsUrl(locations) {
  const queries = locations
    .map((location) => location.address || automaticMapQuery(location))
    .filter(Boolean)
    .slice(0, 10);
  if (queries.length < 2) return "";
  const params = new URLSearchParams({ api: "1", origin: queries[0], destination: queries.at(-1) });
  if (queries.length > 2) params.set("waypoints", queries.slice(1, -1).join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
}

function renderMapLocationList() {
  const locations = mapLocations();
  elements.mapLocationList.innerHTML = "";
  if (!locations.length) {
    elements.mapLocationList.innerHTML = '<div class="empty-state">目前沒有可顯示的地點</div>';
  }
  locations.forEach((location) => {
    const included = location.includeInMap !== false;
    const link = mapLinkFor(location);
    const pastedMapUrl = normalizeGoogleMapsUrl(location.mapUrl);
    const generalMapUrl = normalizeGoogleMapsUrl(location.url);
    const explicitMapUrl = pastedMapUrl || generalMapUrl;
    const automatic = !pastedMapUrl && !generalMapUrl && Boolean(link);
    const card = document.createElement("article");
    card.className = `map-location card ${location.lat === null ? "needs-location" : ""} ${included ? "" : "is-excluded"}`;
    card.innerHTML = `
      <span class="map-location-time">${location.dayIndex === null ? "想去" : escapeHtml(formatTimeRange(location))}</span>
      <div class="map-location-details">
        <strong>${escapeHtml(location.name)}</strong>
        <small>${escapeHtml(location.address || location.area || "尚未設定地址")}</small>
        <div class="map-location-status">
          ${automatic ? '<em class="auto-map-badge">自動辨識</em>' : ""}
          ${included ? "" : '<em class="map-excluded-badge">不加入地圖</em>'}
        </div>
      </div>
      <label class="map-item-toggle"><input type="checkbox" ${included ? "checked" : ""} /><span>加入地圖</span></label>
      <div class="map-link-editor">
        ${explicitMapUrl ? `<div class="map-link-display">
          <a class="map-saved-link" href="${escapeHtml(explicitMapUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(explicitMapUrl)}</a>
          <button class="button button-outline edit-map-link" type="button">編輯連結</button>
        </div>` : ""}
        <div class="map-link-form ${explicitMapUrl ? "hidden" : ""}">
          <input type="url" value="${escapeHtml(explicitMapUrl)}" placeholder="貼上 Google Maps 連結" aria-label="${escapeHtml(location.name)}的 Google Maps 連結" />
          <button class="button button-outline save-map-link" type="button">儲存連結</button>
          ${explicitMapUrl ? '<button class="button button-outline cancel-map-link" type="button">取消</button>' : ""}
        </div>
        ${automatic && link ? `<a class="automatic-map-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">自動辨識 Google Maps ↗</a>` : ""}
      </div>
    `;
    const toggle = card.querySelector('.map-item-toggle input');
    toggle.addEventListener("change", async () => {
      const target = mapLocationTarget(location);
      if (!target) return;
      target.includeInMap = toggle.checked;
      save();
      await renderInteractiveMap();
      showToast(toggle.checked ? `已將「${location.name}」加入地圖` : `已將「${location.name}」從地圖與路線排除`);
    });
    const linkDisplay = card.querySelector(".map-link-display");
    const linkForm = card.querySelector(".map-link-form");
    card.querySelector(".edit-map-link")?.addEventListener("click", () => {
      linkDisplay.classList.add("hidden");
      linkForm.classList.remove("hidden");
      linkForm.querySelector('input[type="url"]').focus();
    });
    card.querySelector(".cancel-map-link")?.addEventListener("click", () => {
      linkForm.classList.add("hidden");
      linkDisplay.classList.remove("hidden");
    });
    card.querySelector(".save-map-link").addEventListener("click", async () => {
      const input = linkForm.querySelector('input[type="url"]');
      const rawValue = input.value.trim();
      const mapUrl = normalizeGoogleMapsUrl(rawValue);
      if (rawValue && !mapUrl) return showToast("請貼上有效的 Google Maps 連結");
      const target = mapLocationTarget(location);
      if (!target) return;
      target.mapUrl = mapUrl;
      if (generalMapUrl) target.url = "";
      if (mapUrl) target.includeInMap = true;
      save();
      await renderInteractiveMap();
      showToast(mapUrl ? "Google Maps 連結已儲存" : "Google Maps 連結已清除");
    });
    elements.mapLocationList.append(card);
  });
  const routeUrl = googleDirectionsUrl(mapLocations({ includedOnly: true }));
  elements.mapRouteLink.classList.toggle("hidden", !routeUrl || selectedMapFilter === "places");
  if (routeUrl) elements.mapRouteLink.href = routeUrl;
}

async function loadGoogleMaps() {
  if (globalThis.google?.maps) return globalThis.google.maps;
  if (mapApiPromise) return mapApiPromise;
  mapApiPromise = (async () => {
    const configResponse = await fetch("/api/maps/config", { cache: "no-store" });
    const config = await configResponse.json();
    if (!config.enabled || !config.browserKey) throw new Error("尚未設定 Google Maps Browser Key");
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.browserKey)}&libraries=places&v=weekly&language=zh-TW`;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Google Maps 載入失敗"));
      document.head.append(script);
    });
    attachAddressAutocomplete($("#placeAddress"));
    attachAddressAutocomplete($("#editItemAddress"));
    return globalThis.google.maps;
  })();
  return mapApiPromise;
}

function attachAddressAutocomplete(input) {
  if (!input || input.dataset.autocompleteReady || !globalThis.google?.maps?.places) return;
  input.dataset.autocompleteReady = "true";
  const autocomplete = new globalThis.google.maps.places.Autocomplete(input, {
    fields: ["formatted_address", "geometry", "place_id", "name"],
  });
  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    input.value = place.formatted_address || place.name || input.value;
    input.dataset.placeId = place.place_id || "";
    input.dataset.lat = place.geometry?.location?.lat?.() ?? "";
    input.dataset.lng = place.geometry?.location?.lng?.() ?? "";
  });
}

async function renderInteractiveMap() {
  renderMapControls();
  renderMapLocationList();
  const locations = mapLocations({ includedOnly: true }).filter((location) => Number.isFinite(location.lat) && Number.isFinite(location.lng));
  try {
    const maps = await loadGoogleMaps();
    elements.mapNotice.textContent = locations.length ? "點擊標記可查看地點；切換日期不會重新定位地址。" : "尚無已定位地點，請按「產生／更新地圖」。";
    googleMap ||= new maps.Map(elements.tripMap, { center: { lat: 34.3428, lng: 134.0466 }, zoom: 10, mapTypeControl: false, streetViewControl: false });
    googleMapMarkers.forEach((marker) => marker.setMap(null));
    googleMapMarkers = [];
    if (!locations.length) return;
    const bounds = new maps.LatLngBounds();
    locations.forEach((location) => {
      const position = { lat: location.lat, lng: location.lng };
      const marker = new maps.Marker({ map: googleMap, position, label: String(location.order), title: location.name });
      googleMapMarkers.push(marker);
      bounds.extend(position);
    });
    googleMap.fitBounds(bounds);
  } catch (error) {
    elements.mapNotice.innerHTML = `${escapeHtml(error.message)}。目前仍可使用下方分天地址清單與 Google Maps 路線連結。`;
    elements.tripMap.innerHTML = '<div class="map-fallback"><span>⌖</span><strong>互動地圖尚未啟用</strong><small>新增受限 Maps Browser Key 後會自動啟用。</small></div>';
  }
}

async function geocodeMissingLocations() {
  const button = $("#generateMapButton");
  button.disabled = true;
  const original = button.textContent;
  button.textContent = "正在定位…";
  try {
    const maps = await loadGoogleMaps();
    const geocoder = new maps.Geocoder();
    const locations = mapLocations({ includedOnly: true }).filter((location) => (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) && (location.address || automaticMapQuery(location)));
    let updated = 0;
    for (const location of locations.slice(0, 30)) {
      const query = location.address || `${automaticMapQuery(location)} ${state.destination}`;
      const { results } = await geocoder.geocode({ address: query });
      const match = results?.[0];
      if (!match) continue;
      const target = mapLocationTarget(location);
      if (!target) continue;
      target.address = target.address || match.formatted_address || query;
      target.placeId = match.place_id || "";
      target.lat = match.geometry.location.lat();
      target.lng = match.geometry.location.lng();
      updated += 1;
    }
    save();
    await renderInteractiveMap();
    showToast(updated ? `已定位 ${updated} 個地點` : "沒有需要更新的地址");
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function renderPlaces() {
  if (!state.places.length) {
    elements.placesList.innerHTML =
      '<div class="empty-state">還沒有收藏地點。想到哪裡，就先放進來吧。</div>';
    return;
  }

  elements.placesList.innerHTML = "";
  state.places.forEach((place, index) => {
    const row = document.createElement("article");
    row.className = "place-row card";
    const explicitPlaceLink = normalizeExternalUrl(place.url);
    const placeLink = explicitPlaceLink || (place.includeInMap === false ? "" : mapLinkFor(place));
    const mapNote = !explicitPlaceLink && placeLink ? "・自動辨識 Google Maps" : "";
    const placeTitle = placeLink
      ? `<a class="place-link" href="${escapeHtml(placeLink)}" target="_blank" rel="noopener noreferrer">
          <h3>${escapeHtml(place.name)}<span class="external-arrow" aria-hidden="true">↗</span></h3>
        </a>`
      : `<h3>${escapeHtml(place.name)}</h3>`;
    row.innerHTML = `
      <div>
        ${placeTitle}
        <p class="place-meta">${escapeHtml([place.area, place.address, place.note].filter(Boolean).join("・") || "尚無備註")}${mapNote}</p>
      </div>
      <div class="place-actions">
        <button class="button ai-button" type="button">✦ AI 幫我安排</button>
        <button class="more-button delete-place" type="button" aria-label="刪除地點">×</button>
      </div>
      ${place.suggestion ? `
        <div class="ai-result">
          建議放在 <strong>第 ${place.suggestion.day} 天・${escapeHtml(place.suggestion.time)}</strong> — ${escapeHtml(place.suggestion.reason)}
          <button class="button button-coral apply-ai" type="button">加入行程</button>
        </div>` : ""}
    `;

    const aiButton = row.querySelector(".ai-button");
    aiButton.addEventListener("click", () => askAiForPlacement(index, aiButton));
    row.querySelector(".delete-place").addEventListener("click", () => {
      state.places.splice(index, 1);
      save();
      renderPlaces();
    });
    row.querySelector(".apply-ai")?.addEventListener("click", () => applySuggestion(index));
    elements.placesList.append(row);
  });
}

async function askAiForPlacement(index, button) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "分析動線中…";
  try {
    const response = await fetch("/api/ai/place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trip: state, place: state.places[index] }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "AI 分析失敗");
    const suggestedTime = fixedTimeValue(result.time);
    if (!suggestedTime) throw new Error("AI 沒有傳回有效時間，請再試一次");
    state.places[index].suggestion = { ...result, time: suggestedTime };
    save();
    renderPlaces();
  } catch (error) {
    showToast(error.message);
    button.disabled = false;
    button.textContent = original;
  }
}

function applySuggestion(placeIndex) {
  const place = state.places[placeIndex];
  const dayIndex = Number(place.suggestion.day) - 1;
  if (!state.days[dayIndex]) return showToast("建議的日期不存在");
  state.days[dayIndex].items.push(normalizeItineraryItem({
    id: makeEntityId("item"),
    startTime: place.suggestion.time,
    endTime: timeFromMinutes(minutesFromTime(place.suggestion.time) + 60),
    name: place.name,
    area: place.area,
    note: place.note || "",
    url: place.url || "",
    address: place.address || "",
    mapUrl: place.mapUrl || "",
    includeInMap: place.includeInMap !== false,
    placeId: place.placeId || "",
    lat: place.lat,
    lng: place.lng,
  }));
  state.places.splice(placeIndex, 1);
  selectedDayIndex = dayIndex;
  save();
  renderAll();
  switchTab("schedule");
  showToast(`已加入第 ${dayIndex + 1} 天・${place.suggestion.time}`);
}

function reviewFingerprint(trip = state) {
  return JSON.stringify({
    days: trip.days.map((day) => ({
      id: day.id,
      items: day.items.map((item) => ({
        id: item.id,
        startTime: item.startTime,
        endTime: item.endTime,
        timeLabel: item.timeLabel,
        locked: item.locked,
        note: item.note,
        address: item.address,
      })),
    })),
    places: trip.places.map((place) => ({ id: place.id, address: place.address })),
  });
}

function renderAiChat() {
  const log = $("#aiChatLog");
  if (!log) return;
  const messages = Array.isArray(state.aiChat) ? state.aiChat.slice(-20) : [];
  const clearButton = $("#clearAiChatButton");
  if (clearButton) clearButton.disabled = messages.length === 0;
  log.innerHTML = messages.length
    ? messages.map((message) => `
        <article class="ai-chat-message is-${message.role === "assistant" ? "assistant" : "user"}">
          <strong>${message.role === "assistant" ? "AI 旅伴" : escapeHtml(message.name || "旅伴")}</strong>
          <p>${escapeHtml(message.content || "")}</p>
          <time>${message.createdAt ? escapeHtml(new Date(message.createdAt).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })) : ""}</time>
        </article>`).join("")
    : '<div class="empty-state">可以請 AI 檢查動線、時間衝突，或討論要怎麼調整。</div>';
  log.scrollTop = log.scrollHeight;
}

function clearAiReview() {
  aiReviewSnapshot = "";
  const container = $("#aiReviewResults");
  if (!container) return;
  container.innerHTML = "";
  container.classList.add("hidden");
}

async function askAiToReview(question = "") {
  const reviewButton = $("#reviewTripButton");
  const submitButton = $("#aiQuestionForm button[type='submit']");
  const clearButton = $("#clearAiChatButton");
  reviewButton.disabled = true;
  submitButton.disabled = true;
  clearButton.disabled = true;
  const originalReviewText = reviewButton.textContent;
  const originalSubmitText = submitButton.textContent;
  reviewButton.textContent = "分析整趟行程中…";
  submitButton.textContent = "AI 思考中…";
  try {
    const prompt = question || "請檢查整趟行程，找出動線不順、時間衝突或需要重新安排的地方。";
    state.aiChat ||= [];
    state.aiChat.push({
      id: makeEntityId("chat"),
      role: "user",
      name: currentUser?.displayName || "旅伴",
      content: prompt,
      createdAt: new Date().toISOString(),
    });
    state.aiChat = state.aiChat.slice(-20);
    save();
    renderAiChat();
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trip: state, message: prompt, history: state.aiChat.slice(-20) }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "AI 討論失敗");
    state.aiChat.push({
      id: makeEntityId("chat"),
      role: "assistant",
      name: "AI 旅伴",
      content: result.reply || result.summary || "分析完成。",
      createdAt: new Date().toISOString(),
    });
    state.aiChat = state.aiChat.slice(-20);
    save();
    renderAiChat();
    aiReviewSnapshot = reviewFingerprint();
    renderAiReview(result);
  } catch (error) {
    showToast(error.message);
  } finally {
    reviewButton.disabled = false;
    submitButton.disabled = false;
    clearButton.disabled = !(state.aiChat?.length);
    reviewButton.textContent = originalReviewText;
    submitButton.textContent = originalSubmitText;
  }
}

function renderAiReview(result, { announce = true } = {}) {
  const container = $("#aiReviewResults");
  const suggestions = Array.isArray(result.operations) ? result.operations : (Array.isArray(result.suggestions) ? result.suggestions : []);
  const actionableTypes = new Set(["move", "move_to_places", "add_place", "add_new_place", "update"]);
  const actionableSuggestions = suggestions.filter((suggestion) => actionableTypes.has(suggestion.type));
  const mapsSources = (Array.isArray(result.googleMapsSources) ? result.googleMapsSources : [])
    .map((source) => ({ name: source.name || "地點", url: normalizeExternalUrl(source.url) }))
    .filter((source) => source.url);
  const mapsAttribution = result.mapsGrounded
    ? `<div class="google-maps-grounding"><span>地點與動線資料來源：</span><span translate="no">Google Maps</span>${mapsSources.length ? `・${mapsSources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.name)} ↗</a>`).join("・")}` : ""}</div>`
    : result.mapsRequested
      ? '<div class="google-maps-grounding is-unavailable">這次未取得可驗證的 Google Maps 地點來源，因此不會憑空新增景點。</div>'
      : "";
  container.innerHTML = `
    <div class="ai-answer">
      <strong>${actionableSuggestions.length ? `AI 已準備 ${actionableSuggestions.length} 項行程修改` : "AI 回覆完成，這次沒有修改行程"}</strong>
      ${escapeHtml(result.summary || "目前沒有需要特別調整的地方。")}
      ${mapsAttribution}
      <div class="operation-diff">${actionableSuggestions.length ? "請確認下方內容，再套用到行程表。" : "若要 AI 直接提出可套用修改，可以明確說「請把…移到…」或「請將時間改成…」。"}</div>
    </div>
  `;
  suggestions.forEach((suggestion, index) => {
    const card = document.createElement("div");
    card.className = "ai-suggestion";
    const isNewMapsPlace = suggestion.type === "add_new_place";
    const found = ["add_place", "add_new_place"].includes(suggestion.type) ? null : findItineraryItem(suggestion.itemId);
    const entity = suggestion.type === "add_place"
      ? state.places.find((place) => place.id === suggestion.itemId)
      : isNewMapsPlace
        ? { name: suggestion.title || suggestion.sourceName }
      : found ? state.days[found.dayIndex].items[found.itemIndex] : null;
    const entityName = entity?.name || suggestion.title || "行程建議";
    const sourceDay = found ? found.dayIndex + 1 : null;
    const sourceTime = entity ? formatTimeRange(entity) : "";
    const targetTime = suggestion.startTime
      ? `${suggestion.startTime}${suggestion.endTime ? `－${suggestion.endTime}` : ""}`
      : sourceTime;
    let operationDiff = "";
    if (suggestion.type === "move_to_places") {
      operationDiff = '<div class="operation-diff">套用後：從行程移除，並保留在想去的地方</div>';
    } else if (["add_place", "add_new_place"].includes(suggestion.type)) {
      operationDiff = `<div class="operation-diff">套用後：加入第 ${escapeHtml(suggestion.targetDay)} 天${targetTime ? `・${escapeHtml(targetTime)}` : ""}</div>`;
    } else if (suggestion.type === "move") {
      operationDiff = `<div class="operation-diff">原本：第 ${escapeHtml(sourceDay)} 天${sourceTime ? `・${escapeHtml(sourceTime)}` : ""}<br>調整後：第 ${escapeHtml(suggestion.targetDay)} 天${targetTime ? `・${escapeHtml(targetTime)}` : ""}</div>`;
    } else if (suggestion.type === "update") {
      const changedFields = [suggestion.note ? "備註" : "", suggestion.address ? "地址" : ""].filter(Boolean).join("、");
      operationDiff = `<div class="operation-diff">原本：第 ${escapeHtml(sourceDay)} 天${sourceTime ? `・${escapeHtml(sourceTime)}` : ""}<br>調整後：第 ${escapeHtml(sourceDay)} 天${targetTime ? `・${escapeHtml(targetTime)}` : ""}${changedFields ? `・更新${escapeHtml(changedFields)}` : ""}</div>`;
    }
    const sourceUrl = normalizeExternalUrl(suggestion.mapUrl);
    const sourceLink = isNewMapsPlace && sourceUrl
      ? `<div class="google-maps-source"><span translate="no">Google Maps</span>：<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(suggestion.sourceName || entityName)} ↗</a></div>`
      : "";
    card.innerHTML = `
      <strong>${escapeHtml(entityName)}</strong>
      ${escapeHtml(suggestion.reason || "")}
      ${sourceLink}
      ${operationDiff}
      <div class="suggestion-actions"></div>
    `;
    const actions = card.querySelector(".suggestion-actions");
    const labels = {
      move: `移到第 ${suggestion.targetDay} 天`,
      move_to_places: "從行程移除",
      add_place: `加入第 ${suggestion.targetDay} 天`,
      add_new_place: `直接加入第 ${suggestion.targetDay} 天`,
      update: "套用這項修改",
    };
    if (labels[suggestion.type]) {
      const applyButton = document.createElement("button");
      applyButton.type = "button";
      applyButton.className = "button button-coral";
      applyButton.textContent = labels[suggestion.type];
      applyButton.addEventListener("click", () => applyReviewSuggestion(index, result));
      actions.append(applyButton);
    }
    const keepButton = document.createElement("button");
    keepButton.type = "button";
    keepButton.className = "button button-outline";
    keepButton.textContent = labels[suggestion.type] ? "保留現狀" : "知道了";
    keepButton.addEventListener("click", () => discardAiSuggestion(index, result));
    actions.append(keepButton);
    container.append(card);
  });
  if (actionableSuggestions.length > 1) {
    const applyAll = document.createElement("button");
    applyAll.type = "button";
    applyAll.className = "button button-dark apply-all-ai";
    applyAll.textContent = `套用全部 ${actionableSuggestions.length} 項修改`;
    applyAll.addEventListener("click", () => applyAllReviewSuggestions(result));
    container.append(applyAll);
  }
  container.classList.remove("hidden");
  if (announce) showToast(actionableSuggestions.length ? `AI 已產生 ${actionableSuggestions.length} 項行程修改，請確認套用` : "AI 已回覆，這次沒有產生行程修改");
  requestAnimationFrame(() => container.scrollIntoView({ behavior: "smooth", block: "nearest" }));
}

function removeAiSuggestion(index, result) {
  const key = Array.isArray(result.operations) ? "operations" : "suggestions";
  const suggestions = Array.isArray(result[key]) ? result[key] : [];
  result[key] = suggestions.filter((_, suggestionIndex) => suggestionIndex !== index);
  return result[key];
}

function discardAiSuggestion(index, result) {
  const remaining = removeAiSuggestion(index, result);
  if (!remaining.length) {
    clearAiReview();
    return showToast("已保留現狀，這組建議已確認完畢");
  }
  renderAiReview(result, { announce: false });
  showToast(`已保留現狀，還有 ${remaining.length} 項建議待確認`);
}

function findItineraryItem(itemId) {
  for (let dayIndex = 0; dayIndex < state.days.length; dayIndex += 1) {
    const itemIndex = state.days[dayIndex].items.findIndex((item) => item.id === itemId);
    if (itemIndex >= 0) return { dayIndex, itemIndex };
  }
  return null;
}

function applyAiOperation(suggestion, confirmRemoval = true) {
  const targetDayIndex = Number(suggestion.targetDay) - 1;
  if (suggestion.type === "add_new_place") {
    if (!state.days[targetDayIndex]) throw new Error("AI 建議的日期不存在");
    const mapUrl = normalizeExternalUrl(suggestion.mapUrl);
    if (!mapUrl) throw new Error("這個 Google Maps 建議缺少可驗證的來源連結");
    const newItem = normalizeItineraryItem({
      id: makeEntityId("item"),
      startTime: suggestion.startTime || null,
      endTime: suggestion.endTime || null,
      timeLabel: suggestion.startTime ? null : "彈性",
      name: suggestion.title || suggestion.sourceName || "Google Maps 景點",
      area: suggestion.area || "",
      note: suggestion.note || suggestion.reason || "",
      url: mapUrl,
      address: suggestion.address || "",
      mapUrl,
      includeInMap: true,
      placeId: "",
      lat: null,
      lng: null,
    });
    state.days[targetDayIndex].items.push(newItem);
    return { tab: "schedule", dayIndex: targetDayIndex, itemId: newItem.id };
  }
  if (suggestion.type === "add_place") {
    const placeIndex = state.places.findIndex((place) => place.id === suggestion.itemId);
    if (placeIndex < 0 || !state.days[targetDayIndex]) throw new Error("找不到 AI 建議的景點");
    const [place] = state.places.splice(placeIndex, 1);
    const newItem = normalizeItineraryItem({
      id: makeEntityId("item"),
      startTime: suggestion.startTime || null,
      endTime: suggestion.endTime || null,
      timeLabel: suggestion.startTime ? null : "彈性",
      name: place.name,
      area: place.area || "",
      note: suggestion.note || place.note || "",
      url: place.url || "",
      address: suggestion.address || place.address || "",
      mapUrl: place.mapUrl || "",
      includeInMap: place.includeInMap !== false,
      placeId: place.placeId || "",
      lat: place.lat,
      lng: place.lng,
    });
    state.days[targetDayIndex].items.push(newItem);
    return { tab: "schedule", dayIndex: targetDayIndex, itemId: newItem.id };
  }
  const found = findItineraryItem(suggestion.itemId);
  if (!found) throw new Error("行程已變動，請重新分析");
  const item = state.days[found.dayIndex].items[found.itemIndex];
  if (item.locked) throw new Error(`「${item.name}」已鎖定，AI 無法修改`);
  if (suggestion.type === "move_to_places") {
    if (confirmRemoval && !window.confirm(`要從行程移除「${item.name}」嗎？移除後仍會保留在想去的地方。`)) throw new Error("已取消移除");
    state.days[found.dayIndex].items.splice(found.itemIndex, 1);
    state.places.push({
      id: makeEntityId("place"), name: item.name, area: item.area || "", note: item.note || "", url: item.url || "",
      address: item.address || "", mapUrl: item.mapUrl || "", includeInMap: item.includeInMap !== false,
      placeId: item.placeId || "", lat: item.lat, lng: item.lng,
    });
    return { tab: "places" };
  }
  if (suggestion.type === "move") {
    if (!state.days[targetDayIndex]) throw new Error("AI 建議的日期不存在");
    state.days[found.dayIndex].items.splice(found.itemIndex, 1);
    state.days[targetDayIndex].items.push(item);
  }
  if (["move", "update"].includes(suggestion.type)) {
    if (suggestion.startTime) item.startTime = suggestion.startTime;
    if (suggestion.endTime) item.endTime = suggestion.endTime;
    if (suggestion.note) item.note = suggestion.note;
    if (suggestion.address && suggestion.address !== item.address) {
      item.address = suggestion.address;
      item.placeId = "";
      item.lat = null;
      item.lng = null;
    }
    if (suggestion.startTime) item.timeLabel = null;
    syncLegacyTime(item);
  }
  return {
    tab: "schedule",
    dayIndex: suggestion.type === "move" ? targetDayIndex : found.dayIndex,
    itemId: item.id,
  };
}

function prepareAiOperationDestination(destination) {
  if (!destination || destination.tab !== "schedule") return;
  selectedDayIndex = Math.max(0, Math.min(destination.dayIndex, state.days.length - 1));
  highlightItemId = destination.itemId || "";
}

function openAiOperationDestination(destination) {
  if (!destination) return;
  switchTab(destination.tab === "places" ? "places" : "schedule");
}

function applyReviewSuggestion(index, result) {
  if (aiReviewSnapshot !== reviewFingerprint()) {
    clearAiReview();
    return showToast("行程已被更新，請重新執行 AI 健檢");
  }
  const suggestions = result.operations || result.suggestions || [];
  let destination;
  try {
    destination = applyAiOperation(suggestions[index]);
  } catch (error) {
    return showToast(error.message);
  }
  const remaining = removeAiSuggestion(index, result);
  if (!remaining.length) prepareAiOperationDestination(destination);
  save();
  aiReviewSnapshot = reviewFingerprint();
  renderAll();
  if (remaining.length) {
    renderAiReview(result, { announce: false });
    showToast(`已套用這項 AI 修改，還有 ${remaining.length} 項建議待確認`);
  } else {
    clearAiReview();
    openAiOperationDestination(destination);
    showToast(destination?.tab === "places" ? "已從行程移除，並保留在想去的地方" : "已套用 AI 建議，行程表已同步更新");
  }
}

function applyAllReviewSuggestions(result) {
  if (aiReviewSnapshot !== reviewFingerprint()) {
    clearAiReview();
    return showToast("行程已被更新，請重新請 AI 分析");
  }
  const operations = result.operations || result.suggestions || [];
  if (operations.some((operation) => operation.type === "move_to_places") && !window.confirm("部分項目會從行程移除，並保留在想去的地方。確定要套用全部修改嗎？")) return;
  const destinations = [];
  try {
    operations.filter((operation) => operation.type !== "reconsider").forEach((operation) => {
      const destination = applyAiOperation(operation, false);
      if (destination) destinations.push(destination);
    });
  } catch (error) {
    return showToast(error.message);
  }
  state.days.forEach((day) => sortItineraryItems(day.items));
  const destination = destinations.find((candidate) => candidate.tab === "schedule") || destinations[0];
  prepareAiOperationDestination(destination);
  save();
  renderAll();
  clearAiReview();
  openAiOperationDestination(destination);
  showToast("已套用全部 AI 修改，行程表已同步更新");
}

function renderNames() {
  elements.buyerName.innerHTML = state.names.length
    ? state.names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")
    : '<option value="" selected disabled>請先新增名字</option>';
  elements.namesList.innerHTML = "";
  state.names.forEach((name, index) => {
    const chip = document.createElement("div");
    chip.className = "name-chip";
    chip.innerHTML = `
      <span>${escapeHtml(name)}</span>
      <button class="more-button" type="button" aria-label="刪除名字">×</button>
    `;
    chip.querySelector("button").addEventListener("click", () => {
      state.names.splice(index, 1);
      save();
      renderNames();
    });
    elements.namesList.append(chip);
  });
}

function renderShopping() {
  const purchased = state.shopping.filter((entry) => entry.status === "purchased").length;
  $("#shoppingSummary").textContent = state.shopping.length ? `${state.shopping.length} 件代購 · 已購買 ${purchased} 件 · 待完成 ${state.shopping.length - purchased} 件` : "把旅伴的心願，帶回家。";
  if (!state.shopping.length) {
    elements.shoppingList.innerHTML =
      '<div class="empty-state">清單還是空的，這趟可以輕裝回家。</div>';
    return;
  }
  elements.shoppingList.innerHTML = "";
  state.shopping.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = `shopping-row${entry.status === "purchased" ? " is-purchased" : ""}`;
    row.innerHTML = `
      <span class="avatar">${escapeHtml(entry.name.slice(0, 1))}</span>
      <div class="shopping-info">
        <div class="shopping-item">${escapeHtml(entry.item)}</div>
        <div class="shopping-sub"><span class="shopping-buyer">委託人 · ${escapeHtml(entry.name)}</span>${entry.note ? `<span class="shopping-note">${escapeHtml(entry.note)}</span>` : ""}</div>
      </div>
      <div class="shopping-status" role="group" aria-label="${escapeHtml(entry.item)}的狀態">
        <button type="button" data-status="pending" class="${entry.status === "pending" ? "active" : ""}">待確認</button>
        <button type="button" data-status="confirmed" class="${entry.status === "confirmed" ? "active" : ""}">✓ 已確認</button>
        <button type="button" data-status="purchased" class="${entry.status === "purchased" ? "active" : ""}">✓ 已購買</button>
      </div>
      <div class="shopping-actions">
        <button class="more-button edit-shopping" type="button" title="編輯" aria-label="編輯代購項目：${escapeHtml(entry.item)}">✎</button>
        <button class="more-button delete-shopping" type="button" title="刪除" aria-label="刪除代購項目：${escapeHtml(entry.item)}">×</button>
      </div>
    `;
    row.querySelectorAll("[data-status]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.status === entry.status));
      button.addEventListener("click", () => {
        state.shopping[index].status = button.dataset.status;
        save();
        renderShopping();
      });
    });
    row.querySelector(".edit-shopping").addEventListener("click", () => {
      openEditShoppingModal(entry.id);
    });
    row.querySelector(".delete-shopping").addEventListener("click", () => {
      state.shopping.splice(index, 1);
      save();
      renderShopping();
    });
    elements.shoppingList.append(row);
  });
}

function openEditShoppingModal(entryId) {
  const entry = state.shopping.find((item) => item.id === entryId);
  if (!entry) return showToast("找不到這筆代購項目");
  editingShoppingId = entryId;
  const names = [...new Set([entry.name, ...state.names].filter(Boolean))];
  $("#editShoppingName").innerHTML = names
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");
  $("#editShoppingName").value = entry.name;
  $("#editShoppingItem").value = entry.item;
  $("#editShoppingNote").value = entry.note || "";
  $("#editShoppingStatus").value = entry.status || "pending";
  $("#editShoppingModalBackdrop").classList.remove("hidden");
}

function closeEditShoppingModal() {
  editingShoppingId = "";
  $("#editShoppingModalBackdrop").classList.add("hidden");
}

function saveEditedShoppingItem() {
  const entry = state.shopping.find((item) => item.id === editingShoppingId);
  if (!entry) {
    closeEditShoppingModal();
    return showToast("這筆代購項目已被移除");
  }
  entry.name = $("#editShoppingName").value;
  entry.item = $("#editShoppingItem").value.trim();
  entry.note = $("#editShoppingNote").value.trim();
  entry.status = $("#editShoppingStatus").value;
  save();
  renderShopping();
  closeEditShoppingModal();
  showToast("代購項目已更新");
}

function resetMemoForm() {
  editingMemoId = "";
  $("#memoForm").reset();
  $("#saveMemoButton").textContent = "加入備忘錄";
  $("#cancelMemoEditButton").classList.add("hidden");
}

function startMemoEdit(memoId) {
  const memo = state.memos.find((item) => item.id === memoId);
  if (!memo) return showToast("找不到這則備忘錄");
  editingMemoId = memoId;
  $("#memoTitle").value = memo.title;
  $("#memoUrl").value = memo.url || "";
  $("#memoContent").value = memo.content || "";
  $("#saveMemoButton").textContent = "儲存備忘錄";
  $("#cancelMemoEditButton").classList.remove("hidden");
  $("#memoTitle").focus();
}

function renderMemos() {
  if (!state.memos.length) {
    elements.memoList.innerHTML =
      '<div class="empty-state card">還沒有備忘錄。可以記下訂房資料、餐廳候選或重要連結。</div>';
    return;
  }
  elements.memoList.innerHTML = "";
  state.memos.forEach((memo) => {
    const card = document.createElement("article");
    card.className = "memo-card card";
    const title = memo.url
      ? `<a href="${escapeHtml(memo.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(memo.title)}<span class="external-arrow" aria-hidden="true">↗</span></a>`
      : `<h3>${escapeHtml(memo.title)}</h3>`;
    card.innerHTML = `
      <div class="memo-card-main">
        ${title}
        ${memo.content ? `<p>${escapeHtml(memo.content).replaceAll("\n", "<br>")}</p>` : ""}
        ${memo.url ? `<span class="memo-url">${escapeHtml(memo.url)}</span>` : ""}
      </div>
      <div class="memo-actions">
        <button class="more-button edit-memo" type="button" title="編輯" aria-label="編輯備忘錄：${escapeHtml(memo.title)}">✎</button>
        <button class="more-button delete-memo" type="button" title="刪除" aria-label="刪除備忘錄：${escapeHtml(memo.title)}">×</button>
      </div>
    `;
    card.querySelector(".edit-memo").addEventListener("click", () => startMemoEdit(memo.id));
    card.querySelector(".delete-memo").addEventListener("click", () => {
      const confirmed = window.confirm(`確定要刪除備忘錄「${memo.title}」嗎？`);
      if (!confirmed) return;
      state.memos = state.memos.filter((item) => item.id !== memo.id);
      if (editingMemoId === memo.id) resetMemoForm();
      save();
      renderMemos();
      showToast("備忘錄已刪除");
    });
    elements.memoList.append(card);
  });
}

function openImportModal(open) {
  $("#importModalBackdrop").classList.toggle("hidden", !open);
  if (open) {
    $("#importText").focus();
  } else {
    pendingImport = null;
    $("#importPreview").innerHTML = "";
    $("#importPreview").classList.add("hidden");
  }
}

async function createImportPreview(rawText) {
  const submitButton = $("#importForm button[type='submit']");
  const original = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = "AI 整理中…";
  try {
    const response = await fetch("/api/ai/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText, destination: state.destination }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "AI 無法整理這份內容");
    pendingImport = result;
    renderImportPreview(result);
  } catch (error) {
    showToast(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = original;
  }
}

function renderImportPreview(result) {
  const container = $("#importPreview");
  const days = Array.isArray(result.days) ? result.days : [];
  const mergePreview = mergeImportedDays(
    structuredClone(state.days),
    buildImportedDays(result),
  );
  container.innerHTML = `
    <h3>匯入預覽：${escapeHtml(result.title || `${days.length} 天行程`)}</h3>
    <div class="import-merge-summary">
      <strong>自動整合預估</strong>
      <span>同日期合併 ${mergePreview.mergedDays} 天</span>
      <span>整合重複行程 ${mergePreview.mergedItems} 筆</span>
      <span>新增 ${mergePreview.addedDays} 天、${mergePreview.addedItems} 筆行程</span>
    </div>
    <div class="import-preview-days">
      ${days
        .map(
          (day, index) => `
            <div class="import-preview-day">
              <strong>第 ${index + 1} 天${day.date ? `・${escapeHtml(day.date)}` : ""}｜${escapeHtml(day.title || "")}</strong>
              ${(day.items || [])
                .map(
                  (item) =>
                    `<p>${escapeHtml(item.time || "彈性")}　${escapeHtml(item.name)}${item.area ? `・${escapeHtml(item.area)}` : ""}</p>`,
                )
                .join("") || "<p>沒有可辨識的行程</p>"}
            </div>`,
        )
        .join("")}
    </div>
    <button class="button button-coral" id="applyImportButton" type="button">確認加入目前行程</button>
  `;
  container.classList.remove("hidden");
  $("#applyImportButton").addEventListener("click", applyPendingImport);
}

function normalizeMatchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[\s・･,，、。.!！?？:：;；\-－—_/／\\]/g, "");
}

function textSimilarity(leftValue, rightValue) {
  const left = normalizeMatchText(leftValue);
  const right = normalizeMatchText(rightValue);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  if (shorter.length >= 4 && longer.includes(shorter)) return 0.9;
  if (left.length < 2 || right.length < 2) return 0;
  const leftPairs = new Map();
  for (let index = 0; index < left.length - 1; index += 1) {
    const pair = left.slice(index, index + 2);
    leftPairs.set(pair, (leftPairs.get(pair) || 0) + 1);
  }
  let matches = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const pair = right.slice(index, index + 2);
    const count = leftPairs.get(pair) || 0;
    if (!count) continue;
    matches += 1;
    leftPairs.set(pair, count - 1);
  }
  return (2 * matches) / (left.length + right.length - 2);
}

function timesAreClose(leftTime, rightTime) {
  const left = itineraryTimeValue(leftTime);
  const right = itineraryTimeValue(rightTime);
  if (left === Number.MAX_SAFE_INTEGER || right === Number.MAX_SAFE_INTEGER) return true;
  return Math.abs(left - right) <= 120;
}

function isDuplicateImportedItem(existing, incoming) {
  const existingUrl = normalizeExternalUrl(existing.url);
  const incomingUrl = normalizeExternalUrl(incoming.url);
  if (existingUrl && existingUrl === incomingUrl) return true;
  const nameScore = textSimilarity(existing.name, incoming.name);
  if (nameScore === 1) return true;
  if (nameScore >= 0.78 && timesAreClose(existing.time, incoming.time)) return true;
  const existingArea = normalizeMatchText(existing.area);
  const sameArea = existingArea && existingArea === normalizeMatchText(incoming.area);
  return nameScore >= 0.58 && sameArea && timesAreClose(existing.time, incoming.time);
}

function mergeDistinctText(existingValue, incomingValue) {
  const existing = String(existingValue || "").trim();
  const incoming = String(incomingValue || "").trim();
  if (!existing) return incoming;
  if (!incoming) return existing;
  const existingNormalized = normalizeMatchText(existing);
  const incomingNormalized = normalizeMatchText(incoming);
  if (existingNormalized.includes(incomingNormalized)) return existing;
  if (incomingNormalized.includes(existingNormalized)) return incoming;
  return `${existing}・${incoming}`;
}

function mergeImportedItem(existing, incoming) {
  if (!fixedTimeValue(existing.time) && fixedTimeValue(incoming.time)) {
    existing.time = incoming.time;
  }
  if (
    textSimilarity(existing.name, incoming.name) >= 0.78 &&
    incoming.name.length > existing.name.length
  ) {
    existing.name = incoming.name;
  }
  existing.area = mergeDistinctText(existing.area, incoming.area);
  existing.note = mergeDistinctText(existing.note, incoming.note);
  existing.url = normalizeExternalUrl(existing.url) || normalizeExternalUrl(incoming.url);
}

function buildImportedDays(result) {
  return (result?.days || []).map((day) => ({
    id: makeEntityId("day"),
    title: String(day.title || "旅遊行程"),
    date: String(day.date || ""),
    items: (day.items || []).map((item) => normalizeItineraryItem({
      id: makeEntityId("item"),
      time: String(item.time || "彈性"),
      startTime: item.startTime || null,
      endTime: item.endTime || null,
      timeLabel: item.timeLabel || null,
      name: String(item.name || ""),
      area: String(item.area || ""),
      note: String(item.note || ""),
      url: normalizeExternalUrl(item.url),
      address: String(item.address || ""),
      locked: Boolean(item.locked),
    })),
  }));
}

function mergeImportedDays(targetDays, importedDays) {
  const stats = { mergedDays: 0, mergedItems: 0, addedDays: 0, addedItems: 0 };
  importedDays.forEach((importedDay) => {
    const targetDay = importedDay.date
      ? targetDays.find((day) => day.date === importedDay.date)
      : null;
    if (!targetDay) {
      targetDays.push(importedDay);
      stats.addedDays += 1;
      stats.addedItems += importedDay.items.length;
      return;
    }
    stats.mergedDays += 1;
    if ((!targetDay.title || /^第.+天$/.test(targetDay.title)) && importedDay.title) {
      targetDay.title = importedDay.title;
    }
    importedDay.items.forEach((incomingItem) => {
      const duplicate = targetDay.items.find((existingItem) =>
        isDuplicateImportedItem(existingItem, incomingItem),
      );
      if (duplicate) {
        mergeImportedItem(duplicate, incomingItem);
        stats.mergedItems += 1;
      } else {
        targetDay.items.push(incomingItem);
        stats.addedItems += 1;
      }
    });
    sortItineraryItems(targetDay.items);
  });
  return stats;
}

function applyPendingImport() {
  const importedDays = buildImportedDays(pendingImport);
  if (!importedDays.length) return showToast("沒有可以匯入的行程");
  const onlyDay = state.days.length === 1 ? state.days[0] : null;
  const isBlankFirstDay =
    onlyDay &&
    !onlyDay.date &&
    !onlyDay.items.length &&
    (!onlyDay.title || onlyDay.title === "第一天");
  if (isBlankFirstDay) state.days = [];
  const mergeStats = mergeImportedDays(state.days, importedDays);
  if (!state.destination && pendingImport.destination) {
    state.destination = String(pendingImport.destination);
  }
  save();
  renderAll();
  openImportModal(false);
  switchTab("schedule");
  showToast(
    `匯入完成：合併 ${mergeStats.mergedDays} 天、整合 ${mergeStats.mergedItems} 筆重複行程`,
  );
}

function openEditItineraryModal(itemId, focusModal = true) {
  const found = findItineraryItem(itemId);
  if (!found) {
    editingItemId = "";
    $("#editItineraryModalBackdrop").classList.add("hidden");
    return showToast("這個行程已被移除");
  }
  editingItemId = itemId;
  const item = state.days[found.dayIndex].items[found.itemIndex];
  $("#editItemTime").value = item.startTime || "";
  $("#editItemEndTime").value = item.endTime || "";
  $("#editItemTimeLabel").value = item.startTime ? "" : (item.timeLabel || "彈性");
  $("#editItemName").value = item.name || "";
  $("#editItemArea").value = item.area || "";
  $("#editItemNote").value = item.note || "";
  $("#editItemUrl").value = normalizeExternalUrl(item.url);
  $("#editItemAddress").value = item.address || "";
  delete $("#editItemAddress").dataset.placeId;
  delete $("#editItemAddress").dataset.lat;
  delete $("#editItemAddress").dataset.lng;
  $("#editItemIncludeInMap").checked = item.includeInMap !== false;
  $("#editItemLocked").checked = Boolean(item.locked);
  $("#editItineraryModalBackdrop").classList.remove("hidden");
  if (focusModal) {
    $(".edit-itinerary-modal").focus({ preventScroll: true });
  }
}

function closeEditItineraryModal() {
  editingItemId = "";
  $("#editItineraryModalBackdrop").classList.add("hidden");
}

function saveEditedItineraryItem() {
  const found = findItineraryItem(editingItemId);
  if (!found) {
    closeEditItineraryModal();
    return showToast("這個行程已被移除，無法儲存");
  }
  const item = state.days[found.dayIndex].items[found.itemIndex];
  const editedTime = $("#editItemTime").value;
  const editedEndTime = $("#editItemEndTime").value;
  if (editedEndTime && !editedTime) return showToast("請先設定開始時間");
  if (editedTime && editedEndTime && minutesFromTime(editedEndTime) <= minutesFromTime(editedTime)) return showToast("結束時間必須晚於開始時間");
  item.startTime = editedTime || null;
  item.endTime = editedTime ? (editedEndTime || null) : null;
  item.timeLabel = editedTime ? null : ($("#editItemTimeLabel").value || "彈性");
  item.name = $("#editItemName").value.trim();
  item.area = $("#editItemArea").value.trim();
  item.note = $("#editItemNote").value.trim();
  item.url = normalizeExternalUrl($("#editItemUrl").value);
  const nextAddress = $("#editItemAddress").value.trim();
  if (nextAddress !== item.address) {
    item.placeId = "";
    item.lat = null;
    item.lng = null;
  }
  item.address = nextAddress;
  if ($("#editItemAddress").dataset.placeId && nextAddress) {
    item.placeId = $("#editItemAddress").dataset.placeId;
    item.lat = Number($("#editItemAddress").dataset.lat);
    item.lng = Number($("#editItemAddress").dataset.lng);
  }
  item.locked = $("#editItemLocked").checked;
  item.includeInMap = $("#editItemIncludeInMap").checked;
  syncLegacyTime(item);
  sortItineraryItems(state.days[found.dayIndex].items);
  save();
  renderDays();
  closeEditItineraryModal();
  showToast("行程已更新");
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === name);
    if (tab.dataset.tab === name) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
  $(`#${name}Panel`).classList.add("active");
  if (name === "overview") renderOverview();
  if (name === "schedule") renderDays();
  if (name === "map") renderInteractiveMap();
  requestAnimationFrame(() => {
    const active = $(".tab.active");
    const tabs = $(".tabs");
    tabs.scrollTo({ left: active.offsetLeft - (tabs.clientWidth - active.offsetWidth) / 2, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    updateTabsOverflow();
  });
}

function updateTabsOverflow() {
  const tabs = $(".tabs");
  $(".tabs-shell").classList.toggle("can-scroll-right", tabs.scrollWidth - tabs.clientWidth - tabs.scrollLeft > 4);
  $(".tabs-shell").classList.toggle("can-scroll-left", tabs.scrollLeft > 4);
}

$(".tabs").addEventListener("scroll", updateTabsOverflow, { passive: true });
new ResizeObserver(updateTabsOverflow).observe($(".tabs"));
window.matchMedia("(max-width: 620px)").addEventListener("change", (event) => {
  document.querySelectorAll(".event-note").forEach((note) => { note.open = !event.matches; });
});

$("#eventActionsClose").addEventListener("click", closeEventActions);
$("#eventActionsBackdrop").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) closeEventActions();
});
$("#deleteEventAction").addEventListener("click", () => {
  const found = findItineraryItem(actionItemId);
  closeEventActions();
  if (found) deleteItineraryItem(found.dayIndex, state.days[found.dayIndex].items[found.itemIndex]);
});
document.querySelectorAll("[data-event-delta]").forEach((button) => button.addEventListener("click", () => {
  const found = findItineraryItem(actionItemId);
  if (!found) return;
  const item = state.days[found.dayIndex].items[found.itemIndex];
  if (item.locked) return;
  const duration = itemDuration(item);
  const start = minutesFromTime(item.startTime);
  const nextStart = Math.max(0, Math.min(24 * 60 - duration, start + Number(button.dataset.eventDelta)));
  item.startTime = timeFromMinutes(nextStart);
  item.endTime = timeFromMinutes(nextStart + duration);
  syncLegacyTime(item);
  closeEventActions();
  save();
  renderAll();
}));

// Keep every dialog usable with the keyboard and return to its opening control.
let modalOpener = null;
let activeModal = null;
let lastOutsideFocus = null;
document.addEventListener("focusin", (event) => {
  if (!event.target.closest(".modal-backdrop")) lastOutsideFocus = event.target;
});
const focusableSelector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';
const modalObserver = new MutationObserver(() => {
  const next = document.querySelector(".modal-backdrop:not(.hidden)");
  if (next === activeModal) return;
  if (next) {
    modalOpener = lastOutsideFocus || document.activeElement;
    activeModal = next;
    document.body.classList.add("modal-open");
    next.querySelector(".modal").setAttribute("tabindex", "-1");
    if (!next.contains(document.activeElement)) next.querySelector(".modal").focus({ preventScroll: true });
  } else {
    activeModal = null;
    document.body.classList.remove("modal-open");
    if (modalOpener?.isConnected) modalOpener.focus({ preventScroll: true });
  }
});
document.querySelectorAll(".modal-backdrop").forEach((backdrop) => modalObserver.observe(backdrop, { attributes: true, attributeFilter: ["class"] }));
document.addEventListener("keydown", (event) => {
  if (!activeModal) return;
  if (event.key === "Escape") {
    event.preventDefault();
    activeModal.querySelector(".modal-close").click();
  }
  if (event.key === "Tab") {
    const controls = [...activeModal.querySelectorAll(focusableSelector)].filter((node) => node.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === activeModal.querySelector(".modal"))) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  }
});

function renderAll() {
  elements.tripTitle.value = state.title;
  elements.destination.value = state.destination;
  renderDays();
  renderOverview();
  renderMapControls();
  renderMapLocationList();
  renderAiChat();
  renderPlaces();
  renderNames();
  renderShopping();
  renderMemos();
  updateCounts();
}

$("#homeButton").addEventListener("click", showHome);

$("#newTripForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const trip = {
    id: makeTripId(),
    title: $("#newTripTitle").value.trim(),
    destination: $("#newTripDestination").value.trim(),
    days: [{ id: makeEntityId("day"), title: "第一天", date: "", items: [] }],
    places: [],
    names: [],
    shopping: [],
    memos: [],
    aiChat: [],
    autoMapLinks: true,
  };
  collection.trips.push(trip);
  if (currentUser) {
    await writeAccountTrip(trip);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
  }
  event.currentTarget.reset();
  renderTripCards();
  openTrip(trip.id);
  showToast("新旅程已建立");
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

$("#reviewTripButton").addEventListener("click", () => askAiToReview());
$("#clearAiChatButton").addEventListener("click", () => {
  if (!state.aiChat?.length) return showToast("目前沒有 AI 對話紀錄");
  if (!window.confirm("這會同步清除所有旅伴看到的 AI 對話紀錄，確定要清除嗎？")) return;
  state.aiChat = [];
  clearAiReview();
  save();
  renderAiChat();
  showToast("AI 對話紀錄已清除並同步");
});
$("#aiQuestionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("#aiQuestion");
  const question = input.value.trim();
  if (!question) return showToast("請先輸入想問 AI 的問題");
  input.value = "";
  askAiToReview(question);
});
$("#openImportButton").addEventListener("click", () => openImportModal(true));
$("#importModalClose").addEventListener("click", () => openImportModal(false));
$("#importModalBackdrop").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) openImportModal(false);
});
$("#importForm").addEventListener("submit", (event) => {
  event.preventDefault();
  createImportPreview($("#importText").value.trim());
});
$("#editItineraryModalClose").addEventListener("click", closeEditItineraryModal);
$("#cancelEditItineraryButton").addEventListener("click", closeEditItineraryModal);
$("#editItineraryModalBackdrop").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) closeEditItineraryModal();
});
$("#editItineraryForm").addEventListener("submit", (event) => {
  event.preventDefault();
  saveEditedItineraryItem();
});
document.querySelectorAll("[data-time-target]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = $(`#${button.dataset.timeTarget}`);
    const otherInput = button.dataset.timeTarget === "editItemEndTime" ? $("#editItemTime") : null;
    const baseMinutes = minutesFromTime(input.value) ?? minutesFromTime(otherInput?.value) ?? 9 * 60;
    input.value = timeFromMinutes(baseMinutes + Number(button.dataset.delta || 0));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
});
$("#editShoppingModalClose").addEventListener("click", closeEditShoppingModal);
$("#cancelEditShoppingButton").addEventListener("click", closeEditShoppingModal);
$("#editShoppingModalBackdrop").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) closeEditShoppingModal();
});
$("#editShoppingForm").addEventListener("submit", (event) => {
  event.preventDefault();
  saveEditedShoppingItem();
});

elements.mapDayFilter.addEventListener("change", (event) => {
  selectedMapFilter = event.target.value;
  rememberMapFilter();
  renderInteractiveMap();
});
elements.autoMapLinksToggle.addEventListener("change", (event) => {
  state.autoMapLinks = event.target.checked;
  save();
  renderAll();
  renderInteractiveMap();
  showToast(event.target.checked ? "已開啟 Google Maps 自動辨識連結" : "已關閉自動辨識；只顯示手動貼上的連結");
});
$("#generateMapButton").addEventListener("click", geocodeMissingLocations);
$("#openMapImportButton").addEventListener("click", () => {
  $("#mapImportModalBackdrop").classList.remove("hidden");
  $("#mapImportText").focus();
});
$("#mapImportModalClose").addEventListener("click", () => $("#mapImportModalBackdrop").classList.add("hidden"));
$("#mapImportModalBackdrop").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) event.currentTarget.classList.add("hidden");
});
$("#mapImportForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const lines = $("#mapImportText").value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const matches = [];
  const unmatched = [];
  lines.forEach((line) => {
    const [dayText, name = "", address = ""] = line.split(/[｜|]/).map((part) => part.trim());
    const dayNumber = Number(dayText.match(/\d+/)?.[0]);
    const day = state.days[dayNumber - 1];
    const normalizedName = normalizeMatchText(name);
    const item = day?.items.find((candidate) => normalizeMatchText(candidate.name).includes(normalizedName) || normalizedName.includes(normalizeMatchText(candidate.name)));
    if (!day || !item || !address) unmatched.push(line);
    else matches.push({ dayNumber, item, address });
  });
  const preview = `將配對 ${matches.length} 筆地址${unmatched.length ? `，另有 ${unmatched.length} 筆找不到對應行程` : ""}。\n\n${matches.slice(0, 8).map((match) => `第${match.dayNumber}天｜${match.item.name}｜${match.address}`).join("\n")}\n\n確定寫入嗎？`;
  if (!matches.length) return showToast("找不到可以配對的行程，請確認第幾天與地點名稱");
  if (!window.confirm(preview)) return;
  matches.forEach(({ item, address }) => {
    if (item.address !== address) {
      item.address = address;
      item.placeId = "";
      item.lat = null;
      item.lng = null;
    }
  });
  save();
  $("#mapImportModalBackdrop").classList.add("hidden");
  renderInteractiveMap();
  showToast(`已匯入 ${matches.length} 筆地址${unmatched.length ? `，${unmatched.length} 筆未配對` : ""}`);
});

elements.tripTitle.addEventListener("input", (event) => {
  state.title = event.target.value;
  save();
});

elements.destination.addEventListener("input", (event) => {
  state.destination = event.target.value;
  save();
});

$("#addDayButton").addEventListener("click", () => {
  state.days.push({
    id: makeEntityId("day"),
    title: `第 ${state.days.length + 1} 天`,
    date: "",
    items: [],
  });
  selectedDayIndex = state.days.length - 1;
  save();
  renderAll();
});

elements.dayJumpSelect.addEventListener("change", (event) => {
  if (event.target.value === "") return;
  selectedDayIndex = Number(event.target.value);
  renderDays();
});

$("#placeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const addressInput = $("#placeAddress");
  state.places.push({
    id: makeEntityId("place"),
    name: $("#placeName").value.trim(),
    area: $("#placeArea").value.trim(),
    note: $("#placeNote").value.trim(),
    url: normalizeExternalUrl($("#placeUrl").value),
    address: addressInput.value.trim(),
    mapUrl: "",
    includeInMap: true,
    placeId: addressInput.dataset.placeId || "",
    lat: addressInput.dataset.lat ? Number(addressInput.dataset.lat) : null,
    lng: addressInput.dataset.lng ? Number(addressInput.dataset.lng) : null,
  });
  delete addressInput.dataset.placeId;
  delete addressInput.dataset.lat;
  delete addressInput.dataset.lng;
  event.currentTarget.reset();
  save();
  renderPlaces();
  showToast("已加入想去的地方");
});

$("#shoppingForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!elements.buyerName.value) {
    openModal(true);
    return showToast("請先新增名字");
  }
  state.shopping.push({
    id: makeEntityId("shopping"),
    name: elements.buyerName.value,
    item: $("#shoppingItem").value.trim(),
    note: $("#shoppingNote").value.trim(),
    status: "pending",
  });
  $("#shoppingItem").value = "";
  $("#shoppingNote").value = "";
  save();
  renderShopping();
  showToast("已加入代購清單");
});

$("#memoForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = {
    title: $("#memoTitle").value.trim(),
    url: normalizeExternalUrl($("#memoUrl").value),
    content: $("#memoContent").value.trim(),
  };
  if (editingMemoId) {
    const memo = state.memos.find((item) => item.id === editingMemoId);
    if (!memo) {
      resetMemoForm();
      return showToast("這則備忘錄已被移除");
    }
    Object.assign(memo, values);
    showToast("備忘錄已更新");
  } else {
    state.memos.unshift({ id: makeEntityId("memo"), ...values });
    showToast("已加入備忘錄");
  }
  save();
  renderMemos();
  resetMemoForm();
});

$("#cancelMemoEditButton").addEventListener("click", resetMemoForm);

$("#nameForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("#newName").value.trim();
  if (state.names.includes(name)) return showToast("這個名字已經在清單裡");
  state.names.push(name);
  $("#newName").value = "";
  save();
  renderNames();
});

function openModal(open) {
  $("#modalBackdrop").classList.toggle("hidden", !open);
  if (open) $("#newName").focus();
}

$("#manageNamesButton").addEventListener("click", () => openModal(true));
$("#modalClose").addEventListener("click", () => openModal(false));
$("#modalBackdrop").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) openModal(false);
});

$("#shareButton").addEventListener("click", async () => {
  let url = "";
  try {
    if (!state.shareId) {
      state.shareId = makeShareId();
      if (!sharedView) {
        if (currentUser) {
          await writeAccountTrip(state);
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
        }
      }
    }
    elements.saveStatus.textContent = "建立短連結…";
    const code = await createShortLink(state.shareId);
    if (!sharedView) {
      if (currentUser) {
        await writeAccountTrip(state);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
      }
    }
    await syncTripToCloud();
    await watchSharedTrip(state.shareId);
    url = `${location.origin}${location.pathname}#s=${code}`;
    await navigator.clipboard.writeText(url);
    showToast("短版共用編輯連結已複製");
  } catch (error) {
    console.error(error);
    if (url) {
      window.prompt("複製這個共用編輯連結：", url);
    } else {
      elements.saveStatus.textContent = "建立連結失敗";
      showToast("共用連結建立失敗，請稍後再試");
    }
  }
});

elements.loginButton.addEventListener("click", async () => {
  if (isLocalPreview()) return showToast("Google 登入請在正式網站測試");
  elements.loginButton.disabled = true;
  try {
    await signInWithGoogle();
  } catch (error) {
    console.error(error);
    showToast(error.code === "auth/popup-closed-by-user" ? "已取消登入" : "Google 登入失敗");
  } finally {
    elements.loginButton.disabled = false;
  }
});

$("#logoutButton").addEventListener("click", async () => {
  try {
    await signOutGoogle();
  } catch (error) {
    console.error(error);
    showToast("登出失敗，請稍後再試");
  }
});

async function initialize() {
  try {
    await initializeAuth();
  } catch (error) {
    console.error(error);
    renderAuthState();
    showToast("Google 帳號連線失敗，暫時使用瀏覽器儲存");
  }
  const code = shortShareCode();
  if (code) {
    try {
      const shareId = await readShortLink(code);
      if (shareId) {
        await openCollaborativeTrip(shareId);
      } else {
        showHome();
        showToast("找不到這個短連結");
      }
    } catch (error) {
      console.error(error);
      showHome();
      showToast("短連結讀取失敗，請稍後再試");
    }
    return;
  }
  const shareId = editShareId();
  if (shareId) {
    await openCollaborativeTrip(shareId);
    return;
  }
  const sharedState = decodeSharedState();
  if (sharedState) {
    openSharedTrip(sharedState);
  } else {
    showHome();
  }
}

initialize();
