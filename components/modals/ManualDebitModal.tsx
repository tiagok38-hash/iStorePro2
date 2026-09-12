import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Plus, CreditCard, User, Calendar, DollarSign, ChevronRight, Loader2, Tag } from 'lucide-react';
import { getCustomers, formatCurrency } from '../../services/mockApi';
import { addManualDebit } from '../../services/creditService';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';

interface ManualDebitModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const DEBIT_TYPES = [
    { label: 'Serviço', emoji: '🔧' },
    { label: 'Produto', emoji: '📦' },
    { label: 'Empréstimo', emoji: '💰' },
    { label: 'Conserto', emoji: '⚙️' },
    { label: 'Outro', emoji: '📝' },
];

const ManualDebitModal: React.FC<ManualDebitModalProps> = ({ onClose, onSuccess }) => {
    const { user } = useUser();
    const { showToast } = useToast();

    const [customers, setCustomers] = useState<any[]>([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const customerRef = useRef<HTMLDivElement>(null);

    const [debitDate, setDebitDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [selectedType, setSelectedType] = useState('');
    const [customType, setCustomType] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [installments, setInstallments] = useState(1);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getCustomers().then(setCustomers).catch(console.error);
    }, []);

    useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (customerRef.current && !customerRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    const filteredCustomers = useMemo(() => {
        if (!customerSearch.trim()) return customers.slice(0, 8);
        const lower = customerSearch.toLowerCase();
        return customers
            .filter(c => c.name?.toLowerCase().includes(lower) || c.phone?.includes(lower))
            .slice(0, 8);
    }, [customers, customerSearch]);

    const effectiveDescription = selectedType === 'Outro'
        ? customType.trim()
        : (customType.trim() ? `${selectedType} - ${customType.trim()}` : selectedType);

    const parsedAmount = parseFloat(totalAmount.replace(',', '.')) || 0;

    const installmentPreview = useMemo(() => {
        if (!debitDate || parsedAmount <= 0 || installments < 1) return [];
        const base = new Date(debitDate + 'T12:00:00');
        return Array.from({ length: Math.min(installments, 6) }, (_, k) => {
            const d = new Date(base);
            d.setMonth(d.getMonth() + k);
            return {
                num: k + 1,
                date: d.toLocaleDateString('pt-BR'),
                amount: Math.round((parsedAmount / installments) * 100) / 100,
            };
        });
    }, [debitDate, parsedAmount, installments]);

    const isValid = !!selectedCustomer && !!effectiveDescription && parsedAmount > 0 && installments >= 1;

    const handleSave = async () => {
        if (!isValid) return;
        setSaving(true);
        try {
            await addManualDebit(
                { customerId: selectedCustomer.id, debitDate, description: effectiveDescription, totalAmount: parsedAmount, installments },
                user?.id,
                user?.name
            );
            showToast('Débito criado com sucesso!', 'success');
            onSuccess();
            onClose();
        } catch (err: any) {
            showToast(err.message || 'Erro ao criar débito.', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up max-h-[95vh] flex flex-col">

                {/* Header gradient */}
                <div className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-6 pt-6 pb-8 flex-shrink-0">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-opacity='1'%3E%3Cpath d='M20 20.5V18H0v5h5v5H0v5h20v-9.5zM20 5.5V3H0v5h5v5H0v5h20V5.5z'/%3E%3C/g%3E%3C/svg%3E\")" }} />
                    <div className="relative flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                <CreditCard size={20} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white">Novo Débito Manual</h2>
                                <p className="text-violet-200 text-xs font-medium mt-0.5">Cadastro de crediário avulso</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                            <X size={16} className="text-white" />
                        </button>
                    </div>
                </div>

                {/* Form body */}
                <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

                    {/* Cliente */}
                    <div ref={customerRef} className="relative">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <User size={11} /> Cliente *
                        </label>
                        {selectedCustomer ? (
                            <div className="flex items-center gap-3 h-12 px-4 bg-violet-50 border-2 border-violet-200 rounded-2xl">
                                <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center font-black text-white text-sm flex-shrink-0">
                                    {selectedCustomer.name?.charAt(0)?.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-gray-900 truncate">{selectedCustomer.name}</p>
                                    {selectedCustomer.phone && <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>}
                                </div>
                                <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="text-gray-400 hover:text-red-500 transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    placeholder="Buscar cliente pelo nome ou telefone..."
                                    value={customerSearch}
                                    onChange={e => { setCustomerSearch(e.target.value); setShowDropdown(true); }}
                                    onFocus={() => setShowDropdown(true)}
                                    className="w-full h-12 px-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-sm font-medium outline-none focus:border-violet-400 focus:bg-white transition-all"
                                />
                                {showDropdown && filteredCustomers.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 max-h-52 overflow-y-auto">
                                        {filteredCustomers.map(c => (
                                            <button key={c.id} type="button"
                                                onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowDropdown(false); }}
                                                className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-violet-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
                                                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center font-black text-violet-700 text-sm flex-shrink-0">
                                                    {c.name?.charAt(0)?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-900">{c.name}</p>
                                                    {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Data */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Calendar size={11} /> Data do Débito
                        </label>
                        <input type="date" value={debitDate} onChange={e => setDebitDate(e.target.value)}
                            className="w-full h-12 px-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-sm font-medium outline-none focus:border-violet-400 focus:bg-white transition-all" />
                    </div>

                    {/* Tipo */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Tag size={11} /> Tipo de Débito *
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {DEBIT_TYPES.map(type => (
                                <button key={type.label} type="button"
                                    onClick={() => setSelectedType(prev => prev === type.label ? '' : type.label)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${selectedType === type.label
                                        ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200'
                                        : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600'}`}>
                                    <span>{type.emoji}</span> {type.label}
                                </button>
                            ))}
                        </div>
                        <input type="text"
                            placeholder={selectedType ? `Detalhes adicionais (opcional)` : 'Ou digite um nome personalizado...'}
                            value={customType} onChange={e => setCustomType(e.target.value)}
                            className="w-full h-10 px-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm outline-none focus:border-violet-400 focus:bg-white transition-all" />
                        {effectiveDescription && (
                            <p className="text-[11px] text-violet-600 font-bold mt-1.5 flex items-center gap-1">
                                <ChevronRight size={10} /> Identificação: "{effectiveDescription}"
                            </p>
                        )}
                    </div>

                    {/* Valor + Parcelas */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <DollarSign size={11} /> Valor Total *
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">R$</span>
                                <input type="text" inputMode="decimal" placeholder="0,00" value={totalAmount}
                                    onChange={e => setTotalAmount(e.target.value.replace(/[^0-9,.]/g, ''))}
                                    className="w-full h-12 pl-9 pr-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-sm font-bold outline-none focus:border-violet-400 focus:bg-white transition-all" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Parcelas</label>
                            <div className="flex items-center gap-1.5">
                                <button type="button" onClick={() => setInstallments(p => Math.max(1, p - 1))}
                                    className="w-10 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 text-xl font-bold text-gray-700 flex items-center justify-center transition-colors flex-shrink-0">−</button>
                                <input type="number" min={1} max={36} value={installments}
                                    onChange={e => setInstallments(Math.min(36, Math.max(1, Number(e.target.value))))}
                                    className="flex-1 h-12 text-center bg-gray-50 border-2 border-gray-200 rounded-xl text-base font-black outline-none focus:border-violet-400 transition-all" />
                                <button type="button" onClick={() => setInstallments(p => Math.min(36, p + 1))}
                                    className="w-10 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 text-xl font-bold text-gray-700 flex items-center justify-center transition-colors flex-shrink-0">+</button>
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    {installmentPreview.length > 0 && (
                        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl p-4">
                            <p className="text-xs font-black text-violet-700 uppercase tracking-wider mb-3">
                                Preview de parcelas
                                {installments > 6 && <span className="text-violet-400 font-normal ml-1">(6 de {installments})</span>}
                            </p>
                            <div className="space-y-2">
                                {installmentPreview.map(p => (
                                    <div key={p.num} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center">
                                                <span className="text-[10px] font-black text-violet-700">{p.num}</span>
                                            </div>
                                            <span className="text-sm text-gray-600 font-medium">{p.date}</span>
                                        </div>
                                        <span className="text-sm font-black text-gray-900">{formatCurrency(p.amount)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 pt-3 border-t border-violet-100 flex justify-between items-center">
                                <span className="text-xs font-bold text-violet-600">Total</span>
                                <span className="text-base font-black text-violet-700">{formatCurrency(parsedAmount)}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-6 pb-6 pt-3 flex gap-3 border-t border-gray-100 bg-white">
                    <button onClick={onClose}
                        className="flex-1 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 text-sm font-bold text-gray-700 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={!isValid || saving}
                        className="flex-[2] h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-sm font-black text-white shadow-lg shadow-violet-300/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
                        {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : <><Plus size={16} /> Criar Débito</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManualDebitModal;
