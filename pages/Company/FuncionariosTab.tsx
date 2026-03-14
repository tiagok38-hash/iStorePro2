
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

// --- FUNCIONARIOS TAB (Wrapper for Comissoes and Banco de Horas) ---
const FuncionariosTab: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const { permissions } = useUser();
    const activeSubTab = searchParams.get('subtab') || 'comissoes';

    const subTabs = useMemo(() => [
        { id: 'gerencia', label: 'Gerenciar Funcionários', permission: 'canManageEmployees' },
        { id: 'banco_horas', label: 'Banco de Horas', permission: 'canManageBancoHoras' },
        { id: 'comissoes', label: 'Comissões', permission: 'canAccessComissoes' },
    ], []);

    const visibleSubTabs = useMemo(() => {
        if (!permissions) return [];
        return subTabs.filter(tab => permissions[tab.permission as keyof PermissionSet]);
    }, [permissions, subTabs]);

    useEffect(() => {
        if (visibleSubTabs.length > 0 && !visibleSubTabs.find(t => t.id === activeSubTab)) {
            setSearchParams(prev => {
                const newParams = new URLSearchParams(prev);
                newParams.set('subtab', visibleSubTabs[0].id);
                return newParams;
            }, { replace: true });
        }
    }, [visibleSubTabs, activeSubTab, setSearchParams]);

    const renderSubContent = () => {
        switch (activeSubTab) {
            case 'gerencia': return <GerenciarFuncionariosTab />;
            case 'comissoes': return <Comissoes />;
            case 'banco_horas': return <BancoHorasTab />;
            default: return <GerenciarFuncionariosTab />;
        }
    };

    if (visibleSubTabs.length === 0) return <div className="p-8 text-center text-muted">Acesso negado.</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-1 bg-gray-50 p-1.5 rounded-2xl border border-gray-200 w-fit shadow-sm">
                {visibleSubTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setSearchParams(prev => {
                            const newParams = new URLSearchParams(prev);
                            newParams.set('subtab', tab.id);
                            return newParams;
                        }, { replace: true })}
                        className={`px-8 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${activeSubTab === tab.id ? 'bg-primary text-white shadow-md shadow-gray-900/10' : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="w-full">
                {renderSubContent()}
            </div>
        </div>
    );
};

export default FuncionariosTab;
