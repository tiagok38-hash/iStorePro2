
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Product, Supplier, Brand, Category, ProductModel, Grade, GradeValue, ProductVariation, Customer, ProductConditionParameter, StorageLocationParameter, WarrantyParameter } from '../types.ts';
import { getProductConditions, getStorageLocations, getWarranties } from '../services/mockApi.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import { XCircleIcon, SpinnerIcon, TrashIcon, PlusIcon, ArrowPathRoundedSquareIcon, ArchiveBoxIcon, PhotographIcon, CheckIcon } from './icons.tsx';
import CurrencyInput from './CurrencyInput.tsx';
import SearchableDropdown from './SearchableDropdown.tsx';
import CustomerModal from './CustomerModal.tsx';
import CameraModal from './CameraModal.tsx';
import ImageCropperModal from './ImageCropperModal.tsx';
import Button from './Button.tsx';
import { formatCurrency } from '../services/mockApi.ts';
import { compressImage } from '../utils/imageUtils.ts';
import { toDateValue } from '../utils/dateUtils.ts';
import CustomDatePicker from './CustomDatePicker.tsx';
import { CameraIcon } from './icons.tsx';
import { appleProductHierarchy } from '../services/constants.ts';

interface ProductModalProps {
    product: Partial<Product> | null;
    suppliers: Supplier[];
    brands: Brand[];
    categories: Category[];
    productModels: ProductModel[];
    grades: Grade[];
    gradeValues: GradeValue[];
    customers: Customer[];
    onClose: () => void;
    onSave: (productData: any) => void;
    onAddNewSupplier: (supplierData: Omit<Supplier, 'id'>) => Promise<Supplier | null>;
    isTradeInMode?: boolean;
    isOpen?: boolean;
}

const parseAppleModelString = (modelStr: string, variations: ProductVariation[] = []) => {
    let category = '';
    let model = '';
    let storageString: string | undefined = undefined;
    let color = '';

    for (const cat of Object.keys(appleProductHierarchy)) {
        const modelsInCat = Object.keys(appleProductHierarchy[cat as keyof typeof appleProductHierarchy]);
        if (modelsInCat.some(m => modelStr.includes(m))) {
            category = cat;
            break;
        }
    }
    if (!category) return { category, model, storageString, color };

    let remainingStr = modelStr;
    const models = appleProductHierarchy[category as keyof typeof appleProductHierarchy];
    const sortedModels = Object.keys(models).sort((a, b) => b.length - a.length);
    for (const m of sortedModels) {
        const modelIndex = remainingStr.indexOf(m);
        if (modelIndex > -1) {
            model = m;
            remainingStr = remainingStr.substring(modelIndex + m.length).trim();
            break;
        }
    }
    if (!model) return { category, model, storageString, color };

    const storages = models[model as keyof typeof models];
    const sortedStorages = Object.keys(storages).sort((a, b) => b.length - a.length);
    for (const s of sortedStorages) {
        if (remainingStr.startsWith(s)) {
            storageString = s;
            remainingStr = remainingStr.substring(s.length).trim();
            break;
        }
    }

    // Try to match against known colors first to avoid capturing extra variation text (e.g. "Sim")
    let knownColors: readonly string[] = [];
    // Cast to any to assume structural access is safe given we validated model
    const storageKey = storageString || 'Padrão';
    const sMap = storages as any;
    if (sMap[storageKey]) {
        knownColors = sMap[storageKey];
    } else if (sMap['Padrão']) {
        knownColors = sMap['Padrão'];
    }

    const sortedColors = [...knownColors].sort((a, b) => b.length - a.length);
    let matchedColor = '';
    for (const c of sortedColors) {
        // Case insensitive match for safety, OR exact start match
        // Typically database formatting matches hierarchy formatting
        if (remainingStr.startsWith(c) || remainingStr.toLowerCase().startsWith(c.toLowerCase())) {
            matchedColor = c;
            break;
        }
    }

    if (matchedColor) {
        color = matchedColor;
    } else {
        const variationText = variations?.map(v => v.valueName).join(' ') || '';
        if (variationText && remainingStr.endsWith(variationText)) {
            color = remainingStr.substring(0, remainingStr.length - variationText.length).trim();
        } else {
            color = remainingStr;
        }
    }

    return { category, model, storageString, color };
};


const accessoryItems = [
    'Caixa Original', 'Carregador', 'Cabo USB', 'Fone de Ouvido', 'Nota Fiscal', 'Capa', 'Película', 'Manual'
];

const checklistItems = [
    'Alto Falante (Auricular)', 'Alto Falante (Viva Voz)', 'Aparelho não pode ser ligado', 'Bateria',
    'Biometria / Touch ID', 'Botão Power (Liga/Desliga)', 'Botão Volume (Aumentar/Diminuir)',
    'Câmera Frontal', 'Câmera Traseira', 'Carcaça / Gabinete', 'Chave Seletora (Silenciar)',
    'Conector de Carga', 'Display / Tela / Touch', 'Face ID', 'Microfone', 'Parafusos',
    'Sensor de Proximidade', 'Sinal de Rede (Operadora)', 'Wi-Fi / Bluetooth', 'Tampa Traseira'
];

