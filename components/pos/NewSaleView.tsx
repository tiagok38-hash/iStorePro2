
import React, { useMemo } from 'react';
import {
    Product, Customer, User, Sale, PermissionProfile,
    Brand, Category, ProductModel, Grade, GradeValue,
    Supplier, ReceiptTermParameter, PaymentMethodParameter
} from '../../types.ts';
import { formatCurrency, getNextSaleId } from '../../services/mockApi.ts';
import {
    PlusIcon, MinusIcon, EditIcon, ShoppingCartIcon, CalculatorIcon, CreditCardIcon,
    TrashIcon, SearchIcon, XCircleIcon, CheckIcon, DeviceExchangeIcon, ChevronDownIcon, ChevronRightIcon
} from '../icons.tsx';
import { useToast } from '../../contexts/ToastContext.tsx';
import SearchableDropdown from '../SearchableDropdown.tsx';
import CurrencyInput from '../CurrencyInput.tsx';
import CustomerModal from '../CustomerModal.tsx';
import CustomDatePicker from '../CustomDatePicker.tsx';
import { toDateValue } from '../../utils/dateUtils.ts';
import ProductModal from '../ProductModal.tsx';
import CardPaymentModal from '../CardPaymentModal.tsx';
import NewCreditModal from '../modals/NewCreditModal.tsx';
import CreditLimitWarning from '../modals/CreditLimitWarning.tsx';
import { checkCreditLimit } from '../../utils/creditUtils.ts';


import { useSaleForm } from '../../hooks/useSaleForm.ts';
import { getPaymentIcon } from './utils';

interface NewSaleViewProps {
    onCancel: () => void;
    onSaleSaved: (sale: Sale) => void;
    customers: Customer[];
    users: User[];
    products: Product[];
    suppliers: Supplier[];
    permissionProfiles: PermissionProfile[];
    brands: Brand[];
    categories: Category[];
    productModels: ProductModel[];
    grades: Grade[];
    gradeValues: GradeValue[];
    receiptTerms: ReceiptTermParameter[];
    onAddNewCustomer: (data: any) => Promise<Customer | null>;
    onAddProduct: (data: any) => Promise<Product | null>;
    openCashSessionId?: string | null;
    openCashSessionDisplayId?: number;
    saleToEdit?: Sale | null;
    paymentMethods: PaymentMethodParameter[];
    onUpdateCustomer?: (data: any) => Promise<Customer | null>;
}

