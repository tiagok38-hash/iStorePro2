import React, { useState, useMemo, useEffect } from 'react';
import { Product, StorageLocationParameter } from '../types.ts';
import { XCircleIcon, ArrowsUpDownIcon, SearchIcon, CubeIcon, MapPinIcon, DocumentDuplicateIcon } from './icons.tsx';
import { formatCurrency } from '../services/mockApi.ts';

interface StockComparisonModalProps {
    products: Product[];
    locations: StorageLocationParameter[];
    onClose: () => void;
}

interface GroupedProduct {
    key: string;
    model: string;
    condition: string;
    storage: string;
    color: string;
    brand: string;
    stock: number;
    identifiers: string[];
}

const StockComparisonModal: React.FC<StockComparisonModalProps> = ({ products, locations, onClose }) => {
    const [locationA, setLocationA] = useState<string>(locations[0]?.name || '');
    const [locationB, setLocationB] = useState<string>(locations[1]?.name || locations[0]?.name || '');
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'Todos' | 'Apple' | 'Variados'>('Todos');

    const handleGenerateList = () => {
        const previewWindow = window.open('', '_blank');
        if (!previewWindow) return;

        const html = `
            <!DOCTYPE html>
            <html lang="pt-br">
            <head>
                <meta charset="UTF-8">
                <title>Relatório de Comparação de Estoque</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.5; background: #fff; }
                    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; }
                    .header h1 { margin: 0; color: #1a1a1a; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.025em; }
                    .header p { margin: 5px 0 0; color: #6b7280; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; }
                    
                    .comparison-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
                    .column { display: flex; flex-direction: column; gap: 0; }
                    .column-header { background: #f8fafc; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 15px; }
                    .column-header h2 { margin: 0; font-size: 12px; font-weight: 900; color: #7c3aed; text-transform: uppercase; }
                    .column-header p { margin: 2px 0 0; font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase; }

                    .product-card { padding: 10px 0; border-bottom: 1px solid #f1f5f9; position: relative; page-break-inside: avoid; }
                    .brand { font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 2px; }
                    .model { font-size: 11px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; line-height: 1.2; width: 85%; }
                    .details { display: flex; gap: 6px; align-items: center; margin-top: 4px; }
                    .badge { font-size: 8px; font-weight: 900; text-transform: uppercase; padding: 1px 5px; border-radius: 4px; }
                    .badge-condition { background: #f0fdf4; color: #16a34a; }
                    .badge-variant { background: #f1f5f9; color: #475569; }
                    
                    .identifiers { font-size: 8px; color: #94a3b8; margin-top: 4px; font-weight: 600; text-transform: uppercase; }
                    .stock-badge { position: absolute; right: 0; top: 10px; font-weight: 900; color: #7c3aed; font-size: 16px; }
                    
                    @media print {
                        body { padding: 0; }
                        @page { margin: 1cm; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Comparação de Estoque</h1>
                    <p>${locationA} vs ${locationB} • FILTRO: ${typeFilter} • ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>

                <div class="comparison-grid">
                    <div class="column">
                        <div class="column-header">
                            <h2>Faltando em ${locationB}</h2>
                            <p>Existem em ${locationA} no momento</p>
                        </div>
                        ${filteredDiffA.map(item => `
                            <div class="product-card">
                                <span class="stock-badge">${item.stock}</span>
                                <div class="brand">${item.brand}</div>
                                <div class="model">${item.model}</div>
                                <div class="details">
                                    <span class="badge badge-condition">${item.condition}</span>
                                    ${item.storage ? `<span class="badge badge-variant">${item.storage}</span>` : ''}
                                    ${item.color ? `<span class="badge badge-variant">${item.color}</span>` : ''}
                                </div>
                                ${item.identifiers && item.identifiers.length > 0 ? `
                                    <div class="identifiers">
                                        ${item.identifiers.slice(0, 50).join(' • ')}${item.identifiers.length > 50 ? ' ...' : ''}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>

                    <div class="column">
                        <div class="column-header">
                            <h2>Faltando em ${locationA}</h2>
                            <p>Existem em ${locationB} no momento</p>
                        </div>
                        ${filteredDiffB.map(item => `
                            <div class="product-card">
                                <span class="stock-badge">${item.stock}</span>
                                <div class="brand">${item.brand}</div>
                                <div class="model">${item.model}</div>
                                <div class="details">
                                    <span class="badge badge-condition">${item.condition}</span>
                                    ${item.storage ? `<span class="badge badge-variant">${item.storage}</span>` : ''}
                                    ${item.color ? `<span class="badge badge-variant">${item.color}</span>` : ''}
                                </div>
                                ${item.identifiers && item.identifiers.length > 0 ? `
                                    <div class="identifiers">
                                        ${item.identifiers.slice(0, 50).join(' • ')}${item.identifiers.length > 50 ? ' ...' : ''}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </body>
            </html>
        `;

        previewWindow.document.write(html);
        previewWindow.document.close();
    };

    // Body scroll lock
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    // Helper to group and sum stock by variant with robust key normalization
    const getGroupedStock = (locationName: string) => {
        const grouped = new Map<string, GroupedProduct>();

        products
            .filter(p => {
                const matchesLocation = p.storageLocation === locationName && p.stock > 0;

                let matchesType = true;
                if (typeFilter === 'Apple') {
                    matchesType = (p.brand || '').toLowerCase().includes('apple');
                } else if (typeFilter === 'Variados') {
                    matchesType = !(p.brand || '').toLowerCase().includes('apple');
                }

                return matchesLocation && matchesType;
            })
            .forEach(p => {
                const model = (p.model || '').trim().replace(/\s+/g, ' ');
                const condition = (p.condition || '').trim();
                const storage = (p.storage || '').toString().trim();
                const color = (p.color || '').trim();
                const brand = (p.brand || '').trim();

                // Aggressive normalization helper
                const norm = (str: string) => str
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "") // Remove accents
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, ''); // Keep only alphanumeric

                const lowModel = model.toLowerCase();
                const normModel = norm(model);
                const normStorage = norm(storage.replace(/gb/i, ''));
                const normColor = norm(color);
                const normCondition = norm(condition);

                // Build a normalized key to avoid issues with naming inconsistencies (hyphens, accents, etc.)
                let keyParts = [normModel, normCondition];

                // Only add storage to key if it's not already clearly in the model name (comparing normalized versions)
                if (normStorage && !normModel.includes(normStorage)) {
                    keyParts.push(normStorage);
                }

                // Same for color
                if (normColor && !normModel.includes(normColor)) {
                    keyParts.push(normColor);
                }

                const key = keyParts.join('|');

                const existing = grouped.get(key);

                // Collect identifiers
                const ids: string[] = [];
                if (p.imei1) ids.push(`IMEI: ${p.imei1}`);
                if (p.imei2) ids.push(`IMEI 2: ${p.imei2}`);
                if (p.serialNumber) ids.push(`S/N: ${p.serialNumber}`);
                if (p.barcodes && p.barcodes.length > 0) ids.push(`EAN: ${p.barcodes.join(', ')}`);

                if (existing) {
                    existing.stock += p.stock;
                    if (ids.length > 0) {
                        existing.identifiers = Array.from(new Set([...existing.identifiers, ...ids]));
                    }
                } else {
                    grouped.set(key, {
                        key,
                        model,
                        condition,
                        storage,
                        color,
                        brand,
                        stock: p.stock,
                        identifiers: ids
                    });
                }
            });

        return grouped;
    };

    const stockA = useMemo(() => getGroupedStock(locationA), [products, locationA]);
    const stockB = useMemo(() => getGroupedStock(locationB), [products, locationB]);

    // Comparison Logic: Find what's in A but NOT in B (at all)
    const diffAtoB = useMemo(() => {
        const diff: GroupedProduct[] = [];
        stockA.forEach((item, key) => {
            if (!stockB.has(key)) {
                diff.push(item);
            }
        });
        return diff;
    }, [stockA, stockB]);

    // Comparison Logic: Find what's in B but NOT in A (at all)
    const diffBtoA = useMemo(() => {
        const diff: GroupedProduct[] = [];
        stockB.forEach((item, key) => {
            if (!stockA.has(key)) {
                diff.push(item);
            }
        });
        return diff;
    }, [stockA, stockB]);

    const filteredDiffA = useMemo(() => {
        if (!searchTerm) return diffAtoB;
        const lowSearch = searchTerm.toLowerCase();
        return diffAtoB.filter(item =>
            item.model.toLowerCase().includes(lowSearch) ||
            item.brand.toLowerCase().includes(lowSearch)
        );
    }, [diffAtoB, searchTerm]);

    const filteredDiffB = useMemo(() => {
        if (!searchTerm) return diffBtoA;
        const lowSearch = searchTerm.toLowerCase();
        return diffBtoA.filter(item =>
            item.model.toLowerCase().includes(lowSearch) ||
            item.brand.toLowerCase().includes(lowSearch)
        );
    }, [diffBtoA, searchTerm]);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-surface rounded-[40px] shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in border border-border" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="p-8 border-b border-border bg-gray-50/50 flex flex-col gap-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-black text-primary flex items-center gap-3 tracking-tight">
                                <div className="p-2 bg-primary/10 rounded-2xl">
                                    <ArrowsUpDownIcon className="h-6 w-6 text-primary" />
                                </div>
                                Comparador de Estoques
                            </h2>
                            <p className="text-sm text-muted font-medium mt-1">Identifique produtos que faltam entre suas unidades</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleGenerateList}
                                className="h-10 px-4 bg-primary text-white rounded-xl font-bold text-[11px] shadow-lg shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2 uppercase tracking-widest active:scale-95"
                            >
                                <DocumentDuplicateIcon className="h-5 w-5" />
                                Gerar Lista
                            </button>
                            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-all text-gray-400">
                                <XCircleIcon className="h-8 w-8" />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted flex items-center gap-2">
                                <MapPinIcon className="w-3 h-3" /> Unidade A (Origem)
                            </label>
                            <select
                                value={locationA}
                                onChange={(e) => setLocationA(e.target.value)}
                                className="w-full h-12 px-4 rounded-2xl border-2 border-border bg-white text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                            >
                                {locations.map(loc => (
                                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted flex items-center gap-2">
                                <MapPinIcon className="w-3 h-3" /> Unidade B (Destino)
                            </label>
                            <select
                                value={locationB}
                                onChange={(e) => setLocationB(e.target.value)}
                                className="w-full h-12 px-4 rounded-2xl border-2 border-border bg-white text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                            >
                                {locations.map(loc => (
                                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                <SearchIcon className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Filtrar por nome..."
                                className="w-full h-12 pl-12 pr-4 rounded-2xl border-2 border-border bg-white text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-gray-400"
                            />
                        </div>

                        <div className="md:col-span-3 flex justify-center mt-2">
                            <div className="bg-gray-100/50 p-1.5 rounded-2xl border border-border flex gap-1 shadow-inner">
                                {(['Todos', 'Apple', 'Variados'] as const).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setTypeFilter(type)}
                                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${typeFilter === type
                                            ? 'bg-primary text-white shadow-lg'
                                            : 'text-muted hover:bg-gray-200/50'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-x divide-border">

                    {/* Column A -> B */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                        <div className="p-6 bg-blue-50/30 border-b border-border">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-black text-blue-700 uppercase tracking-wider flex items-center gap-2">
                                    Faltando em <span className="underline decoration-2 underline-offset-4">{locationB}</span>
                                </h3>
                                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black">{filteredDiffA.length} modelos</span>
                            </div>
                            <p className="text-[10px] text-blue-600/70 font-bold mt-1 uppercase">Existem em {locationA} mas não em {locationB}</p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {filteredDiffA.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100 italic text-muted">
                                    <CubeIcon className="w-12 h-12 text-gray-200 mb-3" />
                                    <p className="text-sm">Nada exclusivo em {locationA}</p>
                                </div>
                            ) : (
                                filteredDiffA.map(item => (
                                    <div key={item.key} className="p-4 bg-white border border-border rounded-2xl shadow-sm hover:border-primary transition-all group">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-black text-gray-900 leading-tight uppercase tracking-tighter">{item.brand} {item.model}</h4>
                                                <div className="flex items-center gap-x-2 gap-y-1 mt-1 flex-wrap">
                                                    <span className="text-[10px] font-black text-success uppercase whitespace-nowrap">{item.condition}</span>
                                                    {item.storage && !item.model.toLowerCase().includes(item.storage.toLowerCase().replace('gb', '').trim()) && (
                                                        <span className="text-[10px] font-black text-muted uppercase whitespace-nowrap">
                                                            {item.storage.toLowerCase().includes('gb') ? item.storage : `${item.storage}GB`}
                                                        </span>
                                                    )}
                                                    {item.color && !item.model.toLowerCase().includes(item.color.toLowerCase()) && (
                                                        <span className="text-[10px] font-black text-muted uppercase whitespace-nowrap">{item.color}</span>
                                                    )}
                                                    {item.identifiers && item.identifiers.length > 0 && (
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-2">
                                                            <span className="text-gray-300">|</span>
                                                            <span className="line-clamp-1">{item.identifiers.join(' • ')}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[8px] font-black text-muted uppercase">Estoque em {locationA}</p>
                                                <p className="text-lg font-black text-primary">{item.stock}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Column B -> A */}
                    <div className="flex-1 overflow-hidden flex flex-col bg-gray-50/10">
                        <div className="p-6 bg-purple-50/30 border-b border-border">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-black text-purple-700 uppercase tracking-wider flex items-center gap-2">
                                    Faltando em <span className="underline decoration-2 underline-offset-4">{locationA}</span>
                                </h3>
                                <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-[10px] font-black">{filteredDiffB.length} modelos</span>
                            </div>
                            <p className="text-[10px] text-purple-600/70 font-bold mt-1 uppercase">Existem em {locationB} mas não em {locationA}</p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {filteredDiffB.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100 italic text-muted">
                                    <CubeIcon className="w-12 h-12 text-gray-200 mb-3" />
                                    <p className="text-sm">Nada exclusivo em {locationB}</p>
                                </div>
                            ) : (
                                filteredDiffB.map(item => (
                                    <div key={item.key} className="p-4 bg-white border border-border rounded-2xl shadow-sm hover:border-primary transition-all group">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-black text-gray-900 leading-tight uppercase tracking-tighter">{item.brand} {item.model}</h4>
                                                <div className="flex items-center gap-x-2 gap-y-1 mt-1 flex-wrap">
                                                    <span className="text-[10px] font-black text-success uppercase whitespace-nowrap">{item.condition}</span>
                                                    {item.storage && !item.model.toLowerCase().includes(item.storage.toLowerCase().replace('gb', '').trim()) && (
                                                        <span className="text-[10px] font-black text-muted uppercase whitespace-nowrap">
                                                            {item.storage.toLowerCase().includes('gb') ? item.storage : `${item.storage}GB`}
                                                        </span>
                                                    )}
                                                    {item.color && !item.model.toLowerCase().includes(item.color.toLowerCase()) && (
                                                        <span className="text-[10px] font-black text-muted uppercase whitespace-nowrap">{item.color}</span>
                                                    )}
                                                    {item.identifiers && item.identifiers.length > 0 && (
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-2">
                                                            <span className="text-gray-300">|</span>
                                                            <span className="line-clamp-1">{item.identifiers.join(' • ')}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[8px] font-black text-muted uppercase">Estoque em {locationB}</p>
                                                <p className="text-lg font-black text-primary">{item.stock}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Tips */}
                <div className="p-4 bg-gray-50 border-t border-border flex justify-center">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                        💡 Dica: Verifique a condição para garantir que a transferência seja do modelo correto.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StockComparisonModal;
