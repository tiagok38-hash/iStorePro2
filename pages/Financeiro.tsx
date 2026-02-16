import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    getTransactionCategories,
    getFinancialTransactions,
    addFinancialTransaction,
    updateFinancialTransaction,
    deleteFinancialTransaction,
    formatCurrency,
    getPaymentMethods,
    getSales,
    getCreditInstallments,
    getProducts,
    getPurchaseOrders,
} from '../services/mockApi.ts';
import { TransactionCategory, FinancialTransaction, PaymentMethodParameter, Sale, CreditInstallment, Product, PurchaseOrder } from '../types.ts';
import {
    PlusIcon, SearchIcon, FilterIcon, CloseIcon, CheckIcon, TrashIcon, WalletIcon,
    ChartBarIcon, CalendarDaysIcon
} from '../components/icons.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import {
    TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle,
    AlertTriangle, Receipt, Pencil, Edit3Icon, Eye as EyeIcon, ChevronLeft, ChevronRight, CreditCard
} from 'lucide-react';
import CreditDashboard from '../components/CreditDashboard.tsx';

// ============================================================
// Helper
// ============================================================
const fmtDate = (d: string) => {
    if (!d) return '—';
    let datePart = d;
    if (d.includes('T')) {
        datePart = d.split('T')[0];
    }
    const parts = datePart.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return new Date(d).toLocaleDateString('pt-BR');
};

const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const monthStartISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const monthEndISO = () => {
    const d = new Date();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
};

// ============================================================
// Status Badge
// ============================================================
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const map: Record<string, { label: string; cls: string }> = {
        paid: { label: 'Pago', cls: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
        pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 ring-amber-200' },
        overdue: { label: 'Atrasado', cls: 'bg-red-100 text-red-700 ring-red-200' },
    };
    const s = map[status] || map.pending;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ring-1 ${s.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'paid' ? 'bg-emerald-500' : status === 'overdue' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
            {s.label}
        </span>
    );
};

// ============================================================
// KPI Card
// ============================================================
const KPICard: React.FC<{
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ReactNode;
    iconBg: string;
    trend?: 'up' | 'down';
    trendLabel?: string;
    className?: string;
}> = ({ title, value, subtitle, icon, iconBg, trend, trendLabel, className }) => (
    <div className={`p-5 bg-surface rounded-3xl border border-border shadow-sm flex flex-col gap-3 transition-all duration-300 hover:shadow-md group ${className || ''}`}>
        <div className="flex items-center justify-between">
            <div className={`p-2.5 rounded-xl shadow-sm ${iconBg}`}>
                {icon}
            </div>
            {trend && (
                <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {trendLabel}
                </span>
            )}
        </div>
        <div>
            <p className="text-[11px] font-bold text-secondary uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-black text-primary tracking-tight mt-0.5">{value}</p>
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
    </div>
);

