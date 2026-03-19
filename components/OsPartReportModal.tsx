import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { OsPart } from '../services/osPartsService';
import { getCategories, getBrands, formatCurrency } from '../services/mockApi';
import { CloseIcon, DocumentTextIcon, CheckIcon, ChevronRightIcon, ChevronLeftIcon } from './icons';
import { Category, Brand } from '../types';

interface OsPartReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    parts: OsPart[];
}

const OsPartReportModal: React.FC<OsPartReportModalProps> = ({ isOpen, onClose, parts }) => {
    const [step, setStep] = useState<'filters' | 'preview'>('filters');
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);

    // Selection State
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
    const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
    
    // Toggles
    const [showPrices, setShowPrices] = useState(true);
    const [showCost, setShowCost] = useState(false);
    const [showLocation, setShowLocation] = useState(true);
    const [sortBy, setSortBy] = useState<'name' | 'stock_asc' | 'stock_desc'>('name');

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            const fetchMeta = async () => {
                const [c, b] = await Promise.all([getCategories(), getBrands()]);
                setCategories(c);
                setBrands(b);
            };
            fetchMeta();
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const categoryMap = useMemo(() => {
        return categories.reduce((acc, c) => {
            acc[c.id] = c.name;
            return acc;
        }, {} as Record<string, string>);
    }, [categories]);

    const brandMap = useMemo(() => {
        return brands.reduce((acc, b) => {
            acc[b.id] = b.name;
            return acc;
        }, {} as Record<string, string>);
    }, [brands]);

    const filteredParts = useMemo(() => {
        let base = parts.filter(p => p.isActive);
        
        if (selectedCategories.length > 0) {
            base = base.filter(p => selectedCategories.includes(p.category || ''));
        }
        if (selectedBrands.length > 0) {
            base = base.filter(p => selectedBrands.includes(p.brand || ''));
        }
        if (selectedConditions.length > 0) {
            base = base.filter(p => selectedConditions.includes(p.condition || ''));
        }

        return base.sort((a, b) => {
            if (sortBy === 'stock_asc') return a.stock - b.stock;
            if (sortBy === 'stock_desc') return b.stock - a.stock;
            return a.name.localeCompare(b.name);
        });
    }, [parts, selectedCategories, selectedBrands, selectedConditions, sortBy]);

    const availableCategories = useMemo(() => {
        const ids = Array.from(new Set(parts.map(p => p.category).filter(Boolean)));
        return ids.map(id => ({ id, name: categoryMap[id] || id })).sort((a, b) => a.name.localeCompare(b.name));
    }, [parts, categoryMap]);

    const availableBrands = useMemo(() => {
        const ids = Array.from(new Set(parts.map(p => p.brand).filter(Boolean)));
        return ids.map(id => ({ id, name: brandMap[id] || id })).sort((a, b) => a.name.localeCompare(b.name));
    }, [parts, brandMap]);

    const availableConditions = useMemo(() => Array.from(new Set(parts.map(p => p.condition).filter(Boolean))).sort(), [parts]);

    const handlePrint = () => {
        const title = "RELATÓRIO DE ESTOQUE - PEÇAS E INSUMOS (OS)";
        const date = new Date().toLocaleString('pt-BR');
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        let tableRows = '';
        filteredParts.forEach(p => {
            // Helper to clean UUIDs from names if present
            const cleanName = p.name.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/, '');
            
            tableRows += `
                <tr>
                    <td>${p.sku || '-'}</td>
                    <td>
                        <strong>${cleanName}</strong>
                        <div style="font-size: 8px; color: #64748b; margin-top: -2px;">${brandMap[p.brand || ''] || p.brand || ''} ${p.model || ''}</div>
                    </td>
                    <td>${categoryMap[p.category || ''] || p.category || '-'}</td>
                    <td>${p.condition || 'Novo'}</td>
                    <td>${p.storageLocation || '-'}</td>
                    <td class="text-center font-bold">${p.stock}</td>
                    <td class="check-box"></td>
                    ${showPrices ? `<td>${formatCurrency(p.salePrice)}</td>` : ''}
                    ${showCost ? `<td>${formatCurrency(p.costPrice)}</td>` : ''}
                </tr>
            `;
        });

        printWindow.document.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 10px; color: #1e293b; line-height: 1.2; }
                        h1 { font-size: 16px; margin: 0; text-transform: uppercase; font-weight: 900; }
                        .meta { font-size: 9px; color: #64748b; margin-bottom: 10px; text-transform: uppercase; font-weight: bold; }
                        table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                        th { background: #f8fafc; text-align: left; padding: 4px 6px; font-size: 9px; text-transform: uppercase; border: 1px solid #e2e8f0; font-weight: 900; }
                        td { padding: 4px 6px; border: 1px solid #e2e8f0; font-size: 10.5px; vertical-align: middle; }
                        .text-center { text-align: center; }
                        .check-box { width: 40px; border: 1.5px solid #cbd5e1 !important; }
                        .font-bold { font-weight: bold; }
                        small { font-size: 9px; color: #64748b; }
                        @media print {
                            .no-print { display: none; }
                            body { padding: 0; }
                            @page { margin: 1cm; }
                        }
                    </style>
                </head>
                <body>
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px;">
                        <div>
                            <h1>${title}</h1>
                            <div class="meta">Gerado em: ${date} | total: ${filteredParts.length} itens</div>
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 80px;">SKU</th>
                                <th>Peça/Insumo</th>
                                <th>Categoria</th>
                                <th>Condição</th>
                                <th>Local</th>
                                <th class="text-center">Est.</th>
                                <th class="text-center">Conf.</th>
                                ${showPrices ? '<th>Venda</th>' : ''}
                                ${showCost ? '<th>Custo</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                    <script>window.print();</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (!isOpen) return null;

    const toggleSelection = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
        if (list.includes(item)) setList(list.filter(i => i !== item));
        else setList([...list, item]);
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-600 rounded-xl text-white">
                            <DocumentTextIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 uppercase">Relatório de Estoque (OS)</h2>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Configure os filtros e opções de visualização</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-xl transition-colors text-gray-400">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="overflow-y-auto p-8 space-y-8 flex-1">
                    {/* Filter Sections */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Categorias */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em] border-l-4 border-amber-500 pl-3">Categorias</h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {availableCategories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => toggleSelection(selectedCategories, setSelectedCategories, cat.id)}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                                            selectedCategories.includes(cat.id) ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-gray-50 border-gray-100 hover:border-gray-200 text-gray-600'
                                        }`}
                                    >
                                        <span className="text-sm font-bold truncate">{cat.name}</span>
                                        {selectedCategories.includes(cat.id) && <CheckIcon className="w-4 h-4" />}
                                    </button>
                                ))}
                                {availableCategories.length === 0 && <p className="text-xs text-gray-400 italic">Nenhuma categoria cadastrada</p>}
                            </div>
                        </div>

                        {/* Marcas */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em] border-l-4 border-amber-500 pl-3">Marcas</h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {availableBrands.map(brand => (
                                    <button
                                        key={brand.id}
                                        onClick={() => toggleSelection(selectedBrands, setSelectedBrands, brand.id)}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                                            selectedBrands.includes(brand.id) ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-gray-50 border-gray-100 hover:border-gray-200 text-gray-600'
                                        }`}
                                    >
                                        <span className="text-sm font-bold truncate">{brand.name}</span>
                                        {selectedBrands.includes(brand.id) && <CheckIcon className="w-4 h-4" />}
                                    </button>
                                ))}
                                {availableBrands.length === 0 && <p className="text-xs text-gray-400 italic">Nenhuma marca cadastrada</p>}
                            </div>
                        </div>

                        {/* Configurações Extra */}
                        <div className="space-y-6">
                            <h3 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em] border-l-4 border-amber-500 pl-3">Opções</h3>
                            
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div 
                                        onClick={() => setShowPrices(!showPrices)}
                                        className={`w-10 h-6 rounded-full p-1 transition-all ${showPrices ? 'bg-amber-600' : 'bg-gray-200'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${showPrices ? 'translate-x-4' : ''}`} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 uppercase">Mostrar Preços</span>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div 
                                        onClick={() => setShowCost(!showCost)}
                                        className={`w-10 h-6 rounded-full p-1 transition-all ${showCost ? 'bg-amber-600' : 'bg-gray-200'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${showCost ? 'translate-x-4' : ''}`} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 uppercase">Mostrar Custo</span>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div 
                                        onClick={() => setShowLocation(!showLocation)}
                                        className={`w-10 h-6 rounded-full p-1 transition-all ${showLocation ? 'bg-amber-600' : 'bg-gray-200'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${showLocation ? 'translate-x-4' : ''}`} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 uppercase">Mostrar Localização</span>
                                </label>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-black text-gray-400 px-1">Ordenar Por</label>
                                <select 
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    className="w-full h-10 px-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500/20"
                                >
                                    <option value="name">Nome (A-Z)</option>
                                    <option value="stock_asc">Estoque (Menor p/ Maior)</option>
                                    <option value="stock_desc">Estoque (Maior p/ Menor)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Summary Info */}
                    <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-black text-amber-700 uppercase tracking-widest">Resultado do Filtro</p>
                            <p className="text-2xl font-black text-amber-900 mt-1">{filteredParts.length} Peças Encontradas</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-black text-amber-700 uppercase tracking-widest">Estoque Total</p>
                            <p className="text-2xl font-black text-amber-900 mt-1">{filteredParts.reduce((acc, p) => acc + p.stock, 0)} unidades</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-white hover:text-gray-700 transition-all border border-transparent hover:border-gray-200"
                    >
                        Fechar
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-8 py-3 bg-amber-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-600/20 hover:bg-amber-700 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <DocumentTextIcon className="w-5 h-5" />
                        Gerar e Imprimir
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default OsPartReportModal;
