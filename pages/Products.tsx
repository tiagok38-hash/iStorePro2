
import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Product, Sale, Customer, User, ProductCondition, PurchaseOrder, Supplier, StockStatus, Brand, Category, ProductModel, Grade, GradeValue, FinancialStatus, PermissionSet } from '../types.ts';
import {
    getProducts, addProduct, updateProduct, deleteProduct, getProductSalesHistory,
    getCustomers, getUsers, updateProductStock, updateMultipleProducts,
    getPurchaseOrders, getSuppliers, deletePurchaseOrder, updatePurchaseFinancialStatus, addSupplier,
    getBrands, getCategories, getProductModels, getGrades, getGradeValues, revertPurchaseLaunch,
    formatCurrency, findOrCreateSupplierFromCustomer,
    getSales
} from '../services/mockApi.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import CustomDatePicker from '../components/CustomDatePicker.tsx';
import ConfirmationModal from '../components/ConfirmationModal.tsx';
import UpdateStockModal from '../components/UpdateStockModal.tsx';
import ProductHistoryModal from '../components/ProductHistoryModal.tsx';
import BulkPriceUpdateModal from '../components/BulkPriceUpdateModal.tsx';
import BulkLocationUpdateModal from '../components/BulkLocationUpdateModal.tsx';
import PurchaseOrderDetailModal from '../components/PurchaseOrderDetailModal.tsx';
import DeleteWithReasonModal from '../components/DeleteWithReasonModal.tsx';
import GlobalLoading from '../components/GlobalLoading.tsx';
import { toDateValue, getNowISO } from '../utils/dateUtils.ts';
import {
    SpinnerIcon, EditIcon, TrashIcon, SearchIcon, PlusIcon, TagIcon, EllipsisVerticalIcon, Cog6ToothIcon,
    TicketIcon, DocumentArrowUpIcon, PlayCircleIcon, AppleIcon, ArchiveBoxIcon, XCircleIcon, EyeIcon,
    BanknotesIcon, DocumentTextIcon, CalendarDaysIcon, ArrowsUpDownIcon, ShoppingCartIcon, ChevronLeftIcon, ChevronRightIcon,
    ArrowUturnLeftIcon, AdjustmentsHorizontalIcon, CurrencyDollarIcon, MapPinIcon
} from '../components/icons.tsx';

// Lazy load heavy modal components for better performance
const ProductModal = lazy(() => import('../components/ProductModal.tsx'));
const PurchaseOrderModal = lazy(() => import('../components/PurchaseOrderModal.tsx').then(m => ({ default: m.PurchaseOrderModal })));
const StockInModal = lazy(() => import('../components/StockInModal.tsx'));
const PriceListModal = lazy(() => import('../components/PriceListModal.tsx'));


