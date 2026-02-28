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

// Helper: resolve barcode value from product
const getBarcodeValue = (product: Product, identifier: LabelConfig['identifier']): string => {
    let value = '';
    if (identifier === 'sku' && product.sku) value = product.sku;
    else if (identifier === 'imei1' && product.imei1) value = product.imei1;
    else if (identifier === 'serialNumber' && product.serialNumber) value = product.serialNumber;
    else if (identifier === 'ean' && Array.isArray(product.barcodes) && product.barcodes.length > 0) value = product.barcodes[0];

    // Fallback: use first available
    if (!value) {
        value = product.imei1
            || product.serialNumber
            || product.sku
            || (Array.isArray(product.barcodes) && product.barcodes.length > 0 ? product.barcodes[0] : '');
    }

    return value && value.trim() !== '' ? value.trim() : 'INVALID';
};

const BarcodeLabel: React.FC<BarcodeLabelProps> = ({ product, config, storeName = 'iStore Pro' }) => {
    // SVG ref for JsBarcode — vector rendering, no raster/blurring.
    const svgRef = useRef<SVGSVGElement>(null);

    // Adaptive font sizes — using pt for print accuracy
    const getStoreNameFontSize = (name: string): string => {
        if (name.length > 25) return '7pt';
        if (name.length > 15) return '8pt';
        return '9pt';
    };

    const getDescriptionFontSize = (desc: string): string => {
        if (desc.length > 60) return '6pt';
        if (desc.length > 40) return '7pt';
        return '8pt';
    };

    useEffect(() => {
        if (!config.showBarcode || !svgRef.current) return;

        const value = getBarcodeValue(product, config.identifier);

        try {
            // JsBarcode with SVG target — fully vector, no pixel scaling.
            // Width is the bar width in px at 96dpi screen / translates to physical mm via SVG viewBox.
            // For CODE128, 1px bar width ~= 0.353mm at 72dpi. We target ~38mm total barcode width.
            // JsBarcode auto-calculates the SVG width based on character count * bar width.
            JsBarcode(svgRef.current, value, {
                format: 'CODE128',
                lineColor: '#000000',
                width: 1.5,
                height: 52,
                displayValue: true,
                fontSize: 10,
                fontOptions: 'bold',
                font: 'monospace',
                textMargin: 2,
                margin: 0,
                flat: false,
                background: '#ffffff',
            });
            // Force responsive scaling by setting viewBox to match generated dimensions
            if (svgRef.current) {
                const w = svgRef.current.getAttribute('width');
                const h = svgRef.current.getAttribute('height');
                if (w && h) {
                    svgRef.current.setAttribute('viewBox', `0 0 ${w} ${h}`);
                    // Let CSS width: 100% take over, but remove fixed width/height attributes
                    svgRef.current.removeAttribute('width');
                    svgRef.current.removeAttribute('height');
                }
            }
        } catch (e) {
            console.error('JsBarcode error:', value, e);
        }
    }, [product, config.identifier, config.showBarcode]);

    const fullDescription = [
        product.model || '',
        product.storage || '',
        product.condition && product.condition !== 'Novo' ? product.condition : '',
    ]
        .join(' ')
        .trim()
        .replace(/\s+/g, ' ');

    return (
        <div
            style={{
                // CRITICAL: all dimensions in mm — no percentages, no px for layout.
                width: `${config.widthMm}mm`,
                height: `${config.heightMm}mm`,
                padding: '1.5mm',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#ffffff',
                color: '#000000',
                overflow: 'hidden',
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
                // NO transform, NO scale — physical mm layout must be respected by browser print engine.
                textTransform: 'uppercase',
                fontFamily: 'Arial, Helvetica, sans-serif',
            }}
        >
            {/* === TOP SECTION: Store + Description === */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5mm' }}>
                {config.showStoreName && (
                    <div
                        style={{
                            fontSize: getStoreNameFontSize(storeName),
                            fontWeight: 900,
                            lineHeight: 1,
                            textAlign: 'center',
                            width: '100%',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {storeName}
                    </div>
                )}

                {config.showDescription && (
                    <div
                        style={{
                            fontSize: getDescriptionFontSize(fullDescription),
                            fontWeight: 700,
                            lineHeight: 1.15,
                            textAlign: 'center',
                            width: '100%',
                            // Fixed height to prevent overflow into barcode zone
                            maxHeight: config.showBarcode ? '9mm' : '14mm',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 2,
                        }}
                    >
                        {fullDescription}
                    </div>
                )}
            </div>

            {/* === MIDDLE SECTION: Barcode SVG === */}
            {config.showBarcode && (
                <div
                    style={{
                        width: '100%',
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        // Horizontal padding to give side margins inside the label
                        paddingLeft: '2mm',
                        paddingRight: '2mm',
                        minHeight: '14mm',
                        overflow: 'hidden',
                    }}
                >
                    {/*
                     * SVG element: JsBarcode renders directly into this <svg>.
                     * width: 100% makes it fill the available label width (enforced by mm container above).
                     * height: 100% fills the flex container.
                     * NO transform/scale on this element — physical sizing is handled by the parent mm container.
                     * print-color-adjust ensures black bars are printed exactly.
                     */}
                    <svg
                        ref={svgRef}
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'block',
                            // Critical: prevent browser from removing color in print
                            printColorAdjust: 'exact',
                            WebkitPrintColorAdjust: 'exact',
                            colorAdjust: 'exact',
                            // No transform, no scale
                            transform: 'none',
                        } as React.CSSProperties}
                    />
                </div>
            )}

            {/* === BOTTOM SECTION: Price === */}
            {config.showPrice && (
                <div
                    style={{
                        fontSize: '10pt',
                        fontWeight: 900,
                        lineHeight: 1,
                        textAlign: 'center',
                        marginTop: 'auto',
                    }}
                >
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                </div>
            )}
        </div>
    );
};

export default BarcodeLabel;
