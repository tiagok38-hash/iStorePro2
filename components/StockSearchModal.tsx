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
        const term = searchTerm.toLowerCase();
        return (
            (p.model || '').toLowerCase().includes(term) ||
            (p.imei1 || '').toLowerCase().includes(term) ||
            (p.imei2 || '').toLowerCase().includes(term) ||
            (p.serialNumber || '').toLowerCase().includes(term) ||
            (p.brand || '').toLowerCase().includes(term) ||
            (p.observations || '').toLowerCase().includes(term)
        ) && p.stock > 0;
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
                            {filteredProducts.map(product => (
                                <div key={product.id} className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-sm hover:border-primary transition-all">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                                                <span className="font-black text-gray-900 text-sm sm:text-lg leading-tight uppercase tracking-tighter">{product.model}</span>
                                                <div className="flex gap-1">
                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-black uppercase ${product.condition === 'Novo' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {product.condition}
                                                    </span>
                                                    {product.origin === 'Troca' && (
                                                        <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-black uppercase bg-orange-100 text-orange-700">Troca</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-[10px] sm:text-xs text-muted flex flex-wrap gap-x-3 gap-y-0.5">
                                                {product.imei1 && <span><strong className="text-gray-500">IMEI:</strong> {product.imei1}</span>}
                                                {product.serialNumber && <span><strong className="text-gray-500">S/N:</strong> {product.serialNumber}</span>}
                                                {product.storageLocation && <span><strong className="text-gray-500">Local:</strong> {product.storageLocation}</span>}
                                                {(product.batteryHealth !== undefined && product.batteryHealth > 0 && product.condition !== 'Novo') && <span><strong className="text-gray-500">Bat:</strong> {product.batteryHealth}%</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 pt-2 sm:pt-0 border-t sm:border-0 border-gray-50">
                                            <div className="text-left sm:text-right">
                                                <p className="text-[8px] sm:text-[10px] font-bold text-muted uppercase tracking-wider leading-none mb-1">Estoque</p>
                                                <p className={`text-sm sm:text-lg font-black ${product.stock > 0 ? 'text-gray-800' : 'text-red-500'}`}>{product.stock}</p>
                                            </div>
                                            <div className="text-right min-w-[80px] sm:min-w-[100px]">
                                                <p className="text-[8px] sm:text-[10px] font-bold text-muted uppercase tracking-wider leading-none mb-1">Preço</p>
                                                <p className="text-base sm:text-xl font-black text-primary">{formatCurrency(product.price)}</p>
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
