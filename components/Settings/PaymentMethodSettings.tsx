import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';
import { PaymentMethodParameter } from '../../types';
import { getPaymentMethods, addPaymentMethod, updatePaymentMethod, deletePaymentMethod } from '../../services/mockApi';
import Button from '../Button';
import { PlusIcon, EditIcon, TrashIcon } from '../icons';
import PaymentMethodModal from '../PaymentMethodModal';
import ConfirmationModal from '../ConfirmationModal';

const PaymentMethodSettings: React.FC = () => {
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethodParameter[]>([]);
    const [editingMethod, setEditingMethod] = useState<Partial<PaymentMethodParameter> | null>(null);
    const [deletingMethod, setDeletingMethod] = useState<PaymentMethodParameter | null>(null);
    const { showToast } = useToast();
    const { permissions, user } = useUser();

    const fetchData = useCallback(async () => { setPaymentMethods(await getPaymentMethods()); }, []);
    useEffect(() => { fetchData(); }, [fetchData]);

    const handleOpenEdit = (method: PaymentMethodParameter) => { setEditingMethod(method); };

    const [saving, setSaving] = useState(false);

    const handleSave = async (item: Partial<PaymentMethodParameter>) => {
        setSaving(true);
        try {
            if (item.id) {
                await updatePaymentMethod(item as PaymentMethodParameter, user?.id, user?.name);
                showToast('Atualizado!', 'success');
            } else {
                await addPaymentMethod(item as Omit<PaymentMethodParameter, 'id'>, user?.id, user?.name);
                showToast('Adicionado!', 'success');
            }
            fetchData();
            setEditingMethod(null);
        } catch (e) {
            showToast('Erro ao salvar.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingMethod) return;
        try {
            await deletePaymentMethod(deletingMethod.id, user?.id, user?.name);
            showToast('Excluído!', 'success');
            fetchData();
            setDeletingMethod(null);
        } catch (e) {
            showToast('Erro ao excluir.', 'error');
        }
    };

    return (
        <div className="bg-surface rounded-3xl border border-border p-4 md:p-6 space-y-4 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h4 className="text-lg md:text-xl font-bold text-primary">Meios de Pagamentos</h4>
                </div>
                {permissions?.canManagePaymentMethods && (
                    <Button
                        onClick={() => setEditingMethod({ active: true, type: 'cash' })}
                        icon={<PlusIcon className="h-4 w-4" />}
                        className="bg-gray-900"
                    >
                        Cadastrar
                    </Button>
                )}
            </div>

            {/* Mobile View: Cards */}
            <div className="block md:hidden space-y-3">
                {paymentMethods.map(method => (
                    <div key={method.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <h5 className="font-semibold text-gray-900">{method.name}</h5>
                                <span className="text-xs text-gray-500">{method.type === 'card' ? 'Cartão' : 'Geral'}</span>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${method.active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {method.active !== false ? 'ativo' : 'inativo'}
                            </span>
                        </div>

                        {permissions?.canManagePaymentMethods && (
                            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 mt-1">
                                <button onClick={() => handleOpenEdit(method)} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary px-2 py-1 rounded active:bg-gray-100">
                                    <EditIcon className="h-4 w-4" /> Editar
                                </button>
                                <button onClick={() => setDeletingMethod(method)} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-danger px-2 py-1 rounded active:bg-gray-100">
                                    <TrashIcon className="h-4 w-4" /> Excluir
                                </button>
                            </div>
                        )}
                    </div>
                ))}
                {paymentMethods.length === 0 && (
                    <div className="p-8 text-center text-muted border border-dashed rounded-xl bg-gray-50">Nenhum meio de pagamento cadastrado.</div>
                )}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                        <tr>
                            <th className="px-6 py-3 border-b border-gray-200 w-full">Nome</th>
                            <th className="px-6 py-3 border-b border-gray-200">Tipo</th>
                            <th className="px-6 py-3 border-b border-gray-200">Status</th>
                            {permissions?.canManagePaymentMethods && <th className="px-6 py-3 border-b border-gray-200 text-right">Ações</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {paymentMethods.map(method => (
                            <tr key={method.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{method.name}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {method.type === 'card' ? 'Cartão' : 'Geral'}
                                </td>
                                <td className="px-6 py-4 text-sm">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${method.active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {method.active !== false ? 'ativo' : 'inativo'}
                                    </span>
                                </td>
                                {permissions?.canManagePaymentMethods && (
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button onClick={() => handleOpenEdit(method)} className="p-1.5 text-gray-500 border border-gray-300 rounded hover:bg-gray-50 hover:text-primary transition-colors" title="Editar">
                                            <EditIcon className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => setDeletingMethod(method)} className="p-1.5 text-gray-500 border border-gray-300 rounded hover:bg-gray-50 hover:text-danger transition-colors" title="Excluir">
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {paymentMethods.length === 0 && (
                    <div className="p-8 text-center text-muted">Nenhum meio de pagamento cadastrado.</div>
                )}
            </div>

            {editingMethod && <PaymentMethodModal item={editingMethod} onClose={() => setEditingMethod(null)} onSave={handleSave} isSaving={saving} />}
            <ConfirmationModal isOpen={!!deletingMethod} onClose={() => setDeletingMethod(null)} onConfirm={handleDelete} title="Excluir" message={`Deseja excluir "${deletingMethod?.name}"?`} />
        </div>
    );
};

export default PaymentMethodSettings;
