
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Brand, Category, ProductModel, Grade, GradeValue, User, AuditLog, AuditActionType, AuditEntityType, ProductConditionParameter, StorageLocationParameter, WarrantyParameter, PaymentMethodParameter, CardConfigData, Address, PermissionProfile, ReceiptTermParameter, PermissionSet, CompanyInfo, Sale, PurchaseOrder, Product } from '../../types.ts';
import {
    getBrands, addBrand, updateBrand, deleteBrand,
    getCategories, addCategory, updateCategory, deleteCategory,
    getSales, getProducts, getPurchaseOrders,
    getProductModels, addProductModel, updateProductModel, deleteProductModel,
    getGrades, addGrade, updateGrade, deleteGrade,
    getGradeValues, addGradeValue, updateGradeValue, deleteGradeValue,
    getUsers,
    getAuditLogs,
    formatPhone,
    getProductConditions, addProductCondition, updateProductCondition, deleteProductCondition,
    getStorageLocations, addStorageLocation, updateStorageLocation, deleteStorageLocation,
    getWarranties, addWarranty, updateWarranty, deleteWarranty,
    getPaymentMethods, addPaymentMethod, updatePaymentMethod, deletePaymentMethod,
    updateUser, getPermissionProfiles,
    getReceiptTerms, addReceiptTerm, updateReceiptTerm, deleteReceiptTerm,
    getCompanyInfo, updateCompanyInfo,
    getFullBackup, restoreFullBackup
} from '../../services/mockApi.ts';
import { useToast } from '../../contexts/ToastContext.tsx';
import {
    SpinnerIcon, EditIcon, TrashIcon, PlusIcon, ShoppingCartIcon, XCircleIcon,
    CalculatorIcon, ArchiveBoxIcon, CheckIcon, UserCircleIcon, InfoIcon,
    PhotographIcon, CameraIcon, DocumentArrowUpIcon, ErrorIcon
} from '../../components/icons.tsx';
import ConfirmationModal from '../../components/ConfirmationModal.tsx';
import CardConfigModal from '../../components/CardConfigModal.tsx';
import Users from '../Users.tsx';
import SubcategoryModal from '../../components/SubcategoryModal.tsx';
import { useUser } from '../../contexts/UserContext.tsx';
import ReceiptTermModal from '../../components/ReceiptTermModal.tsx';
import CameraModal from '../../components/CameraModal.tsx';
import PaymentMethodModal from '../../components/PaymentMethodModal.tsx';
import Button from '../../components/Button.tsx';
import { toDateValue, formatTimeBR, formatRelativeDate } from '../../utils/dateUtils.ts';
import { compressImage } from '../../utils/imageUtils.ts';
import ImageCropperModal from '../../components/ImageCropperModal.tsx';
import CustomDatePicker from '../../components/CustomDatePicker.tsx';
import LoadingOverlay from '../../components/LoadingOverlay.tsx';
import Comissoes from '../Comissoes.tsx';
import BancoHorasTab from '../BancoHorasTab.tsx';
import GerenciarFuncionariosTab from '../GerenciarFuncionariosTab.tsx';

type ModalType = 'brand' | 'category' | 'model' | 'grade' | 'gradeValue';
type Item = Brand | Category | ProductModel | Grade | GradeValue;

