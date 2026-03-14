
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

// --- PERFIL TAB ---
type PerfilFormData = Partial<User> & {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
};

const PerfilTab: React.FC = () => {
    const { user, refreshPermissions, loading, permissions } = useUser();
    const [formData, setFormData] = useState<PerfilFormData>({});
    const photoInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
    const [isPhotoMenuOpen, setIsPhotoMenuOpen] = useState(false);
    const photoMenuRef = useRef<HTMLDivElement>(null);
    const photoButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isPhotoMenuOpen && photoMenuRef.current && !photoMenuRef.current.contains(event.target as Node) && photoButtonRef.current && !photoButtonRef.current.contains(event.target as Node)) {
                setIsPhotoMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isPhotoMenuOpen]);

    useEffect(() => {
        if (user) {
            setFormData(user);
        }
    }, [user]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            address: {
                ...(prev.address || {}),
                [name]: value,
            } as Address,
        }));
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64String = reader.result as string;
                setFormData(prev => ({ ...prev, avatarUrl: base64String }));

                if (user) {
                    try {
                        await updateUser({ ...user, avatarUrl: base64String } as User);
                        refreshPermissions();
                        showToast('Foto de perfil atualizada com sucesso!', 'success');
                    } catch (error) {
                        showToast('Erro ao atualizar a foto de perfil.', 'error');
                    }
                }

                if (photoInputRef.current) {
                    photoInputRef.current.value = '';
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!user) return;
        // FIX: Destructure password fields from formData to avoid type errors.
        const { currentPassword, newPassword, confirmPassword, ...restOfUserData } = formData;

        if (newPassword && newPassword !== confirmPassword) {
            showToast('As novas senhas não coincidem.', 'error');
            return;
        }

        setSaving(true);
        try {
            const dataToSave: Partial<User> = { ...restOfUserData };
            if (newPassword) {
                dataToSave.password = newPassword;
            }

            await updateUser({ ...user, ...dataToSave } as User);

            refreshPermissions();

            showToast('Perfil atualizado com sucesso!', 'success');

            setFormData(prev => {
                const { currentPassword, newPassword, confirmPassword, ...rest } = prev;
                return rest;
            });

        } catch (error) {
            showToast('Erro ao atualizar o perfil.', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <SpinnerIcon />;
    const canEdit = permissions?.canEditOwnProfile;

    const inputClasses = `w-full p-2 border rounded bg-transparent border-border focus:ring-success focus:border-success text-sm h-10 ${!canEdit ? 'bg-gray-100 opacity-70 cursor-not-allowed' : ''}`;
    const labelClasses = "block text-sm font-medium text-primary mb-1";

    return (
        <div>
            <div className="bg-surface rounded-3xl border border-border p-6 space-y-6 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-8">
                    <div className="w-full lg:w-52 flex-shrink-0">
                        <div className="p-4 border border-gray-100 bg-white/50 rounded-2xl text-center sticky top-8 shadow-sm">
                            <h3 className="font-semibold text-primary mb-4">Foto de Perfil</h3>
                            <input type="file" ref={photoInputRef} onChange={handlePhotoChange} className="hidden" accept="image/*" />
                            <div className="relative w-40 h-40 mx-auto">
                                <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                    {formData.avatarUrl ? (
                                        <img src={formData.avatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <UserCircleIcon className="w-32 h-32 text-gray-400" />
                                    )}
                                </div>
                                <button
                                    ref={photoButtonRef}
                                    type="button"
                                    onClick={() => setIsPhotoMenuOpen(p => !p)}
                                    className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full shadow-lg hover:bg-gray-100"
                                    title="Alterar foto"
                                >
                                    <EditIcon className="w-5 h-5 text-primary" />
                                </button>
                                {(isPhotoMenuOpen && canEdit) && (
                                    <div ref={photoMenuRef} className="absolute bottom-0 right-10 mb-2 w-40 bg-white rounded-md shadow-lg border border-border z-10">
                                        <button
                                            type="button"
                                            onClick={() => { photoInputRef.current?.click(); setIsPhotoMenuOpen(false); }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-100"
                                        >
                                            <PhotographIcon className="h-4 w-4" />
                                            Enviar foto
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setIsCameraModalOpen(true); setIsPhotoMenuOpen(false); }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-100"
                                        >
                                            <CameraIcon className="h-4 w-4" />
                                            Tirar foto
                                        </button>
                                    </div>
                                )}
                            </div>
                            {formData.avatarUrl && (
                                <button onClick={async () => {
                                    setFormData(prev => ({ ...prev, avatarUrl: undefined }));
                                    if (photoInputRef.current) photoInputRef.current.value = "";
                                    if (user) {
                                        try {
                                            const updatedUser = { ...user };
                                            delete updatedUser.avatarUrl;
                                            await updateUser(updatedUser);
                                            refreshPermissions();
                                        } catch (e) { }
                                    }
                                }} className="mt-4 text-sm text-danger hover:underline">Remover Foto</button>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 space-y-6">
                        <div className="p-4 border border-gray-100 bg-white/50 rounded-3xl space-y-4 shadow-sm">
                            <h3 className="font-semibold text-primary">Dados Pessoais</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><label className={labelClasses}>Nome</label><input name="name" value={formData.name || ''} onChange={handleInputChange} className={inputClasses} disabled={!canEdit} /></div>
                                <div><label className={labelClasses}>Email</label><input name="email" type="email" value={formData.email || ''} onChange={handleInputChange} className={inputClasses} disabled={!canEdit} /></div>
                            </div>
                        </div>
                        <div className="p-4 border border-gray-100 bg-white/50 rounded-3xl space-y-4 shadow-sm">
                            <h3 className="font-semibold text-primary">Endereço</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <div className="sm:col-span-1"><label className={labelClasses}>CEP</label><input name="zip" value={formData.address?.zip || ''} onChange={handleAddressChange} className={inputClasses} disabled={!canEdit} /></div>
                                <div className="sm:col-span-3"><label className={labelClasses}>Logradouro</label><input name="street" value={formData.address?.street || ''} onChange={handleAddressChange} className={inputClasses} disabled={!canEdit} /></div>
                                <div className="sm:col-span-1"><label className={labelClasses}>Número</label><input name="number" value={formData.address?.number || ''} onChange={handleAddressChange} className={inputClasses} disabled={!canEdit} /></div>
                                <div className="sm:col-span-1"><label className={labelClasses}>Complemento</label><input name="complement" value={formData.address?.complement || ''} onChange={handleAddressChange} className={inputClasses} disabled={!canEdit} /></div>
                                <div className="sm:col-span-2"><label className={labelClasses}>Bairro</label><input name="neighborhood" value={formData.address?.neighborhood || ''} onChange={handleAddressChange} className={inputClasses} disabled={!canEdit} /></div>
                                <div className="sm:col-span-3"><label className={labelClasses}>Cidade</label><input name="city" value={formData.address?.city || ''} onChange={handleAddressChange} className={inputClasses} disabled={!canEdit} /></div>
                                <div className="sm:col-span-1"><label className={labelClasses}>UF</label><input name="state" value={formData.address?.state || ''} onChange={handleAddressChange} className={inputClasses} disabled={!canEdit} /></div>
                            </div>
                        </div>
                        <div className="p-4 border border-gray-100 bg-white/50 rounded-3xl space-y-4 shadow-sm">
                            <h3 className="font-semibold text-primary">Alterar Senha</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div><label className={labelClasses}>Senha Atual</label><input name="currentPassword" type="password" onChange={handleInputChange} value={formData.currentPassword || ''} className={inputClasses} placeholder="••••••••" disabled={!canEdit} /></div>
                                <div><label className={labelClasses}>Nova Senha</label><input name="newPassword" type="password" onChange={handleInputChange} value={formData.newPassword || ''} className={inputClasses} placeholder="••••••••" disabled={!canEdit} /></div>
                                <div><label className={labelClasses}>Confirmar Nova Senha</label><input name="confirmPassword" type="password" onChange={handleInputChange} value={formData.confirmPassword || ''} className={inputClasses} placeholder="••••••••" disabled={!canEdit} /></div>
                            </div>
                        </div>
                    </div>
                </div>
                {canEdit && (
                    <div className="flex justify-end pt-4 border-t mt-6">
                        <Button onClick={handleSave} variant="success" loading={saving} icon={<CheckIcon className="h-5 w-5" />}>Salvar Alterações</Button>
                    </div>
                )}
            </div>
            <CameraModal
                isOpen={isCameraModalOpen}
                onClose={() => setIsCameraModalOpen(false)}
                onCapture={async (imageData) => {
                    setFormData(prev => ({ ...prev, avatarUrl: imageData }));
                    setIsCameraModalOpen(false);
                    if (user) {
                        try {
                            await updateUser({ ...user, avatarUrl: imageData } as User);
                            refreshPermissions();
                            showToast('Foto de perfil atualizada com sucesso!', 'success');
                        } catch (error) {
                            showToast('Erro ao atualizar a foto de perfil.', 'error');
                        }
                    }
                }}
            />
        </div>
    );
};

export default PerfilTab;
