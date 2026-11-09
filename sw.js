/* ==========================================================================
   Service Worker（サービスワーカー）
   ・ブラウザの裏で動く小さなプログラム。アプリのファイルを保存（キャッシュ）しておき、
     ネットにつながっていなくてもアプリを開けるようにする。
   ・ファイルを更新したら、下の CACHE_VERSION の数字を1つ上げること。
     （上げないと、古いファイルが使われ続けることがある）
   ========================================================================== */
const CACHE_VERSION = 1;
const CACHE_NAME = 'sprite-previewer-v' + CACHE_VERSION;

// オフライン用に保存しておくファイルの一覧
const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

// インストール時：ファイルをまとめて保存する
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())       // 待たずにすぐ新しい版を有効にする
  );
});

// 有効化時：古いバージョンの保存データを削除する
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('sprite-previewer-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ファイルの読み込み要求が来たとき：
//   保存済みのものがあればすぐそれを返し（速い・オフラインでも動く）、
//   裏でネットから最新版を取ってきて保存し直す（次回起動時に新しい版になる）
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;   // 自分のサイト以外は触らない

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const fromNetwork = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);                 // オフラインなら失敗するが、気にしない

      if (cached) {
        event.waitUntil(fromNetwork);       // 裏で更新を続ける
        return cached;
      }
      const res = await fromNetwork;
      return res || new Response('オフラインです', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })
  );
});
