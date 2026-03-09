import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import {
    getServices, addService, updateService, deleteService,
    getSuppliers, addSupplier, getOsParts, addOsPart, updateOsPart, deleteOsPart,
    getOsPurchaseOrders, cancelOsPurchaseOrder, updateOsPurchaseFinancialStatus,
    OsPart, OsPurchaseOrder, formatCurrency, getBrands, getCategories, getProductModels, getGrades, getGradeValues
} from '../../services/mockApi';
import { Service, Supplier, WarrantyParameter, Brand, Category, ProductModel, Grade, GradeValue } from '../../types';
import {
    SearchIcon, PlusIcon, EditIcon, TrashIcon, WrenchIcon, PackageIcon, ClockIcon, EyeIcon, XCircleIcon
} from '../../components/icons';
import { AlertTriangle } from 'lucide-react';
import { SuccessIcon } from '../../components/icons';
import Button from '../../components/Button';
import GlobalLoading from '../../components/GlobalLoading';
import Modal from '../../components/Modal';
import CurrencyInput from '../../components/CurrencyInput';
import OsPartModal from '../../components/OsPartModal';
import OsPurchaseModal from '../../components/OsPurchaseModal';
import DeleteWithReasonModal from '../../components/DeleteWithReasonModal';
import OsPurchaseDetailModal from '../../components/OsPurchaseDetailModal';
import { formatDateBR } from '../../utils/dateUtils';
import { getOsWarranties } from '../../services/mockApi';
import { useUser } from '../../contexts/UserContext';

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
        if (isOpen) {
            if (service) {
                setFormData({
                    ...service,
                    warranty: service.warranty || '90 dias'
                });
            } else {
                setFormData({
                    name: '',
                    description: '',
                    price: 0,
                    cost: 0,
                    warranty: '90 dias',
                    commission_enabled: false,
                    commission_type: 'percentage',
                    commission_value: 0
                });
            }
        }
    }, [service, isOpen]);

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
        <Modal isOpen={isOpen} onClose={onClose} title={service?.id ? 'Editar Serviço' : '+ Novo serviço'}>
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
                        <CurrencyInput
                            value={formData.price}
                            onChange={(val) => setFormData(prev => ({ ...prev, price: val || 0 }))}
                            placeholder="0,00"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Custo Estimado (R$)</label>
                        <CurrencyInput
                            value={formData.cost}
                            onChange={(val) => setFormData(prev => ({ ...prev, cost: val || 0 }))}
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

                {/* ─── COMMISSION CONFIGURATION ─── */}
                <div className="mt-6 bg-gradient-to-br from-violet-50 to-indigo-50 rounded-[20px] border border-violet-100 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest">🏷️ Comissão</span>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-gray-600 transition-colors">
                                {formData.commission_enabled ? 'Ativa' : 'Desativada'}
                            </span>
                            <div
                                className={`w-11 h-6 rounded-full p-1 transition-all relative ${formData.commission_enabled ? 'bg-violet-600 shadow-[0_0_15px_rgba(109,40,217,0.4)]' : 'bg-gray-200'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-all ${formData.commission_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </div>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={!!formData.commission_enabled}
                                onChange={() => setFormData(p => ({ ...p, commission_enabled: !p.commission_enabled }))}
                            />
                        </label>
                    </div>

                    {formData.commission_enabled && (
                        <div className="grid grid-cols-2 gap-3 animate-fade-in">
                            <div>
                                <label className="text-[10px] font-black text-violet-500 uppercase tracking-widest px-1 mb-1 block">Tipo</label>
                                <select
                                    value={formData.commission_type || 'percentage'}
                                    onChange={(e) => setFormData(p => ({ ...p, commission_type: e.target.value as any }))}
                                    className="w-full p-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 h-10 outline-none"
                                >
                                    <option value="percentage">Percentual (%)</option>
                                    <option value="fixed">Valor Fixo (R$)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-violet-500 uppercase tracking-widest px-1 mb-1 block">
                                    Valor {formData.commission_type === 'fixed' ? '(R$)' : '(%)'}
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.commission_value ?? ''}
                                    onChange={(e) => setFormData(p => ({ ...p, commission_value: e.target.value === '' ? 0 : parseFloat(e.target.value) }))}
                                    className="w-full p-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 h-10 outline-none"
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    )}
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
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'services' | 'parts'>('parts');
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();
    const { user } = useUser();

    // URL Filter sync
    const urlFilter = searchParams.get('filter');

    // Data States
    const [services, setServices] = useState<Service[]>([]);
    const [osParts, setOsParts] = useState<OsPart[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [warranties, setWarranties] = useState<WarrantyParameter[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [productModels, setProductModels] = useState<ProductModel[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [gradeValues, setGradeValues] = useState<GradeValue[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out' | 'low'>((urlFilter as any) || 'in_stock');

    useEffect(() => {
        if (urlFilter && ['all', 'in_stock', 'out', 'low'].includes(urlFilter)) {
            setStockFilter(urlFilter as any);
            setActiveTab('parts');
        }
    }, [urlFilter]);

    // Service Modal State
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Partial<Service> | null>(null);
    const [savingService, setSavingService] = useState(false);

    // OS Part Modal State
    const [isPartModalOpen, setIsPartModalOpen] = useState(false);
    const [editingPart, setEditingPart] = useState<Partial<OsPart> | null>(null);
    const [savingPart, setSavingPart] = useState(false);

    // OS Purchase Modal State
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [partsSubTab, setPartsSubTab] = useState<'estoque' | 'compras'>('estoque');
    const [purchaseToEdit, setPurchaseToEdit] = useState<any>(null);

    // Purchase History (inline) State
    const [purchaseHistory, setPurchaseHistory] = useState<OsPurchaseOrder[]>([]);
    const [purchaseHistoryLoading, setPurchaseHistoryLoading] = useState(false);
    const [purchaseToCancel, setPurchaseToCancel] = useState<OsPurchaseOrder | null>(null);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [purchaseToView, setPurchaseToView] = useState<OsPurchaseOrder | null>(null);

    // Confirm delete modal state
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => { } });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [servicesData, partsData, suppliersData, warrantiesData, brandsData, categoriesData, modelsData, gradesData, gradeValuesData] = await Promise.all([
                getServices(),
                getOsParts(false), // todas, inclusive inativas para gestão
                getSuppliers(),
                getOsWarranties(),
                getBrands(),
                getCategories(),
                getProductModels(),
                getGrades(),
                getGradeValues()
            ]);
            setServices(servicesData);
            setOsParts(partsData);
            setSuppliers(suppliersData);
            setWarranties(warrantiesData);
            setBrands(brandsData);
            setCategories(categoriesData);
            setProductModels(modelsData);
            setGrades(gradesData);
            setGradeValues(gradeValuesData);
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

    const filteredParts = useMemo(() => {
        return osParts.filter(p => {
            if (!p.isActive) return false;

            // Filtro de estoque
            if (stockFilter === 'in_stock' && p.stock <= 0) return false;
            if (stockFilter === 'out' && p.stock > 0) return false;
            if (stockFilter === 'low') {
                const isLow = p.stock > 0 && p.minimumStock !== undefined && p.stock <= (p.minimumStock || 0);
                if (!isLow) return false;
            }

            // Filtro de busca
            if (searchTerm) {
                const s = searchTerm.toLowerCase();
                return (
                    p.name.toLowerCase().includes(s) ||
                    (p.brand || '').toLowerCase().includes(s) ||
                    (p.category || '').toLowerCase().includes(s) ||
                    (p.model || '').toLowerCase().includes(s)
                );
            }
            return true;
        });
    }, [osParts, searchTerm, stockFilter]);

    // Summary stats for OS stock
    const osStockStats = useMemo(() => {
        const activeParts = osParts.filter(p => p.isActive);
        const totalItems = activeParts.reduce((acc, p) => acc + (p.stock || 0), 0);
        const totalCost = activeParts.reduce((acc, p) => acc + (p.costPrice || 0) * (p.stock || 0), 0);
        const totalValue = activeParts.reduce((acc, p) => acc + (p.salePrice || 0) * (p.stock || 0), 0);
        const lowStock = activeParts.filter(p => p.stock > 0 && p.minimumStock !== undefined && p.stock <= (p.minimumStock || 0)).length;
        return { totalItems, totalCost, totalValue, lowStock };
    }, [osParts]);

    // Service Handlers
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
        setConfirmModal({
            open: true,
            title: 'Excluir Serviço?',
            message: 'Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.',
            onConfirm: async () => {
                setConfirmModal(m => ({ ...m, open: false }));
                try {
                    await deleteService(id);
                    showToast('Serviço excluído.', 'success');
                    fetchData();
                } catch (error) {
                    showToast('Erro ao excluir serviço.', 'error');
                }
            }
        });
    };

    // OS Part Handlers
    const handleSavePart = async (data: Partial<OsPart>) => {
        setSavingPart(true);
        try {
            if (data.id) {
                await updateOsPart(data.id, data, user?.id, user?.name);
                showToast('Peça atualizada no estoque OS!', 'success');
            } else {
                await addOsPart(data, user?.id, user?.name);
                showToast('Peça cadastrada no estoque OS!', 'success');
            }
            setIsPartModalOpen(false);
            setEditingPart(null);
            fetchData();
        } catch (error: any) {
            showToast(error.message || 'Erro ao salvar peça.', 'error');
        } finally {
            setSavingPart(false);
        }
    };

    const handleDeletePart = async (id: string) => {
        setConfirmModal({
            open: true,
            title: 'Excluir Peça?',
            message: 'A peça será excluída e não aparecerá mais no estoque OS.',
            onConfirm: async () => {
                setConfirmModal(m => ({ ...m, open: false }));
                try {
                    await deleteOsPart(id);
                    showToast('Peça removida do estoque OS.', 'success');
                    fetchData();
                } catch (error) {
                    showToast('Erro ao remover peça.', 'error');
                }
            }
        });
    };

    const handleSaveNewSupplier = async (data: any) => {
        try {
            const newSupplier = await addSupplier(data);
            showToast('Fornecedor cadastrado!', 'success');
            const updatedSuppliers = await getSuppliers();
            setSuppliers(updatedSuppliers);
            return newSupplier;
        } catch (error) {
            showToast('Erro ao cadastrar fornecedor.', 'error');
            return null;
        }
    };

    // Purchase History Handlers
    const fetchPurchaseHistory = async () => {
        setPurchaseHistoryLoading(true);
        try {
            const data = await getOsPurchaseOrders();
            setPurchaseHistory(data);
        } catch {
            showToast('Erro ao carregar histórico de compras.', 'error');
        } finally {
            setPurchaseHistoryLoading(false);
        }
    };

    useEffect(() => {
        if (partsSubTab === 'compras') fetchPurchaseHistory();
    }, [partsSubTab]);

    const handleMarkAsPaid = async (purchase: OsPurchaseOrder) => {
        try {
            await updateOsPurchaseFinancialStatus(purchase.id, 'Pago');
            showToast('Compra marcada como Paga.', 'success');
            fetchPurchaseHistory();
        } catch {
            showToast('Erro ao atualizar status.', 'error');
        }
    };

    const handleConfirmCancelPurchase = async (reason: string) => {
        if (!purchaseToCancel) return;
        try {
            await cancelOsPurchaseOrder(purchaseToCancel.id, reason);
            showToast('Compra cancelada com sucesso.', 'success');
            setIsCancelModalOpen(false);
            setPurchaseToCancel(null);
            fetchPurchaseHistory();
        } catch (error: any) {
            showToast(error.message || 'Erro ao cancelar.', 'error');
        }
    };

    if (loading && services.length === 0 && osParts.length === 0) return <GlobalLoading />;

    return (
        <div className="h-full flex flex-col space-y-6">
            <div className="flex flex-col gap-4 border-b border-gray-100 pb-5">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-xl shadow-sm">
                        <PackageIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Peças e Serviços</h1>
                        <p className="text-gray-500 text-sm font-medium">
                            Catálogo exclusivo de Ordens de Serviço —{' '}
                            <span className="text-amber-600 font-bold">Estoque separado do ERP principal</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                    <div className="flex p-1.5 bg-gray-100/90 rounded-[20px] border border-gray-200/70 gap-1 w-max shadow-sm">
                        <button
                            onClick={() => setActiveTab('parts')}
                            className={`px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'parts' ? 'bg-[#1a1b23] text-white shadow-md' : 'text-gray-500 hover:text-gray-800 hover:bg-white/80'}`}
                        >
                            Peças
                        </button>
                        <button
                            onClick={() => setActiveTab('services')}
                            className={`px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'services' ? 'bg-[#1a1b23] text-white shadow-md' : 'text-gray-500 hover:text-gray-800 hover:bg-white/80'}`}
                        >
                            Serviços
                        </button>
                    </div>
                </div>
            </div>

            {/* OS Stock Summary Cards — visível apenas na aba Peças */}
            {activeTab === 'parts' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Qtd. Itens</p>
                        <p className="text-2xl font-black text-gray-800 mt-1">{osStockStats.totalItems}</p>
                        <p className="text-xs text-gray-400 mt-0.5">unidades em estoque OS</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Custo Total</p>
                        <p className="text-xl font-black text-gray-800 mt-1">{formatCurrency(osStockStats.totalCost)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">investimento em peças OS</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Valor de Venda</p>
                        <p className="text-xl font-black text-emerald-600 mt-1">{formatCurrency(osStockStats.totalValue)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">potencial com preço de venda</p>
                    </div>
                    <div className={`rounded-2xl border shadow-sm p-4 ${osStockStats.lowStock > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                        <p className={`text-xs font-semibold uppercase tracking-wide ${osStockStats.lowStock > 0 ? 'text-red-600' : 'text-gray-500'}`}>Estoque Baixo</p>
                        <p className={`text-2xl font-black mt-1 ${osStockStats.lowStock > 0 ? 'text-red-700' : 'text-gray-800'}`}>{osStockStats.lowStock}</p>
                        <p className="text-xs text-gray-400 mt-0.5">peças abaixo do mínimo</p>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-center">
                <div className="flex items-center gap-3 w-full md:w-auto flex-1">
                    <div className="relative flex-1 max-w-sm">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder={activeTab === 'services' ? "Buscar serviços..." : "Buscar peças OS..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none text-sm"
                        />
                    </div>

                    {/* Stock filter — apenas na aba peças */}
                    {activeTab === 'parts' && (
                        <div className="flex items-center gap-1 bg-gray-100 rounded-2xl p-1 border border-gray-200 shrink-0">
                            {([
                                { key: 'all', label: 'Todos' },
                                { key: 'in_stock', label: 'Em Estoque' },
                                { key: 'out', label: 'Zerado' },
                                { key: 'low', label: 'Est. Baixo' },
                            ] as const).map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => setStockFilter(f.key)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all whitespace-nowrap ${stockFilter === f.key
                                        ? f.key === 'out' ? 'bg-red-600 text-white shadow-sm'
                                            : f.key === 'low' ? 'bg-red-500 text-white shadow-sm'
                                                : 'bg-gray-800 text-white shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
                                        }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex gap-2 shrink-0">
                    {activeTab === 'services' && (
                        <Button onClick={() => { setEditingService(null); setIsServiceModalOpen(true); }} icon={<PlusIcon className="h-5 w-5" />}>Novo Serviço</Button>
                    )}
                    {activeTab === 'parts' && (
                        <button
                            onClick={() => setIsPurchaseModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-xl text-sm font-black transition-all shadow-sm active:scale-95"
                        >
                            <PlusIcon className="h-4 w-4" />
                            Lançar Compra Peça/Suprimentos
                        </button>
                    )}
                </div>
            </div>

            {/* Sub-tabs for parts */}
            {
                activeTab === 'parts' && (
                    <div className="flex p-1.5 bg-gray-100/80 rounded-2xl border border-gray-200/60 gap-1 w-max shadow-sm">
                        <button
                            onClick={() => setPartsSubTab('estoque')}
                            className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${partsSubTab === 'estoque' ? 'bg-[#1a1b23] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-white/80'}`}
                        >
                            Estoque
                        </button>
                        <button
                            onClick={() => setPartsSubTab('compras')}
                            className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${partsSubTab === 'compras' ? 'bg-[#1a1b23] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-white/80'}`}
                        >
                            Compras (Histórico)
                        </button>
                    </div>
                )
            }

            {/* List Content */}
            <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                {activeTab === 'services' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">Serviço</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">Taxa/Garantia</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">Preço</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">Custo</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-900 uppercase tracking-wider">Ações</th>
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
                                            <td className="px-6 py-4 text-sm text-gray-500">{service.warranty || '-'}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatCurrency(service.price)}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{formatCurrency(service.cost)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => { setEditingService(service); setIsServiceModalOpen(true); }}
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
                ) : partsSubTab === 'compras' ? (
                    // Purchase History Inline View
                    <div className="overflow-x-auto flex-1">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                            <span className="p-2 bg-gray-900 rounded-xl text-white">
                                <ClockIcon className="h-5 w-5" />
                            </span>
                            <div>
                                <h2 className="text-lg font-black text-gray-900">Histórico de Compras de Peças/Insumos (OS)</h2>
                                <p className="text-xs text-gray-400">Todas as entradas de compras no estoque OS</p>
                            </div>
                        </div>
                        {purchaseHistoryLoading ? (
                            <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>
                        ) : purchaseHistory.length === 0 ? (
                            <div className="text-center p-12 text-gray-500">Nenhuma compra encontrada.</div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="p-4 text-xs font-bold text-gray-900 uppercase">Data/Hora</th>
                                        <th className="p-4 text-xs font-bold text-gray-900 uppercase">OS/ID</th>
                                        <th className="p-4 text-xs font-bold text-gray-900 uppercase">Fornecedor</th>
                                        <th className="p-4 text-xs font-bold text-gray-900 uppercase text-center">Itens</th>
                                        <th className="p-4 text-xs font-bold text-gray-900 uppercase text-right">Total</th>
                                        <th className="p-4 text-xs font-bold text-gray-900 uppercase text-center">Financeiro</th>
                                        <th className="p-4 text-xs font-bold text-gray-900 uppercase text-center">Status</th>
                                        <th className="p-4 text-xs font-bold text-gray-900 uppercase text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {purchaseHistory.map(p => {
                                        const dateLabel = formatDateBR(p.createdAt);
                                        const isCancelled = p.status === 'Cancelada';
                                        const canMarkAsPaid = !isCancelled && (p.financialStatus === 'Pendente' || p.financialStatus === 'A Prazo');
                                        return (
                                            <tr key={p.id} className={`transition-colors ${isCancelled ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50/50'}`}>
                                                <td className={`p-4 font-medium text-sm whitespace-nowrap ${isCancelled ? 'text-gray-400' : 'text-gray-900'}`}>
                                                    {dateLabel}<br /><span className="text-xs text-gray-400 font-normal">por {p.createdByName}</span>
                                                </td>
                                                <td className={`p-4 text-sm font-semibold ${isCancelled ? 'text-gray-400' : 'text-gray-600'}`}>#{p.displayId}</td>
                                                <td className={`p-4 text-sm ${isCancelled ? 'text-gray-400' : 'text-gray-800'}`}>{p.supplierName}</td>
                                                <td className={`p-4 text-sm text-center font-medium ${isCancelled ? 'text-gray-400' : 'text-gray-600'}`}>
                                                    {p.items.reduce((acc: number, i: any) => acc + i.quantity, 0)} un.
                                                </td>
                                                <td className={`p-4 text-sm font-bold text-right ${isCancelled ? 'text-gray-400' : 'text-gray-900'}`}>{formatCurrency(p.total)}</td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-1 text-xs font-bold rounded-xl ${isCancelled ? 'bg-gray-100 text-gray-400' : p.financialStatus === 'Pago' ? 'bg-green-100 text-green-700' :
                                                        p.financialStatus === 'A Prazo' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-orange-100 text-orange-700'
                                                        }`}>
                                                        {p.financialStatus}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-1 text-xs font-bold rounded-xl ${isCancelled ? 'bg-red-100 text-red-500' :
                                                        p.status === 'Finalizada' ? 'bg-green-100 text-green-700' :
                                                            'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {canMarkAsPaid && (
                                                            <button
                                                                onClick={() => handleMarkAsPaid(p)}
                                                                title="Marcar como Pago"
                                                                className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 rounded-lg transition-colors border border-green-200"
                                                            >
                                                                <SuccessIcon className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        {!isCancelled && (
                                                            <button onClick={() => setPurchaseToView(p)}
                                                                title="Visualizar"
                                                                className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded">
                                                                <EyeIcon className="h-5 w-5" />
                                                            </button>
                                                        )}
                                                        {!isCancelled && (
                                                            <button onClick={() => { setPurchaseToEdit(p); setIsPurchaseModalOpen(true); setPartsSubTab('estoque'); }}
                                                                title="Editar"
                                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                                                <EditIcon className="h-5 w-5" />
                                                            </button>
                                                        )}
                                                        {!isCancelled && (
                                                            <button onClick={() => { setPurchaseToCancel(p); setIsCancelModalOpen(true); }}
                                                                title="Cancelar Compra"
                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                                                                <XCircleIcon className="h-5 w-5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                ) : (
                    // OS Parts View
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="pl-4 pr-2 py-3 text-center text-xs font-bold text-gray-900 uppercase tracking-wider w-16">Estoque</th>
                                    <th className="pl-0 pr-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">Peça (Estoque OS)</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">Fornecedor</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">Local</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">Custo</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">Atacado</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">Venda</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">Garantia</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-900 uppercase tracking-wider">Un. Medida</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">Cadastro</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-900 uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredParts.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                                            <PackageIcon className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                                            <p className="font-semibold">Nenhuma peça no estoque OS.</p>
                                            <p className="text-sm mt-1">Use "Lançar Compra OS" ou "Nova Peça OS" para começar.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredParts.map((part) => {
                                        const supplierName = part.supplierId
                                            ? suppliers.find(s => s.id === part.supplierId)?.name || '-'
                                            : '-';
                                        const createdDate = part.createdAt
                                            ? new Date(part.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                            : '-';
                                        const createdTime = part.createdAt
                                            ? new Date(part.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                            : '';
                                        return (
                                            <tr key={part.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="pl-4 pr-2 py-3 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className={`px-2 py-1 text-sm font-bold rounded-xl border ${part.stock <= (part.minimumStock || 0) ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                                                            {part.stock}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="pl-0 pr-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-gray-900 truncate">{part.name}</p>
                                                            {(part.barcode || part.sku) && (
                                                                <p className="text-[10px] text-gray-400 mt-0.5 flex gap-2">
                                                                    {part.sku && <span>SKU: <strong>{part.sku}</strong></span>}
                                                                    {part.barcode && <span>Cód. Barras: <strong className="text-emerald-500">{part.barcode}</strong></span>}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 max-w-[140px] truncate" title={supplierName}>{supplierName}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600 truncate">{part.storageLocation || '-'}</td>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-700">{formatCurrency(part.costPrice)}</td>
                                                <td className="px-4 py-3 text-sm text-orange-600 font-bold">{formatCurrency(part.wholesalePrice || 0)}</td>
                                                <td className="px-4 py-3 text-sm text-emerald-600 font-medium">{formatCurrency(part.salePrice)}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600 truncate">{part.warranty || '-'}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="text-[10px] font-bold text-gray-600 uppercase">
                                                        {part.unit || 'Un'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="text-sm text-gray-700 font-medium whitespace-nowrap">{createdDate}</div>
                                                    <div className="text-[10px] text-gray-800 font-bold">{createdTime}</div>
                                                    {part.createdByName && (
                                                        <div className="text-[10px] text-gray-800 font-bold mt-0.5 truncate max-w-[120px]">por {part.createdByName}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => { setEditingPart(part); setIsPartModalOpen(true); }}
                                                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-primary transition-colors"
                                                            title="Editar"
                                                        >
                                                            <EditIcon className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePart(part.id)}
                                                            className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
                                                            title="Desativar"
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modals */}
            <ServiceModal
                isOpen={isServiceModalOpen}
                onClose={() => { setIsServiceModalOpen(false); setEditingService(null); }}
                onSave={handleSaveService}
                service={editingService}
                loading={savingService}
                warrantyOptions={warranties}
            />

            <OsPartModal
                isOpen={isPartModalOpen}
                onClose={() => { setIsPartModalOpen(false); setEditingPart(null); }}
                onSave={handleSavePart}
                part={editingPart}
                loading={savingPart}
                suppliers={suppliers}
                brands={brands}
                categories={categories}
                productModels={productModels}
                grades={grades}
                gradeValues={gradeValues}
                onSaveNewSupplier={handleSaveNewSupplier}
            />

            {
                isPurchaseModalOpen && (
                    <OsPurchaseModal
                        isOpen={isPurchaseModalOpen}
                        onClose={(refresh) => {
                            setIsPurchaseModalOpen(false);
                            setPurchaseToEdit(null);
                            if (refresh) fetchData();
                        }}
                        osParts={osParts}
                        suppliers={suppliers}
                        userId={user?.id}
                        userName={user?.name}
                        brands={brands}
                        categories={categories}
                        productModels={productModels}
                        grades={grades}
                        gradeValues={gradeValues}
                        purchaseOrderToEdit={purchaseToEdit}
                    />
                )
            }

            <DeleteWithReasonModal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                onConfirm={handleConfirmCancelPurchase}
                title="Cancelar Compra de OS"
                message={`Tem certeza que deseja cancelar a compra de OS #${purchaseToCancel?.displayId}?`}
            />

            {
                purchaseToView && (
                    <OsPurchaseDetailModal
                        purchase={purchaseToView}
                        onClose={() => setPurchaseToView(null)}
                    />
                )
            }
            {/* Modal de Confirmação Customizado */}
            {confirmModal.open && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="p-8 flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mb-5">
                                <AlertTriangle className="text-red-500" size={32} strokeWidth={2} />
                            </div>
                            <h2 className="text-xl font-black text-gray-900 mb-2">{confirmModal.title}</h2>
                            <p className="text-sm text-gray-500 font-medium">{confirmModal.message}</p>
                        </div>
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={() => setConfirmModal(m => ({ ...m, open: false }))}
                                className="flex-1 h-12 rounded-2xl border-2 border-gray-200 text-sm font-black text-gray-600 hover:bg-gray-50 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmModal.onConfirm}
                                className="flex-1 h-12 rounded-2xl bg-red-500 text-white text-sm font-black shadow-lg shadow-red-200 transition-all hover:bg-red-600 flex items-center justify-center gap-2"
                            >
                                <TrashIcon className="h-4 w-4" />
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default ServiceOrderProducts;
