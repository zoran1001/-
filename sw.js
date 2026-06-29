// Service Worker for PWA - 色卡管理工具
const CACHE_NAME = 'color-cards-v4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// 安装阶段：缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 激活阶段：清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 请求拦截：网络优先，失败时回退到缓存
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 GET 请求和跨域请求
  if (request.method !== 'GET' || !url.origin.startsWith(self.location.origin)) {
    return;
  }

  // 脚本和样式文件不缓存，始终从网络获取最新版本
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(fetch(request));
    return;
  }

  // Supabase API 请求走网络
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(request));
    return;
  }

  // OCR.Space API 请求走网络
  if (url.hostname.includes('ocr.space')) {
    event.respondWith(fetch(request));
    return;
  }

  // DeepSeek API 请求走网络
  if (url.hostname.includes('deepseek.com')) {
    event.respondWith(fetch(request));
    return;
  }

  // 其他资源：网络优先，失败时回退缓存
  event.respondWith(
    fetch(request)
      .then((response) => {
        // 缓存成功的响应
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // 网络失败时从缓存返回
        return caches.match(request);
      })
  );
});

// 后台同步：网络恢复后同步离线数据
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-color-cards') {
    console.log('[SW] Syncing offline data...');
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  // 从 IndexedDB 获取待同步数据
  const db = await openDB();
  const pendingSyncs = await getAllPendingSyncs(db);

  for (const sync of pendingSyncs) {
    try {
      // 根据操作类型同步到云端
      if (sync.type === 'add') {
        await syncAddCard(sync.data);
      } else if (sync.type === 'update') {
        await syncUpdateCard(sync.data);
      } else if (sync.type === 'delete') {
        await syncDeleteCard(sync.data.id);
      }

      // 同步成功后删除待同步记录
      await deletePendingSync(db, sync.id);
    } catch (error) {
      console.error('[SW] Sync failed:', error);
    }
  }
}

// IndexedDB 辅助函数
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ColorCardsDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingSyncs')) {
        db.createObjectStore('pendingSyncs', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function getAllPendingSyncs(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingSyncs'], 'readonly');
    const store = transaction.objectStore('pendingSyncs');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function addPendingSync(db, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingSyncs'], 'readwrite');
    const store = transaction.objectStore('pendingSyncs');
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deletePendingSync(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingSyncs'], 'readwrite');
    const store = transaction.objectStore('pendingSyncs');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 云端同步辅助函数（需要与主应用共享 Supabase 配置）
async function syncAddCard(card) {
  // 实际实现需要调用 Supabase API
  console.log('[SW] Syncing add card:', card.id);
}

async function syncUpdateCard(card) {
  console.log('[SW] Syncing update card:', card.id);
}

async function syncDeleteCard(id) {
  console.log('[SW] Syncing delete card:', id);
}
