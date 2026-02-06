
/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'lp-f4-cache-v9';

// Critical items: These MUST cache for the app to work offline.
const criticalUrls = [
  '/',
  '/index.html',
  '/manifest.json'
];

// External items: These improve the experience but shouldn't break installation if they fail.
const externalUrls = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap'
];

const LOGO_URL = 'https://files.catbox.moe/1picoz.png';

// Install a service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('Opened cache');
      
      // 1. Cache Critical Assets (Fail if any fail)
      await cache.addAll(criticalUrls);

      // 2. Attempt to cache External Assets (Ignore errors)
      // This prevents the SW from failing to install if a CDN is down
      const externalPromises = externalUrls.map(async (url) => {
        try {
          const req = new Request(url, { mode: 'cors' });
          const res = await fetch(req);
          if (res.status === 200) await cache.put(req, res);
        } catch (e) {
          console.warn('Failed to cache external asset:', url);
        }
      });

      // 3. Special handling for Logo (might need no-cors for opaque response)
      const logoPromise = (async () => {
          try {
              // Try CORS first
              let req = new Request(LOGO_URL, { mode: 'cors' });
              let res = await fetch(req);
              if (!res.ok) throw new Error('CORS failed');
              await cache.put(req, res);
          } catch (e) {
              try {
                  // Fallback to no-cors (Opaque)
                  const req = new Request(LOGO_URL, { mode: 'no-cors' });
                  const res = await fetch(req);
                  await cache.put(req, res);
              } catch (err) {
                  console.warn('Failed to cache logo:', err);
              }
          }
      })();

      await Promise.all([...externalPromises, logoPromise]);
    })
  );
  self.skipWaiting();
});

// Cache and return requests
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Handle Navigation Requests (SPA Support)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
          return caches.match('/index.html');
      })
    );
    return;
  }

  // Standard Cache Strategy for Assets
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        // Exclude extensions and non-http schemes
        if (!request.url.startsWith('http')) {
            return;
        }

        return fetch(request).then(
          (response) => {
            // Check if valid response
            if(!response || (response.status !== 200 && response.type !== 'opaque') || response.type === 'error') {
              return response;
            }

            // Don't cache API calls to Firebase/Google/Data to ensure fresh data
            if (
                request.url.includes('firebase') || 
                request.url.includes('googleapis') || 
                request.url.includes('firestore') ||
                request.url.includes('google-analytics')
            ) {
                return response;
            }

            // Cache new assets dynamically
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

// Update a service worker
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    })
  );
  self.clients.claim();
});
