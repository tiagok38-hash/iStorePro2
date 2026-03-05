import React, { useState, useEffect } from 'react';
import { X, Smartphone, Save, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { CustomerDevice, Customer } from '../types';
import { addCustomerDevice } from '../services/mockApi';
import { useToast } from '../contexts/ToastContext';

interface CustomerDeviceModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: Customer | null;
    onSuccess: (device: CustomerDevice) => void;
}

const CustomerDeviceModal: React.FC<CustomerDeviceModalProps> = ({ isOpen, onClose, customer, onSuccess }) => {
    const { showToast } = useToast();
    const [brand, setBrand] = useState('Apple');
    const [category, setCategory] = useState('');
    const [model, setModel] = useState('');
    const [imei, setImei] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [observations, setObservations] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Mock options for Apple since they want Apple hierarchical filters
    const appleCategories = ['iPhone', 'iPad', 'MacBook', 'Apple Watch', 'AirPods'];
    const appleModels: Record<string, string[]> = {
        'iPhone': ['iPhone 11', 'iPhone 12', 'iPhone 13', 'iPhone 14', 'iPhone 15', 'iPhone 16'],
        'iPad': ['iPad Air', 'iPad Pro', 'iPad Mini'],
        'MacBook': ['MacBook Air', 'MacBook Pro'],
        'Apple Watch': ['Series 7', 'Series 8', 'Series 9', 'Ultra'],
        'AirPods': ['AirPods 2', 'AirPods 3', 'AirPods Pro']
    };

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!customer) {
            showToast('Selecione um cliente primeiro.', 'error');
            return;
        }
        if (!brand || !category || !model) {
            showToast('Marca, categoria e modelo são obrigatórios.', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const device = await addCustomerDevice({
                customerId: customer.id,
                brand,
                category,
                model,
                imei,
                serialNumber,
                observations
            });
            showToast('Aparelho cadastrado com sucesso!', 'success');
            onSuccess(device);
            onClose();
        } catch (error: any) {
            showToast('Erro ao cadastrar aparelho.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent/10 rounded-xl text-accent">
                            <Smartphone size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-primary">Novo Aparelho</h2>
                            <p className="text-xs text-secondary">
                                Cliente: {customer?.name || 'Não selecionado'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${brand === 'Apple' ? 'border-accent bg-accent/5' : 'border-gray-200 hover:border-accent/40'}`} onClick={() => { setBrand('Apple'); setCategory(''); setModel(''); }}>
                            <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" alt="Apple" className="h-8" />
                            <span className="font-bold text-sm">Produto Apple</span>
                        </label>
                        <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${brand !== 'Apple' ? 'border-accent bg-accent/5' : 'border-gray-200 hover:border-accent/40'}`} onClick={() => { setBrand('Outros'); setCategory(''); setModel(''); }}>
                            <ShieldCheck size={32} className={brand !== 'Apple' ? 'text-accent' : 'text-gray-400'} />
                            <span className="font-bold text-sm">Outras Marcas</span>
                        </label>
                    </div>

                    {brand === 'Apple' ? (
                        <>
                            <div>
                                <label className="block text-sm font-bold text-primary mb-2">Categoria</label>
                                <select value={category} onChange={e => { setCategory(e.target.value); setModel(''); }} className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-accent">
                                    <option value="">Selecione...</option>
                                    {appleCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            {category && (
                                <div>
                                    <label className="block text-sm font-bold text-primary mb-2">Modelo</label>
                                    <select value={model} onChange={e => setModel(e.target.value)} className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-accent">
                                        <option value="">Selecione...</option>
                                        {(appleModels[category] || []).map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-bold text-primary mb-2">Marca</label>
                                <input placeholder="Ex: Samsung" value={brand === 'Outros' ? '' : brand} onChange={e => setBrand(e.target.value)} className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-accent" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-primary mb-2">Categoria</label>
                                <input placeholder="Ex: Smartphone" value={category} onChange={e => setCategory(e.target.value)} className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-accent" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-primary mb-2">Modelo</label>
                                <input placeholder="Ex: Galaxy S23" value={model} onChange={e => setModel(e.target.value)} className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-accent" />
                            </div>
                        </>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                        <div>
                            <label className="block text-sm font-bold text-primary mb-2">IMEI</label>
                            <input value={imei} onChange={e => setImei(e.target.value)} placeholder="Opcional" className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-accent font-mono" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-primary mb-2">Serial Number</label>
                            <input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="Opcional" className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-accent font-mono" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-primary mb-2">Observações</label>
                        <textarea value={observations} onChange={e => setObservations(e.target.value)} rows={3} placeholder="Condições adicionais do aparelho..." className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-accent resize-none" />
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white">
                    <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-secondary hover:bg-gray-100 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={isLoading} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-accent shadow-lg shadow-accent/20 hover:scale-105 transition-all flex items-center gap-2">
                        <Save size={18} />
                        {isLoading ? 'Salvando...' : 'Salvar Aparelho'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomerDeviceModal;
