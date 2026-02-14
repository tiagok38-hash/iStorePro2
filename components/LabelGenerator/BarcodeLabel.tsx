import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Product } from '../../types';

interface LabelConfig {
    widthMm: number;
    heightMm: number;
    identifier: 'sku' | 'imei1' | 'serialNumber' | 'ean';
    showPrice: boolean;
    showDescription: boolean;
    showStoreName: boolean;
    showBarcode: boolean;
}

interface BarcodeLabelProps {
    product: Product;
    config: LabelConfig;
    storeName?: string;
}

const BarcodeLabel: React.FC<BarcodeLabelProps> = ({ product, config, storeName = 'iStore Pro' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Adaptive sizing logic
    const getStoreNameFontSize = (name: string) => {
        if (name.length > 25) return '8px';
        if (name.length > 15) return '9px';
        return '10px';
    };

    const getDescriptionFontSize = (desc: string) => {
        if (desc.length > 60) return '7px';
        if (desc.length > 40) return '8px';
        return '9px';
    };

    const getBarcodeConfig = (value: string) => {
        // CODE128 width varies by character count
        // Reduced widths by ~4% to increase side margins
        if (value.length > 20) return { width: 0.77, fontSize: 8 };
        if (value.length > 15) return { width: 0.86, fontSize: 8 };
        if (value.length > 12) return { width: 0.96, fontSize: 8 };
        return { width: 1.15, fontSize: 9 };
    };

    useEffect(() => {
        // Only run if showBarcode is true AND canvas exists
        if (config.showBarcode && canvasRef.current) {
            // Fallback logic: prioritize selected identifier, but use whatever is available if missing
            let value = '';

            if (config.identifier === 'sku' && product.sku) value = product.sku;
            else if (config.identifier === 'imei1' && product.imei1) value = product.imei1;
            else if (config.identifier === 'serialNumber' && product.serialNumber) value = product.serialNumber;
            else if (config.identifier === 'ean' && Array.isArray(product.barcodes) && product.barcodes.length > 0) value = product.barcodes[0];

            // If selected is missing, find first available
            if (!value) {
                value = product.imei1 || product.serialNumber || product.sku || (Array.isArray(product.barcodes) && product.barcodes.length > 0 ? product.barcodes[0] : '');
            }

            // Fallback if empty
            if (!value || value.trim() === '') value = 'INVALID';

            const bConfig = getBarcodeConfig(value);

            try {
                JsBarcode(canvasRef.current, value, {
                    format: "CODE128",
                    lineColor: "#000",
                    width: bConfig.width,
                    height: 25, // Height in px
                    displayValue: true,
                    fontSize: bConfig.fontSize,
                    margin: 0,
                    textMargin: 1,
                    fontOptions: "bold",
                    flat: true
                });
            } catch (e) {
                console.error("Invalid barcode value", value, e);
            }
        }
    }, [product, config.identifier, config.showBarcode]); // Added showBarcode to dependencies

    // Calculate dimensions in px (approx 3.78 px per mm)
    const widthStyle = `${config.widthMm}mm`;
    const heightStyle = `${config.heightMm}mm`;

    const fullDescription = `${product.model || ''} ${product.storage || ''} ${product.condition && product.condition !== 'Novo' ? product.condition : ''}`.trim().replace(/\s+/g, ' ');

    return (
        <div
            className="flex flex-col items-center justify-between bg-white text-black overflow-hidden border border-gray-100/50 print:border-none uppercase"
            style={{
                width: widthStyle,
                height: heightStyle,
                padding: '1.2mm',
                pageBreakInside: 'avoid',
                boxSizing: 'border-box'
            }}
        >
            <div className="w-full flex flex-col items-center gap-0.5">
                {/* Header */}
                {config.showStoreName && (
                    <div
                        className="font-bold leading-none truncate w-full text-center"
                        style={{ fontSize: getStoreNameFontSize(storeName) }}
                    >
                        {storeName}
                    </div>
                )}

                {/* Product Name */}
                {config.showDescription && (
                    <div
                        className="font-semibold leading-[1.1] text-center w-full px-1 line-clamp-2 flex items-center justify-center overflow-hidden"
                        style={{
                            fontSize: getDescriptionFontSize(fullDescription),
                            height: config.showBarcode ? '18px' : '22px' // Fixed height instead of min-height to prevent overlap
                        }}
                    >
                        {fullDescription}
                    </div>
                )}
            </div>

            {/* Barcode */}
            {config.showBarcode && (
                <div className="flex-grow flex items-center justify-center w-full overflow-hidden px-3">
                    <canvas ref={canvasRef} className="max-w-full" />
                </div>
            )}

            {/* Price */}
            {config.showPrice && (
                <div className="text-[12px] font-black leading-none mt-auto">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                </div>
            )}
        </div>
    );
};

export default BarcodeLabel;
