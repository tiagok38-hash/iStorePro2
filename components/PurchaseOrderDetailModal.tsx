import React from 'react';
import { createPortal } from 'react-dom';
import { PurchaseOrder, PurchaseItem, Product } from '../types.ts';
import { XCircleIcon } from './icons.tsx';
import { formatCurrency } from '../services/mockApi.ts';

const formatDateTime = (dateString: string) => new Date(dateString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const PendingItemsTable: React.FC<{ items: PurchaseItem[] }> = ({ items }) => (
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
            {items.map(item => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="px-3 py-1.5 max-w-xs">
                        <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-gray-900 leading-tight">
                                {(() => {
                                    const model = item.productDetails.model || '';
                                    const brand = item.productDetails.brand || '';
                                    const color = item.productDetails.color || '';

                                    const normModel = model.toLowerCase().replace(/[^a-z0-9]/g, '');
                                    const normBrand = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
                                    const normColor = color.toLowerCase().replace(/[^a-z0-9]/g, '');

                                    const showBrand = brand && !normModel.includes(normBrand) && brand.toLowerCase() !== 'apple';
                                    const showColor = color && !normModel.includes(normColor);

                                    return (
                                        <>
                                            {showBrand ? `${brand} ` : ''}
                                            {model}
                                            {showColor ? ` • ${color}` : ''}
                                        </>
                                    );
                                })()}
                            </span>
                            <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                                <span className="bg-gray-100 px-1.5 rounded-xl">{item.productDetails.condition}</span>
                                <span>{item.productDetails.warranty}</span>
                                {item.productDetails.storageLocation && <span className="text-accent">| {item.productDetails.storageLocation}</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px] text-gray-400 mt-0.5 font-medium">
                                {item.productDetails.imei1 && <span>IMEI: {item.productDetails.imei1}</span>}
                                {item.productDetails.serialNumber && <span>SN: {item.productDetails.serialNumber}</span>}
                                {item.barcodes && item.barcodes.length > 0 && <span className="font-mono text-success">EAN: {item.barcodes[0]}</span>}
                                {item.productDetails.brand === 'Apple' && item.productDetails.condition !== 'Novo' && item.productDetails.batteryHealth !== undefined && item.productDetails.batteryHealth > 0 && <span>BAT: {item.productDetails.batteryHealth}%</span>}
                            </div>
                        </div>
                    </td>
                    <td className="px-2 py-1.5 text-center font-bold text-gray-600">{item.quantity}</td>
                    <td className="px-2 py-1.5 text-right text-gray-500">{formatCurrency(item.finalUnitCost)}</td>
                    <td className="px-3 py-1.5 text-right font-black text-primary">{formatCurrency(item.finalUnitCost * item.quantity)}</td>
                </tr>
            ))}
        </tbody>
    </table>
);

