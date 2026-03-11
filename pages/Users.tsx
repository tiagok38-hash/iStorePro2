
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, PermissionProfile, PermissionSet } from '../types.ts';
import { getUsers, getPermissionProfiles, deleteUser, deletePermissionProfile, formatPhone, addUser, updateUser, addPermissionProfile, updatePermissionProfile } from '../services/mockApi.ts';
import { SpinnerIcon, PlayCircleIcon, LockClosedIcon, TrashIcon, EditIcon, UserGroupIcon, UserPlusIcon, CheckIcon } from '../components/icons.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import { useSidebar } from '../contexts/SidebarContext.tsx';
import ConfirmationModal from '../components/ConfirmationModal.tsx';
import Button from '../components/Button.tsx';

// --- PermissionProfileModal (Premium Granular Design) ---

import {
    Squares2x2Icon, ArchiveBoxIcon, ShoppingCartIcon, CashRegisterIcon, ChartBarIcon,
    UsersIcon as UsersGroupIcon, BuildingOffice2Icon, WrenchIcon, WalletIcon,
    DocumentTextIcon, ReceiptIcon
} from '../components/icons.tsx';

// Icon map for section cards
const sectionIcons: Record<string, React.ReactElement> = {
    'Dashboard': <Squares2x2Icon className="h-5 w-5" />,
    'Estoque': <ArchiveBoxIcon className="h-5 w-5" />,
    'Compras': <ShoppingCartIcon className="h-5 w-5" />,
    'Vendas': <ShoppingCartIcon className="h-5 w-5" />,
    'Orçamentos': <DocumentTextIcon className="h-5 w-5" />,
    'Catálogo Digital': <ShoppingCartIcon className="h-5 w-5" />,
    'PDV (Frente de Caixa)': <CashRegisterIcon className="h-5 w-5" />,
    'Clientes': <UsersGroupIcon className="h-5 w-5" />,
    'Fornecedores': <UsersGroupIcon className="h-5 w-5" />,
    'Ordem de Serviço': <WrenchIcon className="h-5 w-5" />,
    'CRM (Gestão de Leads)': <UsersGroupIcon className="h-5 w-5" />,
    'Relatórios': <ChartBarIcon className="h-5 w-5" />,
    'Financeiro': <WalletIcon className="h-5 w-5" />,
    'Fiscal': <ReceiptIcon className="h-5 w-5" />,
    'Empresa': <BuildingOffice2Icon className="h-5 w-5" />,
    'Comissões': <WalletIcon className="h-5 w-5" />,
};

