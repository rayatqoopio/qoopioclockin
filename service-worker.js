/* Qoopio PWA Service Worker — 2025-12-01 (v4.2) */
/* 更新重點：移除 user.json，新增 gacha-icon，強制更新 HTML */

const VERSION = 'v20251201_4.4'; // 修改此字串會強制客戶端更新
const CACHE_NAME = `qoopio-cache-${VERSION}`;

// 以 SW 檔案所在目錄為基準，處理 GitHub Pages 子路徑
const toURL = (path) => new URL(path, self.location).toString();

// 預先快取的靜態資源 (App Shell)
const PRECACHE_URLS = [
  'index.html',
  'manifest.json',
  'icon.png',
  'gacha-icon.png' // 新增扭蛋圖示
].map(toURL);

/* 安裝：預載靜態資源並立即等待跳過 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => {
        console.warn('[SW] precache failed (non-critical):', err);
      })
      .then(() => self.skipWaiting())
  );
});

/* 啟用：清掉舊版快取並接管頁面 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('qoopio-cache-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* 允許頁面以 postMessage 觸發 SKIP_WAITING */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* 依請求型態套用對應策略 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Google Apps Script API (跨網域)：
  // 絕對不能快取，必須直連網路 (Network Only)
  if (url.origin.includes('script.google.com')) {
    return; // 直接 return，瀏覽器會執行預設 fetch 行為
  }

  // 2. 非 GET 請求 (POST 等)：
  // 必須直連網路
  if (req.method !== 'GET') return;

  const sameOrigin = url.origin === self.location.origin;

  // 3. 導航請求 (HTML)：
  // 優先走網路，失敗才回傳快取的 index.html (Network First, falling back to Cache)
  // 這樣能確保你每次部署新 HTML，用戶重整就能看到
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(toURL('index.html'), { ignoreSearch: true }))
    );
    return;
  }

  // 4. 同網域靜態資源 (JS, CSS, PNG)：
  // Cache First (效能優先)
  if (sameOrigin) {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((cached) => {
        return (
          cached ||
          fetch(req).then((res) => {
            // 請求成功後寫入快取
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, resClone));
            return res;
          })
        );
      })
    );
    return;
  }
});