const LaunchedProductsTable: React.FC<{ products: Product[] }> = ({ products }) => (
    <>
        <table className="w-full text-[11px] md:text-sm">
            <thead className="text-left text-[10px] text-muted bg-gray-50 uppercase font-black tracking-widest">
                <tr>
                    <th className="px-3 py-1.5">Descrição</th>
                    <th className="px-2 py-1.5 text-center">Qtd</th>
                    <th className="px-2 py-1.5 text-right">Custo Un.</th>
                    <th className="px-2 py-1.5 text-right">Adic.</th>
                    <th className="px-2 py-1.5 text-right">Total Un.</th>
                    <th className="px-2 py-1.5 text-right">Atacado</th>
                    <th className="px-3 py-1.5 text-right">Venda</th>
                </tr>
            </thead>
            <tbody>
                {products.map(product => {
                    const finalUnitCost = (product.costPrice || 0) + (product.additionalCostPrice || 0);
                    const variationsText = product.variations?.map(v => `${v.valueName}`).join(', ');

                    return (
                        <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                            <td className="px-3 py-1.5 align-top max-w-sm">
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-bold text-gray-900 leading-tight">
                                        {(() => {
                                            const model = product.model || '';
                                            const brand = product.brand || '';
                                            const color = product.color || '';

                                            const normModel = model.toLowerCase().replace(/[^a-z0-9]/g, '');
                                            const normBrand = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
                                            const normColor = color.toLowerCase().replace(/[^a-z0-9]/g, '');

                                            const showBrand = brand && !normModel.includes(normBrand) && brand.toLowerCase() !== 'apple';
                                            const showColor = color && !normModel.includes(normColor);

                                            return (
                                                <>
                                                    {showBrand ? `${brand} ` : ''}
                                                    {model}
                                                    {showColor ? ` • ${color}` : ''}
                                                </>
                                            );
                                        })()}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-x-2 text-[9px] text-gray-500 font-bold uppercase tracking-tighter">
                                        <span className="bg-gray-100 px-1.5 rounded-xl">{product.condition}</span>
                                        <span>{product.warranty}</span>
                                        <span className="text-accent underline decoration-accent/30">{product.storageLocation || 'S/L'}</span>
                                        {variationsText && <span className="bg-blue-100 text-blue-700 px-1 rounded-xl">{variationsText}</span>}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0 text-[10px] text-gray-400 mt-0.5 font-medium font-mono">
                                        {product.imei1 && <span>IMEI: {product.imei1}</span>}
                                        {product.serialNumber && <span>SN: {product.serialNumber}</span>}
                                        {product.barcodes && product.barcodes.length > 0 && <span className="text-success">EAN: {product.barcodes[0]}</span>}
                                        {product.brand === 'Apple' && product.condition !== 'Novo' && product.batteryHealth > 0 && <span className="text-success font-black">{product.batteryHealth}%</span>}
                                    </div>
                                </div>
                            </td>
                            <td className="px-2 py-1.5 text-center align-top font-bold text-gray-400">1</td>
                            <td className="px-2 py-1.5 text-right align-top text-gray-500">{formatCurrency(product.costPrice)}</td>
                            <td className="px-2 py-1.5 text-right align-top text-gray-400">{formatCurrency(product.additionalCostPrice)}</td>
                            <td className="px-2 py-1.5 text-right font-black text-gray-700 align-top">{formatCurrency(finalUnitCost)}</td>
                            <td className="px-2 py-1.5 text-right align-top font-bold text-orange-500">{product.wholesalePrice ? formatCurrency(product.wholesalePrice) : '-'}</td>
                            <td className="px-3 py-1.5 text-right font-black text-primary align-top">{formatCurrency(product.price)}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </>
);


const PurchaseOrderDetailModal: React.FC<{ purchase: PurchaseOrder; onClose: () => void; associatedProducts?: Product[] }> = ({ purchase, onClose, associatedProducts = [] }) => {
    const totalItems = (purchase.stockStatus === 'Lançado' || purchase.stockStatus === 'Parcialmente Lançado') && associatedProducts.length > 0
        ? associatedProducts.length
        : purchase.items.reduce((sum, item) => sum + item.quantity, 0);

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
                            <h2 className="text-xl font-black text-primary tracking-tight leading-none">Detalhes da Compra</h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1.5">
                                Fornecedor: <span className="text-gray-900">{purchase.supplierName}</span> • TK em {formatDateTime(purchase.createdAt)}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all active:scale-95 group">
                        <XCircleIcon className="h-6 w-6 group-hover:scale-110 transition-transform" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {(purchase.stockStatus === 'Lançado' || purchase.stockStatus === 'Parcialmente Lançado') && associatedProducts.length > 0 ? (
                        <LaunchedProductsTable products={associatedProducts} />
                    ) : (
                        purchase.items.length > 0 ? (
                            <PendingItemsTable items={purchase.items} />
                        ) : (
                            <div className="text-center text-muted py-8">Nenhum item nesta compra.</div>
                        )
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
                        <p className="font-bold text-gray-600">{formatCurrency(purchase.total - purchase.additionalCost)}</p>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Custo Adicional</p>
                        <p className="font-bold text-gray-600">{formatCurrency(purchase.additionalCost)}</p>
                    </div>
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

export default PurchaseOrderDetailModal;