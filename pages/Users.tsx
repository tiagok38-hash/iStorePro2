
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, PermissionProfile, PermissionSet } from '../types.ts';
import { getUsers, getPermissionProfiles, deleteUser, deletePermissionProfile, formatPhone, addUser, updateUser, addPermissionProfile, updatePermissionProfile } from '../services/mockApi.ts';
import { SpinnerIcon, PlayCircleIcon, LockClosedIcon, TrashIcon, EditIcon, UserGroupIcon, UserPlusIcon, CheckIcon } from '../components/icons.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import ConfirmationModal from '../components/ConfirmationModal.tsx';
import Button from '../components/Button.tsx';

// --- PermissionProfileModal ---
const permissionGroups: { title: string; requiredSection?: keyof PermissionSet; permissions: { key: keyof PermissionSet; label: string }[] }[] = [
    {
        title: 'Acesso às Seções',
        permissions: [
            { key: 'canAccessDashboard', label: 'Acessar Dashboard' },
            { key: 'canAccessEstoque', label: 'Acessar Estoque' },
            { key: 'canViewPurchases', label: 'Acessar Compras' },
            { key: 'canAccessVendas', label: 'Acessar Vendas' },
            { key: 'canAccessPOS', label: 'Acessar PDV (Frente de Caixa)' },
            { key: 'canAccessClientes', label: 'Acessar Clientes' },
            { key: 'canAccessFornecedores', label: 'Acessar Fornecedores' },
            { key: 'canAccessRelatorios', label: 'Acessar Relatórios' },
            { key: 'canAccessEmpresa', label: 'Acessar Configurações da Empresa' },
            { key: 'canAccessServiceOrders', label: 'Acessar Ordens de Serviço' },
            { key: 'canAccessCrm', label: 'Acessar CRM' },
            { key: 'canAccessFinanceiro', label: 'Acessar Financeiro' },
            { key: 'canAccessCatalog', label: 'Acessar Catálogo' },
        ],
    },
    {
        title: 'Módulo Financeiro',
        requiredSection: 'canAccessFinanceiro',
        permissions: [
            { key: 'canCreateTransaction', label: 'Criar Receitas/Despesas' },
            { key: 'canEditTransaction', label: 'Editar Transações' },
            { key: 'canDeleteTransaction', label: 'Excluir Transações' },
            { key: 'canViewFinancialKPIs', label: 'Visualizar Indicadores Financeiros' },
        ],
    },
    {
        title: 'Ordem de Serviço (OS)',
        requiredSection: 'canAccessServiceOrders',
        permissions: [
            { key: 'canCreateServiceOrder', label: 'Criar Nova OS' },
            { key: 'canEditServiceOrder', label: 'Editar OS' },
            { key: 'canDeleteServiceOrder', label: 'Excluir OS' },
            { key: 'canManageServiceOrderStatus', label: 'Alterar Status da OS' },
        ],
    },
    {
        title: 'CRM (Gestão de Leads)',
        requiredSection: 'canAccessCrm',
        permissions: [
            { key: 'canCreateCrmDeal', label: 'Criar Leads' },
            { key: 'canEditCrmDeal', label: 'Editar Leads' },
            { key: 'canDeleteCrmDeal', label: 'Excluir Leads' },
            { key: 'canMoveCrmDeal', label: 'Mover Cards (Drag & Drop)' },
            { key: 'canViewAllCrmDeals', label: 'Visualizar Todos os Leads (Inativo = Só Meus)' },
        ],
    },
    {
        title: 'Catálogo Digital',
        requiredSection: 'canAccessCatalog',
        permissions: [
            { key: 'canCreateCatalogItem', label: 'Adicionar Itens ao Catálogo' },
            { key: 'canEditCatalogItem', label: 'Editar Itens do Catálogo' },
            { key: 'canDeleteCatalogItem', label: 'Excluir Itens do Catálogo' },
        ],
    },
    {
        title: 'Comissões',
        permissions: [
            { key: 'canViewOwnCommission', label: 'Ver Próprias Comissões' },
            { key: 'canViewAllCommissions', label: 'Ver Comissões de Todos' },
            { key: 'canCloseCommissionPeriod', label: 'Fechar Período de Comissão' },
            { key: 'canMarkCommissionPaid', label: 'Marcar Comissão como Paga' },
            { key: 'canEditProductCommissionSettings', label: 'Editar Config. de Comissão nos Produtos' },
        ],
    },
    {
        title: 'Produtos e Estoque',
        requiredSection: 'canAccessEstoque',
        permissions: [
            { key: 'canCreateProduct', label: 'Criar/Lançar Novos Produtos' },
            { key: 'canEditProduct', label: 'Editar Produtos' },
            { key: 'canDeleteProduct', label: 'Excluir Produtos' },
            { key: 'canEditStock', label: 'Fazer Ajustes Manuais de Estoque' },
        ],
    },
    {
        title: 'Vendas',
        requiredSection: 'canAccessVendas',
        permissions: [
            { key: 'canCreateSale', label: 'Realizar Novas Vendas' },
            { key: 'canEditSale', label: 'Editar venda' },
            { key: 'canCancelSale', label: 'Cancelar Vendas' },
            { key: 'canViewSalesKPIs', label: 'Visualizar Cards de Indicadores (KPIs)' },
        ],
    },
    {
        title: 'Compras',
        requiredSection: 'canViewPurchases',
        permissions: [
            { key: 'canCreatePurchase', label: 'Criar Novas Compras' },
            { key: 'canEditPurchase', label: 'Editar Compras' },
            { key: 'canDeletePurchase', label: 'Excluir Compras' },
            { key: 'canLaunchPurchase', label: 'Lançar Compras no Estoque' },
            { key: 'canViewPurchaseKPIs', label: 'Visualizar Cards de Indicadores (KPIs)' },
        ],
    },
    {
        title: 'Gestão de Clientes',
        requiredSection: 'canAccessClientes',
        permissions: [
            { key: 'canCreateCustomer', label: 'Criar Clientes' },
            { key: 'canEditCustomer', label: 'Editar Clientes' },
            { key: 'canViewCustomerHistory', label: 'Visualizar Histórico de Clientes' },
            { key: 'canInactivateCustomer', label: 'Inativar/Reativar Clientes' },
            { key: 'canDeleteCustomer', label: 'Excluir Clientes' },
        ],
    },
    {
        title: 'Gestão de Fornecedores',
        requiredSection: 'canAccessFornecedores',
        permissions: [
            { key: 'canCreateSupplier', label: 'Criar Fornecedores' },
            { key: 'canEditSupplier', label: 'Editar Fornecedores' },
            { key: 'canViewSupplierHistory', label: 'Visualizar Histórico de Fornecedores' },
            { key: 'canDeleteSupplier', label: 'Excluir Fornecedores' },
        ],
    },
    {
        title: 'Administração da Empresa',
        requiredSection: 'canAccessEmpresa',
        permissions: [
            { key: 'canManageCompanyData', label: 'Gerenciar Dados da Empresa' },
            { key: 'canManageUsers', label: 'Gerenciar Usuários' },
            { key: 'canManagePermissions', label: 'Gerenciar Perfis de Permissão' },
            { key: 'canManageMarcasECategorias', label: 'Gerenciar Marcas e Categorias' },
            { key: 'canManageParameters', label: 'Gerenciar Parâmetros (Garantia, Condições, etc.)' },
            { key: 'canManagePaymentMethods', label: 'Gerenciar Meios de Pagamento' },
            { key: 'canManageBackups', label: 'Realizar Backup e Restauração' },
            { key: 'canViewAudit', label: 'Visualizar Log de Auditoria' },
            { key: 'canEditOwnProfile', label: 'Acessar e Editar Próprio Perfil' },
        ],
    },
];

const PermissionProfileModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (profile: Omit<PermissionProfile, 'id'> | PermissionProfile) => Promise<void>;
    profile: Partial<PermissionProfile> | null;
}> = ({ isOpen, onClose, onSave, profile }) => {
    const [name, setName] = useState('');
    const [permissions, setPermissions] = useState<PermissionSet>({} as PermissionSet);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const defaults = permissionGroups.reduce((acc, group) => {
            group.permissions.forEach(p => { acc[p.key] = false; });
            return acc;
        }, {} as PermissionSet);

        if (profile) {
            setName(profile.name || '');
            setPermissions({ ...defaults, ...(profile.permissions || {}) });
        } else {
            setName('');
            setPermissions(defaults);
        }
    }, [profile]);

    const handlePermissionChange = (key: keyof PermissionSet, value: boolean) => {
        setPermissions(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onSave({ ...profile, name, permissions });
        setIsSaving(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-surface p-6 rounded-3xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-border">
                <h2 className="text-xl font-bold mb-4">{profile?.id ? 'Editar' : 'Criar'} Perfil de Permissão</h2>
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Nome do Perfil</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded-xl" />
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {permissionGroups.map(group => {
                        const isSectionEnabled = !group.requiredSection || permissions[group.requiredSection];

                        return (
                            <div key={group.title} className={!isSectionEnabled ? 'opacity-50' : ''}>
                                <div className="flex items-center justify-between border-b pb-1 mb-2">
                                    <h3 className="font-semibold text-primary">{group.title}</h3>
                                    {!isSectionEnabled && (
                                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase">
                                            Seção Desativada
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                    {group.permissions.map(perm => {
                                        const isEnabled = isSectionEnabled;

                                        return (
                                            <div key={perm.key} className={`flex items-center justify-between p-2 rounded-xl border border-gray-50 hover:bg-gray-50 transition-colors ${!isEnabled ? 'grayscale pointer-events-none' : ''}`}>
                                                <span className={`text-sm font-medium ${!isEnabled ? 'text-gray-400' : 'text-primary'}`}>{perm.label}</span>
                                                <button
                                                    type="button"
                                                    disabled={!isEnabled}
                                                    onClick={() => handlePermissionChange(perm.key, !permissions[perm.key])}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${permissions[perm.key] && isEnabled ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'bg-gray-200'
                                                        }`}
                                                >
                                                    <span
                                                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${permissions[perm.key] && isEnabled ? 'translate-x-5' : 'translate-x-1'
                                                            }`}
                                                    />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-end gap-4 mt-6 pt-4 border-t">
                    <Button onClick={onClose} variant="secondary">Cancelar</Button>
                    <Button onClick={handleSave} variant="success" loading={isSaving} icon={<CheckIcon className="h-5 w-5" />}>
                        Salvar
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
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
                        <button onClick={handleAddUser} className="flex items-center gap-2 px-3 py-2 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:bg-opacity-90">
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
                        <button onClick={handleAddProfile} className="flex items-center gap-2 px-4 py-2 bg-secondary text-on-primary rounded-xl font-semibold text-sm hover:bg-opacity-90">
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
