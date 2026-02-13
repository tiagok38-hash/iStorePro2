
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    getCrmDeals, addCrmDeal, updateCrmDeal, deleteCrmDeal,
    getCrmActivities, addCrmActivity, formatCurrency, getCustomers,
} from '../services/mockApi.ts';
import { CrmDeal, CrmActivity, CrmColumn, CrmPriority, CrmOrigin, Customer } from '../types.ts';
import {
    PlusIcon, SearchIcon, CloseIcon, CheckIcon, TrashIcon,
} from './icons.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import {
    Sparkles, MessageCircle, Package, Clock, CheckCircle2, Archive,
    Phone, Flame, Snowflake, Thermometer, Send, Calendar,
    MoreVertical, ExternalLink, Instagram, Globe, User as UserIcon,
    ChevronDown, AlertCircle, Pencil, MessageSquare, History
} from 'lucide-react';

// ============================================================
// Constants
// ============================================================
const COLUMNS: { id: CrmColumn; label: string; color: string; bgLight: string; icon: React.ReactNode }[] = [
    { id: 'new_leads', label: 'Novos Leads', color: 'text-blue-600', bgLight: 'bg-blue-50 border-blue-200', icon: <Sparkles size={16} className="text-blue-500" /> },
    { id: 'negotiating', label: 'Em Negociação', color: 'text-amber-600', bgLight: 'bg-amber-50 border-amber-200', icon: <MessageCircle size={16} className="text-amber-500" /> },
    { id: 'awaiting_stock', label: 'Aguardando Estoque', color: 'text-purple-600', bgLight: 'bg-purple-50 border-purple-200', icon: <Package size={16} className="text-purple-500" /> },
    { id: 'awaiting_payment', label: 'Aguardando Pagamento', color: 'text-orange-600', bgLight: 'bg-orange-50 border-orange-200', icon: <Clock size={16} className="text-orange-500" /> },
    { id: 'won', label: 'Venda Concluída', color: 'text-emerald-600', bgLight: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle2 size={16} className="text-emerald-500" /> },
    { id: 'lost', label: 'Perdido / Arquivado', color: 'text-gray-500', bgLight: 'bg-gray-50 border-gray-200', icon: <Archive size={16} className="text-gray-400" /> },
];

const ORIGINS: { value: CrmOrigin; label: string; icon: React.ReactNode }[] = [
    { value: 'instagram', label: 'Instagram', icon: <Instagram size={14} /> },
    { value: 'whatsapp', label: 'WhatsApp', icon: <Phone size={14} /> },
    { value: 'indicacao', label: 'Indicação', icon: <UserIcon size={14} /> },
    { value: 'passante', label: 'Passante', icon: <ExternalLink size={14} /> },
    { value: 'olx', label: 'OLX', icon: <Globe size={14} /> },
    { value: 'site', label: 'Site', icon: <Globe size={14} /> },
    { value: 'outro', label: 'Outro', icon: <MoreVertical size={14} /> },
];

const PRIORITY_CONFIG: Record<CrmPriority, { label: string; emoji: string; cls: string; ring: string }> = {
    hot: { label: 'Quente', emoji: '🔥', cls: 'bg-red-100 text-red-700', ring: 'ring-red-200' },
    warm: { label: 'Morno', emoji: '😐', cls: 'bg-amber-100 text-amber-700', ring: 'ring-amber-200' },
    cold: { label: 'Frio', emoji: '❄️', cls: 'bg-blue-100 text-blue-700', ring: 'ring-blue-200' },
};

