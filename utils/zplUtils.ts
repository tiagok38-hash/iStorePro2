import { Product } from '../types';

interface LabelConfig {
    widthMm: number;
    heightMm: number;
    cols: 1 | 2;
    identifier: 'sku' | 'imei1' | 'serialNumber' | 'ean';
}

/**
 * Generates ZPL for thermal printing on 110mm width rolls.
 * 203 DPI = 8 dots/mm. 110mm = 880 dots.
 */
export const generateZPL = (products: Product[], config: LabelConfig, storeName: string = 'ISTORE PRO'): string => {
    let zpl = '';

    const dotsPerMm = 8;
    const labelHeightDots = config.heightMm * dotsPerMm;

    for (let i = 0; i < products.length; i += config.cols) {
        zpl += '^XA';
        zpl += '^PW880'; // 110mm total width
        zpl += '^LL' + (labelHeightDots + (8 * dotsPerMm));
        zpl += '^LH0,0';
        zpl += '^MD15';

        // Label 1 - Starts at 7mm absolute (56 dots)
        zpl += generateLabelContent(products[i], 56, config, dotsPerMm);

        // Label 2 - 7mm + 40mm content + 16mm gap = 63mm (504 dots)
        if (config.cols === 2 && i + 1 < products.length) {
            zpl += generateLabelContent(products[i + 1], 504, config, dotsPerMm);
        }

        zpl += '^XZ\n';
    }

    return zpl;
};

const generateLabelContent = (product: Product, xOffsetDots: number, config: LabelConfig, dotsPerMm: number): string => {
    let content = '';
    const usableWidthDots = 40 * dotsPerMm; // 40mm usable content width

    // Helper for relative X/Y inside label
    // Using 4mm top margin
    const getX = (mm: number) => Math.floor((mm * dotsPerMm) + xOffsetDots);
    const getY = (mm: number) => Math.floor((mm + 4) * dotsPerMm);

    // 1) PRODUCT DESCRIPTION (TOP) - Bold 6.5pt (~18 dots), Center Aligned within its 40mm
    const nameStr = getCleanDescription(product);
    content += `^FO${getX(0)},${getY(2)}^FB${usableWidthDots},2,0,C,0^A0N,20,20^FD${escapeZpl(nameStr)}^FS`;

    // 2 & 3) BARCODE & HUMAN READABLE (CENTER) - EAN-13, 10mm high (80 dots)
    let rawVal = product.barcodes?.[0] || product.imei1 || product.serialNumber || '7890000000000';
    const barcodeVal = rawVal.replace(/\D/g, '').padEnd(12, '0').slice(0, 13);

    // Position barcode in the center. Usable 40mm. EAN13 module 2 approx 30mm. (40-30)/2 = 5mm.
    content += `^FO${getX(5)},${getY(8)}^BY2,2,80^BEN,80,Y,N^FD${barcodeVal}^FS`;

    // 4) PRICE (BOTTOM) - 11pt Bold (~30 dots), Centered
    const priceStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price);
    content += `^FO${getX(0)},${getY(22)}^FB${usableWidthDots},1,0,C,0^A0N,30,30^FD${priceStr}^FS`;

    return content;
};

const getCleanDescription = (product: Product): string => {
    let model = product.model || '';
    let color = product.color || '';
    const raw = `${model} ${color}`.toUpperCase();
    const words = raw.split(/\s+/);
    const uniqueWords = words.filter((word, index) => words.indexOf(word) === index);
    return uniqueWords.join(' ');
};

const escapeZpl = (str: string) => {
    return str.replace(/_/g, ' ').replace(/\^/g, ' ').replace(/~/g, ' ');
};
