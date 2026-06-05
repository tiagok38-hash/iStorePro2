import React, { useState, useEffect, useCallback } from 'react';
import {
    List, RefreshCw, Phone, User, Smartphone, Calendar, ChevronDown,
    CheckCircle, Clock, XCircle, TrendingUp, FileText, MessageSquare,
    Filter, Search
} from 'lucide-react';
import { getAvaliacaoLeads, updateAvaliacaoLeadStatus } from '../../services/avaliacaoService.ts';
import { AvaliacaoLead, AvaliacaoLeadStatus } from '../../types.ts';
import { useToast } from '../../contexts/ToastContext.tsx';
import { useNavigate } from 'react-router-dom';

// ─── Helpers ──────────────────────────────────────────────────
const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

const STATUS_CONFIG: Record<AvaliacaoLeadStatus, { label: string; color: string; icon: React.ReactNode }> = {
    new: { label: 'Novo', color: 'bg-violet-100 text-violet-700', icon: <Clock size={12} /> },
    contacted: { label: 'Contatado', color: 'bg-blue-100 text-blue-700', icon: <Phone size={12} /> },
    converted: { label: 'Convertido', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={12} /> },
    rejected: { label: 'Rejeitado', color: 'bg-red-100 text-red-700', icon: <XCircle size={12} /> },
};

