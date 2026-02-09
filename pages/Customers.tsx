
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Customer, Sale, Product, Supplier, PurchaseOrder, PermissionSet, User } from '../types.ts';
import {
    getCustomers, addCustomer, updateCustomer, deleteCustomer, getCustomerSales, getCustomerById,
    getProducts, getSuppliers, addSupplier, updateSupplier, deleteSupplier,
    getPurchaseOrders, getSales,
    formatCurrency,
    getUsers
} from '../services/mockApi.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import ConfirmationModal from '../components/ConfirmationModal.tsx';
import CustomerModal from '../components/CustomerModal.tsx';
import SupplierHistoryModal from '../components/SupplierHistoryModal.tsx';
import { SpinnerIcon, EditIcon, TrashIcon, SearchIcon, PlusIcon, UserCircleIcon, ClockIcon, ArrowsUpDownIcon, BirthdayCakeIcon, ChevronDownIcon, ChartBarIcon, WhatsAppIcon, InstagramIcon, EyeSlashIcon, CurrencyDollarIcon, CheckIcon, CloseIcon } from '../components/icons.tsx';
import { SuspenseFallback } from '../components/GlobalLoading.tsx';
import SaleDetailModal from '../components/SaleDetailModal.tsx';

// --- Customer Components ---

const PurchaseHistoryModal: React.FC<{
    customer: Customer;
    sales: Sale[];
    users: User[];
    onClose: () => void;
    productMap: Record<string, Product>;
    onViewSale: (sale: Sale) => void;
}> = ({ customer, sales, users, onClose, productMap, onViewSale }) => {
    const [activeTab, setActiveTab] = useState('purchases');

    const modalContent = (
        <div className="fixed inset-0 flex justify-center items-center p-0 sm:p-4" style={{ zIndex: 50 }}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal Container */}
            <div className="relative bg-surface w-full h-full sm:h-auto sm:max-h-[95vh] sm:rounded-3xl shadow-xl sm:max-w-3xl flex flex-col overflow-hidden border border-border">
                {/* Fixed Header */}
                <div className="flex justify-between items-center p-4 border-b bg-white flex-shrink-0">
                    <h2 className="text-lg font-bold text-primary">Histórico de {customer.name}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600 transition-colors"
                    >
                        <CloseIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* Debt Section */}
                    {(() => {
                        const debtDetails = sales.reduce((acc, sale) => {
                            if (sale.status === 'Cancelada') return acc;
                            const pendingAmount = sale.payments
                                .filter(p => p.type === 'pending')
                                .reduce((sum, p) => sum + p.value, 0);

                            if (pendingAmount > 0) {
                                const salesperson = users.find(u => u.id === sale.salespersonId)?.name || 'Desconhecido';
                                const internalNote = sale.payments.find(p => p.type === 'pending')?.internalNote;
                                acc.push({
                                    id: sale.cashSessionDisplayId ? `${sale.cashSessionDisplayId}` : sale.id.substring(0, 8),
                                    fullId: sale.id,
                                    date: sale.date,
                                    amount: pendingAmount,
                                    salesperson,
                                    internalNote
                                });
                            }
                            return acc;
                        }, [] as { id: string, fullId: string, date: string, amount: number, salesperson: string }[]);

                        const totalDebt = debtDetails.reduce((sum, d) => sum + d.amount, 0);

                        if (totalDebt > 0) {
                            return (
                                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="p-3 flex items-center justify-between border-b border-red-200 bg-red-100/30">
                                        <span className="text-red-800 font-bold flex items-center gap-2 text-sm">
                                            <span className="w-2 h-2 rounded-full bg-red-600"></span>
                                            Valor em Aberto (Dívida)
                                        </span>
                                        <span className="text-lg font-black text-red-700">{formatCurrency(totalDebt)}</span>
                                    </div>
                                    <div className="max-h-32 overflow-y-auto bg-white/50">
                                        {debtDetails.map((debt, index) => (
                                            <div key={index} className="flex justify-between items-start p-2 border-b border-red-100 last:border-0">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-red-900 text-xs">Venda #{debt.id}</span>
                                                    <span className="text-red-700 text-[10px]">
                                                        {new Date(debt.date).toLocaleDateString('pt-BR')} às {new Date(debt.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        <span className="ml-2">Vend: {debt.salesperson}</span>
                                                    </span>
                                                    {debt.internalNote && (
                                                        <div className="mt-1 text-[10px] text-blue-600 font-bold italic">
                                                            Nota: {debt.internalNote}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="font-bold text-red-700 text-sm">{formatCurrency(debt.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    {/* Tabs */}
                    <div className="border-b border-border mb-4">
                        <nav className="-mb-px flex space-x-4">
                            <button onClick={() => setActiveTab('purchases')} className={`py-2 px-1 border-b-2 text-sm font-bold ${activeTab === 'purchases' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-primary'}`}>Compras</button>
                            <button onClick={() => setActiveTab('tradeins')} className={`py-2 px-1 border-b-2 text-sm font-bold ${activeTab === 'tradeins' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-primary'}`}>Trocas / Vendas para Loja</button>
                        </nav>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'purchases' && (
                        sales.length === 0 ? <p className="text-muted text-center py-4">Nenhuma compra encontrada.</p> : (
                            <ul className="space-y-3">
                                {[...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(sale => (
                                    <li key={sale.id} className="border border-border p-3 rounded-xl bg-surface-secondary">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold mb-1">
                                                    <div className="flex items-center gap-1.5 text-primary">
                                                        <ClockIcon className="h-3 w-3" />
                                                        <span>{new Date(sale.date).toLocaleDateString('pt-BR')} às {new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                                    </div>
                                                    <span className='text-success bg-success/5 px-2 py-0.5 rounded-lg border border-success/10'>{formatCurrency(sale.total)}</span>
                                                </div>
                                                <ul className="text-xs text-muted">
                                                    {sale.items.map((item, index) => (
                                                        <li key={index}>- {productMap[item.productId]?.model || 'Produto desconhecido'} (x{item.quantity})</li>
                                                    ))}
                                                </ul>
                                                <div className="mt-2 pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
                                                    <div className="text-[10px] text-muted">
                                                        <span className="font-semibold">Pagamento: </span>
                                                        {sale.payments.map(p => {
                                                            const isWithInterest = p.type === 'Com Juros';
                                                            return (
                                                                <div key={p.id} className="mb-1 last:mb-0">
                                                                    <div className="flex justify-between items-center">
                                                                        <p className="font-medium text-primary">{p.method}</p>
                                                                        <span className="font-semibold">{formatCurrency(p.value + (p.fees || 0))}</span>
                                                                    </div>
                                                                    {p.type !== 'Sem Juros' && (
                                                                        <div className="flex justify-between">
                                                                            <span>{isWithInterest ? 'Juros' : 'Taxa do Vendedor'} ({p.feePercentage?.toFixed(2)}%):</span>
                                                                            <span className="font-medium">{formatCurrency(p.fees)}</span>
                                                                        </div>
                                                                    )}
                                                                    {p.internalNote && (
                                                                        <div className="mt-1 text-[10px] text-blue-600 font-bold italic">
                                                                            Nota: {p.internalNote}
                                                                        </div>
                                                                    )}
                                                                    {p.tradeInDetails && (
                                                                        <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-muted space-y-0.5">
                                                                            <p className="font-semibold text-primary">{p.tradeInDetails.model}</p>
                                                                            <p>
                                                                                {p.tradeInDetails.imei1 ? `IMEI: ${p.tradeInDetails.imei1}` : `S/N: ${p.tradeInDetails.serialNumber}`}
                                                                                {p.tradeInDetails.batteryHealth && (p.tradeInDetails as any).condition !== 'Novo' ? ` | Bateria: ${p.tradeInDetails.batteryHealth}%` : ''}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="text-[10px] text-muted flex items-center gap-1">
                                                        <UserCircleIcon className="h-3 w-3" />
                                                        <span>{users.find(u => u.id === sale.salespersonId)?.name || 'Desconhecido'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={() => onViewSale(sale)} className="ml-2 px-2 py-1 bg-gray-200 text-secondary text-xs font-semibold rounded-xl hover:bg-gray-300">
                                                Ver
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )
                    )}
                    {activeTab === 'tradeins' && (
                        (!customer.tradeInHistory || customer.tradeInHistory.length === 0) ? <p className="text-muted text-center py-4">Nenhuma troca/venda encontrada.</p> : (
                            <ul className="space-y-3">
                                {[...customer.tradeInHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tradeIn => (
                                    <li key={tradeIn.id} className="border border-border p-3 rounded-xl bg-surface-secondary">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="block font-bold text-primary text-sm">{tradeIn.model}</span>
                                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted mt-1">
                                                    <span className="font-bold bg-gray-100 px-1.5 py-0.5 rounded-lg text-gray-700">ID Venda: #{tradeIn.saleId}</span>
                                                    <div className="flex items-center gap-1">
                                                        <ClockIcon className="h-3 w-3" />
                                                        <span>{new Date(tradeIn.date).toLocaleDateString('pt-BR')} às {new Date(tradeIn.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                                    </div>
                                                </div>
                                                <div className="text-[10px] text-muted flex items-center gap-1 mt-1">
                                                    <UserCircleIcon className="h-3 w-3" />
                                                    <span>Vendedor: {tradeIn.salespersonName}</span>
                                                </div>
                                            </div>
                                            <span className='text-success font-black text-base'>{formatCurrency(tradeIn.value)}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/50 text-[10px]">
                                            <div className="space-y-0.5">
                                                {tradeIn.imei1 && <p><span className="font-bold text-gray-500">IMEI 1:</span> <span className="font-mono">{tradeIn.imei1}</span></p>}
                                                {tradeIn.imei2 && <p><span className="font-bold text-gray-500">IMEI 2:</span> <span className="font-mono">{tradeIn.imei2}</span></p>}
                                            </div>
                                            <div className="space-y-0.5 text-right">
                                                {tradeIn.serialNumber && <p><span className="font-bold text-gray-500">S/N:</span> <span className="font-mono">{tradeIn.serialNumber}</span></p>}
                                                {tradeIn.batteryHealth !== undefined && tradeIn.batteryHealth !== null && (
                                                    <p><span className="font-bold text-gray-500">Bateria:</span> <span className={`font-bold ${tradeIn.batteryHealth < 80 ? 'text-red-500' : 'text-green-600'}`}>{tradeIn.batteryHealth}%</span></p>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )
                    )}
                </div>

                {/* Fixed Footer */}
                <div className="flex justify-end p-4 border-t bg-gray-50 flex-shrink-0">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-secondary rounded-xl hover:bg-gray-300 font-semibold text-sm">Fechar</button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

// --- Date Helper ---
const parseBrazilianDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    // Handle dd/mm/yyyy format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // months are 0-indexed
        const year = parseInt(parts[2], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            return new Date(year, month, day);
        }
    }
    // Fallback: try ISO format
    const date = new Date(dateStr + 'T00:00:00');
    return isNaN(date.getTime()) ? null : date;
};

// --- Main Page Component ---

const isBirthdayInPeriod = (birthDateStr: string | undefined, period: 'dia' | 'semana' | 'mês'): boolean => {
    if (!birthDateStr) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const birthDate = parseBrazilianDate(birthDateStr);
    if (!birthDate) return false;

    const birthMonth = birthDate.getMonth();
    const birthDay = birthDate.getDate();

    switch (period) {
        case 'dia':
            return birthMonth === today.getMonth() && birthDay === today.getDate();

        case 'semana':
            const endOfWeek = new Date(today);
            endOfWeek.setDate(today.getDate() + 6);

            const birthdayThisYear = new Date(today.getFullYear(), birthMonth, birthDay);
            if (birthdayThisYear >= today && birthdayThisYear <= endOfWeek) {
                return true;
            }

            if (endOfWeek.getFullYear() > today.getFullYear()) {
                const birthdayNextYear = new Date(today.getFullYear() + 1, birthMonth, birthDay);
                if (birthdayNextYear >= today && birthdayNextYear <= endOfWeek) {
                    return true;
                }
            }
            return false;

        case 'mês':
            return birthMonth === today.getMonth();
    }
    return false;
};


const CustomersAndSuppliers: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'clientes' | 'fornecedores'>('clientes');
    const { showToast } = useToast();
    const { permissions, user } = useUser();

    // Common states
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntity, setEditingEntity] = useState<Partial<Customer & Supplier> | null>(null);

    // Customer states
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
    const [customerSales, setCustomerSales] = useState<Sale[]>([]);
    const [customerForHistory, setCustomerForHistory] = useState<Customer | null>(null);
    const [customerToInactivate, setCustomerToInactivate] = useState<Customer | null>(null);
    const [showInactive, setShowInactive] = useState(false);
    const [productMap, setProductMap] = useState<Record<string, Product>>({});
    const [products, setProducts] = useState<Product[]>([]);
    const [customerSortOrder, setCustomerSortOrder] = useState<'newest' | 'oldest'>('newest');
    const [birthdayFilter, setBirthdayFilter] = useState<'none' | 'dia' | 'semana' | 'mês'>('none');
    const [isBirthdayDropdownOpen, setIsBirthdayDropdownOpen] = useState(false);
    const birthdayDropdownRef = useRef<HTMLDivElement>(null);
    const [rankingFilter, setRankingFilter] = useState<'none' | 'highest' | 'lowest'>('none');
    const [isRankingDropdownOpen, setIsRankingDropdownOpen] = useState(false);
    const rankingDropdownRef = useRef<HTMLDivElement>(null);
    const [allSales, setAllSales] = useState<Sale[]>([]);
    const [saleToView, setSaleToView] = useState<Sale | null>(null);

    // Supplier states
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
    const [supplierSortOrder, setSupplierSortOrder] = useState<'newest' | 'oldest'>('newest');
    const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
    const [supplierForHistory, setSupplierForHistory] = useState<Supplier | null>(null);
    const [supplierPurchases, setSupplierPurchases] = useState<PurchaseOrder[]>([]);

    // Filters logic
    const [showDebtorsOnly, setShowDebtorsOnly] = useState(false);

    // Shared data
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        if (searchParams.get('filter') === 'debtors') {
            setShowDebtorsOnly(true);
            setActiveTab('clientes');
        }
    }, [searchParams]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (birthdayDropdownRef.current && !birthdayDropdownRef.current.contains(event.target as Node)) {
                setIsBirthdayDropdownOpen(false);
            }
            if (rankingDropdownRef.current && !rankingDropdownRef.current.contains(event.target as Node)) {
                setIsRankingDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchData = useCallback(async (retryCount = 0) => {
        setLoading(true);
        try {
            const [customersData, productsData, suppliersData, purchasesData, usersData] = await Promise.all([
                getCustomers(false), getProducts(), getSuppliers(), getPurchaseOrders(), getUsers()
            ]);
            setCustomers(customersData);
            setSuppliers(suppliersData);
            setProductMap(productsData.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}));
            setProducts(productsData);
            setPurchases(purchasesData);
            setUsers(usersData);

            // Fetch sales separately so it doesn't block customers from loading
            try {
                const salesData = await getSales();
                setAllSales(salesData);
            } catch (salesError) {
                console.error('Error loading sales (non-critical):', salesError);
                setAllSales([]);
            }
        } catch (error) {
            console.error('Customers: Error loading data:', error);

            // Auto-retry once after short delay (handles reconnection issues after idle)
            if (retryCount < 1) {
                setTimeout(() => fetchData(retryCount + 1), 2000);
                return;
            }

            showToast('Erro ao carregar dados.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const availableTabs = useMemo(() => {
        const tabs = [];
        if (permissions?.canAccessClientes) {
            tabs.push({ id: 'clientes', label: 'Clientes' });
        }
        if (permissions?.canAccessFornecedores) {
            tabs.push({ id: 'fornecedores', label: 'Fornecedores' });
        }
        return tabs;
    }, [permissions]);

    useEffect(() => {
        if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
            setActiveTab(availableTabs[0].id as 'clientes' | 'fornecedores');
        }
    }, [availableTabs, activeTab]);

    const handleOpenModal = (entity: Partial<Customer & Supplier> | null = null) => {
        setEditingEntity(entity);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingEntity(null);
    };

    const [isSaving, setIsSaving] = useState(false);

    const handleSaveEntity = async (entityData: any, entityType: 'Cliente' | 'Fornecedor' | 'Ambos', personType: 'Pessoa Física' | 'Pessoa Jurídica') => {
        if (isSaving) return; // Prevent duplicate calls
        setIsSaving(true);
        try {
            const isEditing = !!entityData.id;
            const originTab = activeTab; // 'clientes' or 'fornecedores'

            // --- Lógica para Cliente ---
            if (entityType === 'Cliente' || entityType === 'Ambos') {
                const customerPayload: any = {
                    name: entityData.name,
                    email: entityData.email,
                    phone: entityData.phone,
                    address: entityData.address,
                    avatarUrl: entityData.avatarUrl,
                    instagram: entityData.instagram,
                };
                if (personType === 'Pessoa Física') {
                    customerPayload.cpf = entityData.cpf;
                    customerPayload.rg = entityData.rg;
                    customerPayload.birthDate = entityData.birthDate;
                }

                if (isEditing && originTab === 'clientes') {
                    await updateCustomer({ ...customerPayload, id: entityData.id });
                } else {
                    await addCustomer(customerPayload);

                    // Se moveu de Fornecedor para Cliente (exclusivo), tenta apagar o fornecedor antigo
                    if (isEditing && originTab === 'fornecedores' && entityType === 'Cliente') {
                        try {
                            await deleteSupplier(entityData.id);
                            showToast('Fornecedor movido para Cliente com sucesso!', 'success');
                        } catch (e) {
                            console.warn("Could not delete original supplier:", e);
                            showToast('Novo cliente criado, mas o fornecedor original não pôde ser excluído (possui vínculos).', 'warning');
                        }
                    }
                }
            }

            // --- Lógica para Fornecedor ---
            if (entityType === 'Fornecedor' || entityType === 'Ambos') {
                const supplierPayload: any = {
                    name: entityData.name,
                    contactPerson: entityData.name,
                    email: entityData.email,
                    phone: entityData.phone,
                    avatarUrl: entityData.avatarUrl,
                    instagram: entityData.instagram,
                    cpf: undefined,
                    rg: undefined,
                    birthDate: undefined,
                    cnpj: undefined
                };

                if (personType === 'Pessoa Física') {
                    supplierPayload.cpf = entityData.cpf;
                    supplierPayload.rg = entityData.rg;
                    supplierPayload.birthDate = entityData.birthDate;
                } else {
                    supplierPayload.cnpj = entityData.cnpj;
                }

                if (entityData.address) {
                    const addr = entityData.address;
                    supplierPayload.address = typeof addr === 'string' ? addr :
                        `${addr.street || ''} ${addr.number || ''}, ${addr.neighborhood || ''} - ${addr.city || ''}/${addr.state || ''}`;
                }

                if (isEditing && originTab === 'fornecedores') {
                    await updateSupplier({ ...supplierPayload, id: entityData.id });
                } else {
                    await addSupplier(supplierPayload);

                    // Se moveu de Cliente para Fornecedor (exclusivo), tenta apagar o cliente antigo
                    if (isEditing && originTab === 'clientes' && entityType === 'Fornecedor') {
                        try {
                            await deleteCustomer(entityData.id);
                            showToast('Cliente movido para Fornecedor com sucesso!', 'success');
                        } catch (e) {
                            console.warn("Could not delete original customer:", e);
                            showToast('Novo fornecedor criado, mas o cliente original não pôde ser excluído (possui vendas vinculadas).', 'warning');
                        }
                    }
                }
            }

            if (!((isEditing && originTab === 'fornecedores' && entityType === 'Cliente') || (isEditing && originTab === 'clientes' && entityType === 'Fornecedor'))) {
                showToast('Dados salvos com sucesso!', 'success');
            }

            fetchData();
            handleCloseModal();
        } catch (error: any) {
            console.error("Erro ao salvar entidade:", error);
            showToast(error.message || 'Erro ao salvar.', 'error');
        } finally {
            setIsSaving(false);
        }
    };


    const customerStats = useMemo(() => {
        const totals = new Map<string, number>();
        const debts = new Map<string, number>();

        allSales.forEach(sale => {
            if (sale.status !== 'Cancelada') {
                const current = totals.get(sale.customerId) || 0;
                totals.set(sale.customerId, current + sale.total);

                const debt = sale.payments.filter(p => p.type === 'pending').reduce((sum, p) => sum + p.value, 0);
                if (debt > 0) {
                    const currentDebt = debts.get(sale.customerId) || 0;
                    debts.set(sale.customerId, currentDebt + debt);
                }
            }
        });

        return { totals, debts };
    }, [allSales]);

    // --- Customer Logic ---
    const filteredCustomers = useMemo(() => {
        // Se showInactive está ligado, mostra APENAS os inativos. Se desligado, mostra apenas os ativos.
        let filtered = customers.filter(c => (showInactive ? c.active === false : c.active !== false) && ((c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || c.email?.toLowerCase().includes(searchTerm.toLowerCase())));

        if (birthdayFilter !== 'none') {
            filtered = filtered.filter(c => isBirthdayInPeriod(c.birthDate, birthdayFilter));
        }

        const customersWithStats = filtered.map(c => ({
            ...c,
            totalPurchases: customerStats.totals.get(c.id) || 0,
            debt: customerStats.debts.get(c.id) || 0
        }));

        let result = customersWithStats;
        if (showDebtorsOnly) {
            result = result.filter(c => c.debt > 0);
        }

        return result.sort((a, b) => {
            if (rankingFilter === 'highest') {
                return b.totalPurchases - a.totalPurchases;
            }
            if (rankingFilter === 'lowest') {
                return a.totalPurchases - b.totalPurchases;
            }

            if (customerSortOrder === 'newest') {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
    }, [customers, searchTerm, customerSortOrder, birthdayFilter, rankingFilter, allSales, showDebtorsOnly]);

    const handleDeleteCustomerConfirm = async () => {
        if (!customerToDelete) return;
        try {
            await deleteCustomer(customerToDelete.id, user?.id, user?.name);
            showToast('Cliente excluído com sucesso!', 'success');
            fetchData(); setCustomerToDelete(null);
        } catch (error: any) {
            console.error('Error deleting customer:', error);
            if (error.message?.includes('vínculos') || error.code === '23503') {
                showToast('Este cliente possui histórico e não pode ser excluído. Use a opção de Inativar.', 'warning');
            } else {
                showToast('Erro ao excluir cliente.', 'error');
            }
            setCustomerToDelete(null);
        }
    };

    const handleInactivateCustomerConfirm = async () => {
        if (!customerToInactivate) return;
        try {
            const newStatus = customerToInactivate.active === false;
            await updateCustomer({ id: customerToInactivate.id, active: newStatus }, user?.id, user?.name);
            showToast(`Cliente ${newStatus ? 'reativado' : 'inativado'} com sucesso!`, 'success');
            fetchData();
            setCustomerToInactivate(null);
        } catch (error) {
            console.error('Error toggling customer active status:', error);
            showToast('Erro ao alterar status do cliente.', 'error');
        }
    };
    const handleViewHistory = async (customer: Customer) => {
        // Fetch fresh customer data directly from DB (no cache) to ensure tradeInHistory is up to date
        const freshCustomer = await getCustomerById(customer.id);

        const sales = await getCustomerSales(customer.id);
        setCustomerSales(sales);
        setCustomerForHistory(freshCustomer || customer);
        setIsHistoryOpen(true);
    }

    // --- Supplier Logic ---
    const filteredSuppliers = useMemo(() => {
        const filtered = suppliers.filter(s => (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || s.cnpj?.toLowerCase().includes(searchTerm.toLowerCase()));
        return filtered.sort((a, b) => {
            const dateA = new Date(a.createdAt || (a as any).created_at || 0).getTime();
            const dateB = new Date(b.createdAt || (b as any).created_at || 0).getTime();
            return supplierSortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });
    }, [suppliers, searchTerm, supplierSortOrder]);

    const handleDeleteSupplierConfirm = async () => {
        if (!supplierToDelete) return;
        try {
            await deleteSupplier(supplierToDelete.id, user?.id, user?.name);
            showToast('Fornecedor excluído com sucesso!', 'success');
            fetchData(); setSupplierToDelete(null);
        } catch (error) { showToast('Erro ao excluir fornecedor.', 'error'); }
    };
    const handleViewSupplierHistory = (supplier: Supplier) => {
        const history = purchases.filter(p => p.supplierId === supplier.id);
        setSupplierPurchases(history);
        setSupplierForHistory(supplier);
    };

    const renderCustomersTab = () => (
        <div className="bg-surface rounded-3xl border border-border p-4 sm:p-6 shadow-sm">
            {/* Mobile Header: Full Width Search & Scrollable Filters */}
            <div className="flex flex-col gap-3 mb-4 md:hidden">
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou email..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10 h-11 border rounded-xl w-full bg-white border-gray-200 focus:ring-primary focus:border-primary text-[13px] shadow-sm outline-none transition-all"
                    />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4">
                    <button
                        onClick={() => setCustomerSortOrder(o => o === 'newest' ? 'oldest' : 'newest')}
                        className="shrink-0 h-10 px-4 bg-gray-100 text-gray-700 rounded-xl border border-gray-200 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider hover:bg-gray-200 active:bg-gray-300 shadow-sm transition-all"
                    >
                        <ArrowsUpDownIcon className="h-4 w-4 text-gray-500" />
                        {customerSortOrder === 'newest' ? 'Recentes' : 'Antigos'}
                    </button>

                    <div className="relative shrink-0">
                        <select
                            value={birthdayFilter}
                            onChange={e => setBirthdayFilter(e.target.value as any)}
                            className="appearance-none h-10 px-9 py-1.5 bg-gray-100 border border-gray-200 rounded-xl text-[10px] font-bold uppercase tracking-wider text-gray-700 focus:outline-none focus:ring-0 shadow-sm hover:bg-gray-200 transition-all"
                        >
                            <option value="none">Aniversários</option>
                            <option value="dia">Hoje</option>
                            <option value="semana">Semana</option>
                            <option value="mês">Mês</option>
                        </select>
                        <BirthdayCakeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pink-500 pointer-events-none" />
                        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
                    </div>

                    <button
                        onClick={() => setShowDebtorsOnly(prev => !prev)}
                        className={`shrink-0 h-10 px-4 rounded-xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all ${showDebtorsOnly ? 'bg-red-500 text-white border border-red-600' : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'}`}
                    >
                        <CurrencyDollarIcon className={`h-4 w-4 ${showDebtorsOnly ? 'text-white' : 'text-red-500'}`} />
                        <span>Devedores ({customers.filter(c => c.active !== false && (customerStats.debts.get(c.id) || 0) > 0).length})</span>
                    </button>

                    <button
                        onClick={() => setShowInactive(prev => !prev)}
                        className={`shrink-0 h-10 px-4 rounded-xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all ${showInactive ? 'bg-orange-500 text-white border border-orange-600' : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'}`}
                    >
                        <EyeSlashIcon className={`h-4 w-4 ${showInactive ? 'text-white' : 'text-orange-500'}`} />
                        <span>Inativos ({customers.filter(c => c.active === false).length})</span>
                    </button>
                </div>

                {permissions?.canCreateCustomer && (
                    <button onClick={() => handleOpenModal()} className="w-full h-12 bg-gray-800 text-white rounded-xl hover:bg-gray-700 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all">
                        <PlusIcon className="h-5 w-5" /> Adicionar Cliente
                    </button>
                )}
            </div>

            {/* Desktop Header */}
            <div className="hidden md:flex justify-between items-center mb-6 gap-3 bg-white/50 p-2 rounded-2xl border border-gray-100 shadow-sm relative z-50 flex-wrap lg:flex-nowrap">
                <div className="flex items-center gap-2 flex-grow lg:flex-grow-0">
                    <div className="relative min-w-[240px] flex-grow">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><SearchIcon className="h-4 w-4" /></span>
                        <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-10 border rounded-xl w-full bg-white border-gray-200 focus:ring-primary focus:border-primary text-[13px] outline-none transition-all shadow-sm" />
                    </div>

                    <button
                        onClick={() => setCustomerSortOrder(o => o === 'newest' ? 'oldest' : 'newest')}
                        className="h-10 px-3 bg-gray-100 text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-200 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap shadow-sm"
                    >
                        <ArrowsUpDownIcon className="h-4 w-4 text-gray-500" />
                        <span>{customerSortOrder === 'newest' ? 'Recentes' : 'Antigos'}</span>
                    </button>

                    <div className="relative" ref={birthdayDropdownRef}>
                        <button
                            onClick={() => setIsBirthdayDropdownOpen(prev => !prev)}
                            className={`h-10 px-3 rounded-xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap border ${birthdayFilter !== 'none' ? 'bg-pink-500 text-white border-pink-600 shadow-sm' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}
                        >
                            <BirthdayCakeIcon className={`h-4 w-4 ${birthdayFilter !== 'none' ? 'text-white' : 'text-pink-500'}`} />
                            <span>Aniversariantes</span>
                            <ChevronDownIcon className={`h-3 w-3 transition-transform ${isBirthdayDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isBirthdayDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-100 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                                <button onClick={() => { setBirthdayFilter('dia'); setIsBirthdayDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider hover:bg-gray-50 rounded-t-xl transition-colors">Do Dia</button>
                                <button onClick={() => { setBirthdayFilter('semana'); setIsBirthdayDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors">Da Semana</button>
                                <button onClick={() => { setBirthdayFilter('mês'); setIsBirthdayDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors">Do Mês</button>
                                <div className="border-t border-gray-100"></div>
                                <button onClick={() => { setBirthdayFilter('none'); setIsBirthdayDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-50 rounded-b-xl transition-colors">Limpar</button>
                            </div>
                        )}
                    </div>

                    <div className="relative" ref={rankingDropdownRef}>
                        <button
                            onClick={() => setIsRankingDropdownOpen(prev => !prev)}
                            className={`h-10 px-3 rounded-xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap border ${rankingFilter !== 'none' ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}
                        >
                            <ChartBarIcon className={`h-4 w-4 ${rankingFilter !== 'none' ? 'text-white' : 'text-indigo-500'}`} />
                            <span>Ranking</span>
                            <ChevronDownIcon className={`h-3 w-3 transition-transform ${isRankingDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isRankingDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                                <button onClick={() => { setRankingFilter('highest'); setIsRankingDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider hover:bg-gray-50 rounded-t-xl transition-colors">Mais Compram</button>
                                <button onClick={() => { setRankingFilter('lowest'); setIsRankingDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors">Menos Compram</button>
                                <div className="border-t border-gray-100"></div>
                                <button onClick={() => { setRankingFilter('none'); setIsRankingDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-50 rounded-b-xl transition-colors">Limpar</button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setShowDebtorsOnly(prev => !prev)}
                        className={`h-10 px-3 rounded-xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap border ${showDebtorsOnly ? 'bg-red-600 text-white border-red-700 shadow-sm' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}
                    >
                        <CurrencyDollarIcon className={`h-4 w-4 ${showDebtorsOnly ? 'text-white' : 'text-red-500'}`} />
                        <span>Devedores ({customers.filter(c => c.active !== false && (customerStats.debts.get(c.id) || 0) > 0).length})</span>
                    </button>

                    <button
                        onClick={() => setShowInactive(prev => !prev)}
                        className={`h-10 px-3 rounded-xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap border ${showInactive ? 'bg-orange-500 text-white border-orange-600 shadow-sm' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}
                    >
                        <EyeSlashIcon className={`h-4 w-4 ${showInactive ? 'text-white' : 'text-orange-500'}`} />
                        <span>Inativos ({customers.filter(c => c.active === false).length})</span>
                    </button>
                </div>

                {permissions?.canCreateCustomer && (
                    <button onClick={() => handleOpenModal()} className="h-10 px-5 bg-gray-800 text-white rounded-xl hover:bg-gray-700 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider shadow-sm transition-all active:scale-95 whitespace-nowrap shrink-0">
                        <PlusIcon className="h-5 w-5" /> Adicionar Cliente
                    </button>
                )}
            </div>

            {loading ? <div className="flex justify-center py-8"><SuspenseFallback /></div> : (
                filteredCustomers.length === 0 ? <p className="text-center text-muted py-8">Nenhum cliente encontrado.</p> : (
                    <>
                        {/* Mobile View: Ultra Compact Strip Cards */}
                        <div className="md:hidden space-y-2">
                            {filteredCustomers.map(customer => (
                                <div key={customer.id} className="bg-white/60 backdrop-blur-sm p-3 rounded-3xl border border-white/40 shadow-sm relative overflow-hidden">
                                    <div className="flex items-start gap-3">
                                        {/* Avatar Left */}
                                        <div className="relative shrink-0">
                                            {customer.avatarUrl ? (
                                                <img src={customer.avatarUrl} alt={customer.name} className="h-10 w-10 rounded-xl object-cover border border-gray-100" />
                                            ) : (
                                                <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                                                    <UserCircleIcon className="h-6 w-6" />
                                                </div>
                                            )}
                                            {customer.isBlocked && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
                                        </div>

                                        {/* Content Middle */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-gray-900 truncate text-[13px] sm:text-sm">{customer.name}</h3>
                                                {customer.active === false && (
                                                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-xl bg-orange-100 text-orange-700 border border-orange-200 uppercase">Inativo</span>
                                                )}
                                            </div>
                                            {/* Tag + Phone on same line */}
                                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                                {suppliers.some(s => s.name.trim().toLowerCase() === customer.name.trim().toLowerCase()) && (
                                                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                        Cliente & Fornecedor
                                                    </span>
                                                )}
                                                <span className="text-xs text-gray-500 truncate">{customer.phone || 'Sem telefone'}</span>
                                            </div>

                                            {/* Stats Pills - Inline */}
                                            <div className="flex flex-wrap gap-1.5">
                                                {(customer as any).totalPurchases > 0 && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-100">
                                                        R$ {formatCurrency((customer as any).totalPurchases).replace('R$', '').trim()}
                                                    </span>
                                                )}
                                                {(customer as any).debt > 0 && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-100">
                                                        Dev: {formatCurrency((customer as any).debt).replace('R$', '').trim()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Floating Actions Right Top */}
                                        <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
                                            <div className="flex gap-1.5">
                                                {customer.phone && (
                                                    <a href={`https://wa.me/55${customer.phone.replace(/\D/g, '')}`} className="w-6 h-6 flex items-center justify-center rounded bg-green-100 text-green-600 active:bg-green-200">
                                                        <WhatsAppIcon className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                                {customer.instagram && (
                                                    <a href={`https://www.instagram.com/${customer.instagram.replace('@', '').trim()}`} className="w-6 h-6 flex items-center justify-center rounded bg-pink-100 text-pink-600 active:bg-pink-200">
                                                        <InstagramIcon className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                            </div>
                                            <div className="flex gap-2 pr-0.5 pt-0.5 opacity-40">
                                                {permissions?.canEditCustomer && <button onClick={() => handleOpenModal(customer)}><EditIcon className="w-3.5 h-3.5" /></button>}
                                                {permissions?.canDeleteCustomer && <button onClick={() => setCustomerToDelete(customer)} title="Excluir"><TrashIcon className="w-3.5 h-3.5" /></button>}
                                                {permissions?.canInactivateCustomer && (
                                                    <button onClick={() => setCustomerToInactivate(customer)} title={customer.active === false ? "Reativar" : "Inativar"}>
                                                        {customer.active === false ? <CheckIcon className="w-3.5 h-3.5 text-success" /> : <EyeSlashIcon className="w-3.5 h-3.5" />}
                                                    </button>
                                                )}
                                                {permissions?.canViewCustomerHistory && <button onClick={() => handleViewHistory(customer)} title="Histórico"><ClockIcon className="w-3.5 h-3.5" /></button>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop View: Table */}
                        <div className="hidden md:flex flex-col overflow-x-auto">
                            <table className="w-full text-sm text-left text-muted min-w-[1000px]">
                                <thead className="text-xs text-secondary uppercase bg-surface-secondary">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">Nome</th>
                                        <th scope="col" className="px-6 py-3">Email</th>
                                        <th scope="col" className="px-6 py-3">Telefone</th>
                                        <th scope="col" className="px-6 py-3">Instagram</th>
                                        <th scope="col" className="px-6 py-3">Aniversário</th>
                                        <th scope="col" className="px-6 py-3 text-right">Total Comprado</th>
                                        <th scope="col" className="px-6 py-3 text-right">Em Aberto</th>
                                        <th scope="col" className="px-6 py-3">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCustomers.map(customer => (
                                        <tr key={customer.id} className="bg-surface border-b border-border hover:bg-surface-secondary">
                                            <td className="px-6 py-4 font-medium text-primary">
                                                <div className="flex items-center gap-3">
                                                    {customer.avatarUrl ? <img src={customer.avatarUrl} alt={customer.name} className="h-10 w-10 rounded-full object-cover" /> : <UserCircleIcon className="h-10 w-10 text-gray-300" />}
                                                    <div className="flex items-center gap-2">
                                                        <span>{customer.name}</span>
                                                        {customer.active === false && (
                                                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 border border-orange-200">Inativo</span>
                                                        )}
                                                        {customer.isBlocked && (
                                                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">Bloqueado</span>
                                                        )}
                                                        {customer.customTag && (
                                                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{customer.customTag}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">{customer.email}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span>{customer.phone}</span>
                                                    {customer.phone && (
                                                        <a href={`https://wa.me/55${customer.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity" title="Abrir WhatsApp">
                                                            <WhatsAppIcon />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span>{customer.instagram || '-'}</span>
                                                    {customer.instagram && (
                                                        <a href={`https://www.instagram.com/${customer.instagram.replace('@', '').trim()}`} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity" title="Abrir Instagram">
                                                            <InstagramIcon />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">{(() => { const d = parseBrazilianDate(customer.birthDate); return d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'N/A'; })()}</td>
                                            <td className="px-6 py-4 text-right font-semibold text-success">
                                                {(customer as any).totalPurchases > 0 ? formatCurrency((customer as any).totalPurchases) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-red-600">
                                                {(customer as any).debt > 0 ? formatCurrency((customer as any).debt) : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-4">
                                                    {permissions?.canViewCustomerHistory && <button onClick={() => handleViewHistory(customer)} className="text-secondary hover:text-primary" title="Ver Histórico"><ClockIcon className="w-5 h-5" /></button>}
                                                    {permissions?.canEditCustomer && <button onClick={() => handleOpenModal(customer)} className="text-secondary hover:text-primary" title="Editar"><EditIcon /></button>}
                                                    {permissions?.canDeleteCustomer && <button onClick={() => setCustomerToDelete(customer)} className="text-secondary hover:text-danger" title="Excluir"><TrashIcon /></button>}
                                                    {permissions?.canInactivateCustomer && (
                                                        <button onClick={() => setCustomerToInactivate(customer)} className={`text-secondary ${customer.active === false ? 'hover:text-success' : 'hover:text-orange-500'}`} title={customer.active === false ? "Reativar" : "Inativar"}>
                                                            {customer.active === false ? <CheckIcon className="w-5 h-5 text-success" /> : <EyeSlashIcon className="w-5 h-5" />}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )
            )}
        </div>
    );

    const renderSuppliersTab = () => (
        <div className="bg-surface rounded-3xl border border-border p-4 sm:p-6 shadow-sm">
            {/* Mobile Header: Full Width Search & Scrollable Filters */}
            <div className="flex flex-col gap-4 mb-6 md:hidden">
                <div className="relative w-full">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar fornecedor..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10 h-11 border rounded-xl w-full bg-white border-gray-200 focus:ring-primary focus:border-primary text-[13px] shadow-sm outline-none transition-all"
                    />
                </div>

                <div className="flex gap-2 items-center overflow-x-auto pb-1 no-scrollbar -mx-4 px-4">
                    {permissions?.canCreateSupplier && (
                        <button onClick={() => handleOpenModal()} className="h-10 px-4 bg-gray-800 text-white rounded-xl hover:bg-gray-700 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all whitespace-nowrap">
                            <PlusIcon className="h-4 w-4" /> Adicionar
                        </button>
                    )}

                    <button
                        onClick={() => setSupplierSortOrder(o => o === 'newest' ? 'oldest' : 'newest')}
                        className="shrink-0 h-10 px-4 bg-gray-100 text-gray-700 rounded-xl border border-gray-200 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider hover:bg-gray-200 active:bg-gray-300 shadow-sm transition-all whitespace-nowrap"
                    >
                        <ArrowsUpDownIcon className="h-4 w-4 text-gray-500" />
                        {supplierSortOrder === 'newest' ? 'Recentes' : 'Antigos'}
                    </button>
                </div>
            </div>

            {/* Desktop Header */}
            <div className="hidden md:flex justify-between items-center mb-6 gap-3 bg-white/50 p-2 rounded-2xl border border-gray-100 shadow-sm relative z-50 flex-wrap lg:flex-nowrap">
                <div className="flex items-center gap-2 flex-grow lg:flex-grow-0">
                    <div className="relative min-w-[280px] flex-grow">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><SearchIcon className="h-4 w-4" /></span>
                        <input type="text" placeholder="Buscar fornecedor por nome ou CNPJ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-10 border rounded-xl w-full bg-white border-gray-200 focus:ring-primary focus:border-primary text-[13px] outline-none transition-all shadow-sm" />
                    </div>

                    <button
                        onClick={() => setSupplierSortOrder(o => o === 'newest' ? 'oldest' : 'newest')}
                        className="h-10 px-4 bg-gray-100 text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-200 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap shadow-sm active:scale-95"
                    >
                        <ArrowsUpDownIcon className="h-4 w-4 text-gray-500" />
                        <span>{supplierSortOrder === 'newest' ? 'Recentes' : 'Antigos'}</span>
                    </button>
                </div>

                {permissions?.canCreateSupplier && (
                    <button onClick={() => handleOpenModal()} className="h-10 px-5 bg-gray-800 text-white rounded-xl hover:bg-gray-700 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider shadow-sm transition-all active:scale-95 whitespace-nowrap shrink-0">
                        <PlusIcon className="h-5 w-5" /> Adicionar Fornecedor
                    </button>
                )}
            </div>

            {loading ? <div className="flex justify-center py-8"><SpinnerIcon /></div> : (
                filteredSuppliers.length === 0 ? <p className="text-center text-muted py-8">Nenhum fornecedor encontrado.</p> : (
                    <>
                        {/* Mobile View: Ultra Compact Strip Cards */}
                        <div className="md:hidden space-y-2">
                            {filteredSuppliers.map(supplier => (
                                <div key={supplier.id} className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                                    <div className="flex items-start gap-3">
                                        {/* Avatar Left */}
                                        <div className="relative shrink-0">
                                            {supplier.avatarUrl ? (
                                                <img src={supplier.avatarUrl} alt={supplier.name} className="h-10 w-10 rounded-xl object-cover border border-gray-100" />
                                            ) : (
                                                <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                                                    <UserCircleIcon className="h-6 w-6" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Info Middle */}
                                        <div className="flex-1 min-w-0 pr-14">
                                            <h3 className="font-bold text-gray-900 text-sm truncate">{supplier.name}</h3>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                {customers.some(c => c.name.trim().toLowerCase() === supplier.name.trim().toLowerCase()) && (
                                                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                        Cliente & Fornecedor
                                                    </span>
                                                )}
                                                <span className="text-xs text-gray-500 truncate">
                                                    {supplier.phone || supplier.email || 'Sem contato'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Floating Actions Right Top */}
                                        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                                            <div className="flex gap-1.5">
                                                {supplier.phone && (
                                                    <a href={`https://wa.me/55${supplier.phone.replace(/\D/g, '')}`} className="w-6 h-6 flex items-center justify-center rounded bg-green-100 text-green-600 active:bg-green-200 transition-colors">
                                                        <WhatsAppIcon className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                            </div>
                                            <div className="flex gap-2 pr-0.5 pt-0.5 opacity-40">
                                                {permissions?.canEditSupplier && <button onClick={() => handleOpenModal(supplier)}><EditIcon className="w-3.5 h-3.5 text-gray-500" /></button>}
                                                {permissions?.canDeleteSupplier && <button onClick={() => setSupplierToDelete(supplier)}><TrashIcon className="w-3.5 h-3.5 text-gray-500" /></button>}
                                                {permissions?.canViewSupplierHistory && <button onClick={() => handleViewSupplierHistory(supplier)}><ClockIcon className="w-3.5 h-3.5 text-gray-500" /></button>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop View: Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm text-left text-muted min-w-[1000px]">
                                <thead className="text-xs text-secondary uppercase bg-surface-secondary">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">Fornecedor</th>
                                        <th scope="col" className="px-6 py-3">Tipo</th>
                                        <th scope="col" className="px-6 py-3">Contato</th>
                                        <th scope="col" className="px-6 py-3">CNPJ</th>
                                        <th scope="col" className="px-6 py-3">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSuppliers.map(supplier => (
                                        <tr key={supplier.id} className="bg-surface border-b border-border hover:bg-surface-secondary">
                                            <td className="px-6 py-4 font-medium text-primary">
                                                <div className="flex items-center gap-3">
                                                    {supplier.avatarUrl ? <img src={supplier.avatarUrl} alt={supplier.name} className="h-10 w-10 rounded-full object-cover" /> : <UserCircleIcon className="h-10 w-10 text-gray-300" />}
                                                    <span>{supplier.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {customers.some(c => c.name.trim().toLowerCase() === supplier.name.trim().toLowerCase()) ? (
                                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">Cliente & Fornecedor</span>
                                                ) : (
                                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">Fornecedor</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span>{supplier.phone}</span>
                                                    {supplier.phone && (
                                                        <a href={`https://wa.me/55${supplier.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700" title="WhatsApp">
                                                            <WhatsAppIcon className="h-4 w-4" />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">{supplier.cnpj}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-4">
                                                    {permissions?.canViewSupplierHistory && <button onClick={() => handleViewSupplierHistory(supplier)} className="text-secondary hover:text-primary" title="Ver Histórico"><ClockIcon className="w-5 h-5" /></button>}
                                                    {permissions?.canEditSupplier && <button onClick={() => handleOpenModal(supplier)} className="text-secondary hover:text-primary"><EditIcon /></button>}
                                                    {permissions?.canDeleteSupplier && <button onClick={() => setSupplierToDelete(supplier)} className="text-secondary hover:text-danger"><TrashIcon /></button>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-primary">Clientes e Fornecedores</h1>

            <div className="inline-flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-sm">
                {availableTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id as any); setSearchTerm(''); }}
                        className={`px-8 py-3 rounded-xl text-[13px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-gray-900/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? <div className="flex justify-center items-center h-full"><SpinnerIcon /></div> : (
                <>
                    {activeTab === 'clientes' && renderCustomersTab()}
                    {activeTab === 'fornecedores' && renderSuppliersTab()}
                    {availableTabs.length === 0 && <p className="text-center text-muted p-6">Você não tem permissão para acessar esta seção.</p>}
                </>
            )}

            {isModalOpen && <CustomerModal
                entity={editingEntity}
                initialType={activeTab === 'clientes' ? 'Cliente' : 'Fornecedor'}
                onClose={handleCloseModal}
                onSave={handleSaveEntity}
                isSaving={isSaving}
            />}
            {isHistoryOpen && customerForHistory && <PurchaseHistoryModal customer={customerForHistory} sales={customerSales} users={users} onClose={() => { setIsHistoryOpen(false); setCustomerForHistory(null); }} productMap={productMap} onViewSale={setSaleToView} />}
            <ConfirmationModal isOpen={!!customerToDelete} onClose={() => setCustomerToDelete(null)} onConfirm={handleDeleteCustomerConfirm} title="Confirmar Exclusão" message={`Tem certeza que deseja excluir o cliente "${customerToDelete?.name}"? Esta ação não pode ser desfeita.`} />

            {supplierForHistory && <SupplierHistoryModal supplier={supplierForHistory} purchases={supplierPurchases} users={users} products={products} onClose={() => setSupplierForHistory(null)} />}
            <ConfirmationModal isOpen={!!supplierToDelete} onClose={() => setSupplierToDelete(null)} onConfirm={handleDeleteSupplierConfirm} title="Confirmar Exclusão" message={`Tem certeza que deseja excluir o fornecedor "${supplierToDelete?.name}"?`} />
            {saleToView && <SaleDetailModal sale={saleToView} productMap={productMap} customers={customers} users={users} onClose={() => setSaleToView(null)} />}
            {/* Inactivate Customer Confirmation */}
            <ConfirmationModal
                isOpen={!!customerToInactivate}
                onClose={() => setCustomerToInactivate(null)}
                onConfirm={handleInactivateCustomerConfirm}
                title={customerToInactivate?.active === false ? "Reativar Cliente" : "Inativar Cliente"}
                message={customerToInactivate?.active === false
                    ? `Tem certeza que deseja reativar o cliente "${customerToInactivate?.name}"?`
                    : `Tem certeza que deseja inativar o cliente "${customerToInactivate?.name}"? Ele não aparecerá mais nas listas e buscas do sistema, mas seu histórico será mantido.`
                }
                confirmText={customerToInactivate?.active === false ? "Reativar" : "Inativar"}
                type={customerToInactivate?.active === false ? "success" : "warning"}
            />
        </div>
    );
};

export default CustomersAndSuppliers;
