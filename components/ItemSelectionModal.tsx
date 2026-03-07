
import React, { useState } from 'react';
import { Search, X, Wrench, Package, Info, Minus, Plus } from 'lucide-react';
import Modal from './Modal';
import { formatCurrency } from '../services/mockApi';

interface ItemSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    items: any[];
    type: 'part' | 'service';
    onSelect: (item: any, quantity?: number) => void;
}

const ItemSelectionModal: React.FC<ItemSelectionModalProps> = ({
    isOpen,
    onClose,
    title,
    items,
    type,
    onSelect
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPart, setSelectedPart] = useState<any>(null);
    const [quantityToAdd, setQuantityToAdd] = useState(1);

    const filteredItems = items.filter(item => {
        const search = searchTerm.toLowerCase();
        if (type === 'service') {
            return item.name.toLowerCase().includes(search) ||
                (item.description && item.description.toLowerCase().includes(search));
        } else {
            // Para peças, buscar pelo nome (que contém model)
            const nameMatch = item.name?.toLowerCase().includes(search) || item.model?.toLowerCase().includes(search);
            const brandMatch = item.brand && item.brand.toLowerCase().includes(search);
            return nameMatch || brandMatch;
        }
    });

    const handleSelectItem = (item: any) => {
        if (type === 'part') {
            // Para peças, abrir seletor de quantidade
            setSelectedPart(item);
            setQuantityToAdd(1);
        } else {
            onSelect(item);
            onClose();
        }
    };

    const handleConfirmQuantity = () => {
        if (selectedPart && quantityToAdd > 0) {
            onSelect(selectedPart, quantityToAdd);
            setSelectedPart(null);
            setQuantityToAdd(1);
            onClose();
        }
    };

    const handleCloseModal = () => {
        setSelectedPart(null);
        setQuantityToAdd(1);
        onClose();
    };

    const maxQty = selectedPart ? (selectedPart.stock || 0) : 1;

    return (
        <Modal isOpen={isOpen} onClose={handleCloseModal} title={title}>
            <div className="space-y-4">
                {/* Quantity selection overlay */}
                {selectedPart && (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 animate-scale-in">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-orange-100 text-orange-500">
                                <Package size={20} />
                            </div>
                            <div className="flex-1">
                                <p className="font-black text-gray-900 text-sm">{selectedPart.name || selectedPart.model}</p>
                                <p className="text-xs text-gray-500">
                                    {selectedPart.brand} • Estoque: <span className="font-bold text-amber-600">{selectedPart.stock} un</span>
                                </p>
                            </div>
                            <button onClick={() => setSelectedPart(null)} className="p-1.5 hover:bg-red-100 rounded-lg transition-all">
                                <X size={16} className="text-gray-400" />
                            </button>
                        </div>

                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
                            Quantas unidades deseja inserir nesta OS?
                        </p>

                        <div className="flex items-center justify-center gap-4 mb-4">
                            <button
                                onClick={() => setQuantityToAdd(Math.max(1, quantityToAdd - 1))}
                                className="h-10 w-10 flex items-center justify-center bg-white border-2 border-gray-200 rounded-xl hover:border-gray-400 transition-all active:scale-95 shadow-sm"
                                disabled={quantityToAdd <= 1}
                            >
                                <Minus size={16} />
                            </button>
                            <input
                                type="number"
                                value={quantityToAdd}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1;
                                    setQuantityToAdd(Math.max(1, Math.min(val, maxQty)));
                                }}
                                className="w-20 h-12 text-center text-2xl font-black bg-white border-2 border-amber-300 rounded-xl outline-none focus:border-amber-500 transition-all"
                                min={1}
                                max={maxQty}
                            />
                            <button
                                onClick={() => setQuantityToAdd(Math.min(maxQty, quantityToAdd + 1))}
                                className="h-10 w-10 flex items-center justify-center bg-white border-2 border-gray-200 rounded-xl hover:border-gray-400 transition-all active:scale-95 shadow-sm"
                                disabled={quantityToAdd >= maxQty}
                            >
                                <Plus size={16} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                            <span>Valor unitário: <span className="font-bold text-gray-800">{formatCurrency(selectedPart.salePrice || selectedPart.price || 0)}</span></span>
                            <span>Total: <span className="font-black text-emerald-600 text-sm">{formatCurrency((selectedPart.salePrice || selectedPart.price || 0) * quantityToAdd)}</span></span>
                        </div>

                        <button
                            onClick={handleConfirmQuantity}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-sm transition-all active:scale-[0.98] shadow-lg shadow-amber-200"
                        >
                            Adicionar {quantityToAdd} unidade{quantityToAdd > 1 ? 's' : ''} à OS
                        </button>
                    </div>
                )}

                {!selectedPart && (
                    <>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder={`Buscar ${type === 'service' ? 'serviço' : 'peça'}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-11 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all"
                                autoFocus
                            />
                        </div>

                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2">
                            {filteredItems.length > 0 ? (
                                filteredItems.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleSelectItem(item)}
                                        className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-accent hover:bg-accent/5 transition-all text-left group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${type === 'service' ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
                                                {type === 'service' ? <Wrench size={18} /> : <Package size={18} />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-primary group-hover:text-accent transition-colors">
                                                    {type === 'service' ? item.name : (item.name || item.model)}
                                                </p>
                                                <p className="text-xs text-secondary mt-1">
                                                    {type === 'service'
                                                        ? item.description || 'Sem descrição'
                                                        : `${item.brand || ''} ${item.category ? `· ${item.category}` : ''}`}
                                                </p>
                                                {type === 'part' && (
                                                    <p className={`text-[10px] mt-1 font-bold ${item.stock > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                        Estoque: {item.stock} un
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-primary">
                                                {formatCurrency(type === 'service' ? item.price : (item.salePrice || item.price))}
                                            </p>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Selecionar</p>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
                                    <Info size={32} />
                                    <p className="text-sm">Nenhum item encontrado.</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default ItemSelectionModal;
