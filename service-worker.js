const CACHE_NAME = 'flowtips-cache-v5';
const CACHE_FILES = [
  './',
  'index.html',
  'floaty.js',
  'firebase.js',
  'index.js',
  'manifest.json',
  'privacy.html',
  'terms.html',
  'cache.html',
  'wechat-qr.jpg',
  'octopus.png',
  'favicon.ico',
  'public/icon-192.png',
  'public/icon-512.png',
  'public/octopus_icon.png'
];

// 不存在但可能被请求的旧文件列表
const REMOVED_FILES = [
  'login.html',
  'login.js',
  'register.html',
  'register.js',
  'login',
  'register'
];

self.addEventListener('install', event => {
  console.log('Service Worker 正在安装，版本: ' + CACHE_NAME);
  // 立即激活新的service worker
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_FILES))
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker 已激活，版本: ' + CACHE_NAME);
  // 立即接管所有客户端
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // 清除旧版本缓存
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('删除旧缓存:', k);
          return caches.delete(k);
        }))
      ),
      // 清除已移除文件的缓存
      caches.open(CACHE_NAME).then(cache => {
        return Promise.all(REMOVED_FILES.map(file => {
          console.log('尝试从缓存中删除已移除的文件:', file);
          return cache.delete(file);
        }));
      })
    ])
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // 检查是否请求已移除的文件
  if (REMOVED_FILES.some(file => url.pathname.endsWith(file))) {
    console.log('请求已移除的文件，重定向到首页:', url.pathname);
    event.respondWith(
      caches.match('/') || fetch('/')
    );
    return;
  }
  
  // 不缓存Firebase认证相关请求
  if (event.request.url.includes('firebaseauth') || 
      event.request.url.includes('identitytoolkit') ||
      event.request.url.includes('googleapis.com/identitytoolkit')) {
    console.log('Firebase认证请求，不缓存:', url.pathname);
    event.respondWith(fetch(event.request));
    return;
  }
  
  // 对于HTML请求，优先使用网络响应，网络失败时再使用缓存
  if (event.request.url.endsWith('.html') || url.pathname === '/' || url.pathname === '') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 克隆响应，因为响应流只能使用一次
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          console.log('网络请求失败，使用缓存:', url.pathname);
          return caches.match(event.request) || caches.match('/');
        })
    );
  } else {
    // 对于其他资源，优先使用缓存，缓存不存在时再使用网络
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then(response => {
            // 只缓存成功的响应
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // 克隆响应，因为响应流只能使用一次
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
            return response;
          }).catch(error => {
            console.log('网络请求失败:', url.pathname, error);
            // 对于图片等资源，可以返回一个默认资源
            if (url.pathname.match(/\.(jpg|jpeg|png|gif|svg|ico)$/)) {
              return caches.match('/favicon.ico');
            }
            throw error;
          });
        })
    );
  }
});
