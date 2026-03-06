import React, { useState, useEffect } from 'react';
import { FinancialStatus } from '../types.ts';
import { getOsPurchaseOrders, cancelOsPurchaseOrder, updateOsPurchaseFinancialStatus, OsPurchaseOrder } from '../services/mockApi.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { formatCurrency } from '../services/mockApi.ts';
import { formatDateBR } from '../utils/dateUtils.ts';
import { CloseIcon, EditIcon, SuccessIcon, XCircleIcon, EyeIcon } from '../components/icons.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import DeleteWithReasonModal from './DeleteWithReasonModal.tsx';

interface OsPurchaseHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onEditPurchase?: (purchase: OsPurchaseOrder) => void;
    onViewPurchase?: (purchase: OsPurchaseOrder) => void;
}

const OsPurchaseHistoryModal: React.FC<OsPurchaseHistoryModalProps> = ({ isOpen, onClose, onEditPurchase, onViewPurchase }) => {
    const [purchases, setPurchases] = useState<OsPurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    const [purchaseToCancel, setPurchaseToCancel] = useState<OsPurchaseOrder | null>(null);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchPurchases();
        }
    }, [isOpen]);

    const fetchPurchases = async () => {
        setLoading(true);
        try {
            const data = await getOsPurchaseOrders();
            setPurchases(data);
        } catch (error) {
            showToast('Erro ao carregar histórico de compras.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsPaid = async (purchase: OsPurchaseOrder) => {
        try {
            await updateOsPurchaseFinancialStatus(purchase.id, 'Pago');
            showToast('Compra marcada como Paga.', 'success');
            fetchPurchases();
        } catch (error) {
            showToast('Erro ao atualizar status.', 'error');
        }
    };

    const handleConfirmCancel = async (reason: string) => {
        if (!purchaseToCancel) return;
        try {
            await cancelOsPurchaseOrder(purchaseToCancel.id, reason);
            showToast('Compra cancelada com sucesso.', 'success');
            setIsCancelModalOpen(false);
            setPurchaseToCancel(null);
            fetchPurchases();
        } catch (error: any) {
            showToast(error.message || 'Erro ao cancelar.', 'error');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Cabeçalho */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0 bg-gray-50/50 rounded-t-3xl">
                    <h2 className="text-xl md:text-2xl font-black text-gray-900 flex items-center gap-3">
                        <span className="p-2.5 bg-gray-900 rounded-xl text-white">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </span>
                        Histórico de Compras de Peças/Insumos (OS)
                    </h2>
                    <button onClick={onClose} className="p-2.5 hover:bg-white rounded-2xl hover:shadow-sm text-gray-400 hover:text-gray-900 transition-all focus:outline-none">
                        <CloseIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Conteúdo */}
                <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                    {loading ? (
                        <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>
                    ) : purchases.length === 0 ? (
                        <div className="text-center p-8 text-gray-500">Nenhuma compra encontrada.</div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Data/Hora</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">OS/ID</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Fornecedor</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-center">Itens</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">Total</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-center">Financeiro</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-center">Status</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {purchases.map(p => {
                                        const dateLabel = formatDateBR(p.createdAt);
                                        const hasPendingFinancial = p.financialStatus === 'Pendente';
                                        return (
                                            <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="p-4 font-medium text-sm text-gray-900 whitespace-nowrap">
                                                    {dateLabel} <br /><span className="text-xs text-gray-400 font-normal">por {p.createdByName}</span>
                                                </td>
                                                <td className="p-4 text-sm font-semibold text-gray-600">
                                                    #{p.displayId}
                                                </td>
                                                <td className="p-4 text-sm text-gray-800">
                                                    {p.supplierName}
                                                </td>
                                                <td className="p-4 text-sm text-gray-600 text-center font-medium">
                                                    {p.items.reduce((acc, i) => acc + i.quantity, 0)} un.
                                                </td>
                                                <td className="p-4 text-sm font-bold text-gray-900 text-right">
                                                    {formatCurrency(p.total)}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-1 text-xs font-bold rounded-xl ${p.financialStatus === 'Pago' ? 'bg-green-100 text-green-700' :
                                                        p.financialStatus === 'A Prazo' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-orange-100 text-orange-700'
                                                        }`}>
                                                        {p.financialStatus}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-1 text-xs font-bold rounded-xl ${p.status === 'Cancelado' ? 'bg-red-100 text-red-700' :
                                                        p.status === 'Finalizada' ? 'bg-gray-200 text-gray-700' :
                                                            'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {p.status !== 'Cancelado' && hasPendingFinancial && (
                                                            <button
                                                                onClick={() => handleMarkAsPaid(p)}
                                                                title="Marcar como Pago"
                                                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                                                            >
                                                                <SuccessIcon className="h-5 w-5" />
                                                            </button>
                                                        )}
                                                        {p.status !== 'Cancelado' && onViewPurchase && (
                                                            <button
                                                                onClick={() => {
                                                                    onViewPurchase(p);
                                                                    onClose();
                                                                }}
                                                                title="Visualizar Compra"
                                                                className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded"
                                                            >
                                                                <EyeIcon className="h-5 w-5" />
                                                            </button>
                                                        )}
                                                        {p.status !== 'Cancelado' && onEditPurchase && (
                                                            <button
                                                                onClick={() => {
                                                                    onEditPurchase(p);
                                                                    onClose();
                                                                }}
                                                                title="Editar Compra"
                                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                            >
                                                                <EditIcon className="h-5 w-5" />
                                                            </button>
                                                        )}
                                                        {p.status !== 'Cancelado' && (
                                                            <button
                                                                onClick={() => {
                                                                    setPurchaseToCancel(p);
                                                                    setIsCancelModalOpen(true);
                                                                }}
                                                                title="Cancelar Compra"
                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                            >
                                                                <XCircleIcon className="h-5 w-5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <DeleteWithReasonModal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                onConfirm={handleConfirmCancel}
                title="Cancelar Compra de OS"
                message={`Tem certeza que deseja cancelar a compra de OS #${purchaseToCancel?.displayId}?`}
            />
        </div>
    );
};

export default OsPurchaseHistoryModal;
