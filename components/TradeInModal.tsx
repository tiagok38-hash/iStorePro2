import React, { useState, useEffect, useMemo } from 'react';
import { Customer, Product, ProductChecklist, ProductCondition, ProductConditionParameter, StorageLocationParameter, WarrantyParameter, Brand, Category, ProductModel } from '../types.ts';
import { findOrCreateSupplierFromCustomer, formatCurrency, getProductConditions, getStorageLocations, getWarranties } from '../services/mockApi.ts';
import { getBrands, getCategories, getProductModels, addBrand, addCategory, addProductModel } from '../services/parametersService.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { CloseIcon, PlusIcon, SpinnerIcon, PhotographIcon, TrashIcon, CheckIcon, XCircleIcon } from './icons.tsx';
import CurrencyInput from './CurrencyInput.tsx';
import SearchableDropdown from './SearchableDropdown.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import CameraModal from './CameraModal.tsx';
import CustomDatePicker from './CustomDatePicker.tsx';
import { toDateValue } from '../utils/dateUtils.ts';

interface TradeInModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { tradeInValue: number; newProductData: any }) => Promise<void>;
    customer: Customer | null | undefined;
    products: Product[];
}

const checklistItems = [
    'Alto Falante (Auricular)', 'Alto Falante (Viva Voz)', 'Aparelho não pode ser ligado', 'Bateria',
    'Biometria / Touch ID', 'Botão Power (Liga/Desliga)', 'Botão Volume (Aumentar/Diminuir)',
    'Câmera Frontal', 'Câmera Traseira', 'Carcaça / Gabinete', 'Chave Seletora (Silênciar)',
    'Conector de Carga', 'Display / Tela / Touch', 'Face ID', 'Microfone', 'Parafusos',
    'Sensor de Proximidade', 'Sinal de Rede (Operadora)', 'Wi-Fi / Bluetooth', 'Tampa Traseira'
];

const accessoryItems = [
    'Caixa Original', 'Carregador', 'Cabo USB', 'Fone de Ouvido', 'Nota Fiscal', 'Capa', 'Película'
];

