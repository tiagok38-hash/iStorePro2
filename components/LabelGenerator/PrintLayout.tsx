import React from 'react';
import { Product } from '../../types';
import BarcodeLabel from './BarcodeLabel';

interface LabelConfig {
    paperType: 'a4' | 'thermal';
    widthMm: number;
    heightMm: number;
    cols: 1 | 2;
    identifier: 'sku' | 'imei1' | 'serialNumber' | 'ean';
    gapMm?: number;
    showPrice: boolean;
    showDescription: boolean;
    showStoreName: boolean;
    showBarcode: boolean;
}

interface PrintLayoutProps {
    products: Product[];
    config: LabelConfig;
    storeName?: string;
    ref?: React.Ref<HTMLDivElement>;
}

/*
 * === PHYSICAL A4 LABEL SHEET LAYOUT ===
 *
 * A4 page:        210mm x 297mm
 * Left  margin:    10mm
 * Right margin:    10mm
 * Top   margin:     5mm
 * Bottom margin:   5mm
 *
 * Usable width = 210 - 10 - 10 = 190mm
 *
 * 2-column layout:
 *   label width  = 90mm each
 *   column gap   = 10mm
 *   total used   = 90 + 10 + 90 = 190mm ✓
 *
 * 1-column layout:
 *   label width  = 190mm
 *
 * The label height comes from config.heightMm (set by user in the modal).
 * Row gap = 0mm (labels are abutting on the adhesive sheet).
 *
 * NOTE: Do NOT change @page size — always A4.
 * Do NOT add CSS transform or scale to any element.
 * Do NOT use percentages for width/height of label containers.
 */

// A4 physical constants (mm)
const PAGE_WIDTH_MM = 210;
const PAGE_MARGIN_LEFT_MM = 10;
const PAGE_MARGIN_RIGHT_MM = 10;
const PAGE_MARGIN_TOP_MM = 5;
const PAGE_MARGIN_BOTTOM_MM = 5;

// Usable area inside margins
const USABLE_WIDTH_MM = PAGE_WIDTH_MM - PAGE_MARGIN_LEFT_MM - PAGE_MARGIN_RIGHT_MM; // 190mm

// Compute label width for each column mode
const getLabelWidthMm = (cols: 1 | 2, gapMm: number): number => {
    if (cols === 1) return USABLE_WIDTH_MM;
    // 2 cols: (usable - gap) / 2
    return (USABLE_WIDTH_MM - gapMm) / 2;
};

const PrintLayout = React.forwardRef<HTMLDivElement, PrintLayoutProps>(
    ({ products, config, storeName }, ref) => {
        const gapMm = config.gapMm ?? 0;
        const isA4 = config.paperType === 'a4';

        // --- A4 Constants ---
        const A4_WIDTH_MM = 210;
        const A4_USABLE_WIDTH_MM = 190;
        
        let labelWidthMm = config.widthMm;
        let pageW = `${config.cols * config.widthMm + (config.cols > 1 ? gapMm : 0)}mm`;
        let pageH = `${config.heightMm}mm`;
        let paddingStr = '0mm !important';
        
        if (isA4) {
            labelWidthMm = config.cols === 2 ? (A4_USABLE_WIDTH_MM - gapMm) / 2 : A4_USABLE_WIDTH_MM;
            pageW = '210mm';
            pageH = '297mm';
            paddingStr = '5mm 10mm 5mm 10mm !important'; // A4 margins
        }

        const printConfig = { ...config, widthMm: labelWidthMm };

        return (
            <div className="print-layout-container" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', zIndex: -9999 }}>
                <style>{`
                    @page {
                        size: ${pageW} ${pageH};
                        margin: 0;
                    }

                    @media print {
                        html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            width: ${pageW} !important;
                            height: ${pageH} !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            color-adjust: exact !important;
                        }

                        body > *:not(.print-layout-container) {
                            display: none !important;
                        }

                        .print-layout-container {
                            display: block !important;
                            position: static !important;
                            opacity: 1 !important;
                            width: ${pageW} !important;
                            height: ${pageH} !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }

                        .print-page {
                            width: ${pageW} !important;
                            min-height: ${pageH} !important;
                            max-height: ${pageH} !important;
                            overflow: hidden !important;
                            page-break-after: always !important;
                            break-after: page !important;
                            box-sizing: border-box !important;
                            margin: 0 !important;
                            padding: ${paddingStr};
                        }

                        .print-grid {
                            display: grid !important;
                            grid-template-columns: ${config.cols === 2 ? `${labelWidthMm}mm ${labelWidthMm}mm` : `${labelWidthMm}mm`} !important;
                            column-gap: ${config.cols === 2 ? gapMm : 0}mm !important;
                            row-gap: 0mm !important;
                            width: 100% !important;
                            align-content: start !important;
                        }

                        .print-label-cell {
                            width: ${labelWidthMm}mm !important;
                            height: ${config.heightMm}mm !important;
                            overflow: hidden !important;
                            box-sizing: border-box !important;
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                        }

                        .print-label-cell svg {
                            width: 100% !important;
                            height: 100% !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            color-adjust: exact !important;
                            transform: none !important;
                        }
                    }
                `}</style>
                <div ref={ref}>
                    ${isA4 
                        ? chunkArray<Product>(products, config.cols * Math.floor(287 / config.heightMm)).map((pageProducts, pIdx) => (
                            <div key={pIdx} className="print-page">
                                <div className="print-grid">
                                    {pageProducts.map((product, idx) => (
                                        <div key={`${product.id}-${idx}`} className="print-label-cell">
                                            <BarcodeLabel product={product} config={printConfig} storeName={storeName} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                        : chunkArray<Product>(products, config.cols).map((rowProducts, rIdx) => (
                            <div key={rIdx} className="print-page">
                                <div className="print-grid">
                                    {rowProducts.map((product, idx) => (
                                        <div key={`${product.id}-${idx}`} className="print-label-cell">
                                            <BarcodeLabel product={product} config={printConfig} storeName={storeName} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    }
                </div>
            </div>
        );
    }
);

// Helper for pagination / thermal rows
function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunked = [];
    for (let i = 0; i < arr.length; i += size) {
        chunked.push(arr.slice(i, i + size));
    }
    return chunked;
}

PrintLayout.displayName = 'PrintLayout';

export default PrintLayout;
