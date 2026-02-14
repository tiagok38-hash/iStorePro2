import React, { Component } from 'react';
import { CreditInstallment, Sale, Customer, CompanyInfo } from '../../types.ts';
import { formatCurrency } from '../../services/mockApi.ts';

interface CarnetPrintDocsProps {
    sale: Sale;
    customer: Customer;
    installments: CreditInstallment[];
    company: CompanyInfo;
}

export class CarnetPrintDocs extends Component<CarnetPrintDocsProps> {
    render() {
        const { sale, customer, installments, company } = this.props;
        const totalAmount = installments.reduce((sum, i) => sum + i.amount, 0);

        return (
            <div className="p-8 font-sans text-gray-900 bg-white" style={{ minHeight: '297mm', width: '210mm' }}>
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
                <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
                    <div className="flex items-center gap-4">
                        {company.logoUrl && (
                            <img src={company.logoUrl} alt="Logo" className="h-16 object-contain" />
                        )}
                        <div>
                            <h1 className="text-2xl font-black uppercase text-gray-900">{company.name}</h1>
                            <p className="text-xs text-gray-600">
                                {company.address}, {company.numero} - {company.bairro}<br />
                                {company.city} - {company.state} | Tel: {company.whatsapp}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-xl font-bold uppercase text-gray-800">Carnê de Pagamento</h2>
                        <p className="text-sm font-medium text-gray-600">Venda Nº: <span className="font-bold">{sale.display_id}</span></p>
                        <p className="text-xs text-gray-500">Data: {new Date(sale.date).toLocaleDateString()}</p>
                    </div>
                </div>

                {/* Customer Info */}
                <div className="mb-6 border border-gray-300 rounded p-4 bg-gray-50/50">
                    <h3 className="text-xs font-bold uppercase text-gray-500 mb-2">Dados do Cliente (Devedor)</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p><span className="font-bold">Nome:</span> {customer.name}</p>
                            <p><span className="font-bold">CPF/CNPJ:</span> {customer.cpf_cnpj || 'N/A'}</p>
                        </div>
                        <div>
                            <p><span className="font-bold">Telefone:</span> {customer.phone || 'N/A'}</p>
                            <p><span className="font-bold">Endereço:</span> {customer.street}, {customer.number} - {customer.neighborhood}, {customer.city} - {customer.state}</p>
                        </div>
                    </div>
                </div>

                {/* Promissory Note Terms */}
                <div className="mb-8 text-xs text-justify leading-relaxed text-gray-700 bg-gray-50 p-4 rounded border border-gray-200">
                    <h3 className="font-bold uppercase mb-2 text-gray-900">Confissão de Dívida</h3>
                    <p>
                        Reconheço(emos) a dívida no valor total de <span className="font-bold">{formatCurrency(totalAmount)}</span> referente à compra de mercadorias/serviços descritos no pedido de venda nº {sale.display_id}.
                        Comprometo(me) a pagar as parcelas abaixo discriminadas nas datas de seus respectivos vencimentos.
                        O não pagamento na data prevista acarretará em multa e juros conforme contrato, além de despesas de cobrança e honorários advocatícios em caso de cobrança judicial.
                        Autorizo desde já o protesto deste título em caso de inadimplência.
                    </p>
                </div>

                {/* Installments Table (Carnet Layout) */}
                <div className="border-t-2 border-dashed border-gray-400 pt-6"></div>

                {installments.map((inst, index) => (
                    <div key={inst.id} className="print-break-inside-avoid mb-6 bg-white p-4 border border-gray-300 rounded shadow-sm">
                        <div className="flex items-center gap-4">
                            {/* Stub (Canhoto) */}
                            <div className="w-1/3 border-r-2 border-dashed border-gray-300 pr-4">
                                <div className="text-center bg-gray-100 py-1 mb-2 rounded">
                                    <span className="text-[10px] font-bold uppercase text-gray-500">Via do Estabelecimento</span>
                                </div>
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="font-bold">Venda:</span>
                                        <span>{sale.display_id}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold">Parc:</span>
                                        <span>{inst.installmentNumber}/{inst.totalInstallments}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold">Venc:</span>
                                        <span>{new Date(inst.dueDate).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                                        <span className="font-bold text-gray-900">Valor:</span>
                                        <span className="font-bold text-gray-900">{formatCurrency(inst.amount)}</span>
                                    </div>
                                    <div className="mt-4 border-b border-gray-400 w-full"></div>
                                    <p className="text-[9px] text-center text-gray-400 mt-1">Assinatura do Recebedor</p>
                                </div>
                            </div>

                            {/* Ticket (Lâmina para Cliente) */}
                            <div className="w-2/3 pl-2">
                                <div className="flex justify-between items-center bg-gray-800 text-white p-2 rounded-t mb-2">
                                    <span className="text-xs font-bold uppercase">{company.name}</span>
                                    <span className="text-[10px] font-bold uppercase opacity-80">Via do Cliente</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-xs mb-2">
                                    <div>
                                        <p className="text-gray-500 text-[10px] font-bold uppercase mb-0.5">Vencimento</p>
                                        <p className="text-sm font-bold bg-gray-50 p-1 border border-gray-200 rounded text-center text-gray-900">{new Date(inst.dueDate).toLocaleDateString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-[10px] font-bold uppercase mb-0.5">Valor do Documento</p>
                                        <p className="text-sm font-bold bg-gray-50 p-1 border border-gray-200 rounded text-center text-gray-900">{formatCurrency(inst.amount)}</p>
                                    </div>
                                </div>
                                <div className="text-xs space-y-1">
                                    <p><span className="font-bold text-gray-600">Sacado:</span> {customer.name}</p>
                                    <p><span className="font-bold text-gray-600">Ref:</span> Parcela {inst.installmentNumber}/{inst.totalInstallments} - Venda {sale.display_id}</p>
                                    <p className="text-[10px] text-gray-500 italic mt-1">Pagável preferencialmente na loja ou via Pix. Após vencimento, sujeito a juros e multa.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }
}
