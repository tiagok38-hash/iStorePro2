
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

interface ParameterManagerProps<T extends { id: string; name: string;[key: string]: any }> {
    permissions: PermissionSet | null;
    title: string;
    items: T[];
    fields: { name: keyof T; label: string; type: 'text' | 'number' }[];
    api: {
        add: (data: Omit<T, 'id'>, userId?: string, userName?: string) => Promise<T>;
        update: (data: T, userId?: string, userName?: string) => Promise<T>;
        del: (id: string, userId?: string, userName?: string) => Promise<void>;
    };
    fetchData: () => void;
}

// --- ItemModal Component (Defined outside to prevent state loss) ---
interface ItemModalProps<T> {
    item: Partial<T> | null;
    fields: { name: keyof T; label: string; type: string }[];
    onSave: (data: Partial<T>) => void;
    onClose: () => void;
    isSaving: boolean;
}

const ItemModal = <T extends { id: string; name: string;[key: string]: any }>({
    item, fields, onSave, onClose, isSaving
}: ItemModalProps<T>) => {
    const [formData, setFormData] = useState<Partial<T>>(item || {});

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-in fade-in duration-300">
            <form
                onSubmit={handleSubmit}
                className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md transform transition-all animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-xl text-primary tracking-tight">
                        {item?.id ? 'Editar' : 'Novo'} Item
                    </h3>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <XCircleIcon className="h-6 w-6 text-gray-400 hover:text-red-500" />
                    </button>
                </div>

                <div className="space-y-4">
                    {fields.map((field, idx) => (
                        <div key={String(field.name)} className="space-y-1.5">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                                {field.label}
                            </label>
                            <input
                                type={field.type}
                                name={String(field.name)}
                                value={(formData as any)[field.name] ?? ''}
                                onChange={handleChange}
                                autoFocus={idx === 0}
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-primary focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all"
                                required
                            />
                        </div>
                    ))}
                </div>

                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <Button
                        type="submit"
                        variant="success"
                        loading={isSaving}
                        className="px-8"
                    >
                        Salvar
                    </Button>
                </div>
            </form>
        </div>
    );
};

