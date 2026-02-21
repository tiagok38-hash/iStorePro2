import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '../../contexts/UserContext.tsx';
import { useToast } from '../../contexts/ToastContext.tsx';
import {
    ChevronLeftIcon, PlusIcon, SearchIcon, TrashIcon,
    CloseIcon, CreditCardIcon, SuccessIcon, ChartBarIcon
} from '../icons.tsx';
import { getProducts, getCustomers } from '../../services/mockApi.ts';
import { createOrcamento } from '../../services/orcamentosService.ts';
import { Product, Customer, OrcamentoItem } from '../../types.ts';
import { formatCurrency } from '../../services/mockApi.ts';

interface NewOrcamentoViewProps {
    onCancel: () => void;
    onSaved: () => void;
}

const NewOrcamentoView: React.FC<NewOrcamentoViewProps> = ({ onCancel, onSaved }) => {
    const { user } = useUser();
    const { showToast } = useToast();

    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);

    const [cart, setCart] = useState<{ product: Product, quantity: number, price: number, discount: number }[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Orcamento specifics
    const [observacoes, setObservacoes] = useState('');
    const [fechamentoProbabilidade, setFechamentoProbabilidade] = useState<number>(50);
    const [installments, setInstallments] = useState(1);
    const [paymentMethod, setPaymentMethod] = useState('À Vista');

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

        // Mock simple interest logic if > 1 partials and custom method
        let jurosTotal = 0;
        if (installments > 1 && paymentMethod === 'Cartão Crédito') {
            // 2% per installment as a placeholder logic
            jurosTotal = subAfterDiscounts * (0.02 * installments);
        }

        const totalFinal = subAfterDiscounts + jurosTotal;

        return { subtotal, totalDiscount, jurosTotal, totalFinal };
    }, [cart, installments, paymentMethod]);

    const handleFinalize = async () => {
        if (cart.length === 0) {
            showToast('Adicione pelo menos um item ao orçamento.', 'error');
            return;
        }

        try {
            const items: Partial<OrcamentoItem>[] = cart.map(c => ({
                produto_id: c.product.id,
                nome_produto_snapshot: c.product.name,
                sku_snapshot: c.product.model || 'N/A',
                preco_unitario_snapshot: c.price,
                custo_snapshot: c.product.costPrice || 0,
                quantidade: c.quantity,
                desconto: c.discount,
                subtotal: (c.quantity * c.price) - c.discount
            }));

            const payload = {
                numero: `ORC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                cliente_id: selectedCustomer?.id || undefined,
                status: 'finalizado' as const,
                subtotal: summary.subtotal,
                desconto_total: summary.totalDiscount,
                juros_total: summary.jurosTotal,
                total_final: summary.totalFinal,
                observacoes,
                probabilidade_fechamento_percentual: fechamentoProbabilidade,
                forma_pagamento_snapshot: {
                    metodo: paymentMethod,
                    parcelas: installments,
                    juros_aplicados: summary.jurosTotal
                }
            };

            await createOrcamento(payload, items, user?.id || '', user?.name || '');
            showToast('Orçamento salvo com sucesso!', 'success');
            onSaved();
        } catch (e: any) {
            showToast(e.message || 'Erro ao salvar orçamento', 'error');
        }
    };

    // Filter products
    const filteredProducts = products.filter(p =>
        (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.model && p.model.toLowerCase().includes(searchTerm.toLowerCase()))
    ).slice(0, 15);

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
                                    <div className="text-sm font-bold text-gray-800 line-clamp-2 leading-tight mb-1">{p.name}</div>
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
                                    <span className="font-bold text-gray-800 text-sm leading-tight">{item.product.name}</span>
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
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-4">
                                <CreditCardIcon className="w-5 h-5 text-orange-500" />
                                Simulação de Pagamento
                            </h3>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className="block text-xs text-gray-500 font-bold mb-1">Método</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={e => setPaymentMethod(e.target.value)}
                                        className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50"
                                    >
                                        <option value="À Vista">Pix / Dinheiro</option>
                                        <option value="Cartão Crédito">Cartão de Crédito</option>
                                        <option value="Crediário">Crediário iStore</option>
                                    </select>
                                </div>
                                {paymentMethod !== 'À Vista' && (
                                    <div>
                                        <label className="block text-xs text-gray-500 font-bold mb-1">Parcelas</label>
                                        <select
                                            value={installments}
                                            onChange={e => setInstallments(Number(e.target.value))}
                                            className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50"
                                        >
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18].map(i => <option key={i} value={i}>{i}x</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

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
                        {(installments > 1) && (
                            <div className="flex justify-between text-xs font-bold text-orange-600">
                                <span>Simulação em {installments}x</span>
                                <span>{installments} parcelas de {formatCurrency(summary.totalFinal / installments)}</span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleFinalize}
                        disabled={cart.length === 0}
                        className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg ${cart.length > 0
                            ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/25 hover:-translate-y-1'
                            : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed shadow-none'
                            }`}
                    >
                        Fazendo Orçamento <SuccessIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewOrcamentoView;
