import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '../../contexts/UserContext.tsx';
import { useToast } from '../../contexts/ToastContext.tsx';
import {
    ChevronLeftIcon, PlusIcon, SearchIcon, TrashIcon,
    CloseIcon, CreditCardIcon, SuccessIcon, ChartBarIcon, BanknotesIcon,
    WhatsAppIcon, PrinterIcon, DocumentTextIcon
} from '../icons.tsx';
import { getProducts, getCustomers } from '../../services/mockApi.ts';
import { createOrcamento, updateOrcamento } from '../../services/orcamentosService.ts';
import { Product, Customer, OrcamentoItem } from '../../types.ts';
import CurrencyInput from '../CurrencyInput.tsx';
import OrcamentoPrintModal from './OrcamentoPrintModal.tsx';
import { formatCurrency } from '../../services/mockApi.ts';

interface NewOrcamentoViewProps {
    onCancel: () => void;
    onSaved: () => void;
    orcamentoToEdit?: any;
}

const NewOrcamentoView: React.FC<NewOrcamentoViewProps> = ({ onCancel, onSaved, orcamentoToEdit }) => {
    const { user } = useUser();
    const { showToast } = useToast();

    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);

    const [cart, setCart] = useState<{ product: Product, quantity: number, price: number, discount: number }[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaved, setIsSaved] = useState(false);
    const [lastSavedOrcamento, setLastSavedOrcamento] = useState<any>(null);
    const [showPrintModal, setShowPrintModal] = useState(false);

    const [observacoes, setObservacoes] = useState('');
    const [fechamentoProbabilidade, setFechamentoProbabilidade] = useState<number>(50);

    // Novo estado de pagamentos múltiplos
    const [payments, setPayments] = useState<{ id: string, method: string, value: number, installments: number }[]>([
        { id: '1', method: 'Dinheiro', value: 0, installments: 1 }
    ]);

    useEffect(() => {
        getProducts().then(setProducts).catch(() => showToast('Erro ao carregar produtos', 'error'));
        getCustomers(false).then(setCustomers).catch(() => showToast('Erro ao carregar clientes', 'error'));
    }, [showToast]);

    const addToCart = (product: Product) => {
        // Warning if no stock (but Orçamento allows it)
        if (product.stock <= 0) {
            showToast('Produto sem estoque. Orçamento permitido, mas alertado.', 'warning');
        }

        setCart(prev => {
            const existing = prev.find(p => p.product.id === product.id);
            if (existing) {
                return prev.map(p => p.product.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
            }
            return [...prev, { product, quantity: 1, price: product.price, discount: 0 }];
        });
        setSearchTerm(''); // clear search after adding based on typical POS behavior
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(c => c.product.id !== productId));
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => prev.map(c => {
            if (c.product.id === productId) {
                const newQ = c.quantity + delta;
                return newQ > 0 ? { ...c, quantity: newQ } : c;
            }
            return c;
        }));
    };

    const updateDiscount = (productId: string, discount: number) => {
        setCart(prev => prev.map(c => c.product.id === productId ? { ...c, discount: Number(discount) } : c));
    };

    // Shared Calculation Logic for Orcamento
    const summary = useMemo(() => {
        const subtotal = cart.reduce((acc, item) => acc + (item.quantity * item.price), 0);
        const totalDiscount = cart.reduce((acc, item) => acc + (item.discount || 0), 0);

        let subAfterDiscounts = subtotal - totalDiscount;
        if (subAfterDiscounts < 0) subAfterDiscounts = 0;

        let jurosTotal = 0;
        payments.forEach(p => {
            if (p.method === 'Cartão Crédito' && p.installments > 1) {
                jurosTotal += p.value * (0.02 * p.installments);
            }
        });

        const totalFinal = subAfterDiscounts + jurosTotal;
        const totalPaid = payments.reduce((acc, p) => acc + (p.value || 0), 0);
        const remainingBalance = subAfterDiscounts - totalPaid;

        return { subtotal, totalDiscount, jurosTotal, totalFinal, totalPaid, remainingBalance };
    }, [cart, payments]);

    const handleFinalize = async () => {
        if (cart.length === 0) {
            showToast('Adicione pelo menos um item ao orçamento.', 'error');
            return;
        }

        try {
            const items: Partial<OrcamentoItem>[] = cart.map(c => ({
                produto_id: c.product.id,
                nome_produto_snapshot: c.product.name || c.product.sku || 'Produto sem nome',
                sku_snapshot: c.product.model || c.product.sku || 'N/A',
                preco_unitario_snapshot: c.price,
                custo_snapshot: c.product.costPrice || 0,
                quantidade: c.quantity,
                desconto: c.discount,
                subtotal: (c.quantity * c.price) - c.discount
            }));

            const payload = {
                numero: orcamentoToEdit?.numero || `ORC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                cliente_id: selectedCustomer?.id || undefined,
                status: 'finalizado' as const,
                subtotal: summary.subtotal,
                desconto_total: summary.totalDiscount,
                juros_total: summary.jurosTotal,
                total_final: summary.totalFinal,
                observacoes,
                probabilidade_fechamento_percentual: fechamentoProbabilidade,
                forma_pagamento_snapshot: {
                    pagamentos: payments,
                    juros_aplicados: summary.jurosTotal
                },
                vendedor_nome: user?.name || ''
            };

            if (orcamentoToEdit?.id) {
                await updateOrcamento(orcamentoToEdit.id, payload, items as OrcamentoItem[]);
            } else {
                await createOrcamento(payload, items, user?.id || '', user?.name || '');
            }
            setLastSavedOrcamento({ ...payload, items });
            setIsSaved(true);
            showToast(orcamentoToEdit ? 'Orçamento atualizado!' : 'Orçamento salvo!', 'success');
        } catch (e: any) {
            showToast(e.message || 'Erro ao salvar orçamento', 'error');
        }
    };

    const filteredProducts = products.filter(p => {
        const term = searchTerm.toLowerCase();
        return (
            (p.name || '').toLowerCase().includes(term) ||
            (p.model || '').toLowerCase().includes(term) ||
            (p.sku || '').toLowerCase().includes(term) ||
            (p.imei1 || '').toLowerCase().includes(term) ||
            (p.imei2 || '').toLowerCase().includes(term) ||
            (p.serialNumber || '').toLowerCase().includes(term) ||
            (p.barcodes || []).some(b => (b || '').toLowerCase().includes(term))
        );
    }).slice(0, 15);

    const shareWhatsApp = () => {
        if (!lastSavedOrcamento) return;

        const customerName = selectedCustomer?.name || 'Cliente';
        const itemsText = lastSavedOrcamento.items.map((item: any) =>
            `✅ *${item.quantidade}x* ${item.nome_produto_snapshot} - ${formatCurrency(item.preco_unitario_snapshot)}`
        ).join('\n');

        const message = [
            `*🏷️ ORÇAMENTO #${lastSavedOrcamento.numero}*`,
            `----------------------------------------------`,
            `Olá, *${customerName}*! Segue abaixo a simulação dos itens do seu interesse:`,
            ``,
            itemsText,
            ``,
            `*Subtotal:* ${formatCurrency(lastSavedOrcamento.subtotal)}`,
            lastSavedOrcamento.desconto_total > 0 ? `*Desconto:* -${formatCurrency(lastSavedOrcamento.desconto_total)}` : null,
            lastSavedOrcamento.juros_total > 0 ? `*Simulação de Juros:* +${formatCurrency(lastSavedOrcamento.juros_total)}` : null,
            `*💰 TOTAL FINAL: ${formatCurrency(lastSavedOrcamento.total_final)}*`,
            ``,
            `*💳 FORMAS DE PAGAMENTO:*`,
            lastSavedOrcamento.forma_pagamento_snapshot?.pagamentos?.map((p: any) =>
                `• ${p.method}${p.installments > 1 ? ` (${p.installments}x)` : ''}: ${formatCurrency(p.value)}`
            ).join('\n'),
            ``,
            lastSavedOrcamento.observacoes ? `*📝 Obs:* ${lastSavedOrcamento.observacoes}` : null,
            `----------------------------------------------`,
            `*Atendimento por:* ${user?.name || 'Vendedor iStore'}`,
            `_Gerado via iStore Pro - Gestão Inteligente_`
        ].filter(Boolean).join('\n');

        const phone = selectedCustomer?.phone?.replace(/\D/g, '') || '';
        const waUrl = `https://wa.me/${phone.startsWith('55') ? phone : '55' + phone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
    };

    const handlePrint = () => {
        setIsSaved(false); // Esconde o modal de sucesso para mostrar o de print
        setShowPrintModal(true);
    };

    return (
        <div className="flex flex-col lg:flex-row h-full w-full flex-1 relative bg-gray-50 overflow-hidden animate-fade-in">
            {/* Left side: Grid of Products / Search */}
            <div className="w-full lg:w-[65%] flex flex-col h-[50vh] lg:h-full bg-white border-r border-gray-200">
                <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                    <button onClick={onCancel} className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <div className="relative flex-1">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar produto por nome ou SKU..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-100 border-transparent rounded-xl focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition-all font-medium outline-none"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-gray-50/50">
                    {searchTerm && filteredProducts.length === 0 ? (
                        <div className="text-center text-gray-500 py-10">Produto não encontrado.</div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20 lg:pb-0">
                            {filteredProducts.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => addToCart(p)}
                                    className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition-all text-left flex flex-col group active:scale-95"
                                >
                                    <div className="w-full h-24 bg-gray-100 rounded-xl mb-3 flex items-center justify-center overflow-hidden">
                                        {p.imageUrl ? (
                                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        ) : (
                                            <span className="text-2xl font-bold text-gray-300 select-none">ISTORE</span>
                                        )}
                                    </div>
                                    <div className="text-sm font-bold text-gray-800 line-clamp-2 leading-tight mb-1">{p.name || p.sku || 'Produto sem nome'}</div>
                                    <div className="text-xs text-gray-500 mb-2">{p.model || 'Sem marca'}</div>
                                    <div className="mt-auto flex justify-between items-center w-full">
                                        <div className="font-bold text-orange-600">{formatCurrency(p.price)}</div>
                                        <div className={`text-xs px-2 py-0.5 rounded-md font-bold ${p.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {p.stock}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right side: Resume & Simulation */}
            <div className="w-full lg:w-[35%] flex flex-col h-[50vh] lg:h-full bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.03)] z-10 relative">
                <div className="p-4 bg-orange-500 text-white flex justify-between items-center shadow-md pb-6 pt-5 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold">Resumo do Orçamento</h2>
                        <p className="text-orange-100 text-sm opacity-90">{cart.length} ite{cart.length === 1 ? 'm' : 'ns'} na simulação</p>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4 custom-scrollbar -mt-3 relative z-10 bg-white rounded-t-[20px]">
                    {/* Customer Selection */}
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Cliente (Opcional)</label>
                        <select
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-orange-500"
                            onChange={e => setSelectedCustomer(customers.find(c => c.id === e.target.value) || null)}
                            value={selectedCustomer?.id || ''}
                        >
                            <option value="">Consumidor Final (Sem Cadastro)</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {/* Cart Items */}
                    <div className="space-y-3 mb-6">
                        {cart.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                                Orçamento vazio. Adicione itens para simular.
                            </div>
                        ) : cart.map((item, idx) => (
                            <div key={idx} className="bg-gray-50 p-3 rounded-xl border border-gray-100 shadow-sm relative group">
                                <div className="flex justify-between items-start pr-6">
                                    <span className="font-bold text-gray-800 text-sm leading-tight">{item.product.name || item.product.sku || 'Produto sem nome'}</span>
                                    <button onClick={() => removeFromCart(item.product.id)} className="absolute right-2 top-2 p-1 text-gray-400 hover:text-red-500 transition-colors">
                                        <CloseIcon className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="text-orange-600 font-bold text-sm mt-1 mb-2">{formatCurrency(item.price)}</div>

                                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-200/60">
                                    <div className="flex items-center bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                                        <button onClick={() => updateQuantity(item.product.id, -1)} className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 font-bold text-gray-600">-</button>
                                        <span className="w-8 flex items-center justify-center font-bold text-sm bg-gray-50">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.product.id, 1)} className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 font-bold text-gray-600">+</button>
                                    </div>
                                    <div className="flex items-center gap-1 w-24">
                                        <span className="text-xs text-gray-400 font-bold">Desc R$</span>
                                        <input
                                            type="number"
                                            value={item.discount || ''}
                                            onChange={e => updateDiscount(item.product.id, Number(e.target.value))}
                                            placeholder="0"
                                            className="w-full text-right bg-white border border-gray-200 rounded p-1 text-sm outline-none focus:border-orange-500"
                                            min="0"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Payment Simulation Settings */}
                    {cart.length > 0 && (
                        <div className="bg-white border rounded-2xl p-4 mb-4 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                    <CreditCardIcon className="w-5 h-5 text-orange-500" />
                                    Simulação de Pagamento
                                </h3>
                                <button
                                    onClick={() => setPayments([...payments, { id: Math.random().toString(), method: 'Dinheiro', value: summary.remainingBalance > 0 ? summary.remainingBalance : 0, installments: 1 }])}
                                    className="text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    <PlusIcon className="w-4 h-4" /> Adicionar
                                </button>
                            </div>

                            <div className="space-y-3 mb-4">
                                {payments.map((payment, index) => (
                                    <div key={payment.id} className="relative bg-gray-50 border border-gray-200 rounded-xl p-3 shadow-sm group">
                                        {payments.length > 1 && (
                                            <button
                                                onClick={() => setPayments(payments.filter(p => p.id !== payment.id))}
                                                className="absolute -top-2 -right-2 bg-white text-gray-400 hover:text-red-500 rounded-full border border-gray-200 p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <CloseIcon className="w-3 h-3" />
                                            </button>
                                        )}
                                        <div className="grid grid-cols-[1fr_80px_120px] gap-2 items-center">
                                            <div>
                                                <select
                                                    value={payment.method}
                                                    onChange={e => {
                                                        const newArr = [...payments];
                                                        newArr[index].method = e.target.value;
                                                        setPayments(newArr);
                                                    }}
                                                    className="w-full bg-white border border-gray-200 text-sm font-bold text-gray-700 h-9 px-2 outline-none rounded-md"
                                                >
                                                    <option value="Dinheiro">Dinheiro</option>
                                                    <option value="Pix">Pix</option>
                                                    <option value="Cartão Crédito">Cartão de Crédito</option>
                                                    <option value="Cartão Débito">Cartão de Débito</option>
                                                    <option value="Crediário">Crediário iStore</option>
                                                    <option value="Aparelho de troca">Aparelho de troca</option>
                                                </select>
                                            </div>

                                            <div>
                                                <select
                                                    value={payment.installments}
                                                    onChange={e => {
                                                        const newArr = [...payments];
                                                        newArr[index].installments = Number(e.target.value);
                                                        setPayments(newArr);
                                                    }}
                                                    disabled={payment.method !== 'Cartão Crédito' && payment.method !== 'Crediário'}
                                                    className={`w-full bg-white border border-gray-200 text-sm font-bold text-gray-700 h-9 px-1 rounded-md outline-none ${payment.method !== 'Cartão Crédito' && payment.method !== 'Crediário' ? 'opacity-50' : ''}`}
                                                >
                                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18].map(i => <option key={i} value={i}>{i}x</option>)}
                                                </select>
                                            </div>

                                            <div>
                                                <CurrencyInput
                                                    value={payment.value}
                                                    onChange={v => {
                                                        const newArr = [...payments];
                                                        newArr[index].value = v || 0;
                                                        setPayments(newArr);
                                                    }}
                                                    size="compact"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {summary.remainingBalance !== 0 && (
                                <div className={`text-xs font-bold mb-3 flex items-center justify-between px-3 py-2 rounded-lg ${summary.remainingBalance > 0 ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-600'}`}>
                                    <span>{summary.remainingBalance > 0 ? 'Falta simular pagamentos:' : 'Pagamentos excedem o total:'}</span>
                                    <span>{formatCurrency(Math.abs(summary.remainingBalance))}</span>
                                </div>
                            )}

                            {/* Fechamento Pipeline */}
                            <div>
                                <label className="block text-xs text-blue-500 font-bold mb-1 flex items-center gap-1 mt-4 border-t pt-3">
                                    <ChartBarIcon className="w-4 h-4" />
                                    Probabilidade de Fechamento (%)
                                </label>
                                <div className="flex items-center gap-3">
                                    <input type="range" min="0" max="100" step="10" value={fechamentoProbabilidade} onChange={(e) => setFechamentoProbabilidade(Number(e.target.value))} className="flex-1 accent-blue-500" />
                                    <span className="font-bold text-blue-700 w-10 text-right">{fechamentoProbabilidade}%</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Ajuda a prever seu funil de vendas futuro.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Resumo & Botao */}
                <div className="p-5 bg-white border-t border-gray-100 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] shrink-0 z-20">
                    <div className="space-y-2 mb-4 text-sm font-medium text-gray-600">
                        <div className="flex justify-between">
                            <span>Subtotal Itens</span>
                            <span>{formatCurrency(summary.subtotal)}</span>
                        </div>
                        {summary.totalDiscount > 0 && (
                            <div className="flex justify-between text-green-600">
                                <span>Descontos Aplicados</span>
                                <span>- {formatCurrency(summary.totalDiscount)}</span>
                            </div>
                        )}
                        {summary.jurosTotal > 0 && (
                            <div className="flex justify-between text-red-600">
                                <span>Juros da Simulação</span>
                                <span>+ {formatCurrency(summary.jurosTotal)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-xl font-black text-gray-900 pt-3 border-t border-gray-200">
                            <span>Total Final</span>
                            <span>{formatCurrency(summary.totalFinal)}</span>
                        </div>
                        {payments.some(p => p.installments > 1) && (
                            <div className="flex justify-between text-[11px] font-bold text-orange-600 mt-2 px-3 py-2 bg-orange-50 rounded-lg">
                                <span>Resumo Parcelado</span>
                                <div className="text-right flex flex-col items-end gap-1">
                                    {payments.filter(p => p.installments > 1).map((p, idx) => {
                                        const finalValue = p.value + (p.method === 'Cartão Crédito' ? p.value * (0.02 * p.installments) : 0);
                                        return (
                                            <span key={idx}>{p.method}: {p.installments}x de {formatCurrency(finalValue / p.installments)}</span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleFinalize}
                        disabled={cart.length === 0 || summary.remainingBalance !== 0}
                        className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg ${cart.length > 0 && summary.remainingBalance === 0
                            ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/25 hover:-translate-y-1'
                            : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed shadow-none'
                            }`}
                    >
                        Fechar Orçamento <SuccessIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Success Modal / Options Overlay */}
            {isSaved && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-fade-in print:hidden">
                    <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-scale-in">
                        <div className="bg-orange-500 p-8 text-white text-center">
                            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/30">
                                <SuccessIcon className="w-10 h-10 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold">Orçamento Salvo!</h3>
                            <p className="text-orange-100 mt-2 font-medium">O que deseja fazer agora?</p>
                        </div>

                        <div className="p-6 space-y-3">
                            <button
                                onClick={handlePrint}
                                className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-2xl border border-gray-100 transition-all group"
                            >
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-600 group-hover:text-orange-500 transition-colors">
                                    <PrinterIcon className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-gray-800 uppercase text-xs tracking-wider">Imprimir</div>
                                    <div className="text-xs text-gray-500 font-medium">Gerar via impressora / PDF</div>
                                </div>
                            </button>

                            <button
                                onClick={shareWhatsApp}
                                className="w-full flex items-center gap-4 p-4 bg-green-50 hover:bg-green-100 rounded-2xl border border-green-100 transition-all group"
                            >
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-green-600">
                                    <WhatsAppIcon className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-gray-800 uppercase text-xs tracking-wider">Enviar WhatsApp</div>
                                    <div className="text-xs text-gray-500 font-medium">Compartilhar texto completo</div>
                                </div>
                            </button>

                            <button
                                onClick={onSaved}
                                className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-200 rounded-2xl border border-gray-100 transition-all group"
                            >
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-500">
                                    <CloseIcon className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-gray-800 uppercase text-xs tracking-wider">Apenas Sair</div>
                                    <div className="text-xs text-gray-500 font-medium">Voltar para a listagem</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Modal Overlay */}
            {showPrintModal && lastSavedOrcamento && (
                <OrcamentoPrintModal
                    orcamento={lastSavedOrcamento}
                    customer={selectedCustomer}
                    onClose={() => {
                        setShowPrintModal(false);
                        onSaved(); // Fecha tudo e volta pra lista após terminar o ciclo
                    }}
                />
            )}
        </div>
    );
};

export default NewOrcamentoView;
