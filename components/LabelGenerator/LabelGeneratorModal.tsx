import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Product, PurchaseOrder } from '../../types';
import { CloseIcon, PrinterIcon, DownloadIcon, SearchIcon, TrashIcon } from '../icons';
import BarcodeLabel from './BarcodeLabel';
import PrintLayout from './PrintLayout';
import { generateZPL } from '../../utils/zplUtils';
import { useToast } from '../../contexts/ToastContext';

interface LabelGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    availableProducts: Product[]; // List of all products to search from
    preSelectedProducts?: Product[]; // Products selected from the table
    purchases?: PurchaseOrder[]; // For locator ID search
}

interface LabelConfig {
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

import { getCompanyInfo } from '../../services/mockApi';

const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
    <label className="flex items-center justify-between group cursor-pointer w-full py-1">
        <span className="text-[12px] text-gray-700 font-bold group-hover:text-primary transition-colors">{label}</span>
        <div
            onClick={() => onChange(!checked)}
            className={`relative w-9 h-5 transition-all duration-300 ease-in-out rounded-full shadow-inner border ${checked ? 'bg-primary border-primary' : 'bg-gray-100 border-gray-300'}`}
        >
            <div className={`absolute top-0.5 left-0.5 bg-white w-3.5 h-3.5 rounded-full shadow transition-all duration-300 ease-in-out transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
        </div>
    </label>
);

const LabelGeneratorModal: React.FC<LabelGeneratorModalProps> = ({ isOpen, onClose, availableProducts, preSelectedProducts = [], purchases = [] }) => {
    const { showToast } = useToast();
    const [selectedProducts, setSelectedProducts] = useState<Product[]>(preSelectedProducts);
    const [searchTerm, setSearchTerm] = useState('');
    const [companyName, setCompanyName] = useState('iStore Pro');
    const [config, setConfig] = useState<LabelConfig>({
        widthMm: 50,
        heightMm: 25,
        cols: 2,
        identifier: 'imei1',
        gapMm: 1,
        showPrice: true,
        showDescription: true,
        showStoreName: false,
        showBarcode: true
    });

    const componentRef = useRef<HTMLDivElement>(null);

    // Fetch company info for store name
    useEffect(() => {
        getCompanyInfo().then(info => {
            if (info?.name) setCompanyName(info.name);
        });
    }, []);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    // Enhanced Search & Auto-Add Logic
    useEffect(() => {
        if (!searchTerm.trim()) return;

        // Check for Purchase Locator ID match
        const matchingPurchase = purchases.find(p => p.locatorId.toLowerCase() === searchTerm.trim().toLowerCase());

        if (matchingPurchase) {
            const productsInPurchase = availableProducts.filter(p => p.purchaseOrderId === matchingPurchase.id);

            if (productsInPurchase.length > 0) {
                // Add unique products from this purchase
                const newProducts = productsInPurchase.filter(p =>
                    !selectedProducts.some(sp => sp.id === p.id)
                );

                if (newProducts.length > 0) {
                    setSelectedProducts(prev => [...prev, ...newProducts]);
                    showToast(`${newProducts.length} produtos da compra ${matchingPurchase.locatorId} adicionados!`, 'success');
                    setSearchTerm(''); // Clear to show the list
                } else {
                    showToast('Produtos desta compra já estão na lista.', 'info');
                }
            } else {
                // Fallback: if products aren't linked via purchaseOrderId, try finding by other means or notify
                // But in this system, products usually have purchaseOrderId if they came from stock entry.
                showToast('Nenhum produto em estoque encontrado para esta compra.', 'info');
            }
        }
    }, [searchTerm, purchases, availableProducts, selectedProducts, showToast]);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: 'Etiquetas_iStorePro',
        onAfterPrint: () => showToast('Impressão enviada!', 'success'),
    });

    const handleDownloadZPL = () => {
        const zpl = generateZPL(selectedProducts, config);
        const blob = new Blob([zpl], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `etiquetas_${new Date().toISOString().slice(0, 10)}.zpl`;
        a.click();
        window.URL.revokeObjectURL(url);
        showToast('Arquivo ZPL gerado!', 'success');
    };

    // Filter available products for search
    const searchResults = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const lower = searchTerm.toLowerCase().trim();

        return availableProducts.filter(p => {
            const modelMatch = (p.model || '').toLowerCase().includes(lower);
            const imeiMatch = (p.imei1 || '').includes(lower);
            const skuMatch = (p.sku || '').toLowerCase().includes(lower);
            const serialMatch = (p.serialNumber || '').toLowerCase().includes(lower);

            // Ensure barcodes is an array and check each
            const barcodeMatch = Array.isArray(p.barcodes) && p.barcodes.some(b => b.toLowerCase().includes(lower));

            return modelMatch || imeiMatch || skuMatch || serialMatch || barcodeMatch;
        }).slice(0, 10);
    }, [searchTerm, availableProducts]);

    const addProduct = (p: Product) => {
        if (selectedProducts.some(sp => sp.id === p.id)) {
            showToast('Produto já adicionado.', 'info');
            return;
        }
        setSelectedProducts([...selectedProducts, p]);
        setSearchTerm(''); // Clear search after add
    };

    const removeProduct = (index: number) => {
        const newDetails = [...selectedProducts];
        newDetails.splice(index, 1);
        setSelectedProducts(newDetails);
    };

    const clearAll = () => setSelectedProducts([]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-surface w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-border flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-2xl font-bold text-primary">Gerador de Etiquetas</h2>
                        <p className="text-sm text-muted">Configure e imprima etiquetas térmicas para seus produtos</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <CloseIcon className="h-6 w-6 text-gray-500" />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left: Controls & List */}
                    <div className="w-1/2 p-6 flex flex-col border-r border-border overflow-y-auto custom-scrollbar">

                        {/* Config & Customization Section - Adjusted per feedback */}
                        <div className="grid grid-cols-2 gap-4 mb-5">
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                                <h3 className="text-xs font-bold text-secondary uppercase tracking-widest">Configuração</h3>
                                <div>
                                    <label className="block text-[11px] font-black text-secondary uppercase tracking-tight mb-1">Tamanho</label>
                                    <select
                                        value={`${config.widthMm}x${config.heightMm}`}
                                        onChange={e => {
                                            const [w, h] = e.target.value.split('x').map(Number);
                                            setConfig({ ...config, widthMm: w, heightMm: h });
                                        }}
                                        className="w-full h-9 px-3 rounded-xl border border-gray-300 text-sm bg-gray-50 focus:ring-2 focus:ring-primary/20 outline-none"
                                    >
                                        <option value="50x25">50mm x 25mm</option>
                                        <option value="50x30">50mm x 30mm</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-secondary uppercase tracking-tight mb-1">Colunas</label>
                                    <div className="flex bg-gray-100 p-1 rounded-xl h-9">
                                        <button
                                            onClick={() => setConfig({ ...config, cols: 1 })}
                                            className={`flex-1 rounded-lg text-xs font-bold transition-all ${config.cols === 1 ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            1 Col
                                        </button>
                                        <button
                                            onClick={() => setConfig({ ...config, cols: 2 })}
                                            className={`flex-1 rounded-lg text-xs font-bold transition-all ${config.cols === 2 ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            2 Cols
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-secondary uppercase tracking-tight mb-1">Identificador</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['imei1', 'sku', 'serialNumber', 'ean'] as const).map(id => (
                                            <button
                                                key={id}
                                                onClick={() => setConfig({ ...config, identifier: id })}
                                                className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${config.identifier === id
                                                    ? 'bg-primary text-white border-primary shadow-sm'
                                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                                            >
                                                {id === 'imei1' ? 'IMEI' : id === 'sku' ? 'SKU' : id === 'ean' ? 'EAN' : 'Serial'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2">
                                <h3 className="text-xs font-bold text-secondary uppercase tracking-widest mb-1">Personalização</h3>
                                <div className="space-y-1">
                                    <Switch
                                        label="Nome da Loja"
                                        checked={config.showStoreName}
                                        onChange={v => setConfig({ ...config, showStoreName: v })}
                                    />
                                    <Switch
                                        label="Descrição"
                                        checked={config.showDescription}
                                        onChange={v => setConfig({ ...config, showDescription: v })}
                                    />
                                    <Switch
                                        label="Preço"
                                        checked={config.showPrice}
                                        onChange={v => setConfig({ ...config, showPrice: v })}
                                    />
                                    <Switch
                                        label="Código de barras"
                                        checked={config.showBarcode}
                                        onChange={v => setConfig({ ...config, showBarcode: v })}
                                    />
                                </div>
                                <div className="pt-2">
                                    <p className="text-[10px] text-primary/80 font-medium leading-tight bg-primary/5 p-2 rounded-lg border border-primary/10">
                                        Substituição automática se o identificador faltar.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Product Search */}
                        <div className="space-y-2 mb-4">
                            <h3 className="text-sm font-bold text-secondary uppercase tracking-wider">Produtos selecionados ({selectedProducts.length})</h3>
                            <div className="relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar produto, IMEI, SN ou código localizador de compras..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 h-10 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20"
                                />
                                {searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 max-h-48 overflow-y-auto z-10">
                                        {searchResults.map(p => {
                                            const availableIdentifier = p.imei1 || p.serialNumber || (Array.isArray(p.barcodes) ? p.barcodes[0] : (typeof p.barcodes === 'string' ? p.barcodes : '')) || p.sku || '-';
                                            return (
                                                <button
                                                    key={p.id}
                                                    onClick={() => addProduct(p)}
                                                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0 transition-colors"
                                                >
                                                    <div className="font-bold text-primary">{p.model}</div>
                                                    <div className="text-xs text-muted font-mono">{availableIdentifier}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Selected List */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            {selectedProducts.length === 0 ? (
                                <div className="text-center py-8 text-muted text-sm border-2 border-dashed border-gray-200 rounded-xl">
                                    Nenhum produto selecionado
                                </div>
                            ) : (
                                selectedProducts.map((p, idx) => (
                                    <div key={`${p.id}-${idx}`} className="flex items-center justify-between p-2 bg-white border border-gray-100 rounded-lg shadow-sm group">
                                        <div className="truncate flex-1">
                                            <div className="font-bold text-[13px] text-primary truncate leading-tight">{p.model}</div>
                                            <div className="text-[10px] text-muted font-mono leading-tight">
                                                {p.imei1 || p.serialNumber || (Array.isArray(p.barcodes) && p.barcodes[0]) || p.sku || '-'}
                                            </div>
                                        </div>
                                        <button onClick={() => removeProduct(idx)} className="ml-2 text-gray-300 hover:text-red-500 transition-colors">
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {selectedProducts.length > 0 && (
                            <button onClick={clearAll} className="text-xs text-red-500 font-medium mt-2 hover:underline self-start">
                                Remover todos
                            </button>
                        )}
                    </div>

                    {/* Right: Preview */}
                    <div className="w-1/2 bg-gray-100 flex flex-col relative overflow-hidden">
                        <div className="absolute top-4 right-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-gray-500 shadow-sm">
                            Pré-visualização ({config.cols} colunas)
                        </div>

                        <div className="flex-grow overflow-auto p-12 custom-scrollbar flex justify-center">
                            <div className="bg-gray-300 shadow-2xl h-fit w-fit"
                                style={{
                                    // Use calc to ensure exact symmetry. 
                                    // With border-box, width = labels + margins.
                                    // Increased margin to 4mm on each side (total 8mm) for better visualization
                                    width: `calc(${(config.widthMm * config.cols) + ((config.cols - 1) * config.gapMm)}mm + 8mm)`,
                                    display: 'grid',
                                    gridTemplateColumns: config.cols === 2 ? '1fr 1fr' : '1fr',
                                    gap: `${config.gapMm}mm`,
                                    alignContent: 'start',
                                    padding: '4mm', // Symmetric 4mm margin all around
                                    boxSizing: 'border-box'
                                }}>
                                {selectedProducts.length === 0 ? (
                                    <div className="col-span-full w-full h-full flex items-center justify-center text-gray-300 font-medium py-10">
                                        Adicione produtos para visualizar
                                    </div>
                                ) : (
                                    selectedProducts.map((p, idx) => (
                                        <div key={idx} className="outline outline-1 outline-dashed outline-gray-400/30">
                                            <BarcodeLabel product={p} config={config} storeName={companyName} />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="absolute bottom-6 left-0 right-0 px-8 flex justify-center gap-4">
                            <button
                                onClick={() => handleDownloadZPL()}
                                className="h-12 px-6 bg-white text-gray-700 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all border border-gray-200 shadow-lg active:scale-95"
                                disabled={selectedProducts.length === 0}
                            >
                                <DownloadIcon className="h-5 w-5" />
                                Baixar ZPL
                            </button>
                            <button
                                onClick={() => handlePrint()}
                                className="h-12 px-8 bg-gray-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-xl shadow-gray-900/20 active:scale-95"
                                disabled={selectedProducts.length === 0}
                            >
                                <PrinterIcon className="h-5 w-5" />
                                Imprimir
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hidden Print Layout */}
            <PrintLayout
                ref={componentRef}
                products={selectedProducts}
                config={config}
                storeName={companyName}
            />
        </div>
    );
};

export default LabelGeneratorModal;
