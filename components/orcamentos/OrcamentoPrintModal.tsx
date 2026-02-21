
import React, { useId, useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Customer, User, CompanyInfo, ReceiptTermParameter, WarrantyParameter } from '../../types.ts';
import { formatCurrency, getCompanyInfo, getReceiptTerms, getWarranties } from '../../services/mockApi.ts';
import { CloseIcon, PrinterIcon, SpinnerIcon, WhatsAppIcon, DocumentTextIcon, SuccessIcon } from '../icons.tsx';

const formatDateTime = (dateString?: string) => {
    const d = dateString ? new Date(dateString) : new Date();
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

// Layout A4 para Orçamento
const A4LayoutOrcamento: React.FC<{
    orcamento: any;
    customer?: Customer | null;
    companyInfo?: CompanyInfo | null;
}> = ({ orcamento, customer, companyInfo }) => {
    return (
        <div className="font-sans text-black receipt-body bg-white p-4">
            <header className="flex justify-between items-start pb-4 border-b-2 border-black">
                <div className="flex items-center gap-4">
                    {companyInfo?.logoUrl && <img src={companyInfo.logoUrl} alt="Logo" className="h-20 w-20 object-contain" />}
                    <div>
                        <h1 className="font-bold text-xl uppercase leading-tight">{companyInfo?.name}</h1>
                        <p className="text-[10px] leading-tight">CNPJ: {companyInfo?.cnpj}</p>
                        <p className="text-[10px] leading-tight">{companyInfo?.address} - {companyInfo?.city}/{companyInfo?.state}</p>
                        <p className="text-[10px] leading-tight">Tel: {companyInfo?.whatsapp || companyInfo?.phone}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="font-black text-2xl text-gray-800">ORÇAMENTO</h2>
                    <p className="font-bold text-lg">#{orcamento.numero}</p>
                    <p className="text-xs text-gray-500">{formatDateTime()}</p>
                </div>
            </header>

            <section className="py-4 border-b border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                        <p className="font-bold text-gray-500 uppercase text-[9px] mb-1">Dados do Cliente</p>
                        <p className="font-bold text-sm">{customer?.name || 'Consumidor (Sem Cadastro)'}</p>
                        {customer?.cpf && <p>CPF/CNPJ: {customer.cpf}</p>}
                        {customer?.phone && <p>Telefone: {customer.phone}</p>}
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-gray-500 uppercase text-[9px] mb-1">Vendedor</p>
                        <p className="font-bold">{orcamento.vendedor_nome || 'Atendimento iStore'}</p>
                    </div>
                </div>
            </section>

            <table className="w-full mt-6 text-sm">
                <thead>
                    <tr className="bg-gray-100 uppercase text-[10px] font-bold">
                        <th className="px-2 py-2 text-left border-b-2 border-black">Descrição do Item</th>
                        <th className="px-2 py-2 text-center border-b-2 border-black" style={{ width: '60px' }}>Qtd</th>
                        <th className="px-2 py-2 text-right border-b-2 border-black" style={{ width: '100px' }}>Unitário</th>
                        <th className="px-2 py-2 text-right border-b-2 border-black" style={{ width: '100px' }}>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    {orcamento.items.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-100">
                            <td className="px-2 py-3">
                                <p className="font-bold leading-tight">{item.nome_produto_snapshot}</p>
                                <p className="text-[10px] text-gray-500">REF: {item.sku_snapshot}</p>
                            </td>
                            <td className="px-2 py-3 text-center font-medium">{item.quantidade}</td>
                            <td className="px-2 py-3 text-right">{formatCurrency(item.preco_unitario_snapshot)}</td>
                            <td className="px-2 py-3 text-right font-bold">{formatCurrency(item.total_snapshot || (item.quantidade * item.preco_unitario_snapshot))}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="mt-8 flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                    <div className="flex justify-between text-gray-600">
                        <span>Subtotal Itens:</span>
                        <span>{formatCurrency(orcamento.subtotal)}</span>
                    </div>
                    {orcamento.desconto_total > 0 && (
                        <div className="flex justify-between text-red-600 italic">
                            <span>Desconto aplicado:</span>
                            <span>-{formatCurrency(orcamento.desconto_total)}</span>
                        </div>
                    )}
                    {orcamento.juros_total > 0 && (
                        <div className="flex justify-between text-orange-600">
                            <span>Encargos Simulação:</span>
                            <span>+{formatCurrency(orcamento.juros_total)}</span>
                        </div>
                    )}
                    <div className="flex justify-between border-t-2 border-black pt-2 font-black text-lg">
                        <span>TOTAL FINAL:</span>
                        <span>{formatCurrency(orcamento.total_final)}</span>
                    </div>
                </div>
            </div>

            <section className="mt-10 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                <h3 className="font-bold text-xs uppercase text-gray-500 mb-2">Simulação de Pagamento Sugerida</h3>
                <div className="grid grid-cols-2 gap-4">
                    {orcamento.forma_pagamento_snapshot?.pagamentos?.map((p: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs border-b border-gray-200 pb-1">
                            <span className="font-bold">{p.method} {p.installments > 1 ? `(${p.installments}x)` : ''}</span>
                            <span>{formatCurrency(p.value)}</span>
                        </div>
                    ))}
                </div>
            </section>

            {orcamento.observacoes && (
                <div className="mt-6 text-xs italic text-gray-500">
                    <span className="font-bold uppercase not-italic">Observações:</span> {orcamento.observacoes}
                </div>
            )}

            <footer className="mt-20 pt-10 border-t border-gray-200 text-center">
                <div className="flex justify-around">
                    <div className="flex flex-col items-center">
                        <div className="w-48 border-b border-black mb-1"></div>
                        <p className="text-[10px] uppercase">{companyInfo?.name || 'Carimbo da Empresa'}</p>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="w-48 border-b border-black mb-1"></div>
                        <p className="text-[10px] uppercase">{customer?.name || 'Assinatura do Cliente'}</p>
                    </div>
                </div>
                <p className="text-[8px] text-gray-400 mt-10 italic">Este documento é apenas um orçamento e não possui validade fiscal como nota, nem garante reserva de estoque.</p>
            </footer>
        </div>
    );
};

// Layout Térmico para Orçamento
const ThermalLayoutOrcamento: React.FC<{
    orcamento: any;
    customer?: Customer | null;
    companyInfo?: CompanyInfo | null;
}> = ({ orcamento, customer, companyInfo }) => {
    return (
        <div className="w-[80mm] mx-auto p-2 bg-white text-black font-mono text-xs receipt-body">
            <div className="text-center space-y-1">
                {companyInfo?.logoUrl && <img src={companyInfo.logoUrl} alt="Logo" className="h-16 mx-auto object-contain" />}
                <p className="font-bold text-sm uppercase">{companyInfo?.name}</p>
                <p className="text-[10px]">{companyInfo?.address}</p>
                <p className="text-[10px]">CNPJ: {companyInfo?.cnpj}</p>
            </div>
            <div className="border-t border-dashed border-black my-2"></div>
            <p className="text-center font-bold text-sm">ORÇAMENTO #{orcamento.numero}</p>
            <div className="border-t border-dashed border-black my-2 text-[10px]">
                <p>DATA: {formatDateTime()}</p>
                <p>CLIENTE: {customer?.name || 'CONSUMIDOR'}</p>
            </div>
            <div className="border-t border-dashed border-black my-2"></div>
            <div className="space-y-1">
                {orcamento.items.map((item: any, idx: number) => (
                    <div key={idx} className="mb-2">
                        <p className="font-bold uppercase">{item.nome_produto_snapshot}</p>
                        <div className="flex justify-between text-[10px]">
                            <span>{item.quantidade}x {formatCurrency(item.preco_unitario_snapshot)}</span>
                            <span>{formatCurrency(item.quantidade * item.preco_unitario_snapshot)}</span>
                        </div>
                    </div>
                ))}
            </div>
            <div className="border-t border-dashed border-black my-2"></div>
            <div className="text-right space-y-1 font-bold">
                <div className="flex justify-between text-[10px]"><span>SUBTOTAL:</span><span>{formatCurrency(orcamento.subtotal)}</span></div>
                {orcamento.desconto_total > 0 && <div className="flex justify-between text-[10px]"><span>DESCONTO:</span><span>-{formatCurrency(orcamento.desconto_total)}</span></div>}
                <div className="flex justify-between text-sm"><span>TOTAL FINAL:</span><span>{formatCurrency(orcamento.total_final)}</span></div>
            </div>
            <div className="border-t border-dashed border-black my-2"></div>
            <p className="font-bold text-[10px] mb-1">SIMULAÇÃO PAGAMENTO:</p>
            {orcamento.forma_pagamento_snapshot?.pagamentos?.map((p: any, idx: number) => (
                <div key={idx} className="flex justify-between text-[10px]">
                    <span>{p.method} {p.installments > 1 ? `${p.installments}x` : ''}</span>
                    <span>{formatCurrency(p.value)}</span>
                </div>
            ))}
            <div className="border-t border-dashed border-black my-4"></div>
            <div className="text-center text-[10px] italic">
                <p>Orçamento válido por 2 dias.</p>
                <p>Obrigado pela visita!</p>
            </div>
        </div>
    );
};

const OrcamentoPrintModal: React.FC<{
    orcamento: any;
    customer?: Customer | null;
    onClose: () => void;
}> = ({ orcamento, customer, onClose }) => {
    const uniqueId = useId().replace(/:/g, '');
    const [format, setFormat] = useState<'A4' | 'thermal'>('A4');
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadInfo = async () => {
            const info = await getCompanyInfo();
            setCompanyInfo(info);
            setLoading(false);
        };
        loadInfo();
    }, []);

    const handlePrint = () => {
        setTimeout(() => {
            window.print();
        }, 100);
    };

    return createPortal(
        <div id={`print-modal-orcamento-${uniqueId}`} className="fixed inset-0 bg-black/70 flex justify-center items-start z-[300001] p-0 sm:p-4 lg:py-8 print:inset-0 print:p-0 print:bg-white overflow-y-auto backdrop-blur-sm">
            <style>
                {`
                    @media print {
                        /* Page setup */
                        ${format === 'thermal' ? `
                            @page { size: 80mm auto; margin: 0; }
                        ` : `
                            @page { size: A4 portrait; margin: 10mm; }
                        `}

                        /* Reset html/body */
                        html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 100% !important;
                            background: white !important;
                        }

                        /* Hide everything */
                        body > * {
                            display: none !important;
                        }

                        /* Show only the portal root that contains our receipt */
                        body > div:last-child {
                            display: block !important;
                        }

                        /* Hide all non-receipt elements */
                        .no-print {
                            display: none !important;
                        }

                        /* Overlay — collapse/center */
                        #print-modal-orcamento-${uniqueId} {
                            position: static !important;
                            display: block !important;
                            width: 100% !important;
                            height: auto !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            background: white !important;
                            overflow: visible !important;
                            inset: auto !important;
                        }

                        /* Print container — flat block */
                        #print-container-orcamento-${uniqueId} {
                            display: block !important;
                            position: static !important;
                            width: ${format === 'thermal' ? '80mm' : '100%'} !important;
                            max-width: ${format === 'thermal' ? '80mm' : 'none'} !important;
                            height: auto !important;
                            margin: 0 auto !important;
                            padding: 0 !important;
                            background: white !important;
                            box-shadow: none !important;
                            border: none !important;
                            border-radius: 0 !important;
                            overflow: visible !important;
                        }

                        /* Content wrapper */
                        .print-content-wrapper {
                            display: block !important;
                            width: 100% !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            overflow: visible !important;
                            background: white !important;
                        }

                        /* Receipt body */
                        .receipt-body {
                            display: block !important;
                            width: 100% !important;
                            max-width: ${format === 'thermal' ? '80mm' : 'none'} !important;
                            padding: ${format === 'thermal' ? '4mm' : '0'} !important;
                            overflow: visible !important;
                            color: black !important;
                            background: white !important;
                        }
                    }
                `}
            </style>

            <div id={`print-container-orcamento-${uniqueId}`} className={`bg-white shadow-2xl w-full ${format === 'A4' ? 'max-w-[210mm]' : 'max-w-sm'} rounded-3xl overflow-hidden flex flex-col print:rounded-none print:shadow-none`}>
                <div className="p-4 bg-white border-b border-gray-100 no-print flex justify-between items-center gap-4 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                            <DocumentTextIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="font-black text-gray-800 uppercase tracking-tight">Recibo de Orçamento</h2>
                            <p className="text-xs text-gray-500 font-medium">#{orcamento.numero}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200">
                            <button
                                onClick={() => setFormat('A4')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${format === 'A4' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Folha A4
                            </button>
                            <button
                                onClick={() => setFormat('thermal')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${format === 'thermal' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Térmica
                            </button>
                        </div>

                        <div className="h-8 w-px bg-gray-200 mx-2"></div>

                        <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all shadow-md shadow-orange-500/20">
                            <PrinterIcon className="w-4 h-4" /> Imprimir
                        </button>

                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 lg:p-12 print:p-0 bg-gray-50/50 print:bg-white flex justify-center print-content-wrapper">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-4">
                            <SpinnerIcon className="animate-spin" size={40} />
                            <p className="font-medium animate-pulse">Preparando documento...</p>
                        </div>
                    ) : (
                        <div className={`bg-white shadow-xl print:shadow-none w-full ${format === 'A4' ? 'max-w-[210mm]' : 'max-w-[80mm]'}`}>
                            {format === 'A4' ? (
                                <A4LayoutOrcamento orcamento={orcamento} customer={customer} companyInfo={companyInfo} />
                            ) : (
                                <ThermalLayoutOrcamento orcamento={orcamento} customer={customer} companyInfo={companyInfo} />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default OrcamentoPrintModal;
