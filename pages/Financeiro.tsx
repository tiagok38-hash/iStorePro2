
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    getTransactionCategories,
    getFinancialTransactions,
    addFinancialTransaction,
    updateFinancialTransaction,
    deleteFinancialTransaction,
    formatCurrency,
    getPaymentMethods,
} from '../services/mockApi.ts';
import { TransactionCategory, FinancialTransaction, PaymentMethodParameter } from '../types.ts';
import {
    PlusIcon, SearchIcon, FilterIcon, CloseIcon, CheckIcon, TrashIcon, WalletIcon,
    CurrencyDollarIcon, ChartBarIcon, ClockIcon, TagIcon, CalendarDaysIcon,
} from '../components/icons.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import {
    TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle,
    AlertTriangle, CreditCard, Receipt, Repeat, FileText, ChevronDown, ChevronUp, Pencil
} from 'lucide-react';
import CreditDashboard from '../components/CreditDashboard.tsx';
import TransactionsFilterModal from '../components/TransactionsFilterModal.tsx';

// ============================================================
// Helper
// ============================================================
const fmtDate = (d: string) => {
    if (!d) return '—';
    const parts = d.split('-');
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
    const [type, setType] = useState<'income' | 'expense'>(editData?.type || 'expense');
    const [description, setDescription] = useState(editData?.description || '');
    const [amount, setAmount] = useState(editData ? String(editData.amount) : '');
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
            setAmount(String(editData.amount));
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
                amount: parseFloat(amount),
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

    // Handle BRL input formatting
    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
        setAmount(raw);
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
                    Tem certeza que deseja excluir <strong>"{description}"</strong>? Esta ação não pode ser desfeita.
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
// Main Page
// ============================================================
const Financeiro: React.FC = () => {
    const { user } = useUser();
    const { showToast } = useToast();

    // Data State
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [categories, setCategories] = useState<TransactionCategory[]>([]);
    const [paymentMethodsList, setPaymentMethodsList] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

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
            const [cats, txns, methods] = await Promise.all([
                getTransactionCategories(),
                getFinancialTransactions({
                    type: filterType || undefined,
                    status: filterStatus || undefined,
                    startDate: filterStartDate || undefined,
                    endDate: filterEndDate || undefined,
                    search: searchTerm || undefined,
                }),
                getPaymentMethods(),
            ]);
            setCategories(cats);
            setTransactions(txns);
            setPaymentMethodsList((methods as PaymentMethodParameter[]).map((m: PaymentMethodParameter) => m.name));
        } catch (err) {
            console.error('Error loading financial data:', err);
            showToast('Erro ao carregar dados financeiros', 'error');
        } finally {
            setLoading(false);
        }
    }, [filterType, filterStatus, filterStartDate, filterEndDate, searchTerm]);

    useEffect(() => { loadData(); }, [loadData]);

    // KPIs
    const kpis = useMemo(() => {
        const incomeList = transactions.filter(t => t.type === 'income');
        const expenseList = transactions.filter(t => t.type === 'expense');

        const totalIncome = incomeList.filter(t => t.status === 'paid').reduce((s, t) => s + t.amount, 0);
        const totalExpense = expenseList.filter(t => t.status === 'paid').reduce((s, t) => s + t.amount, 0);
        const balance = totalIncome - totalExpense;

        const pendingIncome = incomeList.filter(t => t.status === 'pending').reduce((s, t) => s + t.amount, 0);
        const pendingExpense = expenseList.filter(t => t.status === 'pending').reduce((s, t) => s + t.amount, 0);

        const today = todayISO();
        const overdueExpense = expenseList.filter(t => t.status !== 'paid' && t.due_date < today).reduce((s, t) => s + t.amount, 0);
        const overdueCount = expenseList.filter(t => t.status !== 'paid' && t.due_date < today).length;

        const allIncome = incomeList.reduce((s, t) => s + t.amount, 0);
        const allExpense = expenseList.reduce((s, t) => s + t.amount, 0);
        const netProfit = allIncome - allExpense;

        return {
            balance, totalIncome, totalExpense,
            pendingIncome, pendingExpense,
            overdueExpense, overdueCount,
            netProfit,
            txnCount: transactions.length,
        };
    }, [transactions]);

    // Handlers
    const handleSave = async (data: Partial<FinancialTransaction>) => {
        try {
            if ((data as any).id) {
                await updateFinancialTransaction(data as any, user?.id, user?.name);
                showToast('Lançamento atualizado com sucesso!', 'success');
            } else {
                await addFinancialTransaction(data, user?.id, user?.name);
                showToast('Lançamento criado com sucesso!', 'success');
            }
            await loadData();
        } catch (err) {
            console.error('Error saving transaction:', err);
            showToast('Erro ao salvar lançamento', 'error');
            throw err;
        }
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        setDeleting(true);
        try {
            await deleteFinancialTransaction(deleteItem.id, user?.id, user?.name);
            showToast('Lançamento excluído com sucesso!', 'success');
            setDeleteItem(null);
            await loadData();
        } catch (err) {
            console.error('Error deleting transaction:', err);
            showToast('Erro ao excluir lançamento', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const handleEdit = (txn: FinancialTransaction) => {
        setEditItem(txn);
        setModalOpen(true);
    };

    const handleQuickStatusToggle = async (txn: FinancialTransaction) => {
        const newStatus = txn.status === 'paid' ? 'pending' : 'paid';
        try {
            await updateFinancialTransaction({
                id: txn.id,
                status: newStatus,
                payment_date: newStatus === 'paid' ? todayISO() : undefined,
            } as any, user?.id, user?.name);
            showToast(newStatus === 'paid' ? 'Marcado como pago!' : 'Marcado como pendente!', 'success');
            await loadData();
        } catch (err) {
            showToast('Erro ao atualizar status', 'error');
        }
    };

    return (
        <div className="max-w-7xl mx-auto animate-fade-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg shadow-purple-200">
                        <WalletIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-primary tracking-tight">Financeiro</h1>
                        <p className="text-xs text-muted font-medium">Gestão de receitas e despesas</p>
                    </div>
                </div>
                {activeTab === 'transactions' && (
                    <button
                        onClick={() => { setEditItem(null); setModalOpen(true); }}
                        className="flex items-center justify-center gap-2 h-11 px-5 bg-accent text-white rounded-2xl font-bold text-sm shadow-lg shadow-accent/25 hover:shadow-xl hover:shadow-accent/30 active:scale-[0.98] transition-all"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Nova Transação
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="inline-flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-sm mb-6">
                <button
                    onClick={() => setActiveTab('transactions')}
                    className={`px-8 py-3 rounded-xl text-[13px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${activeTab === 'transactions' ? 'bg-gray-800 text-white shadow-lg shadow-gray-900/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`}
                >
                    Receitas e Despesas
                </button>
                <button
                    onClick={() => setActiveTab('installments')}
                    className={`px-8 py-3 rounded-xl text-[13px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${activeTab === 'installments' ? 'bg-gray-800 text-white shadow-lg shadow-gray-900/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`}
                >
                    Crediários
                </button>
            </div>

            {activeTab === 'transactions' ? (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                        <KPICard
                            title="Saldo"
                            value={formatCurrency(kpis.balance)}
                            subtitle={`${kpis.txnCount} lançamentos`}
                            icon={<WalletIcon className="h-5 w-5 text-blue-600" />}
                            iconBg="bg-blue-50"
                            className={kpis.balance >= 0 ? '' : 'ring-1 ring-red-100'}
                        />
                        <KPICard
                            title="Receitas"
                            value={formatCurrency(kpis.totalIncome)}
                            subtitle={kpis.pendingIncome > 0 ? `${formatCurrency(kpis.pendingIncome)} a receber` : 'Tudo recebido'}
                            icon={<ArrowUpCircle size={20} className="text-emerald-600" />}
                            iconBg="bg-emerald-50"
                        />
                        <KPICard
                            title="Despesas"
                            value={formatCurrency(kpis.totalExpense)}
                            subtitle={kpis.pendingExpense > 0 ? `${formatCurrency(kpis.pendingExpense)} a pagar` : 'Tudo pago'}
                            icon={<ArrowDownCircle size={20} className="text-red-600" />}
                            iconBg="bg-red-50"
                        />
                        <KPICard
                            title="Atrasado"
                            value={formatCurrency(kpis.overdueExpense)}
                            subtitle={kpis.overdueCount > 0 ? `${kpis.overdueCount} ${kpis.overdueCount === 1 ? 'conta' : 'contas'} vencidas` : 'Nenhuma conta atrasada'}
                            icon={<AlertTriangle size={20} className="text-amber-600" />}
                            iconBg="bg-amber-50"
                            className={kpis.overdueCount > 0 ? 'ring-1 ring-amber-100' : ''}
                        />
                        <KPICard
                            title="Lucro Líquido"
                            value={formatCurrency(kpis.netProfit)}
                            subtitle={kpis.totalIncome > 0 ? `${((kpis.netProfit / kpis.totalIncome) * 100).toFixed(1)}% margem` : '—'}
                            icon={<TrendingUp size={20} className="text-violet-600" />}
                            iconBg="bg-violet-50"
                            trend={kpis.netProfit >= 0 ? 'up' : 'down'}
                            trendLabel={kpis.netProfit >= 0 ? 'Positivo' : 'Negativo'}
                            className="col-span-2 lg:col-span-1"
                        />
                    </div>

                    {/* Filters Bar */}
                    <div className="bg-surface rounded-2xl border border-border p-3 mb-4 shadow-sm">
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[200px]">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted h-4 w-4" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Buscar descrição, fornecedor..."
                                    className="w-full h-9 pl-9 pr-3 bg-gray-50 border border-border rounded-xl text-sm focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all"
                                />
                            </div>

                            {/* Type Filter */}
                            <select
                                value={filterType}
                                onChange={e => setFilterType(e.target.value as any)}
                                className="h-9 px-3 bg-gray-50 border border-border rounded-xl text-xs font-bold focus:border-accent outline-none transition-all appearance-none cursor-pointer"
                            >
                                <option value="">Todos os tipos</option>
                                <option value="income">Receitas</option>
                                <option value="expense">Despesas</option>
                            </select>

                            {/* Status Filter */}
                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value as any)}
                                className="h-9 px-3 bg-gray-50 border border-border rounded-xl text-xs font-bold focus:border-accent outline-none transition-all appearance-none cursor-pointer"
                            >
                                <option value="">Todos os status</option>
                                <option value="paid">Pagos</option>
                                <option value="pending">Pendentes</option>
                                <option value="overdue">Atrasados</option>
                            </select>

                            {/* Date Range */}
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="date"
                                    value={filterStartDate}
                                    onChange={e => setFilterStartDate(e.target.value)}
                                    className="h-9 px-2 bg-gray-50 border border-border rounded-xl text-xs font-bold focus:border-accent outline-none transition-all"
                                />
                                <span className="text-xs text-muted font-bold">até</span>
                                <input
                                    type="date"
                                    value={filterEndDate}
                                    onChange={e => setFilterEndDate(e.target.value)}
                                    className="h-9 px-2 bg-gray-50 border border-border rounded-xl text-xs font-bold focus:border-accent outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Transactions Table */}
                    <div className="bg-surface rounded-3xl border border-border shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <span className="animate-spin w-8 h-8 border-3 border-accent/20 border-t-accent rounded-full"></span>
                            </div>
                        ) : transactions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="p-4 bg-gray-50 rounded-2xl mb-4">
                                    <Receipt size={40} className="text-gray-300" />
                                </div>
                                <p className="font-bold text-primary">Nenhum lançamento encontrado</p>
                                <p className="text-sm text-muted mt-1">Crie seu primeiro lançamento financeiro</p>
                                <button
                                    onClick={() => { setEditItem(null); setModalOpen(true); }}
                                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/25 hover:shadow-xl transition-all"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    Novo Lançamento
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Desktop Table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[10px] font-black text-muted uppercase tracking-wider border-b border-border">
                                                <th className="px-4 py-3">Venc.</th>
                                                <th className="px-4 py-3">Descrição</th>
                                                <th className="px-4 py-3">Categoria</th>
                                                <th className="px-4 py-3">Entidade</th>
                                                <th className="px-4 py-3 text-right">Valor</th>
                                                <th className="px-4 py-3 text-center">Status</th>
                                                <th className="px-4 py-3 text-center w-24">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {transactions.map(txn => (
                                                <tr key={txn.id} className="group hover:bg-gray-50/80 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <span className="text-xs font-bold text-secondary">{fmtDate(txn.due_date)}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${txn.type === 'income' ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                                                            <div>
                                                                <p className="font-bold text-primary truncate max-w-[200px]">{txn.description}</p>
                                                                {txn.is_recurring && (
                                                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full mt-0.5">
                                                                        <Repeat size={8} /> Recorrente
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span
                                                            className="inline-flex items-center text-[10px] font-bold px-2 py-1 rounded-full"
                                                            style={{
                                                                backgroundColor: `${txn.category?.color || '#6B7280'}15`,
                                                                color: txn.category?.color || '#6B7280',
                                                            }}
                                                        >
                                                            {txn.category?.name || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-xs text-secondary truncate max-w-[120px] block">{txn.entity_name || '—'}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className={`text-sm font-black ${txn.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {txn.type === 'income' ? '+' : '-'} {formatCurrency(txn.amount)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button onClick={() => handleQuickStatusToggle(txn)} title="Clique para alterar status">
                                                            <StatusBadge status={txn.status} />
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleEdit(txn)}
                                                                className="p-1.5 rounded-lg hover:bg-accent/10 text-accent transition-colors"
                                                                title="Editar"
                                                            >
                                                                <Pencil size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteItem(txn)}
                                                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                                                                title="Excluir"
                                                            >
                                                                <TrashIcon className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Cards */}
                                <div className="md:hidden divide-y divide-border/50">
                                    {transactions.map(txn => (
                                        <div key={txn.id} className="p-4">
                                            <div className="flex items-center justify-between" onClick={() => setExpandedId(expandedId === txn.id ? null : txn.id)}>
                                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${txn.type === 'income' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                                        {txn.type === 'income' ? <ArrowUpCircle size={18} className="text-emerald-600" /> : <ArrowDownCircle size={18} className="text-red-600" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-primary truncate">{txn.description}</p>
                                                        <p className="text-[10px] text-muted font-medium">{fmtDate(txn.due_date)} • {txn.category?.name || '—'}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right ml-3 flex-shrink-0">
                                                    <p className={`text-sm font-black ${txn.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
                                                    </p>
                                                    <StatusBadge status={txn.status} />
                                                </div>
                                            </div>
                                            {expandedId === txn.id && (
                                                <div className="mt-3 pt-3 border-t border-dashed border-border flex items-center gap-2 animate-fade-in">
                                                    <button onClick={() => handleQuickStatusToggle(txn)} className="flex-1 h-9 rounded-xl bg-gray-100 text-xs font-bold text-secondary hover:bg-gray-200 transition-all">
                                                        {txn.status === 'paid' ? 'Marcar Pendente' : 'Marcar Pago'}
                                                    </button>
                                                    <button onClick={() => handleEdit(txn)} className="h-9 w-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button onClick={() => setDeleteItem(txn)} className="h-9 w-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </>
            ) : (
                <div className="animate-fade-in">
                    <CreditDashboard />
                </div>
            )}

            {/* Modals */}
            <TransactionModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditItem(null); }}
                onSave={handleSave}
                categories={categories}
                paymentMethods={paymentMethodsList}
                editData={editItem}
            />

            <ConfirmDeleteModal
                isOpen={!!deleteItem}
                onClose={() => setDeleteItem(null)}
                onConfirm={handleDelete}
                description={deleteItem?.description || ''}
                deleting={deleting}
            />
        </div >
    );
};

export default Financeiro;
