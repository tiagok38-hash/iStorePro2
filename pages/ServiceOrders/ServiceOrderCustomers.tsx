
import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import { getCustomers, addCustomer, updateCustomer, deleteCustomer, getSuppliers, addSupplier, updateSupplier, deleteSupplier } from '../../services/mockApi';
import { Customer, Supplier } from '../../types';
import CustomerModal from '../../components/CustomerModal';
import {
    SearchIcon,
    PlusIcon,
    EditIcon,
    TrashIcon,
    UserCircleIcon,
    FilterIcon,
    PhoneIcon,
    EnvelopeIcon
} from '../../components/icons';
import Button from '../../components/Button';
import GlobalLoading from '../../components/GlobalLoading';
import ConfirmationModal from '../../components/ConfirmationModal';

const ServiceOrderCustomers: React.FC = () => {
    const { toast, showToast } = useToast();
    const { user: currentUser } = useUser();
    const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');

    // Data Stats
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEntity, setSelectedEntity] = useState<Partial<Customer | Supplier> | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [entityToDelete, setEntityToDelete] = useState<Customer | Supplier | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [customersData, suppliersData] = await Promise.all([
                getCustomers(),
                getSuppliers()
            ]);
            setCustomers(customersData);
            setSuppliers(suppliersData);
        } catch (error) {
            console.error("Error loading entities:", error);
            showToast("Erro ao carregar dados.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const filteredData = useMemo(() => {
        const data = activeTab === 'customers' ? customers : suppliers;
        return data.filter(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.phone.includes(searchTerm) ||
            item.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [activeTab, customers, suppliers, searchTerm]);

    const handleSave = async (data: any, entityType: 'Cliente' | 'Fornecedor' | 'Ambos', personType: string) => {
        try {
            const isEdit = !!data.id;
            let promises = [];

            // Helper to prepare payload
            const preparePayload = (baseData: any) => ({
                ...baseData,
                // Ensure dynamic fields if needed
            });

            if (entityType === 'Cliente' || entityType === 'Ambos') {
                if (isEdit && activeTab === 'customers') {
                    await updateCustomer(preparePayload(data));
                } else if (!isEdit) {
                    await addCustomer(preparePayload(data));
                }
            }

            if (entityType === 'Fornecedor' || entityType === 'Ambos') {
                if (isEdit && activeTab === 'suppliers') {
                    await updateSupplier(preparePayload(data));
                } else if (!isEdit) {
                    await addSupplier(preparePayload(data));
                }
            }

            showToast(`${isEdit ? 'Atualizado' : 'Criado'} com sucesso!`, "success");
            setIsModalOpen(false);
            loadData();
        } catch (error) {
            console.error("Error saving:", error);
            showToast("Erro ao salvar.", "error");
        }
    };

    const handleDelete = async () => {
        if (!entityToDelete) return;
        try {
            if (activeTab === 'customers') {
                await deleteCustomer(entityToDelete.id);
            } else {
                await deleteSupplier(entityToDelete.id);
            }
            showToast("Excluído com sucesso.", "success");
            setIsDeleteModalOpen(false);
            setEntityToDelete(null);
            loadData();
        } catch (error: any) {
            console.error("Error deleting:", error);
            showToast(error.message || "Erro ao excluir.", "error");
        }
    };

    const openEdit = (entity: Customer | Supplier) => {
        setSelectedEntity(entity);
        setIsModalOpen(true);
    };

    const openNew = () => {
        setSelectedEntity(null);
        setIsModalOpen(true);
    };

    // Mock Debt Check (Replace with real logic if available)
    const hasDebt = (customer: Customer) => {
        // Example: logic to check if customer has pending sales
        // For now, returning false or based on a custom tag/flag if we had one.
        // We can simulate it randomly for demo or leave plain.
        return false;
    };

    if (isLoading) return <GlobalLoading />;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 tracking-tight">
                        {activeTab === 'customers' ? 'Clientes' : 'Fornecedores'}
                    </h1>
                    <p className="text-gray-500 text-sm font-medium mt-1">
                        Gerencie seus contatos comerciais
                    </p>
                </div>
                <Button
                    variant="primary"
                    onClick={openNew}
                    icon={<PlusIcon className="w-5 h-5" />}
                    className="shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform"
                >
                    Novo Cadastro
                </Button>
            </div>

            {/* Tabs & Search */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="flex p-1 bg-gray-100 rounded-xl">
                    <button
                        onClick={() => setActiveTab('customers')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'customers'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Clientes
                    </button>
                    <button
                        onClick={() => setActiveTab('suppliers')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'suppliers'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Fornecedores
                    </button>
                </div>

                <div className="relative w-full sm:w-96">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder={`Buscar ${activeTab === 'customers' ? 'cliente' : 'fornecedor'}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 h-11 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 text-sm font-medium transition-all"
                    />
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredData.map((item) => (
                    <div key={item.id} className="group bg-white rounded-2xl p-5 border border-gray-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 relative overflow-hidden">
                        {(item as Customer).isBlocked && (
                            <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-xl">BLOCK</div>
                        )}

                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                                {item.avatarUrl ? (
                                    <img src={item.avatarUrl} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                    <UserCircleIcon className="w-full h-full text-gray-300" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-gray-800 truncate pr-6">{item.name}</h3>
                                <div className="space-y-1 mt-1">
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <PhoneIcon className="w-3.5 h-3.5" />
                                        <span>{item.phone}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <EnvelopeIcon className="w-3.5 h-3.5" />
                                        <span className="truncate">{item.email}</span>
                                    </div>
                                    {activeTab === 'customers' && hasDebt(item as Customer) && (
                                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 mt-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                            <span className="text-[10px] font-bold uppercase">Pendências</span>
                                        </div>
                                    )}
                                    {activeTab === 'customers' && (item as Customer).instagram && (
                                        <div className="flex items-center gap-1 text-[10px] text-fuchsia-600 font-medium mt-1">
                                            <span>📸 {(item as Customer).instagram}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => openEdit(item)}
                                    className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-blue-600 flex items-center justify-center transition-colors"
                                >
                                    <EditIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => { setEntityToDelete(item); setIsDeleteModalOpen(true); }}
                                    className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredData.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <UserCircleIcon className="w-16 h-16 mb-4 opacity-20" />
                    <p>Nenhum registro encontrado</p>
                </div>
            )}

            {isModalOpen && (
                <CustomerModal
                    entity={selectedEntity}
                    initialType={activeTab === 'customers' ? 'Cliente' : 'Fornecedor'}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                />
            )}

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                title={`Excluir ${activeTab === 'customers' ? 'Cliente' : 'Fornecedor'}`}
                message={`Tem certeza que deseja excluir ${entityToDelete?.name}?`}
                onConfirm={handleDelete}
                onCancel={() => setIsDeleteModalOpen(false)}
            />
        </div>
    );
};

export default ServiceOrderCustomers;
