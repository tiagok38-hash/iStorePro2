
import React, { useState } from 'react';
import { CashSession, Sale, Product, Customer, User } from '../../types.ts';
import { formatCurrency } from '../../services/mockApi.ts';
import {
    CashRegisterIcon, CheckIcon, ShoppingCartPlusIcon, MinusIcon, PlusIcon,
    XCircleIcon, ArrowPathRoundedSquareIcon, ShoppingCartIcon, EditIcon,
    EyeIcon, PrinterIcon, TrashIcon, CashIcon
} from '../icons.tsx';

interface ResumoCaixaViewProps {
    viewSession: CashSession | null;
    currentUserOpenSession: CashSession | null;
    sessionSales: Sale[];
    customers: Customer[];
    handleNewSession: () => void;
    setActiveView: (view: any) => void;
    handleOpenCashMovement: (type: 'suprimento' | 'sangria') => void;
    handleCloseSession: (s: CashSession) => void;
    handleReopenSession: (s: CashSession) => void;
    handleEditSale: (sale: Sale) => void;
    handleViewClick: (sale: Sale) => void;
    handlePrintClick: (sale: Sale) => void;
    cancelSale: (id: string, reason: string) => Promise<any>;
    showToast: (msg: string, type: any) => void;
    fetchData: () => void;
    users: User[];
}

