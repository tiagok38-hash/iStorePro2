/**
 * Utilitário universal para geração de UUID v4.
 * Funciona de forma segura em qualquer contexto:
 * - HTTPS (produção)
 * - Localhost
 * - Endereços de IP em HTTP local (ex: http://192.168.3.5:3000) onde window.crypto.randomUUID não existe por restrição de contexto seguro
 */
export const generateUUID = (): string => {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch {
        // Fallback para ambientes restritos
    }

    // RFC4122 version 4 compliant UUID generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

// Polyfill global preventivo para garantir que chamadas legadas a crypto.randomUUID() não quebrem
if (typeof window !== 'undefined') {
    try {
        if (!window.crypto) {
            (window as any).crypto = {};
        }
        if (typeof window.crypto.randomUUID !== 'function') {
            (window.crypto as any).randomUUID = () => generateUUID() as any;
        }
    } catch {
        // Silencioso se o objeto crypto for somente leitura
    }
}