const ParameterManager = <T extends { id: string; name: string;[key: string]: any }>({
    permissions,
    title,
    items,
    fields,
    api,
    fetchData,
}: ParameterManagerProps<T>) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<T> | null>(null);
    const [deletingItem, setDeletingItem] = useState<T | null>(null);
    const { showToast } = useToast();
    const { user } = useUser();

    const handleOpenModal = (item: Partial<T> | null = null) => {
        setEditingItem(item || {});
        setModalOpen(true);
    };

    const [saving, setSaving] = useState(false);

    const handleSave = async (itemData: Partial<T>) => {
        setSaving(true);
        try {
            if ('id' in itemData && itemData.id) {
                await api.update(itemData as T, user?.id, user?.name);
                showToast('Item atualizado com sucesso!', 'success');
            } else {
                await api.add(itemData as Omit<T, 'id'>, user?.id, user?.name);
                showToast('Item adicionado com sucesso!', 'success');
            }
            fetchData();
            setModalOpen(false);
            setEditingItem(null);
        } catch (error) {
            showToast('Erro ao salvar item.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingItem) return;
        try {
            await api.del(deletingItem.id, user?.id, user?.name);
            showToast('Item excluído com sucesso!', 'success');
            fetchData();
            setDeletingItem(null);
        } catch (error) {
            showToast('Erro ao excluir item.', 'error');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-100 p-4 rounded-t-2xl">
                <div>
                    <h4 className="text-lg font-semibold text-primary">{title}</h4>
                </div>
                {permissions?.canManageParameters && (
                    <button onClick={() => handleOpenModal()} className="p-2 bg-gray-300 rounded-full hover:bg-gray-400 transition-all active:scale-95">
                        <PlusIcon className="h-5 w-5 text-primary" />
                    </button>
                )}
            </div>
            <div className="border border-gray-200 rounded-b-2xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            {fields.map(field => (
                                <th key={String(field.name)} className="px-4 py-3 font-semibold text-left text-primary">{field.label}</th>
                            ))}
                            <th className="px-4 py-3 font-semibold text-right text-primary">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {items.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                {fields.map(field => (
                                    <td key={String(field.name)} className="px-4 py-3 text-primary">{(item as any)[field.name]}</td>
                                ))}
                                <td className="px-4 py-3">
                                    <div className="flex justify-end items-center gap-2">
                                        {permissions?.canManageParameters && (
                                            <>
                                                <button onClick={() => handleOpenModal(item)} className="p-1.5 hover:bg-primary/10 rounded-lg transition-colors"><EditIcon className="h-5 w-5 text-muted hover:text-primary" /></button>
                                                <button onClick={() => setDeletingItem(item)} className="p-1.5 hover:bg-danger/10 rounded-lg transition-colors"><TrashIcon className="h-5 w-5 text-muted hover:text-danger" /></button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={fields.length + 1} className="px-4 py-8 text-center text-gray-400">Nenhum item cadastrado.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {modalOpen && <ItemModal item={editingItem} fields={fields} onSave={handleSave} onClose={() => { setModalOpen(false); setEditingItem(null); }} isSaving={saving} />}
            <ConfirmationModal isOpen={!!deletingItem} onClose={() => setDeletingItem(null)} onConfirm={handleDelete} title={`Excluir ${deletingItem?.name}`} message="Tem certeza que deseja excluir este item?" />
        </div>
    );
};

const ParametrosTab: React.FC = () => {
    const [activeSubTab, setActiveSubTab] = useState('condicao');
    const [conditions, setConditions] = useState<ProductConditionParameter[]>([]);
    const [locations, setLocations] = useState<StorageLocationParameter[]>([]);
    const [warranties, setWarranties] = useState<WarrantyParameter[]>([]);
    const [receiptTerms, setReceiptTerms] = useState<ReceiptTermParameter[]>([]);
    const [isTermModalOpen, setIsTermModalOpen] = useState(false);
    const [editingTerm, setEditingTerm] = useState<Partial<ReceiptTermParameter> | null>(null);
    const [deletingTerm, setDeletingTerm] = useState<ReceiptTermParameter | null>(null);
    const { showToast } = useToast();
    const { permissions, user } = useUser();

    const fetchData = useCallback(async () => {
        try {
            const [cResult, lResult, wResult, tResult] = await Promise.allSettled([
                getProductConditions(),
                getStorageLocations(),
                getWarranties(),
                getReceiptTerms()
            ]);

            setConditions(cResult.status === 'fulfilled' ? cResult.value : []);
            setLocations(lResult.status === 'fulfilled' ? lResult.value : []);
            setWarranties(wResult.status === 'fulfilled' ? wResult.value : []);
            setReceiptTerms(tResult.status === 'fulfilled' ? tResult.value : []);

            // Log de erros para debug no console se houver falhas
            [cResult, lResult, wResult, tResult].forEach((res, i) => {
                if (res.status === 'rejected') {
                    const names = ['Condições', 'Locais', 'Garantias', 'Termos'];
                    console.error(`Erro ao carregar ${names[i]}:`, res.reason);
                }
            });
        } catch (error) {
            console.error('Erro crítico no fetchData:', error);
            showToast('Erro ao carregar alguns parâmetros.', 'error');
        }
    }, [showToast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleOpenTermModal = (item: Partial<ReceiptTermParameter> | null = null) => {
        setEditingTerm(item || {});
        setIsTermModalOpen(true);
    }
    const [savingTerm, setSavingTerm] = useState(false);

    const handleSaveTerm = async (item: Partial<ReceiptTermParameter>) => {
        setSavingTerm(true);
        try {
            if (item.id) {
                await updateReceiptTerm(item as ReceiptTermParameter, user?.id, user?.name);
                showToast('Termo atualizado!', 'success');
            } else {
                await addReceiptTerm(item as Omit<ReceiptTermParameter, 'id'>, user?.id, user?.name);
                showToast('Termo adicionado!', 'success');
            }
            fetchData();
            setIsTermModalOpen(false);
            setEditingTerm(null);
        } catch (error) {
            showToast('Erro ao salvar termo.', 'error');
        } finally {
            setSavingTerm(false);
        }
    };
    const handleDeleteTerm = async () => {
        if (!deletingTerm) return;
        try {
            await deleteReceiptTerm(deletingTerm.id, user?.id, user?.name);
            showToast('Termo excluído!', 'success');
            fetchData();
            setDeletingTerm(null);
        } catch (error: any) {
            showToast(error.message || 'Erro ao excluir.', 'error');
        }
    };

    const tabClasses = (tabName: string) => `px-5 py-2 rounded-xl text-[10.5px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${activeSubTab === tabName ? 'bg-primary text-white shadow-lg shadow-gray-900/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`;

    return (
        <div className="bg-surface rounded-3xl border border-border p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-sm flex-wrap">
                <button onClick={() => setActiveSubTab('condicao')} className={tabClasses('condicao')}>Condição</button>
                <button onClick={() => setActiveSubTab('local')} className={tabClasses('local')}>Local de estoque</button>
                <button onClick={() => setActiveSubTab('garantia')} className={tabClasses('garantia')}>Garantia</button>
                <button onClick={() => setActiveSubTab('termos')} className={tabClasses('termos')}>Termos de Garantia</button>
            </div>
            {activeSubTab === 'condicao' && <ParameterManager permissions={permissions} title="Condições de Produto" items={conditions} fields={[{ name: 'name', label: 'Nome', type: 'text' }]} api={{ add: addProductCondition, update: updateProductCondition, del: deleteProductCondition }} fetchData={fetchData} />}
            {activeSubTab === 'local' && <ParameterManager permissions={permissions} title="Locais de Estoque" items={locations} fields={[{ name: 'name', label: 'Nome', type: 'text' }]} api={{ add: addStorageLocation, update: updateStorageLocation, del: deleteStorageLocation }} fetchData={fetchData} />}
            {activeSubTab === 'garantia' && <ParameterManager permissions={permissions} title="Garantias" items={warranties} fields={[{ name: 'name', label: 'Nome', type: 'text' }, { name: 'days', label: 'Dias', type: 'number' }]} api={{ add: addWarranty as any, update: updateWarranty as any, del: deleteWarranty as any }} fetchData={fetchData} />}
            {activeSubTab === 'termos' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-gray-100 p-4 rounded-t-2xl">
                        <div>
                            <h4 className="text-lg font-semibold text-primary">Termos de Garantia</h4>
                            <p className="text-sm text-muted">Crie termos personalizados para cada tipo de situação. Ex: Termos para vendas de Apple, Xiaomi, etc.</p>
                        </div>
                        {permissions?.canManageParameters && <button onClick={() => handleOpenTermModal()} className="p-2 bg-gray-300 rounded-full hover:bg-gray-400"><PlusIcon className="h-5 w-5" /></button>}
                    </div>
                    <div className="border border-gray-200 rounded-b-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100"><tr><th className="p-3 font-semibold text-left">Nome</th><th className="p-3 font-semibold text-right">Ações</th></tr></thead>
                            <tbody>
                                {receiptTerms.map(term => (
                                    <tr key={term.id} className="border-t">
                                        <td className="p-3">{term.name}</td>
                                        <td className="p-3"><div className="flex justify-end items-center gap-2">
                                            {permissions?.canManageParameters && (
                                                <>
                                                    <button onClick={() => handleOpenTermModal(term)}><EditIcon className="h-5 w-5 text-muted hover:text-primary" /></button>
                                                    {term.name !== 'Padrão' && <button onClick={() => setDeletingTerm(term)}><TrashIcon className="h-5 w-5 text-muted hover:text-danger" /></button>}
                                                </>
                                            )}
                                        </div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isTermModalOpen && <ReceiptTermModal item={editingTerm} onClose={() => { setIsTermModalOpen(false); setEditingTerm(null); }} onSave={handleSaveTerm} isSaving={savingTerm} />}
            <ConfirmationModal isOpen={!!deletingTerm} onClose={() => setDeletingTerm(null)} onConfirm={handleDeleteTerm} title="Excluir Termo" message={`Deseja excluir o termo "${deletingTerm?.name}"?`} />
        </div>
    );
};

export default ParametrosTab;
