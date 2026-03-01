import React, { forwardRef } from 'react';
import BarcodeLabel from './BarcodeLabel';
import { Product } from '../../types';

interface LabelConfig {
    paperType: 'a4' | 'thermal';
    widthMm: number;
    heightMm: number;
    cols: 1 | 2;
    identifier: 'sku' | 'imei1' | 'serialNumber' | 'ean';
    gapMm: number;
    showPrice: boolean;
    showDescription: boolean;
    showStoreName: boolean;
    showBarcode: boolean;
}

interface PrintLayoutProps {
    products: Product[];
    config: LabelConfig;
    storeName: string;
}

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
};

const PrintLayout = forwardRef<HTMLDivElement, PrintLayoutProps>(
    ({ products, config, storeName }, ref) => {
        const isA4 = config.paperType === 'a4';

        const A4_USABLE_WIDTH_MM = 190;

        let labelWidthMm = config.widthMm;
        let pageW = isA4 ? '210mm' : '110mm';
        let pageH = isA4 ? '297mm' : `${config.heightMm + 6}mm`;

        // Final calculation for 110mm media:
        // 7mm (Left Side Margin) + 40mm (Label 1) + 16mm (Gap) + 40mm (Label 2) = 103mm
        // This fits within 110mm and achieves the 16mm gap between content.
        let paddingLeft = isA4 ? '10mm' : '7mm';
        let paddingStr = isA4 ? '5mm 10mm 5mm 10mm !important' : `0mm 0mm 0mm ${paddingLeft} !important`;

        if (isA4) {
            labelWidthMm = config.cols === 2 ? (A4_USABLE_WIDTH_MM - config.gapMm) / 2 : A4_USABLE_WIDTH_MM;
        } else {
            labelWidthMm = 40; // Content width reduced to 40mm to ensure safety within 110mm media
        }

        const printConfig = { ...config, widthMm: labelWidthMm };

        return (
            <div ref={ref} className="print-layout-container" style={{ position: 'absolute', top: '-10000px', left: '-10000px', pointerEvents: 'none' }}>
                <style>{`
                    @page {
                        size: ${pageW} ${pageH};
                        margin: 0;
                    }

                    @media print {
                        html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            background-color: white !important;
                        }

                        .print-layout-container {
                            position: static !important;
                            display: block !important;
                            visibility: visible !important;
                            width: auto !important;
                            height: auto !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }

                        .print-page {
                            width: ${pageW} !important;
                            height: ${pageH} !important;
                            overflow: hidden !important;
                            page-break-after: always !important;
                            break-after: page !important;
                            box-sizing: border-box !important;
                            display: block !important;
                            margin: 0 !important;
                            padding: ${paddingStr} !important;
                            background-color: white !important;
                        }

                        .print-grid {
                            display: grid !important;
                            grid-template-columns: 40mm 40mm !important; 
                            column-gap: 16mm !important;
                            row-gap: 2mm !important;
                            width: 100% !important;
                        }

                        .print-label-cell {
                            width: 40mm !important;
                            height: ${config.heightMm}mm !important;
                            overflow: hidden !important;
                            display: block !important;
                            box-sizing: border-box !important;
                        }
                    }
                `}</style>
                <div>
                    {isA4
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

PrintLayout.displayName = 'PrintLayout';

export default PrintLayout;
