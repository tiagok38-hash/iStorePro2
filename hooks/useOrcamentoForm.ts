
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    Product, Customer, User, Orcamento, Payment, PaymentMethodType,
    Supplier, CartItem, PaymentMethodParameter, CardConfigData,
    AuditActionType, AuditEntityType
} from '../types.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import {
    findOrCreateSupplierFromCustomer, updateProduct, addAuditLog
} from '../services/mockApi.ts';
import {
    createOrcamento, updateOrcamento
} from '../services/orcamentosService.ts';
import { useUser } from '../contexts/UserContext.tsx';
import { toDateValue } from '../utils/dateUtils.ts';

interface UseOrcamentoFormProps {
    customers: Customer[];
    users: User[];
    products: Product[];
    suppliers: Supplier[];
    receiptTerms: any[];
    paymentMethods: PaymentMethodParameter[];
    onAddNewCustomer: (data: any) => Promise<Customer | null>;
    onAddProduct: (data: any) => Promise<Product | null>;
    onOrcamentoSaved: (sale: Orcamento) => void;
    orcamentoToEdit?: Orcamento | null;
    openCashSessionId?: string | null;
    openCashSessionDisplayId?: number;
}

export const useOrcamentoForm = ({
    customers, users, products, suppliers, receiptTerms, paymentMethods,
    onAddNewCustomer, onAddProduct, onOrcamentoSaved, orcamentoToEdit,
    openCashSessionId, openCashSessionDisplayId
}: UseOrcamentoFormProps) => {
    const { showToast } = useToast();
    const { user } = useUser();
    const productSearchRef = useRef<HTMLInputElement>(null);
    const initializedRef = useRef(false);

    // Form State
    const [orcamentoDate, setOrcamentoDate] = useState(toDateValue());
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [selectedSalespersonId, setSelectedSalespersonId] = useState<string>('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [productToConfirm, setProductToConfirm] = useState<Product | null>(null);
    const [searchQuantity, setSearchQuantity] = useState(1);

    const [cardFees, setCardFees] = useState<number>(0);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [warrantyTerm, setWarrantyTerm] = useState('');
    const [observations, setObservations] = useState('');
    const [internalObservations, setInternalObservations] = useState('');

    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [isTradeInProductModalOpen, setIsTradeInProductModalOpen] = useState(false);
    const [productForTradeIn, setProductForTradeIn] = useState<Partial<Product> | null>(null);
    const [pendingTradeInProduct, setPendingTradeInProduct] = useState<Product | null>(null);
    const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(suppliers);
    const [isSaving, setIsSaving] = useState(false);
    const [isCardPaymentModalOpen, setIsCardPaymentModalOpen] = useState(false);
    const [cardTransactionType, setCardTransactionType] = useState<'credit' | 'debit'>('credit');
    const [cardMethodId, setCardMethodId] = useState<string>('');
    const [selectedPriceType, setSelectedPriceType] = useState<'sale' | 'cost' | 'wholesale'>('sale');

    const [paymentInput, setPaymentInput] = useState<{
        method: PaymentMethodType | 'Cartão',
        amount: number,
        cardType?: 'Crédito' | 'Débito',
        internalNote?: string,
        pixVariation?: string,
    } | null>(null);

    const resetState = useCallback(() => {
        setOrcamentoDate(toDateValue());
        setSelectedCustomerId(localStorage.getItem('pos_default_customer_id') || null);
        setSelectedSalespersonId(user?.id || '');
        setCart([]);
        setProductSearch('');
        setProductToConfirm(null);
        setSearchQuantity(1);
        setCardFees(0);
        setPayments([]);
        setWarrantyTerm(''); // Reset to empty - user must select
        setObservations('');
        setInternalObservations('');
        setPaymentInput(null);
        setProductForTradeIn(null);
        setPendingTradeInProduct(null);
        setSelectedPriceType('sale');
    }, []);

    useEffect(() => {
        if (!initializedRef.current) {
            if (orcamentoToEdit) {
                setOrcamentoDate(orcamentoToEdit.created_at.split('T')[0]);
                setSelectedCustomerId(orcamentoToEdit.cliente_id || null);
                setSelectedSalespersonId(orcamentoToEdit.vendedor_id);
                const reconstructedCart = (orcamentoToEdit.itens || []).map((item: any) => {
                    const product = products.find(p => p.id === item.produto_id);
                    if (!product) return null;
                    return { ...product, quantity: item.quantidade, salePrice: item.preco_unitario_snapshot, discountType: 'R$', discountValue: item.desconto || 0 } as CartItem;
                }).filter((item): item is CartItem => item !== null);
                setCart(reconstructedCart as CartItem[]);
                const orcPayments = orcamentoToEdit.forma_pagamento_snapshot?.pagamentos || [];
                setPayments(orcPayments.map((p: any) => ({ ...p })));
                setWarrantyTerm('');
                setObservations(orcamentoToEdit.observacoes || '');
                setInternalObservations('');
            } else {
                resetState();
            }
            initializedRef.current = true;
        }
    }, [orcamentoToEdit, resetState, products, user?.id]);

    const handleCancelReservation = useCallback(async () => {
    }, [orcamentoToEdit]);

    // Cleanup on unmount
    useEffect(() => {
    }, [orcamentoToEdit]);

    useEffect(() => { setLocalSuppliers(suppliers); }, [suppliers]);

    const subtotal = useMemo(() => cart.reduce((total, item) => total + (item.salePrice || 0) * (item.quantity || 0), 0), [cart]);

    const totalItemDiscounts = useMemo(() => cart.reduce((total, item) => {
        const disc = item.discountType === 'R$' ? item.discountValue : ((item.salePrice || 0) * (item.quantity || 0)) * (item.discountValue / 100);
        return total + disc;
    }, 0), [cart]);

    // FIX: Total should NOT include card fees. Card fees are external to the product value.
    const total = useMemo(() => subtotal - totalItemDiscounts, [subtotal, totalItemDiscounts]);
    const totalPaid = useMemo(() => payments.reduce((sum, p) => sum + p.value, 0), [payments]);
    const balance = useMemo(() => total - totalPaid, [total, totalPaid]);

    const handleAddToCart = useCallback((product: Product, priceType: 'sale' | 'cost' | 'wholesale' = 'sale') => {
        const isUnique = !!(product.serialNumber || product.imei1);
        const existingItem = cart.find(item => item.id === product.id);
        if (isUnique && existingItem) { showToast('Este produto é único e já está no carrinho.', 'warning'); return; }
        setSelectedPriceType(priceType);
        setProductToConfirm(product);
    }, [cart, showToast]);

    const confirmAddToCart = useCallback(() => {
        if (!productToConfirm) return;
        const product = productToConfirm;
        const isUnique = !!(product.serialNumber || product.imei1);
        const existingItem = cart.find(item => item.id === product.id);

        const quantityToAdd = isUnique ? 1 : searchQuantity;
        if (quantityToAdd <= 0) return;
        const totalQuantity = (existingItem?.quantity || 0) + quantityToAdd;
        if (totalQuantity > product.stock) { showToast('Quantidade insuficiente em estoque.', 'warning'); return; }

        if (existingItem) {
            let finalPrice = product.price;
            if (selectedPriceType === 'cost') finalPrice = (product.costPrice || 0) + (product.additionalCostPrice || 0) || product.price;
            else if (selectedPriceType === 'wholesale') finalPrice = product.wholesalePrice || product.price;

            setCart(cart.map(item => item.id === product.id ? {
                ...item,
                quantity: totalQuantity,
                salePrice: finalPrice,
                priceType: selectedPriceType
            } : item));
        } else {
            let finalPrice = product.price;
            if (selectedPriceType === 'cost') finalPrice = (product.costPrice || 0) + (product.additionalCostPrice || 0) || product.price;
            else if (selectedPriceType === 'wholesale') finalPrice = product.wholesalePrice || product.price;

            setCart([...cart, {
                ...product,
                quantity: quantityToAdd,
                salePrice: finalPrice,
                discountType: 'R$',
                discountValue: 0,
                priceType: selectedPriceType
            }]);
        }
        setProductToConfirm(null);
        setProductSearch('');
        setSearchQuantity(1);
    }, [productToConfirm, searchQuantity, cart, showToast, selectedPriceType]);

    const handleRemoveFromCart = useCallback((productId: string) => {
        const itemToRemove = cart.find(item => item.id === productId);
        if (itemToRemove && orcamentoToEdit && (orcamentoToEdit.status === 'finalizado' || orcamentoToEdit.status === 'draft')) {
            showToast(`O produto "${itemToRemove.model}" foi removido e será devolvido ao estoque ao salvar a venda.`, 'warning');
        }
        setCart(prev => prev.filter(item => item.id !== productId));
        setPayments([]); // Clear payments when an item is removed
    }, [cart, orcamentoToEdit, showToast]);

    const handleCartItemUpdate = useCallback((productId: string, field: keyof CartItem, value: any) => {
        setCart(currentCart => {
            return currentCart.map(item => {
                if (item.id === productId) {
                    if (field === 'quantity') {
                        const newQty = parseInt(value, 10);
                        if (isNaN(newQty) || newQty < 1) return item;

                        // Check uniqueness inside the update to ensure safety, though UI handles it too
                        if (item.serialNumber || item.imei1) return item;

                        if (newQty > item.stock) {
                            showToast(`Estoque insuficiente. Máximo disponível: ${item.stock}`, 'warning');
                            return { ...item, quantity: item.stock };
                        }
                        return { ...item, quantity: newQty };
                    }
                    return { ...item, [field]: value };
                }
                return item;
            });
        });
    }, [showToast]);

    const handleOpenTradeInModal = useCallback(async () => {
        if (!selectedCustomerId) {
            showToast("Selecione um cliente primeiro.", "warning");
            return;
        }
        const customer = customers.find(c => c.id === selectedCustomerId);
        if (!customer) {
            showToast("Cliente não encontrado.", "error");
            return;
        }
        try {
            const supplier = await findOrCreateSupplierFromCustomer(customer);
            setLocalSuppliers(prev => {
                if (!prev.some(s => s.id === supplier.id)) return [...prev, supplier];
                return prev;
            });
            setProductForTradeIn({ origin: 'Troca', supplierId: supplier.id });
            setIsTradeInProductModalOpen(true);
        } catch (error: any) {
            console.error('[useOrcamentoForm] Error in handleOpenTradeInModal:', error);

            // Fallback: Always try to open modal with temporary supplier if API fails
            // This ensures the user is not blocked from adding a trade-in item
            console.warn('[useOrcamentoForm] Using fallback temporary supplier due to error.');

            const fallbackSupplier = {
                id: `temp-supplier-${customer.id}`,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                linkedCustomerId: customer.id
            };

            setLocalSuppliers(prev => {
                if (!prev.some(s => s.id === fallbackSupplier.id)) return [...prev, fallbackSupplier as any];
                return prev;
            });

            setProductForTradeIn({ origin: 'Troca', supplierId: fallbackSupplier.id });
            setIsTradeInProductModalOpen(true);

            if (error?.name !== 'AbortError' && !error?.message?.includes('aborted')) {
                showToast("Aviso: executando em modo offline para o fornecedor.", "info");
            }
        }
    }, [selectedCustomerId, customers, showToast]);




    const handleRequestPayment = useCallback((label: string, variation?: string) => {
        const methodParam = paymentMethods.find(p => p.name === label);
        const lowerLabel = label.toLowerCase();
        const isTradeIn = lowerLabel.includes('troca') || lowerLabel.includes('entrada') || methodParam?.name === 'Aparelho na Troca';
        const isCard = methodParam?.type === 'card' || lowerLabel.includes('cartão') || lowerLabel.includes('crédito') || lowerLabel.includes('débito');

        // Trade-in can be added even if balance is zero (to create credit)
        // Other payments require a positive balance
        if (!isTradeIn && balance <= 0.01) {
            showToast('Não há saldo pendente.', 'info');
            return;
        }

        if (isTradeIn) {
            handleOpenTradeInModal();
        }
        else if (isCard) {
            if (methodParam) setCardMethodId(methodParam.id);
            setCardTransactionType(lowerLabel.includes('débito') || lowerLabel.includes('debito') ? 'debit' : 'credit');
            setIsCardPaymentModalOpen(true);
        }
        else setPaymentInput({ method: label as any, amount: parseFloat(balance.toFixed(2)), pixVariation: variation });
    }, [balance, paymentMethods, handleOpenTradeInModal, showToast]);


    const handleConfirmPayment = useCallback(() => {
        if (!paymentInput || paymentInput.amount <= 0) { setPaymentInput(null); return; }
        const method = paymentInput.method === 'Cartão' ? paymentInput.cardType! : paymentInput.method;

        // Find method definition to get type (e.g. pending)
        const methodDef = paymentMethods.find(p => p.name === paymentInput.method);

        const newPayment: Payment = {
            id: `pay-${Date.now()}`,
            method: method as PaymentMethodType,
            value: paymentInput.amount,
            type: methodDef?.type,
            internalNote: paymentInput.internalNote,
            pixVariation: paymentInput.pixVariation
        };
        setPayments(prev => [...prev, newPayment]);
        setPaymentInput(null);
    }, [paymentInput, paymentMethods]);

    const handleConfirmCardPayment = useCallback(({ payment, feeToAddToOrcamento }: { payment: Payment; feeToAddToOrcamento: number }) => {
        setPayments(prev => [...prev, payment]);
        setIsCardPaymentModalOpen(false);
    }, []);

    const handleRemovePayment = useCallback((paymentId: string) => {
        setPayments(prev => {
            const paymentToRemove = prev.find(p => p.id === paymentId);
            if (paymentToRemove) {
                if ((paymentToRemove.method === 'Débito' || paymentToRemove.method === 'Crédito') && paymentToRemove.fees) {
                    // Só remove do cardFees se o tipo for 'Débito' ou 'Com Juros' (onde a taxa foi somada ao total)
                    if (paymentToRemove.type === 'Débito' || paymentToRemove.type === 'Com Juros') {
                    }
                }
                if (paymentToRemove.method === 'Aparelho na Troca') {
                    setPendingTradeInProduct(null);
                    showToast('Troca removida.', 'info');
                }
            }
            return prev.filter(p => p.id !== paymentId);
        });
    }, [showToast]);


    // Wrapper function for TradeInModal which has a different signature
    const handleSaveTradeInFromModal = useCallback(async ({ tradeInValue, newProductData }: { tradeInValue: number; newProductData: any }) => {


        if (!selectedCustomerId) {
            setIsTradeInProductModalOpen(false);
            return;
        }

        const salesperson = users.find(u => u.id === selectedSalespersonId);
        const fullProductPayload = {
            ...newProductData,
            stock: 0, // Trade-in products start with 0 stock, only added when sale is finalized
            selectedCustomerId,
            createdBy: selectedSalespersonId,
            createdByName: salesperson?.name,
            supplierName: suppliers.find(s => s.id === newProductData.supplierId)?.name || 'N/A'
        };

        try {
            // DEFER CREATION: Do not call onAddProduct here. 
            // Store payload to be created upon Orcamento Finalization.
            const tempId = `temp-trade-${Date.now()}`;

            setPendingTradeInProduct({ ...fullProductPayload, id: tempId } as Product);

            const newPayment: Payment = {
                id: `pay-trade-${Date.now()}`,
                method: 'Aparelho na Troca',
                value: tradeInValue,
                tradeInDetails: {
                    productId: tempId, // Temporary ID
                    model: fullProductPayload.model,
                    serialNumber: fullProductPayload.serialNumber,
                    imei1: fullProductPayload.imei1,
                    imei2: fullProductPayload.imei2,
                    batteryHealth: fullProductPayload.batteryHealth,
                    condition: fullProductPayload.condition,
                    newProductPayload: fullProductPayload // Store for later creation
                }
            };
            setPayments(prev => [...prev, newPayment]);
            showToast('Produto de troca agendado! Será criado ao finalizar a venda.', 'success');
        } catch (error: any) {
            showToast(error?.message || 'Erro ao criar produto de troca.', 'error');
        } finally {
            setProductForTradeIn(null);
            setIsTradeInProductModalOpen(false);
        }
    }, [selectedCustomerId, selectedSalespersonId, users, onAddProduct, showToast]);

    const handleSaveTradeInProduct = useCallback(async (productData: any) => {
        return handleSaveTradeInFromModal({
            tradeInValue: productData.costPrice || 0,
            newProductData: productData
        });
    }, [handleSaveTradeInFromModal]);


    const handleSave = useCallback(async (targetStatus: 'Finalizada' | 'Pendente' = 'Finalizada') => {
        const isPending = targetStatus === 'Pendente';
        if (!selectedCustomerId || !selectedSalespersonId || cart.length === 0) {
            showToast('Preencha os campos obrigatórios (Cliente, Vendedor, Produtos) para salvar.', 'error');
            return;
        }

        // Warranty term is required for both finalized and pending sales
        if (!warrantyTerm) {
            showToast('Selecione um comprovante de venda (Garantia) para continuar.', 'error');
            return;
        }

        if (!isPending && balance > 0.01) {
            showToast('Liquide o saldo para finalizar a venda.', 'error');
            return;
        }

        const itemsData = cart.map(item => {
            const itemGross = item.salePrice * item.quantity;
            const itemDiscount = item.discountType === 'R$' ? item.discountValue : itemGross * (item.discountValue / 100);
            return {
                produto_id: item.id,
                quantidade: item.quantity,
                preco_unitario_snapshot: item.salePrice,
                custo_snapshot: item.costPrice || 0,
                nome_produto_snapshot: item.model || item.name || '',
                sku_snapshot: item.model || '',
                desconto: itemDiscount,
                subtotal: itemGross - itemDiscount,
                metadata_snapshot: {
                    imei1: item.imei1,
                    serialNumber: item.serialNumber,
                    barcodes: item.barcodes
                }
            };
        });

        const formaPagamentoSnapshot = {
            pagamentos: payments,
            juros_aplicados: payments.reduce((acc, p) => p.method === 'Cartão Crédito' && p.installments > 1 ? acc + p.value * 0.02 * p.installments : acc, 0)
        };

        const baseOrcamentoData = {
            cliente_id: selectedCustomerId,
            vendedor_id: selectedSalespersonId,
            subtotal,
            total_final: total,
            desconto_total: totalItemDiscounts,
            juros_total: formaPagamentoSnapshot.juros_aplicados,
            observacoes: observations,
            status: isPending ? 'draft' : (orcamentoToEdit && orcamentoToEdit.status !== 'draft' ? 'finalizado' : 'finalizado'),
            forma_pagamento_snapshot: formaPagamentoSnapshot
        };

        setIsSaving(true);
        try {
            let savedOrcamento: Orcamento;
            if (orcamentoToEdit) {
                savedOrcamento = await updateOrcamento(
                    orcamentoToEdit.id,
                    baseOrcamentoData as any,
                    itemsData as any
                );
            } else {
                savedOrcamento = await createOrcamento(baseOrcamentoData as any, itemsData as any, user?.id, user?.name);
            }

            if (isPending) {
                showToast(`Orçamento #${savedOrcamento.numero} salvo como rascunho.`, 'warning');
            } else {
                showToast(`Orçamento #${savedOrcamento.numero} finalizado com sucesso!`, 'success');
            }

            onOrcamentoSaved(savedOrcamento);

        } catch (error: any) {
            console.error('useOrcamentoForm: Error in handleSave:', error);
            showToast(error.message || 'Erro ao salvar o orçamento.', 'error');
        } finally {
            setIsSaving(false);
        }
    }, [
        selectedCustomerId, selectedSalespersonId, cart, balance, subtotal,
        totalItemDiscounts, total, payments, orcamentoToEdit,
        warrantyTerm, observations, internalObservations, openCashSessionId,
        openCashSessionDisplayId, pendingTradeInProduct, users, onOrcamentoSaved, showToast
    ]);

    return {
        state: {
            orcamentoDate, selectedCustomerId, selectedSalespersonId, cart, productSearch,
            productToConfirm, searchQuantity,
            cardFees, payments, warrantyTerm, observations, internalObservations,
            isCustomerModalOpen, isTradeInProductModalOpen, productForTradeIn,
            pendingTradeInProduct, localSuppliers, isCardPaymentModalOpen,
            cardTransactionType, cardMethodId, paymentInput,
            subtotal, totalItemDiscounts, total, totalPaid, balance,
            isSaving, selectedPriceType
        },
        actions: {
            setOrcamentoDate, setSelectedCustomerId, setSelectedSalespersonId, setCart, setProductSearch,
            setProductToConfirm, setSearchQuantity,
            setWarrantyTerm, setObservations, setInternalObservations,
            setIsCustomerModalOpen, setIsCardPaymentModalOpen, setIsTradeInProductModalOpen, setPaymentInput, setProductForTradeIn,
            handleAddToCart, confirmAddToCart, handleRemoveFromCart, handleCartItemUpdate,
            handleOpenTradeInModal, handleRequestPayment, handleConfirmPayment,
            handleConfirmCardPayment, handleRemovePayment, handleSaveTradeInProduct, handleSaveTradeInFromModal, handleSave,
            setSelectedPriceType, handleCancelReservation, addPayment: (p: Payment) => setPayments(prev => [...prev, p]),

            resetState
        },
        refs: { productSearchRef }
    };
};
