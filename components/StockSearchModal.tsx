import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types.ts';
import { SearchIcon, XCircleIcon, ArchiveBoxIcon, CheckIcon } from './icons.tsx';
import { formatCurrency } from '../services/mockApi.ts';

interface StockSearchModalProps {
    products: Product[];
    onClose: () => void;
}

const StockSearchModal: React.FC<StockSearchModalProps> = ({ products, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const filteredProducts = products.filter(p => {
        if (!searchTerm) return false;

        const lowerSearch = searchTerm.toLowerCase();
        const terms = lowerSearch.split(/\s+/).filter(t => t.length > 0);

        // Map of keywords/prefixes to strict conditions
        const conditionMappings: Record<string, string> = {
            'novo': 'Novo',
            'lacrado': 'Novo',
            'new': 'Novo',
            'seminovo': 'Seminovo',
            'semi': 'Seminovo',
            'semin': 'Seminovo',
            'semino': 'Seminovo',
            'usado': 'Seminovo',
            'cpo': 'CPO',
            'open': 'Open Box',
            'box': 'Open Box',
            'vitrine': 'Vitrine',
            'vitri': 'Vitrine'
        };

        // Handle composite "open box" special case before term analysis
        let processingTerms = [...terms];
        let requiredCondition: string | null = null;

        if (lowerSearch.includes('open box')) {
            requiredCondition = 'Open Box';
            processingTerms = processingTerms.filter(t => t !== 'open' && t !== 'box');
        }

        // Identify condition in individual terms if not already found
        if (!requiredCondition) {
            const newTerms: string[] = [];
            for (const term of processingTerms) {
                let foundCond = null;
                if (conditionMappings[term]) {
                    foundCond = conditionMappings[term];
                } else {
                    // Fallback for typing "seminov" -> "Seminovo"
                    if (term.length >= 4 && 'seminovo'.startsWith(term)) foundCond = 'Seminovo';
                    if (term.length >= 4 && 'vitrine'.startsWith(term)) foundCond = 'Vitrine';
                }

                if (foundCond) {
                    if (!requiredCondition) {
                        requiredCondition = foundCond;
                    }
                } else {
                    newTerms.push(term);
                }
            }
            processingTerms = newTerms;
        }

        if (p.stock <= 0) return false;

        // 1. Strict Condition Check
        if (requiredCondition) {
            if (p.condition !== requiredCondition) return false;
        }

        // 2. Text Search with remaining terms
        const searchableText = [
            p.model || '',
            p.imei1 || '',
            p.imei2 || '',
            p.serialNumber || '',
            p.brand || '',
            p.observations || '',
            p.color || '',
            (p.barcodes || []).join(' ')
        ].join(' ').toLowerCase();

        return processingTerms.every(term => {
            // Smart numeric check: if term is numeric (e.g. "12"), ensure it's not embedded inside another number (like "512" or "128")
            // UNLESS it's at the start of a word (start of model like "12"), or the user typed enough to be specific.
            // But "iPhone 12" -> "12". "12" in "128" -> starts with it. "12" in "512" -> ends with it.
            // The user complaint is "iPhone 12" showing "iPhone 17 ... 512GB" and "iPhone 15 ... 128GB".
            // So "12" is matching "512" and "128".
            // We want "12" to match "iPhone 12" (whole word) or "iPhone 12 Pro" (whole word).
            // We do NOT want "12" to match "512" or "128".

            const isNumeric = /^\d+$/.test(term);
            if (isNumeric && term.length >= 5) {
                // For numeric search terms of 5+ digits (like IMEI, SN, or Barcodes partials), 
                // allow simple inclusion to find matches as the user types.
                return searchableText.includes(term);
            }

            if (isNumeric) {
                // For short numbers (like model versions 11, 12, 13), use word boundaries
                // to avoid matching embedded numbers in capacities (128, 512).
                const regex = new RegExp(`\\b${term}\\b`, 'i');
                return regex.test(searchableText);
            }

            // Standard inclusion for non-numeric terms
            return searchableText.includes(term);
        });
    });

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
                            <ArchiveBoxIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                            Consulta de Estoque
                        </h2>
                        <p className="text-[10px] sm:text-sm text-muted mt-0.5 sm:mt-1">Pesquise por descrição, IMEI ou Serial</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                        <XCircleIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 sm:p-6 bg-white border-b border-gray-100">
                    <div className="flex items-center border-2 border-gray-200 rounded-xl bg-white focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all">
                        <div className="pl-3 sm:pl-4">
                            <SearchIcon className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Modelo, IMEI ou Serial..."
                            className="flex-1 w-full py-3 sm:py-4 px-3 sm:px-4 text-base sm:text-lg font-medium outline-none bg-transparent border-none focus:ring-0"
                        />
                    </div>
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto p-2 sm:p-6 bg-gray-50/50">
                    {searchTerm === '' ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted">
                            <ArchiveBoxIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mb-4" />
                            <p className="font-medium text-sm sm:text-base">Digite algo para pesquisar...</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted">
                            <p className="font-medium text-sm sm:text-base">Nenhum produto encontrado.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2 sm:gap-3">
                            {filteredProducts.map(p => (
                                <div key={p.id} className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-sm hover:border-primary transition-all">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                                                <span className="font-black text-gray-900 text-sm sm:text-lg leading-tight uppercase tracking-tighter">{p.model}</span>
                                                <div className="flex gap-1">
                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-black uppercase ${p.condition === 'Novo' ? 'bg-green-100 text-green-700' :
                                                        p.condition === 'Reservado' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {p.condition}
                                                    </span>
                                                    {p.origin === 'Troca' && (
                                                        <span className="px-1 py-0 text-[8px] font-bold rounded bg-rose-50 text-rose-400 border border-rose-100 uppercase tracking-tighter">Troca</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-[10px] sm:text-xs text-muted flex flex-wrap gap-x-3 gap-y-0.5">
                                                {p.imei1 && <span><strong className="text-gray-500">IMEI:</strong> {p.imei1}</span>}
                                                {p.serialNumber && <span><strong className="text-gray-500">S/N:</strong> {p.serialNumber}</span>}
                                                {p.storageLocation && <span><strong className="text-gray-500">Local:</strong> {p.storageLocation}</span>}
                                                {(p.batteryHealth !== undefined && p.batteryHealth > 0 && p.condition !== 'Novo') && <span><strong className="text-gray-500">Bat:</strong> {p.batteryHealth}%</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 pt-2 sm:pt-0 border-t sm:border-0 border-gray-50">
                                            <div className="text-left sm:text-right">
                                                <p className="text-[8px] sm:text-[10px] font-bold text-muted uppercase tracking-wider leading-none mb-1">Estoque</p>
                                                <p className={`text-sm sm:text-lg font-black ${p.stock > 0 ? 'text-gray-800' : 'text-red-500'}`}>{p.stock}</p>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6">
                                                <div className="text-left sm:text-right">
                                                    <p className="text-[8px] sm:text-[10px] font-bold text-muted uppercase tracking-wider leading-none mb-1">Custo</p>
                                                    <p className="text-xs sm:text-sm font-bold text-gray-500">{formatCurrency((p.costPrice || 0) + (p.additionalCostPrice || 0))}</p>
                                                </div>
                                                <div className="text-left sm:text-right">
                                                    <p className="text-[8px] sm:text-[10px] font-bold text-muted uppercase tracking-wider leading-none mb-1">Atacado</p>
                                                    <p className="text-xs sm:text-sm font-bold text-orange-600">{formatCurrency(p.wholesalePrice || 0)}</p>
                                                </div>
                                                <div className="text-left sm:text-right min-w-[80px] sm:min-w-[100px]">
                                                    <p className="text-[8px] sm:text-[10px] font-bold text-muted uppercase tracking-wider leading-none mb-1">Preço Venda</p>
                                                    <p className="text-base sm:text-xl font-black text-primary">{formatCurrency(p.price)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default StockSearchModal;
