import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '../contexts/UserContext.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import Button from '../components/Button.tsx';
import ConfirmationModal from '../components/ConfirmationModal.tsx';
import {
    PlusIcon, CheckIcon, SpinnerIcon, UserCircleIcon, EditIcon, TrashIcon, FilterIcon
} from '../components/icons.tsx';
import {
    getBancoHoras, addBancoHoras, updateBancoHoras, deleteBancoHoras,
    formatCurrency, getBancoHorasFuncionarios, payMultipleBancoHoras
} from '../services/mockApi.ts';
import { BancoHoras, BancoHorasFuncionario } from '../types.ts';
import { formatDateBR, getTodayDateString, formatTimeBR } from '../utils/dateUtils.ts';

import MoneyInput from '../components/MoneyInput.tsx';

// --- Funcionario Modal ---
// This component is removed as per instruction.

// --- Entry Edit Modal ---
const EntryEditModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    entry: BancoHoras | null;
    funcionarios: BancoHorasFuncionario[];
    onSave: (id: string, payload: Partial<BancoHoras>) => Promise<void>;
}> = ({ isOpen, onClose, entry, funcionarios, onSave }) => {
    const [dataTrabalho, setDataTrabalho] = useState('');
    const [tipo, setTipo] = useState<'HOURS' | 'MINUTES'>('HOURS');
    const [quantidade, setQuantidade] = useState<number>(0);
    const [observacao, setObservacao] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (entry) {
            setDataTrabalho(entry.data_trabalho);
            setTipo(entry.tipo);
            setQuantidade(entry.quantidade);
            setObservacao(entry.observacao || '');
        }
    }, [entry]);

    if (!isOpen || !entry) return null;

    const totalCalculado = (() => {
        const q = Number(quantidade) || 0;
        const v = entry.valor_hora || 0;
        return tipo === 'HOURS' ? q * v : (q / 60) * v;
    })();

    const handleSave = async () => {
        setSaving(true);
        await onSave(entry.id, {
            data_trabalho: dataTrabalho,
            tipo,
            quantidade: Number(quantidade),
            total: totalCalculado,
            observacao
        });
        setSaving(false);
    };

    const inputClasses = "w-full p-2 border rounded-xl bg-surface border-border focus:ring-1 focus:ring-success text-sm";
    const labelClasses = "block text-xs font-medium mb-1 text-gray-500 uppercase";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex justify-center items-center p-4">
            <div className="bg-surface p-6 rounded-3xl shadow-xl w-full max-w-md border border-border">
                <h2 className="text-xl font-bold mb-6 text-primary flex items-center gap-2">
                    <EditIcon className="w-6 h-6 text-blue-500" /> Editar Registro
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className={labelClasses}>Funcionário</label>
                        <div className="p-2 bg-gray-50 border border-border rounded-xl text-gray-600 font-medium">
                            {entry.funcionario_nome}
                        </div>
                    </div>

                    <div>
                        <label className={labelClasses}>Data *</label>
                        <input type="date" value={dataTrabalho} onChange={e => setDataTrabalho(e.target.value)} className={inputClasses} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClasses}>Tipo</label>
                            <select value={tipo} onChange={e => setTipo(e.target.value as any)} className={inputClasses}>
                                <option value="HOURS">Horas</option>
                                <option value="MINUTES">Minutos</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>Quantidade *</label>
                            <input type="number" step="any" value={quantidade} onChange={e => setQuantidade(Number(e.target.value))} className={inputClasses} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClasses}>Observações</label>
                        <input type="text" value={observacao} onChange={e => setObservacao(e.target.value)} className={inputClasses} />
                    </div>

                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
                        <span className="text-xs font-bold text-blue-700 uppercase">Novo Total</span>
                        <span className="text-lg font-black text-blue-800">{formatCurrency(totalCalculado)}</span>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                    <Button onClick={onClose} variant="secondary">Cancelar</Button>
                    <Button onClick={handleSave} variant="primary" loading={saving}>Salvar Alterações</Button>
                </div>
            </div>
        </div>
    );
};

