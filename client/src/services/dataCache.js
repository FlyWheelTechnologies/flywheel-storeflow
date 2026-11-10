/**
 * StoreFlow Multi-Tenant Stale-While-Revalidate (SWR) Data Cache
 *
 * Provides instant 0ms retrieval from memory and sessionStorage,
 * concurrent request deduplication, active subscription syncing across hooks,
 * and silent background revalidation so mobile action buttons and views
 * never get blocked by full-page skeleton loaders.
 */

import { supabase } from './supabaseClient';

class DataCacheService {
  constructor() {
    this.memoryCache = new Map();
    this.inFlightRequests = new Map();
    this.listeners = new Map();
    this.staleTimeMs = 30000; // 30 seconds fresh threshold before revalidating
  }

  _getKey(entity, orgId) {
    return `${entity}:${orgId || 'no_org'}`;
  }

  _getSessionStorageKey(key) {
    return `sf_cache_${key}`;
  }

  _readSession(key) {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    try {
      const raw = window.sessionStorage.getItem(this._getSessionStorageKey(key));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.data)) {
        return parsed;
      }
    } catch (e) {
      // Ignore quota or serialization errors
    }
    return null;
  }

  _writeSession(key, entry) {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      // Keep payload lightweight (limit to 500 records max for session storage safety)
      const sanitized = {
        data: Array.isArray(entry.data) ? entry.data.slice(0, 500) : entry.data,
        timestamp: entry.timestamp
      };
      window.sessionStorage.setItem(this._getSessionStorageKey(key), JSON.stringify(sanitized));
    } catch (e) {
      // Quota exceeded or private browsing restriction - silently ignore
    }
  }

  /**
   * Synchronously check if cached data exists in memory or sessionStorage
   */
  hasCachedData(entity, orgId) {
    if (!orgId) return false;
    const key = this._getKey(entity, orgId);
    if (this.memoryCache.has(key)) return true;
    const session = this._readSession(key);
    if (session) {
      this.memoryCache.set(key, session);
      return true;
    }
    return false;
  }

  /**
   * Synchronously retrieve cached data array (or null if none)
   */
  getCachedData(entity, orgId) {
    if (!orgId) return null;
    const key = this._getKey(entity, orgId);

    // 1. Check memory cache first (0ms)
    const memEntry = this.memoryCache.get(key);
    if (memEntry && Array.isArray(memEntry.data)) {
      return memEntry.data;
    }

    // 2. Check sessionStorage fallback (instant on page reload)
    const sessionEntry = this._readSession(key);
    if (sessionEntry && Array.isArray(sessionEntry.data)) {
      this.memoryCache.set(key, sessionEntry);
      return sessionEntry.data;
    }

    return null;
  }

  /**
   * Set cached data and notify all active hook subscribers
   */
  setCachedData(entity, orgId, dataOrUpdater) {
    if (!orgId) return;
    const key = this._getKey(entity, orgId);
    const prevData = this.getCachedData(entity, orgId) || [];

    const newData = typeof dataOrUpdater === 'function' ? dataOrUpdater(prevData) : dataOrUpdater;
    const entry = {
      data: newData,
      timestamp: Date.now()
    };

    this.memoryCache.set(key, entry);
    this._writeSession(key, entry);

    // Notify all active listeners
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(callback => {
        try {
          callback(newData);
        } catch (e) {
          console.error(`Error notifying listener for ${key}:`, e);
        }
      });
    }
  }

  /**
   * Subscribe a component/hook to cache updates for an entity + orgId
   * Returns unsubscribe function.
   */
  subscribe(entity, orgId, callback) {
    if (!orgId || typeof callback !== 'function') return () => {};
    const key = this._getKey(entity, orgId);

    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);

    return () => {
      const keyListeners = this.listeners.get(key);
      if (keyListeners) {
        keyListeners.delete(callback);
        if (keyListeners.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  /**
   * Fetch with Stale-While-Revalidate and in-flight request deduplication
   */
  async fetchWithSWR(entity, orgId, fetcher, options = {}) {
    if (!orgId) return [];
    const { force = false, silent = false } = options;
    const key = this._getKey(entity, orgId);

    const cachedEntry = this.memoryCache.get(key) || this._readSession(key);
    const now = Date.now();
    const isFresh = cachedEntry && (now - cachedEntry.timestamp < this.staleTimeMs);

    // If data is fresh and force is not specified, return cached data without fetching
    if (isFresh && !force) {
      return cachedEntry.data;
    }

    // Deduplicate in-flight requests for the same key
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key);
    }

    const promise = (async () => {
      try {
        const freshData = await fetcher();
        if (Array.isArray(freshData)) {
          this.setCachedData(entity, orgId, freshData);
        }
        return freshData;
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, promise);

    // If caller needs data and we don't have any cached data yet, await the promise
    if (!cachedEntry || force) {
      return promise;
    }

    // If we already have cached data, trigger revalidation in the background
    // and return the cached data immediately!
    promise.catch(err => {
      if (!silent) {
        console.warn(`[dataCache] Silent background revalidation failed for ${key}:`, err.message);
      }
    });

    return cachedEntry.data;
  }

  /**
   * Prefetch critical store data in the background (called on login / Layout load)
   */
  prefetch(orgId) {
    if (!orgId) return;

    // Prefetch products in background
    if (!this.hasCachedData('products', orgId)) {
      this.fetchWithSWR('products', orgId, async () => {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      }, { silent: true });
    }

    // Prefetch sales in background
    if (!this.hasCachedData('sales', orgId)) {
      this.fetchWithSWR('sales', orgId, async () => {
        const { data, error } = await supabase
          .from('sales')
          .select('*')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      }, { silent: true });
    }
  }

  /**
   * Invalidate cache for a specific entity or whole organization
   */
  invalidate(entity, orgId) {
    if (!orgId) return;
    const key = this._getKey(entity, orgId);
    this.memoryCache.delete(key);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(this._getSessionStorageKey(key));
      } catch (e) {}
    }
  }

  clearOrg(orgId) {
    if (!orgId) return;
    ['products', 'sales', 'expenses', 'customers'].forEach(entity => {
      this.invalidate(entity, orgId);
    });
  }
}

export const dataCache = new DataCacheService();
