import React, { useEffect, useState } from 'react';
import { Sale } from '../../types.ts';
import { getSale } from '../../services/financialService.ts';
import { formatCurrency } from '../../services/mockApi.ts';

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
});
const TIME_FMT = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit', minute: '2-digit',
});

function fmtDateTime(isoStr?: string | null): string {
    if (!isoStr) return '—';
    try {
        const d = new Date(isoStr);
        return `${DATE_FMT.format(d)} às ${TIME_FMT.format(d)}`;
    } catch { return isoStr; }
}

const StatusBadge = ({ status }: { status: Sale['status'] }) => {
    const cfg: Record<string, string> = {
        Finalizada: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        Pendente: 'bg-amber-100 text-amber-700 border-amber-200',
        Cancelada: 'bg-red-100 text-red-700 border-red-200',
        Editada: 'bg-blue-100 text-blue-700 border-blue-200',
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${cfg[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            {status}
        </span>
    );
};

const InfoCard: React.FC<{ label: string; value?: string; children?: React.ReactNode }> = ({ label, value, children }) => (
    <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
        {children ?? <p className="text-sm font-bold text-gray-800 truncate" title={value}>{value}</p>}
    </div>
);

interface Props {
    saleId: string | null;
    saleDisplayId?: string | number | null;
    onClose: () => void;
}

const SaleViewModal: React.FC<Props> = ({ saleId, saleDisplayId, onClose }) => {
    const [sale, setSale] = useState<Sale | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!saleId) { setLoading(false); return; }
        setLoading(true);
        setError(null);
        getSale(saleId)
            .then(data => {
                if (!data) setError('Venda não encontrada ou sem dados.');
                else setSale(data);
            })
            .catch(() => setError('Erro ao carregar venda.'))
            .finally(() => setLoading(false));
    }, [saleId]);

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={handleOverlayClick}
        >
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-violet-50 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <path d="M16 10a4 4 0 0 1-8 0" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Venda Original do Crediário</p>
                            <h2 className="text-base font-black text-gray-900 tracking-tight">
                                {saleDisplayId ? `Venda #${saleDisplayId}` : 'Detalhes da Compra'}
                            </h2>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-6 space-y-5">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                            <p className="text-sm font-bold text-gray-400">Carregando dados da venda...</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
                                    fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                            </div>
                            <p className="text-sm font-bold text-red-500">{error}</p>
                        </div>
                    )}

                    {!loading && !error && sale && (
                        <>
                            {/* Info grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <InfoCard label="Data / Hora" value={fmtDateTime(sale.date)} />
                                <InfoCard label="Status"><StatusBadge status={sale.status} /></InfoCard>
                                <InfoCard label="Cliente" value={sale.customerName || '—'} />
                                <InfoCard label="Vendedor" value={sale.salespersonName || '—'} />
                                <InfoCard label="Terminal" value={sale.posTerminal || '—'} />
                                <InfoCard label="Origem" value={sale.origin || '—'} />
                            </div>

                            {/* Itens */}
                            {sale.items && sale.items.length > 0 && (
                                <section>
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <span className="w-1.5 h-4 bg-indigo-500 rounded-full inline-block" />
                                        Itens da Venda ({sale.items.length})
                                    </h3>
                                    <div className="rounded-2xl border border-gray-100 overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-50">
                                                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-gray-400 uppercase tracking-wider">Produto</th>
                                                    <th className="px-4 py-2.5 text-center text-[10px] font-black text-gray-400 uppercase tracking-wider">Qtd</th>
                                                    <th className="px-4 py-2.5 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">Unit.</th>
                                                    <th className="px-4 py-2.5 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {sale.items.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50/50">
                                                        <td className="px-4 py-3">
                                                            <p className="font-bold text-gray-800 leading-tight">
                                                                {item.productName || item.model || 'Produto sem nome'}
                                                            </p>
                                                            {item.imei1 && (
                                                                <p className="text-[10px] text-indigo-500 font-bold mt-0.5">IMEI1: {item.imei1}</p>
                                                            )}
                                                            {item.imei2 && (
                                                                <p className="text-[10px] text-indigo-400 font-bold">IMEI2: {item.imei2}</p>
                                                            )}
                                                            {item.serialNumber && (
                                                                <p className="text-[10px] text-gray-400 font-medium">S/N: {item.serialNumber}</p>
                                                            )}
                                                            {(item.color || item.storage) && (
                                                                <p className="text-[10px] text-gray-400 font-medium">
                                                                    {[item.color, item.storage].filter(Boolean).join(' · ')}
                                                                </p>
                                                            )}
                                                            {item.condition && (
                                                                <span className="inline-block text-[9px] font-black bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full mt-0.5">
                                                                    {item.condition}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-center font-bold text-gray-700">{item.quantity}</td>
                                                        <td className="px-4 py-3 text-right font-bold text-gray-700">{formatCurrency(item.unitPrice)}</td>
                                                        <td className="px-4 py-3 text-right font-black text-gray-900">{formatCurrency(item.netTotal)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            )}

                            {/* Pagamentos */}
                            {sale.payments && sale.payments.length > 0 && (
                                <section>
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <span className="w-1.5 h-4 bg-violet-500 rounded-full inline-block" />
                                        Formas de Pagamento
                                    </h3>
                                    <div className="space-y-2">
                                        {sale.payments.map((pay, idx) => (
                                            <div key={idx} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
                                                    <span className="text-sm font-bold text-gray-700">{pay.method}</span>
                                                    {pay.installments && pay.installments > 1 && (
                                                        <span className="text-[10px] font-black bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">
                                                            {pay.installments}x de {formatCurrency((pay.installmentsValue ?? pay.value / pay.installments))}
                                                        </span>
                                                    )}
                                                    {pay.method === 'Crediário' && pay.creditDetails && (
                                                        <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                                                            {pay.creditDetails.installments}x · {pay.creditDetails.interestRate}% a.m.
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-sm font-black text-gray-900">{formatCurrency(pay.value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Totais */}
                            <section className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl p-4 border border-indigo-100">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Subtotal</p>
                                        <p className="text-sm font-bold text-gray-600">{formatCurrency(sale.subtotal)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Total da Venda</p>
                                        <p className="text-2xl font-black text-indigo-700">{formatCurrency(sale.total)}</p>
                                    </div>
                                </div>
                                {sale.totalFinanced && sale.totalFinanced > 0 && (
                                    <div className="mt-3 pt-3 border-t border-indigo-100 flex items-center justify-between">
                                        <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">Total Financiado (Crediário)</p>
                                        <p className="text-base font-black text-violet-700">{formatCurrency(sale.totalFinanced)}</p>
                                    </div>
                                )}
                            </section>

                            {/* Observações */}
                            {sale.observations && (
                                <section>
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Observações</h3>
                                    <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">{sale.observations}</p>
                                </section>
                            )}

                            {/* Observações internas */}
                            {sale.internalObservations && (
                                <section>
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Obs. Internas</h3>
                                    <p className="text-sm text-gray-600 bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">{sale.internalObservations}</p>
                                </section>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-gray-100 text-gray-700 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SaleViewModal;