const permissionSections: {
    title: string;
    sectionToggleKey?: keyof PermissionSet;
    isComingSoon?: boolean;
    permissions: { key: keyof PermissionSet; label: string }[];
}[] = [
        {
            title: 'Acessos e seções simples',
            permissions: [
                { key: 'canAccessDashboard', label: 'Dashboard' },
                { key: 'canAccessRelatorios', label: 'Relatórios' },
            ],
        },
        {
            title: 'Estoque',
            sectionToggleKey: 'canAccessEstoque',
            permissions: [
                { key: 'canCreateProduct', label: 'Criar/Lançar Novos Produtos' },
                { key: 'canEditProduct', label: 'Editar Produtos' },
                { key: 'canDeleteProduct', label: 'Excluir Produtos' },
                { key: 'canEditStock', label: 'Ajustes Manuais de Estoque' },
                { key: 'canCompareStock', label: 'Comparar Estoques (Conferência)' },
                { key: 'canAccessStockMovement', label: 'Movimentação de Estoque' },
                { key: 'canGenerateLabels', label: 'Gerar Etiquetas' },
                { key: 'canBulkUpdatePrices', label: 'Atualizar Preços em Massa' },
                { key: 'canBulkUpdateLocations', label: 'Atualizar Locais em Massa' },
            ],
        },
        {
            title: 'Compras',
            sectionToggleKey: 'canViewPurchases',
            permissions: [
                { key: 'canCreatePurchase', label: 'Criar Novas Compras' },
                { key: 'canEditPurchase', label: 'Editar Compras' },
                { key: 'canDeletePurchase', label: 'Excluir Compras' },
                { key: 'canLaunchPurchase', label: 'Lançar Compras no Estoque' },
                { key: 'canViewPurchaseKPIs', label: 'Indicadores de Compras (KPIs)' },
            ],
        },
        {
            title: 'Vendas',
            sectionToggleKey: 'canAccessVendas',
            permissions: [
                { key: 'canCreateSale', label: 'Realizar Novas Vendas' },
                { key: 'canEditSale', label: 'Editar Venda' },
                { key: 'canCancelSale', label: 'Cancelar Vendas' },
                { key: 'canViewSalesKPIs', label: 'Indicadores de Vendas (KPIs)' },
                { key: 'canViewSaleProfit', label: 'Visualizar Lucro' },
                { key: 'canViewAllSales', label: 'Ver Todas as Vendas (Off = Só Minhas)' },
            ],
        },
        {
            title: 'Orçamentos',
            sectionToggleKey: 'canAccessOrcamentos' as keyof PermissionSet,
            permissions: [
                { key: 'orcamentoCanCreate', label: 'Criar orçamentos' },
                { key: 'orcamentoCanEdit', label: 'Editar orçamentos' },
                { key: 'orcamentoCanDelete', label: 'Excluir orçamentos' },
                { key: 'orcamentoCanConvert', label: 'Converter orçamento em venda' },
            ],
        },
        {
            title: 'Catálogo Digital',
            sectionToggleKey: 'canAccessCatalog',
            permissions: [
                { key: 'canCreateCatalogItem', label: 'Adicionar Itens' },
                { key: 'canEditCatalogItem', label: 'Editar Itens' },
                { key: 'canDeleteCatalogItem', label: 'Excluir Itens' },
                { key: 'canViewCatalogStats', label: 'Ver Estatísticas' },
            ],
        },
        {
            title: 'PDV (Frente de Caixa)',
            sectionToggleKey: 'canAccessPOS',
            permissions: [
                { key: 'posCanCreateSale', label: 'Criar vendas' },
                { key: 'posCanEditSale', label: 'Editar vendas' },
                { key: 'posCanCancelSale', label: 'Cancelar vendas' }
            ],
        },
        {
            title: 'Clientes',
            sectionToggleKey: 'canAccessClientes',
            permissions: [
                { key: 'canCreateCustomer', label: 'Criar Clientes' },
                { key: 'canEditCustomer', label: 'Editar Clientes' },
                { key: 'canViewCustomerHistory', label: 'Histórico de Clientes' },
                { key: 'canInactivateCustomer', label: 'Inativar/Reativar Clientes' },
                { key: 'canDeleteCustomer', label: 'Excluir Clientes' },
                { key: 'canCreateCrmDeal', label: 'Criar Leads' },
                { key: 'canEditCrmDeal', label: 'Editar Leads' },
                { key: 'canDeleteCrmDeal', label: 'Excluir Leads' },
                { key: 'canMoveCrmDeal', label: 'Mover Cards (Drag & Drop)' },
                { key: 'canViewAllCrmDeals', label: 'Ver Todos os Leads (Off = Só Meus)' },
            ],
        },
        {
            title: 'Fornecedores',
            sectionToggleKey: 'canAccessFornecedores',
            permissions: [
                { key: 'canCreateSupplier', label: 'Criar Fornecedores' },
                { key: 'canEditSupplier', label: 'Editar Fornecedores' },
                { key: 'canViewSupplierHistory', label: 'Histórico de Fornecedores' },
                { key: 'canDeleteSupplier', label: 'Excluir Fornecedores' },
            ],
        },
        {
            title: 'Ordem de Serviço',
            sectionToggleKey: 'canAccessServiceOrders',
            permissions: [
                { key: 'canCreateServiceOrder', label: 'Criar Nova OS' },
                { key: 'canEditServiceOrder', label: 'Editar OS' },
                { key: 'canDeleteServiceOrder', label: 'Cancelar OS' },
                { key: 'canManageServiceOrderStatus', label: 'Alterar Status da OS' },
                { key: 'osCanAccessDashboard', label: 'Dashboard' },
                { key: 'osCanAccessCustomers', label: 'Acessar Clientes' },
                { key: 'osCanAccessSuppliers', label: 'Acessar Fornecedores' },
                { key: 'osCanCreatePurchases', label: 'Cadastrar Novas Compras' },
                { key: 'osCanEditParts', label: 'Editar Peças/Insumos' },
                { key: 'osCanDeleteParts', label: 'Excluir Peças/Insumos' },
                { key: 'osCanAccessElectronics', label: 'Acessar Eletrônicos Cadastrados' },
                { key: 'osCanChangeStock', label: 'Alterar Quantidade Estoque' },
                { key: 'osCanAccessFinance', label: 'Acessar Financeiro' },
                { key: 'osCanAccessReports', label: 'Acessar Relatórios' },
                { key: 'osCanAccessFiscal', label: 'Acessar Fiscal (Em breve)' },
                { key: 'osCanAccessSettings', label: 'Acessar Configurações' },
                { key: 'canViewServiceOrderProfit', label: 'Visualizar Lucro' },
                { key: 'osCanViewStockStats', label: 'Estatísticas de Estoque OS' },
            ],
        },

        {
            title: 'Financeiro',
            sectionToggleKey: 'canAccessFinanceiro',
            permissions: [
                { key: 'canCreateTransaction', label: 'Criar Receitas/Despesas' },
                { key: 'canEditTransaction', label: 'Editar Transações' },
                { key: 'canDeleteTransaction', label: 'Excluir Transações' },
                { key: 'canViewFinancialKPIs', label: 'Indicadores Financeiros' },
            ],
        },
        {
            title: 'Fiscal',
            isComingSoon: true,
            permissions: [],
        },
        {
            title: 'Comissões',
            sectionToggleKey: 'canAccessComissoes',
            permissions: [
                { key: 'canViewOwnCommission', label: 'Ver Próprias Comissões' },
                { key: 'canViewAllCommissions', label: 'Ver Comissões de Todos' },
                { key: 'canCloseCommissionPeriod', label: 'Fechar Período de Comissão' },
                { key: 'canMarkCommissionPaid', label: 'Marcar como Paga' },
                { key: 'canEditProductCommissionSettings', label: 'Config. Comissão em Produtos' },
            ],
        },
        {
            title: 'Empresa',
            sectionToggleKey: 'canAccessEmpresa',
            permissions: [
                { key: 'canManageCompanyData', label: 'Gerenciar Dados da Empresa' },
                { key: 'canManageEmployees', label: 'Gerenciar Funcionários' },
                { key: 'canManageUsers', label: 'Gerenciar Usuários' },
                { key: 'canManagePermissions', label: 'Gerenciar Perfis de Permissão' },
                { key: 'canManageMarcasECategorias', label: 'Gerenciar Marcas e Categorias' },
                { key: 'canManageParameters', label: 'Gerenciar Parâmetros' },
                { key: 'canManagePaymentMethods', label: 'Gerenciar Meios de Pagamento' },
                { key: 'canManageBackups', label: 'Backup e Restauração' },
                { key: 'canViewAudit', label: 'Log de Auditoria' },
                { key: 'canManageBancoHoras', label: 'Gerenciar Banco de Horas' },
                { key: 'canCreateBancoHoras', label: 'Criar Banco de Horas' },
                { key: 'canPayBancoHoras', label: 'Pagar Banco de Horas' },
                { key: 'canEditOwnProfile', label: 'Editar Próprio Perfil' },
            ],
        },
    ];