const TradeInModal: React.FC<TradeInModalProps> = ({ isOpen, onClose, onSave, customer, products }) => {
    const [activeTab, setActiveTab] = useState<'aparelho' | 'checklist' | 'fotos_acessorios'>('aparelho');
    const { showToast } = useToast();
    const { user } = useUser();
    const [isSaving, setIsSaving] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    const [conditionOptions, setConditionOptions] = useState<ProductConditionParameter[]>([]);
    const [locationOptions, setLocationOptions] = useState<StorageLocationParameter[]>([]);
    const [warrantyOptions, setWarrantyOptions] = useState<WarrantyParameter[]>([]);

    const [localBrands, setLocalBrands] = useState<Brand[]>([]);
    const [localCategories, setLocalCategories] = useState<Category[]>([]);
    const [localModels, setLocalModels] = useState<ProductModel[]>([]);

    const [isCreatingBrand, setIsCreatingBrand] = useState(false);
    const [newBrandName, setNewBrandName] = useState('');

    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    const [isCreatingModel, setIsCreatingModel] = useState(false);
    const [newModelName, setNewModelName] = useState('');

    useEffect(() => {
        const fetchParameters = async () => {
            const [conditions, locations, warranties, fetchedBrands, fetchedCats, fetchedModels] = await Promise.all([
                getProductConditions(),
                getStorageLocations(),
                getWarranties(),
                getBrands(),
                getCategories(),
                getProductModels(),
            ]);
            setConditionOptions(conditions);
            setLocationOptions(locations);
            setWarrantyOptions(warranties);
            setLocalBrands(fetchedBrands);
            setLocalCategories(fetchedCats);
            setLocalModels(fetchedModels);
        };
        fetchParameters();
    }, []);

    const [deviceData, setDeviceData] = useState({
        supplierName: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        origin: 'Nacional',
        condition: 'Seminovo' as ProductCondition,
        storageLocation: '',
        brand: '',
        category: '',
        model: '',
        color: '',
        imei1: '',
        imei2: '',
        serialNumber: '',
        barcode: '',
        warranty: '',
        batteryHealth: 100,
        costPrice: 0,
        additionalCostPrice: 0,
        markup: 0,
        salePrice: 0,
        observations: '',
        apple_warranty_until: '',
    });

    const [checklistData, setChecklistData] = useState<{
        toggles: Record<string, boolean>;
        notes: string;
        services: string;
        date: string;
        repairCost: number;
    }>({
        toggles: checklistItems.reduce((acc, item) => ({ ...acc, [item]: false }), {}),
        notes: '',
        services: '',
        date: new Date().toISOString().split('T')[0],
        repairCost: 0,
    });

    const [accessoriesData, setAccessoriesData] = useState<Record<string, boolean>>(
        accessoryItems.reduce((acc, item) => ({ ...acc, [item]: false }), {})
    );

    const [photos, setPhotos] = useState<string[]>([]);

    useEffect(() => {
        if (customer) {
            setDeviceData(prev => ({
                ...prev,
                supplierName: customer.name,
                observations: `Produto entrou a base de troca a partir da Venda ID# ${Math.floor(1000 + Math.random() * 9000)} de ${customer.name}.`
            }));
        }
    }, [customer]);

    useEffect(() => {
        setDeviceData(prev => ({ ...prev, additionalCostPrice: checklistData.repairCost }));
    }, [checklistData.repairCost]);

    const finalCost = useMemo(() => deviceData.costPrice + deviceData.additionalCostPrice, [deviceData.costPrice, deviceData.additionalCostPrice]);
    const suggestedPrice = useMemo(() => finalCost * (1 + (deviceData.markup / 100)), [finalCost, deviceData.markup]);

    const handleDeviceChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'imei1' || name === 'imei2') {
            const numericValue = value.replace(/\D/g, '').substring(0, 15);
            setDeviceData(prev => ({ ...prev, [name]: numericValue }));
        } else {
            setDeviceData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleNumericDeviceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setDeviceData(prev => ({ ...prev, [name]: Number(value) || 0 }));
    };

    const handleChecklistToggle = (item: string) => {
        setChecklistData(prev => ({
            ...prev,
            toggles: { ...prev.toggles, [item]: !prev.toggles[item] }
        }));
    };

    const handleAccessoryToggle = (item: string) => {
        setAccessoriesData(prev => ({ ...prev, [item]: !prev[item] }));
    };

    const handleSaveBrand = async () => {
        if (!newBrandName.trim()) return;
        try {
            const newBrand = await addBrand({ name: newBrandName.trim() });
            const brandToAdd = { id: String(newBrand.id), name: newBrandName.trim(), description: '' };
            setLocalBrands(prev => [...prev, brandToAdd]);
            setDeviceData(prev => ({ ...prev, brand: brandToAdd.id, category: '', model: '' }));
            setIsCreatingBrand(false);
            setNewBrandName('');
            showToast('Marca cadastrada com sucesso!', 'success');
        } catch (error) {
            console.error(error);
            showToast('Erro ao cadastrar marca', 'error');
        }
    };

    const handleSaveCategory = async () => {
        if (!newCategoryName.trim()) return;
        const currentBrandId = deviceData.brand;
        if (!currentBrandId) return;
        try {
            const newCat = await addCategory({ name: newCategoryName.trim(), brandId: currentBrandId });
            const catToAdd = { id: String(newCat.id), name: newCategoryName.trim(), description: '', brandId: newCat.brand_id || currentBrandId };
            setLocalCategories(prev => [...prev, catToAdd]);
            setDeviceData(prev => ({ ...prev, category: catToAdd.id, model: '' }));
            setIsCreatingCategory(false);
            setNewCategoryName('');
            showToast('Categoria cadastrada com sucesso!', 'success');
        } catch (error) {
            console.error(error);
            showToast('Erro ao cadastrar categoria', 'error');
        }
    };

    const handleSaveModel = async () => {
        if (!newModelName.trim()) return;
        const currentCatId = deviceData.category;
        if (!currentCatId) return;
        try {
            const newMod = await addProductModel({ name: newModelName.trim(), categoryId: currentCatId });
            const modToAdd = { id: String(newMod.id), name: newModelName.trim(), description: '', categoryId: newMod.category_id || currentCatId };
            setLocalModels(prev => [...prev, modToAdd]);
            setDeviceData(prev => ({ ...prev, model: modToAdd.id }));
            setIsCreatingModel(false);
            setNewModelName('');
            showToast('Modelo cadastrado com sucesso!', 'success');
        } catch (error) {
            console.error(error);
            showToast('Erro ao cadastrar modelo', 'error');
        }
    };

    const filteredCategories = useMemo(() => {
        if (!deviceData.brand) return [];
        return localCategories.filter(c => c.brandId === deviceData.brand);
    }, [localCategories, deviceData.brand]);

    const filteredModels = useMemo(() => {
        if (!deviceData.category) return [];
        return localModels
            .filter(m => m.categoryId === deviceData.category)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [localModels, deviceData.category]);

    const handleAddPhoto = (imageData: string) => {
        if (photos.length >= 6) {
            showToast('Limite de 6 fotos atingido.', 'error');
            return;
        }
        setPhotos(prev => [...prev, imageData]);
        setIsCameraOpen(false);
    };

    const handleRemovePhoto = (index: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveClick = async () => {
        if (!customer) {
            showToast('Cliente não encontrado.', 'error');
            return;
        }
        const isValidImei = (val: string) => /^\d{15}$/.test(val || '');
        if (deviceData.imei1 && !isValidImei(deviceData.imei1)) {
            showToast('O IMEI 1 deve ter exatamente 15 números.', 'error');
            return;
        }
        if (deviceData.imei2 && !isValidImei(deviceData.imei2)) {
            showToast('O IMEI 2 deve ter exatamente 15 números.', 'error');
            return;
        }
        if (deviceData.costPrice <= 0) {
            showToast('O "Custo do Produto" (valor da troca) deve ser maior que zero.', 'error');
            return;
        }
        if (deviceData.salePrice <= 0) {
            showToast('O "Preço de Venda" deve ser maior que zero.', 'error');
            return;
        }
        if (!deviceData.storageLocation || deviceData.storageLocation === 'Selecione...') {
            showToast('Selecione o Local de Estoque.', 'error');
            return;
        }
        if (!deviceData.warranty || deviceData.warranty === 'Selecione...') {
            showToast('Selecione o Tempo de Garantia.', 'error');
            return;
        }

        setIsSaving(true);

        try {
            const supplier = await findOrCreateSupplierFromCustomer(customer);
            
            const brandObj = localBrands.find(b => b.id === deviceData.brand);
            const brandName = brandObj?.name || deviceData.brand;
            
            const catObj = localCategories.find(c => c.id === deviceData.category);
            const catName = catObj?.name || deviceData.category;
            
            const modObj = localModels.find(m => m.id === deviceData.model);
            const modName = modObj?.name || deviceData.model;

            const fullModel = `${brandName} ${catName} ${modName} ${deviceData.color}`.trim();

            const checklist: ProductChecklist = {
                ...checklistData.toggles,
                notes: checklistData.notes,
                services: checklistData.services,
                checklistDate: checklistData.date,
                repairCost: checklistData.repairCost,
            };

            const selectedAccessories = Object.entries(accessoriesData)
                .filter(([_, checked]) => checked)
                .map(([name]) => name);

            const newProductData = {
                brand: brandName,
                category: catName,
                model: fullModel,
                price: deviceData.salePrice,
                costPrice: deviceData.costPrice,
                additionalCostPrice: deviceData.additionalCostPrice,
                markup: deviceData.markup,
                stock: 1,
                serialNumber: deviceData.serialNumber,
                imei1: deviceData.imei1,
                imei2: deviceData.imei2,
                batteryHealth: deviceData.batteryHealth,
                condition: deviceData.condition,
                warranty: deviceData.warranty,
                color: deviceData.color,
                storageLocation: deviceData.storageLocation,
                barcodes: deviceData.barcode ? [deviceData.barcode] : [],
                supplierId: supplier.id, // This is the Trade-In Customer as Supplier ID
                supplierName: deviceData.supplierName, // Required for Stock History log details
                origin: 'Troca' as const,
                createdBy: user?.id || null, // Real user
                createdByName: user?.name || 'Sistema',
                checklist,
                selectedCustomerId: customer.id, // For history tracking
                photos: photos,
                accessories: selectedAccessories,
                apple_warranty_until: deviceData.apple_warranty_until || undefined,
                observations: deviceData.observations || undefined,
            };

            await onSave({ tradeInValue: deviceData.costPrice, newProductData });

        } catch (error) {
            showToast('Erro ao processar a troca.', 'error');
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const inputClasses = "w-full p-2 border rounded-xl bg-transparent border-border focus:ring-success focus:border-success text-sm h-[48px]";
    const labelClasses = "text-[11px] font-bold text-gray-900 mb-1 block pl-1";
    const tabClasses = (tabName: 'aparelho' | 'checklist' | 'fotos_acessorios') =>
        `px-4 py-2 text-sm font-semibold rounded-xl ${activeTab === tabName ? 'bg-primary text-white' : 'bg-gray-200 text-secondary'}`;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[60] p-4">
            <div className="bg-surface rounded-3xl shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setActiveTab('aparelho')} className={tabClasses('aparelho')}>APARELHO</button>
                        <button onClick={() => setActiveTab('checklist')} className={tabClasses('checklist')}>CHECKLIST</button>
                        <button onClick={() => setActiveTab('fotos_acessorios')} className={tabClasses('fotos_acessorios')}>FOTOS E OPCIONAIS</button>
                    </div>
                    <button onClick={onClose} className="p-1 text-muted hover:text-danger"><CloseIcon className="h-6 w-6" /></button>
                </div>

                {activeTab === 'aparelho' && (
                    <div className="p-6 space-y-4 overflow-y-auto">
                        <h3 className="font-semibold text-lg flex items-center gap-2"><PlusIcon /> Aparelho para troca</h3>
                        <div className="text-sm text-primary bg-blue-50 p-3 rounded-xl border border-blue-200 text-center">
                            Para cadastrar Marcas, Categorias, e Grades, <a href="/#/company?tab=marcas" target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-blue-700">clique aqui</a>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="md:col-span-1"><label className={labelClasses}>Código de Barras</label><input name="barcode" value={deviceData.barcode} onChange={handleDeviceChange} className={inputClasses} placeholder="Escaneie aqui..." autoFocus /></div>
                            <div className="md:col-span-1"><label className={labelClasses}>Fornecedor*</label><input value={deviceData.supplierName} className={`${inputClasses} bg-gray-100`} disabled /></div>
                            <div>
                                <label className={labelClasses}>Data da compra*</label>
                                <CustomDatePicker
                                    value={deviceData.purchaseDate}
                                    onChange={(val) => setDeviceData(prev => ({ ...prev, purchaseDate: val }))}
                                    max={toDateValue()}
                                    className="w-full"
                                />
                            </div>
                            <div><label className={labelClasses}>Origem*</label><select name="origin" value={deviceData.origin} onChange={handleDeviceChange} className={inputClasses}><option>Nacional</option><option>Importado</option></select></div>
                            <div><label className={labelClasses}>Local de Estoque*</label><select name="storageLocation" value={deviceData.storageLocation} onChange={handleDeviceChange} className={`${inputClasses} ${(!deviceData.storageLocation || deviceData.storageLocation === 'Selecione...') ? 'border-red-500' : ''}`}><option value="">Selecione...</option>{deviceData.storageLocation && deviceData.storageLocation !== 'Selecione...' && !locationOptions.some(l => l.name.toLowerCase() === deviceData.storageLocation?.toLowerCase()) && <option value={deviceData.storageLocation}>{deviceData.storageLocation}</option>}{locationOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</select></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div>
                                <label className={labelClasses}>Marca*</label>
                                {isCreatingBrand ? (
                                    <div className="flex items-center gap-2 h-11">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={newBrandName}
                                            onChange={e => setNewBrandName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleSaveBrand();
                                                } else if (e.key === 'Escape') {
                                                    e.preventDefault();
                                                    setIsCreatingBrand(false);
                                                    setNewBrandName('');
                                                }
                                            }}
                                            className={`${inputClasses} flex-1 m-0 h-full`}
                                            placeholder="Nova marca..."
                                        />
                                        <button type="button" onClick={handleSaveBrand} className="h-full w-11 bg-green-500 text-white rounded-xl flex items-center justify-center hover:bg-green-600 transition-colors">
                                            <CheckIcon className="h-5 w-5" />
                                        </button>
                                        <button type="button" onClick={() => { setIsCreatingBrand(false); setNewBrandName(''); }} className="h-full w-11 bg-red-500 text-white rounded-xl flex items-center justify-center hover:bg-red-600 transition-colors">
                                            <XCircleIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <select 
                                        value={deviceData.brand || ''} 
                                        onChange={e => { 
                                            const val = e.target.value; 
                                            if (val === 'NEW_BRAND') {
                                                setIsCreatingBrand(true);
                                            } else {
                                                setDeviceData(prev => ({ ...prev, brand: val, category: '', model: '' })); 
                                            }
                                        }} 
                                        className={inputClasses}
                                    >
                                        <option value="">Selecione</option>
                                        <option value="NEW_BRAND" className="font-bold text-blue-600 bg-blue-50">+ Cadastrar Nova...</option>
                                        {localBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                )}
                            </div>
                            <div>
                                <label className={labelClasses}>Categoria*</label>
                                {isCreatingCategory ? (
                                    <div className="flex items-center gap-2 h-11">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={newCategoryName}
                                            onChange={e => setNewCategoryName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleSaveCategory();
                                                } else if (e.key === 'Escape') {
                                                    e.preventDefault();
                                                    setIsCreatingCategory(false);
                                                    setNewCategoryName('');
                                                }
                                            }}
                                            className={`${inputClasses} flex-1 m-0 h-full`}
                                            placeholder="Nova categoria..."
                                        />
                                        <button type="button" onClick={handleSaveCategory} className="h-full w-11 bg-green-500 text-white rounded-xl flex items-center justify-center hover:bg-green-600 transition-colors">
                                            <CheckIcon className="h-5 w-5" />
                                        </button>
                                        <button type="button" onClick={() => { setIsCreatingCategory(false); setNewCategoryName(''); }} className="h-full w-11 bg-red-500 text-white rounded-xl flex items-center justify-center hover:bg-red-600 transition-colors">
                                            <XCircleIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <select 
                                        value={deviceData.category || ''} 
                                        onChange={e => { 
                                            const val = e.target.value; 
                                            if (val === 'NEW_CATEGORY') {
                                                setIsCreatingCategory(true);
                                            } else {
                                                setDeviceData(prev => ({ ...prev, category: val, model: '' })); 
                                            }
                                        }} 
                                        className={inputClasses} 
                                        disabled={!deviceData.brand}
                                    >
                                        <option value="">Selecione</option>
                                        {deviceData.brand && (
                                            <option value="NEW_CATEGORY" className="font-bold text-blue-600 bg-blue-50">+ Cadastrar Nova...</option>
                                        )}
                                        {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                )}
                            </div>
                            <div>
                                <label className={labelClasses}>Modelo*</label>
                                {isCreatingModel ? (
                                    <div className="flex items-center gap-2 h-11">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={newModelName}
                                            onChange={e => setNewModelName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleSaveModel();
                                                } else if (e.key === 'Escape') {
                                                    e.preventDefault();
                                                    setIsCreatingModel(false);
                                                    setNewModelName('');
                                                }
                                            }}
                                            className={`${inputClasses} flex-1 m-0 h-full`}
                                            placeholder="Novo modelo..."
                                        />
                                        <button type="button" onClick={handleSaveModel} className="h-full w-11 bg-green-500 text-white rounded-xl flex items-center justify-center hover:bg-green-600 transition-colors">
                                            <CheckIcon className="h-5 w-5" />
                                        </button>
                                        <button type="button" onClick={() => { setIsCreatingModel(false); setNewModelName(''); }} className="h-full w-11 bg-red-500 text-white rounded-xl flex items-center justify-center hover:bg-red-600 transition-colors">
                                            <XCircleIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="h-[48px] -mt-0.5">
                                        <SearchableDropdown
                                            options={[
                                                { value: 'NEW_MODEL', label: '+ Cadastrar Novo...' },
                                                ...filteredModels.map(m => ({ value: m.id, label: m.name }))
                                            ]}
                                            value={deviceData.model || null}
                                            onChange={val => {
                                                if (val === 'NEW_MODEL') {
                                                    setIsCreatingModel(true);
                                                } else {
                                                    setDeviceData(prev => ({ ...prev, model: val || '' }));
                                                }
                                            }}
                                            placeholder="Selecione ou busque..."
                                            disabled={!deviceData.category}
                                        />
                                    </div>
                                )}
                            </div>
                            <div><label className={labelClasses}>Cor*</label><input name="color" value={deviceData.color} onChange={handleDeviceChange} className={inputClasses} /></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
                            <div className="md:col-span-1"><label className={labelClasses}>IMEI1</label><input name="imei1" value={deviceData.imei1} onChange={handleDeviceChange} className={inputClasses} /></div>
                            <div className="md:col-span-1"><label className={labelClasses}>IMEI2</label><input name="imei2" value={deviceData.imei2} onChange={handleDeviceChange} className={inputClasses} /></div>
                            <div className="md:col-span-1"><label className={labelClasses}>Número de série</label><input name="serialNumber" value={deviceData.serialNumber} onChange={handleDeviceChange} className={inputClasses} /></div>
                            <div><label className={labelClasses}>Garantia*</label><select name="warranty" value={deviceData.warranty} onChange={handleDeviceChange} className={`${inputClasses} ${(!deviceData.warranty || deviceData.warranty === 'Selecione...') ? 'border-red-500' : ''}`}><option value="">Selecione...</option>{deviceData.warranty && deviceData.warranty !== 'Selecione...' && !warrantyOptions.some(w => w.name.toLowerCase() === deviceData.warranty?.toLowerCase()) && <option value={deviceData.warranty}>{deviceData.warranty}</option>}{warrantyOptions.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}</select></div>
                            <div><label className={labelClasses}>Saúde Bateria</label><input name="batteryHealth" type="number" value={deviceData.batteryHealth} onChange={handleNumericDeviceChange} className={inputClasses} /></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 items-end pt-4 border-t">
                            <div><label className={labelClasses}>Custo do Produto (un)*</label><CurrencyInput value={deviceData.costPrice} onChange={v => setDeviceData(p => ({ ...p, costPrice: v || 0 }))} className="!border-red-500" /></div>
                            <div><label className={labelClasses}>Custos Adicionais (un)</label><CurrencyInput value={deviceData.additionalCostPrice} onChange={v => setDeviceData(p => ({ ...p, additionalCostPrice: v || 0 }))} /></div>
                            <div><label className={labelClasses}>Custo Final (un)</label><div className={`${inputClasses} bg-gray-100 flex items-center`}>{formatCurrency(finalCost)}</div></div>
                            <div><label className={labelClasses}>Markup %</label><input name="markup" type="number" value={deviceData.markup} onChange={handleNumericDeviceChange} className={inputClasses} /></div>
                            <div><label className={labelClasses}>Preço Sugerido</label><div className={`${inputClasses} bg-gray-100 flex items-center`}>{formatCurrency(suggestedPrice)}</div></div>
                            <div><label className={labelClasses}>Preço de Venda*</label><CurrencyInput value={deviceData.salePrice} onChange={v => setDeviceData(p => ({ ...p, salePrice: v || 0 }))} className="!border-red-500" /></div>
                        </div>
                        <div><label className={labelClasses}>Observações</label><textarea name="observations" value={deviceData.observations} onChange={handleDeviceChange} rows={3} className={inputClasses.replace('h-10', '')} /></div>
                    </div>
                )}

                {activeTab === 'checklist' && (
                    <div className="p-6 space-y-4 overflow-y-auto">
                        <h3 className="font-semibold text-lg flex items-center gap-2">Checklist de produtos Seminovo</h3>
                        <p className="text-sm text-yellow-600 bg-yellow-100 p-2 rounded-xl">Marque as opções que apresentam defeito ou avaria.</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
                            {checklistItems.map(item => (
                                <label key={item} className="flex items-center gap-3 cursor-pointer group">
                                    <div className={`w-10 h-5 rounded-full p-1 transition-colors ${checklistData.toggles[item] ? 'bg-blue-600' : 'bg-gray-300'}`}>
                                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${checklistData.toggles[item] ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </div>
                                    <input type="checkbox" className="hidden" checked={checklistData.toggles[item]} onChange={() => handleChecklistToggle(item)} />
                                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{item}</span>
                                </label>
                            ))}
                        </div>
                        <div className="space-y-4 pt-4 border-t">
                            <div><label className={labelClasses}>Anotações do Checklist</label><textarea value={checklistData.notes} onChange={e => setChecklistData(p => ({ ...p, notes: e.target.value }))} rows={2} className={inputClasses.replace('h-10', '')} placeholder="Utilize este campo para anotar observações do checklist que não estão listados acima OU detalhar os campos marcados acima." /></div>
                            <div><label className={labelClasses}>Descrição do(s) serviço(s)</label><textarea value={checklistData.services} onChange={e => setChecklistData(p => ({ ...p, services: e.target.value }))} rows={2} className={inputClasses.replace('h-10', '')} placeholder="Utilize este campo para anotar os serviços que serão executados." /></div>
                            <div className="flex flex-col md:flex-row items-start gap-4">
                                <div className="flex flex-col w-full md:w-1/2">
                                    <div className="flex flex-col justify-end min-h-[44px] mb-1">
                                        <label className={labelClasses.replace('mb-1', 'm-0')}>Data do Checklist</label>
                                    </div>
                                    <CustomDatePicker
                                        value={checklistData.date}
                                        onChange={(val) => setChecklistData(p => ({ ...p, date: val }))}
                                        max={toDateValue()}
                                        className="w-full !shadow-none !rounded-xl !h-14 !min-h-[56px] !max-h-[56px] box-border"
                                    />
                                </div>
                                <div className="flex flex-col w-full md:w-1/2">
                                    <div className="flex flex-col justify-end min-h-[44px] mb-1">
                                        <label className={labelClasses.replace('mb-1', 'm-0')}>Custo de Reparo</label>
                                        <p className="text-[10px] text-gray-400 mt-0.5 px-1 leading-tight">Valor a ser abatido/somado ao custo.</p>
                                    </div>
                                    <CurrencyInput value={checklistData.repairCost} onChange={v => setChecklistData(p => ({ ...p, repairCost: v || 0 }))} className="w-full !h-14 !min-h-[56px] !max-h-[56px] box-border" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'fotos_acessorios' && (
                    <div className="p-6 space-y-6 overflow-y-auto">
                        <section>
                            <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">Itens Inclusos / Acessórios</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 bg-gray-50 p-4 rounded-3xl border border-gray-100">
                                {accessoryItems.map(item => (
                                    <label key={item} className="flex items-center gap-3 cursor-pointer group">
                                        <div className={`w-10 h-5 rounded-full p-1 transition-colors ${accessoriesData[item] ? 'bg-blue-600' : 'bg-gray-300'}`}>
                                            <div className={`w-3 h-3 bg-white rounded-full transition-transform ${accessoriesData[item] ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                        </div>
                                        <input type="checkbox" className="hidden" checked={accessoriesData[item]} onChange={() => handleAccessoryToggle(item)} />
                                        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{item}</span>
                                    </label>
                                ))}
                            </div>
                        </section>

                        <section>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-semibold text-lg flex items-center gap-2"><PhotographIcon /> Fotos do Aparelho</h3>
                                <span className="text-sm text-muted">{photos.length} / 6 fotos</span>
                            </div>

                            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                                {photos.map((photo, index) => (
                                    <div key={index} className="relative group aspect-square border rounded-xl overflow-hidden bg-gray-100 shadow-sm">
                                        <img src={photo} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => handleRemovePhoto(index)}
                                            className="absolute top-1 right-1 p-1 bg-white/80 text-danger rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                                            title="Remover foto"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                                {photos.length < 6 && (
                                    <button
                                        onClick={() => setIsCameraOpen(true)}
                                        className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl text-muted hover:border-primary hover:text-primary transition-colors bg-gray-50 hover:bg-white"
                                    >
                                        <PlusIcon className="h-8 w-8 mb-1" />
                                        <span className="text-xs font-medium">Adicionar Foto</span>
                                    </button>
                                )}
                            </div>
                        </section>

                        {/* Informações Adicionais */}
                        <section className="space-y-3 pt-2">
                            <h3 className="font-semibold text-base flex items-center gap-2">Informações Adicionais</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className={labelClasses}>Garantia Apple/Fabricante Restante</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={10}
                                        value={deviceData.apple_warranty_until || ''}
                                        onChange={(e) => {
                                            const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                                            let formatted = digits;
                                            if (digits.length > 4) {
                                                formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
                                            } else if (digits.length > 2) {
                                                formatted = digits.slice(0, 2) + '/' + digits.slice(2);
                                            }
                                            setDeviceData(p => ({ ...p, apple_warranty_until: formatted }));
                                        }}
                                        className={inputClasses + ' w-1/2'}
                                        placeholder="dd/mm/aaaa"
                                    />
                                </div>
                                <div className={`space-y-1 ${!deviceData.apple_warranty_until ? 'col-start-2' : ''}`}>
                                    <label className={labelClasses}>Observações (comprovante)</label>
                                    <input
                                        type="text"
                                        name="observations"
                                        value={deviceData.observations}
                                        onChange={handleDeviceChange}
                                        className={inputClasses}
                                        placeholder="Ex: Produto sem carregador, arranhado na tampa..."
                                    />
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                <div className="flex justify-end items-center p-4 border-t border-border mt-auto">
                    <button type="button" onClick={handleSaveClick} disabled={isSaving} className="px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 font-semibold disabled:bg-muted">
                        {isSaving ? <SpinnerIcon className="h-5 w-5" /> : 'Salvar'}
                    </button>
                </div>
            </div>

            <CameraModal
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onCapture={handleAddPhoto}
            />
        </div>
    );
};

export default TradeInModal;