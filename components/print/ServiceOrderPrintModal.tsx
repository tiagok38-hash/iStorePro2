import React, { useId, useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ServiceOrder, CompanyInfo, Product, Customer, ChecklistItemParameter, ReceiptTermParameter } from '../../types.ts';
import { formatCurrency, getCompanyInfo, getCustomers, getChecklistItems } from '../../services/mockApi.ts';
import { getOsReceiptTerms } from '../../services/parametersService.ts';
import { CloseIcon, PrinterIcon, SpinnerIcon, WhatsAppIcon } from '../icons.tsx';
import { openWhatsApp } from '../../utils/whatsappUtils.ts';
import { calculateWarrantyExpiry, formatDateBR } from '../../utils/dateUtils.ts';

// Format CNPJ: 22.333.930/0001-08
const formatCNPJ = (cnpj?: string): string => {
    if (!cnpj) return '-';
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return cnpj;
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

const formatDoc = (doc?: string): string => {
    if (!doc) return '-';
    const digits = doc.replace(/\D/g, '');
    if (digits.length === 11) {
        return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return doc;
};

// Helper: extracts only the checked items from the OS checklist, resolving UUIDs to names
const getCheckedItems = (checklist: any, checklistItemsMap: Record<string, string>): { id: string; name: string }[] => {
    if (!checklist || typeof checklist !== 'object') return [];
    const skipKeys = ['othersDescription', 'notes', 'services', 'checklistDate', 'repairCost'];
    const items: { id: string; name: string }[] = [];
    for (const [key, value] of Object.entries(checklist)) {
        if (skipKeys.includes(key)) continue;
        if (value === true) {
            // Resolve UUID to human-readable name using the map, fallback to key itself
            const displayName = checklistItemsMap[key] || key;
            // Skip if the name still looks like a UUID (not resolved)
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(displayName);
            if (!isUUID) {
                items.push({ id: key, name: displayName });
            }
        }
    }
    // Handle "Outros" with description
    if (checklist.others && checklist.othersDescription) {
        const idx = items.findIndex(i => i.id === 'others');
        if (idx >= 0) {
            items[idx].name = `Outros: ${checklist.othersDescription}`;
        }
    }
    return items;
};


interface Props {
    serviceOrder: ServiceOrder & { attendantName?: string; estimatedDate?: string; color?: string };
    onClose: () => void;
    initialFormat?: 'A4' | 'thermal';
}

const A4Layout: React.FC<{ os: Props['serviceOrder']; companyInfo: CompanyInfo | null; customerInfo: Customer | null; checklistItemsMap: Record<string, string>; receiptTerm: ReceiptTermParameter | null }> = ({ os, companyInfo, customerInfo, checklistItemsMap, receiptTerm }) => {
    return (
        <div className="font-sans text-black receipt-body bg-white text-xs">
            {/* Header */}
            <header className="flex justify-between items-start pb-2 border-b-2 border-primary">
                <div className="flex items-center gap-4">
                    {companyInfo?.logoUrl && <img src={companyInfo.logoUrl} alt={companyInfo.name || ''} className="h-20 w-auto object-contain" />}
                    <div>
                        <h1 className="font-bold text-xl leading-tight text-primary uppercase">{companyInfo?.name || 'Assistência Técnica'}</h1>
                        <p className="text-[10px] leading-tight mt-1 text-gray-700">CNPJ: {formatCNPJ(companyInfo?.cnpj)}</p>
                        <p className="text-[10px] leading-tight text-gray-700">{companyInfo?.address}{companyInfo?.numero ? `, ${companyInfo.numero}` : ''} - {companyInfo?.bairro}</p>
                        <p className="text-[10px] leading-tight text-gray-700">{companyInfo?.city} ({companyInfo?.state})</p>
                        <p className="text-[10px] leading-tight mt-1">
                            {companyInfo?.whatsapp && <span className="mr-3">WhatsApp: {companyInfo.whatsapp}</span>}
                            {companyInfo?.email && <span>Email: {companyInfo.email}</span>}
                        </p>
                        <p className="text-[10px] leading-tight">Atendente: {os.attendantName || '-'}</p>
                        <p className="text-[10px] leading-tight">Responsável: {os.responsibleName || '-'}</p>
                    </div>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                    <div className="bg-gray-100 p-2 rounded-lg border border-gray-300">
                        <p className="font-black text-lg text-primary uppercase">N° OS: {os.displayId}</p>
                    </div>
                    <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(`${window.location.origin}/#/os/track/${os.id}`)}`}
                        alt="QR Code OS"
                        className="w-12 h-12"
                    />
                    <p className="text-[10px] font-medium mt-1">Emissão: {new Date(os.createdAt).toLocaleDateString('pt-BR')} {new Date(os.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
            </header>

            {/* CLIENT */}
            <section className="mt-3">
                <h2 className="font-bold text-[11px] mb-1 bg-gray-100 py-1 px-2 border border-gray-200">CLIENTE</h2>
                <div className="grid grid-cols-4 gap-2 text-[10px] px-2">
                    <div className="col-span-2"><span className="font-semibold text-gray-700">Nome:</span> {os.customerName}</div>
                    <div><span className="font-semibold text-gray-700">Celular:</span> {customerInfo?.phone || '-'}</div>
                    <div><span className="font-semibold text-gray-700">CPF/CNPJ:</span> {formatDoc(customerInfo?.cpf) || '-'}</div>
                    <div className="col-span-4"><span className="font-semibold text-gray-700">Email:</span> {customerInfo?.email || '-'}</div>
                </div>
            </section>

            {/* DEVICE & OS INFO */}
            <section className="mt-3">
                <h2 className="font-bold text-[11px] mb-1 bg-gray-100 py-1 px-2 border border-gray-200">APARELHO E STATUS</h2>
                <div className="grid grid-cols-4 gap-2 text-[10px] px-2 mb-2">
                    <div className="col-span-2"><span className="font-semibold text-gray-700">Modelo:</span> {os.deviceModel} {os.color ? ` - ${os.color}` : ''}</div>
                    <div className="col-span-2"><span className="font-semibold text-gray-700">Serial/IMEI:</span> {os.serialNumber || os.imei || '-'}</div>
                    <div><span className="font-semibold text-gray-700">Senha/Padrão:</span> {os.passcode ? '***' : (os.patternLock && os.patternLock.length > 0 ? 'Padrão Cadastrado' : 'Não Informada')}</div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-[10px] border-t border-gray-200 pt-2 px-2">
                    <div><span className="font-semibold text-gray-700">Status OS:</span> <span className="font-bold uppercase">{os.status}</span></div>
                    <div><span className="font-semibold text-gray-700">Data Inicial:</span> {new Date(os.entryDate).toLocaleDateString('pt-BR')}</div>
                    <div><span className="font-semibold text-gray-700">Data Final:</span> {os.estimatedDate ? new Date(os.estimatedDate).toLocaleDateString('pt-BR') : '-'}</div>
                    <div><span className="font-semibold text-gray-700">Garantia:</span> {os.status === 'Entregue' ? 'Ativa' : 'Sobre Peças/Serviços'}</div>
                </div>
            </section>

            {/* CHECKLIST - Dynamic: shows only checked items */}
            {(() => {
                const checkedItems = getCheckedItems(os.checklist, checklistItemsMap);
                return checkedItems.length > 0 ? (
                    <section className="mt-3">
                        <h2 className="font-bold text-[11px] mb-1 bg-gray-100 py-1 px-2 border border-gray-200">CHECKLIST DE ENTRADA</h2>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-2 text-[10px] mb-2">
                            {checkedItems.map(item => (
                                <div key={item.id} className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 border-2 border-gray-800 rounded-sm inline-flex items-center justify-center text-gray-800 font-bold" style={{ fontSize: '9px', lineHeight: 1 }}>✓</span>
                                    <span className="font-semibold text-gray-800">{item.name}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                ) : null;
            })()}

            {/* DEFECTS & OBS */}
            <section className="mt-4">
                <h2 className="font-bold text-[12px] mb-2 bg-gray-100 py-1.5 px-2 border border-gray-200">DEFEITO E OBSERVAÇÕES</h2>
                <div className="px-2 space-y-3 text-[12px]">
                    <div><span className="font-bold text-gray-700 block mb-0.5">DEFEITO RELATADO:</span> {os.defectDescription || '-'}</div>
                    {os.attendantObservations && (
                        <div><span className="font-bold text-gray-700 block mb-0.5">OBSERVAÇÕES DO ATENDIMENTO:</span> {os.attendantObservations}</div>
                    )}
                    {os.technicalReport && (
                        <div><span className="font-bold text-gray-700 block mb-0.5">LAUDO TÉCNICO:</span> {os.technicalReport}</div>
                    )}
                </div>
            </section>

            {/* PRODUCTS & SERVICES */}
            <section className="mt-3">
                <h2 className="font-bold text-[11px] mb-1 bg-gray-100 py-1 px-2 border border-gray-200">PRODUTOS E SERVIÇOS</h2>
                <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                        <tr className="border-b-2 border-gray-300">
                            <th className="py-1 px-2">Qtd</th>
                            <th className="py-1 px-2">Descrição</th>
                            <th className="py-1 px-2">Garantia</th>
                            <th className="py-1 px-2 text-right">Preço Unit.</th>
                            <th className="py-1 px-2 text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {os.items.length > 0 ? os.items.map((item, index) => {
                            const expiryDate = (item.warranty && os.exitDate) ? calculateWarrantyExpiry(os.exitDate, item.warranty) : null;
                            return (
                                <tr key={item.id || index} className="border-b border-gray-100">
                                    <td className="py-1 px-2">{item.quantity}</td>
                                    <td className="py-1 px-2">{item.description}</td>
                                    <td className="py-1 px-2 text-[9px]">
                                        {item.warranty ? (
                                            <div className="flex flex-col">
                                                <span>{item.warranty}</span>
                                                {expiryDate && <span className="font-bold text-emerald-600">Até {formatDateBR(expiryDate)}</span>}
                                            </div>
                                        ) : '-'}
                                    </td>
                                    <td className="py-1 px-2 text-right">{formatCurrency(item.price)}</td>
                                    <td className="py-1 px-2 text-right font-medium">{formatCurrency(item.price * item.quantity)}</td>
                                </tr>
                            );
                        }) : (
                            <tr><td colSpan={4} className="text-center py-2 italic text-gray-500">Nenhum item adicionado à OS.</td></tr>
                        )}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="flex flex-col items-end mt-2 pr-2 text-[10px]">
                    <div className="flex w-48 justify-between mt-1"><span className="text-gray-600">Subtotal:</span> {formatCurrency(os.subtotal)}</div>
                    {os.discount > 0 && (
                        <div className="flex w-48 justify-between mt-1"><span className="text-gray-600">Desconto:</span> {formatCurrency(os.discount)}</div>
                    )}
                    <div className="flex w-64 justify-between mt-2 pt-2 border-t-2 border-gray-800 text-sm font-black uppercase">
                        <span>Valor Total da OS:</span> <span>{formatCurrency(os.total)}</span>
                    </div>
                </div>

                {os.payments && os.payments.length > 0 && os.status === 'Entregue' && (
                    <div className="flex flex-col items-end mt-2 pr-2 text-[10px]">
                        <span className="font-bold text-gray-700 uppercase mb-1">Formas de Pagamento</span>
                        {os.payments.map((p, idx) => (
                            <div key={idx} className="flex w-48 justify-between text-[9px]">
                                <span className="text-gray-600 truncate mr-2">{p.card || p.method} {p.installments ? `(${p.installments}x)` : ''}</span>
                                <span>{formatCurrency(p.value)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {receiptTerm && (receiptTerm.warrantyTerm?.showOnReceipt || receiptTerm.warrantyExclusions?.showOnReceipt || receiptTerm.imageRights?.showOnReceipt) && (
                <section className="mt-4 border-t border-gray-200 pt-2 text-[10px]">
                    <h2 className="font-bold text-[11px] mb-1">TERMO DE GARANTIA E RESPONSABILIDADE</h2>
                    {receiptTerm.warrantyTerm?.showOnReceipt && receiptTerm.warrantyTerm.content && (
                        <div className="mb-2 whitespace-pre-wrap"><strong>Termo:</strong> {receiptTerm.warrantyTerm.content}</div>
                    )}
                    {receiptTerm.warrantyExclusions?.showOnReceipt && receiptTerm.warrantyExclusions.content && (
                        <div className="mb-2 whitespace-pre-wrap"><strong>Exclusões:</strong> {receiptTerm.warrantyExclusions.content}</div>
                    )}
                    {receiptTerm.imageRights?.showOnReceipt && receiptTerm.imageRights.content && (
                        <div className="mb-2 whitespace-pre-wrap"><strong>Direitos de Imagem:</strong> {receiptTerm.imageRights.content}</div>
                    )}
                </section>
            )}

            <section className="mt-4 border-t border-gray-200 pt-2 text-center text-[8px] text-gray-500">
                Os equipamentos não retirados dentro de 90 dias após a conclusão do serviço poderão ser descartados ou vendidos para custear despesas, conforme legislação vigente. A garantia não cobre danos físicos, contato com líquidos ou mau uso após o reparo. Equipamentos recebidos desligados ou inoperantes impossibilitam testes completos, isentando a loja de responsabilidade sobre vícios ocultos.
            </section>

            {/* SIGNATURES */}
            <section className="mt-8 flex items-end justify-between px-8 text-[10px] text-center">
                <div className="w-1/4 text-left pb-[14px]">
                    <span>Data: ____/____/________</span>
                </div>
                <div className="w-[30%]">
                    <div className="border-t border-black pt-1">Assinatura do Cliente</div>
                </div>
                <div className="w-[30%] ml-4">
                    <div className="border-t border-black pt-1">Assinatura do Técnico Responsável</div>
                </div>
            </section>

            {/* System Promo Footer */}
            <div className="mt-8 text-center border-t border-gray-100 pt-2" style={{ fontSize: '9px', color: '#9ca3af' }}>
                <p>iStore Pro - O melhor sistema para sua loja de eletronicos. Saiba mais em istorepro.com.br</p>
            </div>
        </div>
    );
};

const ThermalLayout: React.FC<{ os: Props['serviceOrder']; companyInfo: CompanyInfo | null; customerInfo: Customer | null; checklistItemsMap: Record<string, string>; receiptTerm: ReceiptTermParameter | null }> = ({ os, companyInfo, customerInfo, checklistItemsMap, receiptTerm }) => {
    return (
        <div className="w-[80mm] mx-auto p-2 bg-white text-black font-mono font-bold text-[12px] receipt-body [&_*]:font-bold leading-tight" id="receipt-content">
            <div className="text-center space-y-1 pb-1">
                {companyInfo?.logoUrl && <img src={companyInfo.logoUrl} alt="Logo" className="h-16 mx-auto object-contain max-w-full grayscale" />}
                <p className="text-sm uppercase">{companyInfo?.name || 'ASSISTÊNCIA TÉCNICA'}</p>
                <p className="text-[11px]">CNPJ: {formatCNPJ(companyInfo?.cnpj)}</p>
                <p className="text-[11px] break-words">{companyInfo?.address}{companyInfo?.numero ? `, ${companyInfo.numero}` : ''}</p>
                <p className="text-[11px]">{companyInfo?.city} - {companyInfo?.state}</p>
                <p className="text-[11px]">Fone: {companyInfo?.whatsapp || companyInfo?.phone || '-'}</p>
            </div>

            <div className="border-t-2 border-dashed border-black my-2"></div>

            <div className="flex justify-between text-[13px]">
                <p>N° OS: {os.displayId}</p>
                <p>Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
            </div>

            <div className="border-t-2 border-dashed border-black my-2"></div>

            <div className="space-y-1">
                <p><span>Cliente:</span> {os.customerName}</p>
                <p><span>Celular:</span> {customerInfo?.phone || '-'}</p>
                <p><span>Atendente:</span> {os.attendantName || '-'}</p>
            </div>

            <div className="border-t border-dashed border-black my-2"></div>

            <div className="space-y-1">
                <p><span>Desc/Mod:</span> {os.deviceModel} {os.color ? `(${os.color})` : ''}</p>
                <p><span>SN/IMEI:</span> {os.serialNumber || os.imei || '-'}</p>
            </div>

            <div className="border-t border-dashed border-black my-2"></div>

            {/* Checklist - Dynamic: shows only checked items */}
            {(() => {
                const checkedItems = getCheckedItems(os.checklist, checklistItemsMap);
                return checkedItems.length > 0 ? (
                    <div>
                        <p className="mb-1">Checklist:</p>
                        <div className="grid grid-cols-2 gap-y-1 text-[11px]">
                            {checkedItems.map(item => (
                                <div key={item.id} className="flex items-center gap-1">
                                    <span>[✓]</span>
                                    <span>{item.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null;
            })()}

            <div className="border-t border-dashed border-black my-2"></div>

            <div className="space-y-1">
                <p><span>Status:</span> {os.status}</p>
                <div className="flex justify-between">
                    <p><span>Entrada:</span> {new Date(os.entryDate).toLocaleDateString('pt-BR')}</p>
                    {os.exitDate && (
                        <p><span>Saída:</span> {new Date(os.exitDate).toLocaleDateString('pt-BR')}</p>
                    )}
                </div>
            </div>

            <div className="border-t border-dashed border-black my-2"></div>

            <div className="space-y-2 text-[13px]">
                <p><span className="block">Defeito:</span> {os.defectDescription || '-'}</p>
                {os.attendantObservations && <p><span className="block">Obs:</span> {os.attendantObservations}</p>}
                {os.technicalReport && <p><span className="block">Laudo:</span> {os.technicalReport}</p>}
            </div>

            <div className="border-t-2 border-dashed border-black my-2"></div>

            <p className="text-center mb-1">PRODUTOS E SERVIÇOS</p>

            <div className="space-y-1">
                {os.items.length > 0 ? os.items.map((item, i) => {
                    const expiryDate = (item.warranty && os.exitDate) ? calculateWarrantyExpiry(os.exitDate, item.warranty) : null;
                    return (
                        <div key={item.id || i} className="mb-1 text-[11px]">
                            <p className="truncate">{item.description}</p>
                            <div className="flex justify-between">
                                <span>{item.quantity} x {formatCurrency(item.price)}</span>
                                <div className="text-right">
                                    {item.warranty && (
                                        <p className="text-[10px] uppercase">Garantia: {item.warranty} {expiryDate ? `(${formatDateBR(expiryDate)})` : ''}</p>
                                    )}
                                    <span>{formatCurrency(item.price * item.quantity)}</span>
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <p className="text-center italic">Nenhum item adicionado.</p>
                )}
            </div>

            <div className="border-t border-dashed border-black my-2"></div>

            <div className="space-y-0.5">
                {os.discount > 0 && <div className="flex justify-between"><span>SUBTOTAL:</span><span>{formatCurrency(os.subtotal)}</span></div>}
                {os.discount > 0 && <div className="flex justify-between"><span>DESC:</span><span>{formatCurrency(os.discount)}</span></div>}
                <div className={`flex justify-between text-[15px] ${os.discount > 0 ? 'mt-1 pt-1 border-t border-dashed border-black' : ''}`}>
                    <span>TOTAL OS:</span><span>{formatCurrency(os.total)}</span>
                </div>
            </div>

            {os.payments && os.payments.length > 0 && os.status === 'Entregue' && (
                <div className="mt-2 text-[11px]">
                    <p className="border-b border-dashed border-black mb-1">PAGAMENTO(S)</p>
                    {os.payments.map((p, idx) => (
                        <div key={idx} className="flex justify-between">
                            <span className="truncate mr-2">{p.card || p.method} {p.installments ? `(${p.installments}x)` : ''}</span>
                            <span>{formatCurrency(p.value)}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-8 text-center px-4">
                <div className="border-t border-black mb-1 mx-auto w-3/4"></div>
                <p>{os.customerName || 'Assinatura do Cliente'}</p>
            </div>

            <div className="mt-4 flex flex-col items-center gap-1">
                <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`${window.location.origin}/#/os/track/${os.id}`)}`}
                    alt="QR Code OS"
                    className="w-24 h-24 grayscale"
                />
                <p className="text-[10px]">ACOMPANHE SEU REPARO</p>
            </div>

            {receiptTerm && (receiptTerm.warrantyTerm?.showOnReceipt || receiptTerm.warrantyExclusions?.showOnReceipt || receiptTerm.imageRights?.showOnReceipt) && (
                <div className="mt-4 pt-4 border-t-2 border-dashed border-black text-justify text-[11px]">
                    {receiptTerm.warrantyTerm?.showOnReceipt && receiptTerm.warrantyTerm.content && (
                        <div className="mb-2 whitespace-pre-wrap"><span className="uppercase">Termo:</span> {receiptTerm.warrantyTerm.content}</div>
                    )}
                    {receiptTerm.warrantyExclusions?.showOnReceipt && receiptTerm.warrantyExclusions.content && (
                        <div className="mb-2 whitespace-pre-wrap"><span className="uppercase">Exclusões:</span> {receiptTerm.warrantyExclusions.content}</div>
                    )}
                    {receiptTerm.imageRights?.showOnReceipt && receiptTerm.imageRights.content && (
                        <div className="mb-2 whitespace-pre-wrap"><span className="uppercase">Direitos de Imagem:</span> {receiptTerm.imageRights.content}</div>
                    )}
                </div>
            )}

            <div className="mt-4 pt-2 border-t-2 border-dashed border-black text-justify" style={{ fontSize: '10px' }}>
                <p>Equipamentos não retirados em até 90 dias poderão ser vendidos ou descartados. Aparelhos inoperantes isentam a loja de responsabilidade por vícios ocultos. A garantia perde a validade em casos de mau uso, tela quebrada ou contato com líquidos.</p>
            </div>

            <div className="mt-4 text-center text-[9px] text-[#6b7280]">
                <p>iStore Pro - O melhor sistema para sua loja de eletrônicos. Saiba mais em istorepro.com.br</p>
            </div>
        </div>
    );
};

const ServiceOrderPrintModal: React.FC<Props> = ({ serviceOrder, onClose, initialFormat = 'thermal' }) => {
    const uniqueId = useId().replace(/:/g, '');
    const [format, setFormat] = useState<'A4' | 'thermal'>(initialFormat);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [customerInfo, setCustomerInfo] = useState<Customer | null>(null);
    const [checklistItemsMap, setChecklistItemsMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [receiptTerm, setReceiptTerm] = useState<ReceiptTermParameter | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [info, checklistItems, receiptTermsData] = await Promise.all([
                    getCompanyInfo(),
                    getChecklistItems(),
                    getOsReceiptTerms()
                ]);
                setCompanyInfo(info);

                // Build UUID -> name map for checklist items
                const itemsMap: Record<string, string> = {};
                if (checklistItems && Array.isArray(checklistItems)) {
                    checklistItems.forEach((item: ChecklistItemParameter) => {
                        itemsMap[item.id] = item.name;
                    });
                }
                setChecklistItemsMap(itemsMap);

                if (serviceOrder.receiptTermId && receiptTermsData) {
                    const term = receiptTermsData.find((t: any) => t.id === serviceOrder.receiptTermId);
                    if (term) setReceiptTerm(term);
                }

                // Fetch customer details if id is available
                if (serviceOrder.customerId) {
                    const customersArr = await getCustomers();
                    const cust = customersArr.find(c => c.id === serviceOrder.customerId);
                    if (cust) setCustomerInfo(cust);
                }
            } catch (error) {
                console.error("Failed to load OS receipt data", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [serviceOrder]);

    const handlePrint = () => {
        setTimeout(() => {
            window.print();
        }, 100);
    };

    return createPortal(
        <div id={`print-modal-overlay-${uniqueId}`} className="fixed inset-0 lg:inset-0 bg-black bg-opacity-70 flex justify-center items-start z-[300000] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] px-2 sm:p-4 lg:py-8 print:inset-0 print:p-0 print:bg-white overflow-y-auto">
            <style>
                {`
                    @media print {
                        ${format === 'thermal' ? `
                            @page { size: 80mm auto; margin: 0; }
                        ` : `
                            @page { size: A4 portrait; margin: 10mm 12mm; }
                        `}
                        html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 100% !important;
                            background: white !important;
                            height: auto !important;
                            min-height: 0 !important;
                            max-height: none !important;
                            overflow: visible !important;
                        }
                        body > * { display: none !important; }
                        body > div:last-child { display: block !important; }
                        .no-print { display: none !important; }

                        #print-modal-overlay-${uniqueId} {
                            position: static !important;
                            display: flex !important;
                            justify-content: center !important;
                            width: 100% !important;
                            height: auto !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            background: white !important;
                            overflow: visible !important;
                            inset: auto !important;
                        }

                        #print-container-${uniqueId} {
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

                        .print-content-wrapper {
                            display: block !important;
                            flex: none !important;
                            width: 100% !important;
                            height: auto !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            overflow: visible !important;
                            background: white !important;
                        }

                        .receipt-body {
                            display: block !important;
                            width: 100% !important;
                            max-width: ${format === 'thermal' ? '80mm' : 'none'} !important;
                            height: auto !important;
                            margin: 0 auto !important;
                            padding: ${format === 'thermal' ? '4mm' : '0'} !important;
                            overflow: visible !important;
                            color: black !important;
                            background: white !important;
                        }

                        * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            color-adjust: exact !important;
                        }
                    }
                `}
            </style>

            <div className={`bg-white shadow-xl w-full flex flex-col max-h-full print:max-h-none print:h-auto rounded-3xl print:rounded-none overflow-hidden print:overflow-visible transition-all ${format === 'A4' ? 'max-w-4xl' : 'max-w-sm'}`} id={`print-container-${uniqueId}`}>
                <div className="p-3 sm:p-4 border-b border-border no-print shrink-0 bg-white shadow-sm z-10 sticky top-0 flex flex-col gap-3">
                    <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <h2 className="font-bold text-primary truncate text-lg sm:text-xl">Imprimir OS #{serviceOrder.displayId}</h2>
                            <div className="flex p-0.5 bg-gray-100 rounded-lg shrink-0 border border-gray-200">
                                <button
                                    onClick={() => setFormat('thermal')}
                                    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all ${format === 'thermal' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:text-gray-800 hover:bg-white/50'}`}
                                >
                                    Térmica 80mm
                                </button>
                                <button
                                    onClick={() => setFormat('A4')}
                                    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all ${format === 'A4' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:text-gray-800 hover:bg-white/50'}`}
                                >
                                    Folha A4
                                </button>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-500 hover:text-danger transition-colors shrink-0">
                            <CloseIcon className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => {
                                const trackingUrl = `${window.location.origin}/#/os/track/${serviceOrder.id}`;
                                const message = `Olá ${serviceOrder.customerName}! Sua Ordem de Serviço *OS-${serviceOrder.displayId}* (${serviceOrder.deviceModel}) está com o status: *${serviceOrder.status}*.\n\nAcompanhe seu reparo em tempo real aqui: ${trackingUrl}`;
                                const phone = customerInfo?.phone?.replace(/\D/g, '') || '';
                                openWhatsApp(customerInfo?.phone || '', message);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-md hover:scale-105 transition-transform active:scale-95"
                        >
                            <WhatsAppIcon className="h-4 w-4" /> ENVIAR WHATSAPP
                        </button>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold shadow-md hover:scale-105 transition-transform active:scale-95">
                            <PrinterIcon className="h-4 w-4" /> IMPRIMIR AGORA
                        </button>
                    </div>
                </div>

                <div className="p-2 sm:p-4 print:p-0 overflow-y-auto flex-1 print-content-wrapper bg-gray-50 print:bg-white flex justify-center w-full">
                    {loading ? (
                        <div className="flex justify-center items-center h-64 w-full">
                            <SpinnerIcon className="h-8 w-8 text-primary animate-spin" />
                        </div>
                    ) : (
                        <div className={`shadow-xl ring-1 ring-gray-900/5 print:shadow-none print:ring-0 bg-white ${format === 'A4' ? 'w-[210mm] min-h-[297mm] p-8' : 'w-[80mm] p-2'}`}>
                            {format === 'A4' ? (
                                <A4Layout os={serviceOrder} companyInfo={companyInfo} customerInfo={customerInfo} checklistItemsMap={checklistItemsMap} receiptTerm={receiptTerm} />
                            ) : (
                                <ThermalLayout os={serviceOrder} companyInfo={companyInfo} customerInfo={customerInfo} checklistItemsMap={checklistItemsMap} receiptTerm={receiptTerm} />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ServiceOrderPrintModal;