// ============================================================
// Deal Card
// ============================================================
const DealCard: React.FC<{
    deal: CrmDeal;
    onEdit: (deal: CrmDeal) => void;
    onDelete: (deal: CrmDeal) => void;
    onStatusToggle: (deal: CrmDeal, newStatus: CrmColumn) => void;
}> = ({ deal, onEdit, onDelete, onStatusToggle }) => {
    const [showActions, setShowActions] = useState(false);
    const actionsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
                setShowActions(false);
            }
        };
        if (showActions) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showActions]);

    const prio = PRIORITY_CONFIG[deal.priority];
    const initials = (deal.client_name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    const hasFollowUp = deal.follow_up_date && new Date(deal.follow_up_date) > new Date();
    const isOverdueFollowUp = deal.follow_up_date && new Date(deal.follow_up_date) < new Date();

    const handleWhatsApp = (e: React.MouseEvent) => {
        e.stopPropagation();
        const phone = (deal.client_phone || '').replace(/\D/g, '');
        const product = deal.product_interest || 'nossos produtos';
        const msg = encodeURIComponent(`Olá ${deal.client_name || ''}! 😊 Vi que você se interessou pelo ${product}. Posso te ajudar com mais informações?`);
        window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
    };

    return (
        <div
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData('dealId', deal.id);
                e.dataTransfer.effectAllowed = 'move';
                (e.target as HTMLElement).style.opacity = '0.5';
            }}
            onDragEnd={(e) => {
                (e.target as HTMLElement).style.opacity = '1';
            }}
            className="group bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm hover:shadow-md hover:border-gray-200 cursor-grab active:cursor-grabbing transition-all duration-200 relative"
        >
            {/* Header Row: Avatar + Name + Actions */}
            <div className="flex items-start gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-[11px] font-black flex-shrink-0 shadow-sm">
                    {initials}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-primary truncate">{deal.client_name || 'Sem nome'}</p>
                    {deal.product_interest && (
                        <p className="text-[11px] text-muted truncate mt-0.5">{deal.product_interest}</p>
                    )}
                </div>
                <div className="relative" ref={actionsRef}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
                        className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                        <MoreVertical size={14} />
                    </button>
                    {showActions && (
                        <div className="absolute right-0 top-7 w-36 bg-white rounded-xl shadow-xl border border-gray-100 z-30 py-1 animate-fade-in">
                            <button onClick={(e) => { e.stopPropagation(); onEdit(deal); setShowActions(false); }} className="w-full text-left px-3 py-2 text-xs font-bold text-primary hover:bg-gray-50 flex items-center gap-2">
                                <Pencil size={12} /> Editar
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onDelete(deal); setShowActions(false); }} className="w-full text-left px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2">
                                <TrashIcon className="h-3 w-3" /> Excluir
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Value + Priority */}
            <div className="flex items-center justify-between mb-2">
                {deal.value > 0 && (
                    <span className="text-sm font-black text-primary">{formatCurrency(deal.value)}</span>
                )}
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${prio.cls} ${prio.ring}`}>
                    {prio.emoji} {prio.label}
                </span>
            </div>

            {/* Meta tags */}
            <div className="flex flex-wrap items-center gap-1.5">
                {deal.origin && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                        {ORIGINS.find(o => o.value === deal.origin)?.icon}
                        {ORIGINS.find(o => o.value === deal.origin)?.label}
                    </span>
                )}
                {hasFollowUp && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100">
                        <Calendar size={9} /> Follow-up
                    </span>
                )}
                {isOverdueFollowUp && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 animate-pulse">
                        <AlertCircle size={9} /> Atrasado
                    </span>
                )}
            </div>

            {/* Hover Actions */}
            <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-gray-50 opacity-0 group-hover:opacity-100 transition-all">
                {deal.client_phone && (
                    <button
                        onClick={handleWhatsApp}
                        className="flex-1 h-7 rounded-lg bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-emerald-600 shadow-sm shadow-emerald-200 transition-all"
                    >
                        <Send size={10} /> WhatsApp
                    </button>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(deal); }}
                    className="flex-1 h-7 rounded-lg bg-gray-100 text-gray-700 text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-gray-200 transition-all"
                >
                    <Pencil size={10} /> Editar
                </button>
            </div>
        </div>
    );
};

// ============================================================
// Deal Modal
// ============================================================
interface DealModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<CrmDeal>) => Promise<void>;
    editData?: CrmDeal | null;
    customers: Customer[];
}

const DealModal: React.FC<DealModalProps> = ({ isOpen, onClose, onSave, editData, customers }) => {
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientId, setClientId] = useState<string | undefined>();
    const [productInterest, setProductInterest] = useState('');
    const [value, setValue] = useState('');
    const [priority, setPriority] = useState<CrmPriority>('warm');
    const [origin, setOrigin] = useState<CrmOrigin | ''>('');
    const [followUpDate, setFollowUpDate] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

    useEffect(() => {
        if (editData) {
            setClientName(editData.client_name || '');
            setClientPhone(editData.client_phone || '');
            setClientId(editData.client_id);
            setProductInterest(editData.product_interest || '');
            setValue(editData.value ? String(editData.value) : '');
            setPriority(editData.priority);
            setOrigin(editData.origin || '');
            setFollowUpDate(editData.follow_up_date ? editData.follow_up_date.substring(0, 16) : '');
            setNotes(editData.notes || '');
        } else {
            setClientName('');
            setClientPhone('');
            setClientId(undefined);
            setProductInterest('');
            setValue('');
            setPriority('warm');
            setOrigin('');
            setFollowUpDate('');
            setNotes('');
        }
        setCustomerSearch('');
        setShowCustomerDropdown(false);
    }, [editData, isOpen]);

    const filteredCustomers = useMemo(() => {
        if (!customerSearch.trim()) return [];
        return customers
            .filter(c => c.active !== false && (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()))
            .slice(0, 8);
    }, [customerSearch, customers]);

    const selectCustomer = (c: Customer) => {
        setClientId(c.id);
        setClientName(c.name);
        setClientPhone(c.phone || '');
        setCustomerSearch('');
        setShowCustomerDropdown(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName.trim()) return;
        setSaving(true);
        try {
            await onSave({
                ...(editData ? { id: editData.id } : {}),
                client_id: clientId,
                client_name: clientName.trim(),
                client_phone: clientPhone.trim() || undefined,
                product_interest: productInterest.trim() || undefined,
                value: parseFloat(value) || 0,
                priority,
                origin: origin || undefined,
                follow_up_date: followUpDate || undefined,
                notes: notes.trim() || undefined,
                status_column: editData?.status_column || 'new_leads',
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-border">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-sm">
                                <Sparkles size={18} className="text-white" />
                            </div>
                            <h2 className="text-lg font-black text-primary">{editData ? 'Editar Lead' : 'Novo Lead'}</h2>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-secondary transition-colors">
                            <CloseIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
                    {/* Customer Search */}
                    <div className="relative">
                        <label className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Cliente *</label>
                        <input
                            type="text"
                            value={clientName}
                            onChange={e => {
                                setClientName(e.target.value);
                                setCustomerSearch(e.target.value);
                                setClientId(undefined);
                                setShowCustomerDropdown(true);
                            }}
                            onFocus={() => { if (customerSearch) setShowCustomerDropdown(true); }}
                            placeholder="Buscar ou digitar nome..."
                            className="w-full h-11 px-4 bg-gray-50 border border-border rounded-xl text-sm font-medium focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all"
                            required
                        />
                        {showCustomerDropdown && filteredCustomers.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-40 max-h-48 overflow-y-auto">
                                {filteredCustomers.map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => selectCustomer(c)}
                                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 text-[10px] font-black">
                                            {(c.name || '?')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-primary">{c.name}</p>
                                            {c.phone && <p className="text-[10px] text-muted">{c.phone}</p>}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        {clientId && (
                            <span className="absolute right-3 top-[38px] text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                ✓ Vinculado
                            </span>
                        )}
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Telefone (WhatsApp)</label>
                        <input
                            type="text"
                            value={clientPhone}
                            onChange={e => setClientPhone(e.target.value)}
                            placeholder="(11) 99999-9999"
                            className="w-full h-11 px-4 bg-gray-50 border border-border rounded-xl text-sm font-medium focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all"
                        />
                    </div>

                    {/* Product + Value */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Produto de Interesse</label>
                            <input
                                type="text"
                                value={productInterest}
                                onChange={e => setProductInterest(e.target.value)}
                                placeholder="iPhone 15 Pro Max..."
                                className="w-full h-11 px-4 bg-gray-50 border border-border rounded-xl text-sm font-medium focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Valor Estimado (R$)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">R$</span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={value}
                                    onChange={e => setValue(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
                                    placeholder="0,00"
                                    className="w-full h-11 pl-10 pr-4 bg-gray-50 border border-border rounded-xl text-sm font-bold focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Priority */}
                    <div>
                        <label className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Temperatura do Lead</label>
                        <div className="flex gap-2">
                            {(['hot', 'warm', 'cold'] as CrmPriority[]).map(p => {
                                const cfg = PRIORITY_CONFIG[p];
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPriority(p)}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ring-1 ${priority === p
                                            ? `${cfg.cls} ${cfg.ring} shadow-sm`
                                            : 'bg-gray-50 text-gray-400 ring-gray-100 hover:bg-gray-100'
                                            }`}
                                    >
                                        {cfg.emoji} {cfg.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Origin + Follow-up */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Origem</label>
                            <select
                                value={origin}
                                onChange={e => setOrigin(e.target.value as CrmOrigin)}
                                className="w-full h-11 px-3 bg-gray-50 border border-border rounded-xl text-sm font-medium focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all appearance-none cursor-pointer"
                            >
                                <option value="">Selecione...</option>
                                {ORIGINS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Agendar Follow-up</label>
                            <input
                                type="datetime-local"
                                value={followUpDate}
                                onChange={e => setFollowUpDate(e.target.value)}
                                className="w-full h-11 px-3 bg-gray-50 border border-border rounded-xl text-sm font-medium focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Observações</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Ex: Cliente quer dar iPhone 11 na troca, enviar orçamento até sexta..."
                            rows={3}
                            className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm font-medium focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all resize-none"
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex gap-3">
                    <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-bold text-secondary hover:bg-gray-50 transition-all">
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={saving || !clientName.trim()}
                        className="flex-1 h-11 rounded-xl bg-accent text-white text-sm font-bold shadow-lg shadow-accent/25 hover:shadow-xl hover:shadow-accent/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <CheckIcon className="h-4 w-4" />}
                        {editData ? 'Salvar' : 'Criar Lead'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// Conversion Modal (when moved to 'won')
// ============================================================
const ConversionModal: React.FC<{
    deal: CrmDeal | null;
    onClose: () => void;
}> = ({ deal, onClose }) => {
    if (!deal) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-emerald-100 rounded-xl">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-black text-primary">Venda Concluída! 🎉</h3>
                </div>
                <p className="text-sm text-secondary mb-2">
                    <strong>{deal.client_name}</strong> — {deal.product_interest || 'Produto'} ({formatCurrency(deal.value)})
                </p>
                <p className="text-sm text-muted mb-6">
                    Deseja gerar um registro para este cliente agora?
                </p>
                <div className="space-y-2">
                    <a
                        href={`/vendas`}
                        className="w-full h-11 rounded-xl bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                    >
                        <CheckCircle2 size={16} /> Gerar Nova Venda
                    </a>
                    <a
                        href={`/service-orders`}
                        className="w-full h-11 rounded-xl bg-violet-500 text-white text-sm font-bold shadow-lg shadow-violet-200 hover:bg-violet-600 transition-all flex items-center justify-center gap-2"
                    >
                        <MessageSquare size={16} /> Gerar Ordem de Serviço
                    </a>
                    <button
                        onClick={onClose}
                        className="w-full h-11 rounded-xl border border-border text-sm font-bold text-secondary hover:bg-gray-50 transition-all"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// Delete Confirmation
// ============================================================
const DeleteDealModal: React.FC<{
    deal: CrmDeal | null;
    onClose: () => void;
    onConfirm: () => void;
    deleting: boolean;
}> = ({ deal, onClose, onConfirm, deleting }) => {
    if (!deal) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-red-100 rounded-xl">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <h3 className="text-lg font-black text-primary">Excluir Lead</h3>
                </div>
                <p className="text-sm text-secondary mb-6">
                    Tem certeza que deseja excluir <strong>"{deal.client_name}"</strong>? Esta ação não pode ser desfeita.
                </p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-bold text-secondary hover:bg-gray-50 transition-all">Cancelar</button>
                    <button onClick={onConfirm} disabled={deleting} className="flex-1 h-11 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {deleting ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <TrashIcon className="h-4 w-4" />}
                        Excluir
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// Main Kanban Board
// ============================================================
interface CrmKanbanBoardProps {
    customers: Customer[];
}

const CrmKanbanBoard: React.FC<CrmKanbanBoardProps> = ({ customers }) => {
    const { user } = useUser();
    const { showToast } = useToast();

    const [deals, setDeals] = useState<CrmDeal[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMyLeads, setFilterMyLeads] = useState(false);

    // Modals
    const [modalOpen, setModalOpen] = useState(false);
    const [editDeal, setEditDeal] = useState<CrmDeal | null>(null);
    const [deleteDeal, setDeleteDeal] = useState<CrmDeal | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [conversionDeal, setConversionDeal] = useState<CrmDeal | null>(null);

    // Drag state
    const [dragOverColumn, setDragOverColumn] = useState<CrmColumn | null>(null);

    const loadDeals = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getCrmDeals({
                search: searchTerm || undefined,
                assigned_to: filterMyLeads && user ? user.id : undefined,
            });
            setDeals(data);
        } catch (err) {
            console.error('Error loading CRM deals:', err);
            showToast('Erro ao carregar pipeline CRM', 'error');
        } finally {
            setLoading(false);
        }
    }, [searchTerm, filterMyLeads, user]);

    useEffect(() => { loadDeals(); }, [loadDeals]);

    // Group deals by column
    const columnDeals = useMemo(() => {
        const map: Record<CrmColumn, CrmDeal[]> = {
            new_leads: [], negotiating: [], awaiting_stock: [],
            awaiting_payment: [], won: [], lost: [],
        };
        deals.forEach(d => {
            if (map[d.status_column]) map[d.status_column].push(d);
        });
        return map;
    }, [deals]);

    // Column stats
    const columnStats = useMemo(() => {
        const stats: Record<CrmColumn, { count: number; value: number }> = {} as any;
        COLUMNS.forEach(col => {
            const colDeals = columnDeals[col.id];
            stats[col.id] = {
                count: colDeals.length,
                value: colDeals.reduce((s, d) => s + d.value, 0),
            };
        });
        return stats;
    }, [columnDeals]);

    // Handlers
    const handleSave = async (data: Partial<CrmDeal>) => {
        try {
            if ((data as any).id) {
                await updateCrmDeal((data as any).id, data, user?.id, user?.name);
                showToast('Lead atualizado!', 'success');
            } else {
                await addCrmDeal(data, user?.id, user?.name);
                showToast('Novo lead criado!', 'success');
            }
            await loadDeals();
        } catch (err) {
            showToast('Erro ao salvar lead', 'error');
            throw err;
        }
    };

    const handleDelete = async () => {
        if (!deleteDeal) return;
        setDeleting(true);
        try {
            await deleteCrmDeal(deleteDeal.id);
            showToast('Lead excluído!', 'success');
            setDeleteDeal(null);
            await loadDeals();
        } catch (err) {
            showToast('Erro ao excluir lead', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const handleDrop = async (dealId: string, newColumn: CrmColumn) => {
        setDragOverColumn(null);
        const deal = deals.find(d => d.id === dealId);
        if (!deal || deal.status_column === newColumn) return;

        // Optimistic update
        setDeals(prev => prev.map(d => d.id === dealId ? { ...d, status_column: newColumn } : d));

        try {
            await updateCrmDeal(dealId, { status_column: newColumn }, user?.id, user?.name);

            // If moved to 'won', show conversion modal
            if (newColumn === 'won') {
                setConversionDeal({ ...deal, status_column: 'won' });
            }

            // Add activity log
            const fromLabel = COLUMNS.find(c => c.id === deal.status_column)?.label;
            const toLabel = COLUMNS.find(c => c.id === newColumn)?.label;
            await addCrmActivity({
                deal_id: dealId,
                type: 'status_change',
                content: `Movido de "${fromLabel}" para "${toLabel}"`,
                created_by: user?.id,
                created_by_name: user?.name,
            });
        } catch (err) {
            showToast('Erro ao mover lead', 'error');
            await loadDeals(); // Revert
        }
    };

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg shadow-purple-200">
                        <Sparkles size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-primary tracking-tight">Pipeline de Vendas</h2>
                        <p className="text-[11px] text-muted font-medium">{deals.length} oportunidades • {formatCurrency(deals.reduce((s, d) => s + d.value, 0))} em pipeline</p>
                    </div>
                </div>
                <button
                    onClick={() => { setEditDeal(null); setModalOpen(true); }}
                    className="flex items-center justify-center gap-2 h-11 px-5 bg-accent text-white rounded-2xl font-bold text-sm shadow-lg shadow-accent/25 hover:shadow-xl hover:shadow-accent/30 active:scale-[0.98] transition-all"
                >
                    <PlusIcon className="h-4 w-4" /> Novo Lead
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-xs">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted h-4 w-4" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Buscar lead, produto..."
                        className="w-full h-9 pl-9 pr-3 bg-gray-50 border border-border rounded-xl text-sm focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all"
                    />
                </div>
                <button
                    onClick={() => setFilterMyLeads(!filterMyLeads)}
                    className={`h-9 px-3 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${filterMyLeads
                        ? 'bg-violet-500 text-white border-violet-600 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border-border hover:bg-gray-100'
                        }`}
                >
                    <UserIcon size={13} /> Meus Leads
                </button>
            </div>

            {/* Kanban Board */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <span className="animate-spin w-8 h-8 border-3 border-accent/20 border-t-accent rounded-full"></span>
                </div>
            ) : (
                <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 lg:mx-0 lg:px-0" style={{ minHeight: '60vh' }}>
                    {COLUMNS.map(col => {
                        const stats = columnStats[col.id];
                        const colDeals = columnDeals[col.id];
                        const isDragOver = dragOverColumn === col.id;

                        return (
                            <div
                                key={col.id}
                                className={`flex-shrink-0 w-[280px] lg:flex-1 lg:min-w-[220px] flex flex-col rounded-2xl border transition-all duration-200 ${isDragOver
                                    ? `${col.bgLight} border-2 shadow-md scale-[1.01]`
                                    : 'bg-gray-50/50 border-gray-100'
                                    }`}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    setDragOverColumn(col.id);
                                }}
                                onDragLeave={() => setDragOverColumn(null)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const dealId = e.dataTransfer.getData('dealId');
                                    if (dealId) handleDrop(dealId, col.id);
                                }}
                            >
                                {/* Column Header */}
                                <div className="px-3 py-3 border-b border-gray-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        {col.icon}
                                        <span className={`text-xs font-black uppercase tracking-wider ${col.color}`}>{col.label}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-muted font-bold">
                                        <span className="bg-white/80 px-2 py-0.5 rounded-full border border-gray-100">{stats.count}</span>
                                        {stats.value > 0 && <span>{formatCurrency(stats.value)}</span>}
                                    </div>
                                </div>

                                {/* Cards */}
                                <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(60vh - 80px)' }}>
                                    {colDeals.length === 0 ? (
                                        <div className={`flex flex-col items-center justify-center py-8 text-center rounded-xl border-2 border-dashed transition-colors ${isDragOver ? 'border-accent/50 bg-accent/5' : 'border-gray-200'}`}>
                                            <p className="text-[11px] text-muted font-medium">Arraste cards aqui</p>
                                        </div>
                                    ) : (
                                        colDeals.map(deal => (
                                            <DealCard
                                                key={deal.id}
                                                deal={deal}
                                                onEdit={(d) => { setEditDeal(d); setModalOpen(true); }}
                                                onDelete={setDeleteDeal}
                                                onStatusToggle={handleDrop as any}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modals */}
            <DealModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditDeal(null); }}
                onSave={handleSave}
                editData={editDeal}
                customers={customers}
            />
            <DeleteDealModal
                deal={deleteDeal}
                onClose={() => setDeleteDeal(null)}
                onConfirm={handleDelete}
                deleting={deleting}
            />
            <ConversionModal
                deal={conversionDeal}
                onClose={() => setConversionDeal(null)}
            />
        </div>
    );
};

export default CrmKanbanBoard;
