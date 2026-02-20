import React, { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import { getUsers, addUser, updateUser, deleteUser, getPermissionProfiles, addPermissionProfile, updatePermissionProfile, deletePermissionProfile } from '../../services/mockApi';
import { User, PermissionProfile } from '../../types';
import Button from '../../components/Button';
import { PlusIcon, TrashIcon, UserCircleIcon, ShieldCheckIcon, EditIcon } from '../../components/icons';
import Modal from '../../components/Modal';

const ServiceOrderSettingsUsers: React.FC = () => {
    const { showToast } = useToast();
    const { user: currentUser } = useUser();
    const [activeTab, setActiveTab] = useState<'users' | 'profiles'>('users');
    const [users, setUsers] = useState<User[]>([]);
    const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInactive, setShowInactive] = useState(false);

    // Modal States
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    // Edit States
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editingProfile, setEditingProfile] = useState<PermissionProfile | null>(null);

    // Form States
    const [userForm, setUserForm] = useState({ name: '', email: '', password: '', permissionProfileId: 'profile-tech', phone: '' });
    const [profileForm, setProfileForm] = useState({ name: '', permissions: {} as any });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, profilesData] = await Promise.all([
                getUsers(),
                getPermissionProfiles()
            ]);
            setUsers(usersData);
            setProfiles(profilesData);
        } catch (error) {
            console.error("Error loading settings data:", error);
            showToast("Erro ao carregar dados.", "error");
        } finally {
            setLoading(false);
        }
    };

    // --- USER ACTIONS ---

    const openNewUser = () => {
        setEditingUser(null);
        setUserForm({ name: '', email: '', password: '', permissionProfileId: 'profile-tech', phone: '' });
        setIsUserModalOpen(true);
    };

    const openEditUser = (user: User) => {
        setEditingUser(user);
        setUserForm({
            name: user.name,
            email: user.email,
            password: '', // Don't show password
            permissionProfileId: user.permissionProfileId,
            phone: user.phone || ''
        });
        setIsUserModalOpen(true);
    };

    const handleSaveUser = async () => {
        if (!userForm.name || !userForm.email) {
            showToast("Nome e Email são obrigatórios.", "error");
            return;
        }
        if (!editingUser && !userForm.password) {
            showToast("Senha é obrigatória para novos usuários.", "error");
            return;
        }

        try {
            if (editingUser) {
                // Update
                const updateData: any = {
                    id: editingUser.id,
                    name: userForm.name,
                    email: userForm.email,
                    permissionProfileId: userForm.permissionProfileId,
                    phone: userForm.phone
                };
                if (userForm.password) updateData.password = userForm.password;

                await updateUser(updateData);
                showToast("Usuário atualizado com sucesso!", "success");
            } else {
                // Create
                await addUser(userForm);
                showToast("Usuário criado com sucesso!", "success");
            }
            setIsUserModalOpen(false);
            loadData();
        } catch (error: any) {
            showToast(error.message || "Erro ao salvar usuário.", "error");
        }
    };

    const handleDeleteUser = async (user: User) => {
        if (currentUser?.id === user.id) {
            showToast("Você não pode inativar a si mesmo.", "error");
            return;
        }
        if (confirm(`Tem certeza que deseja inativar o usuário ${user.name}? Ele não terá mais acesso de login ao sistema.`)) {
            try {
                await deleteUser(user.id);
                showToast("Usuário inativado.", "success");
                loadData();
            } catch (error: any) {
                showToast(error.message || "Erro ao inativar usuário.", "error");
            }
        }
    };

    const handleReactivateUser = async (user: User) => {
        try {
            await updateUser({ ...user, active: true });
            showToast('Usuário reativado com sucesso!', 'success');
            loadData();
        } catch (error: any) {
            showToast(error.message || "Erro ao reativar usuário.", "error");
        }
    };

    // --- PROFILE ACTIONS ---

    const openNewProfile = () => {
        setEditingProfile(null);
        // Default empty permissions
        setProfileForm({ name: '', permissions: createEmptyPermissions() });
        setIsProfileModalOpen(true);
    };

    const openEditProfile = (profile: PermissionProfile) => {
        setEditingProfile(profile);
        setProfileForm({
            name: profile.name,
            permissions: { ...createEmptyPermissions(), ...profile.permissions }
        });
        setIsProfileModalOpen(true);
    };

    const createEmptyPermissions = () => ({
        canAccessDashboard: false,
        canAccessEstoque: false,
        canAccessVendas: false,
        canAccessPOS: false,
        canAccessClientes: false,
        canAccessFornecedores: false,
        canAccessRelatorios: false,
        canAccessEmpresa: false,
        canAccessCatalog: false,
        canCreateCatalogItem: false,
        canEditCatalogItem: false,
        canDeleteCatalogItem: false,
        canCreateProduct: false,
        canEditProduct: false,
        canDeleteProduct: false,
        canEditStock: false,
        canViewPurchases: false,
        canCreatePurchase: false,
        canEditPurchase: false,
        canDeletePurchase: false,
        canLaunchPurchase: false,
        canViewPurchaseKPIs: false,
        canCreateSale: false,
        canCancelSale: false,
        canViewSalesKPIs: false,
        canEditSale: false,
        canManageCompanyData: false,
        canManageUsers: false,
        canManagePermissions: false,
        canViewAudit: false,
        canEditOwnProfile: true, // Default true
        canManageMarcasECategorias: false,
        canCreateCustomer: false,
        canEditCustomer: false,
        canViewCustomerHistory: false,
        canInactivateCustomer: false,
        canDeleteCustomer: false,
        canCreateSupplier: false,
        canEditSupplier: false,
        canViewSupplierHistory: false,
        canDeleteSupplier: false,
        canManagePaymentMethods: false,
        canManageBackups: false,
        canManageParameters: false,
    });

    const handleSaveProfile = async () => {
        if (!profileForm.name) {
            showToast("Nome do perfil é obrigatório.", "error");
            return;
        }

        try {
            if (editingProfile) {
                await updatePermissionProfile({
                    id: editingProfile.id,
                    name: profileForm.name,
                    permissions: profileForm.permissions
                });
                showToast("Perfil atualizado!", "success");
            } else {
                await addPermissionProfile({
                    name: profileForm.name,
                    permissions: profileForm.permissions
                });
                showToast("Perfil criado!", "success");
            }
            setIsProfileModalOpen(false);
            loadData();
        } catch (error: any) {
            showToast(error.message || "Erro ao salvar perfil.", "error");
        }
    };

    const handleDeleteProfile = async (id: string) => {
        if (id.startsWith('profile-')) {
            showToast("Perfis padrão não podem ser excluídos.", "error");
            return;
        }
        if (confirm("Tem certeza que deseja excluir este perfil? Usuários vinculados a ele podem perder acesso.")) {
            try {
                await deletePermissionProfile(id);
                showToast("Perfil excluído.", "success");
                loadData();
            } catch (error) {
                showToast("Erro ao excluir perfil.", "error");
            }
        }
    };

    const togglePermission = (key: string) => {
        setProfileForm(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [key]: !prev.permissions[key]
            }
        }));
    };

    // Render Permission Group Helper
    const renderPermissionGroup = (title: string, keys: { key: string, label: string }[], requiredSection?: string) => {
        const isSectionEnabled = !requiredSection || profileForm.permissions[requiredSection];

        return (
            <div className={`mb-6 ${!isSectionEnabled ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between border-b pb-1 mb-2">
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{title}</h4>
                    {!isSectionEnabled && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase">
                            Seção Desativada
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {keys.map(({ key, label }) => {
                        const isEnabled = isSectionEnabled;
                        return (
                            <div key={key} className={`flex items-center justify-between p-2 rounded-lg border border-gray-50 hover:bg-gray-100 transition-all ${!isEnabled ? 'grayscale pointer-events-none' : ''}`}>
                                <span className={`text-xs font-medium ${!isEnabled ? 'text-gray-400' : 'text-gray-700'}`}>{label}</span>
                                <button
                                    type="button"
                                    disabled={!isEnabled}
                                    onClick={() => togglePermission(key)}
                                    className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors focus:outline-none ${profileForm.permissions[key] && isEnabled ? 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]' : 'bg-gray-200'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${profileForm.permissions[key] && isEnabled ? 'translate-x-4' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header Tabs */}
            <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'users' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Usuários
                </button>
                <button
                    onClick={() => setActiveTab('profiles')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'profiles' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Perfis de Acesso
                </button>
            </div>

            {/* Content */}
            {activeTab === 'users' ? (
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700">Mostrar inativos</span>
                            <button
                                type="button"
                                onClick={() => setShowInactive(!showInactive)}
                                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${showInactive ? 'bg-primary' : 'bg-gray-200'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showInactive ? 'translate-x-5.5' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                        <Button variant="primary" onClick={openNewUser} icon={<PlusIcon className="w-4 h-4" />}>
                            Novo Usuário
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {users.filter(u => showInactive ? true : u.active !== false).map(user => (
                            <div key={user.id} className={`bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between gap-4 group ${user.active === false ? 'opacity-50 grayscale' : ''}`}>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 relative">
                                        <UserCircleIcon className="text-gray-400 w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-gray-800 truncate">{user.name}</h3>
                                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                        <div className="flex items-center gap-1 mt-1">
                                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full inline-block truncate max-w-[120px]">
                                                {profiles.find(p => p.id === user.permissionProfileId)?.name || 'Sem Perfil'}
                                            </span>
                                            {user.active === false && (
                                                <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Inativo</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditUser(user)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-primary transition-colors" title="Editar">
                                        <EditIcon className="w-4 h-4" />
                                    </button>
                                    {user.active === false ? (
                                        <button onClick={() => handleReactivateUser(user)} className="p-2 hover:bg-emerald-50 rounded-lg text-gray-400 hover:text-emerald-500 transition-colors" title="Reativar">
                                            <ShieldCheckIcon className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <button onClick={() => handleDeleteUser(user)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors" title="Inativar">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Button variant="primary" onClick={openNewProfile} icon={<PlusIcon className="w-4 h-4" />}>
                            Novo Perfil
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {profiles.map(profile => (
                            <div key={profile.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm group">
                                <div className="flex items-center gap-3">
                                    <ShieldCheckIcon className="text-accent w-5 h-5" />
                                    <div>
                                        <h3 className="font-bold text-gray-800">{profile.name}</h3>
                                        <p className="text-xs text-gray-400">{profile.id}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openEditProfile(profile)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-primary transition-colors">
                                        <EditIcon className="w-4 h-4" />
                                    </button>
                                    {!profile.id.startsWith('profile-') && (
                                        <button onClick={() => handleDeleteProfile(profile.id)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal User (Create/Edit) */}
            <Modal
                isOpen={isUserModalOpen}
                onClose={() => setIsUserModalOpen(false)}
                title={editingUser ? "Editar Usuário" : "Novo Usuário"}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nome</label>
                        <input
                            type="text"
                            value={userForm.name}
                            onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                            className="w-full mt-1 p-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            value={userForm.email}
                            disabled={!!editingUser} // Email cannot be changed for existing users easily due to Auth handling
                            onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                            className={`w-full mt-1 p-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 ${editingUser ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                        />
                        {editingUser && <p className="text-xs text-secondary mt-1">O email não pode ser alterado diretamente.</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{editingUser ? "Nova Senha (Opcional)" : "Senha"}</label>
                        <input
                            type="password"
                            value={userForm.password}
                            placeholder={editingUser ? "Deixe em branco para manter a atual" : ""}
                            onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                            className="w-full mt-1 p-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Telefone</label>
                        <input
                            type="text"
                            value={userForm.phone}
                            onChange={e => setUserForm({ ...userForm, phone: e.target.value })}
                            className="w-full mt-1 p-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Perfil de Permissões</label>
                        <select
                            value={userForm.permissionProfileId}
                            onChange={e => setUserForm({ ...userForm, permissionProfileId: e.target.value })}
                            className="w-full mt-1 p-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                        >
                            {profiles.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setIsUserModalOpen(false)}>Cancelar</Button>
                        <Button variant="primary" onClick={handleSaveUser}>Salvar</Button>
                    </div>
                </div>
            </Modal>

            {/* Modal Permission Profile (Create/Edit) */}
            <Modal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                title={editingProfile ? "Editar Perfil" : "Novo Perfil"}
                className="max-w-4xl" // Wider modal for checkboxes
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nome do Perfil</label>
                        <input
                            type="text"
                            value={profileForm.name}
                            onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                            className="w-full mt-1 p-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>

                    <div className="border rounded-xl p-4 max-h-[60vh] overflow-y-auto custom-scrollbar bg-gray-50/50">
                        {renderPermissionGroup("Acesso Geral (Menus)", [
                            { key: 'canAccessDashboard', label: 'Dashboard' },
                            { key: 'canAccessVendas', label: 'Vendas' },
                            { key: 'canAccessEstoque', label: 'Estoque / Produtos' },
                            { key: 'canAccessClientes', label: 'Clientes' },
                            { key: 'canAccessFornecedores', label: 'Fornecedores' },
                            { key: 'canAccessPOS', label: 'PDV (Caixa)' },
                            { key: 'canAccessRelatorios', label: 'Relatórios' },
                            { key: 'canAccessEmpresa', label: 'Config. Empresa' },
                            { key: 'canAccessCatalog', label: 'Catálogo' },
                        ])}

                        {renderPermissionGroup("Catálogo Digital", [
                            { key: 'canCreateCatalogItem', label: 'Adicionar Itens ao Catálogo' },
                            { key: 'canEditCatalogItem', label: 'Editar Itens do Catálogo' },
                            { key: 'canDeleteCatalogItem', label: 'Excluir Itens do Catálogo' },
                        ], "canAccessCatalog")}

                        {renderPermissionGroup("Vendas", [
                            { key: 'canCreateSale', label: 'Criar Venda' },
                            { key: 'canEditSale', label: 'Editar Venda' },
                            { key: 'canCancelSale', label: 'Cancelar Venda' },
                            { key: 'canViewSalesKPIs', label: 'Ver Indicadores de Vendas' },
                        ], "canAccessVendas")}

                        {renderPermissionGroup("Estoque e Produtos", [
                            { key: 'canCreateProduct', label: 'Criar Produto' },
                            { key: 'canEditProduct', label: 'Editar Produto' },
                            { key: 'canDeleteProduct', label: 'Excluir Produto' },
                            { key: 'canEditStock', label: 'Ajuste Manual de Estoque' },
                            { key: 'canManageMarcasECategorias', label: 'Gerenciar Marcas/Categorias' },
                        ], "canAccessEstoque")}

                        {renderPermissionGroup("Compras", [
                            { key: 'canViewPurchases', label: 'Ver Compras' },
                            { key: 'canCreatePurchase', label: 'Criar Pedido' },
                            { key: 'canLaunchPurchase', label: 'Lançar Compra (Estoque)' },
                            { key: 'canEditPurchase', label: 'Editar Pedido' },
                            { key: 'canDeletePurchase', label: 'Excluir Pedido' },
                            { key: 'canViewPurchaseKPIs', label: 'Ver Indicadores de Compras' },
                        ], "canViewPurchases")}

                        {renderPermissionGroup("Clientes e Fornecedores", [
                            { key: 'canCreateCustomer', label: 'Criar Cliente' },
                            { key: 'canEditCustomer', label: 'Editar Cliente' },
                            { key: 'canDeleteCustomer', label: 'Excluir Cliente' },
                            { key: 'canViewCustomerHistory', label: 'Ver Histórico Cliente' },
                            { key: 'canCreateSupplier', label: 'Criar Fornecedor' },
                            { key: 'canEditSupplier', label: 'Editar Fornecedor' },
                            { key: 'canDeleteSupplier', label: 'Excluir Fornecedor' },
                        ], "canAccessClientes")}

                        {renderPermissionGroup("Administrativo", [
                            { key: 'canManageUsers', label: 'Gerenciar Usuários' },
                            { key: 'canManagePermissions', label: 'Gerenciar Permissões' },
                            { key: 'canManageCompanyData', label: 'Dados da Empresa' },
                            { key: 'canManagePaymentMethods', label: 'Métodos de Pagamento' },
                            { key: 'canManageParameters', label: 'Parâmetros do Sistema' },
                            { key: 'canManageBackups', label: 'Gerenciar Backups' },
                            { key: 'canViewAudit', label: 'Ver Logs de Auditoria' },
                        ], "canAccessEmpresa")}
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setIsProfileModalOpen(false)}>Cancelar</Button>
                        <Button variant="primary" onClick={handleSaveProfile}>Salvar Perfil</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ServiceOrderSettingsUsers;
