import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { OsPart, formatCurrency, getOsProductConditions, getOsStorageLocations, getOsWarranties } from '../services/mockApi';
import { Supplier, Brand, Category, ProductModel, Grade, GradeValue, ProductConditionParameter, StorageLocationParameter, WarrantyParameter } from '../types';
import { XCircleIcon, PlusIcon, ArchiveBoxIcon } from './icons';
import CurrencyInput from './CurrencyInput';
import SearchableDropdown from './SearchableDropdown';
import CustomerModal from './CustomerModal';

/* ─── Types ─────────────────────────────────────── */

interface ProductVariation {
    gradeId: string;
    gradeName: string;
    valueId: string;
    valueName: string;
}

interface OsPartFormData extends Partial<OsPart> {
    variations?: ProductVariation[];
    additionalCostPrice?: number;
    markup?: number;
    imei1?: string;
    imei2?: string;
    serialNumber?: string;
    barcode?: string;
    condition?: string;
    warranty?: string;
    storageLocation?: string;
}

interface OsPartModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<OsPart>) => Promise<void>;
    part: Partial<OsPart> | null;
    loading: boolean;
    suppliers: Supplier[];
    brands: Brand[];
    categories: Category[];
    productModels: ProductModel[];
    grades: Grade[];
    gradeValues: GradeValue[];
    onSaveNewSupplier?: (supplierData: any) => Promise<Supplier | null>;
}

/* ─── Component ─────────────────────────────────── */

