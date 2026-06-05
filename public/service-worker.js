// Simple app-shell service worker for Ledger.
// Strategy: network-first for navigations (so updates show up), cache fallback for offline.
const CACHE = 'ledger-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Never cache Supabase API calls — always go to network.
  if (url.hostname.endsWith('supabase.co')) return

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('/', copy)); return res }).catch(() => caches.match('/')))
    return
  }
  // For built assets (hashed filenames), cache-first is safe and fast.
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && res.status === 200 && (url.pathname.startsWith('/assets/') || url.origin === self.location.origin)) {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy))
    }
    return res
  }).catch(() => hit)))
})
