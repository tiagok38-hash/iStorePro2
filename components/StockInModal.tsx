
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { PurchaseOrder, Product, PurchaseItem, ProductConditionParameter, StorageLocationParameter, WarrantyParameter } from '../types.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import { launchPurchaseToStock, formatCurrency, getProductConditions, getStorageLocations, getWarranties } from '../services/mockApi.ts';
import { SpinnerIcon, DocumentArrowUpIcon, XCircleIcon, BoltIcon, SearchIcon } from './icons.tsx';
import CurrencyInput from './CurrencyInput.tsx';

type ItemDetail = {
    purchaseItemId: string;
    itemDescription: string;
    serialNumber: string;
    imei1: string;
    imei2: string;
    condition: string;
    batteryHealth: number;
    warranty: string;
    storageLocation?: string;
    costPrice: number;
    additionalCostPrice: number;
    markup: number | null;
    salePrice: number | null;
    wholesalePrice: number | null; // Preço de Atacado (ATC)
    quantity: number;
    minimumStock?: number;
    isApple?: boolean;
    barcode?: string;
    controlByBarcode?: boolean;
    hasImei?: boolean; // Indica se o item precisa de IMEI/Serial Number
};

const StockInModal: React.FC<{
    purchaseOrder: PurchaseOrder;
    onClose: (refresh: boolean) => void;
    allProducts: Product[];
    grades: any[];
    gradeValues: any[];
}> = ({ purchaseOrder, onClose, allProducts, grades, gradeValues }) => {
    const [details, setDetails] = useState<ItemDetail[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<Record<number, boolean>>({});
    const [duplicateErrors, setDuplicateErrors] = useState<Record<number, Partial<Record<'serialNumber' | 'imei1' | 'imei2', boolean>>>>({});
    const [isMinimumStockEnabled, setIsMinimumStockEnabled] = useState(false);
    const { showToast } = useToast();
    const [isContinuousScanEnabled, setIsContinuousScanEnabled] = useState(false);
    const inputRefs = React.useRef<{ [key: string]: HTMLInputElement | null }>({});
    const { user } = useUser();

    // Dynamic parameters from Empresa > Parâmetros
    const [conditionOptions, setConditionOptions] = useState<ProductConditionParameter[]>([]);
    const [locationOptions, setLocationOptions] = useState<StorageLocationParameter[]>([]);
    const [warrantyOptions, setWarrantyOptions] = useState<WarrantyParameter[]>([]);

    // Quick Stock Search
    const [stockSearchTerm, setStockSearchTerm] = useState('');
    const [showStockResults, setShowStockResults] = useState(false);

    const stockSearchResults = useMemo(() => {
        if (!stockSearchTerm || stockSearchTerm.length < 2) return [];

        const lowerTerm = stockSearchTerm.toLowerCase();

        // Define known conditions to look for
        const conditionsMap: Record<string, string> = {
            'seminovo': 'Seminovo',
            'novo': 'Novo',
            'cpo': 'CPO',
            'open box': 'Open Box',
            'vitrine': 'Vitrine',
            'lacrado': 'Novo' // Alias commonly used
        };

        // Check if any condition keyword is present in the search term
        let targetCondition: string | null = null;
        let finalSearchTerm = lowerTerm;

        // Sort keys by length desc to match "open box" before "box" if exists, or similar overlaps
        const conditionKeys = Object.keys(conditionsMap).sort((a, b) => b.length - a.length);

        for (const key of conditionKeys) {
            if (finalSearchTerm.includes(key)) {
                targetCondition = conditionsMap[key];
                // Remove the condition keyword from the search string to filter model
                finalSearchTerm = finalSearchTerm.replace(key, '').trim();
                break; // Assume only one condition is searched at a time
            }
        }

        return allProducts
            .filter(p => {
                if (p.stock <= 0) return false;

                // If a specific condition was identified, strictly filter by it
                if (targetCondition) {
                    const productCondition = (p.condition || '').toLowerCase();
                    const targetLower = targetCondition.toLowerCase();
                    // Flexible matching for condition (e.g. if product is "Novo Lacrado" and target is "Novo")
                    if (!productCondition.includes(targetLower)) {
                        return false;
                    }
                }

                // If there's remaining text after removing condition, check if it matches model
                if (finalSearchTerm) {
                    const modelMatch = (p.model || '').toLowerCase().includes(finalSearchTerm);
                    // Also check if the remaining term might be part of the condition (fallback) or brand
                    const otherMatch = (p.brand || '').toLowerCase().includes(finalSearchTerm);
                    return modelMatch || otherMatch;
                }

                return true;
            })
            .slice(0, 10);
    }, [allProducts, stockSearchTerm]);

    // Fetch dynamic parameters on mount
    useEffect(() => {
        const fetchParameters = async () => {
            const [conditions, locations, warranties] = await Promise.all([
                getProductConditions(),
                getStorageLocations(),
                getWarranties()
            ]);
            setConditionOptions(conditions);
            setLocationOptions(locations);
            setWarrantyOptions(warranties);
        };
        fetchParameters();
    }, []);

    // Lock body scroll on mount
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    // Determina o modo de renderização baseado nos itens da compra
    // Se QUALQUER item tem IMEI, usa o modo único para mostrar campos de IMEI/SN
    // Isso permite compras mistas (itens com e sem IMEI)
    const hasAnyImeiItem = useMemo(() =>
        purchaseOrder.items.some(item => item.hasImei),
        [purchaseOrder.items]);

    const isBulkMode = !hasAnyImeiItem;

    // Load/Save draft from localStorage
    useEffect(() => {
        if (details.length > 0) {
            localStorage.setItem(`stock_launch_draft_${purchaseOrder.id}`, JSON.stringify(details));
        }
    }, [details, purchaseOrder.id]);

    useEffect(() => {
        const launchedProductsForThisPO = allProducts.filter(p => p.purchaseOrderId === purchaseOrder.id);
        const expandedDetails = purchaseOrder.items.flatMap(item => {
            const launchedCount = launchedProductsForThisPO
                .filter(p => p.purchaseItemId === item.id)
                .reduce((sum, p) => sum + p.stock, 0);

            const quantityToLaunch = item.quantity - launchedCount;

            if (quantityToLaunch <= 0) {
                return [];
            }

            const baseDetail = {
                purchaseItemId: item.id,
                itemDescription: item.productDetails.model,
                serialNumber: '', imei1: '', imei2: '',
                condition: item.productDetails.condition || 'Novo',
                batteryHealth: 100,
                warranty: item.productDetails.warranty || '1 ano',
                storageLocation: item.productDetails.storageLocation || 'Loja',
                costPrice: item.unitCost,
                additionalCostPrice: item.additionalUnitCost,
                markup: null, salePrice: null, wholesalePrice: null,
                minimumStock: item.minimumStock,
                isApple: item.productDetails.brand === 'Apple',
                barcode: (item.barcodes && item.barcodes.length > 0) ? item.barcodes[0] : '',
                controlByBarcode: item.controlByBarcode,
                hasImei: item.hasImei
            };

            // Decisão POR ITEM: se tem IMEI, expande em linhas individuais; se não, agrupa
            if (item.hasImei) {
                // Modo único: cada unidade é uma linha separada para preencher IMEI/SN
                return Array.from({ length: quantityToLaunch }, () => ({
                    ...baseDetail,
                    quantity: 1,
                }));
            } else {
                // Modo bulk: agrupa quantidade (produtos sem IMEI, como acessórios ou com código de barras)
                return [{
                    ...baseDetail,
                    quantity: quantityToLaunch,
                }];
            }
        });

        if (expandedDetails.length === 0 && details.length === 0) {
            showToast("Todos os itens desta compra já foram lançados no estoque.", "info");
            onClose(false);
            return;
        }

        setDetails(prev => {
            // Se já temos algo preenchido (mesmo queIMEIs vazios), não resetamos se virmos de um refresh de background
            if (prev.length > 0) return prev;

            // Tenta recuperar rascunho salvo
            const savedDraft = localStorage.getItem(`stock_launch_draft_${purchaseOrder.id}`);
            if (savedDraft) {
                try {
                    const parsed = JSON.parse(savedDraft);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        // Validate: Ensure all draft items still exist in the current purchase order
                        // This prevents crashes if the purchase was edited (changing item IDs) after the draft was saved
                        const allIdsValid = parsed.every(draftItem =>
                            purchaseOrder.items.some(pi => pi.id === draftItem.purchaseItemId)
                        );

                        if (allIdsValid) {
                            return parsed;
                        } else {
                            console.warn("Draft discarded because some items no longer exist in the purchase order.");
                            // Optional: showToast("Rascunho descartado pois a compra foi modificada.", "info");
                        }
                    }
                } catch (e) {
                    console.error("Erro ao carregar rascunho", e);
                }
            }

            return expandedDetails;
        });

        const hasMinStockEnabled = expandedDetails.some(d => !d.isApple && d.minimumStock && d.minimumStock > 0);
        setIsMinimumStockEnabled(hasMinStockEnabled);
    }, [purchaseOrder, allProducts, onClose, showToast]);

    const focusNextRow = (index: number, field: string) => {
        // Use DOM ID for absolute reliability over React Refs
        const nextId = `stock-input-${index + 1}-${field}`;
        const nextInput = document.getElementById(nextId);

        if (nextInput) {
            // showToast(`Pulando para item #${index + 2}`, 'success'); // Optional feedback
            nextInput.focus();
            (nextInput as HTMLInputElement).select(); // Select all text in next input just in case
            nextInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            const currentId = `stock-input-${index}-${field}`;
            // Check if we are at the end
            if (index + 1 >= details.length) {
                showToast('Último item da lista preenchido!', 'success');
            } else {
                console.warn(`Could not find input with ID: ${nextId}`);
            }
        }
    };

    const handleDetailChange = (index: number, field: keyof ItemDetail, value: any) => {
        const newDetails = [...details];
        let detail = { ...newDetails[index] };

        // Clear duplicate error for this field if it exists
        if (duplicateErrors[index]?.[field as keyof typeof duplicateErrors[number]]) {
            const newErrors = { ...duplicateErrors };
            if (newErrors[index]) {
                delete newErrors[index]![field as keyof typeof duplicateErrors[number]];
                if (Object.keys(newErrors[index]!).length === 0) {
                    delete newErrors[index];
                }
                setDuplicateErrors(newErrors);
            }
        }

        if (field === 'markup') {
            const markupValue = value === '' ? null : parseFloat(String(value));
            if (isNaN(markupValue as number) && markupValue !== null) return;

            detail.markup = markupValue;
            const finalCost = detail.costPrice + detail.additionalCostPrice;
            if (finalCost > 0 && detail.markup !== null) {
                const calculatedPrice = finalCost * (1 + detail.markup / 100);
                detail.salePrice = parseFloat(calculatedPrice.toFixed(2));
                if (detail.salePrice > 0) {
                    setErrors(prev => ({ ...prev, [index]: false }));
                }
            }
        } else if (field === 'salePrice') {
            const salePriceValue = value === null ? null : Number(value);

            detail.salePrice = salePriceValue;
            const finalCost = detail.costPrice + detail.additionalCostPrice;
            if (finalCost > 0 && detail.salePrice !== null && detail.salePrice > 0) {
                const newMarkup = ((detail.salePrice / finalCost) - 1) * 100;
                detail.markup = isFinite(newMarkup) ? parseFloat(newMarkup.toFixed(2)) : 0;
            } else {
                detail.markup = null;
            }

            if (detail.salePrice !== null && detail.salePrice > 0) {
                setErrors(prev => ({ ...prev, [index]: false }));
            }

        } else if (field === 'batteryHealth') {
            let numericValue = parseInt(String(value), 10);
            if (isNaN(numericValue)) numericValue = 0;
            if (numericValue < 0) numericValue = 0;
            if (numericValue > 100) numericValue = 100;
            (detail as any)[field] = numericValue;
        } else if (field === 'minimumStock') {
            const numericValue = parseInt(String(value), 10);
            (detail as any)[field] = numericValue > 0 ? numericValue : 1;
        }
        else if (field === 'imei1' || field === 'imei2') {
            const cleaned = value.replace(/\D/g, '').substring(0, 15);
            (detail as any)[field] = cleaned;

            // Auto-jump for 15 chars (standard IMEI) if Continuous Scan is ON
            if (isContinuousScanEnabled && cleaned.length === 15) {
                // Use setTimeout to ensure the state update renders first, although not strictly waiting for it here
                // Logic: update state -> then focus next.
                // Since this function updates state at the end, we can trigger focus immediately if we are sure.
                setTimeout(() => focusNextRow(index, field as string), 50);
            }
        }
        else {
            (detail as any)[field] = value;
        }

        newDetails[index] = detail;
        setDetails(newDetails);
    };

    const inputClassesCompact = "w-full p-1.5 border rounded bg-transparent border-border focus:ring-success focus:border-success text-sm";


    const handleToggleMinimumStock = (checked: boolean) => {
        setIsMinimumStockEnabled(checked);
        if (!checked) {
            setDetails(prevDetails => prevDetails.map(d => {
                const { minimumStock, ...rest } = d;
                return rest;
            }));
        } else {
            setDetails(prevDetails => prevDetails.map(d => {
                const originalItem = purchaseOrder.items.find(i => i.id === d.purchaseItemId);
                return {
                    ...d,
                    minimumStock: d.isApple ? undefined : (d.minimumStock || originalItem?.minimumStock || 1)
                }
            }));
        }
    };


    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, field: string) => {
        // Handle Enter or Tab for manual jump or non-15 char inputs (like Serial Numbers)
        if ((e.key === 'Enter' || e.key === 'Tab') && isContinuousScanEnabled) {
            e.preventDefault();
            focusNextRow(index, field);
        }
    };

    const handleLaunchStock = async () => {
        let hasError = false;
        const newDuplicateErrors: Record<number, Partial<Record<'serialNumber' | 'imei1' | 'imei2', boolean>>> = {};

        const isValidImei = (val: string) => !val || /^\d{15}$/.test(val);

        for (let i = 0; i < details.length; i++) {
            const detail = details[i];
            if (detail.imei1 && !isValidImei(detail.imei1)) {
                showToast(`Item #${i + 1}: IMEI 1 deve ter exatamente 15 números.`, 'error');
                return;
            }
            if (detail.imei2 && !isValidImei(detail.imei2)) {
                showToast(`Item #${i + 1}: IMEI 2 deve ter exatamente 15 números.`, 'error');
                return;
            }
        }

        // Global tracking for duplicates within the current batch
        const seenImeis: { [key: string]: number[] } = {};
        const seenSerials: { [key: string]: number[] } = {};

        details.forEach((detail, index) => {
            // Check Serial Number
            const sn = detail.serialNumber?.trim();
            if (sn) {
                if (!seenSerials[sn]) seenSerials[sn] = [];
                seenSerials[sn].push(index);
            }

            // Check IMEI1
            const i1 = detail.imei1?.trim();
            if (i1) {
                if (!seenImeis[i1]) seenImeis[i1] = [];
                seenImeis[i1].push(index);
            }

            // Check IMEI2
            const i2 = detail.imei2?.trim();
            if (i2) {
                if (!seenImeis[i2]) seenImeis[i2] = [];
                seenImeis[i2].push(index);
            }
        });

        // Mark duplicates found in local check
        Object.values(seenSerials).forEach(indices => {
            if (indices.length > 1) {
                hasError = true;
                indices.forEach(idx => {
                    if (!newDuplicateErrors[idx]) newDuplicateErrors[idx] = {};
                    newDuplicateErrors[idx]!.serialNumber = true;
                });
            }
        });

        Object.values(seenImeis).forEach(indices => {
            if (indices.length > 1) {
                hasError = true;
                indices.forEach(idx => {
                    if (!newDuplicateErrors[idx]) newDuplicateErrors[idx] = {};
                    // Determine which field caused the collision for this row
                    const detail = details[idx];
                    if (detail.imei1 && seenImeis[detail.imei1] === indices) newDuplicateErrors[idx]!.imei1 = true;
                    if (detail.imei2 && seenImeis[detail.imei2] === indices) newDuplicateErrors[idx]!.imei2 = true;

                    // Simplified marking: if both exist and collide, mark both to be safe
                    if (detail.imei1 && seenImeis[detail.imei1].length > 1) newDuplicateErrors[idx]!.imei1 = true;
                    if (detail.imei2 && seenImeis[detail.imei2].length > 1) newDuplicateErrors[idx]!.imei2 = true;
                });
            }
        });

        if (hasError) {
            setDuplicateErrors(newDuplicateErrors);
            showToast('Foram encontrados números de série ou IMEIs duplicados nesta lista. Corrija os campos destacados.', 'error');
            return;
        }

        const newPriceErrors: Record<number, boolean> = {};
        let hasPriceError = false;
        for (const [index, detail] of details.entries()) {
            if (detail.salePrice === null || detail.salePrice <= 0) {
                newPriceErrors[index] = true;
                hasPriceError = true;
            }
        }

        setErrors(newPriceErrors);

        if (hasPriceError) {
            showToast('O preço de venda deve ser preenchido e maior que zero.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const newProducts: (Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'sku'> & { purchaseItemId: string })[] = details.map(d => {
                const originalItem = purchaseOrder.items.find(i => i.id === d.purchaseItemId);
                if (!originalItem) {
                    console.error('[StockInModal] Item mismatch:', d.purchaseItemId, purchaseOrder.items);
                    throw new Error('Erro interno: Item da compra não encontrado durante o processamento.');
                }
                return {
                    brand: originalItem.productDetails.brand,
                    category: originalItem.productDetails.category,
                    model: originalItem.productDetails.model,
                    color: originalItem.productDetails.color,
                    price: d.salePrice!,
                    wholesalePrice: d.wholesalePrice || 0,
                    costPrice: d.costPrice,
                    additionalCostPrice: d.additionalCostPrice,
                    stock: d.quantity,
                    serialNumber: d.serialNumber,
                    imei1: d.imei1,
                    imei2: d.imei2,
                    batteryHealth: d.batteryHealth,
                    condition: d.condition,
                    warranty: d.warranty,
                    storageLocation: d.storageLocation,
                    purchaseItemId: d.purchaseItemId,
                    createdBy: user?.name || 'Keiler',
                    supplierId: purchaseOrder.supplierId,
                    origin: purchaseOrder.isCustomerPurchase ? 'Comprado de Cliente' : 'Compra',
                    minimumStock: (isMinimumStockEnabled && !d.isApple) ? d.minimumStock : undefined,
                    barcodes: d.barcode ? [d.barcode] : [],
                };
            });

            await launchPurchaseToStock(purchaseOrder.id, newProducts, user?.name || 'Usuário');
            showToast(`Estoque da compra #${purchaseOrder.displayId} lançado com sucesso!`, 'success');
            localStorage.removeItem(`stock_launch_draft_${purchaseOrder.id}`);
            onClose(true);
        } catch (error: any) {
            let message = error.message || 'Falha ao lançar estoque.';

            // Check for structured duplicate error from backend
            try {
                const errData = JSON.parse(message);
                if (errData.code === 'DUPLICATE_ENTRIES') {
                    const serverDupErrors: Record<number, Partial<Record<'serialNumber' | 'imei1' | 'imei2', boolean>>> = {};

                    details.forEach((detail, index) => {
                        const { duplicates } = errData;

                        // Check matches against server-reported duplicates
                        if (detail.imei1 && (duplicates.imei1.includes(detail.imei1) || duplicates.imei2.includes(detail.imei1))) {
                            if (!serverDupErrors[index]) serverDupErrors[index] = {};
                            serverDupErrors[index].imei1 = true;
                        }
                        if (detail.imei2 && (duplicates.imei2.includes(detail.imei2) || duplicates.imei1.includes(detail.imei2))) {
                            if (!serverDupErrors[index]) serverDupErrors[index] = {};
                            serverDupErrors[index].imei2 = true;
                        }
                        if (detail.serialNumber && duplicates.serialNumber.includes(detail.serialNumber)) {
                            if (!serverDupErrors[index]) serverDupErrors[index] = {};
                            serverDupErrors[index].serialNumber = true;
                        }
                    });

                    setDuplicateErrors(serverDupErrors);
                    message = 'Existem produtos já cadastrados no sistema com os mesmos IMEIs ou Serial Number. Verifique os campos destacados.';
                }
            } catch (e) {
                // Not a JSON error, treat as generic string
            }

            showToast(message, 'error');
            setIsSaving(false);
        }
    };

    const inputClasses = "w-full py-2 px-3 border rounded-lg bg-transparent border-border focus:ring-success focus:border-success text-sm transition-all";

    const renderBulkMode = () => (
        <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm min-w-[1000px]">
                    <thead className="text-left text-xs text-muted bg-surface-secondary sticky top-0 z-10">
                        <tr>
                            <th className="p-3 min-w-[200px]">Descrição</th>
                            <th className="p-3 w-20 text-center">Qtd.</th>
                            <th className="p-3 min-w-[120px]">Condição</th>
                            <th className="p-3 min-w-[130px]">Local</th>
                            <th className="p-3 w-32">P. Custo</th>
                            <th className="p-3 w-32">Garantia</th>
                            <th className="p-3 w-24 text-center">Mkp %</th>
                            <th className="p-3 w-40">P. Atacado</th>
                            <th className="p-3 w-40">P. Venda</th>
                        </tr>
                    </thead>
                    <tbody>
                        {details.map((detail, index) => (
                            <tr key={index} className="border-b border-border hover:bg-surface-secondary/50">
                                <td className="p-3">
                                    <div className="font-medium text-primary">{detail.itemDescription}</div>
                                </td>
                                <td className="p-3 text-center">
                                    <span className="bg-gray-100 px-2 py-1 rounded font-bold">{detail.quantity}</span>
                                </td>
                                <td className="p-3">
                                    <select
                                        value={detail.condition}
                                        onChange={(e) => handleDetailChange(index, 'condition', e.target.value)}
                                        className={`${inputClasses} h-10`}
                                    >
                                        {conditionOptions.length === 0 ? <option>Carregando...</option> : <>
                                            {detail.condition && !conditionOptions.some(c => c.name.toLowerCase() === detail.condition?.toLowerCase()) && <option value={detail.condition}>{detail.condition}</option>}
                                            {conditionOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </>}
                                    </select>
                                </td>
                                <td className="p-3">
                                    <select
                                        value={detail.storageLocation}
                                        onChange={(e) => handleDetailChange(index, 'storageLocation', e.target.value)}
                                        className={`${inputClasses} h-10`}
                                    >
                                        {locationOptions.length === 0 ? <option>Carregando...</option> : <>
                                            {detail.storageLocation && !locationOptions.some(l => l.name.toLowerCase() === detail.storageLocation?.toLowerCase()) && <option value={detail.storageLocation}>{detail.storageLocation}</option>}
                                            {locationOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                        </>}
                                    </select>
                                </td>
                                <td className="p-3 font-semibold">{formatCurrency(detail.costPrice + (detail.additionalCostPrice || 0))}</td>
                                <td className="p-3">
                                    <select
                                        value={detail.warranty}
                                        onChange={(e) => handleDetailChange(index, 'warranty', e.target.value)}
                                        className={`${inputClasses} h-10`}
                                    >
                                        {warrantyOptions.length === 0 ? <option>Carregando...</option> : <>
                                            {detail.warranty && !warrantyOptions.some(w => w.name.toLowerCase() === detail.warranty?.toLowerCase()) && <option value={detail.warranty}>{detail.warranty}</option>}
                                            {warrantyOptions.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                                        </>}
                                    </select>
                                </td>
                                <td className="p-3 w-28">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={detail.markup === null ? '' : detail.markup}
                                        onChange={e => handleDetailChange(index, 'markup', e.target.value)}
                                        className={`${inputClasses} h-10 text-right`}
                                    />
                                </td>
                                <td className="p-3">
                                    <CurrencyInput
                                        value={detail.wholesalePrice}
                                        onChange={val => handleDetailChange(index, 'wholesalePrice', val)}
                                        className={`${inputClasses} h-10 text-orange-600`}
                                        placeholder="Opcional"
                                    />
                                </td>
                                <td className="p-3">
                                    <CurrencyInput
                                        value={detail.salePrice}
                                        onChange={val => handleDetailChange(index, 'salePrice', val)}
                                        className={`${inputClasses} h-10 ${errors[index] ? 'border-danger ring-1 ring-danger' : ''}`}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards */}
            < div className="block md:hidden space-y-3 p-3 bg-gray-50/50" >
                {
                    details.map((detail, index) => (
                        <div key={index} className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
                            <div className="bg-surface-secondary px-4 py-2.5 border-b border-border flex justify-between items-center">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="bg-primary text-white text-[9px] font-black px-1.5 py-0.5 rounded-md min-w-[24px] text-center">#{index + 1}</span>
                                    <h3 className="font-bold text-primary text-xs truncate">{detail.itemDescription}</h3>
                                </div>
                                <span className="bg-primary/10 text-primary text-[10px] px-2 py-1 rounded-full font-bold whitespace-nowrap">Qtd: {detail.quantity}</span>
                            </div>
                            <div className="p-3 space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="flex flex-col">
                                        <label className="text-[9px] font-bold text-muted uppercase mb-0.5 ml-1">Condição</label>
                                        <select
                                            value={detail.condition}
                                            onChange={(e) => handleDetailChange(index, 'condition', e.target.value)}
                                            className={`${inputClassesCompact} h-8 py-0`}
                                        >
                                            {conditionOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-[9px] font-bold text-muted uppercase mb-0.5 ml-1">Local</label>
                                        <select
                                            value={detail.storageLocation}
                                            onChange={(e) => handleDetailChange(index, 'storageLocation', e.target.value)}
                                            className={`${inputClassesCompact} h-8 py-0`}
                                        >
                                            {locationOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-[9px] font-bold text-muted uppercase mb-0.5 ml-1">Garantia</label>
                                        <select
                                            value={detail.warranty}
                                            onChange={(e) => handleDetailChange(index, 'warranty', e.target.value)}
                                            className={`${inputClassesCompact} h-8 py-0`}
                                        >
                                            {warrantyOptions.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-gray-50/80 p-2 rounded border border-border/50">
                                    <div className="flex justify-between items-center mb-1.5 px-1">
                                        <span className="text-[9px] font-bold text-muted uppercase">Custo: {formatCurrency(detail.costPrice + (detail.additionalCostPrice || 0))}</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] font-bold text-muted">Markup %</span>
                                            <input type="number" step="0.1" value={detail.markup === null ? '' : detail.markup} onChange={e => handleDetailChange(index, 'markup', e.target.value)} className="w-12 h-6 border rounded text-[10px] text-center font-bold border-border" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex flex-col">
                                                <label className="text-[9px] font-black text-success uppercase ml-1 mb-1">Preço Venda</label>
                                                <CurrencyInput
                                                    value={detail.salePrice}
                                                    onChange={val => handleDetailChange(index, 'salePrice', val)}
                                                    className={`w-full h-11 border rounded-lg text-sm font-black text-primary ${errors[index] ? 'border-danger ring-1 ring-danger' : 'border-success/30'}`}
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <label className="text-[9px] font-bold text-orange-600 uppercase ml-1 mb-1">Preço Atacado</label>
                                                <CurrencyInput
                                                    value={detail.wholesalePrice}
                                                    onChange={val => handleDetailChange(index, 'wholesalePrice', val)}
                                                    className={`w-full h-11 border rounded-lg text-sm font-bold text-orange-600 border-orange-100 bg-orange-50/30`}
                                                    placeholder="---"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>


                            </div>
                        </div>
                    ))
                }
            </div >
        </>
    );

    const renderUniqueMode = () => {
        const hasAppleItems = details.some(d => d.isApple && d.condition === 'Seminovo');

        return (
            <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm min-w-[1200px]">
                        <thead className="text-left text-xs text-gray-900 bg-surface-secondary sticky top-0 z-10">
                            <tr>
                                <th className="pl-3 py-2 w-[170px] font-bold text-left">Descrição</th>
                                <th className="pl-3 py-2 w-[50px] font-bold text-center">Qtd</th>
                                <th className="pl-3 py-2 w-[130px] font-bold text-left">IMEI 1</th>
                                <th className="pl-3 py-2 w-[130px] font-bold text-left">IMEI 2</th>
                                <th className="pl-3 py-2 w-[130px] font-bold text-left">S/N</th>
                                <th className="pl-3 py-2 w-[100px] font-bold text-left">Condição</th>
                                <th className="pl-3 py-2 w-[80px] font-bold text-left">Garantia</th>
                                {hasAppleItems && <th className="pl-3 py-2 w-[46px] font-bold text-left">Bat %</th>}
                                <th className="pl-3 py-2 w-[90px] font-bold text-left">Local</th>
                                <th className="pl-3 py-2 w-[45px] font-bold text-left">Custo</th>
                                <th className="pl-3 py-2 w-[60px] font-bold text-left">MKP%</th>
                                <th className="pl-3 py-2 w-[110px] font-bold text-left">Atacado</th>
                                <th className="pl-3 py-2 w-[110px] font-bold text-left">Venda</th>
                            </tr>
                        </thead>
                        <tbody>
                            {details.map((detail, index) => (
                                <tr key={index} className={`border-b border-border hover:bg-surface-secondary/50 ${!detail.hasImei ? 'bg-blue-50/30' : ''}`}>
                                    <td className="p-3 text-[11px] font-bold text-primary leading-tight">
                                        <div className="max-w-[200px] break-words">{detail.itemDescription}</div>
                                    </td>
                                    <td className="p-1 text-center">
                                        <span className={`px-2 py-1 rounded font-bold text-sm ${detail.hasImei ? 'bg-gray-100 text-gray-500' : 'bg-success/20 text-success'}`}>
                                            {detail.quantity}
                                        </span>
                                    </td>
                                    <td className="p-1">
                                        {detail.hasImei ? (
                                            <input
                                                id={`stock-input-${index}-imei1`}
                                                type="text"
                                                value={detail.imei1}
                                                onChange={e => handleDetailChange(index, 'imei1', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index, 'imei1')}
                                                className={`${inputClasses} h-10 w-full text-sm ${duplicateErrors[index]?.imei1 ? 'border-danger bg-red-50 ring-1 ring-danger' : ''} ${isContinuousScanEnabled ? 'focus:ring-2 focus:ring-yellow-500 font-mono transition-colors' : ''}`}
                                                placeholder={isContinuousScanEnabled ? "Bipe..." : ""}
                                            />
                                        ) : (
                                            <span className="text-muted text-center block">-</span>
                                        )}
                                    </td>
                                    <td className="p-1">
                                        {detail.hasImei ? (
                                            <input
                                                id={`stock-input-${index}-imei2`}
                                                type="text"
                                                value={detail.imei2}
                                                onChange={e => handleDetailChange(index, 'imei2', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index, 'imei2')}
                                                className={`${inputClasses} h-10 w-full text-sm ${duplicateErrors[index]?.imei2 ? 'border-danger bg-red-50 ring-1 ring-danger' : ''} ${isContinuousScanEnabled ? 'focus:ring-2 focus:ring-yellow-500 font-mono transition-colors' : ''}`}
                                            />
                                        ) : (
                                            <span className="text-muted text-center block">-</span>
                                        )}
                                    </td>
                                    <td className="p-1">
                                        {detail.hasImei ? (
                                            <input
                                                id={`stock-input-${index}-serialNumber`}
                                                type="text"
                                                value={detail.serialNumber}
                                                onChange={e => handleDetailChange(index, 'serialNumber', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index, 'serialNumber')}
                                                className={`${inputClasses} h-10 w-full text-sm ${duplicateErrors[index]?.serialNumber ? 'border-danger bg-red-50 ring-1 ring-danger' : ''} ${isContinuousScanEnabled ? 'focus:ring-2 focus:ring-yellow-500 font-mono transition-colors' : ''}`}
                                            />
                                        ) : (
                                            <span className="text-muted text-center block">-</span>
                                        )}
                                    </td>
                                    <td className="px-0.5 py-1">
                                        <select value={detail.condition} onChange={e => handleDetailChange(index, 'condition', e.target.value)} className={`${inputClasses} h-10`}>
                                            {conditionOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-0.5 py-1">
                                        <select value={detail.warranty} onChange={e => handleDetailChange(index, 'warranty', e.target.value)} className={`${inputClasses} h-10 py-2 px-3`}>
                                            {warrantyOptions.length === 0 ? <option>Carregando...</option> : <>
                                                {detail.warranty && !warrantyOptions.some(w => w.name.toLowerCase() === detail.warranty?.toLowerCase()) && <option value={detail.warranty}>{detail.warranty}</option>}
                                                {warrantyOptions.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                                            </>}
                                        </select>
                                    </td>
                                    {hasAppleItems && (
                                        <td className="px-0.5 py-1">
                                            {detail.isApple && detail.condition === 'Seminovo' ? (
                                                <input type="number" value={detail.batteryHealth} onChange={e => handleDetailChange(index, 'batteryHealth', e.target.value)} className={`${inputClasses} h-10 w-full text-right py-2 px-3`} />
                                            ) : (
                                                <span className="text-muted text-center block">-</span>
                                            )}
                                        </td>
                                    )}
                                    <td className="px-0.5 py-1">
                                        <select value={detail.storageLocation} onChange={e => handleDetailChange(index, 'storageLocation', e.target.value)} className={`${inputClasses} h-10 py-2 px-3`}>
                                            {locationOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-0.5 py-1 font-semibold text-[12px]">{formatCurrency(detail.costPrice + (detail.additionalCostPrice || 0))}</td>
                                    <td className="px-0.5 py-1 text-center font-mono">
                                        <input
                                            type="number"
                                            step="1"
                                            value={detail.markup === null ? '' : detail.markup}
                                            onChange={e => handleDetailChange(index, 'markup', e.target.value)}
                                            className={`${inputClasses} h-10 w-full text-center py-2 px-1 text-success font-bold`}
                                            placeholder="%"
                                        />
                                    </td>
                                    <td className="px-0.5 py-1"><div className="w-full"><CurrencyInput value={detail.wholesalePrice} onChange={val => handleDetailChange(index, 'wholesalePrice', val)} className={`${inputClasses} h-10 text-orange-600 py-2 px-3`} placeholder="Opcional" /></div></td>
                                    <td className="px-0.5 py-1"><div className="w-full"><CurrencyInput value={detail.salePrice} onChange={val => handleDetailChange(index, 'salePrice', val)} className={`${inputClasses} h-10 py-2 px-3 ${errors[index] ? 'border-danger ring-1 ring-danger' : ''}`} /></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div >

                {/* Mobile Cards View */}
                < div className="block md:hidden space-y-3 p-3 bg-gray-50/50" >
                    {
                        details.map((detail, index) => (
                            <div key={index} className={`bg-surface border border-border rounded-lg shadow-sm overflow-hidden animate-fade-in ${!detail.hasImei ? 'border-l-4 border-l-success' : ''}`} style={{ animationDelay: `${index * 30}ms` }}>
                                {/* Compact Header */}
                                <div className="bg-surface-secondary px-4 py-2.5 border-b border-border flex justify-between items-center">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <span className="bg-primary text-white text-[9px] font-black px-1.5 py-0.5 rounded-md min-w-[24px] text-center">#{index + 1}</span>
                                        <h3 className="font-bold text-primary text-xs truncate">{detail.itemDescription}</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${detail.hasImei ? 'bg-gray-100 text-gray-500' : 'bg-success/20 text-success'}`}>
                                            Qtd: {detail.quantity}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-3 space-y-3">
                                    {/* Dense Identification Row - Só mostra se hasImei */}
                                    {detail.hasImei && (
                                        <div className="space-y-2">
                                            <div className="relative group">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted uppercase z-10 pointer-events-none group-focus-within:text-success transition-colors">IMEI 1</span>
                                                <input
                                                    id={`stock-input-${index}-imei1`}
                                                    type="text"
                                                    value={detail.imei1}
                                                    onChange={e => handleDetailChange(index, 'imei1', e.target.value)}
                                                    onKeyDown={e => handleKeyDown(e, index, 'imei1')}
                                                    className={`${inputClassesCompact} pl-14 h-11 text-sm font-semibold rounded-lg ${duplicateErrors[index]?.imei1 ? 'border-danger bg-red-50 ring-1 ring-danger' : ''} ${isContinuousScanEnabled ? 'focus:ring-2 focus:ring-yellow-500 font-mono transition-colors' : ''}`}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="relative group">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted uppercase z-10 pointer-events-none group-focus-within:text-success transition-colors">IMEI 2</span>
                                                    <input
                                                        id={`stock-input-${index}-imei2`}
                                                        type="text"
                                                        value={detail.imei2}
                                                        onChange={e => handleDetailChange(index, 'imei2', e.target.value)}
                                                        onKeyDown={e => handleKeyDown(e, index, 'imei2')}
                                                        className={`${inputClassesCompact} pl-14 h-11 text-[11px] rounded-lg ${duplicateErrors[index]?.imei2 ? 'border-danger bg-red-50 ring-1 ring-danger' : ''} ${isContinuousScanEnabled ? 'focus:ring-2 focus:ring-yellow-500 font-mono transition-colors' : ''}`}
                                                    />
                                                </div>
                                                <div className="relative group">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted uppercase z-10 pointer-events-none group-focus-within:text-success transition-colors">S/N</span>
                                                    <input
                                                        id={`stock-input-${index}-serialNumber`}
                                                        type="text"
                                                        value={detail.serialNumber}
                                                        onChange={e => handleDetailChange(index, 'serialNumber', e.target.value)}
                                                        onKeyDown={e => handleKeyDown(e, index, 'serialNumber')}
                                                        className={`${inputClassesCompact} pl-10 h-11 text-[11px] rounded-lg ${duplicateErrors[index]?.serialNumber ? 'border-danger bg-red-50 ring-1 ring-danger' : ''} ${isContinuousScanEnabled ? 'focus:ring-2 focus:ring-yellow-500 font-mono transition-colors' : ''}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Compact Specs Row */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col">
                                            <label className="text-[9px] font-bold text-muted uppercase mb-0.5 ml-1">Condição</label>
                                            <select value={detail.condition} onChange={e => handleDetailChange(index, 'condition', e.target.value)} className={`${inputClassesCompact} h-11 py-0 rounded-lg`}>
                                                {conditionOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[9px] font-bold text-muted uppercase mb-0.5 ml-1">Local</label>
                                            <select value={detail.storageLocation} onChange={e => handleDetailChange(index, 'storageLocation', e.target.value)} className={`${inputClassesCompact} h-11 py-0 rounded-lg`}>
                                                {locationOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[9px] font-bold text-muted uppercase mb-0.5 ml-1">Garantia</label>
                                            <select value={detail.warranty} onChange={e => handleDetailChange(index, 'warranty', e.target.value)} className={`${inputClassesCompact} h-11 py-0 rounded-lg`}>
                                                {warrantyOptions.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                                            </select>
                                        </div>
                                        {detail.isApple && detail.condition === 'Seminovo' && (
                                            <div className="flex flex-col">
                                                <label className="text-[9px] font-bold text-muted uppercase mb-0.5 ml-1">Saúde Bateria</label>
                                                <div className="relative">
                                                    <input type="number" value={detail.batteryHealth} onChange={e => handleDetailChange(index, 'batteryHealth', e.target.value)} className={`${inputClassesCompact} h-11 text-center font-bold text-blue-600 pr-5 rounded-lg`} />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">%</span>
                                                </div>
                                            </div>
                                        )}

                                    </div>

                                    {/* Compact Pricing Row */}
                                    <div className="bg-gray-50/80 p-2 rounded border border-border/50">
                                        <div className="flex justify-between items-center mb-1.5 px-1">
                                            <span className="text-[9px] font-bold text-muted uppercase">Custo: {formatCurrency(detail.costPrice + (detail.additionalCostPrice || 0))}</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[9px] font-bold text-muted">Markup %</span>
                                                <input type="number" step="0.1" value={detail.markup === null ? '' : detail.markup} onChange={e => handleDetailChange(index, 'markup', e.target.value)} className="w-12 h-6 border rounded text-[10px] text-center font-bold border-border" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex flex-col">
                                                <label className="text-[9px] font-black text-success uppercase ml-1 mb-1">Preço Venda</label>
                                                <CurrencyInput
                                                    value={detail.salePrice}
                                                    onChange={val => handleDetailChange(index, 'salePrice', val)}
                                                    className={`w-full h-11 border rounded-lg text-sm font-black text-primary ${errors[index] ? 'border-danger ring-1 ring-danger' : 'border-success/30'}`}
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <label className="text-[9px] font-bold text-orange-600 uppercase ml-1 mb-1">Preço Atacado</label>
                                                <CurrencyInput
                                                    value={detail.wholesalePrice}
                                                    onChange={val => handleDetailChange(index, 'wholesalePrice', val)}
                                                    className={`w-full h-11 border rounded-lg text-sm font-bold text-orange-600 border-orange-100 bg-orange-50/30`}
                                                    placeholder="---"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    }
                </div >
            </>
        );
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-end md:items-center z-[99999] p-0 md:p-4 animate-fade-in">
            <div className="bg-surface w-full max-w-[99vw] h-[100dvh] md:h-auto md:max-h-[95vh] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-4 md:p-6 border-b border-border bg-surface sticky top-0 z-20 gap-4">
                    <div>
                        <h2 className="text-lg md:text-2xl font-black text-primary leading-tight">Lançar Compra #{purchaseOrder.displayId}</h2>
                        <p className="text-xs md:text-sm text-muted font-medium">Fornecedor: <span className="text-primary">{purchaseOrder.supplierName}</span></p>
                    </div>

                    {/* Quick Stock Search */}
                    <div className="relative flex-1 max-w-md mx-4 hidden md:block">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="🔍 Buscar estoque (Modelo/Condição)..."
                                value={stockSearchTerm}
                                onChange={e => {
                                    setStockSearchTerm(e.target.value);
                                    setShowStockResults(true);
                                }}
                                onFocus={() => setShowStockResults(true)}
                                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-border shadow-sm rounded-xl text-sm font-medium text-primary placeholder:text-muted focus:bg-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all hover:bg-gray-100/50"
                            />
                            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            {stockSearchTerm && (
                                <button onClick={() => { setStockSearchTerm(''); setShowStockResults(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-danger p-0.5 rounded-full hover:bg-danger/10">
                                    <XCircleIcon className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {showStockResults && stockSearchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-[300px] overflow-y-auto">
                                {stockSearchResults.map(product => (
                                    <div key={product.id} className="p-3 border-b border-border hover:bg-surface-secondary transition-colors cursor-default">
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="font-bold text-sm text-primary">{product.model}</div>
                                            <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{product.condition}</span>
                                        </div>
                                        <div className="flex gap-4 text-xs mt-1">
                                            <div>
                                                <span className="text-muted block text-[10px] uppercase font-bold">Custo</span>
                                                <span className="font-semibold text-gray-700">{formatCurrency(product.costPrice || 0)}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted block text-[10px] uppercase font-bold text-orange-600">Atacado</span>
                                                <span className="font-semibold text-orange-600">{formatCurrency(product.wholesalePrice || 0)}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted block text-[10px] uppercase font-bold text-success">Venda</span>
                                                <span className="font-bold text-success">{formatCurrency(product.price)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {showStockResults && stockSearchTerm && stockSearchResults.length === 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-xl z-50 p-4 text-center text-sm text-muted">
                                Nenhum produto encontrado.
                            </div>
                        )}
                    </div>

                    <button onClick={() => onClose(false)} className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-full transition-colors">
                        <XCircleIcon className="h-7 w-7 md:h-8 md:w-8" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/30">
                    {isBulkMode ? renderBulkMode() : renderUniqueMode()}
                </div>

                <div className="p-4 md:p-6 border-t border-border bg-surface mt-auto shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex items-center justify-between">

                    <button
                        onClick={() => setIsContinuousScanEnabled(!isContinuousScanEnabled)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${isContinuousScanEnabled ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-500' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        <BoltIcon className={`h-5 w-5 ${isContinuousScanEnabled ? 'animate-pulse' : ''}`} />
                        {isContinuousScanEnabled ? 'Leitura Contínua ATIVA' : 'Leitura Contínua'}
                    </button>

                    <div className="flex gap-4">
                        <button
                            onClick={handleLaunchStock}
                            disabled={isSaving}
                            className="w-full md:w-auto md:ml-auto px-8 py-3 bg-success text-white rounded-xl hover/bg-success/90 font-bold disabled:bg-muted flex items-center justify-center gap-3 text-lg shadow-lg shadow-success/20 transition-all active:scale-95 mb-safe"
                        >
                            {isSaving ? <SpinnerIcon className="h-6 w-6 animate-spin" /> : <DocumentArrowUpIcon className="h-6 w-6" />}
                            Lançar no Estoque
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default StockInModal;