const ProductModal: React.FC<ProductModalProps> = ({
    product, suppliers = [], brands = [], categories = [], productModels = [], grades = [], gradeValues = [], customers = [], onClose, onSave, onAddNewSupplier, isTradeInMode = false, isOpen = true
}) => {
    const initializedIdRef = useRef<string | null>(null);
    const [productType, setProductType] = useState<'Apple' | 'Produto'>('Apple');
    const [formData, setFormData] = useState<Partial<Product>>({});
    const [appleStorage, setAppleStorage] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [savingSupplier, setSavingSupplier] = useState(false);
    const [isMinimumStockEnabled, setIsMinimumStockEnabled] = useState(false);
    const [showVariations, setShowVariations] = useState(false);
    const [currentGradeId, setCurrentGradeId] = useState('');
    const [currentValueId, setCurrentValueId] = useState('');
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const { showToast } = useToast();
    const { user } = useUser();

    // New States for Trade-In Tab
    const [activeTab, setActiveTab] = useState<'details' | 'extras' | 'checklist'>('details');
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isPhotoMenuOpen, setIsPhotoMenuOpen] = useState(false);
    const [isCropperOpen, setIsCropperOpen] = useState(false);
    const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);
    const [showErrors, setShowErrors] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddPhoto = (imageData: string) => {
        if ((formData.photos?.length || 0) >= 6) {
            showToast('Limite de 6 fotos atingido.', 'error');
            return;
        }
        setTempImageForCrop(imageData);
        setIsCropperOpen(true);
        setIsCameraOpen(false);
    };

    const handleCropSave = (croppedBase64: string) => {
        setFormData(prev => ({
            ...prev,
            photos: [...(prev.photos || []), croppedBase64]
        }));
        setIsCropperOpen(false);
        setTempImageForCrop(null);
    };

    const handleRemovePhoto = (index: number) => {
        setFormData(prev => ({
            ...prev,
            photos: (prev.photos || []).filter((_, i) => i !== index)
        }));
    };

    const handleAccessoryToggle = (item: string) => {
        setFormData(prev => {
            const current = prev.accessories || [];
            if (current.includes(item)) {
                return { ...prev, accessories: current.filter(i => i !== item) };
            } else {
                return { ...prev, accessories: [...current, item] };
            }
        });
    };

    const handleChecklistToggle = (item: string) => {
        setFormData(prev => {
            const currentChecklist = prev.checklist || {};
            return {
                ...prev,
                checklist: {
                    ...currentChecklist,
                    [item]: !currentChecklist[item]
                }
            };
        });
    };

    const handleChecklistChange = (field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            checklist: {
                ...(prev.checklist || {}),
                [field]: value
            }
        }));
    };

    // Updates both checklist repairCost and product additionalCostPrice
    const handleRepairCostChange = (value: number) => {
        setFormData(prev => ({
            ...prev,
            additionalCostPrice: value,
            checklist: {
                ...(prev.checklist || {}),
                repairCost: value
            }
        }));
    };

    // Dynamic parameters from Empresa > Parâmetros
    const [conditionOptions, setConditionOptions] = useState<ProductConditionParameter[]>([]);
    const [locationOptions, setLocationOptions] = useState<StorageLocationParameter[]>([]);
    const [warrantyOptions, setWarrantyOptions] = useState<WarrantyParameter[]>([]);

    // Animation visibility state
    const [visible, setVisible] = useState(isOpen);
    useEffect(() => {
        if (isOpen) {
            setVisible(true);
        } else {
            const timer = setTimeout(() => setVisible(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // NOTE: Removed early return here - it was causing React hooks order violation
    // The visibility check is now done in the render return statement
    useEffect(() => {
        const fetchParameters = async () => {
            try {
                const [conditions, locations, warranties] = await Promise.all([
                    getProductConditions(),
                    getStorageLocations(),
                    getWarranties()
                ]);
                setConditionOptions(conditions);
                setLocationOptions(locations);
                setWarrantyOptions(warranties);
            } catch (error: any) {
                const isAbort = error?.name === 'AbortError' || error?.message?.includes('aborted');
                if (isAbort) return;

                console.error('Error fetching product parameters:', error);
                showToast('Erro ao carregar parâmetros do produto.', 'error');
            }
        };
        fetchParameters();
    }, []);

    useEffect(() => {
        const currentId = product ? product.id : 'new';
        if (initializedIdRef.current === currentId) return;
        initializedIdRef.current = currentId;

        if (product) {
            const initialData: Partial<Product> = {
                stock: isTradeInMode ? 1 : (product.stock || 1),
                batteryHealth: product.batteryHealth ?? 100,
                condition: isTradeInMode ? 'Seminovo' : (product.condition || 'Novo'),
                ...product,
                photos: product.photos || []
            };

            // Preserve these fields from product BEFORE any parsing logic
            const preservedWarranty = (product.warranty || (product as any).warranty_period || (product as any).garantia || '').trim();
            const preservedStorageLocation = (product.storageLocation || (product as any).storage_location || '').trim();
            const preservedColor = product.color;

            if (product.brand === 'Apple' || isTradeInMode) {
                setProductType('Apple');
                if (product.brand === 'Apple') {
                    const { category, model, storageString, color: parsedColor } = parseAppleModelString(product.model || '', product.variations || []);
                    initialData.category = category;
                    initialData.model = model;
                    setAppleStorage(storageString || '');
                    if (storageString) {
                        const numericStorage = parseInt(storageString, 10);
                        initialData.storage = isNaN(numericStorage) ? undefined : numericStorage;
                    } else {
                        initialData.storage = undefined;
                    }
                    // Use preserved color if available, otherwise use parsed color
                    initialData.color = preservedColor || parsedColor;
                }
            } else {
                setProductType('Produto');
                // Safeguard against undefined arrays
                const brandName = product.brand || '';
                const brandObj = (brands || []).find(b =>
                    b.name.toLowerCase() === brandName.toLowerCase() ||
                    b.id === brandName
                );


                if (brandObj) {
                    initialData.brand = brandObj.id;

                    // Try to find category
                    const categoryName = (product.category || '').toLowerCase();
                    const categoryObj = (categories || []).find(c =>
                        c.brandId === brandObj.id && (
                            c.name.toLowerCase() === categoryName ||
                            c.id === product.category
                        )
                    );


                    if (categoryObj) {
                        initialData.category = categoryObj.id;
                        const modelsForCategory = (productModels || []).filter(m => m.categoryId === categoryObj.id);

                        // CLEAN PRODUCT MODEL: If name was saved as "Category Brand Model", try to extract pure model
                        let searchModel = (product.model || '').toLowerCase();
                        const bName = brandObj.name.toLowerCase();
                        const cName = categoryObj.name.toLowerCase();

                        // Remove prefixes in any order (Category Brand or Brand Category)
                        let cleanModel = searchModel
                            .replace(cName, '')
                            .replace(bName, '')
                            .trim();


                        // Try multiple strategies to find the model
                        let modelObj = modelsForCategory.find(m =>
                            m.name.toLowerCase() === cleanModel ||
                            m.id === product.model
                        );

                        if (!modelObj) {
                            // Try exact match on original name just in case
                            modelObj = modelsForCategory.find(m => m.name.toLowerCase() === searchModel);
                        }

                        if (!modelObj && cleanModel) {
                            // Try if clean model contains model name or vice versa
                            modelObj = modelsForCategory.find(m =>
                                cleanModel.includes(m.name.toLowerCase()) ||
                                m.name.toLowerCase().includes(cleanModel)
                            );
                        }

                        if (modelObj) {
                            initialData.model = modelObj.id;
                        } else {
                            initialData.model = '';
                        }
                    } else {
                        initialData.category = '';
                        initialData.model = '';
                    }
                } else {
                    initialData.brand = '';
                    initialData.category = '';
                    initialData.model = '';
                }
            }

            // Explicitly ensure important fields are set in formData from the incoming product
            initialData.supplierId = product.supplierId;
            initialData.warranty = preservedWarranty || (product.brand === 'Apple' ? '1 ano' : '');
            initialData.storageLocation = preservedStorageLocation || 'Loja Santa Cruz';

            setFormData(initialData);
            setIsMinimumStockEnabled(!!(initialData.minimumStock && initialData.minimumStock > 0));
            setShowVariations(!!(product.variations && product.variations.length > 0));

        } else {
            const defaults = {
                stock: 1, batteryHealth: 100, condition: isTradeInMode ? 'Seminovo' : 'Novo', warranty: isTradeInMode ? '' : '1 ano', storageLocation: isTradeInMode ? '' : 'Loja Santa Cruz', variations: [], barcodes: [], createdBy: user?.name || 'Keiler', origin: 'Compra'
            };
            setFormData(defaults);
            setProductType('Apple'); // Default for new - Always Apple for trade-in mode
            setIsMinimumStockEnabled(false);
            setShowVariations(false);
            setAppleStorage('');
        }
    }, [product, brands, categories, productModels, isTradeInMode, suppliers, user]);

    // Normalize data casing when options become available to avoid duplicates (e.g. "1 ano" vs "1 Ano")
    useEffect(() => {
        if (!formData.condition && !formData.warranty && !formData.storageLocation) return;

        setFormData(prev => {
            let next = { ...prev };
            let changed = false;

            if (prev.condition) {
                const match = conditionOptions.find(o => o.name.toLowerCase() === prev.condition?.toLowerCase());
                if (match && match.name !== prev.condition) {
                    next.condition = match.name;
                    changed = true;
                }
            }
            if (prev.warranty) {
                const match = warrantyOptions.find(o => o.name.toLowerCase() === prev.warranty?.toLowerCase());
                if (match && match.name !== prev.warranty) {
                    next.warranty = match.name;
                    changed = true;
                }
            }
            if (prev.storageLocation) {
                const match = locationOptions.find(o => o.name.toLowerCase() === prev.storageLocation?.toLowerCase());
                if (match && match.name !== prev.storageLocation) {
                    next.storageLocation = match.name;
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [conditionOptions, warrantyOptions, locationOptions, product?.id]); // Also run when product changes to ensure normalization for each item

    // Separate effect for product change to avoid "size changed" error during hot reload
    useEffect(() => {
        if (!product?.id) return;
        // The effect above will trigger because of state changes in formData or options
    }, [product?.id]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const newFormData = { ...formData, [name]: value };

        if (productType === 'Apple') {
            if (name === 'category') {
                newFormData.model = '';
                newFormData.storage = undefined;
                setAppleStorage('');
                newFormData.color = '';
            } else if (name === 'model') {
                newFormData.storage = undefined;
                setAppleStorage('');
                newFormData.color = '';
            }
        } else {
            if (name === 'brand') {
                newFormData.category = '';
                newFormData.model = '';
            } else if (name === 'category') {
                newFormData.model = '';
            }
        }

        if (name === 'imei1' || name === 'imei2') {
            const numericValue = value.replace(/\D/g, '').substring(0, 15);
            newFormData[name] = numericValue;
        }

        setFormData(newFormData);
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value === '' ? undefined : parseInt(value, 10) }));
    };

    const handleAppleStorageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const storageStr = e.target.value;
        setAppleStorage(storageStr);
        const numericStorage = parseInt(storageStr, 10);
        setFormData(prev => ({
            ...prev,
            storage: isNaN(numericStorage) ? undefined : numericStorage,
            color: ''
        }));
    };

    const handlePriceChange = (name: 'price' | 'costPrice' | 'additionalCostPrice') => (value: number | null) => {
        const newFormData = { ...formData, [name]: value || 0 };
        updateMarkupAndPrice(newFormData, name === 'price' ? 'price' : 'cost');
    };

    const updateMarkupAndPrice = (data: Partial<Product>, updatedField: 'markup' | 'price' | 'cost' = 'price') => {
        const cost = (data.costPrice || 0) + (data.additionalCostPrice || 0);
        if (cost > 0) {
            if (updatedField === 'markup' && typeof data.markup === 'number') {
                data.price = cost * (1 + data.markup / 100);
            } else if ((updatedField === 'price' || updatedField === 'cost') && typeof data.price === 'number') {
                const newMarkup = ((data.price / cost) - 1) * 100;
                data.markup = isFinite(newMarkup) ? parseFloat(newMarkup.toFixed(2)) : 0;
            }
        }
        setFormData(data);
    };

    const handleMarkupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const markup = e.target.value === '' ? undefined : parseFloat(e.target.value);
        const newFormData = { ...formData, markup };
        updateMarkupAndPrice(newFormData, 'markup');
    };

    const handleToggleMinimumStock = (checked: boolean) => {
        setIsMinimumStockEnabled(checked);
        if (!checked) {
            setFormData(prev => {
                const { minimumStock, ...rest } = prev;
                return rest;
            });
        } else {
            if (!formData.minimumStock || formData.minimumStock <= 0) {
                setFormData(prev => ({ ...prev, minimumStock: 1 }));
            }
        }
    };

    const handleAddVariation = () => {
        if (!currentGradeId) {
            showToast('Selecione uma grade.', 'warning');
            return;
        }
        const grade = grades.find(g => g.id === currentGradeId);
        // Allow adding variation without a value (valueId can be empty)
        const value = currentValueId ? gradeValues.find(v => v.id === currentValueId) : null;

        if (!grade) return;

        const newVariation: ProductVariation = {
            gradeId: currentGradeId,
            gradeName: grade.name,
            valueId: currentValueId || '',
            valueName: value ? value.name : ''
        };
        const existingVariations = formData.variations || [];

        const existingIndex = existingVariations.findIndex(v => v.gradeId === newVariation.gradeId);
        let newVariations = [];
        if (existingIndex > -1) {
            newVariations = [...existingVariations];
            newVariations[existingIndex] = newVariation;
        } else {
            newVariations = [...existingVariations, newVariation];
        }

        setFormData(prev => ({ ...prev, variations: newVariations }));
        setCurrentGradeId('');
        setCurrentValueId('');
    };

    const handleRemoveVariation = (index: number) => {
        setFormData(prev => ({ ...prev, variations: prev.variations?.filter((_, i) => i !== index) }));
    };

    const handleSaveNewSupplier = async (entityData: any, entityType: string, personType: string) => {
        setSavingSupplier(true);
        try {
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
                setFormData(prev => ({ ...prev, supplierId: newSupplier.id }));
                setIsSupplierModalOpen(false);
            }
        } finally {
            setSavingSupplier(false);
        }
    };

    const supplierOptions = useMemo(() => suppliers.map(s => ({ value: s.id, label: s.name })), [suppliers]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isTradeInMode) {
            if (activeTab !== 'details') {
                const hasErrors = !formData.costPrice || formData.costPrice <= 0 || !formData.warranty || !formData.price || formData.price <= 0 || !formData.storageLocation;
                if (hasErrors) {
                    setShowErrors(true);
                    showToast('Por favor, preencha os campos obrigatórios na aba Detalhes.', 'warning');
                }
                setActiveTab('details');
                return;
            }

            if (!formData.costPrice || formData.costPrice <= 0) {
                setShowErrors(true);
                showToast('O "Preço de Custo" (valor da troca) é obrigatório e deve ser maior que zero.', 'error');
                return;
            }
            if (!formData.price || formData.price <= 0) {
                setShowErrors(true);
                showToast('O "Preço de Venda" é obrigatório e deve ser maior que zero.', 'error');
                return;
            }
            if (!formData.warranty) {
                setShowErrors(true);
                showToast('Selecione o Tempo de Garantia.', 'error');
                return;
            }
            if (!formData.storageLocation) {
                setShowErrors(true);
                showToast('Selecione o Local de Estoque.', 'error');
                return;
            }
        }

        const isValidImei = (val: string) => /^\d{15}$/.test(val || '');

        // IMEI validation (only if filled)
        if (formData.imei1 && !isValidImei(formData.imei1)) {
            showToast('O IMEI 1 deve ter exatamente 15 números.', 'error');
            return;
        }
        if (formData.imei2 && !isValidImei(formData.imei2)) {
            showToast('O IMEI 2 deve ter exatamente 15 números.', 'error');
            return;
        }

        let finalModel = '';
        let finalBrand = '';
        let finalCategory = '';
        // REMOVED: variations are now displayed separately in the UI to keep the product name clean.

        if (productType === 'Apple') {
            if (!formData.category || !formData.model) {
                showToast('Para produtos Apple, preencha Categoria e Modelo.', 'error');
                return;
            }
            finalBrand = 'Apple';
            finalCategory = formData.category;
            const storageText = isMemoryless ? '' : appleStorage;
            if (!isMemoryless && !storageText) {
                showToast('Para produtos Apple, a memória (ou "Padrão") é obrigatória.', 'error');
                return;
            }
            // Logic: model + storage + color. (Variations NOT included in name)
            finalModel = `${formData.model} ${storageText} ${formData.color || ''}`.trim().replace(/\s+/g, ' ');
        } else {
            if (!formData.brand || !formData.category || !formData.model) {
                showToast('Preencha os campos Marca, Categoria e Modelo.', 'error');
                return;
            }
            const brandObj = brands.find(b => b.id === formData.brand);
            const categoryObj = categories.find(c => c.id === formData.category);
            const modelObj = productModels.find(m => m.id === formData.model);

            finalBrand = brandObj?.name || formData.brand;
            finalCategory = categoryObj?.name || formData.category;
            const baseModelName = modelObj?.name || formData.model || '';
            // Logic: (Category + Brand +) Model. (Variations NOT included in name)
            finalModel = `${modelObj ? `${finalCategory} ${finalBrand} ` : ''}${baseModelName}`.trim().replace(/\s+/g, ' ');
        }

        setIsSaving(true);
        try {
            // Call onSave - wrap in a race to prevent infinite loading if parent hangs
            const savePromise = (async () => {
                const result = onSave({
                    ...formData,
                    brand: finalBrand,
                    category: finalCategory,
                    model: finalModel,
                    stock: formData.stock || 1,
                } as Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'sku'>);

                if (result && typeof result.then === 'function') {
                    await result;
                }
            })();

            await Promise.race([
                savePromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_SAVE')), 20000))
            ]);

        } catch (error: any) {
            if (error.message === 'TIMEOUT_SAVE') {
                showToast('A gravação demorou muito. Verifique sua conexão ou se os dados foram salvos.', 'warning');
            } else {
                console.error('[ProductModal] Error in onSave:', error);
                showToast('Erro ao salvar o produto.', 'error');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const availableAppleModels = useMemo(() => {
        const category = formData.category;
        if (category && appleProductHierarchy[category as keyof typeof appleProductHierarchy]) {
            return Object.keys(appleProductHierarchy[category as keyof typeof appleProductHierarchy]);
        }
        return [];
    }, [formData.category]);

    type Hierarchy = typeof appleProductHierarchy; type CategoryKey = keyof Hierarchy; type ModelKey<C extends CategoryKey> = keyof Hierarchy[C];

    const isMemoryless = useMemo(() => {
        const category = formData.category as CategoryKey;
        return category === 'AirPods' || category === 'EarPods' || category === 'Watch' || category === 'Acessórios';
    }, [formData.category]);

    const availableAppleMemories = useMemo(() => {
        if (isMemoryless) return [];
        const category = formData.category as CategoryKey;
        const model = formData.model as ModelKey<CategoryKey>;
        if (category && model && appleProductHierarchy[category]?.[model]) {
            return Object.keys(appleProductHierarchy[category][model]);
        }
        return [];
    }, [formData.category, formData.model, isMemoryless]);

    const availableAppleColors = useMemo(() => {
        const category = formData.category as CategoryKey;
        const model = formData.model as ModelKey<CategoryKey>;
        const storageKey = isMemoryless ? 'Padrão' : appleStorage;

        if (category && model && storageKey && appleProductHierarchy[category]?.[model]?.[storageKey as any]) {
            return appleProductHierarchy[category][model][storageKey as any] as readonly string[];
        }
        return [];
    }, [formData.category, formData.model, appleStorage, isMemoryless]);


    const filteredCategories = useMemo(() => {
        if (!formData.brand) return [];
        return categories.filter(c => c.brandId === formData.brand);
    }, [categories, formData.brand]);

    const filteredModels = useMemo(() => {
        if (!formData.category) return [];
        return productModels.filter(m => m.categoryId === formData.category);
    }, [productModels, formData.category]);

    const availableGradeValues = useMemo(() => {
        if (!currentGradeId) return [];
        return gradeValues.filter(v => v.gradeId === currentGradeId);
    }, [gradeValues, currentGradeId]);

    const totalCost = useMemo(() => (formData.costPrice || 0) + (formData.additionalCostPrice || 0), [formData.costPrice, formData.additionalCostPrice]);

    const labelClasses = "block text-xs font-medium text-muted mb-1";
    const inputClasses = "w-full px-3 border rounded-xl bg-transparent border-border focus:ring-success focus:border-success text-sm h-11 transition-all outline-none";

    if (!visible && !isOpen) return null;

    const modalContent = (
        <div
            className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center font-sans md:p-4 ${isOpen ? 'animate-fade-in' : 'animate-fade-out'}`}
            style={{ zIndex: 99999 }}
        >
            <form onSubmit={handleSubmit} className="bg-white w-full max-w-4xl h-[100dvh] md:h-[90vh] max-h-[100dvh] flex flex-col md:rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
                {/* Header Premium */}
                <div className="flex justify-between items-center p-4 md:p-6 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10 flex-none gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className={`p-2 md:p-3 rounded-xl md:rounded-2xl ${isTradeInMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-primary/10 text-primary'} transform -rotate-2`}>
                            {isTradeInMode ? <ArrowPathRoundedSquareIcon className="h-5 w-5 md:h-6 md:w-6" /> : <ArchiveBoxIcon className="h-5 w-5 md:h-6 md:w-6" />}
                        </div>
                        <div>
                            <h2 className="text-lg md:text-2xl font-black text-gray-800 tracking-tight leading-tight">
                                {isTradeInMode ? 'Aparelho para troca' : (product?.id ? 'Editar Produto' : 'Lançar Produto')}
                            </h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                {isTradeInMode ? 'Entrada de usado' : 'Cadastro de item'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {!isTradeInMode && (
                            <a
                                href="/#/company?tab=marcas"
                                target="_blank"
                                className="hidden md:inline-block text-sm font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 hover:bg-blue-100 transition-all whitespace-nowrap"
                            >
                                Para cadastrar marcas/categorias/grades, <span className="underline">clique aqui</span>.
                            </a>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 md:p-3 bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl md:rounded-2xl transition-all shadow-sm group"
                        >
                            <XCircleIcon className="h-6 w-6 group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 p-4 md:p-8 pt-6 space-y-6 overflow-y-auto custom-scrollbar pb-32 md:pb-24">

                    {/* Tabs for Trade-In and Edit Mode */}
                    {(isTradeInMode || product?.id) && (
                        <div className="flex gap-2 md:gap-4 border-b border-gray-100 pb-4 mb-4 overflow-x-auto no-scrollbar">
                            <button
                                type="button"
                                onClick={() => setActiveTab('details')}
                                className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'details' ? 'bg-gray-900 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                            >
                                Detalhes
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('extras')}
                                className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'extras' ? 'bg-gray-900 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                            >
                                Fotos {formData.photos?.length ? `(${formData.photos.length})` : ''}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('checklist')}
                                className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'checklist' ? 'bg-gray-900 text-white shadow-lg' : 'bg-red-50 text-red-400 hover:bg-red-100'}`}
                            >
                                Checklist
                            </button>
                        </div>
                    )}


                    {activeTab === 'checklist' && (
                        <div className="space-y-8 animate-fade-in">
                            {/* Seção de Checklist */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <PlusIcon className="h-6 w-6 text-gray-800" />
                                    <h3 className="text-xl font-bold text-gray-800">Checklist de produtos Seminovos</h3>
                                </div>
                                <div className="flex items-center gap-2 text-orange-500 bg-orange-50 p-3 rounded-xl border border-orange-100 mb-6">
                                    <span className="font-bold text-sm">⚠️ Marque as opções que apresentam defeito ou avaria.</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0 max-h-[240px] overflow-y-auto custom-scrollbar pr-2 border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                                    {checklistItems.map(item => (
                                        <label key={item} className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-100 rounded-xl transition-colors group border border-transparent hover:border-gray-200">
                                            <div className={`w-10 h-5 rounded-full p-0.5 transition-colors relative shrink-0 ${formData.checklist?.[item] ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'bg-gray-300'}`}>
                                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${formData.checklist?.[item] ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={!!formData.checklist?.[item]}
                                                onChange={() => handleChecklistToggle(item)}
                                                className="hidden"
                                            />
                                            <span className={`text-xs font-bold truncate ${formData.checklist?.[item] ? 'text-blue-600' : 'text-gray-600'}`} title={item}>{item}</span>
                                        </label>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="space-y-2">
                                        <CustomDatePicker
                                            label="Data do Checklist"
                                            value={(formData.checklist?.checklistDate as string) || ''}
                                            onChange={val => handleChecklistChange('checklistDate', val)}
                                            max={toDateValue()}
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700">Custo de Reparo:</label>
                                        <CurrencyInput
                                            value={formData.additionalCostPrice}
                                            onChange={handleRepairCostChange}
                                            className="w-full p-3 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                                            placeholder="R$ 0,00"
                                        />
                                        <p className="text-[10px] text-gray-500 leading-tight">Valor a ser abatido/somado ao custo.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700">Anotações / Defeitos:</label>
                                        <p className="text-[10px] text-gray-500 mb-1">Detalhes dos defeitos encontrados.</p>
                                        <textarea
                                            value={(formData.checklist?.notes as string) || ''}
                                            onChange={e => handleChecklistChange('notes', e.target.value)}
                                            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none min-h-[80px] resize-none"
                                            placeholder="Descreva detalhes aqui..."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700">Serviços / Consertos:</label>
                                        <p className="text-[10px] text-gray-500 mb-1">Serviços que serão executados.</p>
                                        <textarea
                                            value={(formData.checklist?.services as string) || ''}
                                            onChange={e => handleChecklistChange('services', e.target.value)}
                                            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none min-h-[80px] resize-none"
                                            placeholder="Liste os reparos necessários..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}



                    {activeTab === 'details' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Seção Principal: Tipo e Identificação */}
                            <div className="space-y-5">
                                <div className="flex flex-wrap items-center gap-4">
                                    {!product?.id && (
                                        <div className="flex justify-start items-center p-1 bg-gray-100 rounded-xl border border-gray-200 w-fit">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setProductType('Apple');
                                                    setFormData(prev => ({ ...prev, category: '', model: '', brand: 'Apple' }));
                                                }}
                                                className={`px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${productType === 'Apple' ? 'bg-white shadow-md text-primary' : 'text-gray-400'}`}
                                            >
                                                Apple
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setProductType('Produto');
                                                    setFormData(prev => ({ ...prev, category: '', model: '', brand: '' }));
                                                }}
                                                className={`px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${productType === 'Produto' ? 'bg-white shadow-md text-primary' : 'text-gray-400'}`}
                                            >
                                                Produto
                                            </button>
                                        </div>
                                    )}
                                    {isTradeInMode && (
                                        <div className="flex-1 min-w-[300px] p-3 bg-blue-50 border border-blue-200 rounded-3xl flex items-center justify-center">
                                            <span className="text-[10px] md:text-sm text-primary text-center">
                                                Para cadastrar Marcas, Categorias e Grades, <a href="/#/company?tab=marcas" target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-blue-700">clique aqui</a>
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {productType === 'Apple' ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="space-y-2">
                                            <label className={labelClasses}>Categoria*</label>
                                            <select name="category" value={formData.category || ''} onChange={handleInputChange} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 h-[48px] focus:ring-4 focus:ring-primary/5 outline-none transition-all shadow-sm" required>
                                                <option value="">Selecione</option>
                                                {Object.keys(appleProductHierarchy).map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className={labelClasses}>Modelo*</label>
                                            <select name="model" value={formData.model || ''} onChange={handleInputChange} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 h-[48px] focus:ring-4 focus:ring-primary/5 outline-none transition-all shadow-sm" disabled={!formData.category} required>
                                                <option value="">Selecione</option>
                                                {availableAppleModels.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                        {!isMemoryless && (
                                            <div className="space-y-2">
                                                <label className={labelClasses}>Memória*</label>
                                                <select value={appleStorage} onChange={handleAppleStorageChange} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 h-[48px] focus:ring-4 focus:ring-primary/5 outline-none transition-all shadow-sm" disabled={!formData.model} required>
                                                    <option value="">Selecione</option>
                                                    {availableAppleMemories.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <label className={labelClasses}>Cor*</label>
                                            <select name="color" value={formData.color || ''} onChange={handleInputChange} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 h-[48px] focus:ring-4 focus:ring-primary/5 outline-none transition-all shadow-sm" disabled={!formData.model || (!isMemoryless && !appleStorage)} required>
                                                <option value="">Selecione</option>
                                                {availableAppleColors.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <label className={labelClasses}>Marca*</label>
                                            <select name="brand" value={formData.brand || ''} onChange={handleInputChange} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 h-[48px] focus:ring-4 focus:ring-primary/5 outline-none transition-all shadow-sm" required>
                                                <option value="">Selecione</option>
                                                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className={labelClasses}>Categoria*</label>
                                            <select name="category" value={formData.category || ''} onChange={handleInputChange} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 h-[48px] focus:ring-4 focus:ring-primary/5 outline-none transition-all shadow-sm" disabled={!formData.brand} required>
                                                <option value="">Selecione</option>
                                                {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className={labelClasses}>Modelo*</label>
                                            <select name="model" value={formData.model || ''} onChange={handleInputChange} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 h-[48px] focus:ring-4 focus:ring-primary/5 outline-none transition-all shadow-sm" disabled={!formData.category} required>
                                                <option value="">Selecione</option>
                                                {filteredModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                <button type="button" onClick={() => setShowVariations(!showVariations)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${showVariations ? 'bg-primary text-white' : 'bg-primary/5 text-primary hover:bg-primary/10'}`}>
                                    <PlusIcon className="h-4 w-4" /> {showVariations ? 'Ocultar Variações' : 'Adicionar Grade e Variação'}
                                </button>
                            </div>

                            {showVariations && (
                                <div className="p-4 md:p-6 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl space-y-4">
                                    <div className="flex flex-wrap gap-2">
                                        {formData.variations?.map((v, index) => (
                                            <div key={index} className="flex items-center gap-2 bg-white border border-primary/20 rounded-2xl px-3 py-1.5 shadow-sm">
                                                <span className="text-[10px] font-black text-primary uppercase">{v.gradeName}:</span>
                                                <span className="text-xs font-bold text-gray-700">{v.valueName || 'Padrão'}</span>
                                                <button type="button" onClick={() => handleRemoveVariation(index)} className="hover:text-red-500 transition-colors"><XCircleIcon className="h-4 w-4" /></button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase px-1">Grade</label>
                                            <select value={currentGradeId} onChange={e => { setCurrentGradeId(e.target.value); setCurrentValueId(''); }} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none h-[42px]">
                                                <option value="">Selecione...</option>
                                                {grades.filter(g => productType === 'Apple' ? g.name.toLowerCase() !== 'cor' : true).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase px-1">Valor</label>
                                            <select value={currentValueId} onChange={e => setCurrentValueId(e.target.value)} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none h-[42px]" disabled={!currentGradeId}>
                                                <option value="">Selecione...</option>
                                                {availableGradeValues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                            </select>
                                        </div>
                                        <button type="button" onClick={handleAddVariation} className="h-[42px] bg-gray-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all">Adicionar</button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClasses}>IMEI 1</label>
                                    <input
                                        type="text"
                                        name="imei1"
                                        value={formData.imei1 || ''}
                                        onChange={handleInputChange}
                                        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                                        className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 h-[48px] focus:ring-4 focus:ring-primary/5 outline-none shadow-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClasses}>IMEI 2</label>
                                    <input
                                        type="text"
                                        name="imei2"
                                        value={formData.imei2 || ''}
                                        onChange={handleInputChange}
                                        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                                        className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 h-[48px] focus:ring-4 focus:ring-primary/5 outline-none shadow-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClasses}>Nº de Série</label>
                                    <input
                                        type="text"
                                        name="serialNumber"
                                        value={formData.serialNumber || ''}
                                        onChange={handleInputChange}
                                        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                                        className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 h-[48px] focus:ring-4 focus:ring-primary/5 outline-none shadow-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClasses}>Código de Barras</label>
                                    <input
                                        type="text"
                                        value={formData.barcodes?.[0] || ''}
                                        onChange={(e) => setFormData(p => ({ ...p, barcodes: e.target.value ? [e.target.value] : [] }))}
                                        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                                        className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 h-[48px] focus:ring-4 focus:ring-primary/5 outline-none shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClasses}>Condição*</label>
                                    <select name="condition" value={formData.condition || ''} onChange={handleInputChange} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 h-[48px] focus:ring-4 focus:ring-primary/5 outline-none shadow-sm">
                                        {formData.condition && !conditionOptions.some(c => c.name.toLowerCase() === formData.condition?.toLowerCase()) && (
                                            <option value={formData.condition}>{formData.condition}</option>
                                        )}
                                        <option value="Novo">Novo</option>
                                        <option value="Seminovo">Seminovo</option>
                                        <option value="CPO">CPO</option>
                                        <option value="Openbox">Openbox</option>
                                        <option value="Reservado">Reservado</option>
                                        {conditionOptions.filter(c => !['Novo', 'Seminovo', 'CPO', 'Openbox', 'Reservado'].includes(c.name)).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                                {productType === 'Apple' && formData.condition === 'Seminovo' && (
                                    <div className="space-y-2"><label className={labelClasses}>Bateria (%)</label><input type="number" name="batteryHealth" min="0" max="100" value={formData.batteryHealth ?? 100} onChange={handleNumberChange} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-black text-gray-700 h-[48px] focus:ring-4 focus:ring-primary/5 outline-none shadow-sm" /></div>
                                )}
                                <div className="space-y-2">
                                    <label className={labelClasses}>Tempo de Garantia*</label>
                                    <select name="warranty" value={formData.warranty || ''} onChange={handleInputChange} className={`w-full p-3 bg-white border ${showErrors && !formData.warranty ? 'border-red-500 ring-4 ring-red-500/10' : 'border-gray-200'} rounded-xl text-sm font-bold text-gray-700 h-[48px] focus:ring-4 focus:ring-primary/5 outline-none shadow-sm`}>
                                        <option value="">Selecione...</option>
                                        {formData.warranty && !warrantyOptions.some(w => w.name.toLowerCase() === formData.warranty?.toLowerCase()) && (
                                            <option value={formData.warranty}>{formData.warranty}</option>
                                        )}
                                        {warrantyOptions.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClasses}>Local de Estoque*</label>
                                    <select name="storageLocation" value={formData.storageLocation || ''} onChange={handleInputChange} className={`w-full p-3 bg-white border ${showErrors && !formData.storageLocation ? 'border-red-500 ring-4 ring-red-500/10' : 'border-gray-200'} rounded-xl text-sm font-bold text-gray-700 h-[48px] focus:ring-4 focus:ring-primary/5 outline-none shadow-sm`}>
                                        <option value="">Selecione...</option>
                                        {formData.storageLocation && !locationOptions.some(l => l.name.toLowerCase() === formData.storageLocation?.toLowerCase()) && (
                                            <option value={formData.storageLocation}>{formData.storageLocation}</option>
                                        )}
                                        {locationOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                <div className="space-y-3">
                                    <label className={labelClasses}>Fornecedor</label>
                                    <div className="flex gap-2">
                                        <div className="flex-grow">
                                            <SearchableDropdown options={supplierOptions} value={formData.supplierId || null} onChange={(val) => setFormData(p => ({ ...p, supplierId: val || undefined }))} placeholder="Buscar..." />
                                        </div>
                                        <button type="button" onClick={() => setIsSupplierModalOpen(true)} className="p-3 bg-gray-100 text-gray-500 hover:bg-primary/10 hover:text-primary rounded-xl transition-all"><PlusIcon className="h-6 w-6" /></button>
                                    </div>
                                </div>

                                {!isTradeInMode && (
                                    <div className="flex items-end gap-6 h-[76px]">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-12 h-6 rounded-full transition-all relative ${isMinimumStockEnabled ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'bg-gray-200'}`}>
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isMinimumStockEnabled ? 'left-7' : 'left-1'}`} />
                                            </div>
                                            <input type="checkbox" checked={isMinimumStockEnabled} onChange={(e) => handleToggleMinimumStock(e.target.checked)} className="hidden" />
                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">Estoque Mínimo</span>
                                        </label>
                                        {isMinimumStockEnabled && (
                                            <input type="number" name="minimumStock" min="1" value={formData.minimumStock ?? 1} onChange={handleNumberChange} className="w-20 p-2 bg-gray-50 border border-gray-200 rounded-xl text-center font-bold text-sm h-[40px]" />
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-50 rounded-[32px] md:rounded-[40px] p-5 md:p-8 border border-gray-200/50 shadow-inner grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-1">Custo Entrada</label>
                                        <CurrencyInput
                                            value={formData.costPrice}
                                            onChange={handlePriceChange('costPrice')}
                                            className={`${showErrors && (!formData.costPrice || formData.costPrice <= 0) ? '!border-red-500 !ring-4 !ring-red-500/10' : ''} font-black text-xl md:text-2xl text-gray-800`}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Custo Adicional</label>
                                        <CurrencyInput
                                            value={formData.additionalCostPrice}
                                            onChange={handlePriceChange('additionalCostPrice')}
                                            className="font-bold text-lg text-gray-600"
                                        />
                                    </div>
                                </div>

                                <div className="bg-white rounded-[24px] md:rounded-[32px] p-5 md:p-6 border border-gray-100 shadow-xl flex flex-col justify-center gap-4 text-center">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase text-gray-400">Custo Total</span>
                                        <span className="text-2xl font-black text-gray-900 tracking-tight">{formatCurrency(totalCost)}</span>
                                    </div>
                                    <div className="w-full h-px bg-gray-100"></div>
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="flex items-center justify-between w-full px-2">
                                            <span className="text-[10px] font-black uppercase text-gray-400">Markup</span>
                                            <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-black">+{formData.markup ?? 0}%</span>
                                        </div>
                                        <input type="number" step="0.01" value={formData.markup ?? ''} onChange={handleMarkupChange} className="w-20 bg-transparent border-b-2 border-gray-100 text-center text-sm font-bold text-gray-500 focus:border-primary focus:text-primary outline-none transition-colors" placeholder="0" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-success uppercase tracking-widest px-1">Preço de Venda*</label>
                                        <CurrencyInput
                                            value={formData.price}
                                            onChange={handlePriceChange('price')}
                                            className={`${showErrors && (!formData.price || formData.price <= 0) ? '!border-red-500 !ring-4 !ring-red-500/10' : ''} font-black text-xl md:text-2xl text-success`}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest px-1">Preço de Atacado</label>
                                        <CurrencyInput
                                            value={formData.wholesalePrice}
                                            onChange={(val) => setFormData(p => ({ ...p, wholesalePrice: val || 0 }))}
                                            className="font-bold text-lg text-orange-600"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'extras' && (
                        <div className="space-y-8 animate-fade-in">
                            {/* Seção de Acessórios */}
                            <section>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                        <ArchiveBoxIcon className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-bold text-lg text-gray-800">Itens Inclusos / Acessórios</h3>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {accessoryItems.map(item => (
                                        <label key={item} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${formData.accessories?.includes(item) ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                                            <div className={`w-10 h-5 rounded-full p-0.5 transition-colors relative shrink-0 ${formData.accessories?.includes(item) ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'bg-gray-300'}`}>
                                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${formData.accessories?.includes(item) ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={formData.accessories?.includes(item) || false}
                                                onChange={() => handleAccessoryToggle(item)}
                                                className="hidden"
                                            />
                                            <span className={`text-xs font-bold ${formData.accessories?.includes(item) ? 'text-blue-700' : 'text-gray-600'}`}>{item}</span>
                                        </label>
                                    ))}
                                </div>
                            </section>

                            {/* Seção de Fotos */}
                            <section>
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                                            <PhotographIcon className="h-5 w-5" />
                                        </div>
                                        <h3 className="font-bold text-lg text-gray-800">Fotos do Aparelho</h3>
                                    </div>
                                    <span className="text-[10px] font-black bg-gray-100 text-gray-500 px-3 py-1 rounded-full uppercase tracking-widest">{formData.photos?.length || 0} / 6</span>
                                </div>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    multiple
                                    onChange={async (e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            const file = e.target.files[0];
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                                setTempImageForCrop(event.target?.result as string);
                                                setIsCropperOpen(true);
                                                setIsPhotoMenuOpen(false);
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                        if (e.target) e.target.value = ''; // Reset input
                                    }}
                                />

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {(formData.photos || []).map((photo, index) => (
                                        <div key={index} className="aspect-[4/5] relative group rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 shadow-sm">
                                            <img src={photo} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePhoto(index)}
                                                    className="p-2 bg-white text-red-500 rounded-full hover:bg-red-50 transition-colors transform hover:scale-110 shadow-lg"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {(formData.photos?.length || 0) < 6 && (
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setIsPhotoMenuOpen(prev => !prev)}
                                                className="w-full aspect-[4/5] flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 transition-all group text-gray-400 hover:text-primary relative"
                                            >
                                                <div className="p-3 bg-gray-50 rounded-full group-hover:bg-white transition-colors shadow-sm">
                                                    <PhotographIcon className="h-6 w-6" />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest">Adicionar</span>
                                            </button>

                                            {isPhotoMenuOpen && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-fade-in-up">
                                                    <button
                                                        type="button"
                                                        onClick={() => { fileInputRef.current?.click(); }}
                                                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-gray-600 hover:bg-gray-50 text-left transition-colors"
                                                    >
                                                        <PhotographIcon className="h-4 w-4" />
                                                        Galeria
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setIsCameraOpen(true); setIsPhotoMenuOpen(false); }}
                                                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-gray-600 hover:bg-gray-50 text-left transition-colors border-t border-gray-50"
                                                    >
                                                        <CameraIcon className="h-4 w-4" />
                                                        Câmera
                                                    </button>
                                                    {(formData.photos?.length || 0) > 0 && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    handleRemovePhoto(formData.photos!.length - 1);
                                                                    setIsPhotoMenuOpen(false);
                                                                }}
                                                                className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 text-left transition-colors border-t border-gray-50"
                                                            >
                                                                <TrashIcon className="h-4 w-4" />
                                                                Remover última
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setFormData(prev => ({ ...prev, photos: [] }));
                                                                    setIsPhotoMenuOpen(false);
                                                                }}
                                                                className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50 text-left transition-colors border-t border-gray-50"
                                                            >
                                                                <TrashIcon className="h-4 w-4" />
                                                                Remover todas
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    )}
                </div>

                {/* Footer Fixo */}
                <div className="p-4 md:p-8 border-t border-gray-100 bg-gray-50 flex justify-end items-center gap-4 sticky bottom-0 z-10 flex-none pb-safe">
                    <div className="flex gap-3 md:gap-4 w-full md:w-auto">
                        <button type="button" onClick={onClose} className="flex-1 md:flex-none px-6 py-3.5 md:py-4 bg-white border-2 border-gray-200 text-gray-500 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-gray-100 transition-all">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="flex-1 md:flex-none px-6 md:px-12 py-3.5 md:py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-black hover:shadow-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 md:min-w-[200px]">
                            {isSaving ? <SpinnerIcon className="h-5 w-5 mx-auto animate-spin" /> : (isTradeInMode ? 'Confirmar' : 'Salvar')}
                        </button>
                    </div>
                </div>
            </form>

            <CameraModal
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onCapture={handleAddPhoto}
            />

            <ImageCropperModal
                isOpen={isCropperOpen}
                imageUrl={tempImageForCrop}
                onClose={() => setIsCropperOpen(false)}
                onCrop={handleCropSave}
                aspectRatio={1}
            />

            {isSupplierModalOpen && (
                <CustomerModal
                    entity={null}
                    initialType="Fornecedor"
                    onClose={() => setIsSupplierModalOpen(false)}
                    onSave={handleSaveNewSupplier as any}
                    isSaving={savingSupplier}
                />
            )}
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default ProductModal;