const OsPartModal: React.FC<OsPartModalProps> = ({
    isOpen, onClose, onSave, part, loading,
    suppliers, brands, categories, productModels, grades, gradeValues,
    onSaveNewSupplier,
}) => {
    /* ── state ── */
    const [formData, setFormData] = useState<OsPartFormData>({});
    const [showVariations, setShowVariations] = useState(false);
    const [currentGradeId, setCurrentGradeId] = useState('');
    const [currentValueId, setCurrentValueId] = useState('');
    const [isMinimumStockEnabled, setIsMinimumStockEnabled] = useState(false);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [savingSupplier, setSavingSupplier] = useState(false);

    /* ── dynamic parameters ── */
    const [conditionOptions, setConditionOptions] = useState<ProductConditionParameter[]>([]);
    const [locationOptions, setLocationOptions] = useState<StorageLocationParameter[]>([]);
    const [warrantyOptions, setWarrantyOptions] = useState<WarrantyParameter[]>([]);

    useEffect(() => {
        const fetch = async () => {
            try {
                const [conds, locs, warrs] = await Promise.all([
                    getOsProductConditions(),
                    getOsStorageLocations(),
                    getOsWarranties(),
                ]);
                setConditionOptions(conds);
                setLocationOptions(locs);
                setWarrantyOptions(warrs);
            } catch { /* silent */ }
        };
        fetch();
    }, []);

    /* ── initialize form when part changes ── */
    useEffect(() => {
        if (!isOpen) return;
        if (part) {
            const brandObj = brands.find(b =>
                b.name.toLowerCase() === (part.brand || '').toLowerCase() ||
                b.id === part.brand
            );
            // Tenta com brandObj primeiro, depois busca global
            const categoryObj = (brandObj
                ? categories.find(c => c.brandId === brandObj.id &&
                    (c.name.toLowerCase() === (part.category || '').toLowerCase() || c.id === part.category))
                : undefined)
                || categories.find(c =>
                    c.name.toLowerCase() === (part.category || '').toLowerCase() || c.id === part.category
                );
            // Tenta encontrar o modelo: primeiro limitado à categoria, depois busca global
            const findModel = (models: typeof productModels) => {
                return models.find(m => {
                    if (!part.model && !part.name) return false;
                    const modelStr = (part.model || '').toString();
                    const nameStr = (part.name || '').toString();
                    const mName = m.name.toLowerCase().trim();
                    const pModel = modelStr.toLowerCase().trim();
                    const pName = nameStr.toLowerCase().trim();

                    return m.id === modelStr ||
                        mName === pModel ||
                        (pModel !== '' && pModel.includes(mName) && mName.length > 2) ||
                        (pName !== '' && pName.includes(mName) && mName.length > 2);
                });
            };

            // Tenta primeiro com os modelos da categoria encontrada, depois global
            const scopedModels = categoryObj
                ? productModels.filter(m => m.categoryId === categoryObj.id)
                : [];
            const modelObj = findModel(scopedModels) || findModel(productModels);

            setFormData({
                ...part,
                brand: brandObj?.id || part.brand || '',
                category: categoryObj?.id || part.category || '',
                model: modelObj?.id || (part as any).modelId || '',
                condition: part.condition || 'Novo',
                warranty: part.warranty || '',
                storageLocation: part.storageLocation || '',
                variations: part.variations || [],
                additionalCostPrice: (part as any).additionalCostPrice || 0,
                wholesalePrice: part.wholesalePrice || 0,
                markup: (part as any).markup || 0,
                imei1: (part as any).imei1 || '',
                imei2: (part as any).imei2 || '',
                serialNumber: (part as any).serialNumber || '',
                barcode: part.barcode || '',
            });
            setIsMinimumStockEnabled(!!(part.minimumStock && part.minimumStock > 0));
            setShowVariations(!!((part as any).variations?.length));
        } else {
            setFormData({
                name: '', brand: '', category: '', model: '',
                costPrice: 0, salePrice: 0, additionalCostPrice: 0,
                wholesalePrice: 0, markup: 0,
                stock: 0, minimumStock: 0,
                unit: '', storageLocation: '', supplierId: '',
                observations: '', condition: 'Novo', warranty: '',
                variations: [], imei1: '', imei2: '', serialNumber: '', barcode: '',
            });
            setIsMinimumStockEnabled(false);
            setShowVariations(false);
        }
        setCurrentGradeId('');
        setCurrentValueId('');
    }, [part, isOpen, brands, categories, productModels]);

    /* ── derived lists ── */
    const filteredCategories = useMemo(() =>
        formData.brand ? categories.filter(c => c.brandId === formData.brand) : [],
        [categories, formData.brand]);

    const filteredModels = useMemo(() =>
        formData.category ? productModels.filter(m => m.categoryId === formData.category) : [],
        [productModels, formData.category]);

    const availableGradeValues = useMemo(() =>
        currentGradeId ? gradeValues.filter(v => v.gradeId === currentGradeId) : [],
        [gradeValues, currentGradeId]);

    const totalCost = useMemo(() =>
        (formData.costPrice || 0) + (formData.additionalCostPrice || 0),
        [formData.costPrice, formData.additionalCostPrice]);

    const supplierOptions = useMemo(() =>
        suppliers.map(s => ({ value: s.id, label: s.name })),
        [suppliers]);

    /* ── handlers ── */
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const next = { ...prev, [name]: value };
            if (name === 'brand') { next.category = ''; next.model = ''; }
            if (name === 'category') { next.model = ''; }
            return next;
        });
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(p => ({ ...p, [name]: value === '' ? 0 : parseInt(value, 10) }));
    };

    /* price / markup syncing */
    const updateMarkup = (data: OsPartFormData, updated: 'cost' | 'price' | 'markup') => {
        const cost = (data.costPrice || 0) + (data.additionalCostPrice || 0);
        const next = { ...data };
        if (cost > 0) {
            if (updated === 'markup' && typeof next.markup === 'number') {
                next.salePrice = cost * (1 + next.markup / 100);
            } else if ((updated === 'price' || updated === 'cost') && typeof next.salePrice === 'number') {
                const mk = ((next.salePrice / cost) - 1) * 100;
                next.markup = isFinite(mk) ? parseFloat(mk.toFixed(2)) : 0;
            }
        }
        setFormData(next);
    };

    const handleCostPrice = (val: number | null) => {
        const d = { ...formData, costPrice: val || 0 };
        updateMarkup(d, 'cost');
    };
    const handleAdditionalCost = (val: number | null) => {
        const d = { ...formData, additionalCostPrice: val || 0 };
        updateMarkup(d, 'cost');
    };
    const handleSalePrice = (val: number | null) => {
        const d = { ...formData, salePrice: val || 0 };
        updateMarkup(d, 'price');
    };
    const handleMarkupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const mk = e.target.value === '' ? 0 : parseFloat(e.target.value);
        updateMarkup({ ...formData, markup: mk }, 'markup');
    };

    /* variations */
    const handleAddVariation = () => {
        if (!currentGradeId) return;
        const grade = grades.find(g => g.id === currentGradeId);
        const value = currentValueId ? gradeValues.find(v => v.id === currentValueId) : null;
        if (!grade) return;
        const nv: ProductVariation = {
            gradeId: currentGradeId,
            gradeName: grade.name,
            valueId: currentValueId || '',
            valueName: value ? value.name : '',
        };
        const existing = formData.variations || [];
        const idx = existing.findIndex(v => v.gradeId === nv.gradeId);
        const next = idx > -1 ? existing.map((v, i) => i === idx ? nv : v) : [...existing, nv];
        setFormData(p => ({ ...p, variations: next }));
        setCurrentGradeId('');
        setCurrentValueId('');
    };

    const handleRemoveVariation = (idx: number) =>
        setFormData(p => ({ ...p, variations: p.variations?.filter((_, i) => i !== idx) }));

    /* minimum stock toggle */
    const handleToggleMinimumStock = (checked: boolean) => {
        setIsMinimumStockEnabled(checked);
        if (!checked) setFormData(p => { const { minimumStock, ...rest } = p; return rest; });
        else if (!formData.minimumStock || formData.minimumStock <= 0) setFormData(p => ({ ...p, minimumStock: 1 }));
    };

    /* supplier modal */
    const handleSaveNewSupplier = async (entityData: any) => {
        if (!onSaveNewSupplier) return;
        setSavingSupplier(true);
        try {
            const ns = await onSaveNewSupplier(entityData);
            if (ns) { setFormData(p => ({ ...p, supplierId: ns.id })); setIsSupplierModalOpen(false); }
        } catch { /* silent */ }
        finally { setSavingSupplier(false); }
    };

    /* submit */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const brandObj = brands.find(b => b.id === formData.brand);
        const categoryObj = categories.find(c => c.id === formData.category);
        const modelObj = productModels.find(m => m.id === formData.model);

        const payload: Partial<OsPart> = {
            ...formData,
            brand: brandObj?.name || formData.brand || '',
            category: categoryObj?.name || formData.category || '',
            model: modelObj ? modelObj.name : formData.model || '',
            name: formData.name || (modelObj ? `${categoryObj?.name || ''} ${brandObj?.name || ''} ${modelObj.name}`.trim().replace(/\s+/g, ' ') : ''),
            salePrice: formData.salePrice || 0,
            costPrice: formData.costPrice || 0,
            stock: formData.stock || 0,
            unit: formData.unit || 'Un',
        } as any;

        await onSave(payload);
    };

    /* ── styling ── */
    const labelClasses = 'block text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 px-0.5';
    const inputClasses = 'w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 h-[48px] focus:ring-4 focus:ring-primary/5 outline-none transition-all shadow-sm';

    if (!isOpen) return null;

    /* ─────────────────────────────────────────────── */

    const modal = (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center font-sans md:p-4 animate-fade-in"
            style={{ zIndex: 99999 }}
        >
            <form
                onSubmit={handleSubmit}
                className="bg-white w-full max-w-4xl h-[100dvh] md:h-[90vh] max-h-[100dvh] flex flex-col md:rounded-3xl shadow-2xl overflow-hidden animate-scale-in"
            >
                {/* ── Header (igual ao ProductModal) ── */}
                <div className="flex justify-between items-center p-4 md:p-6 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10 flex-none gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-primary/10 text-primary transform -rotate-2">
                            <ArchiveBoxIcon className="h-5 w-5 md:h-6 md:w-6" />
                        </div>
                        <div>
                            <h2 className="text-lg md:text-2xl font-black text-gray-800 tracking-tight leading-tight">
                                {part?.id ? 'Editar Peça / Insumo' : 'Cadastrar Peça / Insumo'}
                            </h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                Estoque OS — separado do ERP principal
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <a
                            href="/#/company?tab=marcas"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden md:inline-block text-sm font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 hover:bg-blue-100 transition-all whitespace-nowrap"
                        >
                            Para cadastrar marcas/categorias/grades, <span className="underline">clique aqui</span>.
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 md:p-3 bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl md:rounded-2xl transition-all shadow-sm group"
                        >
                            <XCircleIcon className="h-6 w-6 group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </div>

                {/* ── Scrollable body ── */}
                <div className="flex-1 p-4 md:p-6 pt-5 space-y-5 overflow-y-auto pb-28 md:pb-20">

                    {/* ── 1. Nome da peça ── */}
                    <div className="space-y-1.5">
                        <label className={labelClasses}>Nome da Peça / Insumo</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name || ''}
                            onChange={handleChange}
                            className={inputClasses}
                            placeholder="Ex: Tela OLED iPhone 13 Pro, Bateria Samsung S21..."
                        />
                    </div>

                    {/* ── 2. Marca / Categoria / Modelo (3 colunas) ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className={labelClasses}>Marca*</label>
                            <select
                                name="brand"
                                value={formData.brand || ''}
                                onChange={handleChange}
                                className={inputClasses}
                                required
                            >
                                <option value="">Selecione</option>
                                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className={labelClasses}>Categoria*</label>
                            <select
                                name="category"
                                value={formData.category || ''}
                                onChange={handleChange}
                                className={inputClasses}
                                disabled={!formData.brand}
                                required
                            >
                                <option value="">Selecione</option>
                                {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>Modelo*</label>
                            <div className="h-[48px] mt-[14px]">
                                <SearchableDropdown
                                    options={filteredModels.map(m => ({ value: m.id, label: m.name }))}
                                    value={formData.model || null}
                                    onChange={(val) => setFormData(p => ({ ...p, model: val || '' }))}
                                    placeholder="Selecione ou busque..."
                                    disabled={!formData.category}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── 3. Botão Grade e Variação ── */}
                    <button
                        type="button"
                        onClick={() => setShowVariations(!showVariations)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${showVariations ? 'bg-primary text-white' : 'bg-primary/5 text-primary hover:bg-primary/10'}`}
                    >
                        <PlusIcon className="h-4 w-4" />
                        {showVariations ? 'Ocultar Variações' : 'Adicionar Grade e Variação'}
                    </button>

                    {/* variações */}
                    {showVariations && (
                        <div className="p-4 md:p-6 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {formData.variations?.map((v, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-white border border-primary/20 rounded-2xl px-3 py-1.5 shadow-sm">
                                        <span className="text-[10px] font-black text-primary uppercase">{v.gradeName}:</span>
                                        <span className="text-xs font-bold text-gray-700">{v.valueName || 'Padrão'}</span>
                                        <button type="button" onClick={() => handleRemoveVariation(idx)} className="hover:text-red-500 transition-colors">
                                            <XCircleIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase px-1">Grade</label>
                                    <select
                                        value={currentGradeId}
                                        onChange={e => { setCurrentGradeId(e.target.value); setCurrentValueId(''); }}
                                        className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none h-[42px]"
                                    >
                                        <option value="">Selecione...</option>
                                        {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase px-1">Valor</label>
                                    <select
                                        value={currentValueId}
                                        onChange={e => setCurrentValueId(e.target.value)}
                                        className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none h-[42px]"
                                        disabled={!currentGradeId}
                                    >
                                        <option value="">Selecione...</option>
                                        {availableGradeValues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </select>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddVariation}
                                    className="h-[42px] bg-gray-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all"
                                >
                                    Adicionar
                                </button>
                            </div>
                        </div>
                    )}



                    {/* ── 4. Condição / Garantia / Local de Estoque / Unidade / Cód. de Barras ── */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="space-y-2">
                            <label className={labelClasses}>Condição*</label>
                            <select name="condition" value={formData.condition || ''} onChange={handleChange} className={inputClasses}>
                                {formData.condition && !conditionOptions.some(c => c.name.toLowerCase() === formData.condition?.toLowerCase()) && (
                                    <option value={formData.condition}>{formData.condition}</option>
                                )}
                                <option value="Novo">Novo</option>
                                <option value="Seminovo">Seminovo</option>
                                <option value="CPO">CPO</option>
                                <option value="Openbox">Openbox</option>
                                <option value="Reservado">Reservado</option>
                                {conditionOptions
                                    .filter(c => !['Novo', 'Seminovo', 'CPO', 'Openbox', 'Reservado'].includes(c.name))
                                    .map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                                }
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className={labelClasses}>Garantia</label>
                            <select name="warranty" value={formData.warranty || ''} onChange={handleChange} className={inputClasses}>
                                <option value="">Selecione...</option>
                                {formData.warranty && !warrantyOptions.some(w => w.name.toLowerCase() === formData.warranty?.toLowerCase()) && (
                                    <option value={formData.warranty}>{formData.warranty}</option>
                                )}
                                {warrantyOptions.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className={labelClasses}>Local de Estoque</label>
                            <select name="storageLocation" value={formData.storageLocation || ''} onChange={handleChange} className={inputClasses}>
                                <option value="">Selecione...</option>
                                {formData.storageLocation && !locationOptions.some(l => l.name.toLowerCase() === formData.storageLocation?.toLowerCase()) && (
                                    <option value={formData.storageLocation}>{formData.storageLocation}</option>
                                )}
                                {locationOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className={labelClasses}>Unidade / Medida</label>
                            <select
                                name="unit"
                                value={formData.unit || ''}
                                onChange={handleChange}
                                className={inputClasses}
                            >
                                <option value="">Padrão (Un)</option>
                                <option value="Unidade (Un)">Unidade (Un)</option>
                                <option value="Peça (Pc)">Peça (Pc)</option>
                                <option value="Par">Par</option>
                                <option value="Kilo (Kg)">Kilo (Kg)</option>
                                <option value="Metro (Mt)">Metro (Mt)</option>
                                <option value="Caixa (Cx)">Caixa (Cx)</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className={labelClasses}>Cód. de Barras</label>
                            <input
                                type="text"
                                name="barcode"
                                value={formData.barcode || ''}
                                onChange={handleChange}
                                onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                                className={inputClasses}
                            />
                        </div>
                    </div>

                    {/* ── 5. Fornecedor + Qtd. em Estoque + Estoque Mínimo ── */}
                    <div className="flex flex-col md:flex-row gap-4 items-start">
                        {/* Fornecedor ≃ 90% da largura do grid */}
                        <div className="w-full md:w-[55%] space-y-2">
                            <label className={labelClasses}>Fornecedor</label>
                            <div className="flex gap-2">
                                <div className="flex-grow min-w-0">
                                    <div className="h-[48px]">
                                        <SearchableDropdown
                                            options={supplierOptions}
                                            value={formData.supplierId || null}
                                            onChange={(val) => setFormData(p => ({ ...p, supplierId: val || undefined }))}
                                            placeholder="Buscar..."
                                            dropDirection="down"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsSupplierModalOpen(true)}
                                    className="p-3 bg-gray-100 text-gray-500 hover:bg-primary/10 hover:text-primary rounded-xl transition-all shrink-0"
                                >
                                    <PlusIcon className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        {/* Qtd + Estoque Mínimo */}
                        <div className="w-full md:flex-1 flex flex-col gap-2">
                            <label className={labelClasses}>Qtd. em Estoque &amp; Estoque Mínimo</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    name="stock"
                                    min="0"
                                    value={formData.stock ?? 0}
                                    onChange={handleNumberChange}
                                    className="w-24 p-3 bg-white border border-gray-200 rounded-xl text-sm font-black text-gray-800 h-[48px] focus:ring-4 focus:ring-primary/5 outline-none text-center shadow-sm"
                                />
                                {/* Toggle Estoque Mínimo */}
                                <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                                    <input type="checkbox" checked={isMinimumStockEnabled} onChange={e => handleToggleMinimumStock(e.target.checked)} className="hidden" />
                                    <div className={`relative w-11 h-6 rounded-full transition-all duration-200 ${isMinimumStockEnabled ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'bg-gray-200 group-hover:bg-gray-300'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${isMinimumStockEnabled ? 'left-[calc(100%-20px)]' : 'left-1'}`} />
                                    </div>
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Estoque Mínimo</span>
                                </label>
                                {isMinimumStockEnabled && (
                                    <input
                                        type="number"
                                        name="minimumStock"
                                        min="1"
                                        value={formData.minimumStock ?? 1}
                                        onChange={handleNumberChange}
                                        className="w-20 p-3 bg-white border border-gray-200 rounded-xl text-sm font-black text-blue-600 h-[48px] focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none text-center shadow-sm"
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── 7. Bloco de Preços (idêntico ao ProductModal) ── */}
                    <div className="bg-gray-50 rounded-[32px] md:rounded-[40px] p-5 md:p-8 border border-gray-200/50 shadow-inner grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Coluna custo */}
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-1">Custo Entrada</label>
                                <CurrencyInput
                                    value={formData.costPrice}
                                    onChange={handleCostPrice}
                                    className="font-black text-xl md:text-2xl text-gray-800"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Custo Adicional</label>
                                <CurrencyInput
                                    value={formData.additionalCostPrice}
                                    onChange={handleAdditionalCost}
                                    className="font-bold text-lg text-gray-600"
                                />
                            </div>
                        </div>

                        {/* Card Custo Total + Markup */}
                        <div className="bg-white rounded-[24px] md:rounded-[32px] p-5 md:p-6 border border-gray-100 shadow-xl flex flex-col justify-center gap-4 text-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-gray-400">Custo Total</span>
                                <span className="text-2xl font-black text-gray-900 tracking-tight">{formatCurrency(totalCost)}</span>
                            </div>
                            <div className="w-full h-px bg-gray-100" />
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center justify-between w-full px-2">
                                    <span className="text-[10px] font-black uppercase text-gray-400">Markup</span>
                                    <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-black">+{formData.markup ?? 0}%</span>
                                </div>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.markup ?? ''}
                                    onChange={handleMarkupChange}
                                    className="w-20 bg-transparent border-b-2 border-gray-100 text-center text-sm font-bold text-gray-500 focus:border-primary focus:text-primary outline-none transition-colors"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        {/* Coluna preços de venda */}
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-success uppercase tracking-widest px-1">Preço de Venda*</label>
                                <CurrencyInput
                                    value={formData.salePrice}
                                    onChange={handleSalePrice}
                                    className="font-black text-xl md:text-2xl text-success"
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

                    {/* ── 8. Observações ── */}
                    <div className="space-y-2">
                        <label className={labelClasses}>Observações</label>
                        <textarea
                            name="observations"
                            value={formData.observations || ''}
                            onChange={handleChange}
                            rows={3}
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:ring-4 focus:ring-primary/5 outline-none shadow-sm resize-none"
                            placeholder="Informações adicionais: qualidade, compatibilidade, procedência..."
                        />
                    </div>
                </div>

                {/* ── Footer (idêntico ao ProductModal) ── */}
                <div className="flex justify-end items-center gap-4 p-5 md:p-6 border-t border-gray-100 bg-white flex-none">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-10 py-3 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-60 min-w-[160px] flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                                Salvando...
                            </>
                        ) : part?.id ? 'Salvar' : 'Cadastrar'}
                    </button>
                </div>
            </form>

            {/* Novo fornecedor */}
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

    return ReactDOM.createPortal(modal, document.body);
};

export default OsPartModal;
