import React, { useState, useEffect } from 'react';
import { X, CreditCard, CheckCircle2, Check, Printer, DollarSign, Loader2, Trash2, User, Wrench, FileText, Lock, MessageSquare } from 'lucide-react';
import { WhatsAppIcon } from './icons';
import { openWhatsApp } from '../utils/whatsappUtils';
import { getOsPaymentMethods, formatCurrency } from '../services/mockApi';
import CurrencyInput from './CurrencyInput';
import CardPaymentModal from './CardPaymentModal';

interface OSBillingItem {
    id: string;
    description: string;
    price: number;
    quantity: number;
    type?: 'service' | 'part' | string;
}

interface Payment {
    id: string;
    method: string;
    type: string;
    card?: string;
    value: number;
    installments?: number;
    installmentsValue?: number;
    feePercentage?: number;
    fees?: number;
    internalNote?: string;
}

interface PaymentMethod {
    id: string;
    name: string;
    type?: string;
    active?: boolean;
}

interface OSBillingModalProps {
    isOpen: boolean;
    onClose: () => void;
    serviceOrder: {
        id: string;
        displayId: number | null;
        customerName: string;
        customerPhone?: string;
        deviceModel: string;
        items: OSBillingItem[];
        subtotal: number;
        discount: number;
        total: number;
        status: string;
        defectDescription?: string;
        technicalReport?: string;
        observations?: string;
        attendantObservations?: string;
        entryDate?: string;
        attendantName?: string;
        responsibleName?: string;
        checklist?: Record<string, boolean | string | undefined>;
        checklistItems?: Array<{ id: string; name: string }>;
    };
    onBilled: (paymentMethodId: string, paymentMethodName: string, payments: Payment[]) => Promise<void>;
    onPrint: (format: 'A4' | 'thermal') => void;
}

type ModalStep = 'billing' | 'success';

const LabelValue: React.FC<{ label: string; value?: string; className?: string }> = ({ label, value, className }) => {
    if (!value) return null;
    return (
        <div className={`flex flex-col min-w-0 ${className || ''}`}>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">{label}</span>
            <span className="text-sm font-bold text-gray-900 truncate leading-snug">{value}</span>
        </div>
    );
};

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
    <div className="flex items-center gap-1.5 mb-2.5 mt-0.5">
        <span className="text-gray-400">{icon}</span>
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{title}</span>
        <div className="flex-1 h-px bg-gray-100 ml-1" />
    </div>
);