export const NewSaleView: React.FC<NewSaleViewProps> = (props) => {
    const {
        customers, users, products, brands, categories, productModels,
        grades, gradeValues, receiptTerms, paymentMethods, onAddNewCustomer
    } = props;

    const [matchingUnits, setMatchingUnits] = React.useState<Product[]>([]);
    const [isSelectingUnit, setIsSelectingUnit] = React.useState(false);
    const [customerToEdit, setCustomerToEdit] = React.useState<Customer | null>(null);
    const [isCreditModalOpen, setIsCreditModalOpen] = React.useState(false);
    const [creditMethodSelected, setCreditMethodSelected] = React.useState<'Crediário' | 'Promissória'>('Crediário');
    const [creditWarning, setCreditWarning] = React.useState<{ isOpen: boolean, customerName: string, creditLimit: number, creditUsed: number, purchaseAmount: number } | null>(null);
    const [variationModalConfig, setVariationModalConfig] = React.useState<{ isOpen: boolean, method: string, variations: string[] } | null>(null);


    const { showToast } = useToast();
    const { state, actions, refs } = useSaleForm(props);

    const {
        saleDate, selectedCustomerId, selectedSalespersonId, cart, productSearch,
        productToConfirm, searchQuantity,
        payments, warrantyTerm, observations, internalObservations,
        isCustomerModalOpen, isTradeInProductModalOpen, productForTradeIn,
        localSuppliers, isCardPaymentModalOpen, cardTransactionType, cardMethodId,
        paymentInput, subtotal, totalItemDiscounts, total,
        totalPaid, balance, isSaving, selectedPriceType, reservedId,
        editReason, isEditReasonModalOpen, pendingTargetStatus
    } = state;

    const {
        setSaleDate, setSelectedCustomerId, setSelectedSalespersonId, setProductSearch,
        setSearchQuantity,
        setWarrantyTerm, setObservations, setInternalObservations,
        setIsCustomerModalOpen, setIsCardPaymentModalOpen, setIsTradeInProductModalOpen, setPaymentInput, setProductForTradeIn,
        handleAddToCart, confirmAddToCart, handleRemoveFromCart, handleCartItemUpdate,
        handleRequestPayment, handleConfirmPayment, handleConfirmCardPayment,
        handleRemovePayment, handleSaveTradeInProduct, handleSave, setSelectedPriceType,
        handleCancelReservation, addPayment,
        setEditReason, setIsEditReasonModalOpen
    } = actions;

    const handleCancelVenda = () => {
        handleCancelReservation();
        props.onCancel();
    };

    const handleSelectUnit = (product: Product) => {
        handleAddToCart(product);
        setIsSelectingUnit(false);
        setMatchingUnits([]);
        setProductSearch('');
    };


    const { productSearchRef } = refs;

    const filteredProducts = useMemo(() => {
        const terms = productSearch.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
        if (terms.length === 0) return [];

        const cartProductIds = new Set(cart.map(item => item.id));

        const matches = products.filter(p => {
            const isUnique = !!((p.serialNumber || '').trim() || (p.imei1 || '').trim());
            if (isUnique && cartProductIds.has(p.id)) return false;

            const searchableText = [
                p.model || '',
                p.imei1 || '',
                p.serialNumber || '',
                p.brand || '',
                p.color || '',
                p.condition || '',
                p.storage || '',
                (p.barcodes || []).join(' '),
                p.warnings || '' // Include warnings if relevant? Maybe observations?
            ].join(' ').toLowerCase();

            return terms.every(term => searchableText.includes(term)) && p.stock > 0;
        });

        // Group non-unique products with same model and 3 prices
        const groupedMap: Record<string, Product> = {};
        const finalResults: Product[] = [];

        matches.forEach(p => {
            const isUnique = !!((p.serialNumber || '').trim() || (p.imei1 || '').trim());

            if (isUnique) {
                // Unique products (Apple or Non-Apple with IMEI/SN) stay as separate lines
                finalResults.push(p);
            } else {
                // Non-unique products (accessories, etc.) are grouped
                // But only if they also share the SAME grades/variations
                const modelKey = (p.model || '').trim().toLowerCase();
                const conditionKey = (p.condition || '').trim().toLowerCase();
                const colorKey = (p.color || '').trim().toLowerCase();
                const storageKey = (p.storage || '');
                const warrantyKey = (p.warranty || '').trim().toLowerCase();
                const pricesKey = `${p.price}-${p.wholesalePrice || 0}-${p.costPrice || 0}`;

                // Add variations to the grouping key
                const variationsKey = (p.variations || [])
                    .map(v => `${v.gradeId}:${v.valueId}`)
                    .sort()
                    .join('|');

                const key = `${modelKey}-${conditionKey}-${colorKey}-${storageKey}-${pricesKey}-${variationsKey}-${warrantyKey}`;

                if (!groupedMap[key]) {
                    groupedMap[key] = { ...p };
                } else {
                    groupedMap[key].stock += p.stock;
                }
            }
        });

        return [...finalResults, ...Object.values(groupedMap)];
    }, [products, productSearch, cart]);

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const term = productSearch.trim().toLowerCase();
            if (!term) return;

            // Encontrar TODOS os matches (EAN, IMEI ou SN)
            const matches = products.filter(p =>
                (p.barcodes || []).some(b => b.toLowerCase() === term) ||
                (p.imei1 || '').toLowerCase() === term ||
                (p.serialNumber || '').toLowerCase() === term
            ).filter(p => {
                // Se for único, não pode estar no carrinho
                const isUnique = !!((p.serialNumber || '').trim() || (p.imei1 || '').trim());
                if (isUnique && cart.some(item => item.id === p.id)) return false;
                return p.stock > 0;
            });

            if (matches.length === 1) {
                handleAddToCart(matches[0]);
                setProductSearch('');
                return;
            }

            if (matches.length > 1) {
                // Se o termo for especificamente um IMEI ou SN único que deu match em mais de um (improvável mas possível se houver erro de dados)
                // daremos prioridade ao match exato de IMEI/SN se houver.
                const exactImeiSnMatch = matches.find(p =>
                    (p.imei1 || '').toLowerCase() === term ||
                    (p.serialNumber || '').toLowerCase() === term
                );

                if (exactImeiSnMatch) {
                    handleAddToCart(exactImeiSnMatch);
                    setProductSearch('');
                    return;
                }

                setMatchingUnits(matches);
                setIsSelectingUnit(true);
                return;
            }

            // Se for apenas 1 resultado na lista filtrada lateral
            if (filteredProducts.length === 1) {
                const p = filteredProducts[0];
                if (p.stock > 0) {
                    handleAddToCart(p);
                    setProductSearch('');
                }
            }
        }
    };

    const paymentButtons = useMemo(() => {
        const dynamic = [];
        const cardMethods = paymentMethods.filter(p => p.active && p.type === 'card');
        const otherMethods = paymentMethods.filter(p => p.active && p.type !== 'card');

        otherMethods.forEach(p => {
            const lowerName = p.name.toLowerCase();
            if (lowerName === 'débito' || lowerName === 'debito' || lowerName.includes('cartão débito') || lowerName.includes('cartão de débito')) return;
            dynamic.push({ label: p.name, icon: getPaymentIcon(p.name, p.type) });
        });

        if (cardMethods.length > 0) {
            dynamic.push({ label: 'Cartão', icon: <CreditCardIcon /> });
        }

        if (!dynamic.find(d => d.label === 'Aparelho na Troca')) {
            dynamic.push({ label: 'Aparelho na Troca', icon: <DeviceExchangeIcon /> });
        }

        // Ensure Crediário/Promissória is visible or added if not in paymentMethods (though it should be)
        if (!dynamic.find(d => d.label === 'Crediário' || d.label === 'Promissória')) {
            dynamic.push({ label: 'Crediário', icon: <div className="text-[10px] font-black border-2 border-current px-1 rounded">CRE</div> });
        }

        return dynamic;
    }, [paymentMethods]);

    const inputClasses = "w-full px-4 border rounded-xl bg-white border-gray-300 text-sm h-12 focus:ring-2 focus:ring-success/20 outline-none transition-all font-bold text-gray-800 shadow-sm box-border";
    const labelClasses = "block text-[11px] font-black text-gray-800 mb-1.5 uppercase tracking-wider";

    const totalFees = useMemo(() => payments.reduce((sum, p) => sum + (p.fees || 0), 0), [payments]);


    return (
        <React.Fragment>
            <div className="glass-card rounded-3xl shadow-lg overflow-hidden animate-slide-up">
                <div className="p-2 md:p-4 space-y-3 md:space-y-4">
                    <section>
                        <div className="flex items-center justify-between mb-1 sm:mb-2 pb-1.5 sm:pb-2 border-b border-gray-100">
                            <h3 className="flex items-center gap-2 font-bold text-gray-800 uppercase text-[10px] sm:text-xs tracking-widest">
                                <EditIcon className="h-3.5 w-3.5 text-success" />
                                {props.saleToEdit ? `Dados da Venda #${props.saleToEdit.id}` : (reservedId ? `Dados da Nova Venda #${reservedId.replace('ID-', '')}` : 'Dados da Venda')}
                            </h3>
                            <button
                                type="button"
                                onClick={handleCancelVenda}
                                className="p-1 hover:bg-red-50 text-red-400 rounded-full transition-colors"
                            >
                                <XCircleIcon className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-4 bg-white/40 p-1 rounded-xl">
                            <div className="md:col-span-2">
                                <label className={labelClasses}>Data</label>
                                <CustomDatePicker
                                    value={saleDate}
                                    onChange={setSaleDate}
                                    max={toDateValue()}
                                    className="w-full"
                                />
                            </div>
                            <div className="md:col-span-7 flex flex-col justify-end">
                                <label className={labelClasses}>Cliente Selecionado*</label>
                                <div className="flex items-stretch gap-2 h-10 sm:h-12">
                                    <div className="flex-grow h-full text-xs sm:text-sm">
                                        <SearchableDropdown
                                            options={customers.filter(c => c.active !== false || c.id === selectedCustomerId).map(c => ({ value: c.id, label: `${c.name}${c.phone ? ` | ${c.phone}` : ''}` }))}
                                            value={selectedCustomerId}
                                            onChange={setSelectedCustomerId}
                                            placeholder="Busque pelo nome..."
                                            className={!selectedCustomerId ? "bg-red-50 border-red-300 ring-2 ring-red-100 placeholder:text-red-400" : ""}
                                        />
                                    </div>
                                    <button type="button" onClick={() => { setCustomerToEdit(null); setIsCustomerModalOpen(true); }} className="w-10 sm:w-12 h-full bg-success-light text-success rounded-xl hover:bg-success hover:text-white transition-all flex items-center justify-center border border-success/20 shadow-sm flex-shrink-0"><PlusIcon className="h-5 w-5" /></button>
                                </div>
                            </div>
                            <div className="md:col-span-3 flex flex-col justify-end">
                                <label className={labelClasses}>Vendedor*</label>
                                <select value={selectedSalespersonId} onChange={e => setSelectedSalespersonId(e.target.value)} className={`${inputClasses} h-10 sm:h-12 cursor-pointer appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:1em_1em]`} disabled={!selectedCustomerId}>
                                    <option value="">Selecione...</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </section>

                    <fieldset disabled={!selectedCustomerId || !selectedSalespersonId} className="space-y-4 disabled:opacity-50 transition-opacity">
                        <section>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="flex items-center gap-2 font-bold text-gray-800 uppercase text-[10px] sm:text-xs tracking-widest"><ShoppingCartIcon className="h-4 w-4 text-success" /> Carrinho</h3>
                            </div>
                            <div className="flex items-end gap-2 mb-2">
                                <div className="flex-grow relative">
                                    <label className={labelClasses}>Pesquisar Produto (Modelo, IMEI, SN)</label>
                                    <div className="relative">
                                        <input ref={productSearchRef} type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} onKeyDown={handleSearchKeyDown} placeholder="Ex: iPhone 14 Pro..." className={`${inputClasses} pl-9 h-10 sm:h-12`} />
                                        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
                                    </div>
                                    {filteredProducts.length > 0 && (
                                        <div className="absolute z-30 w-full bg-white border border-gray-200 rounded-xl mt-1 shadow-xl max-h-60 overflow-y-auto overflow-x-hidden">
                                            {filteredProducts.map(p => (
                                                <div key={p.id} className="w-full p-2.5 hover:bg-success-light text-left transition-colors border-b last:border-0 border-gray-50 flex justify-between items-center group">
                                                    <div className="flex flex-col gap-1 cursor-pointer flex-grow" onClick={() => { handleAddToCart(p); setProductSearch(''); }}>
                                                        <p className="font-bold text-gray-900 text-base md:text-lg group-hover:text-success transition-colors leading-tight">{p.model}</p>
                                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-xl text-[11px] md:text-xs font-black border border-emerald-100 uppercase tracking-tighter">
                                                                Estoque: {p.stock}
                                                            </span>
                                                            {(p.serialNumber || p.imei1 || (p.variations && p.variations.length > 0) || p.condition || p.warranty || p.supplierId) && (
                                                                <div className="text-[10px] md:text-xs text-muted flex items-center gap-1.5 font-medium bg-gray-50 px-2 py-0.5 rounded-xl border border-gray-100 flex-wrap">
                                                                    {p.condition && (
                                                                        <span className="text-gray-950 font-black uppercase tracking-tighter">{p.condition}</span>
                                                                    )}
                                                                    {p.warranty && (
                                                                        <>
                                                                            {p.condition && <span className="opacity-30">|</span>}
                                                                            <span className="text-blue-700 font-bold">{p.warranty}</span>
                                                                        </>
                                                                    )}
                                                                    {p.serialNumber && (
                                                                        <>
                                                                            {(p.condition || p.warranty) && <span className="opacity-30">|</span>}
                                                                            <span>SN: {p.serialNumber}</span>
                                                                        </>
                                                                    )}
                                                                    {p.imei1 && (
                                                                        <>
                                                                            {(p.condition || p.warranty || p.serialNumber) && <span className="opacity-30">|</span>}
                                                                            <span>IMEI: {p.imei1}</span>
                                                                        </>
                                                                    )}
                                                                    {p.variations && p.variations.length > 0 && (
                                                                        <>
                                                                            {(p.condition || p.warranty || p.serialNumber || p.imei1) && <span className="opacity-30">|</span>}
                                                                            <span className="italic text-gray-800 font-bold uppercase tracking-tighter">
                                                                                {p.variations.map(v => v.valueName ? `${v.gradeName}: ${v.valueName}` : v.gradeName).join(', ')}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                    {p.batteryHealth !== undefined && p.batteryHealth > 0 && (p.brand || '').toLowerCase().includes('apple') && (
                                                                        <>
                                                                            {(p.condition || p.warranty || p.serialNumber || p.imei1 || p.variations?.length) && <span className="opacity-30">|</span>}
                                                                            <span className={`font-bold ${p.batteryHealth < 80 ? 'text-red-500' : 'text-green-600'}`}>
                                                                                Saúde: {p.batteryHealth}%
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                    {p.supplierId && (
                                                                        <>
                                                                            {(p.condition || p.warranty || p.serialNumber || p.imei1 || p.variations?.length || (p.batteryHealth !== undefined && p.batteryHealth > 0 && (p.brand || '').toLowerCase().includes('apple'))) && <span className="opacity-30">|</span>}
                                                                            <span className="text-purple-600 font-bold uppercase tracking-tighter" title="Fornecedor">
                                                                                {props.suppliers?.find(s => s.id === p.supplierId)?.name || 'Fornec. Desconhecido'}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 ml-4">
                                                        <span
                                                            className="font-black text-primary text-base md:text-xl tabular-nums ml-2 cursor-pointer whitespace-nowrap"
                                                            onClick={() => { handleAddToCart(p); setProductSearch(''); }}
                                                        >
                                                            {formatCurrency(p.price)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="w-16 md:w-20 flex-shrink-0"><label className={labelClasses}>QTD.</label><input type="number" value={searchQuantity} onChange={e => setSearchQuantity(Number(e.target.value))} min="1" className={`${inputClasses} h-10 sm:h-12 text-center font-bold`} /></div>
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block glass-panel border border-white/20 rounded-xl overflow-x-auto bg-gray-50/30">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100/80 text-gray-800 font-black uppercase text-[10px] tracking-tighter">
                                        <tr className="text-left border-b border-gray-200">
                                            <th className="px-4 py-3 w-[40%]">ITEM / DESCRIÇÃO</th>
                                            <th className="px-4 py-3 text-center w-24">QTD.</th>
                                            <th className="px-4 py-3 text-center w-[180px]">PREÇO UNITÁRIO</th>
                                            <th className="px-4 py-3 text-center w-[140px]">DESCONTO</th>
                                            <th className="px-4 py-3 text-right w-40">SUBTOTAL</th>
                                            <th className="px-4 py-3 text-center w-20">AÇÃO</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {cart.length === 0 ? (
                                            <tr><td colSpan={7} className="px-4 py-12 text-center text-muted italic">Carrinho vazio. Adicione produtos acima.</td></tr>
                                        ) : cart.map(item => (
                                            <tr key={item.id} className="bg-white hover:bg-gray-50/50 transition-colors">
                                                <td className="px-4 py-3 overflow-hidden">
                                                    <div className="flex flex-col truncate">
                                                        <span className="font-black text-[15px] text-gray-900 truncate" title={item.model}>{item.model}</span>
                                                        <div className="text-[11px] font-bold text-gray-600 flex flex-col gap-0.5 mt-1">
                                                            {item.serialNumber && <span className="truncate">SN: <span className="font-mono text-gray-700">{item.serialNumber}</span></span>}
                                                            {item.imei1 && <span className="truncate">IMEI: <span className="font-mono text-gray-700">{item.imei1}</span></span>}
                                                            <div className="flex items-center gap-2 truncate">
                                                                {item.condition && <span>{item.condition}</span>}
                                                                {item.batteryHealth !== undefined && item.batteryHealth !== null && item.condition !== 'Novo' && (
                                                                    <span>| Bat: <span className={`${item.batteryHealth < 80 ? 'text-red-500 font-bold' : 'text-green-600 font-bold'}`}>{item.batteryHealth}%</span></span>
                                                                )}
                                                                {item.variations && item.variations.length > 0 && (
                                                                    <>
                                                                        <span className="opacity-30">|</span>
                                                                        <span className="italic text-gray-800 font-bold uppercase tracking-tighter">
                                                                            {item.variations.map(v => v.valueName ? `${v.gradeName}: ${v.valueName}` : v.gradeName).join(', ')}
                                                                        </span>
                                                                    </>
                                                                )}
                                                                {item.supplierId && (
                                                                    <>
                                                                        <span className="opacity-30">|</span>
                                                                        <span className="text-purple-600 font-bold uppercase tracking-tighter" title="Fornecedor">
                                                                            {props.suppliers?.find(s => s.id === item.supplierId)?.name || 'Fornec. Desconhecido'}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center font-bold text-gray-800">
                                                    {(item.serialNumber || item.imei1) ? (
                                                        item.quantity
                                                    ) : (
                                                        <div className="flex items-center justify-center border rounded-xl bg-white border-gray-300 h-9 w-32 mx-auto overflow-hidden shadow-sm">
                                                            <button
                                                                onClick={() => handleCartItemUpdate(item.id, 'quantity', Math.max(1, (item.quantity || 1) - 1))}
                                                                className="h-full w-9 hover:bg-gray-100 text-gray-600 hover:text-red-600 transition-colors border-r border-gray-200 flex items-center justify-center shrink-0"
                                                            >
                                                                <MinusIcon className="h-3.5 w-3.5" />
                                                            </button>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={item.quantity}
                                                                onChange={(e) => handleCartItemUpdate(item.id, 'quantity', e.target.value)}
                                                                className="w-full h-full text-center outline-none font-black text-gray-900 text-sm bg-transparent appearance-none"
                                                            />
                                                            <button
                                                                onClick={() => handleCartItemUpdate(item.id, 'quantity', (item.quantity || 1) + 1)}
                                                                className="h-full w-9 hover:bg-gray-100 text-gray-600 hover:text-emerald-600 transition-colors border-l border-gray-200 flex items-center justify-center shrink-0"
                                                            >
                                                                <PlusIcon className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-center">
                                                        <div className="w-[160px]">
                                                            <CurrencyInput
                                                                value={item.salePrice}
                                                                onChange={(val) => handleCartItemUpdate(item.id, 'salePrice', val || 0)}
                                                                className="text-left font-black"
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-center items-center h-10">
                                                        <select
                                                            value={item.discountType}
                                                            onChange={e => handleCartItemUpdate(item.id, 'discountType', e.target.value)}
                                                            className="bg-gray-50 text-gray-700 text-xs px-2 h-full rounded-l-xl border border-gray-300 focus:ring-0 outline-none font-bold"
                                                        >
                                                            <option>R$</option>
                                                            <option>%</option>
                                                        </select>
                                                        <input
                                                            type="number"
                                                            value={item.discountValue || ''}
                                                            onChange={e => handleCartItemUpdate(item.id, 'discountValue', Number(e.target.value) || 0)}
                                                            className="w-[80px] h-full text-center outline-none font-black text-gray-900 text-sm border border-l-0 border-gray-300 rounded-r-xl"
                                                            min="0"
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-black text-gray-900 tabular-nums text-base">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {item.priceType === 'cost' && (
                                                            <span className="w-14 text-center py-1 text-[8px] bg-sky-50 text-sky-600 rounded-xl border border-sky-100 font-black uppercase tracking-tighter leading-none shrink-0">Custo</span>
                                                        )}
                                                        {item.priceType === 'wholesale' && (
                                                            <span className="w-14 text-center py-1 text-[8px] bg-orange-50 text-orange-600 rounded-xl border border-orange-100 font-black uppercase tracking-tighter leading-none shrink-0">Atacado</span>
                                                        )}
                                                        <span>
                                                            {formatCurrency(
                                                                ((item.salePrice || 0) * (item.quantity || 0)) -
                                                                (item.discountType === 'R$'
                                                                    ? item.discountValue
                                                                    : ((item.salePrice || 0) * (item.quantity || 0)) * (item.discountValue / 100))
                                                            )}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={() => handleRemoveFromCart(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-full border border-red-100 transition-all shadow-sm"><XCircleIcon className="h-5 w-5" /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card-Based View */}
                            <div className="md:hidden space-y-2 max-h-[35vh] overflow-y-auto pr-1 -mr-1 custom-scrollbar">
                                {cart.length === 0 ? (
                                    <div className="p-8 text-center text-muted italic bg-gray-50 rounded-xl border border-dashed border-gray-200">Carrinho vazio.</div>
                                ) : cart.map(item => (
                                    <div key={item.id} className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-sm space-y-2">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <h4 className="font-black text-gray-900 text-[13px] leading-tight break-words">{item.model}</h4>
                                                <div className="text-[10px] text-muted space-y-0.5 mt-1 capitalize">
                                                    {item.serialNumber && <p>SN: <span className="font-mono text-gray-600">{item.serialNumber}</span></p>}
                                                    {item.imei1 && <p>IMEI: <span className="font-mono text-gray-600">{item.imei1}</span></p>}
                                                    <p>
                                                        {item.condition} {item.batteryHealth !== undefined && item.batteryHealth !== null && (
                                                            <span className={`font-bold ${item.batteryHealth < 80 ? 'text-red-500' : 'text-green-600'}`}>| Bat: {item.batteryHealth}%</span>
                                                        )}
                                                        {item.variations && item.variations.length > 0 && (
                                                            <span className="italic text-gray-800 font-bold uppercase tracking-tighter">
                                                                {" | "}{item.variations.map(v => v.valueName ? `${v.gradeName}: ${v.valueName}` : v.gradeName).join(', ')}
                                                            </span>
                                                        )}
                                                        {item.supplierId && (
                                                            <span className="text-purple-600 font-bold uppercase tracking-tighter" title="Fornecedor">
                                                                {" | "}{props.suppliers?.find(s => s.id === item.supplierId)?.name || 'Fornec. Desconhecido'}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <button onClick={() => handleRemoveFromCart(item.id)} className="p-1 text-red-500 bg-red-50 rounded-xl flex-shrink-0"><XCircleIcon className="h-5 w-5" /></button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 items-end pt-2 border-t border-gray-50">
                                            <div>
                                                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">Preço Unitário</label>
                                                <CurrencyInput
                                                    value={item.salePrice}
                                                    onChange={(val) => handleCartItemUpdate(item.id, 'salePrice', val || 0)}
                                                    className="font-bold text-center !bg-gray-50"
                                                />
                                            </div>
                                            <div className="text-right">
                                                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">
                                                    {(item.serialNumber || item.imei1) ? `Total (QTD: ${item.quantity})` : 'Quantidade / Total'}
                                                </label>
                                                <div className="flex items-center justify-end gap-2">
                                                    {!(item.serialNumber || item.imei1) && (
                                                        <div className="flex items-center border rounded-xl bg-white border-gray-300 h-8 w-28 overflow-hidden shadow-sm">
                                                            <button
                                                                onClick={() => handleCartItemUpdate(item.id, 'quantity', Math.max(1, (item.quantity || 1) - 1))}
                                                                className="h-full w-8 hover:bg-gray-100 text-gray-600 hover:text-red-600 transition-colors border-r border-gray-200 flex items-center justify-center shrink-0"
                                                            >
                                                                <MinusIcon className="h-3 w-3" />
                                                            </button>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={item.quantity}
                                                                onChange={(e) => handleCartItemUpdate(item.id, 'quantity', e.target.value)}
                                                                className="w-full h-full text-center outline-none font-black text-gray-900 text-xs bg-transparent appearance-none"
                                                            />
                                                            <button
                                                                onClick={() => handleCartItemUpdate(item.id, 'quantity', (item.quantity || 1) + 1)}
                                                                className="h-full w-8 hover:bg-gray-100 text-gray-600 hover:text-emerald-600 transition-colors border-l border-gray-200 flex items-center justify-center shrink-0"
                                                            >
                                                                <PlusIcon className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="font-black text-[15px] text-primary tabular-nums flex items-center justify-end gap-1.5 item-total-price">
                                                        {item.priceType === 'cost' && (
                                                            <span className="w-12 text-center py-0.5 text-[7px] bg-sky-50 text-sky-600 rounded-xl border border-sky-100 font-black uppercase tracking-tighter leading-none shrink-0">Custo</span>
                                                        )}
                                                        {item.priceType === 'wholesale' && (
                                                            <span className="w-12 text-center py-0.5 text-[7px] bg-orange-50 text-orange-600 rounded-xl border border-orange-100 font-black uppercase tracking-tighter leading-none shrink-0">Atacado</span>
                                                        )}
                                                        <span>
                                                            {formatCurrency(
                                                                ((item.salePrice || 0) * (item.quantity || 0)) -
                                                                (item.discountType === 'R$'
                                                                    ? item.discountValue
                                                                    : ((item.salePrice || 0) * (item.quantity || 0)) * (item.discountValue / 100))
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                            <section className="lg:col-span-2">
                                <h3 className="flex items-center gap-2 font-bold text-gray-800 mb-2 pb-1 border-b border-gray-100 uppercase text-[10px] sm:text-xs tracking-widest"><CalculatorIcon className="h-4 w-4 text-success" /> Financeiro</h3>

                                <div className="glass-panel bg-white/40 rounded-3xl p-3 sm:p-4 space-y-2 sm:space-y-3 shadow-sm border border-white/20">
                                    <div className="flex justify-between items-center text-gray-600 border-b border-gray-50 pb-2 sm:pb-3">
                                        <span className="text-xs sm:text-sm font-bold">Subtotal</span>
                                        <span className="text-sm sm:text-base font-bold text-gray-800">{formatCurrency(subtotal)}</span>
                                    </div>
                                    {subtotal - total > 0 && (
                                        <div className="flex justify-between items-center text-red-500 border-b border-gray-50 pb-2 sm:pb-3">
                                            <span className="text-xs sm:text-sm font-bold">Descontos (Itens)</span>
                                            <span className="text-sm sm:text-base font-bold text-red-600">-{formatCurrency(subtotal - total)}</span>
                                        </div>
                                    )}
                                    {totalFees > 0 && (
                                        <div className="flex justify-between items-center text-blue-500 text-[10px] sm:text-xs">
                                            <span className="font-bold uppercase tracking-wider">Juros (Maquininha)</span>
                                            <span className="font-bold">{formatCurrency(totalFees)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100">
                                        <span className="text-base sm:text-lg uppercase font-black tracking-widest text-success leading-none">Total</span>
                                        <span className="text-xl sm:text-3xl font-black text-gray-900 leading-none">{formatCurrency(total)}</span>
                                    </div>
                                </div>
                            </section>

                            <section className="lg:col-span-3">
                                <h3 className="flex items-center gap-2 font-bold text-gray-800 mb-2 pb-1 border-b border-gray-100 uppercase text-[10px] sm:text-xs tracking-widest"><CreditCardIcon className="h-4 w-4 text-success" /> Pagamento</h3>
                                <div className="space-y-2">
                                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1.5 sm:gap-2">
                                        {paymentButtons.map(({ label, icon }) => (
                                            <button
                                                key={label}
                                                type="button"
                                                onClick={() => {
                                                    if (label === 'Crediário' || label === 'Promissória') {
                                                        if (balance <= 0.01) {
                                                            showToast('Não há saldo pendente para parcelar.', 'error');
                                                            return;
                                                        }

                                                        // Validação de Limite de Crédito movida para dentro do Modal
                                                        // Apenas verificamos se o cliente existe
                                                        const customerForCredit = customers.find(c => c.id === selectedCustomerId);
                                                        if (!customerForCredit) {
                                                            alert('Selecione um cliente para prosseguir.');
                                                            return;
                                                        }

                                                        setCreditMethodSelected(label as 'Crediário' | 'Promissória');
                                                        setIsCreditModalOpen(true);

                                                    } else {
                                                        const methodParam = paymentMethods.find(p => p.name === label);
                                                        if (methodParam?.variations && methodParam.variations.length > 0) {
                                                            setVariationModalConfig({ isOpen: true, method: label, variations: methodParam.variations });
                                                        } else {
                                                            handleRequestPayment(label);
                                                        }
                                                    }
                                                }}
                                                disabled={cart.length === 0}
                                                className="w-full p-1.5 py-2 rounded-xl border border-gray-200 hover:border-success hover:bg-success-light transition-all flex flex-col items-center justify-center gap-1 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-gray-200 min-h-[58px] sm:min-h-[64px]"
                                            >
                                                <div className="p-1 rounded bg-gray-50 group-hover:bg-white group-disabled:bg-gray-50 transition-colors">{React.cloneElement(icon as React.ReactElement, { className: "h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-500 group-hover:text-success group-disabled:text-gray-400" })}</div>
                                                <span className="text-[7.5px] sm:text-[9px] font-black uppercase text-gray-600 group-hover:text-success group-disabled:text-gray-400 text-center leading-[1.1] sm:leading-tight line-clamp-2">{label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {paymentInput && (
                                        <div className="p-2 bg-success-light border border-success/30 rounded-xl flex items-end gap-2 animate-slide-down">
                                            <div className="flex-grow">
                                                <label className="text-[9px] font-bold text-success-dark mb-1 block">
                                                    Valor ({paymentInput.method}
                                                    {paymentInput.pixVariation && <span className="text-[8px] font-normal ml-1 opacity-80">- {paymentInput.pixVariation}</span>}
                                                    )
                                                </label>
                                                <CurrencyInput value={paymentInput.amount} onChange={v => setPaymentInput(p => p ? { ...p, amount: v || 0 } : null)} />
                                            </div>
                                            {paymentMethods.find(m => m.name === paymentInput.method)?.allowInternalNotes && (
                                                <div className="flex-grow">
                                                    <label className="text-[9px] font-bold text-success-dark mb-1 block">Obs. Interna (Opcional)</label>
                                                    <input
                                                        type="text"
                                                        value={paymentInput.internalNote || ''}
                                                        onChange={e => setPaymentInput(p => p ? { ...p, internalNote: e.target.value } : null)}
                                                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:ring-4 focus:ring-success/10 outline-none transition-all"
                                                        placeholder="Anotação..."
                                                    />
                                                </div>
                                            )}
                                            <button onClick={handleConfirmPayment} className="px-3 h-10 bg-success text-white rounded-xl font-bold shadow-sm text-xs">OK</button>
                                            <button onClick={() => setPaymentInput(null)} className="px-3 h-10 bg-white text-gray-500 rounded-xl font-bold border border-gray-200 text-xs">X</button>
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-white/20 overflow-hidden bg-white/40">
                                        <table className="w-full text-xs">
                                            <thead className="bg-gray-50">
                                                <tr className="text-left font-bold text-muted uppercase text-[9px]">
                                                    <th className="px-3 py-1.5">Método</th>
                                                    <th className="px-3 py-1.5 text-right">Valor</th>
                                                    <th className="px-3 py-1.5 text-center"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {payments.map(p => (
                                                    <tr key={p.id}>
                                                        <td className="px-3 py-1.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="font-bold text-gray-700">{p.card || p.method}</div>
                                                                {p.internalNote && <span className="text-[10px] text-blue-500 font-bold bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100/50 truncate max-w-[120px]" title={p.internalNote}>{p.internalNote}</span>}
                                                            </div>
                                                            {/* Card payment details: installments and fee */}
                                                            {p.installments && p.installments > 0 && (
                                                                <div className="text-[10px] text-gray-500 font-medium mt-0.5">
                                                                    <span>{p.installments}x de {formatCurrency(p.installmentsValue || p.value / p.installments)}</span>
                                                                    {p.fees && p.fees > 0 && (
                                                                        <span className="ml-2">• Taxa: {formatCurrency(p.fees)} ({p.feePercentage?.toFixed(2)}%)</span>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Trade-in details */}
                                                            {p.tradeInDetails && (
                                                                <div className="mt-1 p-1 bg-blue-50/50 rounded-xl border border-blue-100/50">
                                                                    <span className="block font-bold text-gray-800 text-[11px] mb-0.5">{p.tradeInDetails.model}</span>
                                                                    <span className="block text-[10px] text-gray-600 font-medium">
                                                                        {p.tradeInDetails.imei1 ? `IMEI: ${p.tradeInDetails.imei1}` : `S/N: ${p.tradeInDetails.serialNumber}`}
                                                                        {p.tradeInDetails.batteryHealth ? ` | Bat: ${p.tradeInDetails.batteryHealth}%` : ''}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right font-bold text-gray-900">{formatCurrency(p.value)}</td>
                                                        <td className="px-3 py-1.5 text-center">
                                                            <button onClick={() => handleRemovePayment(p.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="h-3 w-3" /></button>
                                                        </td>
                                                    </tr>
                                                ))}

                                                {payments.length > 0 && (
                                                    <tr className="bg-success-light/30">
                                                        <td className="px-3 py-1.5 font-bold uppercase text-[9px] text-success">Pago</td>
                                                        <td className="px-3 py-1.5 text-right font-black text-success">{formatCurrency(totalPaid)}</td>
                                                        <td></td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className={`p-2 rounded-xl flex items-center justify-between font-bold uppercase tracking-widest text-[10px] border ${Math.abs(balance) < 0.01
                                        ? 'bg-success text-white border-transparent'
                                        : balance < 0
                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                            : 'bg-orange-50 text-orange-700 border-orange-200'
                                        }`}>
                                        <span>
                                            {Math.abs(balance) < 0.01 ? 'Pago' : balance < 0 ? 'Troco' : 'Pendente'}
                                        </span>
                                        <span>{formatCurrency(Math.abs(balance))}</span>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </fieldset>
                </div>

                <div className="p-2 md:p-4 bg-gray-50/30 border-t border-white/20 space-y-3 sm:space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <div className="flex flex-col col-span-2 md:col-span-1">
                            <label className={labelClasses}>Garantia*</label>
                            <div className="relative">
                                <select
                                    value={warrantyTerm}
                                    onChange={e => setWarrantyTerm(e.target.value)}
                                    className={`w-full pl-4 pr-10 border rounded-xl text-sm h-10 sm:h-12 focus:ring-2 outline-none transition-all font-bold shadow-sm appearance-none ${!warrantyTerm
                                        ? 'bg-red-50 border-red-300 ring-2 ring-red-100 text-red-600'
                                        : 'bg-white border-gray-300 focus:ring-success/20 text-gray-800'
                                        }`}
                                >
                                    <option value="">Selecione o comprovante...</option>
                                    {receiptTerms.map(term => (<option key={term.id} value={term.name}>{term.name}</option>))}
                                </select>
                                <ChevronDownIcon className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none ${!warrantyTerm ? 'text-red-400' : 'text-gray-400'}`} />
                            </div>
                        </div>

                        <div className="flex flex-col">
                            <label className={labelClasses}>Obs. Recibo</label>
                            <input value={observations} onChange={e => setObservations(e.target.value)} className="w-full px-3 border rounded-xl bg-white border-gray-300 text-xs sm:text-sm h-10 sm:h-12 focus:ring-2 focus:ring-success/20 outline-none transition-all font-bold text-gray-800 shadow-sm placeholder:font-normal" placeholder="Ex: Garantia..." />
                        </div>
                        <div className="flex flex-col">
                            <label className={labelClasses}>Obs. Interna</label>
                            <input value={internalObservations} onChange={e => setInternalObservations(e.target.value)} className="w-full px-3 border rounded-xl bg-white border-gray-300 text-xs sm:text-sm h-10 sm:h-12 focus:ring-2 focus:ring-success/20 outline-none transition-all font-bold text-gray-800 shadow-sm placeholder:font-normal" placeholder="Ex: Cliente..." />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 mt-2 border-t border-gray-100 sm:border-0 sm:pt-0">
                        <div className="grid grid-cols-2 sm:flex gap-2">
                            <button onClick={props.onCancel} className="h-10 sm:h-12 px-4 sm:px-8 bg-red-100 text-red-600 rounded-xl font-bold uppercase text-[10px] sm:text-xs tracking-widest hover:bg-red-200 transition-all">Sair</button>
                            <button onClick={() => handleSave('Pendente')} disabled={cart.length === 0 || !warrantyTerm || isSaving} className="h-10 sm:h-12 px-4 sm:px-8 bg-orange-100 text-orange-600 rounded-xl font-bold uppercase text-[10px] sm:text-xs tracking-widest hover:bg-orange-200 transition-all disabled:opacity-50">Pendente</button>
                        </div>
                        <button onClick={() => handleSave('Finalizada')} disabled={cart.length === 0 || balance > 0.01 || !warrantyTerm || isSaving} className="h-12 sm:h-12 px-8 sm:px-14 bg-success text-white rounded-xl font-black uppercase text-xs sm:text-sm tracking-widest shadow-lg hover:bg-success-dark transition-all disabled:bg-gray-200 flex items-center justify-center gap-2">
                            {isSaving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Processando...</span>
                                </>
                            ) : (
                                "Finalizar Venda"
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Variações de Pagamento (ex: Pix) */}
            {variationModalConfig?.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
                        <div className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800">Selecione a Opção de Pix</h3>
                            <button onClick={() => setVariationModalConfig(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                                <XCircleIcon className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-4 space-y-2">
                            {variationModalConfig.variations.map((variation, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        handleRequestPayment(variationModalConfig.method, variation);
                                        setVariationModalConfig(null);
                                    }}
                                    className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-primary hover:bg-primary/5 transition-all font-bold text-gray-700 flex justify-between items-center group"
                                >
                                    <span>{variation}</span>
                                    <ChevronRightIcon className="h-5 w-5 text-gray-300 group-hover:text-success transition-colors" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isSaving && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in pointer-events-auto">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 max-w-xs w-full text-center animate-scale-in">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-success/20 border-t-success rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <ShoppingCartIcon className="h-6 w-6 text-success animate-pulse" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Processando Venda</h3>
                            <p className="text-sm text-gray-500 font-medium leading-relaxed">
                                Estamos atualizando o estoque e registrando seu histórico. <br />
                                <span className="text-success font-bold mt-1 block">Por favor, aguarde...</span>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Motivo da Edição */}
            {isEditReasonModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="bg-orange-50 border-b border-orange-100 p-5 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="bg-orange-500 text-white p-2 rounded-xl">
                                    <EditIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-800">Motivo da Edição</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Obrigatório para vendas finalizadas</p>
                                </div>
                            </div>
                            <button onClick={() => setIsEditReasonModalOpen(false)} className="p-2 hover:bg-orange-100 rounded-full transition-colors text-gray-400">
                                <XCircleIcon className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <textarea
                                value={editReason}
                                onChange={(e) => setEditReason(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:ring-4 focus:ring-orange-100 focus:border-orange-400 outline-none transition-all resize-none shadow-sm"
                                placeholder="Informe o motivo da edição desta venda..."
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsEditReasonModalOpen(false)}
                                    className="flex-1 h-12 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    disabled={!editReason.trim()}
                                    onClick={() => {
                                        setIsEditReasonModalOpen(false);
                                        handleSave(pendingTargetStatus);
                                    }}
                                    className="flex-1 h-12 bg-orange-500 text-white rounded-xl font-black text-sm hover:bg-orange-600 transition-all disabled:bg-gray-200 disabled:text-gray-400 shadow-lg shadow-orange-200"
                                >
                                    Confirmar e Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isCustomerModalOpen && (
                <CustomerModal
                    onClose={() => { setIsCustomerModalOpen(false); setCustomerToEdit(null); }}
                    onSave={async (entityData, entityType, personType) => {
                        try {
                            const customerPayload: any = {
                                name: entityData.name,
                                email: entityData.email,
                                phone: entityData.phone,
                                address: entityData.address,
                                avatarUrl: entityData.avatarUrl,
                                credit_limit: entityData.credit_limit,
                                credit_used: entityData.credit_used,
                                allow_credit: entityData.allow_credit
                            };
                            if (personType === 'Pessoa Física') { customerPayload.cpf = entityData.cpf; customerPayload.rg = entityData.rg; customerPayload.birthDate = entityData.birthDate; }

                            // Check if we are in "Edit Mode"
                            if (customerToEdit) {
                                if (props.onUpdateCustomer) {
                                    await props.onUpdateCustomer({ ...customerPayload, id: customerToEdit.id });
                                    showToast('Cliente atualizado com sucesso!', 'success');
                                } else {
                                    console.warn('onUpdateCustomer prop missing in NewSaleView');
                                }
                            } else {
                                // Create Mode
                                const nc = await onAddNewCustomer(customerPayload);
                                if (nc) setSelectedCustomerId(nc.id);
                                showToast('Cliente cadastrado com sucesso!', 'success');
                            }

                            setIsCustomerModalOpen(false);
                            setCustomerToEdit(null);
                        } catch (error: any) {
                            console.error('NewSaleView: Error saving customer:', error);
                            // Show the specific error message from the API (e.g., "Já existe um cliente...")
                            // Fallback to generic error only if message is missing
                            showToast(error.message || 'Erro ao salvar cliente.', 'error');
                        }
                    }}
                    entity={customerToEdit || undefined} // Explicitly pass undefined if null
                    initialType="Cliente"
                />
            )}


            <ProductModal
                product={productForTradeIn}
                isOpen={isTradeInProductModalOpen}
                onClose={() => setIsTradeInProductModalOpen(false)}
                onSave={handleSaveTradeInProduct}
            />

            <NewCreditModal
                isOpen={isCreditModalOpen}
                onClose={() => setIsCreditModalOpen(false)}
                totalAmount={balance} // Pass balance as the amount to finance
                availableLimit={(() => {
                    const c = customers.find(cust => cust.id === selectedCustomerId);
                    return c ? (c.credit_limit || 0) - (c.credit_used || 0) : 0;
                })()}
                customerId={selectedCustomerId}
                onUpdateLimit={(newLimit) => {
                    if (selectedCustomerId && props.onUpdateCustomer) {
                        props.onUpdateCustomer({ id: selectedCustomerId, credit_limit: newLimit });
                    }
                }}
                onConfirm={(details) => {
                    // 1. Add Entry if any (Assuming Money for now, or we could ask)
                    if (details.entryAmount > 0) {
                        addPayment({
                            id: `pay-entry-${Date.now()}`,
                            method: 'Dinheiro',
                            value: details.entryAmount,
                            type: 'Dinheiro',
                            internalNote: 'Entrada Crediário'
                        });
                    }

                    // 2. Add Credit Payment
                    const financed = details.totalInstallments * (details.interestRate ? 1 : 1); // logic handled in modal
                    // The value of the payment should act as "covering" the balance.
                    // The modal returns logic. 
                    // Wait, the payment value in the system should be the PRINCIPAL financed (so balance becomes 0).
                    // The INTEREST is added to the installments but not necessarily to the sale total revenue right now?
                    // Standard accounting: Sale Value = X.  Payment = Credit (X). 
                    // Interest is financial income recognized later or accrued.
                    // IMPORTANT: PROMISSORY NOTE VALUE = Principal + Interest.
                    // But for the SALE balance to reach 0, we pay the Principal.

                    // However, if we want the sale total to reflect the interest, we would need to add an item "Juros" or adjust total?
                    // Usually simpler: Payment Value = Principal. The "Debt" is Principal + Interest.
                    // Let's use Principal amount for the Payment record to clear the sale balance.
                    // The `creditDetails` will hold the real debt info.

                    if (details.financedAmount > 0) {
                        addPayment({
                            id: `pay-credit-${Date.now()}`,
                            method: creditMethodSelected,
                            value: details.financedAmount,
                            type: 'pending',
                            creditDetails: details
                        });
                    }
                }}
            />

            {creditWarning && (
                <CreditLimitWarning
                    isOpen={creditWarning.isOpen}
                    onClose={() => setCreditWarning(null)}
                    customerName={creditWarning.customerName}
                    creditLimit={creditWarning.creditLimit}
                    creditUsed={creditWarning.creditUsed}
                    purchaseAmount={creditWarning.purchaseAmount}
                    onOpenProfile={() => {
                        setCreditWarning(null);
                        const customer = customers.find(c => c.id === selectedCustomerId);
                        if (customer) {
                            setCustomerToEdit(customer);
                            setIsCustomerModalOpen(true);
                        }
                    }}
                />
            )}



            <CardPaymentModal
                isOpen={isCardPaymentModalOpen}
                onClose={() => setIsCardPaymentModalOpen(false)}
                onConfirm={handleConfirmCardPayment}
                amountDue={balance > 0 ? balance : 0}
                initialTransactionType={cardTransactionType}
                initialMethodId={cardMethodId}
            />


            {/* Modal de Seleção de Unidade (EAN Duplicado) */}
            {isSelectingUnit && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20 animate-scale-up">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 leading-tight">Múltiplas Unidades</h3>
                                <p className="text-xs text-muted font-bold uppercase tracking-wider mt-1 italic">Várias unidades encontradas para este código</p>
                            </div>
                            <button onClick={() => setIsSelectingUnit(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"><XCircleIcon className="h-6 w-6" /></button>
                        </div>

                        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
                            {matchingUnits.map(unit => (
                                <button
                                    key={unit.id}
                                    onClick={() => handleSelectUnit(unit)}
                                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl hover:border-success hover:bg-success-light/30 transition-all flex flex-col gap-2 group text-left shadow-sm"
                                >
                                    <div className="flex justify-between items-start">
                                        <span className="font-black text-gray-900 text-sm group-hover:text-success transition-colors">{unit.model}</span>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-sm ${unit.condition === 'Novo' ? 'bg-success/10 text-success border border-success/20' :
                                            unit.condition === 'Reservado' ? 'bg-yellow-50 text-yellow-600 border border-yellow-200' :
                                                'bg-orange-50 text-orange-600 border border-orange-100'
                                            }`}>
                                            {unit.condition}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                        {unit.imei1 && (
                                            <div className="flex items-center gap-1.5 text-gray-500">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">IMEI:</span>
                                                <span className="font-mono font-bold text-gray-700">{unit.imei1}</span>
                                            </div>
                                        )}
                                        {unit.serialNumber && (
                                            <div className="flex items-center gap-1.5 text-gray-500">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">S/N:</span>
                                                <span className="font-mono font-bold text-gray-700">{unit.serialNumber}</span>
                                            </div>
                                        )}
                                        {unit.storage && (
                                            <div className="flex items-center gap-1.5 text-gray-500">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Capacidade:</span>
                                                <span className="font-bold text-gray-700">{unit.storage}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center mt-1 pt-2 border-t border-gray-50">
                                        <span className="text-[10px] font-bold text-muted uppercase">Local: <span className="text-gray-600">{unit.storageLocation || 'Loja Santa Cruz'}</span></span>
                                        <span className="text-lg font-black text-gray-900">{formatCurrency(unit.price)}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setIsSelectingUnit(false)}
                                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 font-black rounded-xl hover:bg-gray-50 transition-all text-xs uppercase tracking-widest shadow-sm"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {productToConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-[95%] max-w-md overflow-hidden animate-scale-in">
                        <div className="bg-gray-50 border-b border-gray-100 p-3 sm:p-4">
                            <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2"><CheckIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />Confirmar Produto</h3>
                        </div>
                        <div className="p-3 sm:p-5 space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider">Produto / Modelo</label>
                                <p className="text-base font-bold text-gray-900">{productToConfirm.model}</p>
                                {productToConfirm.variations && productToConfirm.variations.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {productToConfirm.variations.map((v, i) => (
                                            <span key={i} className="text-[9px] italic font-bold text-gray-600 uppercase tracking-tighter">
                                                {v.gradeName}: {v.valueName}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* IMEI / SN */}
                            {(productToConfirm.imei1 || productToConfirm.serialNumber) && (
                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                    {productToConfirm.imei1 && (
                                        <div className="p-2 bg-gray-50 rounded border border-gray-100">
                                            <span className="block text-[9px] font-bold text-muted uppercase">IMEI 1</span>
                                            <span className="font-mono font-medium text-gray-700">{productToConfirm.imei1}</span>
                                        </div>
                                    )}
                                    {productToConfirm.serialNumber && (
                                        <div className="p-2 bg-gray-50 rounded border border-gray-100">
                                            <span className="block text-[9px] font-bold text-muted uppercase">Nº de Série</span>
                                            <span className="font-mono font-medium text-gray-700">{productToConfirm.serialNumber}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Info Adicional */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-2 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="block text-[9px] font-bold text-muted uppercase mb-0.5 tracking-wider">Condição</span>
                                    <span className={`text-[10px] font-black uppercase tracking-tight ${productToConfirm.condition === 'Novo' ? 'text-emerald-600' :
                                        productToConfirm.condition === 'Reservado' ? 'text-yellow-600' :
                                            'text-blue-600'
                                        }`}>{productToConfirm.condition}</span>
                                </div>
                                <div className="p-2 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="block text-[9px] font-bold text-muted uppercase mb-0.5 tracking-wider">Garantia</span>
                                    <span className="text-[10px] font-black text-gray-700 uppercase tracking-tight">{productToConfirm.warranty || 'S/ GARANTIA'}</span>
                                </div>
                                {(productToConfirm.serialNumber || productToConfirm.imei1) && (
                                    <div className="p-2 bg-gray-50 rounded-xl border border-gray-100 col-span-2">
                                        <span className="block text-[9px] font-bold text-muted uppercase mb-0.5 tracking-wider">Disponível</span>
                                        <span className="font-black text-xs text-gray-800">{productToConfirm.stock} unidades</span>
                                    </div>
                                )}
                            </div>

                            {/* QUANTIDADE (DESTAQUE) */}
                            {!(productToConfirm.serialNumber || productToConfirm.imei1) && (
                                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="block text-[10px] font-black text-primary uppercase tracking-widest leading-none mb-1">Qtd. Venda</span>
                                            <span className="text-[10px] font-bold text-gray-400">Total estoque: {productToConfirm.stock}</span>
                                        </div>

                                        <div className="flex items-center bg-white border border-gray-300 rounded-xl h-11 w-36 shadow-md overflow-hidden shrink-0">
                                            <button
                                                onClick={() => setSearchQuantity(prev => Math.max(1, prev - 1))}
                                                className="h-full w-11 flex items-center justify-center text-gray-500 hover:bg-rose-50 hover:text-rose-600 transition-colors border-r border-gray-100"
                                            >
                                                <MinusIcon className="h-4 w-4" />
                                            </button>

                                            <input
                                                type="number"
                                                min="1"
                                                max={productToConfirm.stock}
                                                value={searchQuantity}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    if (!isNaN(val)) setSearchQuantity(Math.min(productToConfirm.stock, Math.max(1, val)));
                                                }}
                                                className="w-14 h-full text-center outline-none font-black text-xl text-gray-900 bg-white"
                                            />

                                            <button
                                                onClick={() => setSearchQuantity(prev => Math.min(productToConfirm.stock, prev + 1))}
                                                className="h-full w-11 flex items-center justify-center text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors border-l border-gray-100"
                                            >
                                                <PlusIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* OPÇÕES DE PREÇO */}
                            <div className="space-y-2 pt-3 border-t border-gray-100">
                                <label className="block text-[10px] font-black text-muted uppercase tracking-widest leading-none mb-1">Preço Sugerido</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(productToConfirm.costPrice || 0) > 0 && (
                                        <div
                                            onClick={() => setSelectedPriceType('cost')}
                                            className={`p-2 rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer hover:bg-sky-50 ${selectedPriceType === 'cost' ? 'bg-sky-50 border-sky-500 shadow-md transform scale-[1.02]' : 'bg-gray-50 border-gray-100 grayscale-[0.5] opacity-60'}`}
                                        >
                                            <span className="text-[8px] font-bold uppercase mb-0.5 opacity-60">Custo</span>
                                            <span className="font-black text-[12px] tabular-nums text-sky-800">{formatCurrency(productToConfirm.costPrice!)}</span>
                                        </div>
                                    )}
                                    {(productToConfirm.wholesalePrice || 0) > 0 && (
                                        <div
                                            onClick={() => setSelectedPriceType('wholesale')}
                                            className={`p-2 rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer hover:bg-orange-50 ${selectedPriceType === 'wholesale' ? 'bg-orange-50 border-orange-500 shadow-md transform scale-[1.02]' : 'bg-gray-50 border-gray-100 grayscale-[0.5] opacity-60'}`}
                                        >
                                            <span className="text-[8px] font-bold uppercase mb-0.5 opacity-60">Atacado</span>
                                            <span className="font-black text-[13px] tabular-nums text-orange-800">{formatCurrency(productToConfirm.wholesalePrice!)}</span>
                                        </div>
                                    )}
                                    <div
                                        onClick={() => setSelectedPriceType('sale')}
                                        className={`p-2 rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer hover:bg-emerald-50 ${selectedPriceType === 'sale' ? 'bg-emerald-50 border-emerald-500 shadow-md transform scale-[1.02]' : 'bg-gray-50 border-gray-100 grayscale-[0.5] opacity-60'}`}
                                    >
                                        <span className="text-[8px] font-bold uppercase mb-0.5 opacity-60">Venda</span>
                                        <span className="font-black text-[13px] tabular-nums text-emerald-800">{formatCurrency(productToConfirm.price)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button onClick={() => actions.setProductToConfirm(null)} className="flex-1 py-3 bg-gray-100 text-gray-500 font-black rounded-2xl hover:bg-gray-200 transition-colors text-[10px] tracking-widest uppercase">Cancelar</button>
                                <button onClick={confirmAddToCart} className="flex-1 py-3 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all transform active:scale-95 text-[10px] tracking-widest uppercase">Confirmar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </React.Fragment>
    );
};

export default React.memo(NewSaleView);
