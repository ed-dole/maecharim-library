(() => {
  'use strict';

  const API_URL =
    window.APP_CONFIG.API_URL;

  const HOMEFAST_CACHE_KEY = 'homefast-v8-performance';
  const HOMEFAST_TTL = 2 * 60 * 1000;
  const HOMEFAST_STALE_TTL = 15 * 60 * 1000;
  const NETWORK_TIMEOUT = 15000;
  const inflight = new Map();
  let homeFastPromise = null;
  let backgroundRefreshStarted = false;

  function isAdminMode() {
    try {
      return Boolean(sessionStorage.getItem('mysiteAdminToken'));
    } catch (_) {
      return false;
    }
  }

  function storageRead(storage, key, maxAgeMs) {
    if (!storage || !key || !maxAgeMs || isAdminMode()) return null;
    try {
      const saved = JSON.parse(storage.getItem('SITE_FAST:' + key) || 'null');
      if (!saved || !saved.savedAt || Date.now() - saved.savedAt > maxAgeMs) return null;
      return saved;
    } catch (_) {
      return null;
    }
  }

  function readCache(key, maxAgeMs) {
    return storageRead(window.sessionStorage, key, maxAgeMs) ||
      storageRead(window.localStorage, key, maxAgeMs);
  }

  function writeCache(key, data) {
    if (!key || isAdminMode()) return;
    const payload = JSON.stringify({ savedAt: Date.now(), data });
    try { sessionStorage.setItem('SITE_FAST:' + key, payload); } catch (_) {}
    try { localStorage.setItem('SITE_FAST:' + key, payload); } catch (_) {}
  }

  function withTimeout(promise, ms, message) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = window.setTimeout(() => reject(new Error(message || 'การเชื่อมต่อใช้เวลานานเกินไป')), ms);
    });
    return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
  }

  async function networkJson(url) {
    const response = await withTimeout(fetch(url, {
      method: 'GET',
      cache: 'default',
      credentials: 'omit'
    }), NETWORK_TIMEOUT, 'Apps Script ใช้เวลาตอบกลับนานเกินไป');

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (result?.success === false) throw new Error(result.message || 'โหลดข้อมูลไม่สำเร็จ');
    return result;
  }

  async function fetchJson(url, options = {}) {
    const key = String(options.key || '').trim();
    const ttl = Number(options.ttl || 0);
    const cached = ttl > 0 ? readCache(key, ttl) : null;
    if (cached) return cached.data;

    const inflightKey = key || String(url);
    if (inflight.has(inflightKey)) return inflight.get(inflightKey);

    const request = networkJson(url)
      .then(result => {
        if (ttl > 0) writeCache(key, result);
        return result;
      })
      .finally(() => inflight.delete(inflightKey));

    inflight.set(inflightKey, request);
    return request;
  }

  function refreshHomeFastInBackground() {
    if (backgroundRefreshStarted || isAdminMode()) return;
    backgroundRefreshStarted = true;

    const run = () => {
      networkJson(API_URL + '?mode=homefast')
        .then(result => writeCache(HOMEFAST_CACHE_KEY, result))
        .catch(() => {})
        .finally(() => { backgroundRefreshStarted = false; });
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(run, { timeout: 2500 });
    } else {
      setTimeout(run, 1200);
    }
  }

  function getHomeFast() {
    if (homeFastPromise) return homeFastPromise;

    // แสดงข้อมูลจาก cache ทันที แล้ว refresh เงียบ ๆ ภายหลัง
    const fresh = readCache(HOMEFAST_CACHE_KEY, HOMEFAST_TTL);
    if (fresh) {
      // Cache ยังสด: แสดงทันทีและไม่ยิง Apps Script ซ้ำโดยไม่จำเป็น
      homeFastPromise = Promise.resolve(fresh.data);
      return homeFastPromise;
    }

    // ถ้ามี cache เก่าที่ยังไม่เกิน 15 นาที ให้ใช้ก่อน เพื่อให้หน้าแสดงทันที
    const stale = readCache(HOMEFAST_CACHE_KEY, HOMEFAST_STALE_TTL);
    if (stale) {
      homeFastPromise = Promise.resolve(stale.data);
      refreshHomeFastInBackground();
      return homeFastPromise;
    }

    // รับ promise ที่เริ่ม fetch ตั้งแต่ <head> ถ้ามี เพื่อไม่ยิงซ้ำ
    const prefetched = window.__SITE_HOMEFAST_PREFETCH;
    const request = prefetched
      ? Promise.resolve(prefetched).then(result => {
          if (!result || result.success === false) throw new Error(result?.message || 'homefast ไม่สำเร็จ');
          return result;
        })
      : networkJson(API_URL + '?mode=homefast');

    homeFastPromise = request
      .then(result => {
        writeCache(HOMEFAST_CACHE_KEY, result);
        return result;
      })
      .catch(error => {
        homeFastPromise = null;
        throw error;
      });

    return homeFastPromise;
  }

  async function homePart(name) {
    try {
      const result = await getHomeFast();
      const data = result?.data || result || {};
      if (Object.prototype.hasOwnProperty.call(data, name)) return data[name];
    } catch (error) {
      console.warn('homefast fallback:', error);
    }

    const fallbackModes = {
      images: 'images',
      about: 'aboutPages',
      news: 'news',
      activity: 'activity',
      boss: 'boss',
      setting: 'setting'
    };
    const mode = fallbackModes[name];
    if (!mode) return undefined;

    const result = await fetchMode(mode, {}, { key: `home-part-${name}`, ttl: 120000 });
    if (name === 'activity') return result.activities || result.data || [];
    if (name === 'boss') return result.boss || result.data || result || {};
    if (name === 'setting') return result.data || result || {};
    return result.data || result || {};
  }

  function fetchMode(mode, params = {}, options = {}) {
    const url = new URL(API_URL);
    url.searchParams.set('mode', mode);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    });
    const cacheKey = options.key || `${mode}:${JSON.stringify(params || {})}`;
    return fetchJson(url.toString(), { key: cacheKey, ttl: options.ttl || 0 });
  }

  function whenNear(elementOrId, callback, rootMargin = '1100px 0px') {
    const start = () => {
      const element = typeof elementOrId === 'string'
        ? document.getElementById(elementOrId)
        : elementOrId;
      if (!element) return;

      let started = false;
      const runOnce = () => {
        if (started) return;
        started = true;
        callback();
      };

      if (!('IntersectionObserver' in window)) {
        runOnce();
        return;
      }

      const rect = element.getBoundingClientRect();
      if (rect.top < window.innerHeight + 1100) {
        runOnce();
        return;
      }

      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        runOnce();
      }, { rootMargin });

      observer.observe(element);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }

  function clear(prefix = '') {
    [window.sessionStorage, window.localStorage].forEach(storage => {
      try {
        Object.keys(storage).forEach(key => {
          if (!key.startsWith('SITE_FAST:')) return;
          if (!prefix || key.includes(prefix)) storage.removeItem(key);
        });
      } catch (_) {}
    });
    homeFastPromise = null;
  }

  window.SiteFast = {
    API_URL,
    fetchJson,
    fetchMode,
    getHomeFast,
    homePart,
    whenNear,
    clear
  };

  getHomeFast().catch(() => {});
})();
