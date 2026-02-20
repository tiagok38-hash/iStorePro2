
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    Product, Customer, User, Sale, Payment, PaymentMethodType,
    Supplier, CartItem, PaymentMethodParameter, CardConfigData,
    AuditActionType, AuditEntityType
} from '../types.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import {
    findOrCreateSupplierFromCustomer, addSale, updateSale, updateProduct, addAuditLog,
    getNextSaleId, cancelSaleReservation
} from '../services/mockApi.ts';
import { useUser } from '../contexts/UserContext.tsx';
import { toDateValue } from '../utils/dateUtils.ts';

interface UseSaleFormProps {
    customers: Customer[];
    users: User[];
    products: Product[];
    suppliers: Supplier[];
    receiptTerms: any[];
    paymentMethods: PaymentMethodParameter[];
    onAddNewCustomer: (data: any) => Promise<Customer | null>;
    onAddProduct: (data: any) => Promise<Product | null>;
    onSaleSaved: (sale: Sale) => void;
    saleToEdit?: Sale | null;
    openCashSessionId?: string | null;
    openCashSessionDisplayId?: number;
}

export const useSaleForm = ({
    customers, users, products, suppliers, receiptTerms, paymentMethods,
    onAddNewCustomer, onAddProduct, onSaleSaved, saleToEdit,
    openCashSessionId, openCashSessionDisplayId
}: UseSaleFormProps) => {
    const { showToast } = useToast();
    const { user } = useUser();
    const productSearchRef = useRef<HTMLInputElement>(null);
    const initializedRef = useRef(false);

    // Form State
    const [saleDate, setSaleDate] = useState(toDateValue());
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [selectedSalespersonId, setSelectedSalespersonId] = useState<string>('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [productToConfirm, setProductToConfirm] = useState<Product | null>(null);
    const [searchQuantity, setSearchQuantity] = useState(1);
    const [globalDiscountType, setGlobalDiscountType] = useState<'R$' | '%'>('R$');
    const [globalDiscountValue, setGlobalDiscountValue] = useState<number>(0);
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
    const [reservedId, setReservedId] = useState<string | null>(null);

    const [paymentInput, setPaymentInput] = useState<{
        method: PaymentMethodType | 'Cartão',
        amount: number,
        cardType?: 'Crédito' | 'Débito',
        internalNote?: string,
        pixVariation?: string,
    } | null>(null);

    const resetState = useCallback(() => {
        setSaleDate(toDateValue());
        setSelectedCustomerId(localStorage.getItem('pos_default_customer_id') || null);
        setSelectedSalespersonId(user?.id || '');
        setCart([]);
        setProductSearch('');
        setProductToConfirm(null);
        setSearchQuantity(1);
        setGlobalDiscountType('R$');
        setGlobalDiscountValue(0);
        setCardFees(0);
        setPayments([]);
        setWarrantyTerm(''); // Reset to empty - user must select
        setObservations('');
        setInternalObservations('');
        setPaymentInput(null);
        setProductForTradeIn(null);
        setPendingTradeInProduct(null);
        setSelectedPriceType('sale');
        setReservedId(null);
    }, []);

    useEffect(() => {
        if (!initializedRef.current) {
            if (saleToEdit) {
                setSaleDate(saleToEdit.date.split('T')[0]);
                setSelectedCustomerId(saleToEdit.customerId);
                setSelectedSalespersonId(saleToEdit.salespersonId);
                const reconstructedCart = saleToEdit.items.map(item => {
                    const product = products.find(p => p.id === item.productId);
                    if (!product) return null;
                    return { ...product, quantity: item.quantity, salePrice: item.unitPrice, discountType: 'R$', discountValue: 0 } as CartItem;
                }).filter((item): item is CartItem => item !== null);
                setCart(reconstructedCart as CartItem[]);
                setGlobalDiscountType('R$');
                setGlobalDiscountValue(saleToEdit.discount); // Note: this simplifies the discount logic back to R$
                setPayments(saleToEdit.payments.map(p => ({ ...p })));
                setWarrantyTerm(saleToEdit.warrantyTerm || '');
                setObservations(saleToEdit.observations || '');
                setInternalObservations(saleToEdit.internalObservations || '');
            } else {
                resetState();
                // Fetch next ID and reserve it
                getNextSaleId(user?.id).then(setReservedId).catch(err => console.error("Error reserving ID:", err));
            }
            initializedRef.current = true;
        }
    }, [saleToEdit, resetState, products, user?.id]);

    const handleCancelReservation = useCallback(async () => {
        if (reservedId && !saleToEdit) {
            await cancelSaleReservation(reservedId);
            setReservedId(null);
        }
    }, [reservedId, saleToEdit]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (reservedId && !saleToEdit) {
                cancelSaleReservation(reservedId);
            }
        };
    }, [reservedId, saleToEdit]);

    useEffect(() => { setLocalSuppliers(suppliers); }, [suppliers]);

    const subtotal = useMemo(() => cart.reduce((total, item) => total + (item.salePrice || 0) * (item.quantity || 0), 0), [cart]);

    const totalItemDiscounts = useMemo(() => cart.reduce((total, item) => {
        const disc = item.discountType === 'R$' ? item.discountValue : ((item.salePrice || 0) * (item.quantity || 0)) * (item.discountValue / 100);
        return total + disc;
    }, 0), [cart]);

    const globalDiscountAmount = useMemo(() => {
        if (globalDiscountType === '%') return (subtotal - totalItemDiscounts) * (globalDiscountValue / 100);
        return globalDiscountValue;
    }, [subtotal, totalItemDiscounts, globalDiscountType, globalDiscountValue]);

    // FIX: Total should NOT include card fees. Card fees are external to the product value.
    const total = useMemo(() => subtotal - totalItemDiscounts - globalDiscountAmount, [subtotal, totalItemDiscounts, globalDiscountAmount]);
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
        if (itemToRemove && saleToEdit && (saleToEdit.status === 'Finalizada' || saleToEdit.status === 'Editada')) {
            showToast(`O produto "${itemToRemove.model}" foi removido e será devolvido ao estoque ao salvar a venda.`, 'warning');
        }
        setCart(prev => prev.filter(item => item.id !== productId));
        setPayments([]); // Clear payments when an item is removed
    }, [cart, saleToEdit, showToast]);

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
            console.error('[useSaleForm] Error in handleOpenTradeInModal:', error);

            // Fallback: Always try to open modal with temporary supplier if API fails
            // This ensures the user is not blocked from adding a trade-in item
            console.warn('[useSaleForm] Using fallback temporary supplier due to error.');

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

    const handleConfirmCardPayment = useCallback(({ payment, feeToAddToSale }: { payment: Payment; feeToAddToSale: number }) => {
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
                        // setCardFees(fees => Math.max(0, fees - paymentToRemove.fees!));
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
            // Store payload to be created upon Sale Finalization.
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

        const baseSaleData = {
            customerId: selectedCustomerId,
            salespersonId: selectedSalespersonId,
            items: cart.map(item => ({
                productId: item.id,
                quantity: item.quantity,
                unitPrice: item.salePrice,
                costPrice: item.costPrice || 0,
                productName: item.model || item.name || '',
                model: item.model || '',
                priceType: item.priceType
            })),
            subtotal, discount: totalItemDiscounts + globalDiscountAmount, total, payments,
            posTerminal: saleToEdit?.posTerminal || 'Caixa 1',
            status: isPending ? 'Pendente' : (saleToEdit && saleToEdit.status !== 'Pendente' ? 'Editada' : 'Finalizada'),
            origin: saleToEdit?.origin || (openCashSessionId ? 'PDV' : 'Balcão'), warrantyTerm, observations, internalObservations,
            cashSessionId: saleToEdit?.cashSessionId || openCashSessionId || undefined,
            cashSessionDisplayId: saleToEdit?.cashSessionDisplayId || openCashSessionDisplayId || undefined,
            id: saleToEdit?.id || reservedId || undefined
        };

        setIsSaving(true);
        try {
            // PROCESS DEFERRED TRADE-INS
            // Filter payments that have newProductPayload
            const processedPayments = await Promise.all(payments.map(async (p) => {
                if (p.method === 'Aparelho na Troca' && p.tradeInDetails?.newProductPayload) {
                    try {
                        console.log('Creating deferred Trade-in Product:', p.tradeInDetails.model);
                        const created = await onAddProduct(p.tradeInDetails.newProductPayload);
                        if (created) {
                            // Update payment with real ID and remove payload to avoid cluttering DB
                            const { newProductPayload, ...restDetails } = p.tradeInDetails;
                            return {
                                ...p,
                                tradeInDetails: {
                                    ...restDetails,
                                    productId: created.id
                                }
                            };
                        }
                    } catch (err) {
                        console.error('Error creating deferred trade-in product:', err);
                        throw new Error(`Erro ao criar produto de troca: ${p.tradeInDetails.model}`);
                    }
                }
                return p;
            }));

            // Update baseSaleData with processed payments
            baseSaleData.payments = processedPayments;

            let savedSale: Sale;
            if (saleToEdit) {
                savedSale = await updateSale(
                    { ...saleToEdit, ...baseSaleData, status: baseSaleData.status as any, oldStatus: saleToEdit.status },
                    user?.id,
                    user?.name
                );
            } else {
                savedSale = await addSale(baseSaleData as any, user?.id, user?.name);
            }

            if (savedSale) {
                const salesperson = users.find(u => u.id === selectedSalespersonId);
                // Log all trade-in products linked to this sale
                for (const p of savedSale.payments) {
                    if (p.method === 'Aparelho na Troca' && p.tradeInDetails?.productId) {
                        // Skip if it was already a real ID (not created just now)?
                        // Actually, logging it again as "Linked" is fine, or we can assume if it's in this sale it's relevant.
                        // Ideally we only log for NEWly created ones, but 'Produto vinculado' implies connection.

                        // If we want only the ones we just created, we'd need to track them.
                        // But since we are finalizing the sale, logging the link is appropriate for all trade-ins in this sale.
                        await addAuditLog(
                            AuditActionType.STOCK_LAUNCH,
                            AuditEntityType.PRODUCT,
                            p.tradeInDetails.productId,
                            `Produto vinculado à venda de origem #${savedSale.id}. Usuário resp.: ${user?.name || salesperson?.name || 'Sistema'}`,
                            user?.id || salesperson?.id || 'system',
                            user?.name || salesperson?.name || 'Sistema'
                        );
                    }
                }
            }

            // Show success notification with appropriate color based on status
            if (isPending) {
                showToast(`Venda #${savedSale.id} salva como pendente.`, 'warning');
            } else {
                showToast(`Venda #${savedSale.id} finalizada com sucesso!`, 'success');
            }

            setReservedId(null);
            onSaleSaved(savedSale);

        } catch (error: any) {
            console.error('useSaleForm: Error in handleSave:', error);
            showToast(error.message || 'Erro ao salvar a venda.', 'error');
        } finally {
            setIsSaving(false);
        }
    }, [
        selectedCustomerId, selectedSalespersonId, cart, balance, subtotal,
        totalItemDiscounts, globalDiscountAmount, total, payments, saleToEdit,
        warrantyTerm, observations, internalObservations, openCashSessionId,
        openCashSessionDisplayId, pendingTradeInProduct, users, onSaleSaved, showToast
    ]);

    return {
        state: {
            saleDate, selectedCustomerId, selectedSalespersonId, cart, productSearch,
            productToConfirm, searchQuantity, globalDiscountType, globalDiscountValue,
            cardFees, payments, warrantyTerm, observations, internalObservations,
            isCustomerModalOpen, isTradeInProductModalOpen, productForTradeIn,
            pendingTradeInProduct, localSuppliers, isCardPaymentModalOpen,
            cardTransactionType, cardMethodId, paymentInput,
            subtotal, totalItemDiscounts, globalDiscountAmount, total, totalPaid, balance,
            isSaving, selectedPriceType, reservedId
        },
        actions: {
            setSaleDate, setSelectedCustomerId, setSelectedSalespersonId, setCart, setProductSearch,
            setProductToConfirm, setSearchQuantity, setGlobalDiscountType, setGlobalDiscountValue,
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
