
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sale, Product, Customer, User, CompanyInfo, ReceiptTermParameter, WarrantyParameter } from '../types.ts';
import { formatCurrency, getCompanyInfo, getReceiptTerms, getWarranties } from '../services/mockApi.ts';
import { CloseIcon, PrinterIcon, SpinnerIcon } from './icons.tsx';

const formatDateTime = (dateString: string) => new Date(dateString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

// Format CNPJ: 22.333.930/0001-08
const formatCNPJ = (cnpj?: string): string => {
    if (!cnpj) return '-';
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return cnpj;
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

// Format CEP: 55192-245
const formatCEP = (cep?: string): string => {
    if (!cep) return '-';
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return cep;
    return digits.replace(/(\d{5})(\d{3})/, '$1-$2');
};

const getWarrantyExpiration = (saleDate: string, warrantyName: string, warranties: WarrantyParameter[]): string => {
    const date = new Date(saleDate);
    const warranty = warranties.find(w => w.name === warrantyName);

    if (warranty && warranty.days > 0) {
        date.setDate(date.getDate() + warranty.days);
        return date.toLocaleDateString('pt-BR');
    }

    if (!warrantyName) return '';
    // Fallback logic for string-based parsing if no match found in parameters
    const matches = warrantyName.match(/(\d+)\s+(mes|meses|ano|anos)/i);
    if (!matches) return ''; // Only return if we have a valid expiration

    const duration = parseInt(matches[1], 10);
    const unit = matches[2].toLowerCase();

    if (unit.startsWith('mes')) {
        date.setMonth(date.getMonth() + duration);
    } else if (unit.startsWith('ano')) {
        date.setFullYear(date.getFullYear() + duration);
    }

    return date.toLocaleDateString('pt-BR');
};


interface ReceiptLayoutProps {
    sale: Sale;
    productMap: Record<string, Product>;
    customer?: Customer;
    salesperson?: User;
    companyInfo?: CompanyInfo | null;
    activeTerm?: ReceiptTermParameter;
    totalPaid: number;
    totalItems: number;
    totalFees: number;
    warranties: WarrantyParameter[];
}


const A4Layout: React.FC<ReceiptLayoutProps> = ({ sale, productMap, customer, salesperson, companyInfo, activeTerm, totalPaid, totalItems, totalFees, warranties }) => {
    const renderExclusions = (content: string) => {
        if (!content) return null;
        return content.split('\n').map((line, index) => {
            const parts = line.split('.');
            if (parts.length > 1 && !isNaN(parseInt(parts[0], 10))) {
                return <li key={index} className="flex"><span className="w-4 flex-shrink-0">{parts[0]}.</span><span>{parts.slice(1).join('.').trim()}</span></li>;
            }
            return <li key={index}>{line}</li>
        });
    };

    return (
        <div className="font-sans text-black receipt-body bg-white" id="receipt-content">
            <div className="flex-1">
                {/* Company Header - More compact */}
                <header className="flex justify-between items-start pb-1 border-b border-black">
                    <div className="flex items-center gap-2">
                        {companyInfo?.logoUrl && <img src={companyInfo.logoUrl} alt={companyInfo.name || ''} className="h-16 w-16 object-contain" />}
                        <div>
                            <h1 className="font-bold text-lg leading-tight text-black">{companyInfo?.name}</h1>
                            <p className="text-[9px] leading-tight">CNPJ: {formatCNPJ(companyInfo?.cnpj)}</p>
                            <p className="text-[9px] leading-tight">{companyInfo?.address}{companyInfo?.numero ? `, ${companyInfo.numero}` : ''} - {companyInfo?.bairro}</p>
                            <p className="text-[9px] leading-tight">{companyInfo?.city} ({companyInfo?.state}) - CEP: {formatCEP(companyInfo?.cep)}</p>
                            <p className="text-[9px] leading-tight">
                                {companyInfo?.whatsapp && <span>WhatsApp: {companyInfo.whatsapp} </span>}
                                {companyInfo?.instagram && <span>Instagram: {companyInfo.instagram} </span>}
                                {companyInfo?.email && <span>Email: {companyInfo.email}</span>}
                            </p>
                        </div>
                    </div>
                    {/* Receipt ID and Date on right side */}
                    <div className="text-right text-[9px]">
                        <p className="font-bold text-base">Recibo #{sale.id}</p>
                        <p>{new Date(sale.date).toLocaleDateString('pt-BR')} às {new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </header>

                {/* Sale Info Row */}
                <section className="flex justify-between items-start border-b border-black py-1 text-[9px]">
                    <div className="flex gap-4">
                        <span><b>ID:</b> #{sale.id}</span>
                        <span><b>Caixa:</b> #{sale.posTerminal.replace(/\D/g, '') || 'N/A'}</span>
                    </div>
                    <span><b>Vendedor:</b> {salesperson?.name}</span>
                </section>

                {/* Customer Data */}
                <section className="py-1 border-b border-black text-[10px]">
                    <div className="flex flex-wrap gap-x-6">
                        <span><b>Cliente:</b> {customer?.name}</span>
                        <span><b>CPF:</b> {customer?.cpf || '-'}</span>
                        <span><b>Tel:</b> {customer?.phone}</span>
                    </div>
                </section>

                {/* Title */}
                <h2 className="font-bold text-center text-sm my-1 uppercase">RECIBO DE VENDA</h2>

                {/* Products Table - Full Width */}
                <div className="rounded-xl overflow-hidden border border-black">
                    <table className="w-full text-left border-collapse text-[9px]">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="px-1.5 py-0.5 font-semibold border border-black">Descrição</th>
                                <th className="px-1.5 py-0.5 font-semibold border border-black text-center" style={{ width: '40px' }}>Qtd</th>
                                <th className="px-1.5 py-0.5 font-semibold border border-black text-right" style={{ width: '65px' }}>Unit.</th>
                                <th className="px-1.5 py-0.5 font-semibold border border-black text-right" style={{ width: '65px' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sale.items.map(item => {
                                const product = productMap[item.productId];
                                const warrantyExp = getWarrantyExpiration(sale.date, product?.warranty || '', warranties);
                                return (
                                    <tr key={item.productId}>
                                        <td className="px-1.5 py-0.5 align-top border border-black">
                                            <p className="font-semibold leading-tight">{`SKU:${product?.sku || ''} ${product?.model || 'Produto'}`}</p>
                                            <div className="text-[8px] text-gray-600 leading-tight">
                                                {product?.imei1 && <span>IMEI1: {product.imei1} </span>}
                                                {product?.imei2 && <span>IMEI2: {product.imei2} </span>}
                                                {product?.serialNumber && <span>S/N: {product.serialNumber} </span>}
                                                <span>{product?.condition}</span>
                                            </div>
                                            {warrantyExp && (
                                                <p className="text-[8px] text-gray-700 leading-tight">
                                                    Garantia até {warrantyExp}
                                                    {product?.batteryHealth && product?.condition !== 'Novo' ? ` • Bat: ${product.batteryHealth}%` : ''}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-1.5 py-0.5 text-center align-top border border-black">{item.quantity}</td>
                                        <td className="px-1.5 py-0.5 text-right align-top border border-black">{formatCurrency(item.unitPrice)}</td>
                                        <td className="px-1.5 py-0.5 text-right font-semibold align-top border border-black">{formatCurrency(item.unitPrice * item.quantity)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Payment + Totals - Side by Side */}
                <section className="mt-1 flex justify-between gap-2 text-[9px]">
                    {/* Payment Section - 58% width */}
                    <div className="border border-black p-1.5 rounded-xl" style={{ width: '58%' }}>
                        <p className="font-bold mb-0.5 text-[10px] border-b border-gray-300">PAGAMENTO</p>
                        <div className="space-y-0.5">
                            {sale.payments.map(p => {
                                let methodName = p.method;
                                let detailsLine = '';
                                const totalValueWithFees = p.value + (p.fees || 0);
                                let valueText = formatCurrency(totalValueWithFees);

                                if (p.installments && p.installments > 1) {
                                    const installmentValue = p.installmentsValue || totalValueWithFees / p.installments;
                                    detailsLine = `${p.installments}x de ${formatCurrency(installmentValue)}`;
                                } else if (p.feePercentage && p.feePercentage > 0) {
                                    detailsLine = `(Taxa ${p.feePercentage.toFixed(2)}%)`;
                                }

                                return (
                                    <div key={p.id} className="flex justify-between items-start border-b border-dashed border-gray-100 pb-0.5 last:border-b-0">
                                        <div className="flex-1">
                                            <span className="font-medium">{methodName}</span>
                                            {detailsLine && <span className="text-gray-600 ml-1 text-[8px]">{detailsLine}</span>}
                                            {p.tradeInDetails && (
                                                <p className="text-[8px] text-gray-600 italic leading-tight">
                                                    Troca: {p.tradeInDetails.model}
                                                </p>
                                            )}
                                        </div>
                                        <span className="font-semibold ml-2 whitespace-nowrap">{valueText}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Totals Section - 40% width */}
                    <div className="bg-white p-1.5 rounded-xl border border-black text-[9px]" style={{ width: '40%' }}>
                        <div className="flex justify-between"><span className="font-semibold">SUBTOTAL</span><span>{formatCurrency(sale.subtotal)}</span></div>
                        <div className="flex justify-between"><span className="font-semibold">DESCONTO</span><span>{formatCurrency(sale.discount)}</span></div>
                        {totalFees > 0 && <div className="flex justify-between"><span className="font-semibold">TAXAS</span><span>{formatCurrency(totalFees)}</span></div>}
                        <div className="flex justify-between border-t border-black pt-0.5 mt-0.5 font-bold text-[10px] font-black uppercase tracking-tight"><span>TOTAL</span><span>{formatCurrency(sale.total + totalFees)}</span></div>
                        {/* Highlighted PAGO section */}
                        <div className="flex justify-between bg-black text-white px-1.5 py-0.5 rounded-lg mt-0.5 border-black">
                            <span className="font-black text-[10px]">PAGO</span>
                            <span className="font-black text-[10px]">{formatCurrency(totalPaid)}</span>
                        </div>
                    </div>
                </section>

                {/* Observations */}
                {sale.observations && (
                    <section className="mt-1.5 py-1 border border-black rounded-lg px-1.5 text-[8px]">
                        <span className="font-bold">OBSERVAÇÕES:</span> {sale.observations}
                    </section>
                )}

                {/* Warranty Terms - Compact */}
                {activeTerm && (
                    <section className="mt-2 space-y-1">
                        {activeTerm.warrantyTerm?.showOnReceipt && activeTerm.warrantyTerm.content && (
                            <div>
                                <h3 className="font-bold uppercase text-[9px] mb-0.5 border-b border-black">GARANTIA</h3>
                                <p className="whitespace-pre-wrap text-justify text-[8px] leading-tight">{activeTerm.warrantyTerm.content}</p>
                            </div>
                        )}
                        {activeTerm.warrantyExclusions?.showOnReceipt && activeTerm.warrantyExclusions.content && (
                            <div className="mt-1">
                                <h3 className="font-bold uppercase border-b border-black text-[9px] mb-0.5">A GARANTIA NÃO COBRE:</h3>
                                <ul className="list-none space-y-0 text-[7px] leading-tight columns-2">{renderExclusions(activeTerm.warrantyExclusions.content)}</ul>
                            </div>
                        )}
                        {activeTerm.imageRights?.showOnReceipt && activeTerm.imageRights.content && (
                            <div className="mt-1">
                                <h3 className="font-bold uppercase border-b border-black text-[9px] mb-0.5">DIREITO DE IMAGEM</h3>
                                <p className="whitespace-pre-wrap text-justify text-[7px] leading-tight">{activeTerm.imageRights.content}</p>
                            </div>
                        )}
                    </section>
                )}
            </div>

            {/* System Promo Footer */}
            <div className="pt-4 text-center" style={{ fontSize: '7px', color: '#9ca3af' }}>
                <p>iStore Pro - O melhor sistema para sua loja de eletronicos. Saiba mais em istorepro.com.br</p>
            </div>
        </div>
    );
};

const ThermalLayout: React.FC<ReceiptLayoutProps> = ({ sale, productMap, customer, salesperson, companyInfo, activeTerm, totalPaid, totalItems, totalFees, warranties }) => {
    return (
        <div className="w-[80mm] mx-auto p-2 bg-white text-black font-mono text-xs receipt-body" id="receipt-content">
            <div className="text-center space-y-1">
                {companyInfo?.logoUrl && <img src={companyInfo.logoUrl} alt="Logo" className="h-24 mx-auto object-contain max-w-full" />}
                <p className="font-bold">{companyInfo?.name}</p>
                <p>{companyInfo?.address}</p>
                <p>{companyInfo?.city} - {companyInfo?.state}</p>
                <p>CNPJ: {companyInfo?.cnpj}</p>
            </div>
            <div className="border-t-2 border-dashed border-black my-2"></div>
            <div className="space-y-0.5">
                <p>DATA: {formatDateTime(sale.date)}</p>
                <p>RECIBO: #{sale.id}</p>
                <p>VENDEDOR: {salesperson?.name || 'N/A'}</p>
                <p>CLIENTE: {customer?.name || 'N/A'}</p>
                {customer?.cpf && <p>CPF: {customer.cpf}</p>}
            </div>
            <div className="border-t-2 border-dashed border-black my-2"></div>
            <p className="text-center font-bold">RECIBO DE VENDA</p>
            <div className="border-t-2 border-dashed border-black my-2"></div>
            <div className="space-y-1">
                {sale.items.map(item => {
                    const product = productMap[item.productId];
                    const warrantyExp = getWarrantyExpiration(sale.date, product?.warranty || '', warranties);

                    return (
                        <div key={item.productId} className="mb-1">
                            <p className="font-bold">{product?.model || 'Produto desconhecido'}</p>
                            <div className="flex justify-between text-[10px]">
                                <span>{item.quantity} x {formatCurrency(item.unitPrice)}</span>
                                <span>{formatCurrency(item.unitPrice * item.quantity)}</span>
                            </div>
                            <div className="text-[9px] text-gray-700">
                                {(product?.serialNumber || product?.imei1) && (
                                    <p>
                                        {product.serialNumber && `S/N: ${product.serialNumber} `}
                                        {product.imei1 && `IMEI: ${product.imei1}`}
                                    </p>
                                )}
                                {warrantyExp && (
                                    <p className="font-semibold italic">Garantia válida até {warrantyExp}</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="border-t border-dashed border-black my-2"></div>
            <div className="space-y-0.5 text-right">
                <div className="flex justify-between"><span className="text-left">Subtotal:</span><span>{formatCurrency(sale.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-left">Desconto:</span><span>{formatCurrency(sale.discount)}</span></div>
                {totalFees > 0 && <div className="flex justify-between"><span className="text-left">Acréscimos:</span><span>{formatCurrency(totalFees)}</span></div>}
                <div className="flex justify-between font-bold text-sm"><span className="text-left">TOTAL:</span><span>{formatCurrency(sale.total)}</span></div>
            </div>
            <div className="border-t border-dashed border-black my-2"></div>
            <div>
                <p className="font-bold">PAGAMENTO:</p>
                {sale.payments.map(p => (
                    <div key={p.id}>
                        <div className="flex justify-between">
                            <span>{p.method}{p.installments ? ` ${p.installments}x` : ''}</span>
                            <span>{formatCurrency(p.value + (p.fees || 0))}</span>
                        </div>
                        {p.tradeInDetails && (
                            <p className="text-[10px] pl-2">
                                * {p.tradeInDetails.model} <br />
                                {p.tradeInDetails.imei1 ? `IMEI: ${p.tradeInDetails.imei1}` : `S/N: ${p.tradeInDetails.serialNumber}`}
                            </p>
                        )}
                    </div>
                ))}
                <div className="flex justify-between font-bold mt-1"><span className="text-left">TOTAL PAGO:</span><span>{formatCurrency(totalPaid)}</span></div>
                <div className="flex justify-between"><span className="text-left">TROCO:</span><span>{formatCurrency(totalPaid - sale.total > 0 ? totalPaid - sale.total : 0)}</span></div>
            </div>

            {sale.observations && (
                <>
                    <div className="border-t border-dashed border-black my-2"></div>
                    <div>
                        <p className="font-bold">OBSERVAÇÕES:</p>
                        <p>{sale.observations}</p>
                    </div>
                </>
            )}

            {activeTerm && (
                <div className="mt-2 pt-2 border-t-2 border-dashed border-black text-[8pt] space-y-2">
                    {activeTerm.warrantyTerm?.showOnReceipt && activeTerm.warrantyTerm.content && (
                        <div>
                            <h3 className="font-bold text-center text-xs uppercase">Termos de Garantia</h3>
                            <p className="whitespace-pre-wrap">{activeTerm.warrantyTerm.content}</p>
                        </div>
                    )}
                    {activeTerm.warrantyExclusions?.showOnReceipt && activeTerm.warrantyExclusions.content && (
                        <div className="mt-2">
                            <h3 className="font-bold text-center text-xs uppercase">A Garantia não Cobre</h3>
                            <p className="whitespace-pre-wrap">{activeTerm.warrantyExclusions.content}</p>
                        </div>
                    )}
                    {activeTerm.imageRights?.showOnReceipt && activeTerm.imageRights.content && (
                        <div className="mt-2">
                            <h3 className="font-bold text-center text-xs uppercase">Direito de Imagem</h3>
                            <p className="whitespace-pre-wrap">{activeTerm.imageRights.content}</p>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-8 text-center">
                <p>___________________________________</p>
                <p>{customer?.name || 'Assinatura do Cliente'}</p>
            </div>

            {/* System Promo Footer */}
            <div className="mt-4 text-center" style={{ fontSize: '8pt', color: '#6b7280' }}>
                <p>iStore Pro - O melhor sistema para sua loja de eletronicos. Saiba mais em istorepro.com.br</p>
            </div>
        </div>
    );
};

const SaleReceiptModal: React.FC<{ sale: Sale; productMap: Record<string, Product>; customers: Customer[]; users: User[]; onClose: () => void; format: 'A4' | 'thermal'; }> = ({ sale, productMap, customers, users, onClose, format }) => {
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [receiptTerms, setReceiptTerms] = useState<ReceiptTermParameter[]>([]);
    const [warranties, setWarranties] = useState<WarrantyParameter[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [info, terms, warrantyList] = await Promise.all([
                    getCompanyInfo(),
                    getReceiptTerms(),
                    getWarranties()
                ]);
                setCompanyInfo(info);
                setReceiptTerms(terms);
                setWarranties(warrantyList);
            } catch (error) {
                console.error("Failed to load receipt data", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const customer = useMemo(() => customers.find(c => c.id === sale.customerId), [customers, sale.customerId]);
    const salesperson = useMemo(() => users.find(u => u.id === sale.salespersonId), [users, sale.salespersonId]);
    // Total paid must include the base value + fees for each payment
    const totalPaid = useMemo(() => sale.payments.reduce((sum, p) => sum + p.value + (p.fees || 0), 0), [sale.payments]);
    const totalFees = useMemo(() => sale.payments.reduce((sum, p) => sum + (p.fees || 0), 0), [sale.payments]);
    const totalItems = useMemo(() => sale.items.reduce((sum, i) => sum + i.quantity, 0), [sale.items]);

    const activeTerm = useMemo(() => {
        const defaultTerm = receiptTerms.find(t => t.name === 'IPHONE SEMINOVO');
        return receiptTerms.find(t => t.name === sale.warrantyTerm) || defaultTerm;
    }, [receiptTerms, sale.warrantyTerm]);

    const handlePrint = () => {
        // Use a small timeout to ensure UI state is stable before printing, 
        // which helps with mobile browsers triggers.
        setTimeout(() => {
            window.print();
        }, 100);
    };

    const layoutProps = { sale, productMap, customer, salesperson, companyInfo, activeTerm, totalPaid, totalItems, totalFees, warranties };

    return createPortal(
        <div id="print-modal-overlay" className="fixed inset-0 lg:inset-0 bg-black bg-opacity-70 flex justify-center items-start z-[200] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] px-2 sm:p-4 lg:py-8 print:inset-0 print:p-0 print:bg-white overflow-y-auto">
            <style>
                {`
                    @media print {
                        /* Reset everything */
                        html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            height: auto !important;
                            min-height: 100% !important;
                            width: 100% !important;
                            min-width: auto !important;
                            overflow: visible !important;
                            background: white !important;
                            font-size: 9pt !important;
                        }
                        
                        /* Hide everything by default */
                        body * {
                            visibility: hidden;
                        }
                        
                        /* Exception for print container and its children */
                        #print-container, 
                        #print-container * {
                            visibility: visible !important;
                        }

                        /* Fix for print container on mobile */
                        #print-container {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: white !important;
                            box-shadow: none !important;
                            border: none !important;
                            border-radius: 0 !important;
                            display: block !important;
                            max-width: none !important;
                        }

                        /* Override specific elements inside if needed */
                        .print-content-wrapper {
                            padding: 4mm !important;
                            margin: 0 !important;
                            background: white !important;
                            box-shadow: none !important;
                        }
                        
                        /* Ensure text colors are printed */
                        * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        
                        .no-print { 
                            display: none !important; 
                        }

                        ${format === 'thermal' ? `
                            @page { size: 80mm auto; margin: 2mm; }
                            .receipt-body { font-size: 9pt !important; color: black !important; width: 100%; }
                        ` : `
                            @page { 
                                size: A4 portrait; 
                                margin: 6mm 8mm;
                            }
                            
                            .receipt-body { 
                                font-size: 8pt !important;
                                color: black !important; 
                                width: 100% !important;
                                max-width: 100% !important;
                                margin: 0 !important;
                                padding: 0 !important;
                                box-sizing: border-box !important;
                                overflow: visible !important;
                                min-height: auto !important;
                                page-break-inside: avoid !important;
                            }
                            
                            /* Reduce spacing for compact print */
                            .receipt-body section {
                                margin-top: 2mm !important;
                                margin-bottom: 2mm !important;
                            }
                            
                            .receipt-body table {
                                font-size: 7pt !important;
                            }
                            
                            .receipt-body h1 {
                                font-size: 12pt !important;
                            }
                            
                            .receipt-body h2 {
                                font-size: 10pt !important;
                                margin: 2mm 0 !important;
                            }
                            
                            .receipt-body h3 {
                                font-size: 8pt !important;
                            }
                            
                            /* Compact header */
                            .receipt-body header img {
                                height: 12mm !important;
                                width: 12mm !important;
                            }
                            
                            /* Prevent page break inside important sections */
                            .receipt-body > div {
                                page-break-inside: avoid !important;
                            }
                        `}

                        .whitespace-pre-wrap { white-space: pre-wrap; }
                        .columns-2 { columns: 2; column-gap: 6px; }
                        
                        /* Force print color adjust */
                        * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            color-adjust: exact !important;
                        }
                        
                        /* UNIVERSAL: Remove ALL backgrounds except .bg-black */
                        *:not(.bg-black) {
                            background: transparent !important;
                            background-color: transparent !important;
                        }
                        
                        /* White background only on main containers */
                        html, body, #print-modal-overlay, #print-container {
                            background: white !important;
                            background-color: white !important;
                        }
                        
                        /* Remove flex-1 behavior that causes extra space */
                        #print-container {
                            display: block !important;
                            height: auto !important;
                        }
                        
                        /* Content wrapper - remove all extra space */
                        .print-content-wrapper {
                            flex: none !important;
                            height: auto !important;
                            overflow: visible !important;
                        }

                        /* Ensure PAGO section prints with dark background - HIGHEST SPECIFICITY */
                        .bg-black,
                        div.bg-black,
                        #print-container .bg-black,
                        .receipt-body .bg-black {
                            background-color: #000 !important;
                            background: #000 !important;
                            color: #fff !important;
                        }
                        
                        /* Fix footer to not push content */
                        .receipt-body .mt-auto {
                            margin-top: 4mm !important;
                            padding-top: 2mm !important;
                        }
                    }
                `}
            </style>
            <div className={`bg-white shadow-xl w-full ${format === 'A4' ? 'max-w-[210mm]' : 'max-w-sm'} flex flex-col max-h-full print:max-h-none print:h-auto rounded-3xl print:rounded-none overflow-hidden print:overflow-visible`} id="print-container">
                <div className="flex justify-between items-center p-3 sm:p-4 border-b border-border no-print shrink-0 bg-white">
                    <h2 className="text-lg sm:text-2xl font-bold text-primary truncate">Recibo da Venda #{sale.id}</h2>
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <button onClick={handlePrint} className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-primary text-white rounded-xl text-xs sm:text-sm hover:bg-opacity-90">
                            <PrinterIcon className="h-4 w-4 sm:h-5 sm:w-5" /> Imprimir
                        </button>
                        <button onClick={onClose} className="p-1 text-muted hover:text-danger"><CloseIcon className="h-6 w-6" /></button>
                    </div>
                </div>
                <div className="p-2 sm:p-4 print:p-0 overflow-y-auto flex-1 print-content-wrapper bg-white">
                    {loading ? <div className="flex justify-center items-center h-64"><SpinnerIcon /></div> : (
                        format === 'A4' ? <A4Layout {...layoutProps} /> : <ThermalLayout {...layoutProps} />
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SaleReceiptModal;
