import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Product } from '../types.ts';
import { SpinnerIcon, SearchIcon, CloseIcon, InfoIcon } from './icons.tsx';
import { formatCurrency } from '../services/mockApi.ts';
import CurrencyInput from './CurrencyInput.tsx';

interface BulkPriceUpdateModalProps {
    allProducts: Product[];
    onClose: () => void;
    onBulkUpdate: (updates: { id: string; price?: number; costPrice?: number; wholesalePrice?: number }[]) => Promise<void>;
}

const BulkPriceUpdateModal: React.FC<BulkPriceUpdateModalProps> = ({ allProducts, onClose, onBulkUpdate }) => {
    const [conditionFilter, setConditionFilter] = useState('todas');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchedProducts, setSearchedProducts] = useState<Product[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const [newCostPrice, setNewCostPrice] = useState<number | null>(null);
    const [newSalePrice, setNewSalePrice] = useState<number | null>(null);
    const [newWholesalePrice, setNewWholesalePrice] = useState<number | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    const handleSearch = () => {
        setIsSearching(true);
        const lowerSearchTerm = searchTerm.toLowerCase();
        const results = allProducts.filter(p => {
            const description = `${p.brand} ${p.model} ${p.color || ''}`.toLowerCase();
            const searchMatch = description.includes(lowerSearchTerm);
            const conditionMatch = conditionFilter === 'todas' || p.condition === conditionFilter;
            const stockMatch = p.stock > 0;
            return searchMatch && conditionMatch && stockMatch;
        });
        setTimeout(() => {
            setSearchedProducts(results);
            setIsSearching(false);
        }, 300);
    };

    const handleUpdate = async () => {
        if (searchedProducts.length === 0) return;
        if (newCostPrice === null && newSalePrice === null && newWholesalePrice === null) {
            alert('Preencha pelo menos um campo de preço para atualizar.');
            return;
        }

        setIsUpdating(true);
        const updates = searchedProducts.map(p => ({
            id: p.id,
            ...(newSalePrice !== null && { price: newSalePrice }),
            ...(newCostPrice !== null && { costPrice: newCostPrice }),
            ...(newWholesalePrice !== null && { wholesalePrice: newWholesalePrice }),
        }));

        await onBulkUpdate(updates);
        setIsUpdating(false);
    };

    const modalContent = (
        <div className="fixed inset-0 z-[99999] bg-white lg:bg-black/60 lg:backdrop-blur-sm lg:flex lg:items-center lg:justify-center lg:p-4">
            {/* Mobile: Fullscreen | Desktop: Centered Modal */}
            <div className="bg-white w-full h-full lg:h-auto lg:max-h-[90vh] lg:max-w-4xl lg:rounded-2xl lg:shadow-2xl flex flex-col overflow-hidden">

                {/* Header - Fixed */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white flex-shrink-0">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        Atualização de Preço em Massa
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                            Encontrados: {searchedProducts.length}
                        </span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                    >
                        <CloseIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Search Section - Fixed */}
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0 space-y-3">
                    <div className="flex gap-2">
                        <select
                            value={conditionFilter}
                            onChange={e => setConditionFilter(e.target.value)}
                            className="flex-shrink-0 px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        >
                            <option value="todas">Todas</option>
                            <option>Novo</option>
                            <option>Seminovo</option>
                            <option>CPO</option>
                            <option>Openbox</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Buscar produto..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            className="flex-1 min-w-0 px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isSearching}
                            className="flex-shrink-0 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 disabled:bg-gray-400"
                        >
                            {isSearching ? <SpinnerIcon className="h-5 w-5 animate-spin" /> : <SearchIcon className="h-5 w-5" />}
                        </button>
                    </div>
                    <div className="p-2 bg-blue-50 text-blue-700 rounded-lg text-xs flex items-start gap-2">
                        <InfoIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span><strong>Dica:</strong> Busque por "iPhone 16 Pro Max" para encontrar produtos específicos.</span>
                    </div>
                </div>

                {/* Product List - Scrollable */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    {searchedProducts.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {searchedProducts.map(product => {
                                const desc = `${product.brand} ${product.model}${product.color && !product.model.toLowerCase().includes(product.color.toLowerCase()) ? ' ' + product.color : ''}`;
                                return (
                                    <div key={product.id} className="p-4 relative group">
                                        <button
                                            onClick={() => setSearchedProducts(prev => prev.filter(p => p.id !== product.id))}
                                            className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                            title="Remover da lista"
                                        >
                                            <CloseIcon className="h-4 w-4" />
                                        </button>
                                        <div className="flex items-start justify-between pr-8 mb-1">
                                            <p className="font-semibold text-gray-900 text-sm">{desc}</p>
                                            <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
                                                {product.stock} un.
                                            </span>
                                        </div>
                                        {(product.serialNumber || product.imei1) && (
                                            <p className="text-[10px] text-gray-500 mb-2 font-mono">
                                                {product.serialNumber && <span>S/N: {product.serialNumber}</span>}
                                                {product.serialNumber && product.imei1 && <span className="mx-1">•</span>}
                                                {product.imei1 && <span>IMEI: {product.imei1}</span>}
                                            </p>
                                        )}
                                        <div className="grid grid-cols-3 gap-2 text-center mt-2">
                                            <div className="bg-gray-50 rounded-lg py-1">
                                                <p className="text-[10px] text-gray-500 uppercase">Custo</p>
                                                <p className="text-xs font-medium">{formatCurrency(product.costPrice || 0)}</p>
                                            </div>
                                            <div className="bg-orange-50 rounded-lg py-1">
                                                <p className="text-[10px] text-orange-600 uppercase">Atacado</p>
                                                <p className="text-sm font-bold text-orange-600">{formatCurrency(product.wholesalePrice || 0)}</p>
                                            </div>
                                            <div className="bg-green-50 rounded-lg py-1">
                                                <p className="text-[10px] text-green-600 uppercase">Venda</p>
                                                <p className="text-sm font-bold text-green-600">{formatCurrency(product.price)}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full p-8">
                            <p className="text-gray-500 text-sm text-center">Nenhum produto encontrado.<br />Refine sua busca.</p>
                        </div>
                    )}
                </div>

                {/* Footer - Fixed at bottom */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0 space-y-3 safe-area-inset-bottom">
                    <p className="text-xs text-gray-500">
                        Preencha apenas os preços que deseja alterar.
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Custo</label>
                            <CurrencyInput
                                value={newCostPrice}
                                onChange={setNewCostPrice}
                                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm font-semibold bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">ATC</label>
                            <CurrencyInput
                                value={newWholesalePrice}
                                onChange={setNewWholesalePrice}
                                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm font-semibold bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Venda</label>
                            <CurrencyInput
                                value={newSalePrice}
                                onChange={setNewSalePrice}
                                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm font-semibold bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 pt-1">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 text-sm font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleUpdate}
                            disabled={isUpdating || searchedProducts.length === 0}
                            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {isUpdating ? <SpinnerIcon className="h-5 w-5 animate-spin" /> : 'ATUALIZAR'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default BulkPriceUpdateModal;