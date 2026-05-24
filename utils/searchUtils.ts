import { Product } from '../types.ts';

/**
 * Normalizes a string for search by removing accents, handling gb/tb suffixes,
 * stripping special characters, and converting to lowercase.
 */
export const normalizeForSearch = (str: string): string => {
    return str.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\b(\d+)\s*(gb|tb)\b/gi, '$1')
        .replace(/[^a-z0-9\s]/gi, ' ')
        .toLowerCase()
        .trim();
};

/**
 * Common configuration for parsing search terms.
 */
export const parseSearchTerms = (searchTerm: string) => {
    const normalizedSearchTerm = normalizeForSearch(searchTerm);
    const terms = normalizedSearchTerm.split(/\s+/).filter(t => t.length > 1 || /^\d+$/.test(t));
    const searchPhrase = terms.join(' ');
    const modifiers = ['pro', 'max', 'plus', 'mini'];
    const missingModifiers = modifiers.filter(m => !terms.includes(m));

    return { normalizedSearchTerm, terms, searchPhrase, missingModifiers };
};

/**
 * Generates a searchable description string for a product.
 */
export const getProductSearchDescription = (p: Product): string => {
    return normalizeForSearch(
        `${p.name || ''} ${p.brand || ''} ${p.model || ''} ${p.color || ''} ${p.storage || ''} ${p.sku || ''} ${p.category || ''} ${p.serialNumber || ''} ${p.imei1 || ''} ${p.imei2 || ''} ${(p.barcodes || []).join(' ')}`
    );
};

/**
 * Checks if a product matches the parsed search terms.
 */
export const matchesSearchTerms = (
    product: Product,
    terms: string[],
    missingModifiers: string[],
    description?: string,
    descriptionNoSpaces?: string
): boolean => {
    const desc = description || getProductSearchDescription(product);
    const descNoSpaces = descriptionNoSpaces || desc.replace(/\s+/g, '');

    let searchMatch = terms.length === 0 ? true : terms.every(term => {
        if (/^\d+$/.test(term)) {
            // Numeric terms must not be part of a larger number (e.g. "17" shouldn't match "117" or "172")
            // But it CAN match "17th" or "17gb" since the adjacent characters are non-digits.
            const regex = new RegExp(`(^|\\D)${term}(\\D|$)`);
            return regex.test(desc) || regex.test(descNoSpaces);
        }
        return desc.includes(term) || descNoSpaces.includes(term.replace(/\s+/g, ''));
    });

    // Strict modifier check: if product model has 'pro', 'max', 'plus' or 'mini', 
    // the search terms MUST also include it.
    if (searchMatch) {
        const modelStr = `${product.model || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
        for (const mod of missingModifiers) {
            const regex = new RegExp(`\\b${mod}\\b`);
            if (regex.test(modelStr)) {
                searchMatch = false;
                break;
            }
        }
    }

    return searchMatch;
};

/**
 * Calculates a relevance score for sorting search results.
 * Higher score means more relevant.
 */
export const calculateRelevanceScore = (product: Product, searchPhrase: string, terms: string[]): number => {
    const modelLower = String(product.model || '').toLowerCase();
    
    let score = 0;
    if (modelLower.includes(searchPhrase)) {
        score += 200;
    }

    terms.forEach(term => {
        const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(modelLower)) score += 50;
        else if (modelLower.includes(term)) score += 5;
    });

    return score;
};

/**
 * Sorts products based on relevance to search terms.
 */
export const sortProductsByRelevance = (products: Product[], searchPhrase: string, terms: string[]): Product[] => {
    if (terms.length <= 1) return products;
    
    return [...products].sort((a, b) => {
        const scoreA = calculateRelevanceScore(a, searchPhrase, terms);
        const scoreB = calculateRelevanceScore(b, searchPhrase, terms);
        return scoreB - scoreA;
    });
};
