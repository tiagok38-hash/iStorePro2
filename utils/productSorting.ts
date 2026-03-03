/**
 * Defines the strict commercial logic for iPhone sorting.
 * Priorities:
 * 1) Generation (e.g., iPhone 11 before iPhone 12)
 * 2) Model Tier (Base -> Mini -> Pro -> Pro Max)
 * 3) Storage (64GB -> 128GB -> 256GB -> 512GB -> 1TB)
 * 
 * For non-iPhone products, it falls back to a provided fallback comparator.
 */

export function parseIphoneAttributes(productName: string) {
    const lowerName = productName.toLowerCase();
    const isIphone = lowerName.includes('iphone');

    if (!isIphone) return null;

    // 1. Generation
    let generation = 999; // default to high number for unknown
    const genMatch = lowerName.match(/iphone\s+(\d+)/);
    if (genMatch && genMatch[1]) {
        generation = parseInt(genMatch[1], 10);
    } else if (lowerName.includes('se')) {
        generation = 9; // Place SE before 11, or 0? Let's use 0 because generally SE is older/cheaper, or maybe 9 (between 8 and X).
    } else if (lowerName.includes(' x ')) {
        generation = 10;
    } else if (lowerName.includes(' xr')) {
        generation = 10.1;
    } else if (lowerName.includes(' xs')) {
        generation = 10.2;
    } else if (lowerName.match(/iphone\s+[78]/)) {
        const match = lowerName.match(/iphone\s+([78])/);
        generation = parseInt(match![1], 10);
    }

    // 2. Model Tier
    // 1: Base, 2: Mini, 3: Plus, 4: Pro, 5: Pro Max
    let tier = 1;
    if (lowerName.includes('pro max')) {
        tier = 5;
    } else if (lowerName.includes('pro')) {
        tier = 4;
    } else if (lowerName.includes('plus')) {
        tier = 3;
    } else if (lowerName.includes('mini')) {
        tier = 2;
    }

    // 3. Storage
    let storageGB = 0;
    const gbMatch = lowerName.match(/(\d+)\s*(gb|tb)/);
    if (gbMatch) {
        let val = parseInt(gbMatch[1], 10);
        if (gbMatch[2] === 'tb') val *= 1024;
        storageGB = val;
    }

    return { generation, tier, storageGB };
}

export function sortProductsCommercial<T extends { productName?: string; name?: string; model?: string; createdAt?: string }>(
    a: T,
    b: T,
    fallbackSortOrder: 'newest' | 'oldest' | 'lowest_price' | 'highest_price' | 'none' = 'none',
    getPrices?: (item: T) => { salePrice: number; costPrice: number }
): number {
    const nameA = a.productName || a.name || a.model || '';
    const nameB = b.productName || b.name || b.model || '';

    const attrA = parseIphoneAttributes(nameA);
    const attrB = parseIphoneAttributes(nameB);

    // If both are iPhones, strictly enforce the iPhone sorting hierarchy
    if (attrA && attrB) {
        if (attrA.generation !== attrB.generation) {
            return attrA.generation - attrB.generation;
        }
        if (attrA.tier !== attrB.tier) {
            return attrA.tier - attrB.tier;
        }
        if (attrA.storageGB !== attrB.storageGB) {
            return attrA.storageGB - attrB.storageGB;
        }
    }

    // If only one is an iPhone, it might be prioritized in an iPhone search
    // But globally, if they aren't both iPhones, we fallback to user preference

    // Default fallback logic based on sortOrder
    if (fallbackSortOrder === 'lowest_price' && getPrices) {
        return getPrices(a).salePrice - getPrices(b).salePrice;
    }
    if (fallbackSortOrder === 'highest_price' && getPrices) {
        return getPrices(b).salePrice - getPrices(a).salePrice;
    }

    // 'newest' / 'oldest' tie-breaker
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

    if (fallbackSortOrder === 'oldest') {
        return dateA - dateB;
    }

    // Default to 'newest'
    return dateB - dateA;
}