const StatusBadge: React.FC<{ status: AvaliacaoLeadStatus }> = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.new;
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.color}`}>
            {cfg.icon} {cfg.label}
        </span>
    );
};

// ─── Card de Lead ─────────────────────────────────────────────
const LeadCard: React.FC<{ lead: AvaliacaoLead; onStatusChange: () => void }> = ({ lead, onRefresh: onStatusChange }) => {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [statusMenu, setStatusMenu] = useState(false);
    const [updating, setUpdating] = useState(false);

    const changeStatus = async (status: AvaliacaoLeadStatus) => {
        setStatusMenu(false);
        setUpdating(true);
        try {
            await updateAvaliacaoLeadStatus(lead.id, status);
            showToast(`Status atualizado para "${STATUS_CONFIG[status].label}"`, 'success');
            onStatusChange();
        } catch (e: any) {
            showToast(e.message || 'Erro.', 'error');
        } finally { setUpdating(false); }
    };

    const whatsappUrl = lead.customerPhone
        ? `https://wa.me/55${lead.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
            `Olá ${lead.customerName || ''}! Vi sua avaliação de ${lead.deviceBrand} ${lead.deviceModel}. Podemos conversar sobre o trade-in de R$ ${formatCurrency(lead.finalValue)}?`
        )}`
        : null;

    const createOrcamento = () => {
        navigate(`/orcamentos?tradeIn=${encodeURIComponent(JSON.stringify({
            device: `${lead.deviceBrand} ${lead.deviceModel} ${lead.deviceStorage || ''} ${lead.deviceColor || ''}`.trim(),
            value: lead.finalValue,
            customer: lead.customerName,
            phone: lead.customerPhone,
        }))}`);
    };

    return (
        <div className={`bg-white rounded-2xl border shadow-sm transition-all duration-200 ${lead.status === 'new' ? 'border-violet-200 ring-1 ring-violet-100' : 'border-gray-100'}`}>
            <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-violet-50 rounded-xl flex-shrink-0">
                            <Smartphone size={20} className="text-violet-600" />
                        </div>
                        <div>
                            <p className="font-black text-gray-900">{lead.deviceBrand} {lead.deviceModel}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {[lead.deviceStorage, lead.deviceColor].filter(Boolean).join(' · ')}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                <Calendar size={11} /> {formatDate(lead.createdAt)}
                            </p>
                        </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <p className="text-xl font-black text-violet-700">{formatCurrency(lead.finalValue)}</p>
                        <p className="text-xs text-gray-400">Base: {formatCurrency(lead.baseValue)}</p>
                    </div>
                </div>

                {/* Condição e defeitos */}
                <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                        {lead.conditionLabel}
                    </span>
                    {lead.partsSelected.map((p, i) => (
                        <span key={i} className="text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-full font-medium">
                            {p.label}
                        </span>
                    ))}
                </div>

                {/* Cliente */}
                {(lead.customerName || lead.customerPhone) && (
                    <div className="flex items-center gap-4 py-3 border-t border-gray-50 mb-3">
                        {lead.customerName && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                <User size={14} className="text-gray-400" />
                                <span className="font-medium">{lead.customerName}</span>
                            </div>
                        )}
                        {lead.customerPhone && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                <Phone size={14} className="text-gray-400" />
                                <span>{lead.customerPhone}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
                    {/* Status Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setStatusMenu(!statusMenu)}
                            disabled={updating}
                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                            <StatusBadge status={lead.status} />
                            <ChevronDown size={12} className="text-gray-400" />
                        </button>
                        {statusMenu && (
                            <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 z-20 min-w-[160px] overflow-hidden">
                                {(Object.keys(STATUS_CONFIG) as AvaliacaoLeadStatus[]).map(s => (
                                    <button key={s} onClick={() => changeStatus(s)}
                                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-left hover:bg-gray-50 transition-colors ${s === lead.status ? 'bg-violet-50' : ''}`}>
                                        {STATUS_CONFIG[s].icon}
                                        {STATUS_CONFIG[s].label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex-1" />

                    {whatsappUrl && (
                        <a href={whatsappUrl} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-colors">
                            <MessageSquare size={13} /> WhatsApp
                        </a>
                    )}
                    <button onClick={createOrcamento}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors">
                        <FileText size={13} /> Criar Orçamento
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────
const AvaliacaoLeads: React.FC = () => {
    const [leads, setLeads] = useState<AvaliacaoLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<AvaliacaoLeadStatus | 'all'>('all');
    const [search, setSearch] = useState('');

    const fetchLeads = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const data = await getAvaliacaoLeads();
            setLeads(data);
            setError(null);
        } catch (e: any) {
            setError('Erro ao carregar avaliações.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchLeads(); }, [fetchLeads]);

    const filtered = leads.filter(l => {
        const matchStatus = filter === 'all' || l.status === filter;
        const q = search.toLowerCase();
        const matchSearch = !q || `${l.deviceBrand} ${l.deviceModel} ${l.customerName || ''} ${l.customerPhone || ''}`.toLowerCase().includes(q);
        return matchStatus && matchSearch;
    });

    const kpis = {
        total: leads.length,
        new: leads.filter(l => l.status === 'new').length,
        converted: leads.filter(l => l.status === 'converted').length,
        totalValue: leads.filter(l => l.status === 'converted').reduce((s, l) => s + l.finalValue, 0),
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Avaliações Recebidas</h1>
                    <p className="text-gray-500 text-sm mt-1">Leads do formulário público de trade-in</p>
                </div>
                <button onClick={() => fetchLeads(true)} disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                    <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Atualizar
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total', value: kpis.total, color: 'text-gray-800' },
                    { label: 'Novos', value: kpis.new, color: 'text-violet-600' },
                    { label: 'Convertidos', value: kpis.converted, color: 'text-emerald-600' },
                    { label: 'Valor Convertido', value: formatCurrency(kpis.totalValue), color: 'text-emerald-600' },
                ].map(kpi => (
                    <div key={kpi.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{kpi.label}</p>
                        <p className={`text-xl font-black mt-1 ${kpi.color}`}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por dispositivo, cliente ou telefone..."
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                    {(['all', 'new', 'contacted', 'converted', 'rejected'] as const).map(s => (
                        <button key={s} onClick={() => setFilter(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === s ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            {s === 'all' ? 'Todos' : STATUS_CONFIG[s as AvaliacaoLeadStatus].label}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-red-700 text-sm font-medium">{error}</div>
            )}

            {filtered.length === 0 && !error && (
                <div className="text-center py-20 text-gray-400">
                    <List size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">{search || filter !== 'all' ? 'Nenhum resultado para este filtro' : 'Nenhuma avaliação recebida ainda'}</p>
                    <p className="text-sm mt-1">Os leads aparecerão aqui quando clientes preencherem o formulário público</p>
                </div>
            )}

            <div className="space-y-4">
                {filtered.map(lead => (
                    <LeadCard key={lead.id} lead={lead} onRefresh={() => fetchLeads(true)} />
                ))}
            </div>
        </div>
    );
};

export default AvaliacaoLeads;
