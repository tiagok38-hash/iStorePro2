import React from 'react';
import { Product } from '../../types';
import BarcodeLabel from './BarcodeLabel';

interface LabelConfig {
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

// Ensure forwardRef is used so react-to-print can grab the component
const PrintLayout = React.forwardRef<HTMLDivElement, PrintLayoutProps>(({ products, config, storeName }, ref) => {

    // Total page width calculation (approximate for on-screen preview)
    // For print, the @page css handles the physical size
    const pageWidthMm = (config.widthMm * config.cols) + ((config.cols - 1) * (config.gapMm || 2));

    return (
        <div className="print-layout-container" style={{ display: 'none' }}> {/* Hidden normally, only for print */}
            <style>
                {`
                    @media print {
                        @page {
                            size: ${pageWidthMm}mm ${config.heightMm}mm;
                            margin: 0;
                        }
                        body {
                            margin: 0;
                            padding: 0;
                            -webkit-print-color-adjust: exact;
                        }
                        .print-layout-container {
                            display: block !important;
                            width: ${pageWidthMm}mm;
                        }
                    }
                `}
            </style>

            <div ref={ref} className="w-full flex flex-wrap content-start">
                {products.map((product, idx) => (
                    <div
                        key={`${product.id}-${idx}`}
                        style={{
                            width: `${config.widthMm}mm`,
                            marginBottom: '0mm', // Continuous roll usually has no vertical margin between labels needed in HTML if page size is set correctly
                            // However, sometimes a tiny margin helps align
                            marginRight: (config.cols === 2 && idx % 2 === 0) ? `${config.gapMm || 2}mm` : '0',
                            pageBreakInside: 'avoid'
                        }}
                    >
                        <BarcodeLabel product={product} config={config} storeName={storeName} />
                    </div>
                ))}
            </div>
        </div>
    );
});

export default PrintLayout;
