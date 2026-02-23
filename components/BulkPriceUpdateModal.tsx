import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Product } from '../types.ts';
import { SpinnerIcon, SearchIcon, CloseIcon, InfoIcon } from './icons.tsx';
import { formatCurrency } from '../services/mockApi.ts';
import CurrencyInput from './CurrencyInput.tsx';

interface BulkPriceUpdateModalProps {
    allProducts: Product[];
    onClose: () => void;
    onBulkUpdate: (updates: { id: string; price?: number; costPrice?: number; wholesalePrice?: number; commission_enabled?: boolean; commission_type?: 'fixed' | 'percentage'; commission_value?: number; discount_limit_type?: 'fixed' | 'percentage'; discount_limit_value?: number }[]) => Promise<void>;
}

const BulkPriceUpdateModal: React.FC<BulkPriceUpdateModalProps> = ({ allProducts, onClose, onBulkUpdate }) => {
    const [activeTab, setActiveTab] = useState<'precos' | 'comissoes'>('precos');
    const [conditionFilter, setConditionFilter] = useState('todas');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchedProducts, setSearchedProducts] = useState<Product[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Price fields
    const [newCostPrice, setNewCostPrice] = useState<number | null>(null);
    const [newSalePrice, setNewSalePrice] = useState<number | null>(null);
    const [newWholesalePrice, setNewWholesalePrice] = useState<number | null>(null);

    // Commission fields
    const [commissionEnabled, setCommissionEnabled] = useState<boolean>(true);
    const [commissionType, setCommissionType] = useState<'fixed' | 'percentage'>('percentage');
    const [commissionValue, setCommissionValue] = useState<number | null>(null);
    const [applyDiscountLimit, setApplyDiscountLimit] = useState<boolean>(false);
    const [discountLimitType, setDiscountLimitType] = useState<'fixed' | 'percentage'>('percentage');
    const [discountLimitValue, setDiscountLimitValue] = useState<number | null>(null);

    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    const handleSearch = () => {
        setIsSearching(true);
        const terms = searchTerm.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
        const searchPhrase = terms.join(' ');

        const results = allProducts.filter(p => {
            const description = `${p.brand || ''} ${p.model || ''} ${p.color || ''} ${p.storage || ''} ${p.sku || ''} ${p.category || ''}`.toLowerCase();
            const searchMatch = terms.length === 0 ? true : terms.every(term => description.includes(term));
            const conditionMatch = conditionFilter === 'todas' || p.condition === conditionFilter;
            const stockMatch = p.stock > 0;
            return searchMatch && conditionMatch && stockMatch;
        });

        // Sort by relevance: phrase match first, then word-boundary match
        if (terms.length > 1) {
            results.sort((a, b) => {
                const modelA = String(a.model || '').toLowerCase();
                const modelB = String(b.model || '').toLowerCase();
                const phraseInA = modelA.includes(searchPhrase) ? 200 : 0;
                const phraseInB = modelB.includes(searchPhrase) ? 200 : 0;

                let scoreA = phraseInA;
                let scoreB = phraseInB;

                terms.forEach(term => {
                    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                    if (regex.test(modelA)) scoreA += 50;
                    else if (modelA.includes(term)) scoreA += 5;
                    if (regex.test(modelB)) scoreB += 50;
                    else if (modelB.includes(term)) scoreB += 5;
                });

                return scoreB - scoreA;
            });
        }

        setTimeout(() => {
            setSearchedProducts(results);
            setIsSearching(false);
        }, 300);
    };

    const handlePriceUpdate = async () => {
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

    const handleCommissionUpdate = async () => {
        if (searchedProducts.length === 0) return;
        if (commissionValue === null || commissionValue <= 0) {
            alert('Preencha o valor da comissão.');
            return;
        }

        setIsUpdating(true);
        const updates = searchedProducts.map(p => ({
            id: p.id,
            commission_enabled: commissionEnabled,
            commission_type: commissionType,
            commission_value: commissionValue,
            ...(applyDiscountLimit && discountLimitValue !== null && discountLimitValue > 0 && {
                discount_limit_type: discountLimitType,
                discount_limit_value: discountLimitValue,
            }),
        }));

        await onBulkUpdate(updates);
        setIsUpdating(false);
    };

    const tabClasses = (tab: string) =>
        `px-4 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === tab
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
            : 'text-gray-500 hover:bg-gray-100'
        }`;

    const modalContent = (
        <div className="fixed inset-0 z-[99999] bg-white lg:bg-black/60 lg:backdrop-blur-sm lg:flex lg:items-center lg:justify-center lg:p-4">
            {/* Mobile: Fullscreen | Desktop: Centered Modal */}
            <div className="bg-white w-full h-full lg:h-auto lg:max-h-[90vh] lg:max-w-4xl lg:rounded-3xl lg:shadow-2xl flex flex-col overflow-hidden">

                {/* Header - Fixed */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white flex-shrink-0">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        Atualização em Massa
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-xl border border-indigo-100">
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

                {/* Tab Switcher */}
                <div className="flex gap-1 p-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                    <button onClick={() => setActiveTab('precos')} className={tabClasses('precos')}>
                        💰 Preços
                    </button>
                    <button onClick={() => setActiveTab('comissoes')} className={tabClasses('comissoes')}>
                        🏷️ Comissões
                    </button>
                </div>

                {/* Search Section - Fixed */}
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0 space-y-3">
                    <div className="flex gap-2">
                        <select
                            value={conditionFilter}
                            onChange={e => setConditionFilter(e.target.value)}
                            className="flex-shrink-0 px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
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
                        <span>
                            {activeTab === 'precos'
                                ? <><strong>Dica:</strong> Busque por "iPhone 16 Pro Max" para encontrar produtos específicos.</>
                                : <><strong>Dica:</strong> Busque os produtos e defina comissão e limites de desconto para todos de uma vez.</>
                            }
                        </span>
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

                                        {/* Show different info based on active tab */}
                                        {activeTab === 'precos' ? (
                                            <div className="grid grid-cols-3 gap-2 text-center mt-2">
                                                <div className="bg-gray-50 rounded-xl py-1">
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
                                        ) : (
                                            <div className="grid grid-cols-3 gap-2 text-center mt-2">
                                                <div className={`rounded-xl py-1 ${product.commission_enabled ? 'bg-violet-50' : 'bg-gray-50'}`}>
                                                    <p className="text-[10px] text-gray-500 uppercase">Comissão</p>
                                                    <p className={`text-xs font-bold ${product.commission_enabled ? 'text-violet-600' : 'text-gray-400'}`}>
                                                        {product.commission_enabled ? 'Ativa' : 'Desativada'}
                                                    </p>
                                                </div>
                                                <div className="bg-violet-50 rounded-lg py-1">
                                                    <p className="text-[10px] text-violet-600 uppercase">
                                                        {product.commission_type === 'fixed' ? 'Fixo' : 'Percentual'}
                                                    </p>
                                                    <p className="text-sm font-bold text-violet-600">
                                                        {product.commission_value
                                                            ? (product.commission_type === 'fixed' ? formatCurrency(product.commission_value) : `${product.commission_value}%`)
                                                            : '—'
                                                        }
                                                    </p>
                                                </div>
                                                <div className="bg-orange-50 rounded-lg py-1">
                                                    <p className="text-[10px] text-orange-600 uppercase">Lim. Desc.</p>
                                                    <p className="text-sm font-bold text-orange-600">
                                                        {product.discount_limit_value
                                                            ? (product.discount_limit_type === 'fixed' ? formatCurrency(product.discount_limit_value) : `${product.discount_limit_value}%`)
                                                            : '—'
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        )}
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

                {/* Footer - Tab-specific */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0 space-y-3 safe-area-inset-bottom">
                    {activeTab === 'precos' ? (
                        <>
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
                        </>
                    ) : (
                        <>
                            <p className="text-xs text-gray-500">
                                Configure comissão para todos os produtos encontrados. Limite de desconto é opcional.
                            </p>

                            {/* Commission Toggle + Type + Value */}
                            <div className="grid grid-cols-3 gap-2 items-end">
                                <div>
                                    <label className="block text-[10px] font-bold text-violet-600 mb-1 uppercase">Comissão</label>
                                    <div
                                        onClick={() => setCommissionEnabled(!commissionEnabled)}
                                        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${commissionEnabled
                                            ? 'bg-violet-50 border-violet-300 text-violet-700'
                                            : 'bg-gray-50 border-gray-300 text-gray-500'
                                            }`}
                                    >
                                        <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${commissionEnabled ? 'bg-violet-600' : 'bg-gray-300'}`}>
                                            <div className={`w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform ${commissionEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </div>
                                        <span className="text-xs font-bold">{commissionEnabled ? 'Ativa' : 'Desativada'}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-violet-600 mb-1 uppercase">Tipo</label>
                                    <select
                                        value={commissionType}
                                        onChange={e => setCommissionType(e.target.value as any)}
                                        disabled={!commissionEnabled}
                                        className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm font-semibold bg-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none disabled:opacity-50 disabled:bg-gray-100"
                                    >
                                        <option value="percentage">Percentual (%)</option>
                                        <option value="fixed">Valor Fixo (R$)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-violet-600 mb-1 uppercase">
                                        Valor {commissionType === 'fixed' ? '(R$)' : '(%)'}
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={commissionValue ?? ''}
                                        onChange={e => setCommissionValue(e.target.value === '' ? null : parseFloat(e.target.value))}
                                        disabled={!commissionEnabled}
                                        className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm font-semibold bg-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none disabled:opacity-50 disabled:bg-gray-100"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Discount Limit (Optional) */}
                            <div className="border-t border-gray-200 pt-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <div
                                        onClick={() => setApplyDiscountLimit(!applyDiscountLimit)}
                                        className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${applyDiscountLimit ? 'bg-orange-500' : 'bg-gray-300'}`}
                                    >
                                        <div className={`w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform ${applyDiscountLimit ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </div>
                                    <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">
                                        🔒 Limite de Desconto (opcional)
                                    </span>
                                </div>

                                {applyDiscountLimit && (
                                    <div className="grid grid-cols-2 gap-2 animate-fade-in">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Tipo</label>
                                            <select
                                                value={discountLimitType}
                                                onChange={e => setDiscountLimitType(e.target.value as any)}
                                                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm font-semibold bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                                            >
                                                <option value="percentage">Percentual (%)</option>
                                                <option value="fixed">Valor Fixo (R$)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">
                                                Máx. {discountLimitType === 'fixed' ? '(R$)' : '(%)'}
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={discountLimitValue ?? ''}
                                                onChange={e => setDiscountLimitValue(e.target.value === '' ? null : parseFloat(e.target.value))}
                                                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm font-semibold bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    <div className="flex gap-3 pt-1">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 text-sm font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={activeTab === 'precos' ? handlePriceUpdate : handleCommissionUpdate}
                            disabled={isUpdating || searchedProducts.length === 0}
                            className={`flex-1 px-4 py-3 text-white rounded-xl font-bold text-sm disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 ${activeTab === 'precos'
                                ? 'bg-indigo-600 hover:bg-indigo-700'
                                : 'bg-violet-600 hover:bg-violet-700'
                                }`}
                        >
                            {isUpdating
                                ? <SpinnerIcon className="h-5 w-5 animate-spin" />
                                : activeTab === 'precos' ? 'ATUALIZAR PREÇOS' : 'ATUALIZAR COMISSÕES'
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default BulkPriceUpdateModal;