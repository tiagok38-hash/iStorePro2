
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PurchaseOrder, PurchaseItem, Supplier, ProductCondition, Product, Brand, Category, ProductModel, Grade, GradeValue, ProductVariation, Customer, ProductConditionParameter, StorageLocationParameter, WarrantyParameter, ReceiptTermParameter } from '../types.ts';
import { addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, formatCurrency, findOrCreateSupplierFromCustomer, getProductConditions, getStorageLocations, getWarranties, getReceiptTerms } from '../services/mockApi.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import { XCircleIcon, TrashIcon, PlusIcon, SpinnerIcon, BarcodeIcon, PrinterIcon, ArrowRightCircleIcon, CheckIcon, ChevronLeftIcon } from './icons.tsx';
import CurrencyInput from './CurrencyInput.tsx';
import SearchableDropdown from './SearchableDropdown.tsx';
import CustomerModal from './CustomerModal.tsx';

interface PurchaseOrderModalProps {
    suppliers: Supplier[];
    customers: Customer[];
    brands: Brand[];
    categories: Category[];
    productModels: ProductModel[];
    grades: Grade[];
    gradeValues: GradeValue[];
    onClose: (refresh: boolean) => void;
    purchaseOrderToEdit?: PurchaseOrder | null;
    onAddNewSupplier: (supplierData: Omit<Supplier, 'id'>) => Promise<Supplier | null>;
}

type CurrentItemType = Omit<PurchaseItem, 'id'> & { storage?: string, variations: ProductVariation[], barcode?: string };

const emptyItem: CurrentItemType = {
    productDetails: { brand: 'Apple', category: '', subCategory: '', model: '', color: '', condition: 'Novo', warranty: '1 ano', storageLocation: 'Loja' },
    barcode: '',
    quantity: 1,
    unitCost: 0,
    additionalUnitCost: 0,
    finalUnitCost: 0,
    hasImei: true,
    storage: '',
    variations: [],
    minimumStock: 1,
    controlByBarcode: false,
};

import { appleProductHierarchy } from '../services/constants.ts';

