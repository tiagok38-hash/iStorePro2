
import React from 'react';
import { CashSession } from '../../types.ts';
import { formatCurrency } from '../../services/mockApi.ts';
import { PlusIcon, EyeIcon, XCircleIcon, ArrowPathRoundedSquareIcon, SearchIcon } from '../icons.tsx';
import CustomDatePicker from '../CustomDatePicker.tsx';
import { toDateValue } from '../../utils/dateUtils.ts';

interface CaixasViewProps {
    sessions: CashSession[];
    userMap: Record<string, string>;
    onReopen: (s: CashSession) => void;
    onCloseSession: (s: CashSession) => void;
    onViewDetails: (s: CashSession) => void;
    startDate: string;
    setStartDate: (v: string) => void;
    endDate: string;
    setEndDate: (v: string) => void;
    userOptions: { value: string, label: string }[];
    userFilter: string | null;
    setUserFilter: (v: string | null) => void;
    currentUserOpenSession: CashSession | null;
    currentUserId?: string;
    onNewSession: () => void;
    searchTerm: string;
    setSearchTerm: (v: string) => void;
}

export const CaixasView: React.FC<CaixasViewProps> = ({
    sessions, userMap, onReopen, onCloseSession, onViewDetails,
    startDate, setStartDate, endDate, setEndDate,
    userOptions, userFilter, setUserFilter,
    currentUserOpenSession, currentUserId, onNewSession,
    searchTerm, setSearchTerm
}) => {
    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in pb-20 md:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight">Gerenciamento de Caixas</h2>
                {currentUserOpenSession && (
                    <button onClick={() => onViewDetails(currentUserOpenSession)} className="px-4 py-2 bg-success text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-success/20 hover:bg-success/90 transition-all text-[10px] md:text-xs uppercase">
                        <PlusIcon className="h-4 w-4 md:h-5 md:w-5" /> MEU CAIXA
                    </button>
                )}
            </div>

            <div className="glass-card p-3 md:p-5 flex flex-col md:flex-row items-end gap-3 md:gap-5">
                <div className="flex items-end gap-3 w-full md:w-auto">
                    <CustomDatePicker
                        label="Data Início"
                        value={startDate}
                        onChange={setStartDate}
                        max={toDateValue()}
                        className="w-full md:w-40"
                    />
                    <CustomDatePicker
                        label="Data Fim"
                        value={endDate}
                        onChange={setEndDate}
                        max={toDateValue()}
                        className="w-full md:w-40"
                    />
                </div>
                <div className="flex flex-col gap-1.5 w-full md:w-96">
                    <label className="text-[10px] font-black uppercase tracking-wider text-muted mb-1 block pl-1">Buscar</label>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <SearchIcon className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
                        </span>
                        <input
                            type="text"
                            placeholder="Operador, ID do caixa ou venda..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full p-2 pl-9 md:pl-10 border rounded-xl text-xs md:text-sm bg-white/50 border-white/30 focus:ring-2 focus:ring-success/20 outline-none backdrop-blur-sm shadow-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="glass-card overflow-hidden">
                {/* Desktop View Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50/50 text-gray-500 uppercase text-[10px] font-black tracking-widest border-b border-white/20">
                            <tr>
                                <th className="px-6 py-4">ID / Status</th>
                                <th className="px-6 py-4">Operador</th>
                                <th className="px-6 py-4 text-center">Datas (Abert. / Fech.)</th>
                                <th className="px-6 py-4 text-right">Abertura</th>
                                <th className="px-6 py-4 text-right">Vendas</th>
                                <th className="px-6 py-4 text-right">Dinheiro Gaveta</th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {sessions.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-12 text-center text-muted italic">Nenhum caixa encontrado.</td></tr>
                            ) : sessions.map(session => (
                                <tr key={session.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-primary">#{session.displayId}</span>
                                            <span className={`px-2 py-0.5 rounded-xl text-[9px] font-black uppercase border ${session.status === 'aberto' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>{session.status}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-semibold">{userMap[session.userId]}</td>
                                    <td className="px-6 py-4 text-[11px] text-center">
                                        <div className="font-medium text-gray-500">{new Date(session.openTime).toLocaleString('pt-BR')}</div>
                                        {session.closeTime && <div className="text-gray-400">{new Date(session.closeTime).toLocaleString('pt-BR')}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-right font-semibold">{formatCurrency(session.openingBalance)}</td>
                                    <td className="px-6 py-4 text-right font-bold text-success">{formatCurrency(session.transactionsValue)}</td>
                                    <td className="px-6 py-4 text-right font-black text-gray-900">{formatCurrency(session.cashInRegister)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => onViewDetails(session)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><EyeIcon className="h-4 w-4" /></button>
                                            {session.status === 'aberto' && <button onClick={() => onCloseSession(session)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><XCircleIcon className="h-4 w-4" /></button>}
                                            {session.status === 'fechado' && toDateValue(session.openTime) === toDateValue() && <button onClick={() => onReopen(session)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><ArrowPathRoundedSquareIcon className="h-4 w-4" /></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View Cards */}
                <div className="md:hidden divide-y divide-gray-100">
                    {sessions.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted italic">Nenhum caixa encontrado.</div>
                    ) : sessions.map(session => (
                        <div key={session.id} className="p-1.5 glass-panel bg-white/40 hover:bg-white/60 transition-colors border border-white/20 mb-2 rounded-xl shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-primary text-[10px]">#{session.displayId}</span>
                                    <span className={`px-1 py-0.5 rounded-xl text-[7px] font-black uppercase ${session.status === 'aberto' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{session.status}</span>
                                </div>
                                <div className="text-[9px] font-bold text-gray-800 uppercase tracking-tight">{userMap[session.userId]}</div>
                            </div>

                            <div className="grid grid-cols-3 gap-1 mb-1.5">
                                <div className="bg-gray-50 p-1 rounded-lg border border-gray-100">
                                    <div className="text-[6px] text-muted font-bold uppercase mb-0.5 leading-none">Abertura</div>
                                    <div className="text-[9px] font-bold text-gray-700">{formatCurrency(session.openingBalance)}</div>
                                </div>
                                <div className="bg-success/5 p-1 rounded-lg border border-success/10">
                                    <div className="text-[6px] text-success font-bold uppercase mb-0.5 leading-none">Vendas</div>
                                    <div className="text-[9px] font-bold text-success">{formatCurrency(session.transactionsValue)}</div>
                                </div>
                                <div className="bg-primary/5 p-1 rounded-lg border border-primary/10">
                                    <div className="text-[6px] text-primary font-bold uppercase mb-0.5 leading-none">Dinheiro Gaveta</div>
                                    <div className="text-[9px] font-black text-primary">{formatCurrency(session.cashInRegister)}</div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <div className="text-[8px] text-gray-400 font-medium truncate flex flex-wrap gap-x-2">
                                    <span>Aberto: {new Date(session.openTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {new Date(session.openTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                    {session.closeTime && (
                                        <span className="text-gray-500 font-bold">| Fechado: {new Date(session.closeTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => onViewDetails(session)} className="p-1 px-2 bg-gray-50 text-gray-500 rounded-xl border border-gray-100 transition-colors"><EyeIcon className="h-3.5 w-3.5" /></button>
                                    {session.status === 'aberto' && <button onClick={() => onCloseSession(session)} className="p-1 px-2 bg-red-50 text-red-600 rounded-xl border border-red-100 transition-colors"><XCircleIcon className="h-3.5 w-3.5" /></button>}
                                    {session.status === 'fechado' && toDateValue(session.openTime) === toDateValue() && <button onClick={() => onReopen(session)} className="p-1 px-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 transition-colors"><ArrowPathRoundedSquareIcon className="h-3.5 w-3.5" /></button>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default React.memo(CaixasView);
