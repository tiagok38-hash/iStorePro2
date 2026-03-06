import React, { useState, useEffect } from 'react';
import { X, CreditCard, CheckCircle2, Printer, MessageCircle, DollarSign, Check, Loader2 } from 'lucide-react';
import { WhatsAppIcon } from './icons';
import { openWhatsApp } from '../utils/whatsappUtils';
import { getOsPaymentMethods, formatCurrency } from '../services/mockApi';

interface PaymentMethod {
    id: string;
    name: string;
    type?: string;
    active?: boolean;
}

interface OSBillingItem {
    id: string;
    description: string;
    price: number;
    quantity: number;
}

interface OSBillingModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Dados da OS para exibição */
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
    };
    /** Chamado quando a OS é faturada com sucesso — deve salvar OS como Entregue */
    onBilled: (paymentMethodId: string, paymentMethodName: string) => Promise<void>;
    /** Callback para abrir impressão */
    onPrint: (format: 'A4' | 'thermal') => void;
}

type ModalStep = 'billing' | 'success';

const OSBillingModal: React.FC<OSBillingModalProps> = ({
    isOpen,
    onClose,
    serviceOrder,
    onBilled,
    onPrint,
}) => {
    const [step, setStep] = useState<ModalStep>('billing');
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [selectedMethodId, setSelectedMethodId] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [loadingMethods, setLoadingMethods] = useState(true);

    // Reset ao abrir
    useEffect(() => {
        if (isOpen) {
            setStep('billing');
            setSelectedMethodId('');
            setIsProcessing(false);
            loadPaymentMethods();
        }
    }, [isOpen]);

    const loadPaymentMethods = async () => {
        setLoadingMethods(true);
        try {
            const methods = await getOsPaymentMethods();
            const active = (methods || []).filter((m: any) => m.active !== false);
            setPaymentMethods(active);
            if (active.length > 0) setSelectedMethodId(active[0].id);
        } catch (err) {
            console.error('Erro ao carregar formas de pagamento OS:', err);
        } finally {
            setLoadingMethods(false);
        }
    };

    const handleConfirmPayment = async () => {
        if (!selectedMethodId) return;
        const method = paymentMethods.find(m => m.id === selectedMethodId);
        setIsProcessing(true);
        try {
            await onBilled(selectedMethodId, method?.name || '');
            setStep('success');
        } catch (err) {
            console.error('Erro ao faturar OS:', err);
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

    const selectedMethod = paymentMethods.find(m => m.id === selectedMethodId);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md animate-fade-in overflow-hidden">

                {/* Header */}
                <div className={`px-6 pt-6 pb-4 ${step === 'success' ? 'bg-gradient-to-br from-emerald-500 to-green-600' : 'bg-gradient-to-br from-violet-600 to-purple-700'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {step === 'success' ? (
                                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                                    <CheckCircle2 size={22} className="text-white" />
                                </div>
                            ) : (
                                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                                    <DollarSign size={22} className="text-white" />
                                </div>
                            )}
                            <div>
                                <h2 className="font-black text-white text-lg leading-none">
                                    {step === 'success' ? 'OS Faturada!' : 'Faturar OS'}
                                </h2>
                                <p className="text-white/70 text-xs mt-0.5">
                                    OS-{serviceOrder.displayId} · {serviceOrder.customerName}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-all"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* STEP 1: BILLING */}
                {step === 'billing' && (
                    <div className="p-6 space-y-5">
                        {/* Resumo da OS */}
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Resumo da OS</p>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Aparelho</span>
                                <span className="font-bold text-gray-800 text-right max-w-[180px] truncate">{serviceOrder.deviceModel}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Serviços/Peças</span>
                                <span className="font-bold text-gray-800">{serviceOrder.items.length} item(s)</span>
                            </div>
                            {serviceOrder.discount > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Desconto</span>
                                    <span className="font-bold text-red-500">- {formatCurrency(serviceOrder.discount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-base border-t border-gray-200 pt-2 mt-2">
                                <span className="font-black text-gray-700">Total a Receber</span>
                                <span className="font-black text-emerald-600 text-lg">{formatCurrency(serviceOrder.total)}</span>
                            </div>
                        </div>

                        {/* Forma de Pagamento */}
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Forma de Pagamento</p>
                            {loadingMethods ? (
                                <div className="flex items-center justify-center py-6 text-gray-400">
                                    <Loader2 size={20} className="animate-spin mr-2" />
                                    <span className="text-sm">Carregando...</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {paymentMethods.map(method => (
                                        <button
                                            key={method.id}
                                            onClick={() => setSelectedMethodId(method.id)}
                                            className={`flex items-center justify-between gap-2 px-3 py-3 rounded-xl border-2 text-left transition-all ${selectedMethodId === method.id
                                                ? 'border-violet-500 bg-violet-50 text-violet-800'
                                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <CreditCard size={15} className={selectedMethodId === method.id ? 'text-violet-500' : 'text-gray-400'} />
                                                <span className="text-sm font-bold truncate">{method.name}</span>
                                            </div>
                                            {selectedMethodId === method.id && (
                                                <div className="w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <Check size={12} className="text-white" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Aviso de status automático */}
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3">
                            <CheckCircle2 size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-amber-700 font-medium">
                                Ao faturar, o status da OS será automaticamente alterado para <strong>Entregue</strong>.
                            </p>
                        </div>

                        {/* Botão confirmar */}
                        <button
                            onClick={handleConfirmPayment}
                            disabled={!selectedMethodId || isProcessing || loadingMethods}
                            className="w-full h-13 py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Processando...
                                </>
                            ) : (
                                <>
                                    <DollarSign size={18} />
                                    Confirmar Pagamento {selectedMethod ? `· ${selectedMethod.name}` : ''}
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* STEP 2: SUCCESS — opções de impressão */}
                {step === 'success' && (
                    <div className="p-6 space-y-4">
                        {/* Confirmação */}
                        <div className="text-center py-2">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <CheckCircle2 size={36} className="text-emerald-500" />
                            </div>
                            <p className="font-black text-gray-800 text-xl">Pagamento Confirmado!</p>
                            <p className="text-gray-500 text-sm mt-1">
                                {formatCurrency(serviceOrder.total)} · {selectedMethod?.name}
                            </p>
                            <p className="text-xs text-emerald-600 font-bold mt-2 bg-emerald-50 rounded-xl px-4 py-2 inline-block">
                                ✓ Status alterado para Entregue
                            </p>
                        </div>

                        {/* Opções de impressão */}
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 text-center">
                                Deseja imprimir ou enviar?
                            </p>
                            <div className="grid grid-cols-1 gap-2">
                                <button
                                    onClick={() => { onPrint('A4'); onClose(); }}
                                    className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-left transition-all group"
                                >
                                    <div className="w-9 h-9 bg-gray-100 group-hover:bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                                        <Printer size={18} className="text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="font-black text-gray-800 text-sm">Imprimir Folha A4</p>
                                        <p className="text-gray-400 text-xs">Impressora padrão</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => { onPrint('thermal'); onClose(); }}
                                    className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-left transition-all group"
                                >
                                    <div className="w-9 h-9 bg-blue-50 group-hover:bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                                        <Printer size={18} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="font-black text-gray-800 text-sm">Imprimir Térmica 80mm</p>
                                        <p className="text-gray-400 text-xs">Impressora térmica</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => { handleWhatsApp(); onClose(); }}
                                    className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-[#25D366]/40 hover:border-[#25D366] bg-green-50/50 hover:bg-green-50 text-left transition-all group"
                                >
                                    <div className="w-9 h-9 bg-[#25D366]/20 group-hover:bg-[#25D366]/30 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                                        <WhatsAppIcon size={19} className="text-[#128C7E] fill-[#128C7E]" />
                                    </div>
                                    <div>
                                        <p className="font-black text-gray-800 text-sm">Enviar via WhatsApp</p>
                                        <p className="text-gray-400 text-xs">Mensagem de agradecimento para {serviceOrder.customerName.split(' ')[0]}</p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full py-3 text-gray-400 hover:text-gray-600 text-sm font-bold transition-colors"
                        >
                            Fechar sem imprimir
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OSBillingModal;
