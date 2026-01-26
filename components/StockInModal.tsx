
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { PurchaseOrder, Product, PurchaseItem, ProductConditionParameter, StorageLocationParameter, WarrantyParameter } from '../types.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import { launchPurchaseToStock, formatCurrency, getProductConditions, getStorageLocations, getWarranties } from '../services/mockApi.ts';
import { SpinnerIcon, DocumentArrowUpIcon, XCircleIcon } from './icons.tsx';
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
    const { user } = useUser();

    // Dynamic parameters from Empresa > Parâmetros
    const [conditionOptions, setConditionOptions] = useState<ProductConditionParameter[]>([]);
    const [locationOptions, setLocationOptions] = useState<StorageLocationParameter[]>([]);
    const [warrantyOptions, setWarrantyOptions] = useState<WarrantyParameter[]>([]);

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

    const isBulkMode = useMemo(() =>
        purchaseOrder.items.every(item => !item.hasImei),
        [purchaseOrder.items]);

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
                storageLocation: item.productDetails.storageLocation || 'Estoque Principal',
                costPrice: item.unitCost,
                additionalCostPrice: item.additionalUnitCost,
                markup: null, salePrice: null, wholesalePrice: null,
                minimumStock: item.minimumStock,
                isApple: item.productDetails.brand === 'Apple',
                barcode: (item.barcodes && item.barcodes.length > 0) ? item.barcodes[0] : '',
                controlByBarcode: item.controlByBarcode
            };

            if (isBulkMode) {
                return [{
                    ...baseDetail,
                    quantity: quantityToLaunch,
                }];
            } else {
                return Array.from({ length: quantityToLaunch }, () => ({
                    ...baseDetail,
                    quantity: 1,
                }));
            }
        });

        if (expandedDetails.length === 0) {
            showToast("Todos os itens desta compra já foram lançados no estoque.", "info");
            onClose(false);
            return;
        }

        setDetails(expandedDetails);

        const hasMinStockEnabled = expandedDetails.some(d => !d.isApple && d.minimumStock && d.minimumStock > 0);
        setIsMinimumStockEnabled(hasMinStockEnabled);
    }, [purchaseOrder, allProducts, onClose, showToast, isBulkMode]);

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
            (detail as any)[field] = value.replace(/\D/g, '').substring(0, 15);
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

            await launchPurchaseToStock(purchaseOrder.id, newProducts);
            showToast(`Estoque da compra #${purchaseOrder.displayId} lançado com sucesso!`, 'success');
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
                                <td className="p-3 font-semibold">{formatCurrency(detail.costPrice)}</td>
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
                                        <span className="text-[9px] font-bold text-muted uppercase">Custo: {formatCurrency(detail.costPrice)}</span>
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
                        <thead className="text-left text-xs text-muted bg-surface-secondary sticky top-0 z-10">
                            <tr>
                                <th className="p-3 w-40">Descrição</th>
                                <th className="p-1 w-44">IMEI 1</th>
                                <th className="p-1 w-44">IMEI 2</th>
                                <th className="p-1 w-44">S/N</th>
                                <th className="p-3 min-w-[120px]">Condição</th>
                                <th className="p-3 min-w-[130px]">Garantia</th>
                                {hasAppleItems && <th className="p-3 w-24 text-center">Bateria %</th>}
                                <th className="p-3 min-w-[130px]">Local</th>
                                <th className="p-3 w-24">Custo</th>
                                <th className="p-3 w-24">Markup %</th>
                                <th className="p-3 w-40">Preço Atacado</th>
                                <th className="p-3 w-40">Preço Venda</th>
                            </tr>
                        </thead>
                        <tbody>
                            {details.map((detail, index) => (
                                <tr key={index} className="border-b border-border hover:bg-surface-secondary/50">
                                    <td className="p-3 text-[10px] font-medium text-primary leading-tight">
                                        <div className="line-clamp-2 max-w-[180px]">{detail.itemDescription}</div>
                                    </td>
                                    <td className="p-1"><input type="text" value={detail.imei1} onChange={e => handleDetailChange(index, 'imei1', e.target.value)} className={`${inputClasses} h-10 w-full text-sm ${duplicateErrors[index]?.imei1 ? 'border-danger bg-red-50 ring-1 ring-danger' : ''}`} /></td>
                                    <td className="p-1"><input type="text" value={detail.imei2} onChange={e => handleDetailChange(index, 'imei2', e.target.value)} className={`${inputClasses} h-10 w-full text-sm ${duplicateErrors[index]?.imei2 ? 'border-danger bg-red-50 ring-1 ring-danger' : ''}`} /></td>
                                    <td className="p-1"><input type="text" value={detail.serialNumber} onChange={e => handleDetailChange(index, 'serialNumber', e.target.value)} className={`${inputClasses} h-10 w-full text-sm ${duplicateErrors[index]?.serialNumber ? 'border-danger bg-red-50 ring-1 ring-danger' : ''}`} /></td>
                                    <td className="p-3">
                                        <select value={detail.condition} onChange={e => handleDetailChange(index, 'condition', e.target.value)} className={`${inputClasses} h-10`}>
                                            {conditionOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-3">
                                        <select value={detail.warranty} onChange={e => handleDetailChange(index, 'warranty', e.target.value)} className={`${inputClasses} h-10`}>
                                            {warrantyOptions.length === 0 ? <option>Carregando...</option> : <>
                                                {detail.warranty && !warrantyOptions.some(w => w.name.toLowerCase() === detail.warranty?.toLowerCase()) && <option value={detail.warranty}>{detail.warranty}</option>}
                                                {warrantyOptions.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                                            </>}
                                        </select>
                                    </td>
                                    {hasAppleItems && (
                                        <td className="p-3">
                                            {detail.isApple && detail.condition === 'Seminovo' ? (
                                                <input type="number" value={detail.batteryHealth} onChange={e => handleDetailChange(index, 'batteryHealth', e.target.value)} className={`${inputClasses} h-10 w-20 text-right`} />
                                            ) : (
                                                <span className="text-muted text-center block">-</span>
                                            )}
                                        </td>
                                    )}
                                    <td className="p-3">
                                        <select value={detail.storageLocation} onChange={e => handleDetailChange(index, 'storageLocation', e.target.value)} className={`${inputClasses} h-10`}>
                                            {locationOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-3 font-semibold">{formatCurrency(detail.costPrice)}</td>
                                    <td className="p-3 w-28"><input type="number" step="0.01" value={detail.markup === null ? '' : detail.markup} onChange={e => handleDetailChange(index, 'markup', e.target.value)} className={`${inputClasses} h-10 text-right`} /></td>
                                    <td className="p-3"><CurrencyInput value={detail.wholesalePrice} onChange={val => handleDetailChange(index, 'wholesalePrice', val)} className={`${inputClasses} h-10 text-orange-600`} placeholder="Opc." /></td>
                                    <td className="p-3"><CurrencyInput value={detail.salePrice} onChange={val => handleDetailChange(index, 'salePrice', val)} className={`${inputClasses} h-10 ${errors[index] ? 'border-danger ring-1 ring-danger' : ''}`} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div >

                {/* Mobile Cards View */}
                < div className="block md:hidden space-y-3 p-3 bg-gray-50/50" >
                    {
                        details.map((detail, index) => (
                            <div key={index} className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden animate-fade-in" style={{ animationDelay: `${index * 30}ms` }}>
                                {/* Compact Header */}
                                <div className="bg-surface-secondary px-4 py-2.5 border-b border-border flex justify-between items-center">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <span className="bg-primary text-white text-[9px] font-black px-1.5 py-0.5 rounded-md min-w-[24px] text-center">#{index + 1}</span>
                                        <h3 className="font-bold text-primary text-xs truncate">{detail.itemDescription}</h3>
                                    </div>
                                    <span className="text-[9px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full uppercase">Pendente</span>
                                </div>

                                <div className="p-3 space-y-3">
                                    {/* Dense Identification Row */}
                                    <div className="space-y-2">
                                        <div className="relative group">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted uppercase z-10 pointer-events-none group-focus-within:text-success transition-colors">IMEI 1</span>
                                            <input
                                                type="text"
                                                value={detail.imei1}
                                                onChange={e => handleDetailChange(index, 'imei1', e.target.value)}
                                                className={`${inputClassesCompact} pl-14 h-11 text-sm font-semibold rounded-lg ${duplicateErrors[index]?.imei1 ? 'border-danger bg-red-50 ring-1 ring-danger' : ''}`}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="relative group">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted uppercase z-10 pointer-events-none group-focus-within:text-success transition-colors">IMEI 2</span>
                                                <input
                                                    type="text"
                                                    value={detail.imei2}
                                                    onChange={e => handleDetailChange(index, 'imei2', e.target.value)}
                                                    className={`${inputClassesCompact} pl-14 h-11 text-[11px] rounded-lg ${duplicateErrors[index]?.imei2 ? 'border-danger bg-red-50 ring-1 ring-danger' : ''}`}
                                                />
                                            </div>
                                            <div className="relative group">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted uppercase z-10 pointer-events-none group-focus-within:text-success transition-colors">S/N</span>
                                                <input
                                                    type="text"
                                                    value={detail.serialNumber}
                                                    onChange={e => handleDetailChange(index, 'serialNumber', e.target.value)}
                                                    className={`${inputClassesCompact} pl-10 h-11 text-[11px] rounded-lg ${duplicateErrors[index]?.serialNumber ? 'border-danger bg-red-50 ring-1 ring-danger' : ''}`}
                                                />
                                            </div>
                                        </div>
                                    </div>

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
                                            <span className="text-[9px] font-bold text-muted uppercase">Custo: {formatCurrency(detail.costPrice)}</span>
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
            <div className="bg-surface w-full max-w-[98vw] 2xl:max-w-screen-2xl h-[100dvh] md:h-auto md:max-h-[95vh] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-4 md:p-6 border-b border-border bg-surface sticky top-0 z-20">
                    <div>
                        <h2 className="text-lg md:text-2xl font-black text-primary leading-tight">Lançar Compra #{purchaseOrder.displayId}</h2>
                        <p className="text-xs md:text-sm text-muted font-medium">Fornecedor: <span className="text-primary">{purchaseOrder.supplierName}</span></p>
                    </div>
                    <button onClick={() => onClose(false)} className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-full transition-colors">
                        <XCircleIcon className="h-7 w-7 md:h-8 md:w-8" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/30">
                    {isBulkMode ? renderBulkMode() : renderUniqueMode()}
                </div>

                <div className="p-4 md:p-6 border-t border-border bg-surface mt-auto shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
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
        </div>,
        document.body
    );
};

export default StockInModal;
