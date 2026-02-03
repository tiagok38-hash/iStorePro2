import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Product, StorageLocationParameter, PurchaseOrder } from '../types.ts';
import { SpinnerIcon, SearchIcon, CloseIcon, InfoIcon, MapPinIcon, CheckIcon } from './icons.tsx';
import { getStorageLocations } from '../services/mockApi.ts';

interface BulkLocationUpdateModalProps {
    allProducts: Product[];
    purchases: PurchaseOrder[];
    onClose: () => void;
    onBulkUpdate: (updates: { id: string; storageLocation: string }[]) => Promise<void>;
}

const BulkLocationUpdateModal: React.FC<BulkLocationUpdateModalProps> = ({ allProducts, purchases, onClose, onBulkUpdate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchedProducts, setSearchedProducts] = useState<Product[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [storageLocations, setStorageLocations] = useState<StorageLocationParameter[]>([]);
    const [newLocation, setNewLocation] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [lastAddedProduct, setLastAddedProduct] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        getStorageLocations().then(setStorageLocations).catch(() => { });
        // Focus on input when modal opens
        setTimeout(() => inputRef.current?.focus(), 100);
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    // Clear the "added" feedback after 2 seconds
    useEffect(() => {
        if (lastAddedProduct) {
            const timer = setTimeout(() => setLastAddedProduct(null), 2000);
            return () => clearTimeout(timer);
        }
    }, [lastAddedProduct]);

    const handleSearch = () => {
        if (!searchTerm.trim()) return;
        setIsSearching(true);
        const lowerSearchTerm = searchTerm.toLowerCase().trim();

        // First, find purchase order IDs that match the locator search term
        const matchingPurchaseOrderIds = new Set(
            purchases
                .filter(po => (po.locatorId || '').toLowerCase().includes(lowerSearchTerm))
                .map(po => po.id)
        );

        const results = allProducts.filter(p => {
            if (p.stock <= 0) return false;
            // Skip if already in the list
            if (searchedProducts.some(sp => sp.id === p.id)) return false;

            const description = `${p.brand || ''} ${p.model || ''} ${p.color || ''}`.toLowerCase();
            const descMatch = description.includes(lowerSearchTerm);

            // Search by locator code - check if product's purchaseOrderId is in matching purchases
            const locatorMatch = p.purchaseOrderId && matchingPurchaseOrderIds.has(p.purchaseOrderId);

            // Search by SKU, IMEI, serial
            const skuMatch = (p.sku || '').toLowerCase().includes(lowerSearchTerm);
            const imeiMatch = (p.imei1 || '').toLowerCase().includes(lowerSearchTerm) ||
                (p.imei2 || '').toLowerCase().includes(lowerSearchTerm);
            const serialMatch = (p.serialNumber || '').toLowerCase().includes(lowerSearchTerm);

            return descMatch || locatorMatch || skuMatch || imeiMatch || serialMatch;
        });

        setTimeout(() => {
            // Add new results to existing list (avoid duplicates)
            setSearchedProducts(prev => {
                const existingIds = new Set(prev.map(p => p.id));
                const newProducts = results.filter(p => !existingIds.has(p.id));
                return [...prev, ...newProducts];
            });
            setIsSearching(false);
        }, 200);
    };

    // Auto-add product when scanning IMEI or Serial Number (exact match)
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);

        // Check for exact IMEI or Serial Number match (usually 15 digits for IMEI)
        const trimmedValue = value.trim();
        if (trimmedValue.length >= 8) { // Minimum length for potential IMEI/Serial
            const exactMatch = allProducts.find(p => {
                if (p.stock <= 0) return false;
                // Exact match on IMEI1, IMEI2, or Serial Number
                return (
                    (p.imei1 && p.imei1.toLowerCase() === trimmedValue.toLowerCase()) ||
                    (p.imei2 && p.imei2.toLowerCase() === trimmedValue.toLowerCase()) ||
                    (p.serialNumber && p.serialNumber.toLowerCase() === trimmedValue.toLowerCase())
                );
            });

            if (exactMatch && !searchedProducts.some(sp => sp.id === exactMatch.id)) {
                // Auto-add the product
                setSearchedProducts(prev => [...prev, exactMatch]);
                setLastAddedProduct(exactMatch.id);
                // Clear search and refocus for next scan
                setTimeout(() => {
                    setSearchTerm('');
                    inputRef.current?.focus();
                }, 100);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
            // Clear search after Enter for scanner workflow
            setTimeout(() => {
                setSearchTerm('');
                inputRef.current?.focus();
            }, 300);
        }
    };

    const handleUpdate = async () => {
        if (searchedProducts.length === 0 || !newLocation) return;

        setIsUpdating(true);
        const updates = searchedProducts.map(p => ({
            id: p.id,
            storageLocation: newLocation,
        }));

        await onBulkUpdate(updates);
        setIsUpdating(false);
    };

    const removeProduct = (productId: string) => {
        setSearchedProducts(prev => prev.filter(p => p.id !== productId));
    };

    const clearAllProducts = () => {
        setSearchedProducts([]);
    };

    const modalContent = (
        <div className="fixed inset-0 z-[99999] bg-white lg:bg-black/60 lg:backdrop-blur-sm lg:flex lg:items-center lg:justify-center lg:p-4">
            <div className="bg-white w-full h-full lg:h-auto lg:max-h-[90vh] lg:max-w-3xl lg:rounded-2xl lg:shadow-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-xl">
                            <MapPinIcon className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Atualização de Local em Massa</h2>
                            <p className="text-xs text-gray-500">Bipe o IMEI/Serial ou busque por descrição</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                    >
                        <CloseIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Search Section */}
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0 space-y-3">
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Bipe IMEI/Serial ou busque por descrição/localizador..."
                                value={searchTerm}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                autoFocus
                            />
                            {lastAddedProduct && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-emerald-600 text-xs font-semibold animate-pulse">
                                    <CheckIcon className="h-4 w-4" />
                                    Adicionado!
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                handleSearch();
                                setTimeout(() => {
                                    setSearchTerm('');
                                    inputRef.current?.focus();
                                }, 300);
                            }}
                            disabled={isSearching || !searchTerm.trim()}
                            className="flex-shrink-0 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 disabled:bg-gray-400"
                        >
                            {isSearching ? <SpinnerIcon className="h-5 w-5 animate-spin" /> : <SearchIcon className="h-5 w-5" />}
                        </button>
                    </div>
                    <div className="p-2 bg-blue-50 text-blue-700 rounded-lg text-xs flex items-start gap-2">
                        <InfoIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span><strong>Dica:</strong> Bipe o IMEI ou número de série para adicionar automaticamente. Use a busca para descrição ou localizador.</span>
                    </div>
                </div>

                {/* Product List */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    {searchedProducts.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {searchedProducts.map(product => {
                                const desc = `${product.brand} ${product.model}${product.color && !product.model.toLowerCase().includes(product.color.toLowerCase()) ? ' ' + product.color : ''}`;
                                const isJustAdded = lastAddedProduct === product.id;
                                return (
                                    <div key={product.id} className={`p-3 flex items-center justify-between gap-3 transition-colors ${isJustAdded ? 'bg-emerald-50' : ''}`}>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-900 text-sm truncate">{desc}</p>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
                                                <span>Estoque: <strong>{product.stock}</strong></span>
                                                <span>•</span>
                                                <span>Local: <strong className="text-emerald-600">{product.storageLocation || 'N/A'}</strong></span>
                                                {product.imei1 && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="font-mono text-[10px]">IMEI: {product.imei1}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeProduct(product.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full flex-shrink-0"
                                        >
                                            <CloseIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full p-8">
                            <p className="text-gray-500 text-sm text-center">Nenhum produto na lista.<br />Bipe um IMEI/Serial ou faça uma busca.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0 space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">Novo Local de Estoque</label>
                        <select
                            value={newLocation}
                            onChange={e => setNewLocation(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        >
                            <option value="">Selecione um local...</option>
                            {storageLocations.map(loc => (
                                <option key={loc.id} value={loc.name}>{loc.name}</option>
                            ))}
                        </select>
                    </div>

                    {searchedProducts.length > 0 && (
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500">
                                <strong>{searchedProducts.length}</strong> produto{searchedProducts.length !== 1 ? 's' : ''} selecionado{searchedProducts.length !== 1 ? 's' : ''}
                            </p>
                            <button
                                onClick={clearAllProducts}
                                className="text-xs text-red-500 hover:text-red-700 font-medium"
                            >
                                Limpar lista
                            </button>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 text-sm font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleUpdate}
                            disabled={isUpdating || searchedProducts.length === 0 || !newLocation}
                            className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {isUpdating ? <SpinnerIcon className="h-5 w-5 animate-spin" /> : 'ATUALIZAR LOCAL'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default BulkLocationUpdateModal;
