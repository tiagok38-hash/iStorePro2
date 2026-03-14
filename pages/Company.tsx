
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Brand, Category, ProductModel, Grade, GradeValue, User, AuditLog, AuditActionType, AuditEntityType, ProductConditionParameter, StorageLocationParameter, WarrantyParameter, PaymentMethodParameter, CardConfigData, Address, PermissionProfile, ReceiptTermParameter, PermissionSet, CompanyInfo, Sale, PurchaseOrder, Product } from '../types.ts';
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
} from '../services/mockApi.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import {
    SpinnerIcon, EditIcon, TrashIcon, PlusIcon, ShoppingCartIcon, XCircleIcon,
    CalculatorIcon, ArchiveBoxIcon, CheckIcon, UserCircleIcon, InfoIcon,
    PhotographIcon, CameraIcon, DocumentArrowUpIcon, ErrorIcon
} from '../components/icons.tsx';
import ConfirmationModal from '../components/ConfirmationModal.tsx';
import CardConfigModal from '../components/CardConfigModal.tsx';
import Users from './Users.tsx';
import SubcategoryModal from '../components/SubcategoryModal.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import ReceiptTermModal from '../components/ReceiptTermModal.tsx';
import CameraModal from '../components/CameraModal.tsx';
import PaymentMethodModal from '../components/PaymentMethodModal.tsx';
import Button from '../components/Button.tsx';
import { toDateValue, formatTimeBR, formatRelativeDate } from '../utils/dateUtils.ts';
import { compressImage } from '../utils/imageUtils.ts';
import ImageCropperModal from '../components/ImageCropperModal.tsx';
import CustomDatePicker from '../components/CustomDatePicker.tsx';
import LoadingOverlay from '../components/LoadingOverlay.tsx';
import Comissoes from './Comissoes.tsx';
import BancoHorasTab from './BancoHorasTab.tsx';
import GerenciarFuncionariosTab from './GerenciarFuncionariosTab.tsx';

// Import Tabs
import DadosEmpresaTab from './Company/DadosEmpresaTab';
import MarcasECategoriasTab from './Company/MarcasECategoriasTab';
import AuditoriaTab from './Company/AuditoriaTab';
import BackupRestauracaoTab from './Company/BackupRestauracaoTab';
import ParametrosTab from './Company/ParametrosTab';
import MeiosDePagamentoTab from './Company/MeiosDePagamentoTab';
import PerfilTab from './Company/PerfilTab';
import FuncionariosTab from './Company/FuncionariosTab';

// --- MAIN COMPONENT ---
const Company: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const { permissions, user } = useUser();
    const activeTab = searchParams.get('tab') || 'dados';

    const allTabs = useMemo(() => [
        { id: 'dados', label: 'Dados da Empresa', permission: 'canManageCompanyData' },
        { id: 'usuarios', label: 'Usuários e Permissões', permission: 'canManageUsers' },
        { id: 'marcas', label: 'Marcas e Categorias', permission: 'canManageMarcasECategorias' },
        { id: 'perfil', label: 'Perfil', permission: 'canEditOwnProfile' },
        { id: 'funcionarios', label: 'Funcionários', permission: 'canManageEmployees' },
        { id: 'parametros', label: 'Parâmetros', permission: 'canManageParameters' },
        { id: 'meios_pagamento', label: 'Meios de Pagamento', permission: 'canManagePaymentMethods' },
        { id: 'auditoria', label: 'Auditoria', permission: 'canViewAudit' },
        { id: 'backup', label: 'Backup e Restauração', permission: 'canManageBackups' },
    ], []);

    const visibleTabs = useMemo(() => {
        if (!permissions) return allTabs.filter(t => t.id === 'perfil'); // Only show profile while loading
        return allTabs.filter(tab => {
            if (tab.permission === true) return true;
            if (tab.id === 'usuarios') return permissions.canManageUsers || permissions.canManagePermissions;
            if (tab.id === 'funcionarios') return permissions.canManageEmployees || permissions.canAccessComissoes || permissions.canManageBancoHoras;
            return permissions[tab.permission as keyof PermissionSet];
        });
    }, [permissions, allTabs]);

    useEffect(() => {
        if (visibleTabs.length > 0 && !visibleTabs.find(t => t.id === activeTab)) {
            setSearchParams({ tab: visibleTabs[0].id });
        }
    }, [visibleTabs, activeTab, setSearchParams]);

    const renderContent = () => {
        if (!visibleTabs.find(t => t.id === activeTab)) {
            return <div className="text-center p-8 text-muted">Acesso negado.</div>;
        }

        let content;
        switch (activeTab) {
            case 'dados': content = <DadosEmpresaTab />; break;
            case 'usuarios': content = <Users />; break;
            case 'marcas': content = <MarcasECategoriasTab />; break;
            case 'parametros': content = <ParametrosTab />; break;
            case 'meios_pagamento': content = <MeiosDePagamentoTab />; break;
            case 'auditoria': content = <AuditoriaTab />; break;
            case 'backup': content = <BackupRestauracaoTab />; break;
            case 'perfil': content = <PerfilTab />; break;
            case 'funcionarios': content = <FuncionariosTab />; break;
            default: content = <DadosEmpresaTab />; break;
        }

        if (activeTab === 'usuarios') {
            return content;
        }

        if (activeTab === 'marcas') {
            return <div className="max-w-7xl">{content}</div>;
        }

        if (activeTab === 'comissoes' || activeTab === 'funcionarios') {
            return <div className="w-full">{content}</div>;
        }

        return <div className="max-w-5xl">{content}</div>;
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-primary">Empresa</h1>
            <div className="flex flex-wrap items-center gap-1 bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-sm">
                {visibleTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setSearchParams({ tab: tab.id })}
                        className={`px-7 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 flex-grow md:flex-grow-0 text-center ${activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-gray-900/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            {renderContent()}
        </div>
    );
};


export default Company;
