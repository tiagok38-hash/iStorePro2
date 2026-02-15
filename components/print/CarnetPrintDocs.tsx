import React, { forwardRef } from 'react';
import { CreditInstallment, Sale, Customer, CompanyInfo } from '../../types';
import { formatCurrency } from '../../services/mockApi';

interface CarnetPrintDocsProps {
    sale: Sale;
    customer: Customer;
    installments: CreditInstallment[];
    company: CompanyInfo;
}

export const CarnetPrintDocs = forwardRef<HTMLDivElement, CarnetPrintDocsProps>(({
    sale, customer, installments, company
}, ref) => {
    const totalAmount = installments.reduce((sum, i) => sum + i.amount, 0);

    return (
        <div ref={ref} className="p-8 font-sans text-gray-900 bg-white" style={{ minHeight: '297mm', width: '210mm' }}>
            <style type="text/css" media="print">
                {`
                    @page { size: A4; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact; }
                    .print-break-inside-avoid { break-inside: avoid; }
                    @media print {
                        .no-print { display: none; }
                    }
                `}
            </style>

            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-6">
                <div className="flex items-center gap-4">
                    {company.logoUrl && (
                        <img src={company.logoUrl} alt="Logo" className="h-20 w-20 object-contain rounded-lg shadow-sm" />
                    )}
                    <div>
                        <h1 className="text-2xl font-black uppercase text-gray-900 tracking-tight">{company.name}</h1>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mt-1">
                            {company.address}, {company.numero} - {company.bairro}<br />
                            {company.city} - {company.state} | {company.whatsapp || company.phone}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="bg-gray-900 text-white px-3 py-1 rounded-md mb-2 inline-block">
                        <h2 className="text-sm font-black uppercase tracking-widest">Carnê de Pagamento</h2>
                    </div>
                    <p className="text-xs font-bold text-gray-600">VENDA #{sale.display_id || sale.id}</p>
                    <p className="text-[10px] font-medium text-gray-400 mt-0.5">{new Date(sale.date).toLocaleDateString('pt-BR')}</p>
                </div>
            </div>

            {/* Customer Info */}
            <div className="mb-6 border border-gray-200 rounded-xl p-5 bg-gray-50/40">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                    <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Dados do Devedor</h3>
                </div>
                <div className="grid grid-cols-2 gap-8 text-xs">
                    <div className="space-y-2">
                        <div>
                            <p className="text-[9px] font-bold text-gray-400 uppercase">Nome Completo</p>
                            <p className="font-bold text-gray-900 text-sm">{customer.name}</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-bold text-gray-400 uppercase">CPF / CNPJ</p>
                            <p className="font-bold text-gray-800">{customer.cpf_cnpj || '---'}</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div>
                            <p className="text-[9px] font-bold text-gray-400 uppercase">Telefone de Contato</p>
                            <p className="font-bold text-gray-800">{customer.phone || '---'}</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-bold text-gray-400 uppercase">Endereço Residencial</p>
                            <p className="font-medium text-gray-700 leading-tight">
                                {customer.street}, {customer.number}<br />
                                {customer.neighborhood} — {customer.city}/{customer.state}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Promissory Note Terms */}
            <div className="mb-10 text-[10px] text-justify leading-relaxed text-gray-600 bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <h3 className="font-black uppercase mb-2 text-gray-900 tracking-wider">Confissão e Promessa de Pagamento</h3>
                <p>
                    Pelo presente instrumento particular, reconheço expressamente a dívida no valor total de <span className="font-black text-gray-900">{formatCurrency(totalAmount)}</span>,
                    referente à aquisição de produtos/serviços conforme discriminado no pedido de venda <span className="font-bold">#{sale.display_id || sale.id}</span>.
                    Comprometo-me irrevogavelmente a efetuar o pagamento das parcelas abaixo listadas em seus respectivos vencimentos.
                    O atraso no pagamento de qualquer parcela implicará na incidência de juros de mora e multa contratual, estando o título sujeito a protesto e inclusão nos órgãos de proteção ao crédito.
                </p>
                <div className="mt-4 flex justify-end">
                    <div className="text-center w-64 border-t border-gray-400 pt-1 mt-4">
                        <p className="text-[9px] font-bold uppercase text-gray-400">Assinatura do Devedor</p>
                    </div>
                </div>
            </div>

            {/* Installments Section */}
            <div className="space-y-6">
                {installments.map((inst, index) => (
                    <div key={inst.id} className="print-break-inside-avoid bg-white border border-gray-300 rounded-lg overflow-hidden flex shadow-sm min-h-[120px]">
                        {/* Stub (Canhoto) */}
                        <div className="w-[30%] border-r border-dashed border-gray-400 p-4 bg-gray-50/30 flex flex-col justify-between">
                            <div>
                                <div className="text-center bg-gray-200/50 py-1 rounded mb-3">
                                    <span className="text-[9px] font-black uppercase text-gray-500 tracking-tighter">Via do Estabelecimento</span>
                                </div>
                                <div className="space-y-1.5 text-[10px]">
                                    <div className="flex justify-between border-b border-gray-100 pb-1">
                                        <span className="text-gray-400 font-bold uppercase">Venda:</span>
                                        <span className="font-black text-gray-800">#{sale.display_id || sale.id}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-1">
                                        <span className="text-gray-400 font-bold uppercase">Parcela:</span>
                                        <span className="font-black text-gray-800">{inst.installmentNumber}/{inst.totalInstallments}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-1">
                                        <span className="text-gray-400 font-bold uppercase">Venc:</span>
                                        <span className="font-black text-gray-900">{new Date(inst.dueDate).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                    <div className="flex justify-between pt-1">
                                        <span className="text-gray-900 font-bold uppercase">Valor:</span>
                                        <span className="font-black text-indigo-700 text-xs">{formatCurrency(inst.amount)}</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className="border-t border-gray-400 w-full mt-4"></div>
                                <p className="text-[8px] text-center text-gray-400 font-bold uppercase mt-1">Rubrica</p>
                            </div>
                        </div>

                        {/* Ticket (Lâmina para Cliente) */}
                        <div className="flex-1 p-4 relative">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black uppercase tracking-tight text-gray-900">{company.name}</span>
                                </div>
                                <span className="text-[9px] font-black uppercase text-indigo-500/60 tracking-widest bg-indigo-50 px-2 py-0.5 rounded">Via do Cliente</span>
                            </div>

                            <div className="grid grid-cols-4 gap-4 mb-3">
                                <div className="col-span-1">
                                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Parcela</p>
                                    <p className="text-sm font-black text-gray-800">{inst.installmentNumber}/{inst.totalInstallments}</p>
                                </div>
                                <div className="col-span-1">
                                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Vencimento</p>
                                    <p className="text-sm font-black text-red-600 bg-red-50 p-1 rounded border border-red-100 text-center">{new Date(inst.dueDate).toLocaleDateString('pt-BR')}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Valor do Título</p>
                                    <p className="text-base font-black text-indigo-700 bg-indigo-50 p-1 rounded border border-indigo-100 text-center">{formatCurrency(inst.amount)}</p>
                                </div>
                            </div>

                            <div className="text-[10px] space-y-1 text-gray-600 border-t border-gray-100 pt-2">
                                <p><span className="font-bold uppercase text-[9px] text-gray-400 mr-1">Sacado:</span> <span className="font-bold text-gray-800 uppercase">{customer.name}</span></p>
                                <p className="flex justify-between">
                                    <span><span className="font-bold uppercase text-[9px] text-gray-400 mr-1">Referência:</span> <span className="font-medium">Venda #{sale.display_id || sale.id}</span></span>
                                    <span className="text-[9px] text-gray-400 italic">Pagável em qualquer canal da loja ou via Pix.</span>
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

CarnetPrintDocs.displayName = 'CarnetPrintDocs';
