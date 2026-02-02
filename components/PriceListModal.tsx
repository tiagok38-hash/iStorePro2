import React, { useState, useEffect, useMemo } from 'react';
import { Product, Category, Brand, ProductModel, ProductConditionParameter, StorageLocationParameter } from '../types.ts';
import { getCategories, getBrands, getProductModels, getProductConditions, getStorageLocations, formatCurrency } from '../services/mockApi.ts';
import { CloseIcon, AppleIcon, SmartphoneIcon, DocumentTextIcon, CheckIcon, ChevronRightIcon, ChevronLeftIcon } from './icons.tsx';

interface PriceListModalProps {
    isOpen: boolean;
    onClose: () => void;
    products: Product[];
}

const PriceListModal: React.FC<PriceListModalProps> = ({ isOpen, onClose, products }) => {
    const [step, setStep] = useState<'type' | 'filters'>('type');
    const [selectedType, setSelectedType] = useState<'apple' | 'other' | null>(null);

    // Metadata
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [models, setModels] = useState<ProductModel[]>([]);
    const [conditions, setConditions] = useState<ProductConditionParameter[]>([]);
    const [locations, setLocations] = useState<StorageLocationParameter[]>([]);

    // Selection State
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [selectedStorages, setSelectedStorages] = useState<string[]>([]);
    const [selectedColors, setSelectedColors] = useState<string[]>([]);
    const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
    const [selectedPriceTypes, setSelectedPriceTypes] = useState<string[]>(['sale']);
    const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

    // Toggles
    const [showStockQty, setShowStockQty] = useState(false);
    const [showBatteryHealth, setShowBatteryHealth] = useState(false);
    const [showStockLocation, setShowStockLocation] = useState(false);
    const [groupIdentical, setGroupIdentical] = useState(true);
    const [sortBy, setSortBy] = useState<'model' | 'price_asc' | 'price_desc'>('model');

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [cats, brs, mods, conds, locs] = await Promise.all([
                    getCategories(),
                    getBrands(),
                    getProductModels(),
                    getProductConditions(),
                    getStorageLocations()
                ]);
                setCategories(cats);
                setBrands(brs);
                setModels(mods);
                setConditions(conds);
                setLocations(locs);
            } catch (error) {
                console.error("Failed to fetch metadata for PriceListModal:", error);
            }
        };
        fetchMetadata();
    }, []);

    const availableProducts = useMemo(() => {
        return products
            .filter(p => p.stock > 0)
            .map(p => {
                const cat = categories.find(c => c.id === p.category);
                if (cat) return { ...p, category: cat.name };
                return p;
            });
    }, [products, categories]);

    const appleProducts = useMemo(() => {
        return availableProducts.filter(p => (p.brand || '').toLowerCase().includes('apple'));
    }, [availableProducts]);

    const otherProducts = useMemo(() => {
        return availableProducts.filter(p => !(p.brand || '').toLowerCase().includes('apple'));
    }, [availableProducts]);

    const filteredForStep = useMemo(() => {
        let base = selectedType === 'apple' ? appleProducts : otherProducts;

        if (selectedType === 'apple') {
            if (selectedCategories.length > 0) {
                base = base.filter(p => selectedCategories.some(cat => cat.toLowerCase().trim() === (p.category || '').toLowerCase().trim()));
            }
            if (selectedConditions.length > 0) {
                base = base.filter(p => selectedConditions.some(cond => cond.toLowerCase().trim() === (p.condition || '').toLowerCase().trim()));
            }
            if (selectedModels.length > 0) {
                base = base.filter(p => selectedModels.some(mod => mod.toLowerCase().trim() === (p.model || '').toLowerCase().trim()));
            }
            if (selectedStorages.length > 0) {
                base = base.filter(p => selectedStorages.includes(p.storage?.toString() || ''));
            }
            if (selectedColors.length > 0) {
                base = base.filter(p => selectedColors.some(color => color.toLowerCase().trim() === (p.color || '').toLowerCase().trim()));
            }
        } else {
            if (selectedBrands.length > 0) {
                base = base.filter(p => selectedBrands.some(brand => brand.toLowerCase().trim() === (p.brand || '').toLowerCase().trim()));
            }
            if (selectedCategories.length > 0) {
                base = base.filter(p => selectedCategories.some(cat => cat.toLowerCase().trim() === (p.category || '').toLowerCase().trim()));
            }
            if (selectedModels.length > 0) {
                base = base.filter(p => selectedModels.some(mod => mod.toLowerCase().trim() === (p.model || '').toLowerCase().trim()));
            }
            if (selectedConditions.length > 0) {
                base = base.filter(p => selectedConditions.some(cond => cond.toLowerCase().trim() === (p.condition || '').toLowerCase().trim()));
            }
        }

        if (showStockLocation && selectedLocationId) {
            const locationName = locations.find(l => l.id === selectedLocationId)?.name;
            if (locationName) {
                base = base.filter(p => p.storageLocation === locationName);
            }
        }

        return base;
    }, [selectedType, appleProducts, otherProducts, selectedCategories, selectedConditions, selectedModels, selectedStorages, selectedColors, selectedBrands, showStockLocation, selectedLocationId, locations]);

    const hasActiveFilters = useMemo(() => {
        if (selectedType === 'apple') {
            return selectedCategories.length > 0 ||
                selectedConditions.length > 0 ||
                selectedModels.length > 0 ||
                selectedStorages.length > 0 ||
                selectedColors.length > 0 ||
                showStockLocation;
        } else {
            return selectedBrands.length > 0 ||
                selectedCategories.length > 0 ||
                selectedModels.length > 0 ||
                selectedConditions.length > 0 ||
                showStockLocation;
        }
    }, [selectedType, selectedCategories, selectedConditions, selectedModels, selectedStorages, selectedColors, selectedBrands, showStockLocation]);

    // Options for dynamic filters
    const currentCategories = useMemo(() => {
        const base = selectedType === 'apple' ? appleProducts : otherProducts;
        const brandFiltered = selectedType === 'other' && selectedBrands.length > 0
            ? base.filter(p => selectedBrands.some(b => b.toLowerCase().trim() === (p.brand || '').toLowerCase().trim()))
            : base;
        return Array.from(new Set(brandFiltered.map(p => p.category).filter(Boolean))).sort();
    }, [selectedType, appleProducts, otherProducts, selectedBrands]);

    const currentModels = useMemo(() => {
        const base = selectedType === 'apple' ? appleProducts : otherProducts;
        let filtered = base;
        if (selectedCategories.length > 0) filtered = filtered.filter(p => selectedCategories.some(cat => cat.toLowerCase().trim() === (p.category || '').toLowerCase().trim()));
        if (selectedBrands.length > 0) filtered = filtered.filter(p => selectedBrands.some(brand => brand.toLowerCase().trim() === (p.brand || '').toLowerCase().trim()));
        if (selectedConditions.length > 0) filtered = filtered.filter(p => selectedConditions.some(cond => cond.toLowerCase().trim() === (p.condition || '').toLowerCase().trim()));
        return Array.from(new Set(filtered.map(p => p.model).filter(Boolean))).sort();
    }, [selectedType, appleProducts, otherProducts, selectedCategories, selectedBrands, selectedConditions]);

    const currentConditions = useMemo(() => {
        const base = selectedType === 'apple' ? appleProducts : otherProducts;
        return Array.from(new Set(base.map(p => p.condition))).sort();
    }, [selectedType, appleProducts, otherProducts]);

    const currentStorages = useMemo(() => {
        if (selectedType !== 'apple') return [];
        let filtered = appleProducts;
        if (selectedCategories.length > 0) filtered = filtered.filter(p => selectedCategories.includes(p.category));
        if (selectedConditions.length > 0) filtered = filtered.filter(p => selectedConditions.includes(p.condition));
        if (selectedModels.length > 0) filtered = filtered.filter(p => selectedModels.includes(p.model));
        return Array.from(new Set(filtered.map(p => p.storage?.toString() || '').filter(Boolean))).sort((a, b) => Number(a) - Number(b));
    }, [appleProducts, selectedModels, selectedType, selectedCategories, selectedConditions]);

    const currentColors = useMemo(() => {
        if (selectedType !== 'apple') return [];
        let filtered = appleProducts;
        if (selectedCategories.length > 0) filtered = filtered.filter(p => selectedCategories.includes(p.category));
        if (selectedConditions.length > 0) filtered = filtered.filter(p => selectedConditions.includes(p.condition));
        if (selectedModels.length > 0) filtered = filtered.filter(p => selectedModels.includes(p.model));
        return Array.from(new Set(filtered.map(p => p.color || '').filter(Boolean))).sort();
    }, [appleProducts, selectedModels, selectedType, selectedCategories, selectedConditions]);

    const currentBrands = useMemo(() => {
        if (selectedType !== 'other') return [];
        return Array.from(new Set(otherProducts.map(p => p.brand))).sort();
    }, [otherProducts, selectedType]);

    const handleBackToType = () => {
        setStep('type');
        setSelectedCategories([]);
        setSelectedConditions([]);
        setSelectedModels([]);
        setSelectedStorages([]);
        setSelectedColors([]);
        setSelectedBrands([]);
        setSelectedPriceTypes(['sale']);
        setSelectedLocationId(null);
        setShowStockLocation(false);
        setShowStockQty(false);
        setShowBatteryHealth(false);
    };

    const handleGenerate = () => {
        if (filteredForStep.length === 0) {
            alert('Nenhum produto encontrado com os filtros selecionados.');
            return;
        }

        let title = `LISTA DE PREÇOS - ${selectedType === 'apple' ? 'APPLE' : 'PRODUTOS'}`;
        if (showStockLocation && selectedLocationId) {
            const locName = locations.find(l => l.id === selectedLocationId)?.name;
            if (locName) title += ` [${locName.toUpperCase()}]`;
        }

        let text = `${title}\n`;
        let htmlPreview = `<strong>${title}</strong>\n`;
        text += `Gerada em: ${new Date().toLocaleString('pt-BR')}\n`;
        htmlPreview += `Gerada em: ${new Date().toLocaleString('pt-BR')}\n`;
        text += `==========================================\n\n`;
        htmlPreview += `==========================================\n\n`;

        let processingProducts = [...filteredForStep];

        // Group identical if requested
        if (groupIdentical) {
            const groupedMap: Record<string, Product> = {};
            processingProducts.forEach(p => {
                // Trim and lowercase key components for more robust grouping
                const m = (p.model || '').trim().toLowerCase();
                const c = (p.condition || '').trim().toLowerCase();
                const s = (p.storage || '').toString().trim().toLowerCase();
                const col = (p.color || '').trim().toLowerCase();
                const key = `${m}-${c}-${s}-${col}`;

                if (!groupedMap[key]) {
                    groupedMap[key] = { ...p };
                } else {
                    groupedMap[key].stock += p.stock;
                }
            });
            processingProducts = Object.values(groupedMap);
        }

        const totals = processingProducts.reduce((acc, p) => {
            acc.items += p.stock;
            acc.cost += (p.costPrice || 0) * p.stock;
            acc.wholesale += (p.wholesalePrice || 0) * p.stock;
            acc.sale += (p.price || 0) * p.stock;
            return acc;
        }, { items: 0, cost: 0, wholesale: 0, sale: 0 });

        const showCost = selectedPriceTypes.includes('cost') || selectedPriceTypes.includes('all');
        const showWholesale = selectedPriceTypes.includes('wholesale') || selectedPriceTypes.includes('all');
        const showSale = selectedPriceTypes.includes('sale') || selectedPriceTypes.includes('all');

        let grandTotal = 0;
        if (showCost) grandTotal += totals.cost;
        if (showWholesale) grandTotal += totals.wholesale;
        if (showSale) grandTotal += totals.sale;

        // Grouping for categories/brands
        const groups: Record<string, Product[]> = {};
        const groupField = selectedType === 'apple' ? 'category' : 'brand';

        processingProducts.forEach(p => {
            let label = p[groupField] || 'Outros';
            if (p.condition) {
                label += ` ${p.condition}`;
            }
            if (!groups[label]) groups[label] = [];
            groups[label].push(p);
        });

        Object.keys(groups).sort().forEach((label, index) => {
            // Divider between groups
            if (index > 0) {
                text += `------------------------------------------\n`;
                htmlPreview += `------------------------------------------\n`;
            }

            text += `📍 ${label.toUpperCase()}\n\n`;
            htmlPreview += `📍 <strong>${label.toUpperCase()}</strong>\n\n`;

            groups[label].sort((a, b) => {
                if (sortBy === 'price_asc') return a.price - b.price;
                if (sortBy === 'price_desc') return b.price - a.price;
                return a.model.localeCompare(b.model);
            }).forEach(p => {
                let pName = p.model;
                if (p.storage && !p.model.includes(p.storage.toString())) pName += ` ${p.storage}GB`;
                if (p.color && !p.model.toLowerCase().includes(p.color.toLowerCase())) pName += ` (${p.color})`;

                let line = `• ${pName}`;
                let htmlLine = `• <strong>${pName}</strong>`;

                const isNew = (p.condition || '').toLowerCase().trim() === 'novo';
                if (showBatteryHealth && p.batteryHealth && p.batteryHealth > 0 && !isNew) {
                    const healthStr = ` [🔋 ${p.batteryHealth}%]`;
                    line += healthStr;
                    htmlLine += healthStr;
                }

                if (showStockLocation && p.storageLocation && !selectedLocationId) {
                    const locStr = ` | Local: ${p.storageLocation}`;
                    line += locStr;
                    htmlLine += locStr;
                }

                if (showStockQty) {
                    const qtyStr = ` | Estoque: ${p.stock}`;
                    line += qtyStr;
                    htmlLine += qtyStr;
                }

                text += line + '\n';
                htmlPreview += htmlLine + '\n';

                const prices: string[] = [];
                if (showCost && p.costPrice) prices.push(`Custo: ${formatCurrency(p.costPrice)}`);
                if (showWholesale && p.wholesalePrice) prices.push(`Atacado: ${formatCurrency(p.wholesalePrice)}`);
                if (showSale && p.price) prices.push(`Venda: ${formatCurrency(p.price)}`);

                if (prices.length > 0) {
                    const priceLine = `  💰 ${prices.join(' | ')}\n`;
                    text += priceLine;
                    htmlPreview += priceLine;
                }
            });
        });

        const fileName = `relatorio_estoque_${selectedType}_${new Date().toISOString().split('T')[0]}.txt`;
        const previewWindow = window.open('', '_blank');

        if (previewWindow) {
            // Escape special characters for the template literal in the new window
            const escapedText = text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

            previewWindow.document.write(`
                <html>
                    <head>
                        <title>Relatório de Estoque e Preços</title>
                        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
                        <style>
                            body { 
                                font-family: 'Inter', sans-serif; 
                                padding: 20px; 
                                background: #f8fafc; 
                                display: flex; 
                                flex-direction: column; 
                                align-items: center; 
                                margin: 0;
                                color: #0f172a;
                            }
                            .header-bar {
                                position: sticky;
                                top: 0;
                                background: rgba(255, 255, 255, 0.9);
                                backdrop-filter: blur(10px);
                                width: 100%;
                                display: flex;
                                flex-direction: row;
                                align-items: center;
                                justify-content: center;
                                gap: 20px;
                                padding: 15px 0;
                                z-index: 100;
                                border-bottom: 1px solid rgba(226, 232, 240, 0.8);
                                margin-bottom: 30px;
                                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
                            }
                            .summary-grid {
                                display: flex;
                                flex-direction: row;
                                gap: 12px;
                            }
                            .summary-card {
                                background: white;
                                padding: 10px 18px;
                                border-radius: 14px;
                                border: 1px solid #e2e8f0;
                                text-align: center;
                                min-width: 140px;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                            }
                            .summary-label {
                                font-size: 9px;
                                font-weight: 800;
                                text-transform: uppercase;
                                color: #94a3b8;
                                letter-spacing: 0.8px;
                                margin-bottom: 2px;
                            }
                            .summary-value {
                                font-size: 15px;
                                font-weight: 800;
                                color: #1e293b;
                                font-family: 'Outfit', sans-serif;
                            }
                            .total-card {
                                background: #4f46e5;
                                border-color: #4f46e5;
                                box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.2);
                            }
                            .total-card .summary-label { color: rgba(255,255,255,0.7); }
                            .total-card .summary-value { color: white; }
                            
                            button { 
                                background: #0f172a; 
                                color: white; 
                                border: none; 
                                height: 58px;
                                padding: 0 32px;
                                border-radius: 16px;
                                font-weight: 800; 
                                cursor: pointer; 
                                font-size: 11px;
                                text-transform: uppercase;
                                letter-spacing: 1.2px;
                                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                                white-space: nowrap;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                gap: 10px;
                            }
                            button:hover { 
                                background: #1e293b;
                                transform: translateY(-2px);
                                box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                            }
                            button:active { transform: translateY(0); }
                            
                            .container { 
                                background: white; 
                                padding: 60px; 
                                border-radius: 32px; 
                                border: 1px solid #f1f5f9;
                                width: 100%; 
                                max-width: 850px; 
                                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.03);
                            }
                            pre { 
                                white-space: pre-wrap; 
                                word-wrap: break-word; 
                                font-family: 'Outfit', sans-serif;
                                font-size: 16px; 
                                line-height: 1.7; 
                                color: #334155; 
                                margin: 0;
                                font-weight: 400;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header-bar">
                            <div class="summary-grid">
                                <div class="summary-card">
                                    <div class="summary-label">Modelos</div>
                                    <div class="summary-value">${processingProducts.length}</div>
                                </div>
                                <div class="summary-card">
                                    <div class="summary-label">Total de Produtos</div>
                                    <div class="summary-value">${totals.items}</div>
                                </div>
                                ${showCost ? `
                                <div class="summary-card">
                                    <div class="summary-label">Total Custo</div>
                                    <div class="summary-value">${formatCurrency(totals.cost)}</div>
                                </div>
                                ` : ''}
                                ${showWholesale ? `
                                <div class="summary-card">
                                    <div class="summary-label">Total Atacado</div>
                                    <div class="summary-value">${formatCurrency(totals.wholesale)}</div>
                                </div>
                                ` : ''}
                                ${showSale ? `
                                <div class="summary-card">
                                    <div class="summary-label">Total Venda</div>
                                    <div class="summary-value">${formatCurrency(totals.sale)}</div>
                                </div>
                                ` : ''}
                                <div class="summary-card total-card">
                                    <div class="summary-label">Total Geral</div>
                                    <div class="summary-value">${formatCurrency(grandTotal)}</div>
                                </div>
                            </div>
                            <button id="saveBtn"><span>💾</span> SALVAR RELATÓRIO (.TXT)</button>
                        </div>
                        <div class="container">
                            <pre>${htmlPreview}</pre>
                        </div>
                        <script>
                            document.getElementById('saveBtn').addEventListener('click', () => {
                                const content = \`${escapedText}\`;
                                const blob = new Blob([content], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = '${fileName}';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                            });
                        </script>
                    </body>
                </html>
            `);
            previewWindow.document.close();
        }
    };

    const toggleSelection = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
        if (list.includes(item)) {
            setList(list.filter(i => i !== item));
        } else {
            setList([...list, item]);
        }
    };

    if (!isOpen) return null;

    const totalUnits = filteredForStep.reduce((acc, p) => acc + p.stock, 0);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-surface w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-white/20 animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-border bg-gradient-to-r from-indigo-600/5 to-purple-600/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                            <DocumentTextIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-800 tracking-tight">Gerar Lista de Preços</h2>
                            <p className="text-xs text-muted font-medium uppercase tracking-widest">Baseado no estoque atual</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <CloseIcon className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {step === 'type' ? (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-bold text-gray-800">Qual o foco da sua lista?</h3>
                                <p className="text-gray-500">Selecione o tipo de produto para continuar</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <button
                                    onClick={() => { setSelectedType('apple'); setStep('filters'); }}
                                    className="group relative p-8 rounded-3xl border-2 border-transparent bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 transition-all duration-300 text-left"
                                >
                                    <div className="p-4 bg-white rounded-2xl shadow-sm mb-4 inline-block group-hover:scale-110 transition-transform">
                                        <AppleIcon className="w-10 h-10 text-gray-800" />
                                    </div>
                                    <h4 className="text-xl font-black text-gray-800 mb-1">Produtos Apple</h4>
                                    <p className="text-sm text-gray-500">iPhones, iPads, MacBooks, Apple Watch, etc.</p>
                                    <div className="absolute top-8 right-8 text-indigo-200 group-hover:text-indigo-400 transition-colors">
                                        <ChevronRightIcon className="w-8 h-8" />
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setSelectedType('other'); setStep('filters'); }}
                                    className="group relative p-8 rounded-3xl border-2 border-transparent bg-gray-50 hover:bg-purple-50 hover:border-purple-200 transition-all duration-300 text-left"
                                >
                                    <div className="p-4 bg-white rounded-2xl shadow-sm mb-4 inline-block group-hover:scale-110 transition-transform">
                                        <SmartphoneIcon className="w-10 h-10 text-gray-800" />
                                    </div>
                                    <h4 className="text-xl font-black text-gray-800 mb-1">Outros Produtos</h4>
                                    <p className="text-sm text-gray-500">Xiaomi, Samsung, Acessórios e demais marcas.</p>
                                    <div className="absolute top-8 right-8 text-purple-200 group-hover:text-purple-400 transition-colors">
                                        <ChevronRightIcon className="w-8 h-8" />
                                    </div>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-between mb-4">
                                <button
                                    onClick={handleBackToType}
                                    className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                                >
                                    <ChevronLeftIcon className="w-4 h-4" />
                                    Voltar para seleção de tipo
                                </button>
                                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    {selectedType === 'apple' ? ' Apple' : '📱 Produtos variados (Nao Apple)'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                {/* Left Column: Core Filters */}
                                <div className="space-y-8">
                                    {/* Brands (Non-Apple only) */}
                                    {selectedType === 'other' && (
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-1 h-3 bg-purple-500 rounded-full"></div>
                                                Marcas
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {currentBrands.map(brand => (
                                                    brand && ( // Null safety check
                                                        <button
                                                            key={brand}
                                                            onClick={() => toggleSelection(selectedBrands, setSelectedBrands, brand)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedBrands.includes(brand)
                                                                ? 'bg-purple-600 text-white shadow-md'
                                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                }`}
                                                        >
                                                            {brand}
                                                        </button>
                                                    )
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Categories */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
                                            Categorias
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {currentCategories.map(cat => (
                                                <button
                                                    key={cat}
                                                    onClick={() => toggleSelection(selectedCategories, setSelectedCategories, cat)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedCategories.includes(cat)
                                                        ? 'bg-indigo-600 text-white shadow-md'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Conditions */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <div className="w-1 h-3 bg-emerald-500 rounded-full"></div>
                                            Condições
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {currentConditions.map(cond => (
                                                <button
                                                    key={cond}
                                                    onClick={() => toggleSelection(selectedConditions, setSelectedConditions, cond)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedConditions.includes(cond)
                                                        ? 'bg-emerald-600 text-white shadow-md'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {cond}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Models */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <div className="w-1 h-3 bg-orange-500 rounded-full"></div>
                                            Modelos
                                        </h4>
                                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                                            {currentModels.map(mod => (
                                                <button
                                                    key={mod}
                                                    onClick={() => toggleSelection(selectedModels, setSelectedModels, mod)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedModels.includes(mod)
                                                        ? 'bg-orange-600 text-white shadow-md'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {mod}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Detail Filters & Price */}
                                <div className="space-y-8">
                                    {selectedType === 'apple' && (
                                        <>
                                            {/* Store & Color */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-3">
                                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Armazenamento</h4>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {currentStorages.map(st => (
                                                            <button
                                                                key={st}
                                                                onClick={() => toggleSelection(selectedStorages, setSelectedStorages, st)}
                                                                className={`px-2 py-1 rounded text-[10px] font-black transition-all ${selectedStorages.includes(st)
                                                                    ? 'bg-gray-800 text-white'
                                                                    : 'bg-gray-100 text-gray-500'
                                                                    }`}
                                                            >
                                                                {st}GB
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Cores</h4>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {currentColors.map(cl => (
                                                            <button
                                                                key={cl}
                                                                onClick={() => toggleSelection(selectedColors, setSelectedColors, cl)}
                                                                className={`px-2 py-1 rounded text-[10px] font-black transition-all ${selectedColors.includes(cl)
                                                                    ? 'bg-gray-800 text-white'
                                                                    : 'bg-gray-100 text-gray-500'
                                                                    }`}
                                                            >
                                                                {cl}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Local de Estoque Choice */}
                                    <div className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                                Exibir Local de Estoque?
                                                <input
                                                    type="checkbox"
                                                    checked={showStockLocation}
                                                    onChange={e => setShowStockLocation(e.target.checked)}
                                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                            </label>
                                        </div>
                                        {showStockLocation && (
                                            <select
                                                value={selectedLocationId || ''}
                                                onChange={e => setSelectedLocationId(e.target.value || null)}
                                                className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                            >
                                                <option value="">Filtrar por Local (Opcional)</option>
                                                {locations.map(loc => (
                                                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    {/* Additional Options */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Opções de Exibição</h4>
                                        <div className="flex flex-col gap-3">
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <div className={`w-10 h-5 rounded-full p-1 transition-colors ${showStockQty ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                                                    <div className={`w-3 h-3 bg-white rounded-full transition-transform ${showStockQty ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                                </div>
                                                <input type="checkbox" className="hidden" checked={showStockQty} onChange={e => setShowStockQty(e.target.checked)} />
                                                <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">Exibir Quantidade em Estoque</span>
                                            </label>
                                            {selectedType === 'apple' && (
                                                <label className="flex items-center gap-3 cursor-pointer group">
                                                    <div className={`w-10 h-5 rounded-full p-1 transition-colors ${showBatteryHealth ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                                                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${showBatteryHealth ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                                    </div>
                                                    <input type="checkbox" className="hidden" checked={showBatteryHealth} onChange={e => setShowBatteryHealth(e.target.checked)} />
                                                    <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">Exibir Saúde da Bateria</span>
                                                </label>
                                            )}
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <div className={`w-10 h-5 rounded-full p-1 transition-colors ${groupIdentical ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                                                    <div className={`w-3 h-3 bg-white rounded-full transition-transform ${groupIdentical ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                                </div>
                                                <input type="checkbox" className="hidden" checked={groupIdentical} onChange={e => setGroupIdentical(e.target.checked)} />
                                                <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">Agrupar produtos iguais</span>
                                            </label>

                                        </div>
                                    </div>

                                    {/* Sorting */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Ordenar Lista</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { id: 'model', label: 'Modelo (A-Z)' },
                                                { id: 'price_asc', label: 'Preço Crescente' },
                                                { id: 'price_desc', label: 'Preço Decrescente' }
                                            ].map(sort => (
                                                <button
                                                    key={sort.id}
                                                    onClick={() => setSortBy(sort.id as any)}
                                                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border-2 ${sortBy === sort.id
                                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                                        : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}
                                                >
                                                    {sort.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Price Selection */}
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Tipos de Preço</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { id: 'cost', label: 'Custo' },
                                                { id: 'wholesale', label: 'Atacado' },
                                                { id: 'sale', label: 'Venda' },
                                                { id: 'all', label: 'Todos os preços' }
                                            ].map(price => (
                                                <button
                                                    key={price.id}
                                                    onClick={() => {
                                                        if (price.id === 'all') {
                                                            setSelectedPriceTypes(['all']);
                                                        } else {
                                                            const current = selectedPriceTypes.filter(t => t !== 'all');
                                                            if (current.includes(price.id)) {
                                                                setSelectedPriceTypes(current.filter(t => t !== price.id));
                                                            } else {
                                                                setSelectedPriceTypes([...current, price.id]);
                                                            }
                                                        }
                                                    }}
                                                    className={`p-3 rounded-2xl border-2 transition-all flex items-center gap-2 ${selectedPriceTypes.includes(price.id)
                                                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                                        : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                                                        }`}
                                                >
                                                    <div className={`w-4 h-4 rounded flex items-center justify-center border ${selectedPriceTypes.includes(price.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                                        {selectedPriceTypes.includes(price.id) && <CheckIcon className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <span className="text-xs font-bold">{price.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border bg-gray-50 flex items-center justify-between">
                    <div className="flex flex-col">
                        {step !== 'type' && (
                            <>
                                <span className="text-xs text-muted font-bold">
                                    {!hasActiveFilters ? 'Total em Estoque' : 'Resumo da Seleção'}
                                </span>
                                {!hasActiveFilters ? (
                                    <span className="text-lg font-black text-indigo-600">{totalUnits} produtos</span>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col">
                                            <span className="text-lg font-black text-indigo-600">{filteredForStep.length}</span>
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Modelos</span>
                                        </div>
                                        <div className="w-px h-8 bg-gray-200"></div>
                                        <div className="flex flex-col">
                                            <span className="text-lg font-black text-indigo-600">{totalUnits}</span>
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{totalUnits === 1 ? 'Item' : 'Itens'}</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={step === 'type' || filteredForStep.length === 0}
                            className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center gap-2"
                        >
                            <DocumentTextIcon className="w-5 h-5" />
                            Gerar Relatório
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PriceListModal;
