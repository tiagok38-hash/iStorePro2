
import React, { useState } from 'react';
import { Search, X, Wrench, Package, Info } from 'lucide-react';
import Modal from './Modal';
import { formatCurrency } from '../services/mockApi';

interface ItemSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    items: any[];
    type: 'part' | 'service';
    onSelect: (item: any) => void;
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

    const filteredItems = items.filter(item => {
        const search = searchTerm.toLowerCase();
        if (type === 'service') {
            return item.name.toLowerCase().includes(search) ||
                (item.description && item.description.toLowerCase().includes(search));
        } else {
            return item.model.toLowerCase().includes(search) ||
                (item.brand && item.brand.toLowerCase().includes(search)) ||
                (item.serialNumber && item.serialNumber.toLowerCase().includes(search)) ||
                (item.imei1 && item.imei1.toLowerCase().includes(search));
        }
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="space-y-4">
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
                                onClick={() => {
                                    onSelect(item);
                                    onClose();
                                }}
                                className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-accent hover:bg-accent/5 transition-all text-left group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${type === 'service' ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
                                        {type === 'service' ? <Wrench size={18} /> : <Package size={18} />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-primary group-hover:text-accent transition-colors">
                                            {type === 'service' ? item.name : item.model}
                                        </p>
                                        <p className="text-xs text-secondary mt-1">
                                            {type === 'service'
                                                ? item.description || 'Sem descrição'
                                                : `${item.brand} ${item.storage ? ` - ${item.storage}GB` : ''}`}
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
                                        {formatCurrency(item.price)}
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
            </div>
        </Modal>
    );
};

export default ItemSelectionModal;
