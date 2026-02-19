// ==========================================
// Restaurant POS - Service Worker
// Provides offline capabilities and caching
// ==========================================

const CACHE_NAME = 'pos-cache-v3';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/admin.html',
    '/customer-display.html',
    '/css/pos.css',
    '/js/pos-core.js',
    '/js/calculations.js',
    '/js/api-client.js',
    '/js/pos.js',
    '/js/pos-kitchen.js',
    '/js/pos-tables.js',
    '/js/pos-loyalty.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Offline write queue - stores mutating API calls when offline
const OFFLINE_QUEUE_KEY = 'pos-offline-queue';

// Install - cache core assets
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

// Activate - clean old caches
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

// Fetch - strategy varies by request type
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // API write operations (POST/PUT/PATCH/DELETE): queue when offline
    if (url.pathname.startsWith('/api/') && event.request.method !== 'GET') {
        event.respondWith(
            fetch(event.request.clone()).catch(async () => {
                // Network failed - queue the request for later replay
                const body = await event.request.clone().text();
                const queueItem = {
                    url: event.request.url,
                    method: event.request.method,
                    headers: Object.fromEntries(event.request.headers.entries()),
                    body,
                    timestamp: Date.now()
                };

                // Store in IndexedDB-backed cache for persistence
                const cache = await caches.open('pos-offline-writes');
                const queueResponse = new Response(JSON.stringify(queueItem));
                await cache.put(
                    new Request('/_queue/' + Date.now() + '-' + Math.random()),
                    queueResponse
                );

                // Notify the client that the request was queued
                const clients = await self.clients.matchAll();
                clients.forEach(client => {
                    client.postMessage({
                        type: 'OFFLINE_QUEUED',
                        method: event.request.method,
                        url: event.request.url
                    });
                });

                // Return a synthetic 202 Accepted response
                return new Response(JSON.stringify({
                    queued: true,
                    message: 'Request queued for sync when online'
                }), {
                    status: 202,
                    headers: { 'Content-Type': 'application/json' }
                });
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
                // Clone and cache successful responses
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
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

// Listen for online status to replay queued requests
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'REPLAY_QUEUE') {
        replayOfflineQueue();
    }
});

// Replay queued offline write operations
async function replayOfflineQueue() {
    try {
        const cache = await caches.open('pos-offline-writes');
        const requests = await cache.keys();

        if (requests.length === 0) return;

        let replayed = 0;
        let failed = 0;

        for (const request of requests) {
            const response = await cache.match(request);
            if (!response) continue;

            const queueItem = JSON.parse(await response.text());

            try {
                const replayResponse = await fetch(queueItem.url, {
                    method: queueItem.method,
                    headers: queueItem.headers,
                    body: queueItem.body || undefined
                });

                if (replayResponse.ok || replayResponse.status < 500) {
                    // Success or client error (don't retry client errors)
                    await cache.delete(request);
                    replayed++;
                } else {
                    failed++;
                }
            } catch (e) {
                // Still offline - stop trying
                failed++;
                break;
            }
        }

        // Notify clients
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'QUEUE_REPLAYED',
                replayed,
                failed,
                remaining: requests.length - replayed
            });
        });
    } catch (e) {
        console.error('Queue replay failed:', e);
    }
}