const OSBillingModal: React.FC<OSBillingModalProps> = ({
    isOpen,
    onClose,
    serviceOrder,
    onBilled,
    onPrint,
}) => {
    const [step, setStep] = useState<ModalStep>('billing');
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [loadingMethods, setLoadingMethods] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [paymentInput, setPaymentInput] = useState<{ method: string; amount: number } | null>(null);
    const [isCardPaymentModalOpen, setIsCardPaymentModalOpen] = useState(false);

    const totalPaid = payments.reduce((sum, p) => sum + p.value, 0);
    const balance = serviceOrder.total - totalPaid;
    const isFullyPaid = balance <= 0.01;

    useEffect(() => {
        if (isOpen) {
            setStep('billing');
            setPayments([]);
            setPaymentInput(null);
            setIsCardPaymentModalOpen(false);
            setIsProcessing(false);
            loadPaymentMethods();
        }
    }, [isOpen]);

    const loadPaymentMethods = async () => {
        setLoadingMethods(true);
        try {
            const methods = await getOsPaymentMethods();
            const active = (methods || []).filter((m: any) => m.active !== false);
            if (!active.find((m: any) => m.name.toLowerCase().includes('pix'))) {
                active.push({ id: 'pix-sim', name: 'Pix', type: 'pix', active: true });
            }
            if (!active.find((m: any) => m.name.toLowerCase().includes('cartão') || m.name.toLowerCase().includes('cartao'))) {
                active.push({ id: 'cartao-sim', name: 'Cartão', type: 'card', active: true });
            }
            setPaymentMethods(active);
        } catch {
            // silently fail
        } finally {
            setLoadingMethods(false);
        }
    };

    const handleRequestPayment = (method: PaymentMethod) => {
        if (method.name.toLowerCase().includes('cartão') || method.name.toLowerCase().includes('cartao') || method.type === 'card') {
            setIsCardPaymentModalOpen(true);
        } else {
            setPaymentInput({ method: method.name, amount: Math.max(0, balance) });
        }
    };

    const handleConfirmPaymentInput = () => {
        if (!paymentInput || paymentInput.amount <= 0) return;
        setPayments(prev => [...prev, {
            id: `pay-${Date.now()}`,
            method: paymentInput.method,
            type: paymentInput.method,
            value: paymentInput.amount,
        }]);
        setPaymentInput(null);
    };

    const handleConfirmCardPayment = (data: { payment: Payment; feeToAddToSale: number }) => {
        setPayments(prev => [...prev, data.payment]);
        setIsCardPaymentModalOpen(false);
    };

    const handleRemovePayment = (id: string) => setPayments(prev => prev.filter(p => p.id !== id));

    const handleConfirmBilling = async () => {
        if (!isFullyPaid) return;
        setIsProcessing(true);
        try {
            const primary = payments[0] || null;
            await onBilled(primary?.id || '', primary?.method || '', payments);
            setStep('success');
        } catch {
            // handle err
        } finally {
            setIsProcessing(false);
        }
    };

    const handleWhatsApp = () => {
        const msg =
            `✅ *Olá, ${serviceOrder.customerName}!*\n\n` +
            `Sua *OS-${serviceOrder.displayId}* está pronta e foi *entregue* com sucesso! 🎉\n\n` +
            `📱 *Aparelho:* ${serviceOrder.deviceModel}\n` +
            `💰 *Total pago:* ${formatCurrency(serviceOrder.total)}\n\n` +
            `Obrigado pela confiança! Estamos sempre aqui para ajudar. 😊\n` +
            `Qualquer dúvida, é só nos chamar.`;
        openWhatsApp(serviceOrder.customerPhone, msg);
    };

    if (!isOpen) return null;

    const entryStr = serviceOrder.entryDate
        ? new Date(serviceOrder.entryDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : undefined;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

            <div className="relative bg-white w-full max-w-3xl max-h-[95vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-gray-200/80">

                {/* ── HEADER ── */}
                <div className={`flex-shrink-0 flex items-center justify-between px-5 py-3 ${step === 'success' ? 'bg-emerald-600' : 'bg-gray-900'}`}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                            {step === 'success' ? <CheckCircle2 size={16} className="text-white" /> : <DollarSign size={16} className="text-white" />}
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-white leading-none">
                                {step === 'success' ? 'Faturamento Concluído' : 'Faturar Ordem de Serviço'}
                            </h2>
                            <p className="text-white/50 text-[10px] mt-0.5 font-medium">
                                OS #{serviceOrder.displayId} · {serviceOrder.customerName}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* ── SCROLL BODY ── */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50">

                    {step === 'billing' && (
                        <div className="p-4 space-y-3">

                            {/* ── BLOCO 1: IDENTIFICAÇÃO ── */}
                            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                <SectionTitle icon={<User size={11} />} title="Identificação" />

                                {/* Linha 1: OS, Data, Cliente */}
                                <div className="grid grid-cols-3 gap-x-4 gap-y-2.5 mb-2.5">
                                    <LabelValue label="Nº OS" value={`#${serviceOrder.displayId}`} />
                                    <LabelValue label="Entrada" value={entryStr} />
                                    <LabelValue label="Cliente" value={serviceOrder.customerName} />
                                    <LabelValue label="Aparelho" value={serviceOrder.deviceModel} />
                                    <LabelValue label="Atendente" value={serviceOrder.attendantName} />
                                    <LabelValue label="Técnico Resp." value={serviceOrder.responsibleName} />
                                </div>

                                {/* Linha 2: Valores */}
                                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                                    <div className="flex-1">
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Peças & Serviços</span>
                                        <div className="mt-1 space-y-1 max-h-24 overflow-y-auto">
                                            {serviceOrder.items.length === 0 ? (
                                                <p className="text-[11px] text-gray-400 italic">Nenhum item lançado</p>
                                            ) : serviceOrder.items.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between py-0.5">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className={`w-1 h-1 rounded-full flex-shrink-0 ${item.type === 'service' ? 'bg-violet-400' : 'bg-blue-400'}`} />
                                                        <span className="text-[11px] text-gray-700 truncate">{item.description}</span>
                                                        <span className="text-[10px] text-gray-400 flex-shrink-0">×{item.quantity}</span>
                                                    </div>
                                                    <span className="text-[11px] font-bold text-gray-800 ml-2 flex-shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 text-right border-l border-gray-100 pl-4">
                                        {serviceOrder.discount > 0 && (
                                            <>
                                                <div className="text-[10px] text-gray-400">Subtotal <span className="font-bold text-gray-600">{formatCurrency(serviceOrder.subtotal)}</span></div>
                                                <div className="text-[10px] text-red-500">Desconto <span className="font-bold">−{formatCurrency(serviceOrder.discount)}</span></div>
                                            </>
                                        )}
                                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Total</div>
                                        <div className="text-2xl font-black text-gray-900">{formatCurrency(serviceOrder.total)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* ── BLOCO 2: DETALHES DA OS ── */}
                            {(serviceOrder.defectDescription || serviceOrder.technicalReport || serviceOrder.attendantObservations || serviceOrder.observations || (serviceOrder.checklist && serviceOrder.checklistItems)) && (
                                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                    <SectionTitle icon={<Wrench size={11} />} title="Detalhes do Atendimento" />

                                    <div className="space-y-3">
                                        {/* Checklist marcado */}
                                        {serviceOrder.checklist && serviceOrder.checklistItems && (() => {
                                            const markedItems: string[] = [];
                                            serviceOrder.checklistItems!.forEach(item => {
                                                if (serviceOrder.checklist![item.id]) markedItems.push(item.name);
                                            });
                                            // Campos fixos legados
                                            const legacyMap: Record<string, string> = {
                                                scratch: 'Amassado',
                                                cracked_screen: 'Tela Trincada',
                                                dented: 'Mossas',
                                                no_power: 'Não Liga',
                                                no_wifi: 'Sem Wi-Fi',
                                                bad_battery: 'Bateria Ruim',
                                                front_camera_fail: 'Câm. Frontal Ruim',
                                                rear_camera_fail: 'Câm. Traseira Ruim',
                                                no_sound: 'Sem Som',
                                                mic_fail: 'Mic Ruim',
                                            };
                                            Object.entries(legacyMap).forEach(([key, label]) => {
                                                if (serviceOrder.checklist![key] && !markedItems.includes(label)) {
                                                    markedItems.push(label);
                                                }
                                            });
                                            if (serviceOrder.checklist!['others'] && (serviceOrder.checklist!['othersDescription'] as string)) {
                                                markedItems.push(`Outro: ${serviceOrder.checklist!['othersDescription']}`);
                                            }
                                            if (markedItems.length === 0) return null;
                                            return (
                                                <div>
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1.5">
                                                        <CheckCircle2 size={9} className="text-purple-400" /> Estado Físico Marcado
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {markedItems.map((item, i) => (
                                                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-[11px] font-semibold text-purple-700">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                                                                {item}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        {serviceOrder.defectDescription && (
                                            <div>
                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                                                    <FileText size={9} className="text-gray-400" /> Defeito Relatado
                                                </span>
                                                <p className="text-sm font-bold text-gray-800 border-l-2 border-gray-300 pl-2.5 italic leading-relaxed">{serviceOrder.defectDescription}</p>
                                            </div>
                                        )}
                                        {serviceOrder.technicalReport && (
                                            <div>
                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                                                    <FileText size={9} className="text-emerald-400" /> Laudo Técnico
                                                </span>
                                                <p className="text-sm font-bold text-gray-800 border-l-2 border-emerald-300 pl-2.5 italic leading-relaxed">{serviceOrder.technicalReport}</p>
                                            </div>
                                        )}
                                        {serviceOrder.attendantObservations && (
                                            <div>
                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                                                    <MessageSquare size={9} className="text-blue-400" /> Anotações do Atendente
                                                </span>
                                                <p className="text-sm font-semibold text-gray-700 border-l-2 border-blue-200 pl-2.5 leading-relaxed">{serviceOrder.attendantObservations}</p>
                                            </div>
                                        )}
                                        {serviceOrder.observations && (
                                            <div>
                                                <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                                                    <Lock size={9} className="text-amber-400" /> Obs. Internas (não imprimíveis)
                                                </span>
                                                <p className="text-sm font-semibold text-amber-700 border-l-2 border-amber-200 pl-2.5 bg-amber-50/50 rounded-r leading-relaxed">{serviceOrder.observations}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── BLOCO 3: PAGAMENTO ── */}
                            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                <SectionTitle icon={<CreditCard size={11} />} title="Formas de Pagamento" />

                                {/* Botões de método */}
                                {loadingMethods ? (
                                    <div className="flex justify-center py-3">
                                        <Loader2 size={20} className="animate-spin text-gray-400" />
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {paymentMethods.map(m => (
                                            <button
                                                key={m.id}
                                                onClick={() => handleRequestPayment(m)}
                                                disabled={isFullyPaid}
                                                className={`px-4 py-2 rounded-lg border text-xs font-bold transition-all ${isFullyPaid
                                                    ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-900 hover:bg-gray-900 hover:text-white cursor-pointer'
                                                    }`}
                                            >
                                                {m.name}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Input de valor */}
                                {paymentInput && (
                                    <div className="flex items-center gap-2 mb-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                                        <span className="text-[11px] font-bold text-gray-700 flex-shrink-0">{paymentInput.method}</span>
                                        <div className="flex-1">
                                            <CurrencyInput
                                                value={paymentInput.amount}
                                                onChange={v => setPaymentInput({ ...paymentInput, amount: v || 0 })}
                                                className="w-full h-8 px-2.5 text-sm font-bold bg-white border border-gray-200 rounded-md focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none"
                                            />
                                        </div>
                                        <button
                                            onClick={handleConfirmPaymentInput}
                                            className="h-8 px-3 bg-gray-900 hover:bg-gray-800 text-white rounded-md text-[11px] font-bold transition-colors"
                                        >
                                            OK
                                        </button>
                                        <button
                                            onClick={() => setPaymentInput(null)}
                                            className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                )}

                                {/* Lista de pagamentos */}
                                {payments.length > 0 && (
                                    <div className="mb-3 rounded-lg border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                                        {payments.map(p => (
                                            <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-white">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-bold text-gray-900 truncate">{p.card || p.method}</span>
                                                    {p.installments && p.installments > 1 && (
                                                        <span className="text-xs text-gray-400">{p.installments}× de {formatCurrency((p.installmentsValue || p.value / p.installments))}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                                    <span className="text-base font-black text-gray-900">{formatCurrency(p.value)}</span>
                                                    <button
                                                        onClick={() => handleRemovePayment(p.id)}
                                                        className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Barra de saldo */}
                                <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 border text-sm font-black transition-all ${isFullyPaid
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : balance < 0
                                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                                        : 'bg-amber-50 border-amber-200 text-amber-700'
                                    }`}>
                                    <span className="uppercase tracking-widest text-[10px]">
                                        {isFullyPaid ? 'Recebimento completo' : balance < 0 ? 'Troco ao cliente' : 'Valor pendente'}
                                    </span>
                                    <span>{formatCurrency(Math.abs(balance))}</span>
                                </div>

                                {/* Aviso */}
                                <div className="flex items-center gap-2 mt-2.5 text-[10px] text-gray-400">
                                    <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0" />
                                    <span>Ao confirmar, a OS será marcada como <strong className="text-gray-600">Entregue</strong> e lançada no caixa.</span>
                                </div>
                            </div>

                        </div>
                    )}

                    {step === 'success' && (
                        <div className="p-8 flex flex-col items-center justify-center space-y-5">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
                                <CheckCircle2 size={34} className="text-emerald-500" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-black text-gray-900">OS Faturada!</h3>
                                <p className="text-sm text-gray-500 mt-1">Total recebido: <strong className="text-gray-800">{formatCurrency(serviceOrder.total)}</strong></p>
                                <span className="inline-flex items-center gap-1.5 mt-3 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5 border border-emerald-100">
                                    <Check size={12} /> Status atualizado para Entregue
                                </span>
                            </div>

                            <div className="w-full max-w-xs space-y-2 mt-2">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">O que deseja fazer?</p>

                                <button onClick={() => { onPrint('A4'); onClose(); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all text-left">
                                    <Printer size={16} className="text-gray-600 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">Imprimir A4</p>
                                        <p className="text-[10px] text-gray-400">Recibo em folha A4</p>
                                    </div>
                                </button>
                                <button onClick={() => { onPrint('thermal'); onClose(); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all text-left">
                                    <Printer size={16} className="text-blue-500 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">Térmica 80mm</p>
                                        <p className="text-[10px] text-gray-400">Cupom não fiscal</p>
                                    </div>
                                </button>
                                <button onClick={() => { handleWhatsApp(); onClose(); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-green-200 bg-green-50 hover:bg-green-100 transition-all text-left">
                                    <WhatsAppIcon size={16} className="text-[#128C7E] fill-[#128C7E] flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">WhatsApp</p>
                                        <p className="text-[10px] text-gray-500">Notificar {serviceOrder.customerName.split(' ')[0]}</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── FOOTER FIXO ── */}
                {step === 'billing' && (
                    <div className="flex-shrink-0 flex items-center justify-end gap-2.5 px-5 py-3.5 bg-white border-t border-gray-100">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-[11px] font-bold hover:bg-gray-50 transition-all uppercase tracking-widest cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmBilling}
                            disabled={!isFullyPaid || isProcessing}
                            className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer
                                ${isFullyPaid && !isProcessing
                                    ? 'bg-gray-900 hover:bg-gray-800 text-white shadow-md shadow-gray-900/20'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {isProcessing
                                ? <><Loader2 size={14} className="animate-spin" /> Faturando...</>
                                : <><Check size={14} /> Confirmar Faturamento</>
                            }
                        </button>
                    </div>
                )}
            </div>

            {/* Sub-modal de Cartão */}
            {isCardPaymentModalOpen && (
                <CardPaymentModal
                    isOpen={isCardPaymentModalOpen}
                    onClose={() => setIsCardPaymentModalOpen(false)}
                    onConfirm={handleConfirmCardPayment}
                    amountDue={Math.max(0, balance)}
                />
            )}
        </div>
    );
};

export default OSBillingModal;
