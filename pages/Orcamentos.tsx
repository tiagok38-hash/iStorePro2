import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext.tsx';
import { PlusIcon, DocumentTextIcon, SuccessIcon, XCircleIcon, ArrowPathIcon } from '../components/icons.tsx';
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

    const handleConvert = async (orcamento: Orcamento) => {
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
            loadOrcamentos();
        } catch (e: any) {
            showToast(e.message || 'Falha ao converter o orçamento.', 'error');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (activeTab === 'new') {
        return (
            <NewOrcamentoView
                onCancel={() => setActiveTab('list')}
                onSaved={handleSaveOrcamento}
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
                            <div key={orc.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-glass-sm hover:shadow-glass hover:-translate-y-1 transition-all flex flex-col cursor-pointer">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg mb-2">
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
                                            onClick={() => handleConvert(orc)}
                                            className="flex-1 py-2 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-xl font-bold transition-colors text-sm">
                                            Converter Venda
                                        </button>
                                    )}
                                    <button className="flex-1 py-2 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-xl font-bold transition-colors text-sm">
                                        Detalhes
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
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
