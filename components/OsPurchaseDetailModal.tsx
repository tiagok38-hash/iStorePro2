/**
 * OsPurchaseDetailModal — Modal de detalhes de compra de peças/insumos de OS.
 * Segue o padrão visual do PurchaseOrderDetailModal do ERP principal.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { XCircleIcon } from './icons.tsx';
import { formatCurrency, OsPurchaseOrder } from '../services/mockApi.ts';
import { cleanUUIDs } from '../utils/formatters.ts';

const formatDateTime = (dateString: string) =>
    new Date(dateString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

interface Props {
    purchase: OsPurchaseOrder;
    brands?: { id: string, name: string }[];
    categories?: { id: string, name: string }[];
    onClose: () => void;
}

const OsPurchaseDetailModal: React.FC<Props> = ({ purchase, brands = [], categories = [], onClose }) => {
    const totalItems = purchase.items.reduce((sum, item: any) => sum + (item.quantity || 1), 0);
    
    const getBrandName = (idOrName: string) => {
        if (!idOrName) return '';
        const brand = brands.find(b => String(b.id) === String(idOrName));
        return brand ? brand.name : idOrName;
    };

    const getCategoryName = (idOrName: string) => {
        if (!idOrName) return '';
        const category = categories.find(c => String(c.id) === String(idOrName));
        return category ? category.name : idOrName;
    };

    React.useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    return createPortal(
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[9999] p-4">
            <div className="bg-surface rounded-3xl shadow-2xl p-4 md:p-8 w-full max-w-5xl max-h-[95vh] flex flex-col animate-scale-in border border-gray-100 overflow-hidden">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-gray-900 text-white p-3 rounded-2xl transform -rotate-3 shadow-lg">
                            <span className="text-xl font-black">#{purchase.displayId}</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-primary tracking-tight leading-none">Detalhes da Compra (OS)</h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1.5">
                                Fornecedor: <span className="text-gray-900">{purchase.supplierName || 'Não informado'}</span> • Registrado em {formatDateTime(purchase.createdAt)}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all active:scale-95 group">
                        <XCircleIcon className="h-6 w-6 group-hover:scale-110 transition-transform" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {purchase.items.length > 0 ? (
                        <table className="w-full text-[11px] md:text-sm">
                            <thead className="text-left text-muted bg-gray-50 uppercase text-[10px] font-black tracking-widest">
                                <tr>
                                    <th className="px-3 py-1.5">Item / Descrição</th>
                                    <th className="px-2 py-1.5 text-center">Qtd</th>
                                    <th className="px-2 py-1.5 text-right">Custo Un.</th>
                                    <th className="px-3 py-1.5 text-right">Custo Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purchase.items.map((item: any) => (
                                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                                        <td className="px-3 py-1.5 max-w-xs">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-bold text-gray-900 leading-tight">
                                                    {cleanUUIDs(item.partName || item.description || 'Sem nome')}
                                                </span>
                                                <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                                                    {item.brand && <span className="bg-gray-100 px-1.5 rounded-xl">{getBrandName(item.brand)}</span>}
                                                    {item.category && <span>{getCategoryName(item.category)}</span>}
                                                    {item.condition && <span className="bg-gray-100 px-1.5 rounded-xl">{item.condition}</span>}
                                                    {item.warranty && <span>{item.warranty}</span>}
                                                    {item.storageLocation && <span className="text-emerald-600 bg-emerald-50 px-1.5 rounded-xl">📍 {item.storageLocation}</span>}
                                                    {item.model && <span className="text-accent">| {cleanUUIDs(item.model)}</span>}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px] text-gray-400 mt-0.5 font-medium">
                                                    {item.barcode && <span className="font-mono text-success">EAN: {item.barcode}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-1.5 text-center font-bold text-gray-600">{item.quantity || 1}</td>
                                        <td className="px-2 py-1.5 text-right text-gray-500">{formatCurrency(item.finalUnitCost || item.unitCost || 0)}</td>
                                        <td className="px-3 py-1.5 text-right font-black text-primary">{formatCurrency((item.finalUnitCost || item.unitCost || 0) * (item.quantity || 1))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center text-muted py-8">Nenhum item nesta compra.</div>
                    )}

                    {purchase.observations && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Observações</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{purchase.observations}</p>
                        </div>
                    )}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-50 flex flex-wrap justify-end items-center gap-6 md:gap-10 text-right shrink-0">
                    <div className="flex flex-col gap-0.5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total de Itens</p>
                        <p className="font-bold text-gray-600">{totalItems}</p>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Subtotal</p>
                        <p className="font-bold text-gray-600">{formatCurrency(purchase.total - (purchase.additionalCost || 0))}</p>
                    </div>
                    {purchase.additionalCost > 0 && (
                        <div className="flex flex-col gap-0.5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Custo Adicional</p>
                            <p className="font-bold text-gray-600">{formatCurrency(purchase.additionalCost)}</p>
                        </div>
                    )}
                    <div className="flex flex-col gap-0.5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Geral</p>
                        <p className="font-black text-2xl text-primary tracking-tight">{formatCurrency(purchase.total)}</p>
                    </div>
                </div>

                <div className="flex justify-end mt-8 shrink-0">
                    <button onClick={onClose} className="w-full md:w-auto px-10 py-3 bg-gray-900 text-white rounded-2xl font-black hover:bg-black transition-all active:scale-95 shadow-xl shadow-gray-200">
                        Fechar Visualização
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default OsPurchaseDetailModal;
