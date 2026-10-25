/* 号码斤数统计 · 离线缓存
   策略：安装时全量缓存（只有几个文件）；资源走 cache-first。
   页面导航走「缓存优先 + 后台更新」：有缓存立刻出画面（不会再等网络超时转圈），
   同时后台拉新版写回缓存，下次打开就是新的。
   改了 index.html 要把 CACHE 版本号 +1，否则手机还读旧缓存。 */
const CACHE = 'liuhe-v7';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  /* 后端接口不缓存，离线时让它自然失败，页面会自动降级到本机存储 */
  if (req.url.includes('/api/')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then(hit => {
        const net = fetch(req).then(r => {
          /* 站点被删/404 时别把错误页写进缓存，否则下次离线打开就是一片 404 */
          if (r && r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
          }
          return r;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok && r.type === 'basic') {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return r;
    }).catch(() => hit))
  );
});
