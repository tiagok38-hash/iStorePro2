import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext.tsx';
import { PlusIcon, DocumentTextIcon, SuccessIcon, XCircleIcon, ArrowPathIcon, TrashIcon, WhatsAppIcon, PrinterIcon } from '../components/icons.tsx';
import OrcamentoPrintModal from '../components/orcamentos/OrcamentoPrintModal.tsx';
import { Orcamento } from '../types.ts';
import { getOrcamentos, convertOrcamentoToSale } from '../services/orcamentosService.ts';
import { getCashSessions } from '../services/mockApi.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { SuspenseFallback } from '../components/GlobalLoading.tsx';
import { formatDateTimeBR } from '../utils/dateUtils.ts';
import { formatCurrency } from '../services/mockApi.ts';
// Import NewOrcamentoView (To be created)
import NewOrcamentoView from '../components/orcamentos/NewOrcamentoView.tsx';

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

    const handleSaveOrcamento = () => {
        setActiveTab('list');
        loadOrcamentos();
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Deseja realmente excluir este orçamento?')) return;
        try {
            setLoading(true);
            const { deleteOrcamento } = await import('../services/orcamentosService.ts');
            await deleteOrcamento(id);
            showToast('Orçamento excluído.', 'success');
            setSelectedOrcamento(null);
            loadOrcamentos();
        } catch (e) {
            showToast('Erro ao excluir.', 'error');
        } finally {
            setLoading(false);
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

            // Confirmação via prompt simples ou alert personalizado (usando window.confirm para simplificar)
            if (!window.confirm(`Deseja converter o orçamento #${orcamento.numero} em Venda? Os itens serão baixados do estoque.`)) {
                return;
            }

            await convertOrcamentoToSale(orcamento, user.id, user.name, openSession.id, openSession.displayId);
            showToast('Orçamento convertido em venda com sucesso!', 'success');
            setSelectedOrcamento(null);
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

                <div className="flex gap-3">
                    <button
                        onClick={loadOrcamentos}
                        className="flex items-center justify-center p-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                    >
                        <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setActiveTab('new')}
                        className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm shadow-orange-500/20 transition-all hover:-translate-y-0.5"
                    >
                        <PlusIcon className="h-5 w-5" />
                        <span className="hidden sm:inline">Novo Orçamento</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-auto p-4 md:p-6 pb-24 md:pb-6 custom-scrollbar">
                {loading ? (
                    <SuspenseFallback />
                ) : orcamentosList.length === 0 ? (
                    <div className="bg-white rounded-[24px] border border-gray-100 p-12 text-center shadow-glass-sm max-w-2xl mx-auto mt-10">
                        <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <DocumentTextIcon className="h-10 w-10 text-orange-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Nenhum orçamento encontrado</h3>
                        <p className="text-gray-500 mb-6">Comece a cadastrar orçamentos simulados para seus clientes.</p>
                        <button
                            onClick={() => setActiveTab('new')}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md shadow-orange-500/20"
                        >
                            Criar Primeiro Orçamento
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {orcamentosList.map(orc => (
                            <div
                                key={orc.id}
                                onClick={() => setSelectedOrcamento(orc)}
                                className="bg-white rounded-2xl border border-gray-100 p-5 shadow-glass-sm hover:shadow-glass hover:-translate-y-1 transition-all flex flex-col cursor-pointer group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg mb-2 group-hover:bg-orange-100 group-hover:text-orange-700 transition-colors">
                                            #{orc.numero}
                                        </span>
                                        <h4 className="font-bold text-gray-800 text-lg">
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
                                        <div className="font-bold text-orange-600">{orc.probabilidade_fechamento_percentual || 0}%</div>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 pt-4 flex gap-2">
                                    {orc.status !== 'convertido' && (
                                        <button
                                            onClick={(e) => handleConvert(orc, e)}
                                            className="flex-1 py-2.5 bg-orange-500 text-white hover:bg-orange-600 rounded-xl font-bold transition-all text-sm shadow-sm shadow-orange-500/10">
                                            Converter Venda
                                        </button>
                                    )}
                                    <button className="flex-1 py-2.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-xl font-bold transition-all text-sm">
                                        Detalhes
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Modal de Detalhes do Orçamento */}
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
        </div>
    );
};

// Componente Interno de Detalhes
const OrcamentoDetailsModal = ({ orcamento, onClose, onEdit, onDelete, onConvert, user }: any) => {
    const [showPrint, setShowPrint] = useState(false);
    const { showToast } = useToast();

    const handleWhatsApp = () => {
        const itemsText = orcamento.itens?.map((item: any) =>
            `• ${item.quantidade}x ${item.nome_produto_snapshot}: ${formatCurrency(item.total_snapshot)}`
        ).join('\n') || '';

        const message = [
            `*🏷️ ORÇAMENTO #${orcamento.numero}*`,
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
                            <p className="text-xs text-gray-500 font-bold">#{orcamento.numero}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <XCircleIcon className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-6">
                        {/* Status e Criacao */}
                        <div className="flex justify-between items-center">
                            <StatusBadge status={orcamento.status} />
                            <span className="text-xs text-gray-400 font-bold">Criado em {formatDateTimeBR(orcamento.created_at)}</span>
                        </div>

                        {/* Itens */}
                        <div>
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Itens do Orçamento</h4>
                            <div className="space-y-2">
                                {orcamento.itens?.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <div className="flex-1">
                                            <p className="font-bold text-gray-800 text-sm leading-tight">
                                                {item.nome_produto_snapshot || `Produto #${item.sku_snapshot || item.produto_id}`}
                                            </p>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                                                {item.quantidade}x {formatCurrency(item.preco_unitario_snapshot)}
                                                {item.sku_snapshot && <span className="ml-2 border-l pl-2">REF: {item.sku_snapshot}</span>}
                                            </p>
                                        </div>
                                        <div className="font-black text-gray-900 text-sm ml-4">
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
                                        <span className="text-xs font-black text-orange-600">{formatCurrency(p.value)}</span>
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
                                    <span>{formatCurrency(orcamento.subtotal)}</span>
                                </div>
                                {orcamento.desconto_total > 0 && (
                                    <div className="flex justify-between text-xs font-bold text-green-600 uppercase tracking-widest">
                                        <span>Desconto</span>
                                        <span>-{formatCurrency(orcamento.desconto_total)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-end pt-4 border-t border-gray-100 mt-2">
                                    <span className="font-black text-gray-400 text-[10px] uppercase tracking-widest pb-1">Total Final</span>
                                    <span className="text-3xl font-black text-orange-600 tracking-tighter">{formatCurrency(orcamento.total_final)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-3">
                    <button onClick={handleWhatsApp} className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-green-500/20 active:scale-95">
                        <WhatsAppIcon className="w-5 h-5" /> WhatsApp
                    </button>
                    <button onClick={() => setShowPrint(true)} className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95">
                        <PrinterIcon className="w-5 h-5" /> Imprimir
                    </button>

                    {orcamento.status !== 'convertido' && (
                        <>
                            <button onClick={onEdit} className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 font-bold py-3 rounded-xl transition-all active:scale-95">
                                Editar
                            </button>
                            <button onClick={onConvert} className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-orange-500/20 active:scale-95">
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
