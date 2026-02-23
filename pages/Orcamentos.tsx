import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext.tsx';
import { PlusIcon, DocumentTextIcon, SuccessIcon, XCircleIcon, ArrowPathIcon, TrashIcon, WhatsAppIcon, PrinterIcon, CalendarDaysIcon, TrendingUpIcon, ChartBarIcon } from '../components/icons.tsx';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import OrcamentoPrintModal from '../components/orcamentos/OrcamentoPrintModal.tsx';
import { Orcamento } from '../types.ts';
import { getOrcamentos, convertOrcamentoToSale } from '../services/orcamentosService.ts';
import { getCashSessions } from '../services/mockApi.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { SuspenseFallback } from '../components/GlobalLoading.tsx';
import { formatDateTimeBR } from '../utils/dateUtils.ts';
import { formatCurrency } from '../services/mockApi.ts';
import NewOrcamentoView from '../components/orcamentos/NewOrcamentoView.tsx';
import ConfirmationModal from '../components/ConfirmationModal.tsx';

type TabType = 'list' | 'new';

const Orcamentos: React.FC = () => {
    const { user, permissions } = useUser();
    const { showToast } = useToast();
    const isAdmin = user?.permissionProfileId === 'profile-admin' || permissions?.canManageUsers;
    const [activeTab, setActiveTab] = useState<TabType>('list');

    // Lista de Orçamentos
    const [orcamentosList, setOrcamentosList] = useState<Orcamento[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrcamento, setSelectedOrcamento] = useState<Orcamento | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Filtros de Data
    const [dateStart, setDateStart] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [dateEnd, setDateEnd] = useState<string>(() => {
        return new Date().toISOString().split('T')[0];
    });

    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [orcamentoToConvert, setOrcamentoToConvert] = useState<Orcamento | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [orcamentoToDelete, setOrcamentoToDelete] = useState<string | null>(null);

    // Gráfico e Estatísticas
    const stats = React.useMemo(() => {
        const filtered = orcamentosList.filter(orc => {
            const orcDate = orc.created_at ? orc.created_at.split('T')[0] : '';
            return orcDate >= dateStart && orcDate <= dateEnd;
        });

        const total = filtered.length;
        const converted = filtered.filter(orc => orc.status === 'convertido').length;
        const remaining = total - converted;
        const rate = total > 0 ? (converted / total) * 100 : 0;

        const chartData = [
            { name: 'Convertidos', value: converted, color: '#10b981' },
            { name: 'Pendentes/Outros', value: remaining, color: '#fbbf24' }
        ];

        return { total, converted, remaining, rate, chartData, filteredList: filtered };
    }, [orcamentosList, dateStart, dateEnd]);

    const loadOrcamentos = async () => {
        setLoading(true);
        try {
            const data = await getOrcamentos(isAdmin ? undefined : user?.id);
            setOrcamentosList(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'list') {
            loadOrcamentos();
        }
    }, [activeTab, isAdmin, user?.id]);

    useEffect(() => {
        const handleReload = () => {
            if (document.visibilityState === 'visible') {
                loadOrcamentos();
            }
        };
        window.addEventListener('app-reloadData', handleReload);
        return () => window.removeEventListener('app-reloadData', handleReload);
    }, []);

    const handleSaveOrcamento = () => {
        setActiveTab('list');
        loadOrcamentos();
    };

    const handleDelete = (id: string) => {
        setOrcamentoToDelete(id);
        setIsDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!orcamentoToDelete) return;
        try {
            setLoading(true);
            const { deleteOrcamento } = await import('../services/orcamentosService.ts');
            await deleteOrcamento(orcamentoToDelete);
            showToast('Orçamento excluído.', 'success');
            setSelectedOrcamento(null);
            loadOrcamentos();
        } catch (e) {
            showToast('Erro ao excluir.', 'error');
        } finally {
            setLoading(false);
            setIsDeleteConfirmOpen(false);
            setOrcamentoToDelete(null);
        }
    };

    const handleConvert = async (orcamento: Orcamento, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!user) return;
        try {
            setLoading(true);

            // Verifica caixa do usuario
            const sessions = await getCashSessions(user.id);
            const openSession = sessions.find(s => s.userId === user.id && s.status === 'aberto');

            if (!openSession) {
                showToast('Você precisa de um Caixa aberto no PDV para registrar esta venda.', 'warning');
                return;
            }

            if (!orcamento.cliente_id) {
                showToast('Este orçamento não possui um cliente vinculado. Vincule um cliente antes de converter em venda.', 'warning');
                return;
            }

            setOrcamentoToConvert(orcamento);
            setIsConfirmModalOpen(true);
        } catch (e: any) {
            showToast(e.message || 'Falha ao iniciar conversão.', 'error');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const confirmConvert = async () => {
        if (!user || !orcamentoToConvert) return;
        try {
            setLoading(true);
            const sessions = await getCashSessions(user.id);
            const openSession = sessions.find(s => s.userId === user.id && s.status === 'aberto');

            if (!openSession) {
                showToast('Caixa fechado. Não é possível converter.', 'error');
                return;
            }

            await convertOrcamentoToSale(orcamentoToConvert, user.id, user.name, openSession.id, openSession.displayId);
            showToast('Orçamento convertido em venda com sucesso!', 'success');
            setSelectedOrcamento(null);
            setIsConfirmModalOpen(false);
            setOrcamentoToConvert(null);
            loadOrcamentos();
        } catch (e: any) {
            showToast(e.message || 'Falha ao converter o orçamento.', 'error');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (activeTab === 'new' || isEditing) {
        return (
            <NewOrcamentoView
                onCancel={() => {
                    setActiveTab('list');
                    setIsEditing(false);
                    setSelectedOrcamento(null);
                }}
                onSaved={() => {
                    handleSaveOrcamento();
                    setIsEditing(false);
                    setSelectedOrcamento(null);
                }}
                orcamentoToEdit={selectedOrcamento}
            />
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
            <header className="bg-white px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-3 mb-4 md:mb-0">
                    <div className="p-2.5 bg-orange-100 rounded-xl">
                        <DocumentTextIcon className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Orçamentos</h1>
                        <p className="text-sm text-gray-500 font-medium">Crie simulações e converta-as em vendas</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200">
                        <input
                            type="date"
                            value={dateStart}
                            onChange={(e) => setDateStart(e.target.value)}
                            className="text-xs font-bold text-gray-700 outline-none bg-transparent w-[110px] !border-none focus:ring-0 p-0"
                        />
                        <span className="text-[10px] font-black text-gray-300 uppercase px-1">até</span>
                        <input
                            type="date"
                            value={dateEnd}
                            onChange={(e) => setDateEnd(e.target.value)}
                            className="text-xs font-bold text-gray-700 outline-none bg-transparent w-[110px] !border-none focus:ring-0 p-0"
                        />
                    </div>

                    <button
                        onClick={loadOrcamentos}
                        className="flex items-center justify-center p-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                    >
                        <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setActiveTab('new')}
                        className="flex items-center justify-center gap-2 bg-orange-300 hover:bg-orange-400 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm shadow-orange-300/20 transition-all hover:-translate-y-0.5"
                    >
                        <PlusIcon className="h-5 w-5" />
                        <span className="hidden sm:inline">Novo Orçamento</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-auto p-4 md:p-6 pb-24 md:pb-6 custom-scrollbar">
                {loading ? (
                    <SuspenseFallback />
                ) : (
                    <div className="flex flex-col gap-6">
                        {/* Dashboard KPIs */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Total */}
                            <div className="relative p-5 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                                <div className="absolute -top-4 -right-4 w-20 h-20 bg-blue-50 rounded-full opacity-60 group-hover:scale-110 transition-transform"></div>
                                <div className="relative">
                                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl w-fit mb-3">
                                        <DocumentTextIcon className="w-5 h-5" />
                                    </div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total no Período</p>
                                    <p className="text-3xl font-black text-gray-800 tracking-tighter leading-none">{stats.total}</p>
                                    <p className="text-[11px] text-gray-400 font-medium mt-1.5">Orçamentos gerados</p>
                                </div>
                            </div>

                            {/* Convertidos */}
                            <div className="relative p-5 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                                <div className="absolute -top-4 -right-4 w-20 h-20 bg-emerald-50 rounded-full opacity-60 group-hover:scale-110 transition-transform"></div>
                                <div className="relative">
                                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl w-fit mb-3">
                                        <TrendingUpIcon className="w-5 h-5" />
                                    </div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Convertidos</p>
                                    <p className="text-3xl font-black text-emerald-600 tracking-tighter leading-none">{stats.converted}</p>
                                    <p className="text-[11px] text-gray-400 font-medium mt-1.5">Viraram vendas</p>
                                </div>
                            </div>

                            {/* Taxa de Conversão */}
                            <div className="relative p-5 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                                <div className="absolute -top-4 -right-4 w-20 h-20 bg-orange-50 rounded-full opacity-60 group-hover:scale-110 transition-transform"></div>
                                <div className="relative">
                                    <div className="p-2 bg-orange-50 text-orange-600 rounded-xl w-fit mb-3">
                                        <SuccessIcon className="w-5 h-5" />
                                    </div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Taxa de Conversão</p>
                                    <p className="text-3xl font-black text-orange-500 tracking-tighter leading-none">{stats.rate.toFixed(1)}%</p>
                                    <div className="mt-2.5 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-gradient-to-r from-orange-300 to-orange-500 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.max(stats.rate, 2)}%` }}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Mini Gráfico Donut inline */}
                            <div className="relative p-5 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow flex flex-col">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Funil de Conversão</p>
                                {stats.total === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center">
                                        <div className="w-[100px] h-[100px] rounded-full border-[8px] border-gray-100 flex items-center justify-center">
                                            <span className="text-xs font-bold text-gray-300">Sem dados</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center min-h-[120px]">
                                        <ResponsiveContainer width="100%" height={140}>
                                            <PieChart>
                                                <Pie
                                                    data={stats.chartData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={38}
                                                    outerRadius={55}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                    strokeWidth={0}
                                                >
                                                    {stats.chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: '12px', fontWeight: 'bold', padding: '8px 14px' }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                                <div className="flex items-center justify-center gap-3 mt-1">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        <span className="text-[10px] font-bold text-gray-400">Vendas</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                                        <span className="text-[10px] font-bold text-gray-400">Pendentes</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabela de Resultados */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Últimos Orçamentos</h2>
                                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                                    {stats.filteredList.length} encontrados
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {stats.filteredList.length === 0 ? (
                                    <div className="col-span-full bg-white rounded-[24px] border border-gray-100 p-12 text-center shadow-glass-sm mt-10">
                                        <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <DocumentTextIcon className="h-10 w-10 text-orange-400" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-800 mb-2">Nenhum orçamento neste período</h3>
                                        <p className="text-gray-500">Tente ajustar as datas do filtro.</p>
                                    </div>
                                ) : (
                                    stats.filteredList.map((orc) => (
                                        <div
                                            key={orc.id}
                                            onClick={() => setSelectedOrcamento(orc)}
                                            className="bg-white rounded-2xl border border-gray-100 p-5 shadow-glass-sm hover:shadow-glass hover:-translate-y-1 transition-all flex flex-col cursor-pointer group"
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg mb-2 group-hover:bg-orange-100 group-hover:text-orange-700 transition-colors">
                                                        {orc.numero}
                                                    </span>
                                                    <h4 className="font-black text-orange-400 text-xl tracking-tighter">
                                                        {formatCurrency(orc.total_final)}
                                                    </h4>
                                                </div>
                                                <StatusBadge status={orc.status} />
                                            </div>

                                            <div className="space-y-2 mb-4 flex-1">
                                                <div className="flex items-center text-sm text-gray-600">
                                                    <div className="w-24 text-gray-400">Criado:</div>
                                                    <div className="font-medium text-gray-800">{formatDateTimeBR(orc.created_at)}</div>
                                                </div>
                                                <div className="flex items-center text-sm text-gray-600">
                                                    <div className="w-24 text-gray-400">Fechamento:</div>
                                                    <div className="font-bold text-orange-500">{orc.probabilidade_fechamento_percentual || 0}%</div>
                                                </div>
                                            </div>

                                            <div className="border-t border-gray-100 pt-4 flex gap-2">
                                                {orc.status !== 'convertido' && (
                                                    <button
                                                        onClick={(e) => handleConvert(orc, e)}
                                                        className="flex-1 py-2.5 bg-orange-400 text-white hover:bg-orange-500 rounded-xl font-bold transition-all text-sm shadow-sm shadow-orange-400/10">
                                                        Converter Venda
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedOrcamento(orc);
                                                    }}
                                                    className="flex-1 py-2.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-xl font-bold transition-all text-sm">
                                                    Detalhes
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(orc.id);
                                                    }}
                                                    className="p-2.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-all shadow-sm shadow-red-500/5 group/del"
                                                    title="Excluir Orçamento"
                                                >
                                                    <TrashIcon className="h-5 w-5 group-hover/del:scale-110 transition-transform" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {selectedOrcamento && (
                <OrcamentoDetailsModal
                    orcamento={selectedOrcamento}
                    onClose={() => setSelectedOrcamento(null)}
                    onEdit={() => setIsEditing(true)}
                    onDelete={() => handleDelete(selectedOrcamento.id)}
                    onConvert={() => handleConvert(selectedOrcamento)}
                    user={user}
                />
            )}

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                title="Converter em Venda"
                message={`Deseja converter o orçamento #${orcamentoToConvert?.numero} em Venda? Os items serão baixados do estoque e a venda será registrada no seu caixa atual.`}
                variant="success"
                onConfirm={confirmConvert}
                onClose={() => {
                    setIsConfirmModalOpen(false);
                    setOrcamentoToConvert(null);
                }}
            />

            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                title="Excluir Orçamento"
                message="Deseja realmente excluir este orçamento? Esta ação não pode ser desfeita."
                variant="danger"
                onConfirm={confirmDelete}
                onClose={() => {
                    setIsDeleteConfirmOpen(false);
                    setOrcamentoToDelete(null);
                }}
            />
        </div>
    );
};

// Componente Interno de Detalhes
const OrcamentoDetailsModal = ({ orcamento, onClose, onEdit, onDelete, onConvert, user }: any) => {
    const [showPrint, setShowPrint] = useState(false);
    const { showToast } = useToast();

    const handleWhatsApp = () => {
        const itemsText = orcamento.itens?.map((item: any) =>
            `• ${item.quantidade}x ${item.nome_produto_snapshot}: ${formatCurrency(item.total_snapshot || (item.quantidade * item.preco_unitario_snapshot))}`
        ).join('\n') || '';

        const message = [
            `*🏷️ ORÇAMENTO ${orcamento.numero}*`,
            `----------------------------------------------`,
            `Olá! Segue abaixo o resumo do seu orçamento:`,
            ``,
            itemsText,
            ``,
            `*💰 TOTAL FINAL: ${formatCurrency(orcamento.total_final)}*`,
            ``,
            `*💳 FORMAS DE PAGAMENTO:*`,
            orcamento.forma_pagamento_snapshot?.pagamentos?.map((p: any) =>
                `• ${p.method}${p.installments > 1 ? ` (${p.installments}x)` : ''}: ${formatCurrency(p.value)}`
            ).join('\n'),
            ``,
            orcamento.observacoes ? `*📝 Obs:* ${orcamento.observacoes}` : null,
            `----------------------------------------------`,
            `*Atendimento por:* ${orcamento.vendedor_nome || user?.name || 'iStore'}`,
            `_Gerado via iStore Pro_`
        ].filter(Boolean).join('\n');

        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <DocumentTextIcon className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-800 uppercase tracking-tight">Detalhes do Orçamento</h3>
                            <p className="text-xs text-gray-500 font-bold">{orcamento.numero}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <XCircleIcon className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-6">
                        {/* Status, Criacao e Vendedor */}
                        <div className="flex justify-between items-start">
                            <StatusBadge status={orcamento.status} />
                            <div className="text-right">
                                <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Criado em {formatDateTimeBR(orcamento.created_at)}</span>
                                <span className="block text-[10px] text-orange-500 font-black uppercase tracking-wider mt-0.5">
                                    Por: {orcamento.vendedor_nome || user?.name || 'Sistema'}
                                </span>
                            </div>
                        </div>

                        {/* Itens */}
                        <div>
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Itens do Orçamento</h4>
                            <div className="space-y-2">
                                {orcamento.itens?.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <div className="flex-1">
                                            <div className="flex flex-col mb-1">
                                                <p className="font-bold text-gray-900 text-base leading-tight mb-1">
                                                    {item.nome_produto_snapshot}
                                                </p>
                                                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-gray-500 uppercase font-black">
                                                    {item.sku_snapshot && <span>SKU: {item.sku_snapshot}</span>}
                                                    {item.metadata_snapshot?.imei1 && <span>IMEI: {item.metadata_snapshot.imei1}</span>}
                                                    {item.metadata_snapshot?.serialNumber && <span>SN: {item.metadata_snapshot.serialNumber}</span>}
                                                    {item.metadata_snapshot?.barcodes && item.metadata_snapshot.barcodes[0] && <span>EAN: {item.metadata_snapshot.barcodes[0]}</span>}
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                                {item.quantidade}x {formatCurrency(item.preco_unitario_snapshot)}
                                            </p>
                                        </div>
                                        <div className="font-black text-orange-400 text-sm ml-4">
                                            {formatCurrency(item.total_snapshot || (item.quantidade * item.preco_unitario_snapshot))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Pagamentos */}
                        <div>
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Simulação de Pagamento</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {orcamento.forma_pagamento_snapshot?.pagamentos?.map((p: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-orange-50/30 p-2.5 rounded-lg border border-orange-100/50">
                                        <span className="text-xs font-bold text-gray-700">{p.method} {p.installments > 1 ? `(${p.installments}x)` : ''}</span>
                                        <span className="text-xs font-black text-orange-400">{formatCurrency(p.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Totais */}
                        <div className="bg-white rounded-3xl p-6 border-2 border-orange-100 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
                            <div className="relative space-y-3">
                                <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    <span>Subtotal</span>
                                    <span className="text-orange-500">{formatCurrency(orcamento.subtotal)}</span>
                                </div>
                                {orcamento.desconto_total > 0 && (
                                    <div className="flex justify-between text-xs font-bold text-green-600 uppercase tracking-widest">
                                        <span>Desconto</span>
                                        <span>-{formatCurrency(orcamento.desconto_total)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-end pt-4 border-t border-gray-100 mt-2">
                                    <span className="font-black text-gray-400 text-[10px] uppercase tracking-widest pb-1">Total Final</span>
                                    <span className="text-3xl font-black text-orange-400 tracking-tighter">{formatCurrency(orcamento.total_final)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-3">
                    <button onClick={handleWhatsApp} className="flex items-center justify-center gap-2 bg-green-400 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-green-400/20 active:scale-95">
                        <WhatsAppIcon className="w-5 h-5" /> WhatsApp
                    </button>
                    <button onClick={() => setShowPrint(true)} className="flex items-center justify-center gap-2 bg-blue-400 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-blue-400/20 active:scale-95">
                        <PrinterIcon className="w-5 h-5" /> Imprimir
                    </button>

                    {orcamento.status !== 'convertido' && (
                        <>
                            <button onClick={onEdit} className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 font-bold py-3 rounded-xl transition-all active:scale-95">
                                Editar
                            </button>
                            <button onClick={onConvert} className="flex items-center justify-center gap-2 bg-orange-300 hover:bg-orange-400 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-orange-300/20 active:scale-95">
                                Converter Venda
                            </button>
                            <button onClick={onDelete} className="col-span-2 flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 font-bold py-2 transition-all">
                                <TrashIcon className="w-4 h-4" /> Excluir Orçamento
                            </button>
                        </>
                    )}
                </div>
            </div>

            {showPrint && (
                <div className="z-[200]">
                    <OrcamentoPrintModal orcamento={orcamento} onClose={() => setShowPrint(false)} />
                </div>
            )}
        </div>
    );
};

const StatusBadge = ({ status }: { status: Orcamento['status'] }) => {
    switch (status) {
        case 'finalizado':
            return <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100"><SuccessIcon className="w-3.5 h-3.5" />Finalizado</div>;
        case 'convertido':
            return <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-100"><SuccessIcon className="w-3.5 h-3.5" />Convertido</div>;
        case 'expirado':
            return <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-xs font-bold border border-red-100"><XCircleIcon className="w-3.5 h-3.5" />Expirado</div>;
        default:
            return <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold border border-gray-200">Rascunho</div>;
    }
};

export default Orcamentos;