const BancoHorasTab: React.FC = () => {
    const { permissions, user } = useUser();
    const { showToast } = useToast();

    const [bancoHoras, setBancoHoras] = useState<BancoHoras[]>([]);
    const [funcionarios, setFuncionarios] = useState<BancoHorasFuncionario[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [filterFuncionario, setFilterFuncionario] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    // Form
    const [selectedFuncId, setSelectedFuncId] = useState<string>('');
    const [dataTrabalho, setDataTrabalho] = useState<string>(getTodayDateString());
    const [tipo, setTipo] = useState<'HOURS' | 'MINUTES'>('HOURS');
    const [quantidade, setQuantidade] = useState<number>(0);
    const [observacao, setObservacao] = useState<string>('');
    const [saving, setSaving] = useState(false);

    // Modals
    const [payingItem, setPayingItem] = useState<BancoHoras | null>(null);
    const [payingMultipleFuncId, setPayingMultipleFuncId] = useState<string | null>(null);

    const [editingEntry, setEditingEntry] = useState<BancoHoras | null>(null);
    const [deletingEntry, setDeletingEntry] = useState<BancoHoras | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [bhData, fData] = await Promise.all([
                getBancoHoras(),
                getBancoHorasFuncionarios()
            ]);
            setBancoHoras(bhData);
            setFuncionarios(fData);
        } catch (error) {
            console.error(error);
            showToast('Erro ao carregar banco de horas', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const selectedFunc = useMemo(() =>
        funcionarios.find(f => f.id === selectedFuncId),
        [funcionarios, selectedFuncId]);

    const totalCalculado = useMemo(() => {
        const q = Number(quantidade) || 0;
        const v = selectedFunc?.valor_hora || 0;
        if (q <= 0 || v < 0) return 0;
        return tipo === 'HOURS' ? q * v : (q / 60) * v;
    }, [quantidade, selectedFunc, tipo]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const q = Number(quantidade);
        if (!selectedFuncId) return showToast('Selecione um funcionário', 'error');
        if (!dataTrabalho) return showToast('Selecione a data', 'error');
        if (q <= 0) return showToast('Quantidade deve ser maior que zero', 'error');
        if (!selectedFunc) return showToast('Funcionário não encontrado', 'error');

        if (!selectedFunc.valor_hora || selectedFunc.valor_hora <= 0) {
            return showToast(`O funcionário ${selectedFunc.name} não possui valor de hora configurado no cadastro.`, 'error');
        }

        setSaving(true);
        try {
            await addBancoHoras({
                funcionario_id: selectedFuncId,
                data_trabalho: dataTrabalho,
                tipo,
                quantidade: q,
                valor_hora: selectedFunc.valor_hora || 0,
                total: totalCalculado,
                observacao
            }, user?.id, user?.name);
            showToast('Registro adicionado com sucesso', 'success');

            setQuantidade(0);
            setObservacao('');
            fetchData();
        } catch (error) {
            console.error(error);
            showToast('Erro ao salvar registro', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handlePayMultiple = async () => {
        if (!payingMultipleFuncId || !user) return;
        const summary = employeeSummary.find(s => s.funcionario_id === payingMultipleFuncId);
        if (!summary) return;
        const ids = summary.items.map(i => i.id);
        try {
            await payMultipleBancoHoras(ids, user.id, user.name);
            showToast('Pagamentos registrados com sucesso!', 'success');
            setPayingMultipleFuncId(null);
            fetchData();
        } catch (error) {
            console.error(error);
            showToast('Erro ao registrar pagamentos', 'error');
        }
    };

    const handleUpdateEntry = async (id: string, payload: Partial<BancoHoras>) => {
        if (!user) return;
        try {
            await updateBancoHoras(id, payload, user.id, user.name || '');
            showToast('Registro atualizado!', 'success');
            setEditingEntry(null);
            fetchData();
        } catch (error) {
            console.error(error);
            showToast('Erro ao atualizar registro', 'error');
        }
    };

    const handleDeleteEntry = async () => {
        if (!deletingEntry || !user) return;
        try {
            await deleteBancoHoras(deletingEntry.id, user.id, user.name || '');
            showToast('Registro excluído!', 'success');
            setDeletingEntry(null);
            fetchData();
        } catch (error) {
            console.error(error);
            showToast('Erro ao excluir registro', 'error');
        }
    };

    const filteredList = useMemo(() => {
        return bancoHoras.filter(item => {
            if (filterFuncionario && item.funcionario_id !== filterFuncionario) return false;
            if (filterStatus && item.status !== filterStatus) return false;
            if (filterStartDate && item.data_trabalho < filterStartDate) return false;
            if (filterEndDate && item.data_trabalho > filterEndDate) return false;
            return true;
        });
    }, [bancoHoras, filterFuncionario, filterStatus, filterStartDate, filterEndDate]);

    const employeeSummary = useMemo(() => {
        const grouped = filteredList.filter(i => i.status === 'PENDING').reduce((acc, item) => {
            if (!acc[item.funcionario_id]) {
                acc[item.funcionario_id] = {
                    funcionario_id: item.funcionario_id,
                    funcionario_nome: item.funcionario_nome || 'Desconhecido',
                    totalQuantityH: 0,
                    totalQuantityM: 0,
                    totalValue: 0,
                    items: []
                };
            }
            if (item.tipo === 'HOURS') acc[item.funcionario_id].totalQuantityH += item.quantidade;
            if (item.tipo === 'MINUTES') acc[item.funcionario_id].totalQuantityM += item.quantidade;
            acc[item.funcionario_id].totalValue += item.total;
            acc[item.funcionario_id].items.push(item);
            return acc;
        }, {} as Record<string, any>);

        return Object.values(grouped).sort((a: any, b: any) => b.totalValue - a.totalValue);
    }, [filteredList]);

    const payingMultipleSummary = useMemo(() => {
        if (!payingMultipleFuncId) return null;
        return employeeSummary.find(s => s.funcionario_id === payingMultipleFuncId);
    }, [employeeSummary, payingMultipleFuncId]);

    const inputClasses = "w-full p-2 border rounded bg-transparent border-border focus:ring-success focus:border-success text-sm h-10";
    const labelClasses = "block text-sm font-medium text-primary mb-1";

    if (!permissions?.canManageBancoHoras && !permissions?.canViewBancoHoras && !permissions?.canCreateBancoHoras) {
        return <div className="p-8 text-center text-muted">Acesso negado.</div>;
    }

    return (
        <div className="space-y-6">
            {permissions?.canCreateBancoHoras && (
                <div className="bg-surface rounded-3xl border border-border p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
                        <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                            + Adicionar Hora Extra
                        </h3>
                    </div>
                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                        <div className="lg:col-span-2">
                            <label className={labelClasses}>Funcionário *</label>
                            <select value={selectedFuncId} onChange={e => setSelectedFuncId(e.target.value)} required className={inputClasses}>
                                <option value="">Selecione...</option>
                                {funcionarios.filter(f => f.active).map(f => (
                                    <option key={f.id} value={f.id}>{f.name} ({formatCurrency(f.valor_hora || 0)}/h)</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>Data *</label>
                            <input type="date" value={dataTrabalho} onChange={e => setDataTrabalho(e.target.value)} required className={inputClasses} />
                        </div>
                        <div>
                            <label className={labelClasses}>Tipo</label>
                            <select value={tipo} onChange={e => setTipo(e.target.value as any)} className={inputClasses}>
                                <option value="HOURS">Horas</option>
                                <option value="MINUTES">Minutos</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>Quantidade *</label>
                            <input type="number" step="any" min="0.1" value={quantidade} onChange={e => setQuantidade(e.target.value as any)} required className={inputClasses} placeholder="Ex: 2 ou 30" />
                        </div>

                        <div className="lg:col-span-3">
                            <label className={labelClasses}>Observações</label>
                            <input type="text" value={observacao} onChange={e => setObservacao(e.target.value)} className={inputClasses} placeholder="Opcional..." />
                        </div>
                        <div>
                            <label className={labelClasses}>Valor Total</label>
                            <div className={`flex items-center px-4 ${inputClasses} bg-green-50 text-green-700 font-bold border-green-100`}>
                                {formatCurrency(totalCalculado)}
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit" variant="success" loading={saving} icon={<CheckIcon className="w-5 h-5" />} className="w-full">
                                Salvar
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-surface rounded-3xl border border-border p-6 shadow-sm space-y-6">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-border pb-4">
                    <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                        <FilterIcon className="w-5 h-5 text-gray-400" /> Resumo do Período
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                        <select value={filterFuncionario} onChange={e => setFilterFuncionario(e.target.value)} className="p-2 border rounded-xl bg-transparent border-border text-sm min-w-[180px]">
                            <option value="">Filtrar Funcionário</option>
                            {funcionarios.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        <div className="flex items-center gap-2 bg-gray-50 p-1 px-2 rounded-xl border border-border">
                            <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="bg-transparent border-none text-sm focus:ring-0 p-1" title="Data Inicial" />
                            <span className="text-gray-300">|</span>
                            <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="bg-transparent border-none text-sm focus:ring-0 p-1" title="Data Final" />
                        </div>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="p-2 border rounded-xl bg-transparent border-border text-sm">
                            <option value="">Status: Todos</option>
                            <option value="PENDING">Pendentes</option>
                            <option value="PAID">Pagos</option>
                        </select>
                    </div>
                </div>

                {employeeSummary.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {employeeSummary.map(summary => (
                            <div key={summary.funcionario_id} className="p-5 rounded-3xl border border-gray-200 bg-gray-50/50 flex flex-col gap-4 hover:border-success/30 transition-all">
                                <div>
                                    <h4 className="font-black text-primary truncate text-base mb-1" title={summary.funcionario_nome}>{summary.funcionario_nome}</h4>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-green-700">{formatCurrency(summary.totalValue)}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 text-sm text-gray-600">
                                    <div className="flex justify-between">
                                        <span>Total Horas:</span>
                                        <span className="font-bold text-gray-900">
                                            {summary.totalQuantityH > 0 && <span>{summary.totalQuantityH}h </span>}
                                            {summary.totalQuantityM > 0 && <span>{summary.totalQuantityM}m</span>}
                                            {(summary.totalQuantityH === 0 && summary.totalQuantityM === 0) && '0h'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Registros:</span>
                                        <span className="bg-gray-200 px-2 rounded-full font-bold text-gray-700 text-xs">{summary.items.length}</span>
                                    </div>
                                </div>

                                {permissions?.canPayBancoHoras && (
                                    <Button
                                        variant="success"
                                        className="w-full h-11 shadow-sm"
                                        onClick={() => setPayingMultipleFuncId(summary.funcionario_id)}
                                        icon={<CheckIcon className="w-5 h-5" />}
                                    >
                                        Dar Baixa / Pagar
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-10 text-center border-2 border-dashed border-gray-100 rounded-3xl text-muted">
                        Selecione filtros acima para visualizar o resumo de pagamentos pendentes.
                    </div>
                )}
            </div>

            <div className="bg-surface rounded-3xl border border-border p-6 shadow-sm">
                <h3 className="font-bold text-lg text-primary mb-4">Histórico de Banco de Horas</h3>

                <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="p-4 font-bold">Data</th>
                                <th className="p-4 font-bold">Funcionário</th>
                                <th className="p-4 font-bold">Quantidade</th>
                                <th className="p-4 font-bold">Valor/Hora</th>
                                <th className="p-4 font-bold">Total</th>
                                <th className="p-4 font-bold text-center">Status</th>
                                <th className="p-4 font-bold text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading && <tr><td colSpan={7} className="p-8 text-center text-muted"><SpinnerIcon className="w-6 h-6 mx-auto animate-spin" /></td></tr>}
                            {!loading && filteredList.length === 0 && (
                                <tr><td colSpan={7} className="p-8 text-center text-muted flex flex-col items-center"><UserCircleIcon className="w-10 h-10 mb-2 opacity-50" /> Nenhum registro encontrado.</td></tr>
                            )}
                            {!loading && filteredList.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-medium text-gray-900">{formatDateBR(item.data_trabalho)}</div>
                                        {item.created_at && (
                                            <div className="text-[10px] text-gray-400 font-medium">
                                                Registrado às {formatTimeBR(item.created_at)}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900">{item.funcionario_nome || 'Desconhecido'}</div>
                                        {item.observacao && <div className="text-[10px] text-muted italic">{item.observacao}</div>}
                                    </td>
                                    <td className="p-4">{item.quantidade} {item.tipo === 'HOURS' ? 'h' : 'min'}</td>
                                    <td className="p-4 text-gray-500">{formatCurrency(item.valor_hora)}</td>
                                    <td className="p-4 font-black text-gray-900">{formatCurrency(item.total)}</td>
                                    <td className="p-4 text-center">
                                        <span className={`px-3 py-1 text-[10px] font-black rounded-full uppercase ${item.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700 border border-yellow-200'}`}>
                                            {item.status === 'PAID' ? 'PAGO' : 'PENDENTE'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {item.status === 'PENDING' && (
                                                <>
                                                    <button onClick={() => setEditingEntry(item)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setDeletingEntry(item)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                            {item.status === 'PAID' && (
                                                <div className="flex flex-col text-right">
                                                    <span className="text-[10px] font-bold text-gray-500">PAGO EM {formatDateBR(item.data_pagamento || '')}</span>
                                                    <span className="text-[9px] text-gray-400 uppercase">por {item.usuario_pagamento_nome || 'Sistema'}</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <EntryEditModal isOpen={!!editingEntry} onClose={() => setEditingEntry(null)} entry={editingEntry} funcionarios={funcionarios} onSave={handleUpdateEntry} />

            <ConfirmationModal
                isOpen={!!payingItem}
                onClose={() => setPayingItem(null)}
                onConfirm={handlePayMultiple} // Using multiple as it covers one too
                title="Confirmar Pagamento"
                message={`Tem certeza que deseja marcar este registro como PAGO?`}
                confirmText="Confirmar Pagamento"
                confirmVariant="success"
            />

            <ConfirmationModal
                isOpen={!!payingMultipleFuncId}
                onClose={() => setPayingMultipleFuncId(null)}
                onConfirm={handlePayMultiple}
                title="Confirmar Pagamento em Lote"
                message={`Tem certeza que deseja marcar TODOS os ${payingMultipleSummary?.items.length} registros pendentes filtrados de ${payingMultipleSummary?.funcionario_nome} (Total: ${formatCurrency(payingMultipleSummary?.totalValue || 0)}) como PAGOS? Esta ação não pode ser desfeita e fará baixa definitiva.`}
                confirmText="Confirmar Pagamento"
                confirmVariant="success"
            />

            <ConfirmationModal
                isOpen={!!deletingEntry}
                onClose={() => setDeletingEntry(null)}
                onConfirm={handleDeleteEntry}
                title="Excluir Registro de Banco de Horas"
                message={`Tem certeza que deseja excluir permanentemente este registro?`}
                confirmText="Excluir Registro"
                confirmVariant="danger"
            />
        </div>
    );
};

export default BancoHorasTab;
