import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import {
    getServices, addService, updateService, deleteService, getProducts,
    getSuppliers, addSupplier, getCustomers, getBrands, getCategories, getProductModels, getGrades as getProductGrades, getGradeValues, getWarranties
} from '../../services/mockApi';
import { Service, Product, Supplier, Customer, Brand, Category, ProductModel, Grade, GradeValue, WarrantyParameter } from '../../types';
import {
    SearchIcon, PlusIcon, EditIcon, TrashIcon, WrenchIcon, PackageIcon,
    MoreVerticalIcon, FilterIcon, ArrowsUpDownIcon as ArrowUpDownIcon, ShoppingCartIcon
} from '../../components/icons';
import Button from '../../components/Button';
import GlobalLoading from '../../components/GlobalLoading';
import Modal from '../../components/Modal';
import { formatCurrency } from '../../services/mockApi';
import PurchaseOrderModal from '../../components/PurchaseOrderModal';

// --- Service Modal Component ---
interface ServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Service>) => Promise<void>;
    service: Partial<Service> | null;
    loading: boolean;
    warrantyOptions: WarrantyParameter[];
}

const ServiceModal: React.FC<ServiceModalProps> = ({ isOpen, onClose, onSave, service, loading, warrantyOptions }) => {
    const [formData, setFormData] = useState<Partial<Service>>({
        name: '',
        description: '',
        price: 0,
        cost: 0,
        warranty: '90 dias'
    });

    useEffect(() => {
        if (service) {
            setFormData({
                ...service,
                warranty: service.warranty || '90 dias'
            });
        } else {
            setFormData({ name: '', description: '', price: 0, cost: 0, warranty: '90 dias' });
        }
    }, [service]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'price' || name === 'cost' ? parseFloat(value) || 0 : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave(formData);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={service?.id ? 'Editar Serviço' : 'Novo Serviço'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Serviço *</label>
                    <input
                        type="text"
                        name="name"
                        required
                        value={formData.name || ''}
                        onChange={handleChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Ex: Troca de Tela iPhone 13"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Venda (R$) *</label>
                        <input
                            type="number"
                            name="price"
                            required
                            min="0"
                            step="0.01"
                            value={formData.price || ''}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            placeholder="0,00"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Custo Estimado (R$)</label>
                        <input
                            type="number"
                            name="cost"
                            min="0"
                            step="0.01"
                            value={formData.cost || ''}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            placeholder="0,00"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Garantia</label>
                    <select
                        name="warranty"
                        value={formData.warranty || '90 dias'}
                        onChange={handleChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                        {warrantyOptions.length === 0 ? (
                            <option value="90 dias">90 dias (Padrão)</option>
                        ) : (
                            warrantyOptions.map(opt => (
                                <option key={opt.id} value={opt.name}>{opt.name}</option>
                            ))
                        )}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                    <textarea
                        name="description"
                        value={formData.description || ''}
                        onChange={handleChange}
                        rows={3}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Detalhes do serviço..."
                    />
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
                    <Button variant="primary" type="submit" loading={loading}>Salvar</Button>
                </div>
            </form>
        </Modal>
    );
};

// --- Main Page Component ---
const ServiceOrderProducts: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'services' | 'products'>('services');
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();
    const { permissions } = useUser();

    // Data States
    const [services, setServices] = useState<Service[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [productModels, setProductModels] = useState<ProductModel[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [gradeValues, setGradeValues] = useState<GradeValue[]>([]);
    const [warranties, setWarranties] = useState<WarrantyParameter[]>([]);

    const [searchTerm, setSearchTerm] = useState('');

    // Service Modal State
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Partial<Service> | null>(null);
    const [savingService, setSavingService] = useState(false);

    // Purchase Modal State
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

    // Initial Fetch
    const fetchData = async () => {
        setLoading(true);
        try {
            const [
                servicesData, productsData, suppliersData, customersData,
                brandsData, categoriesData, modelsData, gradesData, valuesData, warrantiesData
            ] = await Promise.all([
                getServices(),
                getProducts(),
                getSuppliers(),
                getCustomers(),
                getBrands(),
                getCategories(),
                getProductModels(),
                getProductGrades(),
                getGradeValues(),
                getWarranties()
            ]);
            setServices(servicesData);
            setProducts(productsData);
            setSuppliers(suppliersData);
            setCustomers(customersData);
            setBrands(brandsData);
            setCategories(categoriesData);
            setProductModels(modelsData);
            setGrades(gradesData);
            setGradeValues(valuesData);
            setWarranties(warrantiesData);
        } catch (error) {
            console.error(error);
            showToast('Erro ao carregar dados.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter Logic
    const filteredServices = useMemo(() => {
        return services.filter(s =>
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.description || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [services, searchTerm]);

    const filteredProducts = useMemo(() => {
        return products.filter(p =>
            p.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.brand.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [products, searchTerm]);

    // Handlers
    const handleSaveService = async (data: Partial<Service>) => {
        setSavingService(true);
        try {
            if (data.id) {
                await updateService(data.id, data);
                showToast('Serviço atualizado!', 'success');
            } else {
                await addService(data as Service);
                showToast('Serviço criado!', 'success');
            }
            setIsServiceModalOpen(false);
            setEditingService(null);
            fetchData();
        } catch (error) {
            showToast('Erro ao salvar serviço.', 'error');
        } finally {
            setSavingService(false);
        }
    };

    const handleDeleteService = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
        try {
            await deleteService(id);
            showToast('Serviço excluído.', 'success');
            fetchData();
        } catch (error) {
            showToast('Erro ao excluir serviço.', 'error');
        }
    };

    const openEditService = (service: Service) => {
        setEditingService(service);
        setIsServiceModalOpen(true);
    };

    const openNewService = () => {
        setEditingService(null);
        setIsServiceModalOpen(true);
    };

    if (loading && services.length === 0 && products.length === 0) return <GlobalLoading />;

    return (
        <div className="h-full flex flex-col space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Produtos e Serviços</h1>
                    <p className="text-gray-500">Gerencie seu catálogo para Ordens de Serviço</p>
                </div>
                <div className="flex p-0.5 bg-gray-200/50 rounded-xl border border-gray-200">
                    <button
                        onClick={() => setActiveTab('services')}
                        className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'services' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                            }`}
                    >
                        Serviços
                    </button>
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'products' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                            }`}
                    >
                        Produtos
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-96">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder={activeTab === 'services' ? "Buscar serviços..." : "Buscar produtos..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary/20"
                    />
                </div>

                <div className="flex gap-2">
                    {activeTab === 'services' && (
                        <Button onClick={openNewService} icon={<PlusIcon className="h-5 w-5" />}>Novo Serviço</Button>
                    )}
                    {activeTab === 'products' && (
                        <>
                            <Button
                                variant="secondary"
                                onClick={() => setIsPurchaseModalOpen(true)}
                                icon={<ShoppingCartIcon className="h-5 w-5" />}
                            >
                                Lançar Compra
                            </Button>
                            <Button variant='secondary' onClick={() => window.location.hash = '#/products'} icon={<PackageIcon className="h-5 w-5" />}>
                                Gerenciar Estoque
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                {activeTab === 'services' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Serviço</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Taxa/Garantia</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Preço</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Custo</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredServices.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            Nenhum serviço encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredServices.map((service) => (
                                        <tr key={service.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                                                        <WrenchIcon className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900">{service.name}</p>
                                                        {service.description && <p className="text-xs text-gray-500 max-w-xs truncate">{service.description}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {service.warranty || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                {formatCurrency(service.price)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {formatCurrency(service.cost)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => openEditService(service)}
                                                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-primary transition-colors"
                                                        title="Editar"
                                                    >
                                                        <EditIcon className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteService(service.id)}
                                                        className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    // Products View (Simplified)
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Produto</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estoque</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Preço</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                            Nenhum produto encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProducts.map((product) => (
                                        <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                                                        <PackageIcon className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900">{product.model}</p>
                                                        <p className="text-xs text-gray-500">{product.brand}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                                {product.stock} un
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900">
                                                {formatCurrency(product.price)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${product.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {product.stock > 0 ? 'Em Estoque' : 'Esgotado'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <ServiceModal
                isOpen={isServiceModalOpen}
                onClose={() => setIsServiceModalOpen(false)}
                onSave={handleSaveService}
                service={editingService}
                loading={savingService}
                warrantyOptions={warranties}
            />

            {isPurchaseModalOpen && (
                <PurchaseOrderModal
                    suppliers={suppliers}
                    customers={customers}
                    products={products}
                    brands={brands}
                    categories={categories}
                    productModels={productModels}
                    grades={grades}
                    gradeValues={gradeValues}
                    onClose={(refresh) => {
                        setIsPurchaseModalOpen(false);
                        if (refresh) fetchData();
                    }}
                    onAddNewSupplier={async (supplierData) => {
                        try {
                            const newSupplier = await addSupplier(supplierData);
                            // Refresh suppliers list
                            const updatedSuppliers = await getSuppliers();
                            setSuppliers(updatedSuppliers);
                            return newSupplier;
                        } catch (error) {
                            console.error("Error adding supplier:", error);
                            showToast("Erro ao criar fornecedor.", "error");
                            return null;
                        }
                    }}
                />
            )}
        </div>
    );
};

export default ServiceOrderProducts;