// Also keep a flat list reference for backwards compat
const permissionGroups = permissionSections;

// --- Reusable Lilac Toggle (cor #7B61FF = sidebar) ---
const LilacToggle: React.FC<{
    checked: boolean;
    onChange: (val: boolean) => void;
    disabled?: boolean;
    size?: 'sm' | 'md';
    ariaLabel?: string;
}> = ({ checked, onChange, disabled = false, size = 'sm', ariaLabel }) => {
    const isOn = checked && !disabled;
    const isMd = size === 'md';

    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
            className={`relative inline-flex items-center rounded-full transition-all duration-150 flex-shrink-0 focus:outline-none ${isMd ? 'h-[26px] w-[46px]' : 'h-[22px] w-[40px]'
                } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                } ${isOn ? 'bg-[#7B61FF]' : 'bg-gray-300'
                }`}
        >
            <span
                className={`inline-block rounded-full bg-white shadow-sm transition-transform duration-150 ${isMd ? 'h-[20px] w-[20px]' : 'h-[16px] w-[16px]'
                    } ${isOn
                        ? (isMd ? 'translate-x-[23px]' : 'translate-x-[20px]')
                        : 'translate-x-[3px]'
                    }`}
            />
        </button>
    );
};

// --- Section Card Component ---
const PermissionSectionCard: React.FC<{
    section: typeof permissionSections[0];
    permissions: PermissionSet;
    onPermissionChange: (key: keyof PermissionSet, value: boolean) => void;
    onSectionToggle: (key: keyof PermissionSet, value: boolean) => void;
}> = ({ section, permissions, onPermissionChange, onSectionToggle }) => {
    const isSectionOn = section.sectionToggleKey ? !!permissions[section.sectionToggleKey] : true;
    const isComingSoon = section.isComingSoon;
    const hasSubPermissions = section.permissions.length > 0;

    const icon = sectionIcons[section.title] || <ArchiveBoxIcon className="h-5 w-5" />;

    const handleSectionToggle = (val: boolean) => {
        if (isComingSoon || !section.sectionToggleKey) return;
        onSectionToggle(section.sectionToggleKey, val);
        // When turning OFF, also turn off all sub-permissions
        if (!val) {
            section.permissions.forEach(p => onPermissionChange(p.key, false));
        }
    };

    return (
        <div
            className={`rounded-2xl border transition-all duration-200 ${isComingSoon
                ? 'opacity-[0.45] border-gray-200 bg-gray-50/80'
                : isSectionOn || !section.sectionToggleKey
                    ? 'border-[#7B61FF]/15 bg-white shadow-sm'
                    : 'border-gray-100 bg-white'
                }`}
        >
            {/* Section Header */}
            <div
                className={`flex items-center justify-between px-4 py-2.5 select-none rounded-t-2xl transition-colors duration-200 ${section.sectionToggleKey ? 'cursor-pointer' : ''} ${isSectionOn && section.sectionToggleKey ? 'bg-[#7B61FF]/5' : 'bg-transparent'}`}
                onClick={() => {
                    if (!isComingSoon && section.sectionToggleKey) {
                        handleSectionToggle(!isSectionOn);
                    }
                }}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`flex-shrink-0 transition-colors duration-200 ${isComingSoon ? 'text-gray-300' : isSectionOn ? 'text-[#7B61FF]' : 'text-gray-300'}`}>
                        {React.cloneElement(icon, { className: 'h-[18px] w-[18px]' })}
                    </div>
                    <span className={`font-bold text-[14px] transition-colors duration-200 truncate ${isComingSoon ? 'text-gray-400' : isSectionOn ? 'text-gray-800' : 'text-gray-400'}`}>
                        {section.title}
                    </span>
                    {isComingSoon && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 border border-gray-300 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            Em Breve
                        </span>
                    )}
                </div>
                {section.sectionToggleKey && (
                    <LilacToggle
                        checked={isSectionOn}
                        onChange={handleSectionToggle}
                        disabled={isComingSoon || !section.sectionToggleKey}
                        size="md"
                        ariaLabel={`Ativar/desativar ${section.title}`}
                    />
                )}
            </div>

            {/* Sub-permissions */}
            {hasSubPermissions && !isComingSoon && (
                <div
                    className="overflow-hidden transition-all duration-200 ease-out"
                    style={{
                        maxHeight: isSectionOn ? `${Math.ceil(section.permissions.length / 2) * 40 + 24}px` : '0px',
                        opacity: isSectionOn ? 1 : 0,
                    }}
                >
                    <div className="mx-4 border-t border-gray-100" />
                    <div className="px-4 py-2 grid grid-cols-2 gap-x-4 gap-y-0">
                        {section.permissions.map(perm => (
                            <div
                                key={perm.key}
                                className="flex items-center justify-between py-[7px]"
                            >
                                <span className="text-[12.5px] text-gray-600 pr-2 leading-tight">
                                    {perm.label}
                                </span>
                                <LilacToggle
                                    checked={!!permissions[perm.key]}
                                    onChange={(val) => onPermissionChange(perm.key, val)}
                                    ariaLabel={perm.label}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


const PermissionProfileModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (profile: Omit<PermissionProfile, 'id'> | PermissionProfile) => Promise<void>;
    profile: Partial<PermissionProfile> | null;
}> = ({ isOpen, onClose, onSave, profile }) => {
    const { isCollapsed } = useSidebar();
    const [name, setName] = useState('');
    const [permissions, setPermissions] = useState<PermissionSet>({} as PermissionSet);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        // Build defaults from ALL permission keys across all sections
        const defaults: Record<string, boolean> = {};
        permissionSections.forEach(section => {
            if (section.sectionToggleKey) {
                defaults[section.sectionToggleKey] = false;
            }
            section.permissions.forEach(p => { defaults[p.key] = false; });
        });

        if (profile) {
            setName(profile.name || '');
            setPermissions({ ...defaults, ...(profile.permissions || {}) } as PermissionSet);
        } else {
            setName('');
            setPermissions(defaults as unknown as PermissionSet);
        }
    }, [profile]);

    const handlePermissionChange = (key: keyof PermissionSet, value: boolean) => {
        setPermissions(prev => ({ ...prev, [key]: value }));
    };

    const handleSectionToggle = (key: keyof PermissionSet, value: boolean) => {
        setPermissions(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onSave({ ...profile, name, permissions });
        setIsSaving(false);
    };

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-start p-2 sm:p-4 overflow-y-auto animate-fade-in transition-all duration-300 ${!isCollapsed ? 'lg:pl-72' : 'lg:pl-24'}`}>
            <div className="bg-[#FAFAFA] rounded-2xl shadow-2xl w-full max-w-6xl my-2 sm:my-6 flex flex-col border border-gray-200 animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-gray-100 bg-white rounded-t-2xl">
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 -ml-1"
                        title="Voltar"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="text-center flex-1 px-4">
                        <h2 className="text-base sm:text-lg font-bold text-gray-800">
                            {profile?.id ? 'Editar' : 'Novo'} Perfil de Permissão
                        </h2>
                        <p className="text-[11px] text-gray-400">Ative ou desative módulos e permissões individuais</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !name.trim()}
                        className="text-[#7B61FF] font-bold text-sm hover:text-[#6350d4] transition-colors disabled:opacity-40"
                    >
                        {isSaving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>

                {/* Profile Name */}
                <div className="px-5 sm:px-6 pt-4 pb-2">
                    <label className="block text-[12px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">Nome do Perfil</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ex: Vendedor, Gerente, Administrador..."
                        className="w-full max-w-md px-3.5 py-2 border border-gray-200 rounded-xl text-[14px] text-gray-800 bg-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7B61FF]/20 focus:border-[#7B61FF]/40 transition-all"
                    />
                </div>

                {/* Section Cards - 2 columns */}
                <div className="flex-1 px-5 sm:px-6 py-3 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                        {permissionSections.map(section => (
                            <PermissionSectionCard
                                key={section.title}
                                section={section}
                                permissions={permissions}
                                onPermissionChange={handlePermissionChange}
                                onSectionToggle={handleSectionToggle}
                            />
                        ))}
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="px-5 sm:px-6 py-3.5 border-t border-gray-100 bg-white rounded-b-2xl flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-[13px] font-medium text-gray-500 hover:text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-all"
                    >
                        Cancelar
                    </button>
                    <Button
                        onClick={handleSave}
                        variant="success"
                        loading={isSaving}
                        icon={<CheckIcon className="h-4 w-4" />}
                        className="!bg-[#7B61FF] hover:!bg-[#6a53e6] !rounded-lg !py-2 !px-5 !font-semibold !text-[13px]"
                    >
                        Salvar Alterações
                    </Button>
                </div>
            </div>
        </div>
    );
};

// --- UserModal ---
const UserModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (user: Omit<User, 'id' | 'createdAt'> | User) => Promise<void>;
    user: Partial<User> | null;
    profiles: PermissionProfile[];
}> = ({ isOpen, onClose, onSave, user, profiles }) => {
    const { isCollapsed } = useSidebar();
    const [formData, setFormData] = useState<Partial<User>>({});
    const [isSaving, setIsSaving] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        setFormData(user || {});
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (!formData.name || !formData.email || !formData.permissionProfileId) {
            showToast('Preencha os campos obrigatórios.', 'warning');
            return;
        }
        if (!user?.id && !formData.password) {
            showToast('A senha é obrigatória para novos usuários.', 'warning');
            return;
        }

        setIsSaving(true);
        // Clean up empty password if editing so we don't overwrite with empty string
        const dataToSave = { ...formData };
        if (user?.id && !dataToSave.password) {
            delete dataToSave.password;
        }

        await onSave(dataToSave as User);
        setIsSaving(false);
    };

    if (!isOpen) return null;

    const inputClasses = "w-full px-3 py-2 border rounded-xl bg-surface text-primary border-border focus:ring-1 focus:ring-success focus:border-success";

    return (
        <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 transition-all duration-300 ${!isCollapsed ? 'lg:pl-72' : 'lg:pl-24'}`}>
            <div className="bg-surface p-6 rounded-3xl shadow-xl w-full max-w-lg border border-border">
                <h2 className="text-xl font-bold mb-4">{user?.id ? 'Editar' : 'Novo'} Usuário</h2>
                <div className="space-y-4">
                    <div><label className="block text-sm font-medium">Nome*</label><input type="text" name="name" value={formData.name || ''} onChange={handleChange} className={inputClasses} required /></div>
                    <div><label className="block text-sm font-medium">Email (Login)*</label><input type="email" name="email" value={formData.email || ''} onChange={handleChange} className={inputClasses} required /></div>
                    <div>
                        <label className="block text-sm font-medium">Senha {user?.id && '(Deixe em branco para manter)'}*</label>
                        <input type="password" name="password" value={formData.password || ''} onChange={handleChange} className={inputClasses} placeholder={user?.id ? "••••••••" : "Senha obrigatória"} />
                    </div>
                    <div><label className="block text-sm font-medium">Telefone</label><input type="text" name="phone" value={formData.phone || ''} onChange={e => setFormData(p => ({ ...p, phone: formatPhone(e.target.value) }))} className={inputClasses} /></div>
                    <div><label className="block text-sm font-medium">Perfil de Permissão*</label><select name="permissionProfileId" value={formData.permissionProfileId || ''} onChange={handleChange} className={inputClasses} required><option value="">Selecione um perfil</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                </div>
                <div className="flex justify-end gap-4 mt-6">
                    <Button onClick={onClose} variant="secondary">Cancelar</Button>
                    <Button onClick={handleSave} variant="success" loading={isSaving} icon={<CheckIcon className="h-5 w-5" />}>
                        Salvar
                    </Button>
                </div>
            </div>
        </div>
    );
};


const Users: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();
    const { refreshPermissions, user: loggedInUser } = useUser();

    // Modal States
    const [userModalOpen, setUserModalOpen] = useState(false);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
    const [editingProfile, setEditingProfile] = useState<Partial<PermissionProfile> | null>(null);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const [deletingProfile, setDeletingProfile] = useState<PermissionProfile | null>(null);
    const [showInactive, setShowInactive] = useState(false);

    const fetchData = useCallback(async (retryCount = 0) => {
        setLoading(true);
        try {
            const [usersData, profilesData] = await Promise.all([getUsers(), getPermissionProfiles()]);
            setUsers(usersData);
            setProfiles(profilesData);
        } catch (error) {
            console.error('Users: Error loading data:', error);

            // Auto-retry once after short delay (handles reconnection issues after idle)
            if (retryCount < 1) {
                setTimeout(() => fetchData(retryCount + 1), 2000);
                return;
            }

            showToast('Erro ao carregar usuários e perfis.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const profileMap = useMemo(() => profiles.reduce((acc, profile) => {
        acc[profile.id] = profile.name;
        return acc;
    }, {} as Record<string, string>), [profiles]);

    // Handlers for Users
    const handleAddUser = () => { setEditingUser({}); setUserModalOpen(true); };
    const handleEditUser = (user: User) => { setEditingUser(user); setUserModalOpen(true); };
    const handleSaveUser = async (userData: Omit<User, 'id' | 'createdAt'> | User) => {
        try {
            if ('id' in userData && userData.id) {
                await updateUser(userData as User);
                showToast('Usuário atualizado com sucesso!', 'success');
                if (loggedInUser && userData.id === loggedInUser.id) {
                    refreshPermissions();
                }
            } else {
                await addUser(userData as Omit<User, 'id' | 'createdAt'>);
                showToast('Usuário criado com sucesso!', 'success');
            }
            fetchData();
            setUserModalOpen(false);
            setEditingUser(null);
        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Erro ao salvar usuário.', 'error');
        }
    };
    const handleDeleteUser = (user: User) => setDeletingUser(user);
    const confirmDeleteUser = async () => {
        if (!deletingUser) return;
        try {
            await deleteUser(deletingUser.id, loggedInUser?.id, loggedInUser?.name);
            showToast('Usuário inativado com sucesso!', 'success');
            fetchData();
        } catch (error) { showToast('Erro ao inativar usuário.', 'error'); }
        finally { setDeletingUser(null); }
    };
    const handleReactivateUser = async (user: User) => {
        try {
            await updateUser({ ...user, active: true });
            showToast('Usuário reativado com sucesso!', 'success');
            fetchData();
            if (loggedInUser && user.id === loggedInUser.id) {
                refreshPermissions();
            }
        } catch (error) { showToast('Erro ao reativar usuário.', 'error'); }
    };

    // Handlers for Profiles
    const handleAddProfile = () => { setEditingProfile({}); setProfileModalOpen(true); };
    const handleEditProfile = (profile: PermissionProfile) => { setEditingProfile(profile); setProfileModalOpen(true); };
    const handleSaveProfile = async (profileData: Omit<PermissionProfile, 'id'> | PermissionProfile) => {
        try {
            let savedProfile: PermissionProfile;
            if ('id' in profileData && profileData.id) {
                savedProfile = await updatePermissionProfile(profileData as PermissionProfile);
                showToast('Perfil atualizado com sucesso!', 'success');
            } else {
                savedProfile = await addPermissionProfile(profileData as Omit<PermissionProfile, 'id'>);
                showToast('Perfil criado com sucesso!', 'success');
            }

            if (loggedInUser && savedProfile.id === loggedInUser.permissionProfileId) {
                refreshPermissions();
            }

            fetchData();
            setProfileModalOpen(false);
            setEditingProfile(null);
        } catch (error: any) {
            console.error(error);
            showToast(typeof error === 'string' ? error : (error.message || 'Erro ao salvar perfil.'), 'error');
        }
    };
    const handleDeleteProfile = (profile: PermissionProfile) => setDeletingProfile(profile);
    const confirmDeleteProfile = async () => {
        if (!deletingProfile) return;
        try {
            await deletePermissionProfile(deletingProfile.id);
            showToast('Perfil excluído com sucesso!', 'success');
            fetchData();
        } catch (error: any) { showToast(error.message || 'Erro ao excluir perfil.', 'error'); }
        finally { setDeletingProfile(null); }
    };

    if (loading) return <div className="flex justify-center items-center h-full"><SpinnerIcon /></div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-primary">Cadastre usuários e perfis de permissões</h1>
                <button className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl font-semibold text-sm hover:bg-red-100">
                    <PlayCircleIcon className="h-5 w-5" />
                    Assistir Tutorial
                </button>
            </div>

            <div className="w-full lg:max-w-5xl space-y-8">
                {/* Users Section */}
                <div className="bg-surface rounded-3xl border border-border p-6 space-y-4 shadow-sm">
                    <div className="flex justify-between items-center flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-secondary">Mostrar inativos</span>
                            <button
                                type="button"
                                onClick={() => setShowInactive(!showInactive)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${showInactive ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'bg-gray-300'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showInactive ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                        <button onClick={handleAddUser} className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:bg-opacity-90">
                            <UserPlusIcon className="h-5 w-5" />
                            Novo Usuário
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-secondary uppercase bg-surface-secondary rounded-t-2xl">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Login do Usuário</th>
                                    <th className="px-4 py-3 font-medium">Nome</th>
                                    <th className="px-4 py-3 font-medium">Telefone</th>
                                    <th className="px-4 py-3 font-medium">Permissão</th>
                                    <th className="px-4 py-3 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="text-primary">
                                {users.filter(u => showInactive ? true : u.active !== false).map(user => (
                                    <tr key={user.id} className={`border-t border-border ${user.active === false ? 'opacity-50 grayscale' : ''}`}>
                                        <td className="px-4 py-3">{user.email} {user.active === false && <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Inativo</span>}</td>
                                        <td className="px-4 py-3">{user.name}</td>
                                        <td className="px-4 py-3">{formatPhone(user.phone)}</td>
                                        <td className="px-4 py-3">{profileMap[user.permissionProfileId] || 'N/A'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-3">
                                                <button onClick={() => handleEditUser(user)} title="Editar Usuário" className="text-muted hover:text-primary"><LockClosedIcon /></button>
                                                {user.active === false ? (
                                                    <button onClick={() => handleReactivateUser(user)} title="Reativar Usuário" className="text-emerald-600 bg-emerald-50 rounded-full p-1 hover:bg-emerald-100 flex items-center gap-1 text-xs px-2"><CheckIcon className="h-3 w-3" /> Reativar</button>
                                                ) : (
                                                    <button onClick={() => handleDeleteUser(user)} title="Inativar Usuário" className="text-on-primary bg-danger rounded-full p-0.5 hover:bg-opacity-80"><TrashIcon className="h-4 w-4" /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Permission Profiles Section */}
                <div className="bg-surface rounded-3xl border border-border p-6 space-y-4 shadow-sm">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-lg font-bold text-primary">Perfil de permissões para usuários</h2>
                            <p className="text-sm text-muted">Crie perfis de permissões para seus colaboradores e defina quais permissões cada perfil terá acesso.</p>
                        </div>
                        <button onClick={handleAddProfile} className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:bg-opacity-90">
                            <UserGroupIcon className="h-5 w-5" />
                            Criar perfil
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-secondary uppercase bg-surface-secondary rounded-t-2xl">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Nome do Perfil</th>
                                    <th className="px-4 py-3 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="text-primary">
                                {profiles.map(profile => (
                                    <tr key={profile.id} className="border-t border-border">
                                        <td className="px-4 py-3">{profile.name}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-3">
                                                <button onClick={() => handleEditProfile(profile)} title="Editar Perfil" className="text-muted hover:text-primary"><EditIcon /></button>
                                                <button onClick={() => handleDeleteProfile(profile)} title="Excluir Perfil" className="text-on-primary bg-danger rounded-full p-0.5 hover:bg-opacity-80"><TrashIcon className="h-4 w-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <UserModal isOpen={userModalOpen} user={editingUser} profiles={profiles} onClose={() => { setUserModalOpen(false); setEditingUser(null); }} onSave={handleSaveUser} />
            <PermissionProfileModal isOpen={profileModalOpen} profile={editingProfile} onClose={() => { setProfileModalOpen(false); setEditingProfile(null); }} onSave={handleSaveProfile} />

            <ConfirmationModal
                isOpen={!!deletingUser}
                onClose={() => setDeletingUser(null)}
                onConfirm={confirmDeleteUser}
                title="Inativar Usuário"
                message={`Tem certeza que deseja inativar o usuário "${deletingUser?.name}"? Ele não terá mais acesso de login ao sistema, mas o histórico de suas ações ficará preservado.`}
            />
            <ConfirmationModal
                isOpen={!!deletingProfile}
                onClose={() => setDeletingProfile(null)}
                onConfirm={confirmDeleteProfile}
                title="Excluir Perfil de Permissão"
                message={`Tem certeza que deseja excluir o perfil "${deletingProfile?.name}"?`}
            />
        </div>
    );
};

export default Users;