const ProductActionsDropdown: React.FC<{ onHistory: () => void, onUpdateStock: () => void, onEdit: () => void, onDelete: () => void, permissions: PermissionSet | null }> = ({ onHistory, onUpdateStock, onEdit, onDelete, permissions }) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({});

    const handleToggle = () => {
        if (isOpen) {
            setIsOpen(false);
        } else {
            if (!buttonRef.current) return;
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const menuHeight = 200;

            const newStyle: React.CSSProperties = {
                position: 'fixed',
                width: '11rem',
                right: window.innerWidth - rect.right,
                zIndex: 9999,
            };

            if (spaceBelow < menuHeight && rect.top > menuHeight) {
                newStyle.bottom = window.innerHeight - rect.top;
            } else {
                newStyle.top = rect.bottom;
            }

            setStyle(newStyle);
            setIsOpen(true);
        }
    };

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleScroll = () => { if (isOpen) setIsOpen(false); };
        document.addEventListener('mousedown', handleOutsideClick);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [isOpen]);

    const menuItemClasses = "w-full text-left flex items-center gap-3 px-4 py-2 text-sm";

    return (
        <div>
            <button ref={buttonRef} onClick={handleToggle} className="p-1 rounded-full hover:bg-gray-200 text-muted"><EllipsisVerticalIcon className="h-5 w-5" /></button>
            {isOpen && createPortal(
                <div ref={dropdownRef} style={style} className="rounded-xl shadow-lg bg-surface ring-1 ring-black ring-opacity-5">
                    <div className="py-1">
                        <button onClick={() => { onHistory(); setIsOpen(false); }} className={`${menuItemClasses} text-secondary hover:bg-surface-secondary`}>
                            <DocumentTextIcon className="h-4 w-4" /> Histórico
                        </button>
                        {permissions?.canEditStock && (
                            <button onClick={() => { onUpdateStock(); setIsOpen(false); }} className={`${menuItemClasses} text-secondary hover:bg-surface-secondary`}>
                                <AdjustmentsHorizontalIcon className="h-4 w-4" /> Editar Estoque
                            </button>
                        )}
                        {permissions?.canEditProduct && (
                            <button onClick={() => { onEdit(); setIsOpen(false); }} className={`${menuItemClasses} text-secondary hover:bg-surface-secondary`}>
                                <EditIcon className="h-4 w-4" /> Editar
                            </button>
                        )}
                        {permissions?.canDeleteProduct && (
                            <button onClick={() => { onDelete(); setIsOpen(false); }} className={`${menuItemClasses} text-danger hover:bg-danger-light`}>
                                <TrashIcon className="h-4 w-4" /> Excluir
                            </button>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

const StatusTag: React.FC<{ text: string; type: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'warning-filled' }> = ({ text, type }) => {
    const colors = {
        success: 'bg-green-100 text-green-700',
        warning: 'bg-orange-100 text-orange-700',
        'warning-filled': 'bg-orange-500 text-white',
        danger: 'bg-red-100 text-red-700',
        info: 'bg-blue-100 text-blue-700',
        default: 'bg-gray-100 text-gray-700'
    };
    return <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${colors[type]}`}>{text}</span>;
};

// --- Supplier Label Logic ---
const getSupplierColorClass = (supplier: Supplier | undefined) => {
    if (!supplier) return 'bg-gray-100 text-gray-700';
    if (supplier.linkedCustomerId) return 'bg-purple-100 text-purple-700 border border-purple-200'; // Client-Suppliers (Purple) - Mantendo roxo para diferenciar "Cliente"

    // FIX: All standard suppliers should be Orange as requested
    return 'bg-orange-100 text-orange-700 border border-orange-200';
};


const getInitialMonthStart = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return toDateValue(firstDay);
};

const getInitialMonthEnd = () => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return toDateValue(lastDay);
};

const Products: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'estoque' | 'compras'>('estoque');
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();
    const { permissions, user, loading: authLoading } = useUser();

    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [productModels, setProductModels] = useState<ProductModel[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [gradeValues, setGradeValues] = useState<GradeValue[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [isPriceListModalOpen, setIsPriceListModalOpen] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
    const [isBulkLocationUpdateModalOpen, setIsBulkLocationUpdateModalOpen] = useState(false);
    const [isUpdateStockModalOpen, setIsUpdateStockModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    const [productForHistory, setProductForHistory] = useState<Product | null>(null);
    const [productForStockUpdate, setProductForStockUpdate] = useState<Product | null>(null);
    const [productSalesHistory, setProductSalesHistory] = useState<Sale[]>([]);
    const [filters, setFilters] = useState({ stock: 'Em estoque', condition: 'Todos', location: 'Todos' });
    const [inventorySortOrder, setInventorySortOrder] = useState<'newest' | 'oldest'>('newest');
    const [itemsPerPage, setItemsPerPage] = useState<15 | 20 | 30>(15);
    const [currentPage, setCurrentPage] = useState(1);


    const [isNewPurchaseModalOpen, setIsNewPurchaseModalOpen] = useState(false);
    const [stockInPurchase, setStockInPurchase] = useState<PurchaseOrder | null>(null);
    const [purchaseToView, setPurchaseToView] = useState<PurchaseOrder | null>(null);
    const [purchaseToEdit, setPurchaseToEdit] = useState<PurchaseOrder | null>(null);
    const [purchaseToDelete, setPurchaseToDelete] = useState<PurchaseOrder | null>(null);
    const [purchaseToUpdateFinance, setPurchaseToUpdateFinance] = useState<PurchaseOrder | null>(null);
    const [purchaseToRevert, setPurchaseToRevert] = useState<PurchaseOrder | null>(null);
    const [purchaseSearchTerm, setPurchaseSearchTerm] = useState('');
    const [startDate, setStartDate] = useState(getInitialMonthStart());
    const [endDate, setEndDate] = useState(getInitialMonthEnd());
    const [purchaseSortOrder, setPurchaseSortOrder] = useState<'newest' | 'oldest'>('newest');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [activePeriod, setActivePeriod] = useState<'hoje' | 'semana' | 'mes'>('mes');


    const fetchData = useCallback(async (silent = false, retryCount = 0) => {
        if (!silent) setLoading(true);
        try {
            // 1. Fetch metadata (lighter requests)
            const [
                usersData, suppliersData, brandsData, categoriesData,
                modelsData, gradesData, gradeValuesData
            ] = await Promise.all([
                getUsers(), getSuppliers(), getBrands(), getCategories(),
                getProductModels(), getGrades(), getGradeValues()
            ]);

            setUsers(usersData);
            setSuppliers(suppliersData);
            setBrands(brandsData);
            setCategories(categoriesData);
            setProductModels(modelsData);
            setGrades(gradesData);
            setGradeValues(gradeValuesData);

            // 2. Fetch main data (heavier requests)
            // ROBUSTNESS: Apply safety limits and date filters where appropriate
            const [productsData, customersData, purchasesData, salesData] = await Promise.all([
                getProducts(),
                getCustomers(false),
                getPurchaseOrders(),
                getSales(undefined, undefined, getInitialMonthStart()) // Only fetch recent sales for general context
            ]);

            setProducts(productsData);
            setCustomers(customersData);
            setPurchases(purchasesData);
            setSales(salesData);
        } catch (error: any) {
            const isAbort = error?.name === 'AbortError' || error?.message?.includes('aborted');
            if (isAbort) {
                console.warn('Products: Fetch aborted.');
            } else {
                console.error('Products: Error fetching data:', error);

                // Auto-retry once after short delay (handles reconnection issues after idle)
                if (retryCount < 1) {
                    setTimeout(() => fetchData(silent, retryCount + 1), 2000);
                    return;
                }

                if (!silent) showToast('Erro ao carregar dados do estoque.', 'error');
            }
        } finally {
            if (!silent) setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchData();

        const handleCompanyUpdate = () => fetchData(true);
        window.addEventListener('company-data-updated', handleCompanyUpdate);

        // Nível 6: Evento de recarregamento inteligente
        const handleSmartReload = () => {
            fetchData(true);
        };
        window.addEventListener('app-reloadData', handleSmartReload);

        const bc = new BroadcastChannel('app-updates');
        bc.onmessage = (event) => {
            if (event.data === 'company-data-updated') fetchData(true);
        };

        return () => {
            window.removeEventListener('company-data-updated', handleCompanyUpdate);
            window.removeEventListener('app-reloadData', handleSmartReload);
            bc.close();
        };
    }, [fetchData]);

    const availableTabs = useMemo(() => {
        const tabs = [];
        if (permissions?.canAccessEstoque) {
            tabs.push({ id: 'estoque', label: 'Estoque' });
        }
        if (permissions?.canViewPurchases) {
            tabs.push({ id: 'compras', label: 'Compras' });
        }
        return tabs;
    }, [permissions]);

    useEffect(() => {
        if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
            setActiveTab(availableTabs[0].id as 'estoque' | 'compras');
        }
    }, [availableTabs, activeTab]);

    const soldProductIds = useMemo(() => {
        // Consider any product in a non-cancelled sale as "sold" or "reserved"
        return new Set(sales.filter(s => s.status !== 'Cancelada').flatMap(s => s.items).map(i => String(i.productId)));
    }, [sales]);

    const filteredProducts = useMemo(() => {
        const terms = searchTerm.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);

        // Optimizar lookup de localizador da compra
        const purchaseLocatorMap = new Map<string, string>();
        purchases.forEach(po => {
            if (po.locatorId) purchaseLocatorMap.set(po.id, po.locatorId.toLowerCase());
        });

        const filtered = products.filter(p => {
            if (terms.length === 0) {
                // Fallback filters when no search
                const stockMatch = filters.stock === 'Todos' ? true : filters.stock === 'Em estoque' ? p.stock > 0 : p.stock === 0;
                const conditionMatch = filters.condition === 'Todos' ? true : p.condition === filters.condition;
                const locationMatch = filters.location === 'Todos' ? true : p.storageLocation === filters.location;
                return stockMatch && conditionMatch && locationMatch;
            }

            const purchaseLocator = p.purchaseOrderId ? (purchaseLocatorMap.get(p.purchaseOrderId) || '') : '';

            const searchableText = [
                p.model || '',
                p.brand || '',
                p.serialNumber || '',
                p.imei1 || '',
                p.imei2 || '',
                p.color || '',
                p.storage || '',
                p.condition || '',
                p.description || '',
                purchaseLocator,
                (p.barcodes || []).join(' ')
            ].join(' ').toLowerCase();

            const searchMatch = terms.every(term => searchableText.includes(term));

            const stockMatch = filters.stock === 'Todos' ? true : filters.stock === 'Em estoque' ? p.stock > 0 : p.stock === 0;
            const conditionMatch = filters.condition === 'Todos' ? true : p.condition === filters.condition;
            const locationMatch = filters.location === 'Todos' ? true : p.storageLocation === filters.location;

            return searchMatch && stockMatch && conditionMatch && locationMatch;
        });

        // Grouping Logic for Non-Unique Products
        const groupedMap: Record<string, Product> = {};
        const finalResults: Product[] = [];

        filtered.forEach(p => {
            // Check if product is unique (has identifiers)
            const isUnique = !!((p.serialNumber || '').trim() || (p.imei1 || '').trim() || (p.imei2 || '').trim());
            const hasVariations = p.variations && p.variations.length > 0;

            if (isUnique || hasVariations) {
                // Unique products always stay separate
                finalResults.push(p);
            } else {
                // Non-unique products (accessories, etc.) are candidates for grouping
                // Create a key based on all relevant attributes that define "sameness"
                const modelKey = (p.model || '').trim(); // Case sensitive for model? Maybe
                const brandKey = (p.brand || '').trim();
                const colorKey = (p.color || '').trim();
                const storageKey = (p.storage || '').trim();
                const conditionKey = (p.condition || '').trim();
                const warrantyKey = (p.warranty || '').trim();
                const priceKey = `${p.price}-${p.costPrice || 0}-${p.wholesalePrice || 0}`;
                const supplierKey = (p.supplierId || '').trim();
                const locationKey = (p.storageLocation || '').trim();

                const key = `${modelKey}|${brandKey}|${colorKey}|${storageKey}|${conditionKey}|${warrantyKey}|${priceKey}|${supplierKey}|${locationKey}`;

                if (!groupedMap[key]) {
                    // First item of this group
                    // Clone it so we don't mutate the original if we modify stock
                    groupedMap[key] = { ...p };
                } else {
                    // Add stock to existing group item
                    groupedMap[key].stock += p.stock;
                    // You might want to accumulate other things if needed, but for display, stock is main
                }
            }
        });

        const combinedList = [...finalResults, ...Object.values(groupedMap)];

        return combinedList.sort((a, b) => {
            if (inventorySortOrder === 'newest') {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

    }, [products, searchTerm, filters, inventorySortOrder, purchases]);

    // Pagination logic
    const totalPages = useMemo(() => Math.ceil(filteredProducts.length / itemsPerPage), [filteredProducts.length, itemsPerPage]);
    const paginatedProducts = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredProducts, currentPage, itemsPerPage]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filters, inventorySortOrder]);

    const productMap = useMemo(() => products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, Product>), [products]);
    const userMap = useMemo(() => users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {} as Record<string, User>), [users]);

    const handleFilterChange = (filterName: keyof typeof filters, value: string) => setFilters(prev => ({ ...prev, [filterName]: value }));

    const handleOpenProductModal = (product: Partial<Product> | null = null) => {
        if (product && product.id && soldProductIds.has(String(product.id)) && (product.stock === 0)) {
            showToast('Não é possível editar um produto que já foi vendido e está com estoque zero. Cancele a venda primeiro para retornar o produto ao estoque.', 'warning');
            return;
        }
        setEditingProduct(product ? { ...product } : {});
        setIsProductModalOpen(true);
    };
    const handleCloseProductModal = () => { setIsProductModalOpen(false); };
    const handleSaveProduct = async (productData: any) => {
        try {
            if (editingProduct && 'id' in editingProduct) {
                await updateProduct({ ...editingProduct, ...productData } as Product, user?.id, user?.name);
                showToast('Produto atualizado com sucesso!', 'success');
            } else {
                const newProductData = { ...productData };
                await addProduct(newProductData, user?.id, user?.name);
                showToast('Produto adicionado com sucesso!', 'success');
            }
            fetchData(); handleCloseProductModal();
        } catch (error: any) {
            showToast(error.message || 'Erro ao salvar produto.', 'error');
        }
    };
    const handleOpenDeleteModal = (product: Product) => {
        if (soldProductIds.has(product.id) && product.stock === 0) {
            showToast('Não é possível excluir um produto que já foi vendido e está com estoque zero. Você deve cancelar a venda primeiro para que o produto retorne ao estoque.', 'warning');
            return;
        }
        setProductToDelete(product);
        setIsDeleteModalOpen(true);
    };
    const handleDeleteConfirm = async () => {
        if (!productToDelete) return;
        try {
            await deleteProduct(productToDelete.id, user?.id, user?.name);
            showToast('Produto excluído com sucesso!', 'success');
            fetchData(); setIsDeleteModalOpen(false); setProductToDelete(null);
        } catch (error) { showToast('Erro ao excluir produto.', 'error'); }
    };
    const handleViewHistory = async (product: Product) => {
        setProductForHistory(product);
        try {
            const sales = await getProductSalesHistory(product.id);
            setProductSalesHistory(sales); setIsHistoryModalOpen(true);
        } catch (error) { showToast('Erro ao carregar histórico de vendas.', 'error'); }
    };
    const handleBulkUpdate = async (updates: { id: string; price?: number; costPrice?: number; wholesalePrice?: number }[]) => {
        try {
            await updateMultipleProducts(updates, user?.id, user?.name);
            showToast(`${updates.length} produtos atualizados com sucesso!`, 'success');
            setIsBulkUpdateModalOpen(false); fetchData();
        } catch (error) { showToast('Erro ao atualizar produtos em massa.', 'error'); }
    };

    const handleBulkLocationUpdate = async (updates: { id: string; storageLocation: string }[]) => {
        try {
            await updateMultipleProducts(updates, user?.id, user?.name);
            showToast(`Local de estoque atualizado para ${updates.length} produto(s)!`, 'success');
            setIsBulkLocationUpdateModalOpen(false); fetchData();
        } catch (error) { showToast('Erro ao atualizar local em massa.', 'error'); }
    };

    const handleOpenStockUpdateModal = (product: Product) => {
        if (soldProductIds.has(String(product.id)) && product.stock === 0) {
            showToast('Não é possível editar o estoque de um produto que já foi vendido e está com estoque zero. Cancele a venda primeiro para retornar o produto ao estoque.', 'warning');
            return;
        }
        setProductForStockUpdate(product);
        setIsUpdateStockModalOpen(true);
    };

    const handleStockUpdateSave = async (productToUpdate: Product, newStock: number) => {
        try {
            await updateProductStock(productToUpdate.id, newStock);
            showToast('Estoque atualizado com sucesso!', 'success');
            setIsUpdateStockModalOpen(false);
            setProductForStockUpdate(null);
            fetchData();
        } catch (error: any) {
            showToast(error.message || 'Erro ao atualizar o estoque.', 'error');
        }
    };


    const getConditionTagClasses = (condition: ProductCondition) => {
        switch (condition) {
            case 'Novo': return 'bg-blue-100 text-blue-800 border border-blue-200';
            case 'Seminovo': return 'bg-amber-100 text-amber-800 border border-amber-200';
            case 'CPO': return 'bg-purple-100 text-purple-800 border border-purple-200';
            case 'Openbox': return 'bg-teal-100 text-teal-800 border border-teal-200';
            default: return 'bg-gray-100 text-gray-800 border border-gray-200';
        }
    };

    const handleAddNewSupplier = async (supplierData: Omit<Supplier, 'id'>): Promise<Supplier | null> => {
        try {
            const newSupplier = await addSupplier(supplierData);
            setSuppliers(prev => [...prev, newSupplier]);
            showToast('Fornecedor adicionado com sucesso!', 'success');
            return newSupplier;
        } catch (error) {
            showToast('Erro ao adicionar fornecedor.', 'error');
            return null;
        }
    };

    const handlePeriodChange = (period: 'hoje' | 'semana' | 'mes') => {
        setActivePeriod(period);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (period === 'hoje') {
            const todayStr = toDateValue(today);
            setStartDate(todayStr);
            setEndDate(todayStr);
        } else if (period === 'semana') {
            const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
            const lastDayOfWeek = new Date(firstDayOfWeek);
            lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);
            setStartDate(toDateValue(firstDayOfWeek));
            setEndDate(toDateValue(lastDayOfWeek));
        } else if (period === 'mes') {
            setStartDate(getInitialMonthStart());
            setEndDate(getInitialMonthEnd());
        }
    };

    const handleCopyLocatorId = (locatorId: string) => {
        navigator.clipboard.writeText(locatorId).then(() => {
            showToast('Localizador copiado!', 'success');
        }).catch(err => {
            showToast('Falha ao copiar.', 'error');
        });
    };

    const filteredPurchases = useMemo(() => {
        const filtered = purchases.filter(p => {
            const lowerSearch = purchaseSearchTerm.toLowerCase();
            const searchMatch = lowerSearch === '' ||
                (p.supplierName || '').toLowerCase().includes(lowerSearch) ||
                (p.displayId || '').toString().includes(lowerSearch) ||
                (p.locatorId || '').toLowerCase().includes(lowerSearch);

            const statusMatch = statusFilter === 'Todos' ||
                p.status === statusFilter ||
                p.stockStatus === statusFilter ||
                p.financialStatus === statusFilter;

            const purchaseDate = p.purchaseDate.split('T')[0];
            const dateMatch = purchaseDate >= startDate && purchaseDate <= endDate;

            return searchMatch && statusMatch && dateMatch;
        });

        return [...filtered].sort((a, b) => {
            if (purchaseSortOrder === 'newest') {
                return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
            }
            return new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime();
        });
    }, [purchases, purchaseSearchTerm, statusFilter, purchaseSortOrder, startDate, endDate]);

    const handleOpenEditPurchaseModal = (purchase: PurchaseOrder) => { setPurchaseToEdit(purchase); setIsNewPurchaseModalOpen(true); };

    const handleCloseNewPurchaseModal = (refresh: boolean) => {
        setIsNewPurchaseModalOpen(false);
        setPurchaseToEdit(null);
        if (refresh) {
            fetchData();
            setActiveTab('compras');
        }
    };

    const handleCloseStockInModal = (refresh: boolean) => {
        setStockInPurchase(null);
        if (refresh) {
            fetchData();
            setActiveTab('compras');
        }
    };

    const handleDeletePurchase = async (reason: string) => {
        if (!purchaseToDelete) return;

        // Validação: não permitir exclusão de compras lançadas
        if (purchaseToDelete.stockStatus === 'Lançado' || purchaseToDelete.stockStatus === 'Parcialmente Lançado') {
            showToast('Não é possível excluir uma compra lançada. Reverta o lançamento primeiro.', 'warning');
            setPurchaseToDelete(null);
            return;
        }

        try {
            await deletePurchaseOrder(purchaseToDelete.id);
            showToast('Compra excluída com sucesso!', 'success');
            setPurchaseToDelete(null); fetchData();
        } catch (error: any) { showToast(error.message || 'Erro ao excluir compra.', 'error'); }
    };
    const handleFinanceToggle = async () => {
        if (!purchaseToUpdateFinance) return;
        try {
            await updatePurchaseFinancialStatus(purchaseToUpdateFinance.id);
            showToast('Status financeiro atualizado!', 'success');
            setPurchaseToUpdateFinance(null); fetchData();
        } catch (error) { showToast('Erro ao atualizar status financeiro.', 'error'); }
    };
    const handleRevertPurchase = async () => {
        if (!purchaseToRevert) return;

        // Backup current products to draft before reverting
        try {
            const productsToSave = products.filter(p => p.purchaseOrderId === purchaseToRevert.id);
            if (productsToSave.length > 0) {
                const draftDetails = productsToSave.map(p => {
                    const finalCost = (p.costPrice || 0) + (p.additionalCostPrice || 0);
                    let markup = null;
                    if (finalCost > 0 && p.price > 0) {
                        markup = parseFloat((((p.price / finalCost) - 1) * 100).toFixed(2));
                    }

                    return {
                        purchaseItemId: p.purchaseItemId,
                        itemDescription: p.model,
                        serialNumber: p.serialNumber || '',
                        imei1: p.imei1 || '',
                        imei2: p.imei2 || '',
                        condition: p.condition,
                        batteryHealth: p.batteryHealth || 100,
                        warranty: p.warranty,
                        storageLocation: p.storageLocation,
                        costPrice: p.costPrice || 0,
                        additionalCostPrice: p.additionalCostPrice || 0,
                        markup: markup,
                        salePrice: p.price,
                        wholesalePrice: p.wholesalePrice,
                        quantity: p.stock,
                        minimumStock: p.minimumStock,
                        isApple: p.brand === 'Apple',
                        barcode: p.barcodes && p.barcodes.length > 0 ? p.barcodes[0] : '',
                        controlByBarcode: false
                    };
                });
                localStorage.setItem(`stock_launch_draft_${purchaseToRevert.id}`, JSON.stringify(draftDetails));
            }
        } catch (e) {
            console.error('Erro ao salvar backup do rascunho', e);
        }

        try {
            await revertPurchaseLaunch(purchaseToRevert.id);
            showToast('Lançamento da compra revertido com sucesso!', 'success');
            setPurchaseToRevert(null);
            fetchData();
        } catch (error) {
            showToast('Erro ao reverter o lançamento.', 'error');
        }
    };
    const associatedProducts = useMemo(() => { if (!purchaseToView) return []; return products.filter(p => p.purchaseOrderId === purchaseToView.id); }, [products, purchaseToView]);

    const getStockStatusType = (status: StockStatus): 'success' | 'warning' => {
        switch (status) {
            case 'Lançado': return 'success';
            case 'Pendente': return 'warning';
            case 'Parcialmente Lançado': return 'warning';
            default: return 'warning';
        }
    };

    const getFinancialStatusType = (status: FinancialStatus): 'warning' | 'success' => {
        return status === 'Pendente' ? 'warning' : 'success';
    };

    const comprasKpi = useMemo(() => {
        const dateFiltered = purchases.filter(p => {
            const purchaseDate = p.purchaseDate.split('T')[0];
            return purchaseDate >= startDate && purchaseDate <= endDate;
        });
        return {
            count: dateFiltered.length,
            total: dateFiltered.reduce((sum, p) => sum + p.total, 0),
        }
    }, [purchases, startDate, endDate]);


    const renderEstoqueTab = () => (
        <div className="w-full space-y-6">
            <div className="bg-surface rounded-3xl border border-border shadow-sm p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                    {permissions?.canCreatePurchase && (
                        <button
                            onClick={() => setIsNewPurchaseModalOpen(true)}
                            className="h-10 px-4 bg-gray-800 text-white rounded-xl font-bold flex items-center gap-2 text-[11px] hover:bg-gray-700 transition-all active:scale-95 shadow-sm uppercase tracking-wider"
                        >
                            <PlusIcon className="h-5 w-5" /> Nova compra
                        </button>
                    )}
                    <Link
                        to="/company?tab=parametros"
                        className="h-10 px-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-[11px] font-bold flex items-center gap-2 transition-all active:scale-95 border border-gray-200 uppercase tracking-wider"
                    >
                        <Cog6ToothIcon className="h-5 w-5 text-gray-500" /> Parâmetros
                    </Link>
                    {permissions?.canEditProduct && (
                        <button
                            onClick={() => setIsBulkUpdateModalOpen(true)}
                            className="h-10 px-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-[11px] font-bold flex items-center gap-2 transition-all active:scale-95 border border-gray-200 uppercase tracking-wider"
                        >
                            <TagIcon className="h-5 w-5 text-gray-500" /> Atualização de preço
                        </button>
                    )}
                    {permissions?.canEditProduct && (
                        <button
                            onClick={() => setIsBulkLocationUpdateModalOpen(true)}
                            className="h-10 px-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-[11px] font-bold flex items-center gap-2 transition-all active:scale-95 border border-gray-200 uppercase tracking-wider"
                        >
                            <MapPinIcon className="h-5 w-5 text-gray-500" /> Atualização de local
                        </button>
                    )}
                    <button className="h-10 px-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-[11px] font-bold flex items-center gap-2 transition-all active:scale-95 border border-gray-200 uppercase tracking-wider">
                        <TicketIcon className="h-5 w-5 text-gray-500" /> Etiquetas
                    </button>
                    <button
                        onClick={() => setIsPriceListModalOpen(true)}
                        className="h-10 px-5 bg-gradient-to-br from-[#9c89ff] to-[#7B61FF] text-white rounded-xl hover:opacity-95 text-[11px] font-black flex items-center gap-2 shadow-lg shadow-indigo-500/20 uppercase tracking-widest transition-all active:scale-95 border border-white/20"
                    >
                        <DocumentTextIcon className="h-5 w-5" /> Gerar Relatório
                    </button>
                    <div className="flex-grow"></div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest opacity-70">Total: {filteredProducts.length}</p>
                </div>
                <div className="flex flex-wrap items-end gap-4 justify-between">
                    <div className="flex flex-wrap items-end gap-4 flex-grow">
                        <div>
                            <label className="block text-xs font-medium text-muted mb-1">Status</label>
                            <select value={filters.stock} onChange={e => handleFilterChange('stock', e.target.value)} className="h-10 px-3 border rounded-xl text-sm bg-transparent border-border">
                                <option>Todos</option><option>Em estoque</option><option>Sem estoque</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted mb-1">Condição</label>
                            <select value={filters.condition} onChange={e => handleFilterChange('condition', e.target.value)} className="h-10 px-3 border rounded-xl text-sm bg-transparent border-border">
                                <option value="Todos">Todos</option><option>Novo</option><option>Seminovo</option><option>CPO</option><option>Openbox</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted mb-1">Local</label>
                            <select value={filters.location} onChange={e => handleFilterChange('location', e.target.value)} className="h-10 px-3 border rounded-xl text-sm bg-transparent border-border">
                                <option value="Todos">Todos</option><option>Loja Santa Cruz</option><option>Caruaru</option>
                            </select>
                        </div>
                        <div className="relative flex-grow min-w-[250px]">
                            <label className="block text-xs font-medium text-muted mb-1">Buscar produto</label>
                            <input type="text" placeholder="digite para buscar por SKU, descricao, IMEI, numero de serie e codigo de barras..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 border rounded-xl w-full bg-transparent border-border pr-8 h-10" />
                            {searchTerm && (<button onClick={() => setSearchTerm('')} className="absolute right-2 bottom-2 text-muted hover:text-primary" aria-label="Limpar busca"><XCircleIcon className="h-5 w-5" /></button>)}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-4">
                        <div>
                            <label className="block text-xs font-medium text-muted mb-1">Por página</label>
                            <select
                                value={itemsPerPage}
                                onChange={e => { setItemsPerPage(Number(e.target.value) as 15 | 20 | 30); setCurrentPage(1); }}
                                className="h-10 px-3 border rounded-xl text-sm bg-transparent border-border"
                            >
                                <option value={15}>15</option>
                                <option value={20}>20</option>
                                <option value={30}>30</option>
                            </select>
                        </div>
                        <button
                            onClick={() => setInventorySortOrder(o => o === 'newest' ? 'oldest' : 'newest')}
                            className="h-10 px-3 py-2 bg-gray-200 text-secondary rounded-xl hover:bg-gray-300 flex items-center gap-2 text-sm font-medium"
                        >
                            <ArrowsUpDownIcon className="h-4 w-4" />
                            <span>{inventorySortOrder === 'newest' ? 'Mais Recentes' : 'Mais Antigos'}</span>
                        </button>
                    </div>
                </div>
            </div>
            <div className="bg-surface rounded-3xl border border-border shadow-sm">
                {loading ? <div className="flex justify-center py-8"><SpinnerIcon /></div> : (
                    filteredProducts.length === 0 ? <p className="text-center text-muted p-6">Nenhum produto encontrado.</p> : (
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-sm text-left text-muted whitespace-nowrap">
                                <thead className="text-[10px] font-bold text-secondary uppercase bg-gray-50/50 border-b border-white/20">
                                    <tr>
                                        <th scope="col" className="px-2 py-2 text-center font-bold">ESTOQUE</th>
                                        <th scope="col" className="px-2 py-2 font-bold">DESCRIÇÃO</th>
                                        <th scope="col" className="px-2 py-2 font-bold">LOCAL</th>
                                        <th scope="col" className="px-2 py-2 font-bold">FORNECEDOR</th>
                                        <th scope="col" className="px-2 py-2 font-bold">VENDA</th>
                                        <th scope="col" className="px-2 py-2 font-bold">ATACADO</th>
                                        <th scope="col" className="px-2 py-2 font-bold">CUSTO</th>
                                        <th scope="col" className="px-2 py-2 font-bold">MARKUP</th>
                                        <th scope="col" className="px-2 py-2 text-center font-bold">GARANTIA</th>
                                        <th scope="col" className="px-2 py-2 text-center font-bold">CONDIÇÃO</th>
                                        <th scope="col" className="px-2 py-2 text-center font-bold">CADASTRO</th>
                                        <th scope="col" className="px-2 py-2 text-center font-bold">AÇÕES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedProducts.map(product => {
                                        // Calculate total cost including additional repair costs
                                        const totalCost = (product.costPrice || 0) + (product.additionalCostPrice || 0);
                                        const markup = (totalCost && totalCost > 0) ? ((product.price - totalCost) / totalCost) * 100 : 0;
                                        const supplier = suppliers.find(s => s.id === product.supplierId);
                                        const supplierLabelColor = getSupplierColorClass(supplier);

                                        let stockColorClass = 'bg-gray-100 text-gray-700 border-gray-200';
                                        if (product.stock === 0) stockColorClass = 'bg-red-100 text-red-700 border-red-200';
                                        else if (product.stock >= 1) stockColorClass = 'bg-green-100 text-green-700 border-green-200';

                                        return (<tr key={product.id} className="bg-surface border-b border-border last:border-0 hover:bg-surface-secondary">
                                            <td className="px-2 py-2 text-center">
                                                <span className={`px-2 py-0.5 text-sm font-bold rounded-xl border ${stockColorClass}`}>{product.stock}</span>
                                            </td>
                                            <td className="px-2 py-2 font-medium text-primary whitespace-normal max-w-[350px]">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-sm truncate" title={product.model}>{product.model}</span>
                                                    {product.origin === 'Troca' && (
                                                        <span className="flex-shrink-0 px-1 py-0 text-[8px] font-bold rounded-lg bg-rose-50 text-rose-400 border border-rose-100 uppercase tracking-tighter">
                                                            Troca
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-muted mt-0.5 leading-tight flex flex-wrap items-center gap-x-1.5 gap-y-1">
                                                    <span>SKU: {product.sku}</span>
                                                    {product.imei1 && (
                                                        <>
                                                            <span className="opacity-30">·</span>
                                                            <span>IMEI: {product.imei1}</span>
                                                        </>
                                                    )}
                                                    {product.serialNumber && (
                                                        <>
                                                            <span className="opacity-30">·</span>
                                                            <span>S/N: {product.serialNumber}</span>
                                                        </>
                                                    )}
                                                    {(product.brand || '').toLowerCase().includes('apple') && product.condition !== 'Novo' && product.batteryHealth !== undefined && product.batteryHealth > 0 && (
                                                        <>
                                                            <span className="opacity-30">·</span>
                                                            <span className={`font-bold ${product.batteryHealth < 80 ? 'text-red-500' : 'text-blue-600'}`}>
                                                                Saúde: {product.batteryHealth}%
                                                            </span>
                                                        </>
                                                    )}
                                                    {product.variations && product.variations.length > 0 && (
                                                        <>
                                                            <span className="opacity-30">·</span>
                                                            <span className="italic font-bold text-gray-800">
                                                                {product.variations.map(v => v.valueName ? `${v.gradeName}: ${v.valueName}` : v.gradeName).join(', ')}
                                                            </span>
                                                        </>
                                                    )}
                                                    {product.barcodes && product.barcodes.length > 0 && (
                                                        <>
                                                            <span className="opacity-30">·</span>
                                                            <span className="text-emerald-600 font-medium font-mono uppercase">EAN: {product.barcodes.join(', ')}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-1 py-2 text-xs text-muted">
                                                {product.storageLocation || '-'}
                                            </td>
                                            <td className="px-1 py-2">
                                                {(product.origin === 'Troca' || (supplier && supplier.linkedCustomerId)) ? (
                                                    <span className="px-1.5 py-0.5 text-[9px] font-medium rounded-xl bg-purple-100 text-purple-700 border border-purple-200">
                                                        Cliente
                                                    </span>
                                                ) : (supplier ? (
                                                    <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded-xl ${supplierLabelColor}`}>
                                                        {supplier.name}
                                                    </span>
                                                ) : (product.supplier ? (
                                                    <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded-xl bg-gray-100 text-gray-700 border border-gray-200`}>
                                                        {product.supplier}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted">-</span>
                                                )))}
                                            </td>
                                            <td className="px-1 py-2 font-bold text-primary text-sm">{formatCurrency(product.price)}</td>
                                            <td className="px-1 py-2 text-xs font-bold text-orange-500">{formatCurrency(product.wholesalePrice || 0)}</td>
                                            <td className="px-1 py-2 text-xs text-muted">{formatCurrency(totalCost, 'N/A')}</td>
                                            <td className={`px-1 py-2 text-sm font-bold ${markup >= 0 ? 'text-success' : 'text-danger'}`}>{markup.toFixed(0)}%</td>
                                            <td className="px-2 py-2 text-center text-xs">{(product as any).warranty || (product as any).warranty_period || (product as any).garantia || '-'}</td>
                                            <td className="px-2 py-2 text-center">
                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-xl ${getConditionTagClasses(product.condition)}`}>
                                                    {product.condition}
                                                </span>
                                            </td>
                                            <td className="px-2 py-2">
                                                <div className="flex flex-col text-[10px] text-gray-700 leading-tight items-center font-medium">
                                                    <span>{new Date(product.createdAt).toLocaleDateString('pt-BR')}</span>
                                                    <span>{new Date(product.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <span className="font-bold text-gray-900 truncate max-w-[80px] mt-0.5" title={userMap[product.createdBy]?.name || product.createdByName || (product.createdBy === 'Admin User' ? 'Keiler' : product.createdBy)}>
                                                        {product.createdBy === 'Admin User' ? 'Keiler' : (userMap[product.createdBy]?.name || product.createdByName || product.createdBy || '-')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-2 py-2">
                                                <div className="flex items-center justify-center">
                                                    <ProductActionsDropdown
                                                        permissions={permissions}
                                                        onHistory={() => handleViewHistory(product)}
                                                        onUpdateStock={() => handleOpenStockUpdateModal(product)}
                                                        onEdit={() => handleOpenProductModal(product)}
                                                        onDelete={() => handleOpenDeleteModal(product)}
                                                    />
                                                </div>
                                            </td>
                                        </tr>);
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
                {/* Pagination controls */}
                {filteredProducts.length > 0 && (
                    <div className="p-4 flex justify-between items-center border-t border-border">
                        <p className="text-sm text-muted">
                            Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredProducts.length)} de {filteredProducts.length} produtos
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeftIcon className="h-5 w-5" />
                            </button>
                            <span className="text-sm font-medium text-secondary px-2">
                                {currentPage} de {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRightIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderComprasTab = () => {
        const periodButtonClasses = (period: string) => `px-3 py-1 rounded-xl text-sm font-medium transition-colors ${activePeriod === period ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`;

        return (
            <div className="space-y-6">
                {/* BLOCO SUPERIOR ÚNICO - CONTROLE */}
                <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm flex flex-col gap-6">

                    {/* LINHA 1: Ações e Período */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        {permissions?.canCreatePurchase && (
                            <button
                                onClick={() => setIsNewPurchaseModalOpen(true)}
                                className="h-10 px-4 bg-gray-800 text-white rounded-xl font-bold flex items-center gap-2 text-[11px] hover:bg-gray-700 transition-all active:scale-95 shadow-sm uppercase tracking-wider h-10"
                            >
                                <PlusIcon className="h-5 w-5" /> Nova compra
                            </button>
                        )}

                        <div className="flex flex-col sm:flex-row items-end gap-3 w-full md:w-auto">
                            <div className="flex items-end gap-3">
                                <CustomDatePicker
                                    label="Data Início"
                                    value={startDate}
                                    onChange={setStartDate}
                                    max={toDateValue()}
                                    className="w-full sm:w-auto"
                                />
                                <CustomDatePicker
                                    label="Data Fim"
                                    value={endDate}
                                    onChange={setEndDate}
                                    max={toDateValue()}
                                    className="w-full sm:w-auto"
                                />
                            </div>

                            <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 h-10 mb-[1px]">
                                <button onClick={() => handlePeriodChange('hoje')} className={periodButtonClasses('hoje')}>Hoje</button>
                                <button onClick={() => handlePeriodChange('semana')} className={periodButtonClasses('semana')}>Semana</button>
                                <button onClick={() => handlePeriodChange('mes')} className={periodButtonClasses('mes')}>Mês</button>
                            </div>
                        </div>
                    </div>

                    {permissions?.canViewPurchaseKPIs && <hr className="border-gray-100" />}

                    {/* LINHA 2: KPIs e Filtros compactados */}
                    <div className="flex flex-col xl:flex-row justify-between items-end gap-6">
                        {/* KPIs - Esquerda */}
                        {permissions?.canViewPurchaseKPIs && (
                            <div className="flex gap-8 shrink-0">
                                <div>
                                    <p className="text-sm text-gray-500 font-medium mb-1">Qtd de compras do período</p>
                                    <div className="flex items-center gap-2">
                                        <ShoppingCartIcon className="h-5 w-5 text-gray-400" />
                                        <span className="text-2xl font-bold text-gray-800">{comprasKpi.count}</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium mb-1">Total de compras do período</p>
                                    <div className="flex items-center gap-2">
                                        <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
                                        <span className="text-2xl font-bold text-gray-800">{formatCurrency(comprasKpi.total)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Filtros - Direita */}
                        <div className="flex flex-col lg:flex-row items-center gap-3 w-full xl:w-auto xl:flex-1 justify-end">
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="w-full lg:w-48 px-3 border rounded-xl bg-white border-gray-200 text-sm h-10 focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all text-gray-600"
                            >
                                <option value="Todos">Filtrar por Status</option>
                                <option value="Pendente">Pendente</option>
                                <option value="Lançado">Lançado</option>
                                <option value="Cancelada">Cancelada</option>
                                <option value="Pago">Pago</option>
                            </select>

                            <div className="relative w-full xl:max-w-3xl flex-1">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="digite para buscar por ID da compra, Fornecedor e Codigo localizador..."
                                    value={purchaseSearchTerm}
                                    onChange={e => setPurchaseSearchTerm(e.target.value)}
                                    className="w-full p-2.5 pl-9 border rounded-xl bg-white border-gray-200 text-sm focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all h-10"
                                />
                            </div>

                            <button
                                onClick={() => setPurchaseSortOrder(o => o === 'newest' ? 'oldest' : 'newest')}
                                className="w-full lg:w-auto px-4 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 flex items-center justify-center gap-2 text-sm font-medium transition-colors border border-gray-200 h-10 flex-shrink-0 min-w-[110px]"
                            >
                                <ArrowsUpDownIcon className="h-4 w-4" />
                                <span>{purchaseSortOrder === 'newest' ? 'Recente' : 'Antigo'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* BLOCO DA TABELA (Sem filtros internos) */}
                <div className="bg-surface rounded-3xl border border-border shadow-sm">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-secondary uppercase bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 font-medium">ID</th>
                                    <th className="px-4 py-3 font-medium">Data da compra</th>
                                    <th className="px-4 py-3 font-medium">Fornecedor</th>
                                    <th className="px-4 py-3 font-medium">Localizador no estoque</th>
                                    <th className="px-4 py-3 font-medium">Total da compra</th>
                                    <th className="px-4 py-3 font-medium">Estoque</th>
                                    <th className="px-4 py-3 font-medium">Financeiro</th>
                                    <th className="px-4 py-3 font-medium">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="text-primary">
                                {(() => {
                                    // Optimization: Pre-calculate product mapping for all purchases
                                    const productIdsByPurchase: Record<string, string[]> = {};
                                    products.forEach(prod => {
                                        if (prod.purchaseOrderId) {
                                            if (!productIdsByPurchase[prod.purchaseOrderId]) {
                                                productIdsByPurchase[prod.purchaseOrderId] = [];
                                            }
                                            productIdsByPurchase[prod.purchaseOrderId].push(prod.id);
                                        }
                                    });

                                    return filteredPurchases.map(p => {
                                        const productIdsFromPurchase = productIdsByPurchase[p.id] || [];
                                        const hasSoldProducts = productIdsFromPurchase.some(pid => soldProductIds.has(pid));
                                        const disabledReason = 'Não é possível alterar pois contém produtos já vendidos.';
                                        return (
                                            <tr key={p.id} className="border-t border-border hover:bg-surface-secondary">
                                                <td className="px-4 py-3 font-semibold">#{p.displayId}</td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-primary">{new Date(p.purchaseDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                                                    <div className="text-xs text-muted">por {p.createdBy}</div>
                                                </td>
                                                <td className="px-4 py-3">{p.supplierName}</td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => handleCopyLocatorId(p.locatorId)}
                                                        className="text-blue-500 hover:text-blue-700 hover:underline font-mono"
                                                        title="Copiar Localizador"
                                                    >
                                                        {p.locatorId}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 font-semibold">{formatCurrency(p.total)}</td>
                                                <td className="px-4 py-3"><StatusTag text={p.stockStatus} type={getStockStatusType(p.stockStatus)} /></td>
                                                <td className="px-4 py-3"><StatusTag text={p.financialStatus} type={getFinancialStatusType(p.financialStatus)} /></td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <button onClick={() => setPurchaseToView(p)} title="Visualizar"><EyeIcon className="h-5 w-5 text-blue-500 hover:text-blue-700" /></button>
                                                        {(permissions?.canLaunchPurchase && p.stockStatus === 'Lançado') ? (
                                                            <button onClick={() => setPurchaseToRevert(p)} title={hasSoldProducts ? disabledReason : "Reverter Compra"} disabled={hasSoldProducts}><ArrowUturnLeftIcon className={`h-5 w-5 ${hasSoldProducts ? 'text-gray-300' : 'text-yellow-500 hover:text-yellow-700'}`} /></button>
                                                        ) : (permissions?.canEditPurchase &&
                                                            <button onClick={() => handleOpenEditPurchaseModal(p)} title={hasSoldProducts ? disabledReason : "Editar"} disabled={hasSoldProducts}><EditIcon className={`h-5 w-5 ${hasSoldProducts ? 'text-gray-300' : 'text-orange-400 hover:text-orange-600'}`} /></button>
                                                        )}
                                                        {permissions?.canEditPurchase && <button onClick={() => setPurchaseToUpdateFinance(p)} title="Alterar Status Financeiro"><BanknotesIcon className={`h-5 w-5 ${p.financialStatus === 'Pago' ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}`} /></button>}
                                                        {permissions?.canLaunchPurchase && (
                                                            <button onClick={() => setStockInPurchase(p)} title="Lançar no Estoque" disabled={p.stockStatus === 'Lançado'}>
                                                                {p.stockStatus === 'Parcialmente Lançado' ? (
                                                                    <div className="bg-indigo-500 text-white rounded-full p-0.5">
                                                                        <DocumentArrowUpIcon className="h-5 w-5" />
                                                                    </div>
                                                                ) : (
                                                                    <DocumentArrowUpIcon className={`h-5 w-5 ${p.stockStatus === 'Lançado' ? 'text-gray-300' : 'text-indigo-500 hover:text-indigo-700'}`} />
                                                                )}
                                                            </button>
                                                        )}
                                                        {permissions?.canDeletePurchase && (() => {
                                                            const isLaunched = p.stockStatus === 'Lançado' || p.stockStatus === 'Parcialmente Lançado';
                                                            const deleteDisabled = hasSoldProducts || isLaunched;
                                                            const deleteReason = isLaunched
                                                                ? 'Reverta o lançamento da compra antes de excluí-la.'
                                                                : (hasSoldProducts ? disabledReason : 'Excluir');
                                                            return (
                                                                <button
                                                                    onClick={() => setPurchaseToDelete(p)}
                                                                    title={deleteReason}
                                                                    disabled={deleteDisabled}
                                                                >
                                                                    <TrashIcon className={`h-5 w-5 ${deleteDisabled ? 'text-gray-300' : 'text-red-500 hover:text-red-700'}`} />
                                                                </button>
                                                            );
                                                        })()}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                })()}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 flex justify-between items-center text-sm">
                        <p className="font-semibold text-secondary">Total de Registros: {filteredPurchases.length}</p>
                        <div className="flex items-center gap-2 text-secondary">
                            <button className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-50" disabled><ChevronLeftIcon className="h-5 w-5" /></button>
                            <span>1 de 1</span>
                            <button className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-50" disabled><ChevronRightIcon className="h-5 w-5" /></button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-primary">Estoque e Compras</h1>

            <div className="inline-flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-sm">
                {availableTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-8 py-3 rounded-xl text-[13px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-gray-900/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {(loading || authLoading) ? (
                <div className="flex flex-col justify-center items-center py-20 gap-4">
                    <SpinnerIcon className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted text-sm animate-pulse font-medium">Carregando dados do sistema...</p>
                </div>
            ) : (
                <>
                    {activeTab === 'estoque' && renderEstoqueTab()}
                    {activeTab === 'compras' && renderComprasTab()}
                    {availableTabs.length === 0 && !authLoading && user && (
                        <div className="bg-surface rounded-xl border border-border p-12 text-center animate-fade-in">
                            <ArchiveBoxIcon className="h-12 w-12 text-muted mx-auto mb-4 opacity-20" />
                            <h3 className="text-lg font-bold text-primary mb-1">Acesso Restrito</h3>
                            <p className="text-sm text-muted max-w-xs mx-auto">Sua conta ({user.email}) não possui permissão para visualizar o estoque ou as compras.</p>
                        </div>
                    )}
                    {availableTabs.length === 0 && !authLoading && !user && (
                        <div className="p-12 text-center">
                            <p className="text-muted">Por favor, faça login para acessar.</p>
                        </div>
                    )}
                </>
            )}

            {purchaseToView && <PurchaseOrderDetailModal purchase={purchaseToView} onClose={() => setPurchaseToView(null)} associatedProducts={associatedProducts} />}
            {isDeleteModalOpen && productToDelete && <ConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDeleteConfirm} title="Confirmar Exclusão" message={`Tem certeza que deseja excluir o produto "${productToDelete.model}"? Esta ação não pode ser desfeita.`} />}
            {isHistoryModalOpen && productForHistory && <ProductHistoryModal product={productForHistory} salesHistory={productSalesHistory} customers={customers} users={users} productMap={productMap} onClose={() => setIsHistoryModalOpen(false)} />}
            {isBulkUpdateModalOpen && <BulkPriceUpdateModal allProducts={products} onClose={() => setIsBulkUpdateModalOpen(false)} onBulkUpdate={handleBulkUpdate} />}
            {isBulkLocationUpdateModalOpen && <BulkLocationUpdateModal allProducts={products} purchases={purchases} onClose={() => setIsBulkLocationUpdateModalOpen(false)} onBulkUpdate={handleBulkLocationUpdate} />}
            {isUpdateStockModalOpen && productForStockUpdate && <UpdateStockModal product={productForStockUpdate} onClose={() => { setIsUpdateStockModalOpen(false); setProductForStockUpdate(null); }} onSave={handleStockUpdateSave} />}
            <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><SpinnerIcon /></div>}>
                <ProductModal isOpen={isProductModalOpen} product={editingProduct} suppliers={suppliers} brands={brands} categories={categories} productModels={productModels} grades={grades} gradeValues={gradeValues} onClose={handleCloseProductModal} onSave={handleSaveProduct} customers={customers} onAddNewSupplier={handleAddNewSupplier} />
                {isPriceListModalOpen && <PriceListModal isOpen={isPriceListModalOpen} onClose={() => setIsPriceListModalOpen(false)} products={products} hideSummary={true} />}
                {isNewPurchaseModalOpen && <PurchaseOrderModal suppliers={suppliers} customers={customers} onClose={handleCloseNewPurchaseModal} purchaseOrderToEdit={purchaseToEdit} brands={brands} categories={categories} productModels={productModels} grades={grades} gradeValues={gradeValues} onAddNewSupplier={handleAddNewSupplier} />}
                {stockInPurchase && <StockInModal purchaseOrder={stockInPurchase} onClose={handleCloseStockInModal} allProducts={products} grades={grades} gradeValues={gradeValues} />}
            </Suspense>
            {purchaseToDelete && <DeleteWithReasonModal isOpen={!!purchaseToDelete} onClose={() => setPurchaseToDelete(null)} onConfirm={handleDeletePurchase} title={`Excluir Compra #${purchaseToDelete.displayId}`} message="Esta ação irá remover permanentemente a compra. Esta ação não pode ser desfeita." />}
            {purchaseToUpdateFinance && <ConfirmationModal isOpen={!!purchaseToUpdateFinance} onClose={() => setPurchaseToUpdateFinance(null)} onConfirm={handleFinanceToggle} title="Alterar Status Financeiro" message={`Deseja marcar a compra #${purchaseToUpdateFinance.displayId} como "${purchaseToUpdateFinance.financialStatus === 'Pendente' ? 'Paga' : 'Pendente'}"?`} variant="success" />}
            {purchaseToRevert && <ConfirmationModal isOpen={!!purchaseToRevert} onClose={() => setPurchaseToRevert(null)} onConfirm={handleRevertPurchase} title={`Reverter Lançamento da Compra #${purchaseToRevert.displayId}`} message="Esta ação irá remover do estoque todos os produtos associados a esta compra e retornará o status para 'Pendente'. Deseja continuar?" variant="danger" />}
        </div>
    );
};

export default Products;