export const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({ suppliers, customers, brands, categories, productModels, grades, gradeValues, onClose, purchaseOrderToEdit, onAddNewSupplier }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<Partial<PurchaseOrder>>({});
    const [items, setItems] = useState<Partial<PurchaseItem>[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Step 2 state
    const [currentItem, setCurrentItem] = useState<Partial<CurrentItemType>>(JSON.parse(JSON.stringify(emptyItem)));
    const [productType, setProductType] = useState<'Apple' | 'Produto'>('Apple');
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [isCustomerPurchase, setIsCustomerPurchase] = useState(false);
    const [currentGradeId, setCurrentGradeId] = useState('');
    const [currentValueId, setCurrentValueId] = useState('');
    const [isMinimumStockEnabled, setIsMinimumStockEnabled] = useState(false);
    const [showVariations, setShowVariations] = useState(false);

    // Dynamic parameters from Empresa > Parâmetros
    const [conditionOptions, setConditionOptions] = useState<ProductConditionParameter[]>([]);
    const [locationOptions, setLocationOptions] = useState<StorageLocationParameter[]>([]);
    const [warrantyOptions, setWarrantyOptions] = useState<WarrantyParameter[]>([]);
    const [terms, setTerms] = useState<ReceiptTermParameter[]>([]);


    const { showToast } = useToast();

    const { user } = useUser();

    // Lock body scroll on mount
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    const handleCloseInternal = async (refresh: boolean) => {
        // If it's a new purchase (no purchaseOrderToEdit), and a draft was created (formData.id exists),
        // and it has no items, delete the draft as the user "gave up".
        if (!refresh && !purchaseOrderToEdit && formData.id && items.length === 0) {
            try {
                await deletePurchaseOrder(formData.id);
            } catch (err) {
                console.error("Error deleting empty draft on cancel:", err);
            }
        }
        onClose(refresh);
    };

    // Fetch dynamic parameters on mount
    useEffect(() => {
        const fetchParameters = async () => {
            const [conditions, locations, warranties, termsData] = await Promise.all([
                getProductConditions(),
                getStorageLocations(),
                getWarranties(),
                getReceiptTerms()
            ]);
            setConditionOptions(conditions);
            setLocationOptions(locations);
            setWarrantyOptions(warranties);
            setTerms(termsData);
        };
        fetchParameters();
    }, []);

    useEffect(() => {
        if (purchaseOrderToEdit) {
            setFormData(purchaseOrderToEdit);
            setItems(purchaseOrderToEdit.items);
            setIsCustomerPurchase(purchaseOrderToEdit.isCustomerPurchase || false);
            setStep(1); // Start editing from Step 1
        } else {
            // Format date as YYYY-MM-DDTHH:mm for datetime-local input
            // Using toLocaleString to format, then converting to the required input format
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

            setFormData({
                purchaseDate: localDateTime,
                additionalCost: 0,
                financialStatus: 'Pendente',
                stockStatus: 'Pendente',
                origin: 'Compra Nacional',
            });
            setItems([]);
            setIsCustomerPurchase(false);
            setStep(1);
        }
    }, [purchaseOrderToEdit]);

    const subTotal = useMemo(() => {
        return items.reduce((sum, item) => sum + (item.finalUnitCost || 0) * (item.quantity || 0), 0);
    }, [items]);

    const calculatedAdditionalCost = useMemo(() => {
        if (formData.origin === 'Importação') {
            const shipping = formData.shippingCost || 0;
            const type = formData.shippingType || 'R$';
            const rate = formData.dollarRate || 0;

            if (type === 'US$') return shipping * (rate || 1);
            if (type === '%') return subTotal * (shipping / 100);
            return shipping;
        }
        return formData.additionalCost || 0;
    }, [formData.origin, formData.shippingCost, formData.shippingType, formData.dollarRate, subTotal, formData.additionalCost]);

    const total = useMemo(() => {
        return subTotal + calculatedAdditionalCost;
    }, [subTotal, calculatedAdditionalCost]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSupplierChange = async (selectedId: string | null) => {
        if (!selectedId) {
            setFormData(prev => ({ ...prev, supplierId: undefined, supplierName: undefined }));
            return;
        }
        const supplier = suppliers.find(s => s.id === selectedId);
        if (supplier) {
            setFormData(prev => ({ ...prev, supplierId: selectedId, supplierName: supplier.name }));
            setIsCustomerPurchase(!!supplier.linkedCustomerId);
            return;
        }
        const customer = customers.find(c => c.id === selectedId);
        if (customer) {
            try {
                const convertedSupplier = await findOrCreateSupplierFromCustomer(customer);
                setFormData(prev => ({ ...prev, supplierId: convertedSupplier.id, supplierName: convertedSupplier.name }));
                setIsCustomerPurchase(true);
            } catch (error) {
                showToast('Erro ao vincular cliente como fornecedor.', 'error');
            }
        }
    }

    const saveDraft = async (currentItems: Partial<PurchaseItem>[]) => {
        if (!formData.id) return;

        const currentSubTotal = currentItems.reduce((sum, item) => sum + (item.finalUnitCost || 0) * (item.quantity || 0), 0);

        let currentAddCost = formData.additionalCost || 0;
        if (formData.origin === 'Importação') {
            const shipping = formData.shippingCost || 0;
            const type = formData.shippingType || 'R$';
            const rate = formData.dollarRate || 0;
            if (type === 'US$') currentAddCost = shipping * (rate || 1);
            else if (type === '%') currentAddCost = currentSubTotal * (shipping / 100);
            else currentAddCost = shipping;
        }

        const currentTotal = currentSubTotal + currentAddCost;

        const sanitizedItems = currentItems.map((item) => {
            const itemAny = item as any;
            return {
                id: item.id,
                productDetails: {
                    brand: item.productDetails?.brand || '',
                    category: item.productDetails?.category || '',
                    model: item.productDetails?.model || '',
                    color: item.productDetails?.color || '',
                    condition: item.productDetails?.condition || 'Novo',
                    warranty: item.productDetails?.warranty || '1 ano',
                    storageLocation: item.productDetails?.storageLocation || 'Loja',
                },
                barcodes: itemAny.barcode ? [itemAny.barcode] : [],
                quantity: Number(item.quantity || 0),
                unitCost: Number(item.unitCost || 0),
                additionalUnitCost: Number(item.additionalUnitCost || 0),
                finalUnitCost: Number(item.finalUnitCost || 0),
                hasImei: !!item.hasImei,
                minimumStock: item.minimumStock ? Number(item.minimumStock) : undefined,
                variations: itemAny.variations || [],
                controlByBarcode: !!item.controlByBarcode
            };
        }) as PurchaseItem[];

        try {
            await updatePurchaseOrder({
                ...formData,
                items: sanitizedItems,
                total: currentTotal,
                additionalCost: formData.additionalCost || 0
            });
        } catch (err) {
            console.error("Auto-save error:", err);
            showToast('Erro ao salvar rascunho automaticamente.', 'warning');
        }
    };

    const goToStep2 = async () => {
        if (!formData.supplierId) {
            showToast('Por favor, selecione um fornecedor.', 'error');
            return;
        }

        if (!formData.id && !purchaseOrderToEdit) {
            setIsSaving(true);
            try {
                let currentSupplierName = formData.supplierName;
                if (!currentSupplierName && formData.supplierId) {
                    const supplier = suppliers.find(s => s.id === formData.supplierId);
                    const customer = customers.find(c => c.id === formData.supplierId);
                    currentSupplierName = supplier?.name || customer?.name || 'Fornecedor Desconhecido';
                }

                const purchaseData: any = {
                    purchaseDate: formData.purchaseDate!,
                    supplierId: formData.supplierId!,
                    supplierName: currentSupplierName!,
                    origin: formData.origin!,
                    isCustomerPurchase,
                    purchaseTerm: formData.purchaseTerm,
                    items: [],
                    total: 0,
                    additionalCost: 0,
                    stockStatus: 'Pendente',
                    financialStatus: 'Pendente',
                    createdBy: user?.name || 'Sistema',
                    observations: formData.observations,
                    status: 'Pendente',
                    shippingCost: formData.shippingCost,
                    shippingType: formData.shippingType,
                    dollarRate: formData.dollarRate
                };

                const newPO = await addPurchaseOrder(purchaseData);
                setFormData(prev => ({ ...prev, ...newPO }));
                showToast('Rascunho iniciado.', 'success');
            } catch (error) {
                console.error("Error creating draft:", error);
                showToast('Erro ao iniciar rascunho.', 'error');
                setIsSaving(false);
                return;
            } finally {
                setIsSaving(false);
            }
        }

        setStep(2);
    }

    const handleSaveNewSupplier = async (entityData: any, entityType: 'Cliente' | 'Fornecedor' | 'Ambos', personType: 'Pessoa Física' | 'Pessoa Jurídica') => {
        const supplierPayload: Omit<Supplier, 'id'> = {
            name: entityData.name,
            contactPerson: entityData.name,
            email: entityData.email,
            phone: entityData.phone,
            cnpj: entityData.cnpj || '',
            address: `${entityData.address?.street || ''}, ${entityData.address?.number || ''}`.trim()
        };
        const newSupplier = await onAddNewSupplier(supplierPayload);
        if (newSupplier) {
            // Directly set the supplier data without relying on the props list (which may not have updated yet)
            setFormData(prev => ({ ...prev, supplierId: newSupplier.id, supplierName: newSupplier.name }));
            setIsCustomerPurchase(false);
            setIsSupplierModalOpen(false);
            showToast(`Fornecedor "${newSupplier.name}" criado e selecionado!`, 'success');
        }
    };

    const handleCurrentItemChange = (field: keyof CurrentItemType, value: any) => {
        const updatedItem = { ...currentItem, [field]: value };
        if (field === 'unitCost' || field === 'additionalUnitCost') {
            updatedItem.finalUnitCost = (updatedItem.unitCost || 0) + (updatedItem.additionalUnitCost || 0);
        }
        setCurrentItem(updatedItem as any);
    };

    const handleToggleMinimumStock = (checked: boolean) => {
        setIsMinimumStockEnabled(checked);
        if (!checked) {
            const { minimumStock, ...rest } = currentItem;
            setCurrentItem(rest);
        } else {
            setCurrentItem(prev => ({ ...prev, minimumStock: prev.minimumStock || 1 }));
        }
    };

    const handleProductDetailChange = (field: keyof PurchaseItem['productDetails'], value: any) => {
        let finalValue = value;
        if (field === 'batteryHealth' && value !== '') {
            finalValue = parseInt(value, 10);
        }
        const updatedDetails = { ...currentItem.productDetails!, [field]: finalValue };
        setCurrentItem({ ...currentItem, productDetails: updatedDetails });
    };

    const handleAppleFilterChange = (field: 'category' | 'model' | 'storage' | 'color', value: string) => {
        const updatedItem = JSON.parse(JSON.stringify(currentItem));
        switch (field) {
            case 'category':
                updatedItem.productDetails.category = value;
                updatedItem.productDetails.model = '';
                updatedItem.storage = '';
                updatedItem.productDetails.color = '';
                break;
            case 'model':
                updatedItem.productDetails.model = value;
                updatedItem.storage = '';
                updatedItem.productDetails.color = '';
                break;
            case 'storage':
                updatedItem.storage = value;
                updatedItem.productDetails.color = '';
                break;
            case 'color':
                updatedItem.productDetails.color = value;
                break;
        }
        setCurrentItem(updatedItem);
    };

    const handlePrintTerm = () => {
        if (!formData.purchaseTerm) return;
        const term = terms.find(t => t.name === formData.purchaseTerm);
        if (term) {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                const content = (term as any).content || 'Conteúdo do termo não disponível.';
                printWindow.document.write(`
                    <html>
                        <head>
                            <title>${term.name}</title>
                            <style>
                                body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; color: #333; }
                                h1 { text-align: center; margin-bottom: 30px; font-size: 24px; text-transform: uppercase; }
                                .content { white-space: pre-wrap; margin-bottom: 60px; text-align: justify; }
                                .signatures { display: flex; justify-content: space-between; margin-top: 100px; }
                                .signature-box { border-top: 1px solid #000; width: 45%; text-align: center; padding-top: 10px; }
                            </style>
                        </head>
                        <body>
                            <h1>${term.name}</h1>
                            <div class="content">${content}</div>
                            
                            <div class="signatures">
                                <div class="signature-box">
                                    <p>Assinatura do Cliente</p>
                                    <small>${formData.supplierName || 'Cliente'}</small>
                                </div>
                                <div class="signature-box">
                                    <p>Assinatura da Loja</p>
                                    <small>${user?.name || 'Vendedor'}</small>
                                </div>
                            </div>
                            <script>
                                window.onload = () => {
                                    window.print();
                                    setTimeout(() => window.close(), 500);
                                };
                            </script>
                        </body>
                    </html>
                `);
                printWindow.document.close();
            }
        } else {
            showToast('Termo não encontrado.', 'error');
        }
    };

    const handleAddVariation = () => {
        if (!currentGradeId) return;
        const grade = grades.find(g => g.id === currentGradeId);
        const value = currentValueId ? gradeValues.find(v => v.id === currentValueId) : null;

        if (!grade) return;

        const newVariation: ProductVariation = {
            gradeId: grade.id,
            gradeName: grade.name,
            valueId: currentValueId || '',
            valueName: value ? value.name : ''
        };
        const existingVariations = currentItem.variations || [];
        const existingIndex = existingVariations.findIndex(v => v.gradeId === newVariation.gradeId);
        let newVariations = [];
        if (existingIndex > -1) {
            newVariations = [...existingVariations];
            newVariations[existingIndex] = newVariation;
        } else {
            newVariations = [...existingVariations, newVariation];
        }
        setCurrentItem(prev => ({ ...prev, variations: newVariations }));
        setCurrentGradeId('');
        setCurrentValueId('');
    };

    const handleRemoveVariation = (index: number) => {
        setCurrentItem(prev => ({ ...prev, variations: prev.variations?.filter((_, i) => i !== index) || [] }));
    };

    const handleAddItem = () => {
        const finalProductDetails = { ...currentItem.productDetails! };
        let modelString = '';
        const variationString = (currentItem.variations || []).map(v => v.valueName).join(' ');

        if (productType === 'Apple') {
            const categoryName = currentItem.productDetails?.category || '';
            const modelName = currentItem.productDetails?.model || '';
            if (modelName.includes(categoryName)) {
                modelString = `${modelName} ${currentItem.storage || ''} ${currentItem.productDetails?.color || ''} ${variationString}`.trim().replace(/\s+/g, ' ');
            } else {
                modelString = `${categoryName} ${modelName} ${currentItem.storage || ''} ${currentItem.productDetails?.color || ''} ${variationString}`.trim().replace(/\s+/g, ' ');
            }
            finalProductDetails.model = modelString;
            finalProductDetails.brand = 'Apple';
        } else {
            const brandObj = brands.find(b => b.id === currentItem.productDetails?.brand);
            const brandName = brandObj?.name || currentItem.productDetails?.brand || '';
            finalProductDetails.brand = brandName;

            const categoryObj = categories.find(c => c.id === currentItem.productDetails?.category);
            const categoryName = categoryObj?.name || currentItem.productDetails?.category || '';

            const modelObj = productModels.find(m => m.id === currentItem.productDetails?.model);
            const modelName = modelObj?.name || '';

            modelString = `${categoryName} ${brandName} ${modelName} ${variationString}`.trim().replace(/\s+/g, ' ');

            finalProductDetails.model = modelString;
        }

        if (!modelString) {
            showToast('Preencha os detalhes do produto (modelo, etc).', 'warning');
            return;
        }

        const newItem: Partial<PurchaseItem> = {
            id: `new-${items.length}-${Date.now()}`,
            ...(currentItem as Omit<PurchaseItem, 'id'>),
            productDetails: finalProductDetails,
            barcodes: (currentItem as any).barcode ? [(currentItem as any).barcode] : [],
            controlByBarcode: !!(currentItem as any).barcode,
        };
        delete (newItem as any).storage;

        const newItems = [...items, newItem];
        setItems(newItems);
        saveDraft(newItems);

        // Reset currentItem but keep STICKY FIELDS for faster entry
        const prevDetails = currentItem.productDetails;
        const prevStorage = currentItem.storage;
        const resetItem = JSON.parse(JSON.stringify(emptyItem));

        if (prevDetails) {
            resetItem.productDetails.brand = prevDetails.brand;
            resetItem.productDetails.category = prevDetails.category;
            resetItem.productDetails.model = prevDetails.model;
            resetItem.productDetails.warranty = prevDetails.warranty;
            resetItem.productDetails.condition = prevDetails.condition;
            resetItem.productDetails.storageLocation = prevDetails.storageLocation;
            // Persist storage for Apple products as requested
            resetItem.storage = prevStorage;
        }

        setCurrentItem(resetItem);
        setCurrentGradeId('');
        setCurrentValueId('');
    };

    const removeItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
        saveDraft(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (items.length === 0) {
            showToast('Adicione pelo menos um item à compra.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const sanitizedItems = items.map((item) => {
                const { ...rest } = item; // Keep ID
                return {
                    id: item.id, // Preserve ID
                    productDetails: {
                        brand: item.productDetails?.brand || '',
                        category: item.productDetails?.category || '',
                        model: item.productDetails?.model || '',
                        color: item.productDetails?.color || '',
                        condition: item.productDetails?.condition || 'Novo',
                        warranty: item.productDetails?.warranty || '1 ano',
                        storageLocation: item.productDetails?.storageLocation || 'Loja',
                    },
                    barcodes: item.barcode ? [item.barcode] : [],
                    quantity: Number(item.quantity || 0),
                    unitCost: Number(item.unitCost || 0),
                    additionalUnitCost: Number(item.additionalUnitCost || 0),
                    finalUnitCost: Number(item.finalUnitCost || 0),
                    hasImei: !!item.hasImei,
                    minimumStock: item.minimumStock ? Number(item.minimumStock) : undefined,
                    variations: item.variations || [],
                    controlByBarcode: !!item.controlByBarcode
                };
            }) as PurchaseItem[];

            if (purchaseOrderToEdit || formData.id) {
                const purchaseData: PurchaseOrder = {
                    ...purchaseOrderToEdit,
                    ...formData,
                    isCustomerPurchase,
                    items: sanitizedItems,
                    total: total,
                    additionalCost: formData.additionalCost || 0,
                };
                await updatePurchaseOrder(purchaseData);
                showToast('Compra atualizada com sucesso!', 'success');
            } else {
                let currentSupplierName = formData.supplierName;
                if (!currentSupplierName && formData.supplierId) {
                    const supplier = suppliers.find(s => s.id === formData.supplierId);
                    const customer = customers.find(c => c.id === formData.supplierId);
                    currentSupplierName = supplier?.name || customer?.name || 'Fornecedor Desconhecido';
                }

                const purchaseData: Omit<PurchaseOrder, 'id' | 'displayId' | 'createdAt' | 'locatorId'> = {
                    purchaseDate: formData.purchaseDate!,
                    supplierId: formData.supplierId!,
                    supplierName: currentSupplierName!,
                    origin: formData.origin!,
                    isCustomerPurchase,
                    purchaseTerm: formData.purchaseTerm,
                    items: sanitizedItems,
                    total: total,
                    additionalCost: formData.additionalCost || 0,
                    stockStatus: 'Pendente',
                    financialStatus: 'Pendente',
                    createdBy: user?.name || 'Keiler',
                    observations: formData.observations,
                };
                await addPurchaseOrder(purchaseData);
                showToast('Compra criada com sucesso!', 'success');
            }
            onClose(true);
        } catch (error) {
            showToast('Erro ao salvar a compra.', 'error');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const combinedSupplierOptions = useMemo(() => {
        const supplierOpts = suppliers.map(s => ({ value: s.id, label: s.name || 'Fornecedor Sem Nome' }));
        const linkedCustomerIds = new Set(suppliers.map(s => s.linkedCustomerId).filter(Boolean));
        const customerOpts = customers.filter(c => !linkedCustomerIds.has(c.id)).map(c => ({ value: c.id, label: c.name || 'Cliente Sem Nome' }));
        return [...supplierOpts, ...customerOpts].sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    }, [suppliers, customers]);

    const filteredCategories = useMemo(() => {
        if (!currentItem.productDetails?.brand) return [];
        return categories.filter(c => c.brandId === currentItem.productDetails?.brand);
    }, [categories, currentItem.productDetails?.brand]);

    const filteredModels = useMemo(() => {
        if (!currentItem.productDetails?.category) return [];
        return productModels
            .filter(m => m.categoryId === currentItem.productDetails?.category)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [productModels, currentItem.productDetails?.category]);

    const availableAppleModels = useMemo(() => {
        const category = currentItem.productDetails?.category;
        if (category && appleProductHierarchy[category as keyof typeof appleProductHierarchy]) {
            return Object.keys(appleProductHierarchy[category as keyof typeof appleProductHierarchy]);
        }
        return [];
    }, [currentItem.productDetails?.category]);

    const isMemoryless = useMemo(() => {
        const category = currentItem.productDetails?.category;
        return category === 'AirPods' || category === 'EarPods' || category === 'Watch' || category === 'Acessórios';
    }, [currentItem.productDetails?.category]);

    const availableAppleMemories = useMemo(() => {
        if (isMemoryless) return [];
        const category = currentItem.productDetails?.category as any;
        const model = currentItem.productDetails?.model as any;
        if (category && model && (appleProductHierarchy as any)[category]?.[model]) {
            return Object.keys((appleProductHierarchy as any)[category][model]);
        }
        return [];
    }, [currentItem.productDetails?.category, currentItem.productDetails?.model, isMemoryless]);

    const availableAppleColors = useMemo(() => {
        const category = currentItem.productDetails?.category as any;
        const model = currentItem.productDetails?.model as any;
        const storage = (isMemoryless ? 'Padrão' : currentItem.storage) as any;
        if (category && model && storage && (appleProductHierarchy as any)[category]?.[model]?.[storage]) {
            return (appleProductHierarchy as any)[category][model][storage] as readonly string[];
        }
        return [];
    }, [currentItem.productDetails?.category, currentItem.productDetails?.model, currentItem.storage, isMemoryless]);

    const availableGradeValues = useMemo(() => {
        if (!currentGradeId) return [];
        return gradeValues.filter(v => v.gradeId === currentGradeId);
    }, [gradeValues, currentGradeId]);

    const inputClasses = "w-full p-2.5 border rounded-xl bg-transparent border-border focus:ring-2 focus:ring-success/20 focus:border-success text-sm h-11 transition-all outline-none";
    const labelClasses = "block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5 ml-1";

    const renderStep1 = () => (
        <>
            <div className="flex justify-between items-center p-4 md:p-5 border-b border-gray-100 bg-white sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-gray-900 text-white rounded-2xl transform -rotate-3 shadow-lg">
                        <ArrowRightCircleIcon className="h-5 w-5 md:h-6 md:w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-primary tracking-tight leading-none">Lançamento de Compras</h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Registro de entrada de mercadoria</p>
                    </div>
                </div>
                <button type="button" onClick={() => handleCloseInternal(false)} className="p-2 md:p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all active:scale-95 group shadow-sm">
                    <XCircleIcon className="h-6 w-6 group-hover:scale-110 transition-transform" />
                </button>
            </div>
            <div className="p-3 md:p-5 space-y-4 md:space-y-5 flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                    <div>
                        <label className="text-xs font-bold text-muted block mb-1">Data da compra*</label>
                        <input
                            type="datetime-local"
                            name="purchaseDate"
                            value={formData.purchaseDate || ''}
                            onChange={handleFormChange}
                            className={`${inputClasses} w-full text-xs md:text-sm`}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-muted block mb-1">Origem*</label>
                        <select name="origin" value={formData.origin || ''} onChange={handleFormChange} className={`${inputClasses} w-full text-xs md:text-sm`}>
                            <option>Compra Nacional</option>
                            <option>Importação</option>
                        </select>
                    </div>

                    {formData.origin === 'Importação' && (
                        <div className="col-span-2 grid grid-cols-2 gap-2 bg-gray-50 border border-dashed border-gray-200 p-2 rounded-2xl animate-fade-in">
                            <div>
                                <label className="text-[10px] font-bold text-muted block mb-0.5">Dólar (R$)</label>
                                <CurrencyInput
                                    value={formData.dollarRate}
                                    onChange={(v) => setFormData(prev => ({ ...prev, dollarRate: v || 0 }))}
                                    className={`${inputClasses} w-full h-9 text-xs`}
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-muted block mb-0.5">Frete</label>
                                <div className="flex gap-1 h-9">
                                    <CurrencyInput
                                        value={formData.shippingCost}
                                        onChange={(v) => setFormData(prev => ({ ...prev, shippingCost: v || 0 }))}
                                        className={`${inputClasses} flex-1 h-full text-xs`}
                                        showPrefix={false}
                                    />
                                    <select
                                        name="shippingType"
                                        value={formData.shippingType || 'R$'}
                                        onChange={(e) => setFormData(prev => ({ ...prev, shippingType: e.target.value as any }))}
                                        className={`${inputClasses} w-12 px-1 h-full text-xs`}
                                    >
                                        <option value="R$">R$</option>
                                        <option value="US$">US$</option>
                                        <option value="%">%</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:items-end">
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1 ml-1 block">Fornecedor / Cliente*</label>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="flex items-center h-11 bg-gray-100/50 px-3 rounded-xl border border-gray-200 shadow-sm shrink-0">
                                <input type="checkbox" id="isCustomerPurchase" checked={isCustomerPurchase} onChange={e => setIsCustomerPurchase(e.target.checked)} className="h-4 w-4 text-accent rounded" />
                                <label htmlFor="isCustomerPurchase" className="ml-2 text-xs font-bold text-gray-600 cursor-pointer">De Cliente</label>
                            </div>
                            <div className="flex flex-1 gap-2">
                                <div className="flex-1 min-w-0">
                                    <SearchableDropdown options={combinedSupplierOptions} value={formData.supplierId || null} onChange={handleSupplierChange} placeholder="Buscar..." />
                                </div>
                                <button type="button" onClick={() => setIsSupplierModalOpen(true)} className="h-11 w-11 flex-shrink-0 bg-success text-white rounded-xl flex items-center justify-center hover:bg-success/90 transition-all active:scale-95 shadow-md shadow-success/10">
                                    <PlusIcon className="h-6 w-6" />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="w-full md:w-48">
                        <label className="text-sm font-bold text-muted block mb-1">Termo de Compra</label>
                        <div className="flex gap-2">
                            <select name="purchaseTerm" value={formData.purchaseTerm || ''} onChange={handleFormChange} className={inputClasses}>
                                <option value="">Selecione...</option>
                                {terms.map(t => (
                                    <option key={t.id} value={t.name}>{t.name}</option>
                                ))}
                            </select>
                            {isCustomerPurchase && formData.purchaseTerm && (
                                <button
                                    type="button"
                                    onClick={handlePrintTerm}
                                    title="Imprimir Termo"
                                    className="h-10 w-10 flex-shrink-0 bg-gray-100 text-gray-600 rounded-xl flex items-center justify-center hover:bg-gray-200 border border-gray-200"
                                >
                                    <PrinterIcon className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Corner Button - Moved even further inside */}
                <div className="flex justify-end pt-3 pb-5 px-8 md:px-6">
                    <button
                        type="button"
                        onClick={goToStep2}
                        className="w-full md:w-auto px-10 py-3 bg-gray-900 text-white rounded-2xl hover:bg-black font-black shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95 group"
                    >
                        <span className="text-base md:text-lg font-bold">Avançar para Itens</span>
                        <ArrowRightCircleIcon className="h-6 w-6 md:h-7 md:w-7 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </>
    );

    const renderStep2 = () => (
        <>
            <div className="flex justify-between items-center p-4 md:p-5 border-b border-gray-100 bg-white sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-gray-900 text-white rounded-2xl transform -rotate-3 shadow-lg">
                        <PlusIcon className="h-5 w-5 md:h-6 md:w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-primary tracking-tight leading-none">Itens da Compra</h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Lançamento detalhado de produtos</p>
                    </div>
                </div>
                <button type="button" onClick={() => handleCloseInternal(false)} className="p-2 md:p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all active:scale-95 group shadow-sm">
                    <XCircleIcon className="h-6 w-6 group-hover:scale-110 transition-transform" />
                </button>
            </div>
            <div className="p-3 md:p-5 space-y-4 md:space-y-5 flex-1 overflow-y-auto custom-scrollbar">
                <div className="bg-gray-50/50 p-4 md:p-5 rounded-3xl border border-gray-100 space-y-4 md:space-y-5">

                    <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                        <div className="flex items-center space-x-6">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="productType"
                                    value="Apple"
                                    checked={productType === 'Apple'}
                                    onChange={() => {
                                        setProductType('Apple');
                                        const reset = JSON.parse(JSON.stringify(emptyItem));
                                        setCurrentItem({ ...reset, hasImei: true });
                                    }}
                                    className="form-radio h-5 w-5 text-accent"
                                />
                                <span className="font-bold text-gray-700">Apple</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="productType"
                                    value="Produto"
                                    checked={productType === 'Produto'}
                                    onChange={() => {
                                        setProductType('Produto');
                                        const reset = JSON.parse(JSON.stringify(emptyItem));
                                        reset.productDetails.brand = '';
                                        setCurrentItem(reset);
                                    }}
                                    className="form-radio h-5 w-5 text-accent"
                                />
                                <span className="font-bold text-gray-700">Produto</span>
                            </label>
                        </div>
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs md:text-sm text-blue-600">
                            Para cadastrar Marcar, Categorias e Grades, <a href="/#/company?tab=marcas" target="_blank" rel="noopener noreferrer" className="font-bold underline">clique aqui</a>
                        </div>
                    </div>
                    <div className={`grid grid-cols-1 ${(productType === 'Apple' && currentItem.productDetails?.condition === 'Seminovo') ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4`}>
                        <div><label className={labelClasses}>Tempo de Garantia*</label><select value={currentItem.productDetails?.warranty} onChange={e => handleProductDetailChange('warranty', e.target.value)} className={inputClasses}>{warrantyOptions.length === 0 ? <option>Carregando...</option> : <>{currentItem.productDetails?.warranty && !warrantyOptions.some(w => w.name.toLowerCase() === currentItem.productDetails?.warranty?.toLowerCase()) && <option value={currentItem.productDetails?.warranty}>{currentItem.productDetails?.warranty}</option>}{warrantyOptions.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}</>}</select></div>
                        <div><label className={labelClasses}>Local do estoque</label><select value={currentItem.productDetails?.storageLocation} onChange={e => handleProductDetailChange('storageLocation', e.target.value)} className={inputClasses}>{locationOptions.length === 0 ? <option>Carregando...</option> : <>{currentItem.productDetails?.storageLocation && !locationOptions.some(l => l.name.toLowerCase() === currentItem.productDetails?.storageLocation?.toLowerCase()) && <option value={currentItem.productDetails?.storageLocation}>{currentItem.productDetails?.storageLocation}</option>}{locationOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</>}</select></div>
                        <div><label className={labelClasses}>Condição</label><select value={currentItem.productDetails?.condition} onChange={e => handleProductDetailChange('condition', e.target.value as ProductCondition)} className={inputClasses}>{conditionOptions.length === 0 ? <option>Carregando...</option> : <>{currentItem.productDetails?.condition && !conditionOptions.some(c => c.name.toLowerCase() === currentItem.productDetails?.condition?.toLowerCase()) && <option value={currentItem.productDetails?.condition}>{currentItem.productDetails?.condition}</option>}{conditionOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</>}</select></div>
                        {productType === 'Apple' && currentItem.productDetails?.condition === 'Seminovo' && (
                            <div>
                                <label className={labelClasses}>Saúde Bateria (%)</label>
                                <input
                                    type="number"
                                    value={currentItem.productDetails?.batteryHealth ?? 100}
                                    onChange={e => handleProductDetailChange('batteryHealth', e.target.value)}
                                    className={inputClasses}
                                    min="0" max="100"
                                />
                            </div>
                        )}
                    </div>

                    {productType === 'Apple' ? (
                        <div className="space-y-4">
                            <div className={`grid grid-cols-2 ${!isMemoryless ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
                                <div><label className={labelClasses}>Categoria*</label><select value={currentItem.productDetails?.category || ''} onChange={(e) => handleAppleFilterChange('category', e.target.value)} className={`${inputClasses} h-10`}><option value="">Selecione</option>{Object.keys(appleProductHierarchy).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                <div><label className={labelClasses}>Modelo*</label><select value={currentItem.productDetails?.model || ''} onChange={(e) => handleAppleFilterChange('model', e.target.value)} className={`${inputClasses} h-10`} disabled={!currentItem.productDetails?.category}><option value="">Selecione</option>{availableAppleModels.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                                {!isMemoryless && <div><label className={labelClasses}>Memória*</label><select value={currentItem.storage || ''} onChange={e => handleAppleFilterChange('storage', e.target.value)} className={`${inputClasses} h-10`} disabled={!currentItem.productDetails?.model}><option value="">Selecione</option>{availableAppleMemories.map(m => <option key={m} value={m}>{m}</option>)}</select></div>}
                                <div><label className={labelClasses}>Cor*</label><select value={currentItem.productDetails?.color || ''} onChange={(e) => handleAppleFilterChange('color', e.target.value)} className={`${inputClasses} h-10`} disabled={!currentItem.productDetails?.model || (!isMemoryless && !currentItem.storage)}><option value="">Selecione</option>{availableAppleColors.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            </div>
                            <div className="flex justify-start">
                                <button type="button" onClick={() => setShowVariations(s => !s)} className="text-sm font-semibold text-accent hover:underline flex items-center gap-1"><PlusIcon className="h-4 w-4" /> Adicionar Variação (Ex: Vitrine, Caixa Amassada)</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div><label className={labelClasses}>Marca*</label><select value={currentItem.productDetails?.brand || ''} onChange={e => { const val = e.target.value; setCurrentItem(prev => ({ ...prev, productDetails: { ...prev.productDetails!, brand: val, category: '', model: '' } })); }} className={`${inputClasses} h-10`}><option value="">Selecione</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                                <div><label className={labelClasses}>Categoria*</label><select value={currentItem.productDetails?.category || ''} onChange={e => { const val = e.target.value; setCurrentItem(prev => ({ ...prev, productDetails: { ...prev.productDetails!, category: val, model: '' } })); }} className={`${inputClasses} h-10`} disabled={!currentItem.productDetails?.brand}><option value="">Selecione</option>{filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                                <div><label className={labelClasses}>Modelo*</label><select value={currentItem.productDetails?.model || ''} onChange={e => handleProductDetailChange('model', e.target.value)} className={`${inputClasses} h-10`} disabled={!currentItem.productDetails?.category}><option value="">Selecione</option>{filteredModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                            </div>
                            <div className="flex justify-start">
                                <button type="button" onClick={() => setShowVariations(s => !s)} className="text-sm font-semibold text-accent hover:underline flex items-center gap-1"><PlusIcon className="h-4 w-4" /> Adicionar Variação (Cor, Armazenamento, etc)</button>
                            </div>
                        </div>
                    )}

                    {showVariations && (
                        <div className="col-span-full p-6 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-4">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">Grades / Variações Adicionais</label>
                            <div className="flex flex-wrap gap-2 my-2">
                                {currentItem.variations?.map((v, index) => (
                                    <div key={index} className="flex items-center gap-1 bg-gray-200 rounded-full px-2 py-1 text-sm">
                                        <span className="font-semibold">{v.gradeName}:</span>
                                        <span>{v.valueName}</span>
                                        <button type="button" onClick={() => handleRemoveVariation(index)}><XCircleIcon className="h-4 w-4 text-muted hover:text-danger" /></button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-end gap-3 p-4 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 block ml-1">Grade</label>
                                    <select value={currentGradeId} onChange={e => { setCurrentGradeId(e.target.value); setCurrentValueId(''); }} className={`${inputClasses}`}>
                                        <option value="">Selecione...</option>
                                        {grades.filter(g => productType === 'Apple' ? g.name.toLowerCase() !== 'cor' : true).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 block ml-1">Valor</label>
                                    <select value={currentValueId} onChange={e => setCurrentValueId(e.target.value)} className={`${inputClasses}`} disabled={!currentGradeId}>
                                        <option value="">Selecione...</option>
                                        {availableGradeValues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </select>
                                </div>
                                <button type="button" onClick={handleAddVariation} className="px-3 py-1 bg-accent text-white rounded-md h-9 flex items-center gap-1 text-sm"><PlusIcon className="h-4 w-4" /> Adicionar</button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                        <div>
                            <label className={labelClasses}>QUANTIDADE</label>
                            <input
                                type="number"
                                min="1"
                                value={currentItem.quantity}
                                onChange={(e) => handleCurrentItemChange('quantity', parseInt(e.target.value) || 1)}
                                onFocus={(e) => e.target.select()}
                                className={`${inputClasses} text-center font-bold`}
                            />
                        </div>
                        <div><label className={labelClasses}>Custo Unit.</label><CurrencyInput value={currentItem.unitCost} onChange={v => handleCurrentItemChange('unitCost', v || 0)} className={inputClasses} /></div>
                        <div><label className={labelClasses}>Adicional (Unit.)</label><CurrencyInput value={currentItem.additionalUnitCost} onChange={v => handleCurrentItemChange('additionalUnitCost', v || 0)} className={inputClasses} /></div>
                        <div>
                            <label className={labelClasses}>Final (Unit.)</label>
                            <div className={`${inputClasses} bg-gray-100 flex items-center text-xs md:text-sm`}>{formatCurrency(currentItem.finalUnitCost)}</div>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mt-2">
                        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto flex-1">
                            <div className="flex flex-col gap-3 justify-center min-w-[240px]">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={currentItem.hasImei}
                                        onChange={e => {
                                            const checked = e.target.checked;
                                            handleCurrentItemChange('hasImei', checked);
                                            if (!checked) setIsMinimumStockEnabled(true);
                                            else setIsMinimumStockEnabled(false);
                                        }}
                                        className="form-checkbox h-4 w-4 text-accent rounded"
                                    />
                                    <span className="text-sm font-semibold text-gray-600">Controlar por IMEI/Serial</span>
                                </label>

                                <div className={`flex items-center gap-3 transition-all duration-300 ${currentItem.hasImei ? 'opacity-40 pointer-events-none grayscale' : 'opacity-100'}`}>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={isMinimumStockEnabled}
                                            onChange={(e) => handleToggleMinimumStock(e.target.checked)}
                                            disabled={currentItem.hasImei}
                                            className="form-checkbox h-4 w-4 text-accent rounded"
                                        />
                                        <span className="text-sm font-semibold text-gray-600">Estoque mínimo</span>
                                    </label>

                                    <div className="flex items-center gap-2 ml-auto bg-gray-50 px-3 py-1 rounded-lg border border-gray-200">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Qtd:</span>
                                        <input
                                            type="number"
                                            min="1"
                                            value={currentItem.minimumStock ?? 1}
                                            onChange={(e) => handleCurrentItemChange('minimumStock', parseInt(e.target.value) || 1)}
                                            disabled={currentItem.hasImei || !isMinimumStockEnabled}
                                            className="w-12 bg-transparent text-center font-bold text-sm outline-none border-b-2 border-transparent focus:border-accent transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 min-w-[200px] flex items-end">
                                <div className="flex items-center gap-3 px-3 border rounded-xl bg-gray-100/50 border-gray-200 h-11 transition-all focus-within:ring-2 focus-within:ring-accent/20 focus-within:border-accent w-full shadow-inner">
                                    <BarcodeIcon className="h-4 w-4 text-muted shrink-0" />
                                    <input
                                        type="text"
                                        value={currentItem.barcode || ''}
                                        onChange={(e) => handleCurrentItemChange('barcode', e.target.value)}
                                        className="bg-transparent border-none text-sm outline-none w-full placeholder:text-gray-400 font-bold"
                                        placeholder="CÓDIGO DE BARRAS..."
                                    />
                                </div>
                            </div>
                        </div>

                        <button type="button" onClick={handleAddItem} className="w-full lg:w-auto px-8 py-3 bg-success text-white rounded-xl font-bold hover:bg-success/90 flex items-center justify-center gap-2 transition-all shadow-lg shadow-success/20 h-11">
                            <PlusIcon className="h-6 w-6" /> Adicionar Item
                        </button>
                    </div>
                </div>

                <div className="border border-border rounded-lg overflow-x-auto flex-1 min-h-[150px]">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100/50 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                            <tr>
                                <th className="p-4 text-left first:rounded-tl-2xl">Qtd</th>
                                <th className="p-4 text-left">Item / Descrição</th>
                                <th className="p-4 text-right">Custo Un.</th>
                                <th className="p-4 text-right">Custo Adic.</th>
                                <th className="p-4 text-right">Subtotal</th>
                                <th className="p-4 text-center last:rounded-tr-2xl">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {items.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-muted">Nenhum item adicionado.</td></tr>
                            ) : items.map((item, index) => (
                                <tr key={index}>
                                    <td className="p-4 text-left">{item.quantity}</td>
                                    <td className="p-4 text-left font-medium text-primary">
                                        {item.productDetails?.model}
                                        <div className="text-xs text-muted font-normal">
                                            {item.productDetails?.condition} - {item.productDetails?.warranty}
                                            {item.productDetails?.storageLocation && ` (${item.productDetails.storageLocation})`}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">{formatCurrency(item.unitCost)}</td>
                                    <td className="p-4 text-right">{formatCurrency(item.additionalUnitCost)}</td>
                                    <td className="p-4 text-right font-semibold">{formatCurrency((item.finalUnitCost || 0) * (item.quantity || 0))}</td>
                                    <td className="p-4 text-center">
                                        <button onClick={() => removeItem(index)} className="text-danger hover:bg-red-50 p-2 rounded-xl transition-colors"><TrashIcon className="h-5 w-5" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-gray-100 pt-3 mt-2">
                    <div className="w-full sm:w-1/3">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1 block">Observações</label>
                        <textarea name="observations" value={formData.observations || ''} onChange={handleFormChange} className={`${inputClasses} h-10 py-1.5`} placeholder="Notas..." />
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                        <div className="flex gap-4 text-xs"><span className="text-muted">Subtotal:</span><span className="font-bold text-gray-700">{formatCurrency(subTotal)}</span></div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted">Custo Adicional:</span>
                            {formData.origin === 'Importação' ? (
                                <span className="text-xs font-bold w-24 text-right">{formatCurrency(calculatedAdditionalCost)}</span>
                            ) : (
                                <CurrencyInput
                                    value={formData.additionalCost}
                                    onChange={v => setFormData(p => ({ ...p, additionalCost: v || 0 }))}
                                    className="w-24 p-1 border-b border-gray-200 text-right text-xs bg-transparent outline-none focus:border-accent"
                                />
                            )}
                        </div>
                        <div className="flex gap-4 text-base font-black text-primary border-t border-dashed border-gray-200 pt-1 mt-1"><span>Total:</span><span>{formatCurrency(total)}</span></div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center pt-3 pb-5 gap-4 px-8 md:px-6">
                <button type="button" onClick={() => setStep(1)} className="w-full md:w-auto px-8 py-3 bg-white border-2 border-gray-100 text-gray-500 rounded-2xl hover:bg-gray-50 font-bold transition-all order-2 md:order-1 active:scale-95 flex items-center justify-center gap-2">
                    <ChevronLeftIcon className="h-5 w-5" />
                    Voltar
                </button>
                <div className="flex gap-4 w-full md:w-auto order-1 md:order-2">
                    <button type="button" onClick={() => handleCloseInternal(false)} className="hidden md:block px-6 py-3 text-gray-400 font-bold hover:text-red-500 transition-colors">Cancelar</button>
                    <button type="submit" onClick={handleSubmit} disabled={isSaving} className="w-full md:w-auto px-12 py-3 bg-success text-white rounded-2xl hover:bg-success/90 font-black flex items-center justify-center gap-3 disabled:bg-muted transition-all shadow-xl shadow-success/20 active:scale-95">
                        {isSaving ? <SpinnerIcon className="h-6 w-6 animate-spin" /> : (
                            <>
                                Finalizar Compra
                                <CheckIcon className="h-6 w-6" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </>
    );

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 animate-fade-in font-sans" style={{ zIndex: 99999 }}>
            <form className="bg-surface w-full max-w-5xl h-auto max-h-[92vh] rounded-[2rem] md:rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col overflow-visible animate-scale-in">
                {step === 1 ? renderStep1() : renderStep2()}
            </form>
            {isSupplierModalOpen && <CustomerModal entity={null} initialType="Fornecedor" onClose={() => setIsSupplierModalOpen(false)} onSave={handleSaveNewSupplier as any} />}
        </div>,
        document.body
    );
};
