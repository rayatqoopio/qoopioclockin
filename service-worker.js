/* Qoopio PWA Service Worker — 2025-11-17 */
const VERSION = 'v20251117';
const CACHE_NAME = `qoopio-cache-${VERSION}`;

// 以 SW 檔案所在目錄為基準，處理 GitHub Pages 子路徑
const toURL = (path) => new URL(path, self.location).toString();

// 不預快取 "/"，避免 GitHub Pages 可能產生 opaqueredirect
const PRECACHE_URLS = [
  'index.html',
  'manifest.json',
  'icon.png',
  'user.json'
].map(toURL);

/* 安裝：預載靜態資源並立即等待跳過 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => {
        // 不中斷安裝；就算某檔失敗也先跳過等待，避免卡版本
        console.warn('[SW] precache failed:', err);
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

/* 允許頁面以 postMessage 觸發 SKIP_WAITING（HTML 已送出） */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* 依請求型態套用對應策略 */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 非 GET 直接走網路（避免影響打卡 POST、Apps Script 等）
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // 1) 導航請求：離線時回 index.html（SPA/子路徑都能正常啟動）
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(toURL('index.html'), { ignoreSearch: true })
      )
    );
    return;
  }

  // 2) 同網域靜態檔：cache-first（支援 ?v= 參數）
  const isStatic =
    sameOrigin &&
    (/\/(index\.html|manifest\.json|icon\.png)$/i.test(url.pathname));

  if (isStatic) {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((cached) => {
        return (
          cached ||
          fetch(req).then((res) => {
            // 成功回應再放入快取
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, resClone));
            return res;
          })
        );
      })
    );
    return;
  }

  // 3) 同網域 user.json：network-first（確保名單更新），失敗回快取
  const isUserJson = sameOrigin && /\/user\.json$/i.test(url.pathname);
  if (isUserJson) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  // 4) 其他同網域 GET：一般 cache-first
  if (sameOrigin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req))
    );
    return;
  }

  // 5) 跨網域（Google Apps Script 等）：直接走網路，不攔截
  // （若要離線回退，可視需求改成 network-first）
  // 不調用 respondWith 即為預設行為：直接 fetch
});
