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

const getBarcodeValue = (product: Product, identifier: LabelConfig['identifier']): string => {
    let value = '';
    if (identifier === 'ean' && Array.isArray(product.barcodes) && product.barcodes.length > 0) value = product.barcodes[0];
    else if (identifier === 'sku' && product.sku) value = product.sku;
    else if (identifier === 'imei1' && product.imei1) value = product.imei1;
    else if (identifier === 'serialNumber' && product.serialNumber) value = product.serialNumber;

    if (!value) {
        value = (Array.isArray(product.barcodes) && product.barcodes.length > 0 ? product.barcodes[0] : '')
            || product.imei1 || product.serialNumber || product.sku;
    }
    const digits = value.replace(/\D/g, '');
    return digits.length >= 12 ? digits.slice(0, 13) : '7890000000000';
};

/**
 * Limpa o nome para evitar "FONES FONES" e outras repetições
 */
const getCleanDescription = (product: Product): string => {
    let model = product.model || '';
    let color = product.color || '';

    // Une tudo e remove palavras repetidas (case insensitive)
    const raw = `${model} ${color}`.toUpperCase();
    const words = raw.split(/\s+/);
    const uniqueWords = words.filter((word, index) => words.indexOf(word) === index);

    return uniqueWords.join(' ');
};

const BarcodeLabel: React.FC<BarcodeLabelProps> = ({ product, config }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!config.showBarcode || !svgRef.current) return;
        const value = getBarcodeValue(product, config.identifier);
        try {
            JsBarcode(svgRef.current, value, {
                format: 'EAN13',
                lineColor: '#000000',
                width: 1.2,
                height: 30,
                displayValue: true,
                fontSize: 14,
                font: 'monospace',
                margin: 0
            });
            if (svgRef.current) {
                const w = svgRef.current.getAttribute('width');
                const h = svgRef.current.getAttribute('height');
                if (w && h) {
                    svgRef.current.setAttribute('viewBox', `0 0 ${parseInt(w)} ${parseInt(h)}`);
                    svgRef.current.removeAttribute('width');
                    svgRef.current.removeAttribute('height');
                }
            }
        } catch (e) { console.error(e); }
    }, [product, config.identifier, config.showBarcode]);

    const description = getCleanDescription(product);

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                padding: '4mm 1mm 1mm 1mm', // Top padding (4mm)
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                color: '#000000',
                fontFamily: "'Arial', sans-serif",
                textTransform: 'uppercase'
            }}
        >
            {/* Descrição em 2 linhas sem repetição */}
            <div style={{
                fontSize: '6.5pt',
                fontWeight: 800,
                lineHeight: 1.1,
                textAlign: 'center',
                width: '100%',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                maxHeight: '7mm'
            }}>
                {description}
            </div>

            {/* Expansor para empurrar Barcode e Preço para baixo */}
            <div style={{ flexGrow: 1 }} />

            {/* Código de Barras */}
            {config.showBarcode && (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '1mm' }}>
                    <svg ref={svgRef} style={{ maxWidth: '100%', height: '10mm' }} />
                </div>
            )}

            {/* Preço em destaque no pé */}
            <div style={{ fontWeight: 900, fontSize: '11pt', textAlign: 'center', paddingBottom: '0.5mm' }}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
            </div>
        </div>
    );
};

export default BarcodeLabel;
