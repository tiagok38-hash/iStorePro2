import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, XCircleIcon, PlusIcon, Search, Cpu, User, Image as ImageIcon } from 'lucide-react';
import { Customer, Brand, Category, ProductModel, Grade, GradeValue, ProductVariation } from '../types';
import { appleProductHierarchy } from '../services/constants';
import SearchableDropdown from './SearchableDropdown';
import CustomerModal from './CustomerModal';
import { addCustomer } from '../services/mockApi';
import { useToast } from '../contexts/ToastContext';

interface ServiceOrderElectronicDevicesModalProps {
    isOpen: boolean;
    onClose: () => void;
    customers: Customer[];
    brands: Brand[];
    categories: Category[];
    productModels: ProductModel[];
    grades: Grade[];
    gradeValues: GradeValue[];
    onSave: (device: any) => void;
    initialData?: any;
}

const emptyItem = {
    type: 'Produto Apple',
    brand: 'Apple',
    category: '',
    model: '',
    storage: '',
    color: '',
    imei: '',
    imei2: '',
    serialNumber: '',
    ean: '',
    customerName: '',
    customerCpf: '',
    customerId: '',
    variations: [] as ProductVariation[],
};

export const ServiceOrderElectronicDevicesModal: React.FC<ServiceOrderElectronicDevicesModalProps> = ({
    isOpen,
    onClose,
    customers,
    brands,
    categories,
    productModels,
    grades,
    gradeValues,
    onSave,
    initialData
}) => {
    const { showToast } = useToast();
    const [formData, setFormData] = useState({ ...emptyItem });
    const [productType, setProductType] = useState<'Apple' | 'Produto'>('Apple');
    const [showVariations, setShowVariations] = useState(false);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [currentGradeId, setCurrentGradeId] = useState('');
    const [currentValueId, setCurrentValueId] = useState('');
    const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);

    useEffect(() => {
        setLocalCustomers(customers);
    }, [customers]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            if (initialData && (initialData.model || initialData.rawModel)) {
                // Modo Edição
                const mappedData = { ...emptyItem, ...initialData };

                // Se for Apple ou tiver rawModel, usamos o rawModel para preencher o campo de modelo da hierarquia
                if (initialData.rawModel) {
                    mappedData.model = initialData.rawModel;
                } else if (initialData.category && appleProductHierarchy[initialData.category as keyof typeof appleProductHierarchy]) {
                    // Try to infer model from the full string if missing
                    const models = Object.keys(appleProductHierarchy[initialData.category as keyof typeof appleProductHierarchy] || {});
                    // find the longest matching model (e.g. iPhone 17 Pro Max vs iPhone 17)
                    models.sort((a, b) => b.length - a.length);
                    const foundModel = models.find(m => initialData.model && initialData.model.includes(m));
                    if (foundModel) {
                        mappedData.model = foundModel;
                    }
                }

                if (initialData.storage) {
                    mappedData.storage = initialData.storage;
                } else if (initialData.category && mappedData.model) {
                    // Try to infer storage from the full string if missing
                    const storages = Object.keys((appleProductHierarchy as any)?.[initialData.category]?.[mappedData.model] || {});
                    const foundStorage = storages.find(s => initialData.model && initialData.model.includes(s));
                    if (foundStorage) {
                        mappedData.storage = foundStorage;
                    }
                }

                // Garante que o IMEI seja carregado independentemente da chave (imei ou imei1)
                mappedData.imei = initialData.imei || initialData.imei1 || '';

                setFormData(mappedData);
                setProductType(initialData.type === 'Produtos Apple' ? 'Apple' : 'Produto');
            } else {
                // Modo Novo Cadastro
                setFormData({
                    ...emptyItem,
                    customerName: initialData?.customerName || '',
                    customerCpf: initialData?.customerCpf || '',
                    customerId: initialData?.customerId || ''
                });
                setProductType('Apple');
            }
            setShowVariations(false);
            setCurrentGradeId('');
            setCurrentValueId('');
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose, initialData]);

    const isMemoryless = useMemo(() => {
        const cat = formData.category;
        return cat === 'Acessórios' || cat === 'AirPods' || cat === 'EarPods' || cat === 'Mac' || cat === 'Watch';
    }, [formData.category]);

    const availableAppleModels = useMemo(() => {
        if (!formData.category) return [];
        return Object.keys(appleProductHierarchy[formData.category as keyof typeof appleProductHierarchy] || {});
    }, [formData.category]);

    const availableAppleMemories = useMemo(() => {
        if (!formData.category || !formData.model || isMemoryless) return [];
        const modelData = (appleProductHierarchy as any)[formData.category]?.[formData.model];
        return modelData ? Object.keys(modelData) : [];
    }, [formData.category, formData.model, isMemoryless]);

    const availableAppleColors = useMemo(() => {
        if (!formData.category || !formData.model) return [];
        const modelData = (appleProductHierarchy as any)[formData.category]?.[formData.model];
        if (!modelData) return [];
        if (isMemoryless) return modelData['Padrão'] || [];
        if (!formData.storage) return [];
        return modelData[formData.storage] || [];
    }, [formData.category, formData.model, formData.storage, isMemoryless]);

    const filteredCategories = useMemo(() => {
        if (!formData.brand) return [];
        return categories.filter(c => c.brandId === formData.brand);
    }, [formData.brand, categories]);

    const filteredModels = useMemo(() => {
        if (!formData.category) return [];
        return productModels.filter(m => m.categoryId === formData.category);
    }, [formData.category, productModels]);

    const availableGradeValues = useMemo(() => {
        if (!currentGradeId) return [];
        return gradeValues.filter(v => v.gradeId === currentGradeId);
    }, [currentGradeId, gradeValues]);

    const handleAppleFilterChange = (field: 'category' | 'model' | 'storage' | 'color', value: string) => {
        const updatedData = { ...formData };
        switch (field) {
            case 'category':
                updatedData.category = value;
                updatedData.model = '';
                updatedData.storage = '';
                updatedData.color = '';
                break;
            case 'model':
                updatedData.model = value;
                updatedData.storage = '';
                updatedData.color = '';
                break;
            case 'storage':
                updatedData.storage = value;
                updatedData.color = '';
                break;
            case 'color':
                updatedData.color = value;
                break;
        }
        setFormData(updatedData);
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
        setFormData(prev => ({
            ...prev,
            variations: prev.variations.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = () => {
        let finalModelName = formData.model;
        let finalBrandName = formData.brand;
        let finalType = formData.type;
        const variationString = formData.variations.map(v => v.valueName).join(' ');

        if (productType === 'Apple') {
            finalBrandName = 'Apple';
            finalType = 'Produtos Apple';

            // Tenta identificar se o model já é o nome completo (caso de edição)
            // Se for Apple, o ideal é recomeçar do modelo base se possível, ou evitar duplicar
            let baseModel = formData.model;

            // Se o modelo já contém a categoria, armazenamento ou cor, não adicionamos de novo
            const hasCategory = baseModel.toLowerCase().includes(formData.category.toLowerCase());
            const hasStorage = formData.storage && baseModel.toLowerCase().includes(formData.storage.toLowerCase());
            const hasColor = formData.color && baseModel.toLowerCase().includes(formData.color.toLowerCase());

            let nameParts = [];
            if (!hasCategory) nameParts.push(formData.category);
            nameParts.push(baseModel);
            if (!hasStorage && formData.storage) nameParts.push(formData.storage);
            if (!hasColor && formData.color) nameParts.push(formData.color);
            if (variationString) nameParts.push(variationString);

            finalModelName = nameParts.join(' ').trim().replace(/\s+/g, ' ');
        } else {
            const brandObj = brands.find(b => b.id === formData.brand);
            finalBrandName = brandObj?.name || formData.brand;

            const categoryObj = categories.find(c => c.id === formData.category);
            const categoryName = categoryObj?.name || formData.category;

            finalType = categoryName;

            const modelObj = productModels.find(m => m.id === formData.model);
            const modelName = modelObj?.name || formData.model;

            // Evita duplicar se o modelName já tiver a marca ou categoria
            let nameParts = [];
            if (!modelName.toLowerCase().includes(categoryName.toLowerCase())) nameParts.push(categoryName);
            if (!modelName.toLowerCase().includes(finalBrandName.toLowerCase())) nameParts.push(finalBrandName);
            nameParts.push(modelName);
            if (variationString) nameParts.push(variationString);

            finalModelName = nameParts.join(' ').trim().replace(/\s+/g, ' ');
        }

        const newDevice = {
            ...formData,
            id: initialData?.id || crypto.randomUUID(),
            type: finalType,
            brand: finalBrandName,
            model: finalModelName, // Nome completo para exibição
            rawModel: formData.model, // Nome/ID original para edição
            soldInStore: initialData?.soldInStore || false,
            hasPreviousRepair: initialData?.hasPreviousRepair || false,
            history: initialData?.history || []
        };

        onSave(newDevice);
        onClose();
    };

    if (!isOpen) return null;

    const inputClasses = "w-full h-11 px-3 bg-gray-50 border border-gray-200 text-gray-800 rounded-lg outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all text-sm";
    const labelClasses = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1";

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-4 md:p-5 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-gray-900 text-white rounded-lg shadow-lg">
                            <Smartphone className="h-5 w-5 md:h-6 md:w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-primary tracking-tight leading-none">Adicionar Eletrônico</h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Cadastro detalhado de aparelho de cliente</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 md:p-3 bg-gray-50 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all active:scale-95">
                        <XCircleIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Form Content */}
                <div className="p-5 flex-1 overflow-y-auto space-y-6">
                    {/* Toggle Apple/Não Apple */}
                    <div className="bg-gray-50/50 p-4 md:p-5 rounded-lg border border-gray-100 space-y-5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center p-1 bg-gray-100/50 rounded-xl border border-gray-200 w-fit">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProductType('Apple');
                                        setFormData({ ...emptyItem, type: 'Produtos Apple' });
                                    }}
                                    className={`px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-[13px] font-black uppercase tracking-widest transition-all duration-300 ${productType === 'Apple' ? 'bg-gray-800 text-white shadow-lg shadow-gray-900/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`}
                                >
                                    Apple
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProductType('Produto');
                                        setFormData({ ...emptyItem, type: 'Outros', brand: '' });
                                    }}
                                    className={`px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-[13px] font-black uppercase tracking-widest transition-all duration-300 ${productType === 'Produto' ? 'bg-gray-800 text-white shadow-lg shadow-gray-900/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`}
                                >
                                    Variados
                                </button>
                            </div>

                            <p className="text-blue-600 text-[13px] font-medium bg-blue-50/50 border border-blue-100 px-4 py-2 rounded-xl shadow-sm">
                                Para cadastrar Marcas, Categorias, Modelos e Grades, <a href="#/company?tab=marcas" target="_blank" className="font-black underline hover:text-blue-700 transition-colors">clique aqui</a>
                            </p>
                        </div>

                        {/* Hierarchical Filters */}
                        {productType === 'Apple' ? (
                            <div className="space-y-4">
                                <div className={`grid grid-cols-2 ${!isMemoryless ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
                                    <div>
                                        <label className={labelClasses}>Categoria*</label>
                                        <select value={formData.category} onChange={(e) => handleAppleFilterChange('category', e.target.value)} className={inputClasses}>
                                            <option value="">Selecione</option>
                                            {Object.keys(appleProductHierarchy).map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClasses}>Modelo*</label>
                                        <select value={formData.model} onChange={(e) => handleAppleFilterChange('model', e.target.value)} className={inputClasses} disabled={!formData.category}>
                                            <option value="">Selecione</option>
                                            {availableAppleModels.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                    {!isMemoryless && (
                                        <div>
                                            <label className={labelClasses}>Memória*</label>
                                            <select value={formData.storage} onChange={e => handleAppleFilterChange('storage', e.target.value)} className={inputClasses} disabled={!formData.model}>
                                                <option value="">Selecione</option>
                                                {availableAppleMemories.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <div>
                                        <label className={labelClasses}>Cor*</label>
                                        <select value={formData.color} onChange={(e) => handleAppleFilterChange('color', e.target.value)} className={inputClasses} disabled={!formData.model || (!isMemoryless && !formData.storage)}>
                                            <option value="">Selecione</option>
                                            {availableAppleColors.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-start">
                                    <button type="button" onClick={() => setShowVariations(s => !s)} className="text-sm font-semibold text-accent hover:underline flex items-center gap-1">
                                        <PlusIcon className="h-4 w-4" /> Adicionar Variação (Ex: Vitrine, Caixa Amassada)
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className={labelClasses}>Marca*</label>
                                        <select value={formData.brand} onChange={e => { const val = e.target.value; setFormData(prev => ({ ...prev, brand: val, category: '', model: '' })); }} className={inputClasses}>
                                            <option value="">Selecione</option>
                                            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClasses}>Categoria*</label>
                                        <select value={formData.category} onChange={e => { const val = e.target.value; setFormData(prev => ({ ...prev, category: val, model: '' })); }} className={inputClasses} disabled={!formData.brand}>
                                            <option value="">Selecione</option>
                                            {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClasses}>Modelo*</label>
                                        <div className="h-11">
                                            <SearchableDropdown
                                                options={filteredModels.map(m => ({ value: m.id, label: m.name }))}
                                                value={formData.model || null}
                                                onChange={val => setFormData(prev => ({ ...prev, model: val || '' }))}
                                                placeholder="Selecione ou busque..."
                                                disabled={!formData.category}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-start">
                                    <button type="button" onClick={() => setShowVariations(s => !s)} className="text-sm font-semibold text-accent hover:underline flex items-center gap-1">
                                        <PlusIcon className="h-4 w-4" /> Adicionar Variação (Cor, Armazenamento, etc)
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Variations */}
                        {showVariations && (
                            <div className="col-span-full p-6 bg-white border border-gray-100 rounded-lg shadow-sm space-y-4">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">Grades / Variações Adicionais</label>
                                <div className="flex flex-wrap gap-2 my-2">
                                    {formData.variations.map((v, index) => (
                                        <div key={index} className="flex items-center gap-1 bg-gray-200 rounded-lg px-2 py-1 text-sm">
                                            <span className="font-semibold">{v.gradeName}:</span>
                                            <span>{v.valueName}</span>
                                            <button type="button" onClick={() => handleRemoveVariation(index)}><XCircleIcon className="h-4 w-4 text-muted hover:text-danger" /></button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-end gap-3 p-4 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 block">Grade</label>
                                        <select value={currentGradeId} onChange={e => { setCurrentGradeId(e.target.value); setCurrentValueId(''); }} className={inputClasses}>
                                            <option value="">Selecione...</option>
                                            {grades.filter(g => productType === 'Apple' ? g.name.toLowerCase() !== 'cor' : true).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 block">Valor</label>
                                        <select value={currentValueId} onChange={e => setCurrentValueId(e.target.value)} className={inputClasses} disabled={!currentGradeId}>
                                            <option value="">Selecione...</option>
                                            {availableGradeValues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                        </select>
                                    </div>
                                    <button type="button" onClick={handleAddVariation} className="px-3 py-1 bg-accent text-white rounded-md h-9 flex items-center gap-1 text-sm">
                                        <PlusIcon className="h-4 w-4" /> Adicionar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Additional Info (Customer, IMEI, etc) */}
                        <div className="pt-4 border-t border-gray-200">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <label className={labelClasses}>IMEI 1</label>
                                    <input
                                        type="text"
                                        value={formData.imei}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 15);
                                            setFormData(prev => ({ ...prev, imei: val }));
                                        }}
                                        maxLength={15}
                                        className={inputClasses}
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>IMEI 2</label>
                                    <input
                                        type="text"
                                        value={formData.imei2}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 15);
                                            setFormData(prev => ({ ...prev, imei2: val }));
                                        }}
                                        maxLength={15}
                                        className={inputClasses}
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>Número de série</label>
                                    <input
                                        type="text"
                                        value={formData.serialNumber}
                                        onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                                        className={inputClasses}
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>EAN</label>
                                    <input
                                        type="text"
                                        value={formData.ean}
                                        onChange={(e) => setFormData(prev => ({ ...prev, ean: e.target.value }))}
                                        className={inputClasses}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col md:flex-row md:items-end gap-2">
                                <div className="flex-1 md:flex-[2]">
                                    <label className={labelClasses}>Cliente Vinculado</label>
                                    <div className="h-11">
                                        <SearchableDropdown
                                            options={localCustomers.map(c => ({ value: c.id, label: c.name }))}
                                            value={formData.customerId || null}
                                            onChange={val => {
                                                const selected = localCustomers.find(c => c.id === val);
                                                if (selected) {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        customerId: selected.id,
                                                        customerName: selected.name,
                                                        customerCpf: selected.cpf || ''
                                                    }));
                                                } else {
                                                    setFormData(prev => ({ ...prev, customerId: '', customerName: '', customerCpf: '' }));
                                                }
                                            }}
                                            placeholder="Buscar cliente..."
                                            dropDirection="down"
                                        />
                                    </div>
                                </div>
                                <div className="flex-none flex justify-center">
                                    <button
                                        type="button"
                                        onClick={() => setIsCustomerModalOpen(true)}
                                        className="h-11 w-11 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded-xl shadow-lg shadow-green-500/20 transition-all"
                                        title="Cadastrar novo cliente"
                                    >
                                        <PlusIcon className="h-6 w-6" />
                                    </button>
                                </div>
                                <div className="flex-1">
                                    <label className={labelClasses}>CPF do Cliente</label>
                                    <input
                                        type="text"
                                        placeholder="000.000.000-00"
                                        value={formData.customerCpf}
                                        onChange={(e) => setFormData(prev => ({ ...prev, customerCpf: e.target.value }))}
                                        className={inputClasses}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 md:p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100 font-bold transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="px-8 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 font-bold shadow-md shadow-accent/20 transition-all flex items-center gap-2"
                    >
                        Concluir e Salvar
                    </button>
                </div>
            </div>

            {isCustomerModalOpen && (
                <CustomerModal
                    entity={null}
                    initialType="Cliente"
                    onClose={() => setIsCustomerModalOpen(false)}
                    onSave={async (data, type, person) => {
                        try {
                            const newCustomer = await addCustomer({
                                ...data,
                                id: Math.random().toString(36).substr(2, 9),
                            } as any);

                            // Update local form with new customer
                            setFormData(prev => ({
                                ...prev,
                                customerName: newCustomer.name,
                                customerCpf: newCustomer.cpf || ''
                            }));

                            // Add to local list to ensure dropdown displays the name immediately
                            setLocalCustomers(prev => [...prev, newCustomer]);

                            showToast('Cliente cadastrado com sucesso!', 'success');
                            setIsCustomerModalOpen(false);
                        } catch (err: any) {
                            console.error(err);
                            showToast(err.message || 'Erro ao cadastrar cliente.', 'error');
                        }
                    }}
                />
            )}
        </div>,
        document.body
    );
};

export default ServiceOrderElectronicDevicesModal;
