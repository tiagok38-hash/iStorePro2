
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Commission, CommissionStatus, User } from '../types.ts';
import { getCommissions, getCommissionSummary, closeCommissionPeriod, markCommissionPaid, getCommissionAuditLogs } from '../services/commissionService.ts';
import { getUsers, formatCurrency } from '../services/mockApi.ts';
import { useUser } from '../contexts/UserContext.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import ConfirmationModal from '../components/ConfirmationModal.tsx';
import { SpinnerIcon, CheckIcon, XCircleIcon } from '../components/icons.tsx';
import Button from '../components/Button.tsx';

// ─── STATUS CONFIG ────
const statusConfig: Record<CommissionStatus, { label: string; bg: string; text: string; dot: string }> = {
    on_hold: { label: 'Aguard. Finaliz.', bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' },
    pending: { label: 'Pendente', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
    closed: { label: 'Fechada', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
    paid: { label: 'Paga', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
    cancelled: { label: 'Cancelada', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
};

const StatusBadge: React.FC<{ status: CommissionStatus }> = ({ status }) => {
    const cfg = statusConfig[status] || statusConfig.pending;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    );
};

// ─── KPI CARD ─────────
const KpiCard: React.FC<{ label: string; value: string; icon: string; color: string; subLabel?: string }> = ({ label, value, icon, color, subLabel }) => (
    <div className={`relative overflow-hidden rounded-[24px] border p-5 ${color}`}>
        <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</span>
            <span className="text-xl">{icon}</span>
        </div>
        <p className="text-2xl md:text-3xl font-black tracking-tight">{value}</p>
        {subLabel && <p className="text-[10px] font-bold opacity-60 mt-1">{subLabel}</p>}
    </div>
);

// ─── PAYMENT MODAL ────
const PaymentModal: React.FC<{
    isOpen: boolean;
    commissions: Commission[];
    onClose: () => void;
    onConfirm: (date: string, method: string, notes: string) => Promise<void>;
}> = ({ isOpen, commissions, onClose, onConfirm }) => {
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
    const [method, setMethod] = useState('Pix');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const total = commissions.reduce((s, c) => s + Number(c.commission_amount), 0);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-5 animate-scale-in">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-gray-800">💰 Registrar Pagamento</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-all"><XCircleIcon className="h-5 w-5 text-gray-400" /></button>
                </div>

                <div className="bg-emerald-50 rounded-2xl p-4 text-center border border-emerald-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Total a Pagar</p>
                    <p className="text-3xl font-black text-emerald-700">{formatCurrency(total)}</p>
                    <p className="text-xs text-emerald-600 mt-1">{commissions.length} comissão(ões)</p>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Data do Pagamento</label>
                        <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Método de Pagamento</label>
                        <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                            <option>Pix</option>
                            <option>Dinheiro</option>
                            <option>Transferência</option>
                            <option>Outro</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Observações</label>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none" placeholder="Opcional..." />
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <Button onClick={onClose} variant="secondary" className="flex-1">Cancelar</Button>
                    <Button
                        onClick={async () => { setSaving(true); await onConfirm(payDate, method, notes); setSaving(false); }}
                        variant="success"
                        loading={saving}
                        className="flex-1"
                        icon={<CheckIcon className="h-5 w-5" />}
                    >Confirmar Pagamento</Button>
                </div>
            </div>
        </div>
    );
};

// ─── AUDIT LOG MODAL ──
const AuditModal: React.FC<{ isOpen: boolean; commissionId: string; onClose: () => void }> = ({ isOpen, commissionId, onClose }) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && commissionId) {
            setLoading(true);
            getCommissionAuditLogs(commissionId).then(data => { setLogs(data); setLoading(false); });
        }
    }, [isOpen, commissionId]);

    if (!isOpen) return null;

    const actionLabels: Record<string, string> = {
        created: 'Criada',
        recalculated: 'Recalculada',
        cancelled: 'Cancelada',
        closed: 'Fechada',
        paid: 'Paga',
        status_change: 'Status Alterado',
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-scale-in">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h3 className="text-lg font-black text-gray-800">📋 Histórico de Auditoria</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><XCircleIcon className="h-5 w-5 text-gray-400" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {loading ? <div className="flex justify-center py-8"><SpinnerIcon /></div> : logs.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-8">Nenhum registro de auditoria.</p>
                    ) : logs.map((log) => (
                        <div key={log.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-gray-700">{actionLabels[log.action_type] || log.action_type}</span>
                                <span className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                            </div>
                            {log.reason && <p className="text-xs text-gray-500">{log.reason}</p>}
                            <div className="flex gap-4 text-[10px] text-gray-400">
                                {log.old_value != null && <span>Anterior: {formatCurrency(log.old_value)}</span>}
                                {log.new_value != null && <span>Novo: {formatCurrency(log.new_value)}</span>}
                            </div>
                            {log.user_name && <p className="text-[10px] text-gray-400">Por: {log.user_name}</p>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─── MAIN PAGE ────────
const Comissoes: React.FC = () => {
    const { user, permissions } = useUser();
    const { showToast } = useToast();

    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({ pending: 0, closed: 0, paid: 0, cancelled: 0, total: 0, on_hold: 0 });

    // Filters
    const [filterSeller, setFilterSeller] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterPeriod, setFilterPeriod] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // Modals
    const [isClosePeriodOpen, setIsClosePeriodOpen] = useState(false);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [selectedForPayment, setSelectedForPayment] = useState<Commission[]>([]);
    const [auditCommissionId, setAuditCommissionId] = useState<string>('');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const canViewAll = permissions?.canViewAllCommissions;
    const canClose = permissions?.canCloseCommissionPeriod;
    const canPay = permissions?.canMarkCommissionPaid;

    useEffect(() => {
        loadData();
    }, [filterSeller, filterStatus, filterPeriod]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [usersData] = await Promise.all([getUsers()]);
            setUsers(usersData.filter(u => u.active !== false));

            const effectiveSellerId = !canViewAll ? user?.id : (filterSeller === 'all' ? undefined : filterSeller);
            const effectiveStatus = filterStatus === 'all' ? undefined : filterStatus as CommissionStatus;

            const [comms, summ] = await Promise.all([
                getCommissions({
                    sellerId: effectiveSellerId,
                    status: effectiveStatus,
                    periodReference: filterPeriod || undefined,
                }),
                getCommissionSummary(effectiveSellerId, filterPeriod || undefined),
            ]);

            setCommissions(comms);
            setSummary(summ);
        } catch (e) {
            console.error('[Comissoes] Error loading data:', e);
            showToast('Erro ao carregar comissões.', 'error');
        } finally {
            setLoading(false);
        }
    }, [canViewAll, filterSeller, filterStatus, filterPeriod, user?.id, showToast]);

    const userMap = useMemo(() => {
        const m = new Map<string, string>();
        users.forEach(u => m.set(u.id, u.name));
        return m;
    }, [users]);

    const handleClosePeriod = async () => {
        if (!filterPeriod) return;
        try {
            const count = await closeCommissionPeriod(filterPeriod, user?.id || '', user?.name || '');
            showToast(`${count} comissão(ões) fechada(s) para o período ${filterPeriod}.`, 'success');
            setIsClosePeriodOpen(false);
            loadData();
        } catch (e) {
            showToast('Erro ao fechar período.', 'error');
        }
    };

    const handlePayment = async (date: string, method: string, notes: string) => {
        if (selectedForPayment.length === 0) return;
        try {
            const ids = selectedForPayment.map(c => c.id);
            await markCommissionPaid(ids, date, method, notes, user?.id || '', user?.name || '');
            showToast(`${ids.length} comissão(ões) marcada(s) como paga(s).`, 'success');
            setIsPaymentOpen(false);
            setSelectedForPayment([]);
            setSelectionMode(false);
            setSelectedIds(new Set());
            loadData();
        } catch (e) {
            showToast('Erro ao registrar pagamento.', 'error');
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectAllClosed = () => {
        const closedIds = commissions.filter(c => c.status === 'closed').map(c => c.id);
        setSelectedIds(new Set(closedIds));
    };

    const openPayForSelected = () => {
        const selected = commissions.filter(c => selectedIds.has(c.id) && c.status === 'closed');
        if (selected.length === 0) {
            showToast('Selecione comissões com status "Fechada" para pagar.', 'warning');
            return;
        }
        setSelectedForPayment(selected);
        setIsPaymentOpen(true);
    };

    const periodLabel = useMemo(() => {
        if (!filterPeriod) return '';
        const [y, m] = filterPeriod.split('-');
        const months = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return `${months[parseInt(m)]} ${y}`;
    }, [filterPeriod]);

    return (
        <div className="space-y-6 pb-20">
            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">

                <div className="flex items-center gap-2 flex-wrap">
                    {canClose && (
                        <Button
                            onClick={() => setIsClosePeriodOpen(true)}
                            variant="secondary"
                            className="!rounded-xl !text-xs"
                        >🔒 Fechar Período</Button>
                    )}
                    {canPay && (
                        <>
                            {!selectionMode ? (
                                <Button onClick={() => setSelectionMode(true)} variant="secondary" className="!rounded-xl !text-xs">
                                    ☑️ Selecionar para Pagar
                                </Button>
                            ) : (
                                <div className="flex gap-2">
                                    <Button onClick={selectAllClosed} variant="secondary" className="!rounded-xl !text-xs">
                                        Selecionar todas Fechadas
                                    </Button>
                                    <Button onClick={openPayForSelected} variant="success" className="!rounded-xl !text-xs" icon={<CheckIcon className="h-4 w-4" />}>
                                        Pagar ({selectedIds.size})
                                    </Button>
                                    <Button onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }} variant="secondary" className="!rounded-xl !text-xs">
                                        Cancelar
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <KpiCard label="Aguard. Finaliz." value={formatCurrency(summary.on_hold)} icon="📝" color="bg-gray-50 border-gray-100 text-gray-800" />
                <KpiCard label="Pendente" value={formatCurrency(summary.pending)} icon="⏳" color="bg-amber-50 border-amber-100 text-amber-800" />
                <KpiCard label="Fechada" value={formatCurrency(summary.closed)} icon="🔒" color="bg-blue-50 border-blue-100 text-blue-800" />
                <KpiCard label="Paga" value={formatCurrency(summary.paid)} icon="✅" color="bg-emerald-50 border-emerald-100 text-emerald-800" />
                <KpiCard label="Cancelada" value={formatCurrency(summary.cancelled)} icon="❌" color="bg-red-50 border-red-100 text-red-800" />
            </div>

            {/* Filters */}
            <div className="bg-white rounded-[24px] border border-gray-100 p-4 shadow-sm">
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[140px]">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Período</label>
                        <input
                            type="month"
                            value={filterPeriod}
                            onChange={(e) => setFilterPeriod(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-violet-500 focus:border-violet-500 outline-none"
                        />
                    </div>

                    {canViewAll && (
                        <div className="flex-1 min-w-[140px]">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Vendedor</label>
                            <select
                                value={filterSeller}
                                onChange={(e) => setFilterSeller(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-violet-500 focus:border-violet-500 outline-none"
                            >
                                <option value="all">Todos</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="flex-1 min-w-[140px]">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Status</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-violet-500 focus:border-violet-500 outline-none"
                        >
                            <option value="all">Todos</option>
                            <option value="on_hold">Aguard. Finalização</option>
                            <option value="pending">Pendente</option>
                            <option value="closed">Fechada</option>
                            <option value="paid">Paga</option>
                            <option value="cancelled">Cancelada</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-16"><SpinnerIcon /></div>
                ) : commissions.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-4xl mb-3">🏷️</p>
                        <p className="text-gray-400 font-bold">Nenhuma comissão encontrada</p>
                        <p className="text-gray-300 text-sm mt-1">Comissões serão geradas automaticamente nas vendas</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    {selectionMode && <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">☑</th>}
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Vendedor</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Produto</th>
                                    <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Venda</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Venda Líq.</th>
                                    <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Taxa</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Comissão</th>
                                    <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                    <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Data</th>
                                    <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {commissions.map((c) => (
                                    <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${selectedIds.has(c.id) ? 'bg-violet-50' : ''}`}>
                                        {selectionMode && (
                                            <td className="px-4 py-3">
                                                {c.status === 'closed' && (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(c.id)}
                                                        onChange={() => toggleSelect(c.id)}
                                                        className="w-4 h-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500"
                                                    />
                                                )}
                                            </td>
                                        )}
                                        <td className="px-4 py-3 font-bold text-gray-700">{userMap.get(c.seller_id) || c.seller_id?.substring(0, 8)}</td>
                                        <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{c.product_name || '-'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-[10px] font-black bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{c.sale_id?.substring(0, 8)}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-700">{formatCurrency(Number(c.net_total))}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-xs font-bold text-violet-600">
                                                {c.commission_type === 'fixed' ? formatCurrency(Number(c.commission_rate)) : `${c.commission_rate}%`}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`font-black text-base ${(Number(c.commission_amount) > 0 && c.status !== 'on_hold') ? 'text-emerald-600' : 'text-gray-300'}`}>
                                                {formatCurrency(Number(c.commission_amount))}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center"><StatusBadge status={c.status} /></td>
                                        <td className="px-4 py-3 text-center text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => setAuditCommissionId(c.id)}
                                                className="text-[10px] font-bold text-violet-500 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-full transition-all"
                                            >
                                                Histórico
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Period summary */}
            {filterPeriod && !loading && commissions.length > 0 && (
                <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-[24px] border border-violet-100 p-5 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-violet-600 mb-1">Total de Comissões Válidas (Resumo {periodLabel})</p>
                    <p className="text-3xl font-black text-violet-800">{formatCurrency(summary.total)}</p>
                    <p className="text-xs text-violet-500 mt-1">{commissions.filter(c => ['pending', 'closed', 'paid'].includes(c.status)).length} comissão(ões) válida(s) no período</p>
                </div>
            )}

            {/* Modals */}
            <ConfirmationModal
                isOpen={isClosePeriodOpen}
                title="🔒 Fechar Período de Comissão"
                message={`Deseja fechar todas as comissões pendentes do período ${periodLabel}? Após fechamento, as comissões ficam imutáveis e não poderão ser recalculadas por alterações em vendas.`}
                onConfirm={handleClosePeriod}
                onClose={() => setIsClosePeriodOpen(false)}
            />

            <PaymentModal
                isOpen={isPaymentOpen}
                commissions={selectedForPayment}
                onClose={() => { setIsPaymentOpen(false); setSelectedForPayment([]); }}
                onConfirm={handlePayment}
            />

            <AuditModal
                isOpen={!!auditCommissionId}
                commissionId={auditCommissionId}
                onClose={() => setAuditCommissionId('')}
            />
        </div>
    );
};

export default Comissoes;