// ============================================================
// Transaction Modal
// ============================================================
interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<FinancialTransaction>) => Promise<void>;
    categories: TransactionCategory[];
    paymentMethods: string[];
    editData?: FinancialTransaction | null;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, onSave, categories, paymentMethods, editData }) => {
    const formatToBRL = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    };

    const [type, setType] = useState<'income' | 'expense'>(editData?.type || 'expense');
    const [description, setDescription] = useState(editData?.description || '');
    const [amount, setAmount] = useState(editData ? formatToBRL(editData.amount) : '');
    const [categoryId, setCategoryId] = useState(editData?.category_id || '');
    const [dueDate, setDueDate] = useState(editData?.due_date || todayISO());
    const [paymentDate, setPaymentDate] = useState(editData?.payment_date || '');
    const [status, setStatus] = useState<'pending' | 'paid' | 'overdue'>(editData?.status || 'pending');
    const [paymentMethod, setPaymentMethod] = useState(editData?.payment_method || '');
    const [entityName, setEntityName] = useState(editData?.entity_name || '');
    const [isRecurring, setIsRecurring] = useState(editData?.is_recurring || false);
    const [recurrenceInterval, setRecurrenceInterval] = useState(editData?.recurrence_interval || 'monthly');
    const [notes, setNotes] = useState(editData?.notes || '');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (editData) {
            setType(editData.type);
            setDescription(editData.description);
            setAmount(formatToBRL(editData.amount));
            setCategoryId(editData.category_id);
            setDueDate(editData.due_date);
            setPaymentDate(editData.payment_date || '');
            setStatus(editData.status);
            setPaymentMethod(editData.payment_method || '');
            setEntityName(editData.entity_name || '');
            setIsRecurring(editData.is_recurring);
            setRecurrenceInterval(editData.recurrence_interval || 'monthly');
            setNotes(editData.notes || '');
        } else {
            setType('expense');
            setDescription('');
            setAmount('');
            setCategoryId('');
            setDueDate(todayISO());
            setPaymentDate('');
            setStatus('pending');
            setPaymentMethod('');
            setEntityName('');
            setIsRecurring(false);
            setRecurrenceInterval('monthly');
            setNotes('');
        }
    }, [editData, isOpen]);

    const filteredCategories = useMemo(() => categories.filter(c => c.type === type), [categories, type]);
    const groupedCategories = useMemo(() => {
        const groups: Record<string, TransactionCategory[]> = {};
        filteredCategories.forEach(c => {
            if (!groups[c.group_name]) groups[c.group_name] = [];
            groups[c.group_name].push(c);
        });
        return groups;
    }, [filteredCategories]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim() || !amount || !categoryId || !dueDate) return;
        setSaving(true);
        try {
            await onSave({
                ...(editData ? { id: editData.id } : {}),
                type,
                description: description.trim(),
                amount: parseFloat(amount.replace(/\./g, '').replace(',', '.')),
                category_id: categoryId,
                due_date: dueDate,
                payment_date: paymentDate || undefined,
                status,
                payment_method: paymentMethod || undefined,
                entity_name: entityName.trim() || undefined,
                is_recurring: isRecurring,
                recurrence_interval: isRecurring ? recurrenceInterval as any : undefined,
                notes: notes.trim() || undefined,
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value === "") {
            setAmount("");
            return;
        }
        const numericValue = parseInt(value, 10) / 100;
        const formatted = new Intl.NumberFormat("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(numericValue);
        setAmount(formatted);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-border">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-black text-primary">{editData ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-secondary transition-colors">
                            <CloseIcon className="h-5 w-5" />
                        </button>
                    </div>
                    {/* Type Toggle */}
                    <div className="flex mt-4 bg-gray-100 rounded-2xl p-1 gap-1">
                        <button
                            type="button"
                            onClick={() => { setType('expense'); setCategoryId(''); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${type === 'expense' ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'text-secondary hover:text-primary'}`}
                        >
                            <ArrowDownCircle size={16} />
                            Despesa
                        </button>
                        <button
                            type="button"
                            onClick={() => { setType('income'); setCategoryId(''); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${type === 'income' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'text-secondary hover:text-primary'}`}
                        >
                            <ArrowUpCircle size={16} />
                            Receita
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
                    {/* Description */}
                    <div>
                        <label className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Descrição *</label>
                        <input
                            type="text"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder={type === 'expense' ? 'Ex: Compra de peças Apple' : 'Ex: Venda iPhone 15'}
                            className="w-full h-11 px-4 bg-gray-50 border border-border rounded-xl text-sm font-medium focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all"
                            required
                        />
                    </div>

                    {/* Amount + Category Row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Valor (R$) *</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">R$</span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={amount}
                                    onChange={handleAmountChange}
                                    placeholder="0,00"
                                    className="w-full h-11 pl-10 pr-4 bg-gray-50 border border-border rounded-xl text-sm font-bold focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Categoria *</label>
                            <select
                                value={categoryId}
                                onChange={e => setCategoryId(e.target.value)}
                                className="w-full h-11 px-3 bg-gray-50 border border-border rounded-xl text-sm font-medium focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all appearance-none cursor-pointer"
                                required
                            >
                                <option value="">Selecione...</option>
                                {(Object.entries(groupedCategories) as [string, TransactionCategory[]][]).map(([group, cats]) => (
                                    <optgroup key={group} label={group}>
                                        {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Status + Due Date */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Vencimento *</label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                                className="w-full h-11 px-3 bg-gray-50 border border-border rounded-xl text-sm font-medium focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Status</label>
                            <select
                                value={status}
                                onChange={e => setStatus(e.target.value as any)}
                                className="w-full h-11 px-3 bg-gray-50 border border-border rounded-xl text-sm font-medium focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all appearance-none cursor-pointer"
                            >
                                <option value="pending">Pendente</option>
                                <option value="paid">Pago</option>
                                <option value="overdue">Atrasado</option>
                            </select>
                        </div>
                    </div>

                    {/* Payment Date + Method (only when paid) */}
                    {status === 'paid' && (
                        <div className="grid grid-cols-2 gap-3 animate-fade-in">
                            <div>
                                <label className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Data Pagamento</label>
                                <input
                                    type="date"
                                    value={paymentDate}
                                    onChange={e => setPaymentDate(e.target.value)}
                                    className="w-full h-11 px-3 bg-gray-50 border border-border rounded-xl text-sm font-medium focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Forma de Pagamento</label>
                                <select
                                    value={paymentMethod}
                                    onChange={e => setPaymentMethod(e.target.value)}
                                    className="w-full h-11 px-3 bg-gray-50 border border-border rounded-xl text-sm font-medium focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">Selecione...</option>
                                    {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Entity */}
                    <div>
                        <label className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">
                            {type === 'expense' ? 'Fornecedor / Destino' : 'Cliente / Origem'}
                        </label>
                        <input
                            type="text"
                            value={entityName}
                            onChange={e => setEntityName(e.target.value)}
                            placeholder={type === 'expense' ? 'Ex: Fornecedor XYZ' : 'Ex: João Silva'}
                            className="w-full h-11 px-4 bg-gray-50 border border-border rounded-xl text-sm font-medium focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all"
                        />
                    </div>

                    {/* Recurring */}
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-border">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isRecurring}
                                onChange={e => setIsRecurring(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:ring-4 peer-focus:ring-accent/20 rounded-full peer peer-checked:bg-accent transition-all after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                        </label>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-primary">Lançamento recorrente</p>
                            <p className="text-[10px] text-muted">Repete automaticamente</p>
                        </div>
                        {isRecurring && (
                            <select
                                value={recurrenceInterval}
                                onChange={e => setRecurrenceInterval(e.target.value)}
                                className="h-9 px-3 bg-white border border-border rounded-xl text-xs font-bold focus:border-accent outline-none transition-all appearance-none cursor-pointer animate-fade-in"
                            >
                                <option value="weekly">Semanal</option>
                                <option value="monthly">Mensal</option>
                                <option value="quarterly">Trimestral</option>
                                <option value="yearly">Anual</option>
                            </select>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Observações</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Anotações adicionais..."
                            rows={2}
                            className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm font-medium focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all resize-none"
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 h-11 rounded-xl border border-border text-sm font-bold text-secondary hover:bg-gray-50 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={saving || !description.trim() || !amount || !categoryId}
                        className={`flex-1 h-11 rounded-xl text-sm font-bold text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${type === 'expense'
                            ? 'bg-red-500 hover:bg-red-600 shadow-red-200'
                            : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'
                            }`}
                    >
                        {saving ? (
                            <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                        ) : (
                            <CheckIcon className="h-4 w-4" />
                        )}
                        {editData ? 'Salvar' : 'Criar Lançamento'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// Confirm Delete Modal
// ============================================================
const ConfirmDeleteModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void; description: string; deleting: boolean }> = ({ isOpen, onClose, onConfirm, description, deleting }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-red-100 rounded-xl">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <h3 className="text-lg font-black text-primary">Excluir Lançamento</h3>
                </div>
                <p className="text-sm text-secondary mb-6">
                    Tem certeza que deseja excluir <strong>"${description}"</strong>? Esta ação não pode ser desfeita.
                </p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-bold text-secondary hover:bg-gray-50 transition-all">Cancelar</button>
                    <button
                        onClick={onConfirm}
                        disabled={deleting}
                        className="flex-1 h-11 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {deleting ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <TrashIcon className="h-4 w-4" />}
                        Excluir
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// Pagination Footer
// ============================================================
interface PaginationFooterProps {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (count: number) => void;
}

const PaginationFooter: React.FC<PaginationFooterProps> = ({ currentPage, itemsPerPage, totalItems, onPageChange, onItemsPerPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-border bg-surface">
            <div className="text-sm text-muted">
                Mostrando ${Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} - ${Math.min(currentPage * itemsPerPage, totalItems)} de ${totalItems} itens
            </div>
            <div className="flex items-center gap-3">
                <select
                    value={itemsPerPage}
                    onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                    className="h-9 px-3 bg-gray-50 border border-border rounded-xl text-xs font-bold focus:border-accent outline-none transition-all appearance-none cursor-pointer"
                >
                    <option value={5}>5 por página</option>
                    <option value={10}>10 por página</option>
                    <option value={15}>15 por página</option>
                    <option value={20}>20 por página</option>
                    <option value={50}>50 por página</option>
                </select>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-2 rounded-xl hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-bold text-primary">Página ${currentPage} de ${totalPages}</span>
                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-xl hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// Main Page
// ============================================================
const Financeiro: React.FC = () => {
    const { user, permissions } = useUser();
    const { showToast } = useToast();

    // Data State
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [categories, setCategories] = useState<TransactionCategory[]>([]);
    const [paymentMethodsList, setPaymentMethodsList] = useState<PaymentMethodParameter[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [installments, setInstallments] = useState<CreditInstallment[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

    // Filter State
    const [filterType, setFilterType] = useState<'' | 'income' | 'expense'>('');
    const [filterStatus, setFilterStatus] = useState<'' | 'pending' | 'paid' | 'overdue'>('');
    const [filterStartDate, setFilterStartDate] = useState(monthStartISO());
    const [filterEndDate, setFilterEndDate] = useState(monthEndISO());
    const [searchTerm, setSearchTerm] = useState('');

    // Tab
    const [activeTab, setActiveTab] = useState<'transactions' | 'installments'>('transactions');

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<FinancialTransaction | null>(null);
    const [deleteItem, setDeleteItem] = useState<FinancialTransaction | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Expanded row for mobile
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Load Data
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [cats, txns, methods, allSales, allInstallments, allProducts, allPurchases] = await Promise.all([
                getTransactionCategories(),
                getFinancialTransactions({
                    type: filterType || undefined,
                    status: filterStatus || undefined,
                    startDate: filterStartDate || undefined,
                    endDate: filterEndDate || undefined,
                    search: searchTerm || undefined,
                }),
                getPaymentMethods(),
                getSales(undefined, undefined, filterStartDate, filterEndDate),
                getCreditInstallments(),
                getProducts(),
                getPurchaseOrders(),
            ]);
            setCategories(cats);
            setTransactions(txns);
            setPaymentMethodsList(methods as PaymentMethodParameter[]);
            setSales(allSales);
            setInstallments(allInstallments);
            setProducts(allProducts);
            setPurchases(allPurchases);
        } catch (err) {
            console.error('Error loading financial data:', err);
            showToast('Erro ao carregar dados financeiros', 'error');
        } finally {
            setLoading(false);
        }
    }, [filterType, filterStatus, filterStartDate, filterEndDate, searchTerm]);

    useEffect(() => {
        loadData();
    }, [loadData, filterType, filterStatus, filterStartDate, filterEndDate, searchTerm]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filterType, filterStatus, searchTerm, filterStartDate, filterEndDate]);

    // Derived Metrics
    const kpis = useMemo(() => {
        // Balance: Total Paid Income - Total Paid Expense (Manual + Sales + Purchases)
        const manualIncome = transactions.filter(t => t.type === 'income' && t.status === 'paid').reduce((sum, t) => sum + t.amount, 0);
        const saleIncome = sales.filter(s => s.status === 'Finalizada').reduce((sum, s) => sum + s.total, 0);
        const totalRevenue = manualIncome + saleIncome;

        // FILTER Purchases by date for KPIs consistency (since API returns all)
        const filteredPurchases = purchases.filter(p => {
            if (!p.purchaseDate) return false;
            if (filterStartDate && p.purchaseDate < filterStartDate) return false;
            if (filterEndDate && p.purchaseDate > filterEndDate) return false;
            return true;
        });

        const manualExpenses = transactions.filter(t => t.type === 'expense' && t.status === 'paid').reduce((sum, t) => sum + t.amount, 0);
        const purchaseExpenses = filteredPurchases.reduce((sum, p) => {
            if (p.financialStatus === 'Pago') {
                return sum + p.total;
            }
            return sum;
        }, 0);
        const totalExpenses = manualExpenses + purchaseExpenses;

        const balance = totalRevenue - totalExpenses;

        // Total Credit (Pending Installments)
        const totalCredit = installments.filter(i => i.status === 'pending' || i.status === 'overdue').reduce((sum, i) => sum + i.amount, 0);

        // Net Profit Calculation (Approximation)
        // Profit = Sales Revenue - Cost of Goods Sold (COGS) - Expenses - Fees
        const totalCOGS = sales.filter(s => s.status === 'Finalizada').reduce((sum, s) => {
            const cost = s.items.reduce((itemSum, item) => {
                const p = products.find(prod => prod.id === item.productId);
                return itemSum + ((p?.costPrice || 0) + (p?.additionalCostPrice || 0)) * item.quantity;
            }, 0);
            return sum + cost;
        }, 0);

        let totalFees = 0;
        sales.filter(s => s.status === 'Finalizada').forEach(s => {
            s.payments.forEach(p => {
                const method = paymentMethodsList.find(m => m.name === p.method);
                if (method?.config && method.type === 'card') {
                    let rate = 0;
                    const isDebit = p.card?.toLowerCase().includes('débito') || p.method.toLowerCase().includes('débito');
                    if (isDebit) {
                        rate = method.config.debitRate || 0;
                    } else {
                        const installmentsCount = p.installments || 1;
                        const rateObj = method.config.creditNoInterestRates?.find(r => r.installments === installmentsCount);
                        rate = rateObj ? rateObj.rate : 0;
                    }
                    totalFees += (p.value * rate) / 100;
                }
            });
        });

        const netProfit = totalRevenue - totalExpenses - totalCOGS - totalFees;
        const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        return {
            balance,
            totalRevenue,
            totalExpenses,
            totalCredit,
            netProfit,
            margin,
            txnCount: transactions.length + sales.length + filteredPurchases.length,
            pendingCreditCount: installments.filter(i => i.status === 'overdue').length,
        };
    }, [transactions, sales, installments, products, paymentMethodsList, purchases, filterStartDate, filterEndDate]);

    // Unified Timeline
    const unifiedTransactions = useMemo(() => {
        let items: any[] = [];

        transactions.forEach(t => {
            if (t.status !== 'paid') return;
            items.push({
                id: t.id,
                date: t.payment_date || t.due_date,
                description: t.description,
                category: t.category?.name || 'Geral',
                entity: t.entity_name || 'N/A',
                value: t.amount,
                type: t.type === 'income' ? 'Receita' : 'Despesa',
                status: 'Pago',
                source: 'manual',
                original: t
            });
        });

        sales.forEach(s => {
            if (s.status === 'Cancelada') return;
            if (s.status !== 'Finalizada') return;
            items.push({
                id: s.id,
                date: s.date,
                description: `Venda #${s.id.replace('ID-', '')}`,
                category: 'Venda de Produtos',
                entity: 'Cliente Final',
                value: s.total,
                type: 'Receita',
                status: 'Pago',
                source: 'sale',
                original: s
            });
        });

        purchases.forEach(p => {
            if (filterStartDate && p.purchaseDate < filterStartDate) return;
            if (filterEndDate && p.purchaseDate > filterEndDate) return;
            if (p.status === 'Cancelada') return;
            if (p.financialStatus !== 'Pago') return;
            items.push({
                id: p.id,
                date: p.purchaseDate,
                description: `Compra PO-${p.displayId} - ${p.supplierName}`,
                category: 'Compra de Mercadorias',
                entity: p.supplierName,
                value: p.total,
                type: 'Despesa',
                status: 'Pago',
                source: 'purchase',
                original: p
            });
        });

        return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, sales, purchases, filterStartDate, filterEndDate]);

    // Pagination Logic
    const totalItems = unifiedTransactions.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const currentItems = unifiedTransactions.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleSave = async (data: Partial<FinancialTransaction>) => {
        try {
            if (data.id) {
                await updateFinancialTransaction(data as FinancialTransaction);
                showToast('Lançamento atualizado com sucesso!', 'success');
            } else {
                await addFinancialTransaction(data as Omit<FinancialTransaction, 'id'>);
                showToast('Lançamento criado com sucesso!', 'success');
            }
            loadData();
        } catch (err) {
            console.error('Error saving transaction:', err);
            showToast('Erro ao salvar lançamento', 'error');
        }
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        setDeleting(true);
        try {
            await deleteFinancialTransaction(deleteItem.id);
            showToast('Lançamento excluído!', 'success');
            loadData();
            setDeleteItem(null);
        } catch (err) {
            console.error('Error deleting transaction:', err);
            showToast('Erro ao excluir lançamento', 'error');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-8 animate-fade-in max-w-[1600px] mx-auto pb-24">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary p-3 rounded-2xl shadow-lg shadow-primary/20">
                            <WalletIcon className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-black text-primary tracking-tight">Financeiro</h1>
                                <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
                                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">Controle de Caixa</span>
                                </div>
                            </div>
                            <p className="text-sm text-secondary font-medium">Controle suas receitas, despesas e fluxo de caixa em tempo real.</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => { setEditItem(null); setModalOpen(true); }}
                        className="flex-1 md:flex-none h-12 px-6 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 group"
                    >
                        <PlusIcon className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
                        Novo Lançamento
                    </button>
                </div>
            </header>

            <div className="flex bg-gray-900/5 p-1.5 rounded-2xl w-full max-w-md">
                <button
                    onClick={() => setActiveTab('transactions')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'transactions' ? 'bg-gray-900 text-white shadow-lg' : 'text-secondary hover:text-gray-900'}`}
                >
                    <WalletIcon className="h-4 w-4" />
                    Transações
                </button>
                <button
                    onClick={() => setActiveTab('installments')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'installments' ? 'bg-gray-900 text-white shadow-lg' : 'text-secondary hover:text-gray-900'}`}
                >
                    <CreditCard className="h-4 w-4" />
                    Crediário
                </button>
            </div>

            {activeTab === 'transactions' ? (
                <>
                    {/* KPI Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                        <KPICard
                            title="Saldo Previsto"
                            value={formatCurrency(kpis.balance)}
                            subtitle="Total líquido em caixa"
                            icon={<WalletIcon className="h-5 w-5 text-blue-600" />}
                            iconBg="bg-blue-50"
                            trend={kpis.balance >= 0 ? 'up' : 'down'}
                            trendLabel="Saldo do Mês"
                        />
                        <KPICard
                            title="Total Receitas"
                            value={formatCurrency(kpis.totalRevenue)}
                            subtitle="Entradas confirmadas"
                            icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
                            iconBg="bg-emerald-50"
                        />
                        <KPICard
                            title="Total Despesas"
                            value={formatCurrency(kpis.totalExpenses)}
                            subtitle="Saídas e compras pagas"
                            icon={<TrendingDown className="h-5 w-5 text-red-600" />}
                            iconBg="bg-red-50"
                        />
                        <KPICard
                            title="Lucro Líquido"
                            value={formatCurrency(kpis.netProfit)}
                            subtitle={`Margem de ${kpis.margin.toFixed(1)}%`}
                            icon={<ChartBarIcon className={`h-5 w-5 ${kpis.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />}
                            iconBg={kpis.netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}
                        />
                    </div>

                    {/* Main Content Card */}
                    <div className="bg-surface rounded-3xl border border-border shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                        {/* Filters Bar */}
                        <div className="p-6 border-b border-border flex flex-wrap items-center justify-between gap-6">
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="relative group min-w-[300px]">
                                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted group-focus-within:text-accent transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Pesquisar por descrição ou entidade..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="h-11 pl-11 pr-4 bg-gray-50 border border-border rounded-xl text-sm font-medium focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all w-full"
                                    />
                                </div>
                                <div className="flex items-center bg-gray-50 border border-border rounded-xl px-2 h-11">
                                    <FilterIcon className="h-4 w-4 text-muted mx-2" />
                                    <select
                                        value={filterType}
                                        onChange={e => setFilterType(e.target.value as any)}
                                        className="bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer text-secondary"
                                    >
                                        <option value="">Todos os Tipos</option>
                                        <option value="income">Receitas</option>
                                        <option value="expense">Despesas</option>
                                    </select>
                                    <div className="w-px h-6 bg-border mx-2"></div>
                                    <select
                                        value={filterStatus}
                                        onChange={e => setFilterStatus(e.target.value as any)}
                                        className="bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer text-secondary"
                                    >
                                        <option value="">Todos Status</option>
                                        <option value="paid">Pago</option>
                                        <option value="pending">Pendente</option>
                                        <option value="overdue">Atrasado</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center bg-gray-50 border border-border rounded-xl px-3 h-11">
                                    <CalendarDaysIcon className="h-4 w-4 text-muted mr-3" />
                                    <input
                                        type="date"
                                        value={filterStartDate}
                                        onChange={e => setFilterStartDate(e.target.value)}
                                        className="bg-transparent border-none text-xs font-bold focus:ring-0 p-0 text-secondary"
                                    />
                                    <span className="text-muted mx-3 font-black text-xs">ATÉ</span>
                                    <input
                                        type="date"
                                        value={filterEndDate}
                                        onChange={e => setFilterEndDate(e.target.value)}
                                        className="bg-transparent border-none text-xs font-bold focus:ring-0 p-0 text-secondary"
                                    />
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
                                <span className="animate-spin w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full" />
                                <p className="text-sm font-bold text-secondary animate-pulse uppercase tracking-widest">Carregando dados financeiros...</p>
                            </div>
                        ) : unifiedTransactions.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-24 text-center px-6">
                                <div className="bg-gray-50 p-6 rounded-full mb-6">
                                    <Receipt size={40} className="text-gray-300" />
                                </div>
                                <h3 className="text-lg font-black text-primary uppercase tracking-tight mb-2">Nenhum lançamento encontrado</h3>
                                <p className="text-sm text-secondary max-w-xs mx-auto mb-8 font-medium">Não há registros financeiros para este período ou com os filtros aplicados.</p>
                                <button
                                    onClick={() => { setFilterStartDate(monthStartISO()); setFilterEndDate(monthEndISO()); setFilterType(''); setFilterStatus(''); setSearchTerm(''); }}
                                    className="h-11 px-6 bg-gray-100 text-secondary rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all border border-gray-200"
                                >
                                    Limpar Filtros
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Timeline Table */}
                                <div className="flex-1 overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[1000px]">
                                        <thead>
                                            <tr className="bg-gray-50/50 text-[10px] font-black text-secondary uppercase tracking-[0.1em] border-b border-border">
                                                <th className="px-4 py-3 w-32">Vencimento</th>
                                                <th className="px-4 py-3">Descrição</th>
                                                <th className="px-4 py-3">Categoria</th>
                                                <th className="px-4 py-3">Entidade</th>
                                                <th className="px-4 py-3 text-right">Valor</th>
                                                <th className="px-4 py-3 text-center">Status</th>
                                                <th className="px-4 py-3 text-center">Tipo</th>
                                                <th className="px-4 py-3 text-center w-24">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {currentItems.map((item: any) => (
                                                <tr key={`${item.source}-${item.id}`} className="group hover:bg-gray-50/80 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <span className="text-xs font-bold text-secondary">{fmtDate(item.date)}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${item.type === 'Receita' ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                                                            <span className="font-bold text-primary truncate max-w-[200px]" title={item.description}>
                                                                {item.description}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${item.category === 'Compra de Mercadorias' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                                            {item.category}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-xs text-muted truncate max-w-[150px] block" title={item.entity}>
                                                            {item.entity}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className={`font-black ${item.type === 'Receita' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {item.type === 'Receita' ? '+' : '-'} {formatCurrency(item.value)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${item.status === 'Pago' ? 'bg-emerald-100/50 text-emerald-700' : item.status === 'Pendente' ? 'bg-amber-100/50 text-amber-700' : 'bg-red-100/50 text-red-700'}`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'Pago' ? 'bg-emerald-500' : item.status === 'Pendente' ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`text-[10px] font-black uppercase tracking-wider ${item.type === 'Receita' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {item.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            {item.source === 'manual' && (
                                                                <>
                                                                    <button
                                                                        onClick={() => { setEditItem(item.original); setModalOpen(true); }}
                                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                        title="Editar"
                                                                    >
                                                                        <Edit3Icon size={16} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setDeleteItem(item.original)}
                                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                        title="Excluir"
                                                                    >
                                                                        <TrashIcon size={16} />
                                                                    </button>
                                                                </>
                                                            )}
                                                            {(item.source === 'sale' || item.source === 'purchase') && (
                                                                <button
                                                                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors cursor-not-allowed"
                                                                    title="Sincronizado via Sistema"
                                                                >
                                                                    <EyeIcon size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Footer */}
                                <PaginationFooter
                                    currentPage={currentPage}
                                    itemsPerPage={itemsPerPage}
                                    totalItems={totalItems}
                                    onPageChange={setCurrentPage}
                                    onItemsPerPageChange={setItemsPerPage}
                                />
                            </>
                        )}
                    </div>
                </>
            ) : (
                <CreditDashboard />
            )}

            {/* Modals */}
            <TransactionModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditItem(null); }}
                onSave={handleSave}
                categories={categories}
                editData={editItem}
                paymentMethods={paymentMethodsList.map(m => m.name)}
            />

            <ConfirmDeleteModal
                isOpen={!!deleteItem}
                onClose={() => setDeleteItem(null)}
                onConfirm={handleDelete}
                description={deleteItem?.description || ''}
                deleting={deleting}
            />
        </div>
    );
};

export default Financeiro;
