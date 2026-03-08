/**
 * Sistema de Cache e utilitários de rede compartilhados entre todos os serviços.
 * Extraído do mockApi.ts para permitir a modularização dos serviços.
 */

// --- CACHE SYSTEM ---
const cache: Record<string, { data: any, timestamp: number }> = {};
export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export const METADATA_TTL = 30 * 60 * 1000; // 30 minutes

// Cross-tab cache synchronization
const cacheChannel = new BroadcastChannel('app_cache_sync');

export const fetchWithCache = async <T>(key: string, fetcher: () => Promise<T>, ttl: number = CACHE_TTL): Promise<T> => {
    const now = Date.now();
    if (cache[key] && (now - cache[key].timestamp < ttl)) {
        return cache[key].data;
    }
    const data = await fetcher();
    cache[key] = { data, timestamp: now };
    return data;
};

export const clearCache = (keys: string[]) => {
    const cacheKeys = Object.keys(cache);
    keys.forEach(key => {
        delete cache[key];
        cacheKeys.forEach(ck => {
            if (ck === key || ck.startsWith(key + '_')) {
                delete cache[ck];
            }
        });
    });
    cacheChannel.postMessage({ type: 'CLEAR_CACHE', keys, prefixes: keys });

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app-reloadData'));
    }
};

/** Retorna todas as keys atuais do cache (para clear all) */
export const getAllCacheKeys = () => Object.keys(cache);

cacheChannel.onmessage = (event) => {
    if (event.data && event.data.type === 'CLEAR_CACHE' && Array.isArray(event.data.prefixes)) {
        const cacheKeys = Object.keys(cache);
        event.data.prefixes.forEach((prefix: string) => {
            cacheKeys.forEach(ck => {
                if (ck === prefix || ck.startsWith(prefix + '_')) {
                    delete cache[ck];
                }
            });
        });

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('app-reloadData'));
        }
    }
};

// --- TIMEOUT HELPER ---
const DEFAULT_TIMEOUT = 5000; // 5 seconds

export const withTimeout = <T>(promise: Promise<T> | any, timeoutMs: number = DEFAULT_TIMEOUT, errorMessage?: string): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage || `Request timed out after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
};

export const fetchWithRetry = async <T>(fetcher: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
    try {
        return await fetcher();
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            throw error;
        }

        if (retries <= 0) throw error;

        const isNetworkError =
            error?.message?.includes('aborted') ||
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('NetworkError');

        if (isNetworkError) {
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(fetcher, retries - 1, delay * 2);
        }
        throw error;
    }
};
