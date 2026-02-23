import { lazy, ComponentType } from 'react';

type ModuleFactory<T = any> = () => Promise<{ default: ComponentType<T> }>;

/**
 * Wrapper around React.lazy() that automatically retries failed dynamic imports.
 * 
 * After a new Vercel deployment, the old chunk filenames no longer exist.
 * If the browser has a stale cache, it will try to fetch the old chunk URL,
 * get a 404 (served as HTML), and fail with a MIME type error.
 * 
 * This utility:
 * 1. Catches the import error
 * 2. Checks if we already retried (via sessionStorage flag)
 * 3. If not, forces a full page reload to get the new chunk manifest
 * 4. If we already retried, shows the error (avoids infinite reload loops)
 */
export function lazyWithRetry<T extends ComponentType<any>>(
    factory: () => Promise<{ default: T }>,
    chunkName?: string
) {
    return lazy(() =>
        factory().catch((error: any) => {
            const storageKey = `chunk_retry_${chunkName || 'unknown'}`;
            const hasRetried = sessionStorage.getItem(storageKey);

            if (!hasRetried) {
                console.warn(`[lazyWithRetry] Chunk failed to load${chunkName ? ` (${chunkName})` : ''}. Reloading page...`, error);
                sessionStorage.setItem(storageKey, '1');
                window.location.reload();
                // Return a never-resolving promise to prevent React from rendering while reloading
                return new Promise<{ default: T }>(() => { });
            }

            // Already retried once — clear the flag and throw to show error boundary
            sessionStorage.removeItem(storageKey);
            throw error;
        })
    );
}

/**
 * Same as lazyWithRetry but for named exports (non-default).
 * Usage: lazyWithRetryNamed(() => import('./Module'), 'NamedComponent')
 */
export function lazyWithRetryNamed<T extends ComponentType<any>>(
    factory: () => Promise<Record<string, any>>,
    exportName: string,
    chunkName?: string
) {
    return lazyWithRetry(
        () => factory().then(module => ({ default: module[exportName] as T })),
        chunkName || exportName
    );
}
