// ==========================================
// Restaurant POS - Service Worker
// Provides offline capabilities and caching
// ==========================================

const CACHE_NAME = 'pos-cache-v5';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/admin.html',
    '/customer-display.html',
    '/compliance-signage.html',
    '/css/pos.css',
    '/js/pos-core.js',
    '/js/calculations.js',
    '/js/api-client.js',
    '/js/pos.js',
    '/js/pos-kitchen.js',
    '/js/pos-tables.js',
    '/js/pos-loyalty.js',
    '/js/pos-extras.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// ==========================================
// IndexedDB for offline write queue (persistent, transactional)
// Cache API is designed for HTTP responses - not appropriate for
// financial transaction data that must survive browser restarts.
// ==========================================
const IDB_NAME = 'pos-offline-db';
const IDB_VERSION = 1;
const IDB_STORE = 'write-queue';

function openIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function enqueueWrite(item) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).add(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getAllQueued() {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function deleteQueued(id) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// ==========================================
// Install - cache core assets
// ==========================================
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                // Continue even if some assets fail to cache
                console.warn('Some assets failed to cache:', err);
            });
        })
    );
    self.skipWaiting();
});

// Activate - clean old caches (including the old Cache-API-based write queue)
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// ==========================================
// Fetch - strategy varies by request type
// ==========================================
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // API write operations (POST/PUT/PATCH/DELETE): queue when offline
    if (url.pathname.startsWith('/api/') && event.request.method !== 'GET') {
        event.respondWith(
            fetch(event.request.clone())
                .then(response => {
                    // On 5xx server error, queue for retry
                    if (response.status >= 500) {
                        return queueAndRespond(event.request);
                    }
                    return response;
                })
                .catch(() => {
                    // Network failed - queue the request for later replay
                    return queueAndRespond(event.request);
                })
        );
        return;
    }

    // API read operations: network only (don't cache dynamic data)
    if (url.pathname.startsWith('/api/')) return;

    // Static assets: network first, fallback to cache
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Only cache successful responses, not 5xx errors
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                }
                // On 5xx for static assets, fall back to cache
                if (response.status >= 500) {
                    return caches.match(event.request).then(cached => cached || response);
                }
                return response;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request).then(cached => {
                    return cached || new Response('Offline - resource not cached', {
                        status: 503,
                        statusText: 'Service Unavailable'
                    });
                });
            })
    );
});

// Helper: queue a failed write request and return synthetic 202
async function queueAndRespond(request) {
    const body = await request.clone().text();
    const queueItem = {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body,
        timestamp: Date.now()
    };

    try {
        await enqueueWrite(queueItem);
    } catch (e) {
        console.error('Failed to queue offline write:', e);
    }

    // Notify the client that the request was queued
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({
            type: 'OFFLINE_QUEUED',
            method: request.method,
            url: request.url
        });
    });

    return new Response(JSON.stringify({
        queued: true,
        message: 'Request queued for sync when online'
    }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
    });
}

// ==========================================
// Queue Replay
// ==========================================
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'REPLAY_QUEUE') {
        replayOfflineQueue();
    }
});

async function replayOfflineQueue() {
    try {
        const items = await getAllQueued();
        if (items.length === 0) return;

        // Sort by timestamp to preserve original request order (item 7)
        items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        let replayed = 0;
        let failed = 0;
        const results = [];

        for (const queueItem of items) {
            try {
                // Add idempotency header to prevent duplicate charges (item 3)
                const headers = { ...queueItem.headers };
                if (!headers['x-idempotency-key']) {
                    headers['x-idempotency-key'] = 'offline-' + queueItem.id + '-' + queueItem.timestamp;
                }

                const response = await fetch(queueItem.url, {
                    method: queueItem.method,
                    headers: headers,
                    body: queueItem.body || undefined
                });

                if (response.ok || response.status < 500) {
                    await deleteQueued(queueItem.id);
                    replayed++;
                    results.push({ id: queueItem.id, url: queueItem.url, status: response.status, synced: true, conflict: response.status === 409 });
                } else {
                    failed++;
                    results.push({ id: queueItem.id, url: queueItem.url, status: response.status, synced: false });
                }
            } catch (e) {
                // Still offline - stop trying
                failed++;
                results.push({ id: queueItem.id, url: queueItem.url, synced: false, error: e.message });
                break;
            }
        }

        // Notify clients with reconciliation details (items 7, 8)
        const conflicts = results.filter(function(r) { return r.conflict; });
        const clients = await self.clients.matchAll();
        clients.forEach(function(client) {
            client.postMessage({
                type: 'QUEUE_REPLAYED',
                replayed: replayed,
                failed: failed,
                remaining: items.length - replayed,
                conflicts: conflicts.length,
                results: results
            });
        });
    } catch (e) {
        console.error('Queue replay failed:', e);
    }
}