// --- MARCAS E CATEGORIAS (MERGED) TAB ---
const MarcasECategoriasTab: React.FC = () => {
    // State for Marcas, Categorias, Modelos
    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [productModels, setProductModels] = useState<ProductModel[]>([]);
    const [loadingMarcas, setLoadingMarcas] = useState(false);
    const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [marcasModal, setMarcasModal] = useState<{ type: 'brand' | 'category'; item: Partial<Item> | null } | null>(null);
    const [marcasItemToDelete, setMarcasItemToDelete] = useState<{ type: ModalType; item: Item } | null>(null);
    const [isSubcategoryModalOpen, setIsSubcategoryModalOpen] = useState(false);
    const [subcategoryModalItem, setSubcategoryModalItem] = useState<Partial<ProductModel> | null>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const [editingPhotoModelId, setEditingPhotoModelId] = useState<string | null>(null);
    const [isPhotoOptionsOpen, setIsPhotoOptionsOpen] = useState(false);
    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
    const [isCropperModalOpen, setIsCropperModalOpen] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [modelSearchTerm, setModelSearchTerm] = useState('');

    // State for Grades
    const [grades, setGrades] = useState<Grade[]>([]);
    const [gradeValues, setGradeValues] = useState<GradeValue[]>([]);
    const [loadingGrades, setLoadingGrades] = useState(false);
    const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
    const [gradesModal, setGradesModal] = useState<{ type: 'grade' | 'gradeValue', item: Partial<Item> | null } | null>(null);
    const [gradesItemToDelete, setGradesItemToDelete] = useState<{ type: 'grade' | 'gradeValue', item: Item } | null>(null);

    const { showToast } = useToast();
    const { user, permissions } = useUser();
    const canManage = permissions?.canManageMarcasECategorias;

    const fetchData = useCallback(async () => {
        setLoadingMarcas(true);
        setLoadingGrades(true);
        try {
            const [b, c, m, g, gv] = await Promise.all([
                getBrands(), getCategories(), getProductModels(),
                getGrades(), getGradeValues()
            ]);
            setBrands(b); setCategories(c); setProductModels(m);
            setGrades(g); setGradeValues(gv);
        } catch (error) { showToast('Erro ao carregar dados.', 'error'); }
        finally { setLoadingMarcas(false); setLoadingGrades(false); }
    }, [showToast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Memoized filters
    const filteredCategories = useMemo(() => categories.filter(c => c.brandId === selectedBrandId), [categories, selectedBrandId]);
    const filteredModels = useMemo(() => {
        let filtered = productModels.filter(m => m.categoryId === selectedCategoryId);
        if (modelSearchTerm.trim()) {
            const searchLower = modelSearchTerm.toLowerCase().trim();
            filtered = filtered.filter(m => m.name.toLowerCase().includes(searchLower));
        }
        return filtered;
    }, [productModels, selectedCategoryId, modelSearchTerm]);
    const filteredGradeValues = useMemo(() => gradeValues.filter(v => v.gradeId === selectedGradeId), [gradeValues, selectedGradeId]);

    // Handlers for Marcas, Categorias
    const handleSelectBrand = (brandId: string) => { setSelectedBrandId(brandId); setSelectedCategoryId(null); };
    const handleOpenMarcasModal = (type: 'brand' | 'category', item: Partial<Item> | null = null) => setMarcasModal({ type, item });
    const handleSaveMarcas = async (type: 'brand' | 'category', item: Partial<Item>) => {
        setLoadingMarcas(true);
        try {
            if (item.id) {
                if (type === 'brand') await updateBrand(item as Brand, user?.id, user?.name);
                else if (type === 'category') await updateCategory(item as Category, user?.id, user?.name);
            } else {
                if (type === 'brand') await addBrand(item as Omit<Brand, 'id'>, user?.id, user?.name);
                else if (type === 'category') await addCategory({ ...item, brandId: selectedBrandId! } as Omit<Category, 'id'>, user?.id, user?.name);
            }
            const typeName = type === 'brand' ? 'Marca' : type === 'category' ? 'Categoria' : 'Subcategoria';
            showToast(`${typeName} salva com sucesso!`, 'success');
            fetchData();
            window.dispatchEvent(new Event('company-data-updated'));
            const bc = new BroadcastChannel('app-updates'); bc.postMessage('company-data-updated'); bc.close();
        } catch (e) {
            const typeName = type === 'brand' ? 'marca' : type === 'category' ? 'categoria' : 'subcategoria';
            showToast(`Erro ao salvar ${typeName}.`, 'error');
        }
        finally { setLoadingMarcas(false); setMarcasModal(null); }
    };
    const handleDeleteMarcas = async () => {
        if (!marcasItemToDelete) return;
        setLoadingMarcas(true);
        try {
            if (marcasItemToDelete.type === 'brand') await deleteBrand(marcasItemToDelete.item.id, user?.id, user?.name);
            else if (marcasItemToDelete.type === 'category') await deleteCategory(marcasItemToDelete.item.id, user?.id, user?.name);
            else if (marcasItemToDelete.type === 'model') await deleteProductModel(marcasItemToDelete.item.id, user?.id, user?.name);

            const typeName = marcasItemToDelete.type === 'brand' ? 'Marca' : marcasItemToDelete.type === 'category' ? 'Categoria' : 'Subcategoria';
            showToast(`${typeName} excluída com sucesso!`, 'success');

            fetchData();
            window.dispatchEvent(new Event('company-data-updated'));
            const bc = new BroadcastChannel('app-updates'); bc.postMessage('company-data-updated'); bc.close();
        } catch (e) {
            const typeName = marcasItemToDelete.type === 'brand' ? 'marca' : marcasItemToDelete.type === 'category' ? 'categoria' : 'subcategoria';
            showToast(`Erro ao excluir ${typeName}.`, 'error');
        }
        finally { setLoadingMarcas(false); setMarcasItemToDelete(null); }
    };

    // Handlers for Subcategorias/Modelos
    const handleOpenSubcategoryModal = (item: Partial<ProductModel> | null) => {
        setSubcategoryModalItem(item);
        setIsSubcategoryModalOpen(true);
    };

    const handleSaveSubcategory = async (item: Partial<ProductModel>) => {
        setLoadingMarcas(true);
        try {
            if (item.id) {
                await updateProductModel(item as ProductModel, user?.id, user?.name);
            } else {
                await addProductModel({ ...item, categoryId: selectedCategoryId! } as Omit<ProductModel, 'id'>, user?.id, user?.name);
            }
            showToast('Subcategoria salva com sucesso!', 'success');
            fetchData();
            window.dispatchEvent(new Event('company-data-updated'));
            const bc = new BroadcastChannel('app-updates'); bc.postMessage('company-data-updated'); bc.close();
        } catch (e) { showToast(`Erro ao salvar subcategoria.`, 'error'); }
        finally { setLoadingMarcas(false); setIsSubcategoryModalOpen(false); setSubcategoryModalItem(null); }
    };

    const handlePhotoIconClick = (modelId: string) => {
        setEditingPhotoModelId(modelId);
        setIsPhotoOptionsOpen(true);
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && editingPhotoModelId) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                setPreviewImageUrl(event.target?.result as string);
                setIsCropperModalOpen(true);
                setIsPhotoOptionsOpen(false);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCapturePhoto = (imageData: string) => {
        setPreviewImageUrl(imageData);
        setIsCameraModalOpen(false);
        setIsCropperModalOpen(true);
    };

    const handleCropSave = async (croppedBase64: string) => {
        if (!editingPhotoModelId) return;
        try {
            setLoadingMarcas(true);
            const modelToUpdate = productModels.find(m => m.id === editingPhotoModelId);
            if (modelToUpdate) {
                await updateProductModel({ ...modelToUpdate, imageUrl: croppedBase64 }, user?.id, user?.name);
                showToast('Foto atualizada com sucesso!', 'success');
                await fetchData();
                window.dispatchEvent(new Event('company-data-updated'));
                const bc = new BroadcastChannel('app-updates');
                bc.postMessage('company-data-updated');
                bc.close();
            }
        } catch (error) {
            showToast('Erro ao salvar a foto.', 'error');
        } finally {
            setLoadingMarcas(false);
            setIsCropperModalOpen(false);
            setPreviewImageUrl(null);
            setEditingPhotoModelId(null);
        }
    };

    const handleRemovePhoto = async () => {
        if (!editingPhotoModelId) return;
        try {
            setLoadingMarcas(true);
            const modelToUpdate = productModels.find(m => m.id === editingPhotoModelId);
            if (modelToUpdate) {
                await updateProductModel({ ...modelToUpdate, imageUrl: null }, user?.id, user?.name);
                showToast('Foto removida!', 'success');
                await fetchData();
                window.dispatchEvent(new Event('company-data-updated'));
                const bc = new BroadcastChannel('app-updates');
                bc.postMessage('company-data-updated');
                bc.close();
            }
        } catch (error) {
            showToast('Erro ao remover a foto.', 'error');
        } finally {
            setLoadingMarcas(false);
            setIsPhotoOptionsOpen(false);
            setEditingPhotoModelId(null);
        }
    };

    // Handlers for Grades
    const handleSaveGrades = async (type: 'grade' | 'gradeValue', item: Partial<Item>) => {
        setLoadingGrades(true);
        try {
            if (item.id) {
                if (type === 'grade') await updateGrade(item as Grade, user?.id, user?.name);
                else await updateGradeValue(item as GradeValue, user?.id, user?.name);
            } else {
                if (type === 'grade') await addGrade(item as Omit<Grade, 'id'>, user?.id, user?.name);
                else await addGradeValue({ ...item, gradeId: selectedGradeId! } as Omit<GradeValue, 'id'>, user?.id, user?.name);
            }
            const typeName = type === 'grade' ? 'Grupo de Grade' : 'Valor da Grade';
            showToast(`${typeName} salvo com sucesso!`, 'success');
            fetchData();
            window.dispatchEvent(new Event('company-data-updated'));
            const bc = new BroadcastChannel('app-updates'); bc.postMessage('company-data-updated'); bc.close();
        } catch (e) {
            const typeName = type === 'grade' ? 'grupo de grade' : 'valor da grade';
            showToast(`Erro ao salvar ${typeName}.`, 'error');
        }
        finally { setLoadingGrades(false); setGradesModal(null); }
    };
    const handleDeleteGrades = async () => {
        if (!gradesItemToDelete) return;
        setLoadingGrades(true);
        try {
            if (gradesItemToDelete.type === 'grade') await deleteGrade(gradesItemToDelete.item.id, user?.id, user?.name);
            else await deleteGradeValue(gradesItemToDelete.item.id, user?.id, user?.name);

            const typeName = gradesItemToDelete.type === 'grade' ? 'Grupo de Grade' : 'Valor da Grade';
            showToast(`${typeName} excluído com sucesso!`, 'success');

            fetchData();
            window.dispatchEvent(new Event('company-data-updated'));
            const bc = new BroadcastChannel('app-updates'); bc.postMessage('company-data-updated'); bc.close();
        } catch (e) {
            const typeName = gradesItemToDelete.type === 'grade' ? 'grupo de grade' : 'valor da grade';
            showToast(`Erro ao excluir ${typeName}.`, 'error');
        }
        finally { setLoadingGrades(false); setGradesItemToDelete(null); }
    };

    // Generic list renderer
    const renderList = (title: string, items: Item[], type: ModalType, onSelect: ((id: string) => void) | null, selectedId: string | null, onAdd: () => void, disabled: boolean = false, searchTerm?: string, onSearchChange?: (val: string) => void) => (
        <div className={`p-0 border border-gray-100 bg-white/50 rounded-3xl overflow-hidden flex flex-col h-full shadow-sm ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex justify-between items-center p-3 bg-gray-50/50 border-b border-gray-100 backdrop-blur-sm">
                <h3 className="font-semibold text-primary">{title}</h3>
                {canManage && (
                    <button onClick={onAdd} disabled={disabled} className="p-1 text-success disabled:text-muted"><PlusIcon className="h-5 w-5" /></button>
                )}
            </div>
            {onSearchChange !== undefined && (
                <div className="px-3 py-2 border-b border-gray-100 bg-white/50">
                    <input
                        type="text"
                        placeholder={`Buscar ${title.toLowerCase()}...`}
                        value={searchTerm || ''}
                        onChange={e => onSearchChange(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-shadow"
                    />
                </div>
            )}
            <ul className="h-64 overflow-y-auto custom-scrollbar">
                {items.length === 0 ? (
                    <li className="p-8 text-center text-xs text-muted italic">Nenhum item encontrado</li>
                ) : items.map(item => (
                    <li
                        key={item.id}
                        onClick={() => onSelect && onSelect(item.id)}
                        className={`flex justify-between items-center p-2.5 transition-all border-b border-gray-100/50 last:border-0 ${onSelect ? 'cursor-pointer' : ''} ${selectedId === item.id ? 'bg-[#7B61FF]/10 text-primary font-bold shadow-inner' : (onSelect ? 'hover:bg-white/40' : '')}`}
                    >
                        <div className="flex items-center gap-3 flex-grow min-w-0">
                            {type === 'model' && (item as ProductModel).imageUrl ? (
                                <img src={(item as ProductModel).imageUrl} alt={item.name} className="h-9 w-9 rounded-xl object-cover flex-shrink-0 shadow-sm border border-white/50" />
                            ) : type === 'model' ? (
                                <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 border border-dashed border-gray-300">
                                    <PhotographIcon className="h-4 w-4 text-gray-400" />
                                </div>
                            ) : null}
                            <span className="truncate text-sm">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {type === 'model' && canManage && (
                                <button onClick={(e) => { e.stopPropagation(); handlePhotoIconClick(item.id); }} className="p-1.5 rounded-xl hover:bg-white/60 text-muted hover:text-primary transition-colors" title="Foto do Modelo"><PhotographIcon className="h-4 w-4" /></button>
                            )}
                            {canManage && (
                                <>
                                    <button onClick={(e) => { e.stopPropagation(); type.includes('grade') ? setGradesModal({ type, item } as any) : (type === 'model' ? handleOpenSubcategoryModal(item) : handleOpenMarcasModal(type as any, item)); }} className="p-1.5 rounded-xl hover:bg-white/60 text-muted hover:text-primary transition-colors" title="Editar"><EditIcon className="h-4 w-4" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); type.includes('grade') ? setGradesItemToDelete({ type, item } as any) : setMarcasItemToDelete({ type, item }); }} className="p-1.5 rounded-xl hover:bg-red-50 text-muted hover:text-danger transition-colors" title="Excluir"><TrashIcon className="h-4 w-4" /></button>
                                </>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );

    return (
        <div className="space-y-8">
            <input type="file" ref={photoInputRef} onChange={handlePhotoChange} className="hidden" accept="image/*" />
            <div className="bg-surface rounded-3xl border border-border p-6 shadow-sm">
                <h3 className="font-semibold text-lg text-primary mb-4">Marcas, Categorias e Subcategorias</h3>
                {loadingMarcas ? (
                    <div className="p-12 glass-panel border border-white/20 rounded-xl flex justify-center"><SpinnerIcon /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr] gap-4">
                        {renderList('Marcas', brands, 'brand', handleSelectBrand, selectedBrandId, () => handleOpenMarcasModal('brand'), false)}
                        {renderList('Categorias', filteredCategories, 'category', (id) => setSelectedCategoryId(id), selectedCategoryId, () => handleOpenMarcasModal('category'), !selectedBrandId)}
                        {renderList('Modelos', filteredModels, 'model', () => { }, null, () => handleOpenSubcategoryModal(null), !selectedCategoryId, modelSearchTerm, setModelSearchTerm)}
                    </div>
                )}
            </div>

            <div className="bg-surface rounded-3xl border border-border p-6 shadow-sm">
                <h3 className="font-semibold text-lg text-primary mb-4">Grades e Variações</h3>
                {loadingGrades ? (
                    <div className="p-12 glass-panel border border-white/20 rounded-xl flex justify-center"><SpinnerIcon /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderList('Grades (Ex: Cor, Armazenamento)', grades, 'grade', (id) => setSelectedGradeId(id), selectedGradeId, () => setGradesModal({ type: 'grade', item: null }), false)}
                        {renderList('Valores da Grade (Ex: Azul, 256GB)', filteredGradeValues, 'gradeValue', null, null, () => setGradesModal({ type: 'gradeValue', item: null }), !selectedGradeId)}
                    </div>
                )}
            </div>

            {marcasModal && <ManagementModal type={marcasModal.type} item={marcasModal.item} onSave={handleSaveMarcas} onClose={() => setMarcasModal(null)} loading={loadingMarcas} />}
            <ConfirmationModal isOpen={!!marcasItemToDelete} onClose={() => setMarcasItemToDelete(null)} onConfirm={handleDeleteMarcas} title={`Excluir ${marcasItemToDelete?.type}`} message={`Tem certeza que deseja excluir "${marcasItemToDelete?.item.name}"? A exclusão em cascata pode remover itens associados.`} />

            {isSubcategoryModalOpen && (
                <SubcategoryModal
                    item={subcategoryModalItem}
                    brandName={brands.find(b => b.id === selectedBrandId)?.name || ''}
                    categoryName={categories.find(c => c.id === selectedCategoryId)?.name || ''}
                    onSave={handleSaveSubcategory}
                    onClose={() => { setIsSubcategoryModalOpen(false); setSubcategoryModalItem(null); }}
                    isSaving={loadingMarcas}
                />
            )}

            {gradesModal && <ManagementModal type={gradesModal.type} item={gradesModal.item} onSave={handleSaveGrades} onClose={() => setGradesModal(null)} loading={loadingGrades} />}
            <ConfirmationModal isOpen={!!gradesItemToDelete} onClose={() => setGradesItemToDelete(null)} onConfirm={handleDeleteGrades} title={`Excluir ${gradesItemToDelete?.type}`} message={`Tem certeza que deseja excluir "${gradesItemToDelete?.item.name}"?`} />

            <PhotoOptionsModal
                isOpen={isPhotoOptionsOpen}
                onClose={() => { setIsPhotoOptionsOpen(false); setEditingPhotoModelId(null); }}
                onTakePhoto={() => { setIsCameraModalOpen(true); setIsPhotoOptionsOpen(false); }}
                onUploadPhoto={() => photoInputRef.current?.click()}
                onRemovePhoto={handleRemovePhoto}
                hasPhoto={!!productModels.find(m => m.id === editingPhotoModelId)?.imageUrl}
            />

            <CameraModal
                isOpen={isCameraModalOpen}
                onClose={() => setIsCameraModalOpen(false)}
                onCapture={handleCapturePhoto}
            />

            <ImageCropperModal
                isOpen={isCropperModalOpen}
                imageUrl={previewImageUrl}
                onClose={() => setIsCropperModalOpen(false)}
                onCrop={handleCropSave}
                aspectRatio={1}
            />
        </div>
    );
};

interface ManagementModalProps {
    type: ModalType;
    item: Partial<Item> | null;
    onSave: (type: ModalType, item: Partial<Item>) => void;
    onClose: () => void;
    loading?: boolean;
}
const ManagementModal: React.FC<ManagementModalProps> = ({ type, item, onSave, onClose, loading }) => {
    const [name, setName] = useState(item?.name || '');
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(type, { ...item, name }); };
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <form onSubmit={handleSubmit} className="bg-surface rounded-3xl shadow-2xl p-6 w-full max-w-sm animate-scale-in border border-border">
                <h3 className="font-bold text-lg mb-4">{item?.id ? 'Editar' : 'Adicionar'} {type === 'gradeValue' ? 'Valor da Grade' : type}</h3>
                <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full p-2 border rounded bg-transparent border-border mb-4"
                    autoFocus
                    required
                />
                <div className="flex justify-end gap-2">
                    <Button type="button" onClick={onClose} variant="secondary">Cancelar</Button>
                    <Button type="submit" variant="success" loading={loading}>Salvar</Button>
                </div>
            </form>
        </div>
    );
};

const PhotoOptionsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onTakePhoto: () => void;
    onUploadPhoto: () => void;
    onRemovePhoto: () => void;
    hasPhoto: boolean;
}> = ({ isOpen, onClose, onTakePhoto, onUploadPhoto, onRemovePhoto, hasPhoto }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto backdrop-blur-sm">
            <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in animate-scale-in border border-border">
                <div className="p-4 border-b border-white/20 flex justify-between items-center bg-white/30 backdrop-blur-md">
                    <h3 className="font-semibold text-primary">Opções da Foto</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <XCircleIcon className="h-6 w-6 text-muted" />
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    <button onClick={onTakePhoto} className="w-full flex items-center justify-center gap-3 p-4 rounded-xl border border-border hover:bg-gray-50 transition-all font-medium text-primary shadow-sm hover:shadow-md">
                        <CameraIcon className="h-6 w-6 text-accent" />
                        Tirar Foto
                    </button>
                    <button onClick={onUploadPhoto} className="w-full flex items-center justify-center gap-3 p-4 rounded-xl border border-border hover:bg-gray-50 transition-all font-medium text-primary shadow-sm hover:shadow-md">
                        <DocumentArrowUpIcon className="h-6 w-6 text-success" />
                        Fazer Upload
                    </button>
                    {hasPhoto && (
                        <button onClick={onRemovePhoto} className="w-full flex items-center justify-center gap-3 p-4 rounded-xl border border-danger/10 text-danger hover:bg-danger/5 transition-all font-medium">
                            <TrashIcon className="h-6 w-6" />
                            Remover Foto
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MarcasECategoriasTab;