export const ResumoCaixaView: React.FC<ResumoCaixaViewProps> = ({
    viewSession, currentUserOpenSession, sessionSales, customers,
    handleNewSession, setActiveView, handleOpenCashMovement,
    handleCloseSession, handleReopenSession, handleEditSale,
    handleViewClick, handlePrintClick, cancelSale, showToast, fetchData, users
}) => {
    const [viewMovementsType, setViewMovementsType] = useState<'sangria' | 'suprimento' | null>(null);
    const targetSession = viewSession || currentUserOpenSession;
    const isCurrent = targetSession?.id === currentUserOpenSession?.id;
    const isOpen = targetSession?.status === 'aberto';

    // Calcular totais por método de pagamento
    const totalsByMethod: Record<string, number> = {};
    (sessionSales || []).forEach(s => {
        if (s.status === 'Cancelada') return;
        (s.payments || []).forEach(p => {
            totalsByMethod[p.method] = (totalsByMethod[p.method] || 0) + (p.value || 0);
        });
    });

    // Somar todas as variações de "Dinheiro" (case insensitive)
    let cashSales = 0;
    Object.entries(totalsByMethod).forEach(([method, value]) => {
        if (method.trim().toLowerCase() === 'dinheiro') {
            cashSales += Number(value || 0);
        }
    });

    // CORREÇÃO: Usar 'deposits' ao invés de 'supply' conforme renderizado na UI
    const calculatedCashInRegister = Number(targetSession?.openingBalance || 0) + cashSales + Number(targetSession?.deposits || 0) - Number(targetSession?.withdrawals || 0);

    if (!targetSession) {
        return (
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center flex flex-col items-center gap-6">
                <div className="p-4 bg-gray-100 rounded-full">
                    <CashRegisterIcon className="h-16 w-16 text-gray-400" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-gray-700">Seu caixa está fechado</h3>
                    <p className="text-muted">Abra seu caixa para começar a realizar vendas.</p>
                </div>
                <button
                    onClick={handleNewSession}
                    className="px-8 py-4 bg-success text-white rounded-xl font-black text-lg shadow-xl shadow-success/20 hover:bg-success/90 transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center gap-3"
                >
                    <CheckIcon className="h-6 w-6" />
                    ABRIR MEU CAIXA
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in pb-20 md:pb-0">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight">{viewSession ? 'Detalhes do Caixa' : 'Meu Caixa'}</h2>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 items-stretch">
                {/* Card 1: Faturamento (8/12 width) */}
                <div className="lg:col-span-8 bg-white p-3 md:p-4 rounded-xl shadow-sm border border-primary/20 flex flex-col justify-between relative overflow-hidden h-full">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-success"></div>
                    <div>
                        <div className="flex items-center justify-between gap-4 mb-2 md:mb-3">
                            <div className="flex items-center gap-2">
                                <span className="p-1 px-1.5 bg-success/10 rounded text-success">
                                    <ShoppingCartIcon className="h-4 w-4 md:h-5 md:w-5" />
                                </span>
                                <span className="text-[9px] md:text-[11px] font-bold text-gray-700 uppercase tracking-widest">Faturamento</span>
                            </div>
                            <div className="text-xl md:text-3xl font-black text-gray-800 tracking-tight">
                                {formatCurrency(targetSession.transactionsValue)}
                            </div>
                        </div>

                        <div className="pt-2 md:pt-3 border-t border-gray-100">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 md:gap-2">
                                {Object.entries(totalsByMethod).sort((a, b) => (a[0].trim().toLowerCase() === 'dinheiro' ? -1 : 1)).map(([method, value]) => {
                                    const isCash = method.trim().toLowerCase() === 'dinheiro';
                                    const isPromissoria = method.trim().toLowerCase().includes('promiss');
                                    return (
                                        <div key={method} className={`p-1.5 px-2 md:p-2 md:px-3 rounded-lg border flex items-center justify-between gap-1 transition-all ${isCash ? 'bg-success/5 border-success/30 ring-1 ring-success/10' : isPromissoria ? 'bg-red-50 border-red-300 ring-2 ring-red-200' : 'bg-white border-gray-200 shadow-sm'}`}>
                                            <span className={`text-[7px] md:text-[9px] font-bold uppercase tracking-wider truncate shrink ${isCash ? 'text-success' : isPromissoria ? 'text-red-600' : 'text-gray-500'}`}>
                                                {method}
                                            </span>
                                            <span className={`text-xs md:text-sm font-black shrink-0 ${isCash ? 'text-success' : isPromissoria ? 'text-red-600' : 'text-gray-800'}`}>
                                                {formatCurrency(value)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Coluna Direita (Stack - 4/12 width) */}
                <div className="lg:col-span-4 flex flex-col gap-2 md:gap-3 h-full">
                    {/* Compact Balance & Movements Card */}
                    <div className={`bg-white p-3 md:p-4 rounded-xl shadow-sm border ${isOpen ? 'border-success/30' : 'border-red-500/30'} relative overflow-hidden flex flex-col justify-between gap-2 md:gap-4 h-full text-gray-700`}>
                        <div className={`absolute top-0 left-0 w-1.5 h-full ${isOpen ? 'bg-success' : 'bg-red-500'}`}></div>

                        {/* Header: Title & Total */}
                        <div>
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[9px] md:text-[11px] font-bold uppercase tracking-widest truncate mr-2">Dinheiro em espécie (Na gaveta)</span>
                                <span className={`px-1.5 py-0.5 ${isOpen ? 'bg-success' : 'bg-red-500'} text-white text-[7px] md:text-[9px] font-black uppercase rounded shrink-0`}>{targetSession.status === 'aberto' ? 'ABERTO' : 'FECHADO'}</span>
                            </div>
                            <div className="text-xl md:text-3xl font-black text-gray-800 leading-none" title={`Abertura: ${formatCurrency(targetSession?.openingBalance || 0)} + Vendas: ${formatCurrency(cashSales)} + Suprim.: ${formatCurrency(targetSession?.deposits || 0)} - Sangrias: ${formatCurrency(targetSession?.withdrawals || 0)}`}>
                                {formatCurrency(calculatedCashInRegister)}
                            </div>
                        </div>

                        {/* Movements Section (Integrated) */}
                        <div className="space-y-1.5 md:space-y-3 pt-1.5 md:pt-3 border-t border-gray-100">
                            {/* Sangria Row */}
                            <div className="flex items-center justify-between group">
                                <div className="flex items-center gap-2">
                                    <span className="text-[8px] md:text-[10px] font-bold text-red-500 uppercase tracking-widest shrink-0">Sangria</span>
                                    <span className="text-sm md:text-lg font-black text-gray-800 tracking-tight">{formatCurrency(targetSession.withdrawals || 0)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setViewMovementsType('sangria')} className="p-0.5 px-1.5 bg-gray-50 text-gray-400 hover:bg-primary/10 hover:text-primary rounded-lg transition-all border border-gray-100"><EyeIcon className="h-3 w-3 md:h-4 md:w-4" /></button>
                                    {isOpen && <button onClick={() => handleOpenCashMovement('sangria')} className="p-0.5 px-1.5 bg-danger/5 text-danger hover:bg-danger hover:text-white rounded-lg border border-danger/30 transition-all"><MinusIcon className="h-3 w-3 md:h-4 md:w-4" /></button>}
                                </div>
                            </div>

                            {/* Suprimento Row */}
                            <div className="flex items-center justify-between group">
                                <div className="flex items-center gap-2">
                                    <span className="text-[8px] md:text-[10px] font-bold text-green-600 uppercase tracking-widest shrink-0">Suprim.</span>
                                    <span className="text-sm md:text-lg font-black text-gray-800 tracking-tight">{formatCurrency(targetSession.deposits || 0)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setViewMovementsType('suprimento')} className="p-0.5 px-1.5 bg-gray-50 text-gray-400 hover:bg-primary/10 hover:text-primary rounded-lg transition-all border border-gray-100"><EyeIcon className="h-3 w-3 md:h-4 md:w-4" /></button>
                                    {isOpen && <button onClick={() => handleOpenCashMovement('suprimento')} className="p-0.5 px-1.5 bg-success/5 text-success hover:bg-success hover:text-white rounded-lg border border-success/30 transition-all"><PlusIcon className="h-3 w-3 md:h-4 md:w-4" /></button>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ações e Informações da Sessão */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4">
                {isOpen ? (
                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={() => setActiveView('pdv')}
                            className="flex-1 px-3 md:px-6 py-2 md:py-3 bg-success text-white rounded-lg md:rounded-xl font-black shadow-lg shadow-success/20 hover:bg-success/90 transition-all flex items-center justify-center gap-2 text-xs md:text-sm uppercase transform active:scale-95"
                        >
                            <ShoppingCartPlusIcon className="h-4 w-4 md:h-5 md:w-5" />
                            NOVA VENDA
                        </button>
                        <button
                            onClick={() => handleCloseSession(targetSession)}
                            className="px-3 md:px-6 py-2 md:py-3 bg-white text-danger border-2 border-danger rounded-lg md:rounded-xl font-black hover:bg-danger hover:text-white transition-all flex items-center justify-center gap-2 text-xs md:text-sm uppercase transform active:scale-95"
                        >
                            <XCircleIcon className="h-4 w-4 md:h-5 md:w-5" />
                            FECHAR
                        </button>
                    </div>
                ) : targetSession.status === 'fechado' && (
                    <button
                        onClick={() => handleReopenSession(targetSession)}
                        className="w-full md:w-auto px-4 md:px-6 py-2 md:py-3 bg-blue-500 text-white rounded-lg md:rounded-xl font-black shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all flex items-center justify-center gap-2 text-xs md:text-sm uppercase"
                    >
                        <ArrowPathRoundedSquareIcon className="h-4 w-4 md:h-5 md:w-5" />
                        REABRIR CAIXA
                    </button>
                )}

                <div className="flex flex-1 flex-row flex-wrap items-center gap-2 md:gap-4 bg-white p-3 md:p-4 rounded-xl border border-gray-100 overflow-x-auto no-scrollbar">
                    <div className="px-2 md:px-4 border-r border-gray-100 shrink-0">
                        <p className="text-[8px] md:text-[10px] text-muted uppercase font-bold tracking-wider">Abertura</p>
                        <p className="text-[10px] md:text-sm font-bold text-gray-700 whitespace-nowrap">{new Date(targetSession.openTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {new Date(targetSession.openTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>
                    </div>
                    {targetSession.closeTime && (
                        <div className="px-2 md:px-4 border-r border-gray-100 shrink-0">
                            <p className="text-[8px] md:text-[10px] text-muted uppercase font-bold tracking-wider">Fechamento</p>
                            <p className="text-[10px] md:text-sm font-bold text-gray-700 whitespace-nowrap">{new Date(targetSession.closeTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {new Date(targetSession.closeTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>
                        </div>
                    )}
                    <div className="px-2">
                        <p className="text-[8px] md:text-[10px] text-muted uppercase font-bold tracking-wider">Operador</p>
                        <div className="flex items-center gap-1.5 md:gap-2">
                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-success"></div>
                            <p className="text-[10px] md:text-sm font-bold text-gray-700 whitespace-nowrap truncate max-w-[100px] md:max-w-none">{users.find(u => u.id === targetSession.userId)?.name || 'Sistema'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-sm md:text-base font-bold text-gray-800 flex items-center gap-2">
                        <ShoppingCartIcon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                        Histórico de Vendas
                    </h3>
                    <span className="text-[10px] md:text-xs font-bold text-muted bg-white border border-gray-200 px-2 py-0.5 rounded-full">{sessionSales.length} {sessionSales.length === 1 ? 'venda' : 'vendas'}</span>
                </div>

                {/* Desktop View Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-black tracking-widest border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4">Hora</th>
                                <th className="px-6 py-4">Cliente</th>
                                <th className="px-6 py-4 text-right">Valor</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {sessionSales.map(sale => {
                                const hasPromissoria = (sale.payments || []).some(p => p.method?.toLowerCase().includes('promiss'));
                                return (
                                    <tr key={sale.id} className="hover:bg-gray-50/80 transition-colors">
                                        <td className="px-6 py-4 font-black text-primary">#{sale.id}</td>
                                        <td className="px-6 py-4 font-semibold text-gray-500">{new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="px-6 py-4 font-semibold text-gray-800 truncate max-w-[150px]">{customers.find(c => c.id === sale.customerId)?.name || 'Cliente'}</td>
                                        <td className="px-6 py-4 text-right font-bold text-success">{formatCurrency(sale.total)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex gap-1 justify-center items-center flex-wrap">
                                                {sale.status !== 'Cancelada' && <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-green-100 text-green-600">Finalizada</span>}
                                                {sale.status === 'Editada' && <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-purple-100 text-purple-600">Editada</span>}
                                                {hasPromissoria && <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-100 text-red-600">Promissória</span>}
                                                {sale.status === 'Cancelada' && <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-100 text-red-600">Cancelada</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => handleEditSale(sale)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><EditIcon className="h-4 w-4" /></button>
                                                <button onClick={() => handleViewClick(sale)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><EyeIcon className="h-4 w-4" /></button>
                                                <button onClick={() => handlePrintClick(sale)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><PrinterIcon className="h-4 w-4" /></button>
                                                {sale.status !== 'Cancelada' && (
                                                    <button onClick={() => confirm('Cancelar?') && cancelSale(sale.id, 'Cancelamento rápido').then(fetchData)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><TrashIcon className="h-4 w-4" /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View Cards */}
                <div className="md:hidden divide-y divide-gray-100">
                    {sessionSales.length === 0 ? (
                        <div className="p-8 text-center text-muted italic text-sm">Nenhuma venda realizada.</div>
                    ) : (
                        sessionSales.map(sale => {
                            const hasPromissoria = (sale.payments || []).some(p => p.method?.toLowerCase().includes('promiss'));
                            return (
                                <div key={sale.id} className="p-2 flex items-center justify-between gap-3 bg-white hover:bg-gray-50">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="font-bold text-primary text-[10px] whitespace-nowrap">#{sale.id}</span>
                                            <span className="text-[9px] text-gray-400 font-medium">{new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                            <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                                {sale.status !== 'Cancelada' && <span className="text-[7px] font-black px-1 rounded uppercase border bg-green-50 text-green-600 border-green-100 py-0.5 leading-none">FINALIZADA</span>}
                                                {sale.status === 'Editada' && <span className="text-[7px] font-black px-1 rounded uppercase border bg-purple-50 text-purple-600 border-purple-100 py-0.5 leading-none">EDITADA</span>}
                                                {hasPromissoria && <span className="text-[7px] font-black px-1 rounded uppercase border bg-red-50 text-red-600 border-red-100 py-0.5 leading-none text-center">PROMISSÓRIA</span>}
                                                {sale.status === 'Cancelada' && <span className="text-[7px] font-black px-1 rounded uppercase border bg-red-50 text-red-600 border-red-100 py-0.5 leading-none">CANCELADA</span>}
                                            </div>
                                        </div>
                                        <div className="font-bold text-gray-800 text-[10px] truncate uppercase leading-tight">
                                            {customers.find(c => c.id === sale.customerId)?.name || 'Cliente'}
                                        </div>
                                        <div className="text-[11px] font-black text-success mt-0.5">
                                            {formatCurrency(sale.total)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => handleViewClick(sale)} className="p-1.5 bg-gray-50 text-gray-500 rounded-lg border border-gray-100"><EyeIcon className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => handlePrintClick(sale)} className="p-1.5 bg-blue-50 text-blue-500 rounded-lg border border-blue-100"><PrinterIcon className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => handleEditSale(sale)} className="p-1.5 bg-gray-50 text-blue-500 rounded-lg border border-gray-100"><EditIcon className="h-3.5 w-3.5" /></button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Modal de Visualização de Movimentações (Manteve Original, mas densificado) */}
            {viewMovementsType && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
                    <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-scale-in">
                        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                            <h3 className="font-black text-gray-800 flex items-center gap-2 uppercase tracking-tight text-sm">
                                <CashIcon className={`h-5 w-5 ${viewMovementsType === 'sangria' ? 'text-red-500' : 'text-green-600'}`} />
                                {viewMovementsType === 'sangria' ? 'Sangrias' : 'Suprimentos'}
                            </h3>
                            <button onClick={() => setViewMovementsType(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><XCircleIcon className="h-6 w-6 text-gray-400" /></button>
                        </div>
                        <div className="max-h-[70vh] md:max-h-[60vh] overflow-y-auto">
                            <div className="divide-y divide-gray-100">
                                {(!targetSession.movements || targetSession.movements.filter(m => m.type === viewMovementsType).length === 0) ? (
                                    <div className="p-12 text-center text-muted italic text-sm">Nenhum registro.</div>
                                ) : (
                                    targetSession.movements
                                        .filter(m => m.type === viewMovementsType)
                                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                        .map(mov => (
                                            <div key={mov.id} className="p-4 flex justify-between items-start gap-3 hover:bg-gray-50">
                                                <div>
                                                    <div className="text-[10px] text-gray-400 font-bold uppercase">{new Date(mov.timestamp).toLocaleString('pt-BR')}</div>
                                                    <div className="text-xs font-bold text-gray-700 mt-0.5">{mov.reason}</div>
                                                    <div className="text-[10px] text-muted">Op: {users.find(u => u.id === mov.userId)?.name || 'Usuário'}</div>
                                                </div>
                                                <div className={`font-black text-base whitespace-nowrap ${viewMovementsType === 'sangria' ? 'text-red-500' : 'text-green-600'}`}>
                                                    {viewMovementsType === 'sangria' ? '-' : '+'} {formatCurrency(mov.amount)}
                                                </div>
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>
                        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total:</span>
                            <span className={`text-xl font-black ${viewMovementsType === 'sangria' ? 'text-red-500' : 'text-green-600'}`}>
                                {formatCurrency(viewMovementsType === 'sangria' ? (targetSession.withdrawals || 0) : (targetSession.deposits || 0))}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(ResumoCaixaView);
