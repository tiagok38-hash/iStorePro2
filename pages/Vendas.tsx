
import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Sale, Product, Customer, User, SaleItem, PermissionProfile, Brand, Category, ProductModel, Grade, GradeValue, Supplier, ReceiptTermParameter, PermissionSet } from '../types.ts';
import { getSales, getProducts, getCustomers, getUsers, addCustomer, addProduct, formatCurrency, cancelSale, getPermissionProfiles, getBrands, getCategories, getProductModels, getGrades, getGradeValues, getSuppliers, getReceiptTerms, getPaymentMethods } from '../services/mockApi.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import { SuspenseFallback } from '../components/GlobalLoading.tsx';
import { SpinnerIcon, EllipsisVerticalIcon, CalendarDaysIcon, ChevronDownIcon, CloseIcon, PlusIcon, TrashIcon, SearchIcon, MinusIcon, EyeIcon, EditIcon, PrinterIcon, XCircleIcon, DocumentTextIcon, TicketIcon, ChevronLeftIcon, ChevronRightIcon, WhatsAppIcon, CreditCardIcon } from '../components/icons.tsx';
import CardPaymentModal from '../components/CardPaymentModal.tsx';
import SaleDetailModal from '../components/SaleDetailModal.tsx';
import DeleteWithReasonModal from '../components/DeleteWithReasonModal.tsx';
import SaleReceiptModal from '../components/SaleReceiptModal.tsx';
import CustomDatePicker from '../components/CustomDatePicker.tsx';
import { toDateValue } from '../utils/dateUtils.ts';

// Lazy load heavy modal component
const NewSaleModal = lazy(() => import('../components/NewSaleModal.tsx'));


// --- Helper Functions ---
const getLocalISODateString = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getStartDateForPeriod = (period: 'hoje' | '7dias' | '15dias' | 'Mes'): string => {
    const today = new Date();
    switch (period) {
        case 'hoje':
            return getLocalISODateString(today);
        case '7dias':
            today.setDate(today.getDate() - 6); // Includes today
            return getLocalISODateString(today);
        case '15dias':
            today.setDate(today.getDate() - 14);
            return getLocalISODateString(today);
        case 'Mes':
        default:
            return getLocalISODateString(new Date(today.getFullYear(), today.getMonth(), 1));
    }
};


// --- Sub-components ---

const KpiCard: React.FC<{ title: string; value: string; bgColor: string; textColor?: string }> = React.memo(({ title, value, bgColor, textColor = 'text-primary' }) => (
    <div className={`p-2.5 sm:p-4 rounded-3xl ${bgColor} ${textColor} flex flex-col justify-center min-h-[64px] sm:min-h-[auto]`}>
        <h3 className="text-[10px] sm:text-sm font-bold uppercase tracking-wider opacity-70 leading-tight">{title}</h3>
        <p className="text-base sm:text-2xl font-black mt-0.5 sm:mt-1 truncate">{value}</p>
    </div>
));

const SaleActionsDropdown: React.FC<{ onEdit: () => void; onView: () => void; onReprint: () => void; onCancel: () => void; permissions: PermissionSet | null }> = React.memo(({ onEdit, onView, onReprint, onCancel, permissions }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({});

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isOpen) {
            setIsOpen(false);
        } else {
            if (!buttonRef.current) return;
            const rect = buttonRef.current.getBoundingClientRect();

            // Consider bottom nav height mostly on mobile
            const bottomSafeMargin = window.innerWidth < 640 ? 80 : 20;
            const spaceBelow = window.innerHeight - rect.bottom - bottomSafeMargin;
            const menuHeight = 240; // Safer estimated height 

            const newStyle: React.CSSProperties = {
                position: 'fixed',
                width: '12rem', // w-48
                zIndex: 9999, // Ensure it's above BottomNav and everything else
            };

            // Align right edge of menu with right edge of button (plus a bit of margin if strictly needed)
            // But usually, rect.right is fine. 
            // Let's cap it to screen width to avoid horizontal overflow
            const rightPos = window.innerWidth - rect.right;
            newStyle.right = Math.max(8, rightPos); // Keep at least 8px from right edge

            if (spaceBelow < menuHeight) {
                // Open upwards
                // Calculate bottom position: distance from bottom of screen to top of button
                newStyle.bottom = window.innerHeight - rect.top;
                newStyle.transformOrigin = 'bottom right';
            } else {
                // Open downwards
                newStyle.top = rect.bottom;
                newStyle.transformOrigin = 'top right';
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
        // Using capture phase for scroll to detect scroll in any parent
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [isOpen]);

    const createHandler = (fn: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        fn();
        setIsOpen(false);
    };

    const menuItemClasses = "w-full text-left flex items-center gap-3 px-4 py-3 text-sm"; // Increased touch target for mobile

    return (
        <div className="relative">
            <button ref={buttonRef} onClick={handleToggle} className="p-2 rounded-full hover:bg-surface-secondary text-muted active:bg-gray-200 transition-colors"><EllipsisVerticalIcon className="h-5 w-5" /></button>
            {isOpen && createPortal(
                <div ref={dropdownRef} style={style} className="rounded-xl shadow-xl bg-surface ring-1 ring-black ring-opacity-10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="py-1">
                        <button onClick={createHandler(onView)} className={`${menuItemClasses} text-secondary hover:bg-surface-secondary active:bg-gray-100`}><EyeIcon className="h-4 w-4" /> Visualizar</button>
                        {permissions?.canEditSale && (
                            <button onClick={createHandler(onEdit)} className={`${menuItemClasses} text-secondary hover:bg-surface-secondary active:bg-gray-100`}><EditIcon className="h-4 w-4" /> Editar</button>
                        )}
                        <button onClick={createHandler(onReprint)} className={`${menuItemClasses} text-secondary hover:bg-surface-secondary active:bg-gray-100`}><PrinterIcon className="h-4 w-4" /> Reimprimir</button>
                        {permissions?.canCancelSale && (
                            <button onClick={createHandler(onCancel)} className={`${menuItemClasses} text-danger hover:bg-danger-light active:bg-red-100`}><XCircleIcon className="h-4 w-4" /> Cancelar</button>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
});


// --- Main Page Component ---

const Vendas: React.FC = () => {
    const [sales, setSales] = useState<Sale[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [permissionProfiles, setPermissionProfiles] = useState<PermissionProfile[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [productModels, setProductModels] = useState<ProductModel[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [gradeValues, setGradeValues] = useState<GradeValue[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [receiptTerms, setReceiptTerms] = useState<ReceiptTermParameter[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
    const [saleToView, setSaleToView] = useState<Sale | null>(null);
    const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);
    const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
    const [saleToReprint, setSaleToReprint] = useState<Sale | null>(null);
    const [isPrintChoiceOpen, setIsPrintChoiceOpen] = useState(false);
    const [receiptModalFormat, setReceiptModalFormat] = useState<'A4' | 'thermal' | null>(null);


    const [startDate, setStartDate] = useState(getStartDateForPeriod('hoje'));
    const [endDate, setEndDate] = useState(getLocalISODateString(new Date()));
    const [activePeriod, setActivePeriod] = useState<'hoje' | '7dias' | '15dias' | 'Mes' | 'personalizado'>('hoje');
    const [sellerFilter, setSellerFilter] = useState('todos');
    const [statusFilter, setStatusFilter] = useState('todos');
    const [customerSearch, setCustomerSearch] = useState('');
    const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');

    // Debounce customer search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedCustomerSearch(customerSearch);
        }, 300);
        return () => clearTimeout(timer);
    }, [customerSearch]);

    const [productMap, setProductMap] = useState<Record<string, Product>>({});
    const [customerMap, setCustomerMap] = useState<Record<string, Customer>>({});
    const [userMap, setUserMap] = useState<Record<string, User>>({});

    const { showToast } = useToast();
    const { permissions, user } = useUser();
    const location = useLocation();

    // Handle deep linking from Dashboard
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const period = params.get('period');
        if (period === 'hoje' || period === '7dias' || period === '15dias' || period === 'Mes') {
            setActivePeriod(period as any);
            setStartDate(getStartDateForPeriod(period as any));
            setEndDate(toDateValue());
        }
    }, [location]);


    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const SALES_PER_PAGE = 10;

    const [longLoading, setLongLoading] = useState(false);

    // Unified loading handled by SuspenseFallback

    const showToastRef = useRef(showToast);
    useEffect(() => { showToastRef.current = showToast; }, [showToast]);

    // Ref to prevent concurrent fetches
    const isFetchingRef = useRef(false);
    // Debounce ref for broadcast channel
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const fetchData = useCallback(async (silent = false, retryCount = 0) => {
        // Prevent concurrent fetches
        if (isFetchingRef.current) {
            return;
        }
        isFetchingRef.current = true;

        if (!silent) setLoading(true);
        setError(null);

        // Helper to fetch data with individual error handling
        const fetchItem = async <T,>(name: string, fetcher: (uid?: string) => Promise<T>, fallback: T): Promise<T> => {
            try {
                return await fetcher(user?.id);
            } catch (err) {
                console.error(`Vendas: Error fetching ${name}:`, err);
                return fallback;
            }
        };

        try {
            // Stage 1: Auxiliary Metadata (Fast, Light) - Resilient
            const [
                profilesData, brandsData, categoriesData, modelsData,
                gradesData, gradeValuesData, receiptTermsData, paymentMethodsData
            ] = await Promise.all([
                fetchItem('Permissions', getPermissionProfiles, []),
                fetchItem('Brands', getBrands, []),
                fetchItem('Categories', getCategories, []),
                fetchItem('Models', getProductModels, []),
                fetchItem('Grades', getGrades, []),
                fetchItem('GradeValues', getGradeValues, []),
                fetchItem('ReceiptTerms', getReceiptTerms, []),
                fetchItem('PaymentMethods', getPaymentMethods, [])
            ]);

            setPermissionProfiles(profilesData);
            setBrands(brandsData);
            setCategories(categoriesData);
            setProductModels(modelsData);
            setGrades(gradesData || []);
            setGradeValues(gradeValuesData);
            setReceiptTerms(receiptTermsData);
            setPaymentMethods((paymentMethodsData || []).filter((m: any) => m.name && !m.name.toLowerCase().includes('pagseguro')));

            // Stage 2: Core Data (Sales)
            // Sales is CRITICAL and should respect permission to see all or only own sales
            let salesData: Sale[] = [];
            try {
                // IMPORTANT: Admins or users with management permissions should see ALL sales.
                // Sellers should only see their own sales.
                const canSeeAllSales = permissions?.canManageUsers || permissions?.canManagePermissions || permissions?.canViewAudit;
                const userIdToFilter = canSeeAllSales ? undefined : user?.id;

                salesData = await getSales(userIdToFilter, undefined, startDate, endDate);
            } catch (err) {
                console.error('Vendas: Failed to fetch sales:', err);
                throw new Error('Falha ao carregar lista de vendas.');
            }

            // API already sorts by created_at DESC, but we keep this for extra safety with display dates
            const sortedSales = [...salesData].sort((a, b) => {
                const dateA = a.date ? new Date(a.date).getTime() : 0;
                const dateB = b.date ? new Date(b.date).getTime() : 0;
                return dateB - dateA;
            });
            setSales(sortedSales);

            // Once Sales & Metadata are ready, clear initial loading spinner
            if (!silent) setLoading(false);

            // Stage 3: Background Data (Support Entities)
            // OPTIMIZATION: We exclude heavy JSONB columns for Products in the list view.
            const productSelect = 'id,sku,brand,category,model,price,wholesalePrice,costPrice,additionalCostPrice,stock,minimumStock,serialNumber,imei1,imei2,batteryHealth,condition,warranty,createdAt,updatedAt,createdBy,color,storageLocation,storage,purchaseOrderId,purchaseItemId,supplierId,origin,commission_enabled,commission_type,commission_value,discount_limit_type,discount_limit_value';

            fetchItem('Products', () => getProducts({ select: productSelect }), []).then(productsData => {
                setProducts(productsData);
                const pMap: Record<string, Product> = {};
                productsData.forEach((p: Product) => { pMap[p.id] = p; });
                setProductMap(pMap);
            });

            fetchItem('Customers', () => getCustomers(false), []).then(customersData => {
                setCustomers(customersData);
                const cMap: Record<string, Customer> = {};
                customersData.forEach((c: Customer) => { cMap[c.id] = c; });
                setCustomerMap(cMap);
            });

            fetchItem('Users', getUsers, []).then(usersData => {
                setUsers(usersData);
                const uMap: Record<string, User> = {};
                usersData.forEach((u: User) => { uMap[u.id] = u; });
                setUserMap(uMap);
            });

            fetchItem('Suppliers', getSuppliers, []).then(setSuppliers);

        } catch (error: any) {
            const isAbort = error?.name === 'AbortError' || error?.message?.includes('aborted');
            if (isAbort) {
                console.warn('Vendas: Fetch aborted.');
            } else {
                console.error('Vendas: Error fetching data:', error);

                // Auto-retry once after short delay (handles reconnection issues after idle)
                if (retryCount < 1) {
                    setTimeout(() => fetchData(silent, retryCount + 1), 2000);
                    return;
                }

                if (!silent) showToast('Erro ao carregar lista de vendas.', 'error');
            }
        } finally {
            isFetchingRef.current = false;
            if (!silent) setLoading(false);
        }
    }, [user?.id, permissions, startDate, endDate, showToast]);

    useEffect(() => {
        fetchData();

        const handleCompanyUpdate = () => {
            if (document.visibilityState !== 'visible') return;
            fetchData(true);
        };
        window.addEventListener('company-data-updated', handleCompanyUpdate);

        const handleSmartReload = () => {
            if (document.visibilityState !== 'visible') return;
            fetchData(true);
        };
        window.addEventListener('app-reloadData', handleSmartReload);

        return () => {
            window.removeEventListener('company-data-updated', handleCompanyUpdate);
            window.removeEventListener('app-reloadData', handleSmartReload);
        };
    }, [fetchData]);

    // Re-fetch data whenever startDate or endDate changes
    useEffect(() => {
        if (permissions?.canAccessVendas) {
            fetchData();
        }
    }, [startDate, endDate, permissions]);

    const handlePeriodChange = useCallback((period: string) => {
        setActivePeriod(period);
        const today = new Date();

        if (period === 'ontem') {
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            setStartDate(getLocalISODateString(yesterday));
            setEndDate(getLocalISODateString(yesterday));
        } else if (period === 'semana') {
            const startOfWeek = new Date(today);
            const day = startOfWeek.getDay(); // 0 (Domingo) - 6 (Sábado)
            const diff = startOfWeek.getDate() - day; // Ajusta para o último domingo
            startOfWeek.setDate(diff);
            setStartDate(getLocalISODateString(startOfWeek));
            setEndDate(getLocalISODateString(today));
        } else {
            setStartDate(getStartDateForPeriod(period as any));
            setEndDate(getLocalISODateString(today));
        }
    }, []);

    const handleClearFilter = useCallback(() => {
        handlePeriodChange('Mes');
        setSellerFilter('todos');
        setStatusFilter('todos');
        setCustomerSearch('');
    }, [handlePeriodChange]);

    const handleDateInputChange = useCallback((setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setter(e.target.value);
        setActivePeriod('personalizado'); // Custom range
    }, []);

    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            const saleDate = new Date(sale.date);

            // By appending time, we ensure the date string is parsed in local time, not UTC.
            // This avoids timezone issues where '2025-10-20' could be interpreted as the end of '2025-10-19'.
            const start = new Date(startDate + 'T00:00:00');
            const end = new Date(endDate + 'T23:59:59.999');

            const dateMatch = saleDate >= start && saleDate <= end;
            const sellerMatch = sellerFilter === 'todos' || sale.salespersonId === sellerFilter;

            let statusMatch = true;
            if (statusFilter === 'Promissoria') {
                statusMatch = sale.payments.some(p => p.type === 'pending');
            } else if (statusFilter === 'PDV') {
                // Filter PDV only if it has a linked cash session (matches visual representation)
                statusMatch = sale.origin === 'PDV' && (!!sale.cashSessionDisplayId || !!sale.cashSessionId);
            } else if (statusFilter !== 'todos') {
                statusMatch = sale.status === statusFilter;
            }

            const customerName = customerMap[sale.customerId]?.name || '';

            // Normalize search term: remove # and spaces
            const normalizedSearch = debouncedCustomerSearch.toLowerCase().trim().replace(/^#/, '');
            const saleIdLower = sale.id.toLowerCase();

            // Check if search matches sale ID (supports: "ID-8", "8", "#ID-8")
            const saleIdMatch = normalizedSearch !== '' && (
                saleIdLower.includes(normalizedSearch) ||
                saleIdLower === `id-${normalizedSearch}` ||
                sale.id === normalizedSearch
            );

            const customerMatch = debouncedCustomerSearch === '' || customerName.toLowerCase().includes(normalizedSearch) || saleIdMatch;

            // Se o filtro for Promissoria, queremos ver todas, inclusive as canceladas que geraram promissoria? 
            // Geralmente cancelada anula a dívida, então talvez devêssemos ignorar canceladas se o filtro for Promissoria?
            // O padrão atual mostra canceladas se statusFilter == 'Cancelada'.
            // Vou assumir que se filtrar por Promissoria, queremos ver as ativas.
            if (statusFilter === 'Promissoria') {
                statusMatch = statusMatch && sale.status !== 'Cancelada';
            }

            if (sale.status === 'Rascunho') return false;

            return dateMatch && sellerMatch && statusMatch && customerMatch;
        });
    }, [sales, startDate, endDate, sellerFilter, statusFilter, debouncedCustomerSearch, customerMap]);

    // Reset page number when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [startDate, endDate, sellerFilter, statusFilter, customerSearch]);

    // Pagination Logic
    const pageCount = Math.ceil(filteredSales.length / SALES_PER_PAGE);
    const currentSales = filteredSales.slice((currentPage - 1) * SALES_PER_PAGE, currentPage * SALES_PER_PAGE);
    const paginate = (pageNumber: number) => {
        if (pageNumber > 0 && pageNumber <= pageCount) {
            setCurrentPage(pageNumber);
        }
    };


    const sellerUsers = useMemo(() => {
        const sellerProfileIds = new Set(
            permissionProfiles
                .filter(p => p.permissions.canCreateSale)
                .map(p => p.id)
        );
        return users.filter(u => sellerProfileIds.has(u.permissionProfileId));
    }, [users, permissionProfiles]);

    const kpi = useMemo(() => {
        const activeSales = filteredSales.filter(s => s.status !== 'Cancelada');
        const faturamento = activeSales.reduce((sum, sale) => sum + sale.total, 0);
        const ticketMedio = activeSales.length > 0 ? faturamento / activeSales.length : 0;

        const lucro = filteredSales.reduce((sum, sale) => {
            if (sale.status === 'Cancelada') return sum;
            const cost = (sale.items || []).reduce((itemSum, item) => {
                const product = productMap[item.productId];
                const productCost = (product?.costPrice || 0) + (product?.additionalCostPrice || 0);
                return itemSum + productCost * item.quantity;
            }, 0);
            const revenue = sale.total;
            return sum + (revenue - cost);
        }, 0);
        const taxas = filteredSales.reduce((sum, sale) => {
            if (sale.status === 'Cancelada') return sum;
            return sum + (sale.payments || []).reduce((acc, p) => acc + (p.fees || 0), 0);
        }, 0);
        return { faturamento, lucro, taxas, ticketMedio };
    }, [filteredSales, productMap]);

    const handleAddNewCustomer = useCallback(async (customerData: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer | null> => {
        try {
            const newCustomer = await addCustomer(customerData);
            setCustomers(prev => [...prev, newCustomer]);
            setCustomerMap(prev => ({ ...prev, [newCustomer.id]: newCustomer }));
            showToast('Cliente adicionado com sucesso!', 'success');
            return newCustomer;
        } catch (error) {
            showToast('Erro ao salvar novo cliente.', 'error');
            return null;
        }
    }, [showToast]);

    const handleAddNewProduct = useCallback(async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { selectedCustomerId?: string }): Promise<Product | null> => {
        try {
            const newProduct = await addProduct(productData, user?.id, user?.name);
            setProducts(prev => [...prev, newProduct]);
            setProductMap(prev => ({ ...prev, [newProduct.id]: newProduct }));
            return newProduct;
        } catch (error: any) {
            showToast(error.message || 'Erro ao adicionar novo produto de troca.', 'error');
            return null;
        }
    }, [showToast, user]);

    const handleCancelSaleConfirm = useCallback(async (reason: string) => {
        if (!saleToCancel) return;
        try {
            const canceled = await cancelSale(saleToCancel.id, reason, user?.id, user?.name);
            showToast('Venda cancelada com sucesso!', 'success');

            // Check if there were trade-in products that couldn't be removed because they were already sold
            if (canceled.tradeInAlreadySold && canceled.tradeInAlreadySold.length > 0) {
                const productNames = canceled.tradeInAlreadySold.map((p: any) => p.model).join(', ');
                showToast(
                    `Atenção: O(s) aparelho(s) de troca (${productNames}) não foi(ram) removido(s) pois já foi(ram) vendido(s) em outra venda.`,
                    'info'
                );
            }

            // Direct state update instead of refetch
            setSales(prevSales => prevSales.map(s => s.id === canceled.id ? canceled : s));
        } catch (error) {
            showToast('Erro ao cancelar a venda.', 'error');
        } finally {
            setSaleToCancel(null);
        }
    }, [saleToCancel, showToast, user]);

    const handleSaleSaved = useCallback(async (updatedSale: Sale) => {
        setIsModalOpen(false);
        showToast('Venda salva com sucesso!', 'success');

        setSales(prevSales => {
            const index = prevSales.findIndex(s => s.id === updatedSale.id);
            if (index > -1) {
                const newSales = [...prevSales];
                newSales[index] = updatedSale;
                return newSales;
            }
            return [updatedSale, ...prevSales];
        });
        setSaleToEdit(null);
    }, [showToast]);

    const getStatusBadge = (status: Sale['status']) => {
        switch (status) {
            case 'Finalizada':
                return <span className="px-1.5 py-0.5 text-[10px] sm:text-xs font-bold rounded-full bg-green-100 text-green-700 border border-green-200">Finalizada</span>;
            case 'Pendente':
                return <span className="px-1.5 py-0.5 text-[10px] sm:text-xs font-bold rounded-full bg-orange-100 text-orange-700 border border-orange-200">Pendente</span>;
            case 'Cancelada':
                return <span className="px-1.5 py-0.5 text-[10px] sm:text-xs font-bold rounded-full bg-red-100 text-red-700 border border-red-200">Cancelada</span>;
            case 'Editada':
                return (
                    <div className="flex gap-1 items-center flex-wrap">
                        <span className="px-1.5 py-0.5 text-[10px] sm:text-xs font-bold rounded-full bg-purple-100 text-purple-700 border border-purple-200">Editada</span>
                        <span className="px-1.5 py-0.5 text-[10px] sm:text-xs font-bold rounded-full bg-green-100 text-green-700 border border-green-200">Finalizada</span>
                    </div>
                );
            default:
                return null;
        }
    };

    const periodButtonClasses = (period: string) => `rounded-xl font-black uppercase tracking-widest transition-all duration-300 ${activePeriod === period ? 'bg-gray-800 text-white shadow-lg shadow-gray-900/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`;

    return (
        <div className="space-y-4 sm:space-y-6">
            <h1 className="text-xl sm:text-3xl font-bold text-primary">Vendas</h1>

            <div className="space-y-4">
                {permissions?.canViewSalesKPIs && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
                        <KpiCard title="Faturamento" value={formatCurrency(kpi.faturamento)} bgColor="bg-blue-100" />
                        <KpiCard title="Ticket Médio" value={formatCurrency(kpi.ticketMedio)} bgColor="bg-purple-100" />
                        <KpiCard title="Taxas" value={formatCurrency(kpi.taxas)} bgColor="bg-red-100" />
                        <KpiCard
                            title="Lucro"
                            value={formatCurrency(kpi.lucro)}
                            bgColor={kpi.lucro >= 0 ? "bg-green-100" : "bg-red-100"}
                            textColor={kpi.lucro >= 0 ? "text-green-700" : "text-red-700"}
                        />
                    </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-end gap-3 sm:gap-4">
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
                        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl border border-gray-200 shadow-sm h-10">
                            <button onClick={() => handlePeriodChange('hoje')} className={`${periodButtonClasses('hoje')} px-3 sm:px-4 py-2 text-[10px] sm:text-xs whitespace-nowrap h-8 flex items-center`}>Hoje</button>
                            <button onClick={() => handlePeriodChange('ontem')} className={`${periodButtonClasses('ontem')} px-3 sm:px-4 py-2 text-[10px] sm:text-xs whitespace-nowrap h-8 flex items-center`}>Ontem</button>
                            <button onClick={() => handlePeriodChange('semana')} className={`${periodButtonClasses('semana')} px-3 sm:px-4 py-2 text-[10px] sm:text-xs whitespace-nowrap h-8 flex items-center`}>Semana</button>
                            <button onClick={() => handlePeriodChange('7dias')} className={`${periodButtonClasses('7dias')} px-3 sm:px-4 py-2 text-[10px] sm:text-xs whitespace-nowrap h-8 flex items-center`}>7d</button>
                            <button onClick={() => handlePeriodChange('Mes')} className={`${periodButtonClasses('Mes')} px-3 sm:px-4 py-2 text-[10px] sm:text-xs whitespace-nowrap h-8 flex items-center`}>Mês</button>
                        </div>
                        <button onClick={handleClearFilter} className="h-10 px-2 text-xs sm:text-sm text-muted hover:text-primary">Limpar</button>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {permissions?.canCreateSale && (
                            <button onClick={() => setIsModalOpen(true)} className="flex-1 sm:flex-none px-3 py-2 bg-success text-on-primary rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wide shadow-sm flex items-center justify-center">+ NOVA VENDA</button>
                        )}
                        <button onClick={() => setIsSimulatorOpen(true)} className="flex-1 sm:flex-none px-4 py-2 bg-gray-800 text-white rounded-xl hover:bg-gray-700 font-bold text-xs sm:text-sm uppercase tracking-wide shadow-sm flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95">
                            <CreditCardIcon className="h-4 w-4" />
                            Simulador de cartão
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 sm:flex-none">
                        <select
                            value={sellerFilter}
                            onChange={e => setSellerFilter(e.target.value)}
                            className="flex-1 sm:flex-none px-3 py-1.5 border rounded-xl bg-surface border-border h-9 sm:h-10 text-xs sm:text-sm min-w-[120px]"
                        >
                            <option value="todos">Vendedores</option>
                            {sellerUsers.map(user => (
                                <option key={user.id} value={user.id}>{user.name}</option>
                            ))}
                        </select>
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as any)}
                            className="flex-1 sm:flex-none px-3 py-1.5 border rounded-xl bg-surface border-border h-9 sm:h-10 text-xs sm:text-sm min-w-[120px]"
                        >
                            <option value="todos">Status</option>
                            <option value="Finalizada">Finalizada</option>
                            <option value="Pendente">Pendente</option>
                            <option value="Cancelada">Cancelada</option>
                            <option value="Editada">Editada</option>
                            <option value="Promissoria">Promissória</option>
                            <option value="PDV">PDV</option>
                        </select>
                    </div>
                    <div className="relative w-full sm:w-96">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-muted" />
                        </span>
                        <input
                            type="text"
                            placeholder="Buscar cliente ou ID"
                            value={customerSearch}
                            onChange={e => setCustomerSearch(e.target.value)}
                            className="w-full p-2 pl-9 border rounded-xl bg-surface border-border h-9 sm:h-10 text-xs sm:text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-shadow"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-surface rounded-3xl border border-border shadow-sm">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <SuspenseFallback />
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <XCircleIcon className="h-12 w-12 text-red-500 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900">Erro ao carregar dados</h3>
                        <p className="text-gray-500 mb-6 max-w-md">{error}</p>
                        <button
                            onClick={() => fetchData()}
                            className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
                        >
                            Tentar Novamente
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-xs text-muted bg-gray-50/50 uppercase border-b border-white/20">
                                    <tr>
                                        <th className="px-6 py-4">ID</th>
                                        <th className="px-6 py-4">Data</th>
                                        <th className="px-6 py-4 hidden sm:table-cell">Vendedor</th>
                                        <th className="px-6 py-4">Cliente</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 hidden md:table-cell">Origem</th>
                                        <th className="px-6 py-4">Total</th>
                                        <th className="px-6 py-4 hidden lg:table-cell">Taxas</th>
                                        <th className="px-6 py-4">Lucro</th>
                                        <th className="px-6 py-4 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentSales.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="px-6 py-12 text-center text-muted italic">
                                                Nenhuma venda encontrada para os filtros selecionados.
                                            </td>
                                        </tr>
                                    ) : currentSales.map(sale => {
                                        const cost = (sale.items || []).reduce((acc, item) => acc + ((productMap[item.productId]?.costPrice || 0) + (productMap[item.productId]?.additionalCostPrice || 0)) * item.quantity, 0);
                                        const revenue = sale.total;
                                        const profit = revenue - cost;
                                        return (
                                            <tr key={sale.id} className="border-b border-white/10 hover:bg-white/30 text-xs sm:text-sm transition-colors duration-150">
                                                <td className="px-6 py-4 font-bold text-primary">{sale.id}</td>
                                                <td className="px-6 py-4 text-muted">
                                                    <div className="font-medium">{new Date(sale.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</div>
                                                    <div className="text-[10px] opacity-70">{new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                                                </td>
                                                <td className="px-6 py-4 text-primary hidden sm:table-cell">{userMap[sale.salespersonId]?.name?.split(' ')[0] || 'N/A'}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-primary font-black sm:font-bold truncate max-w-[150px] sm:max-w-none text-[13px] sm:text-sm">{customerMap[sale.customerId]?.name || 'N/A'}</span>
                                                        {customerMap[sale.customerId]?.phone && (
                                                            <a
                                                                href={`https://wa.me/55${customerMap[sale.customerId].phone.replace(/\D/g, '')}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[#25D366] hover:opacity-80 transition-opacity shrink-0"
                                                                title="Abrir WhatsApp"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <WhatsAppIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-1 flex-wrap">
                                                        {getStatusBadge(sale.status)}
                                                        {/* Only show Promissória tag if sale is NOT cancelled */}
                                                        {sale.status !== 'Cancelada' && sale.payments.some(p => p.type === 'pending') && (
                                                            <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black rounded-xl bg-red-50 text-red-700 border border-red-200 shadow-sm">Promissória</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-primary font-bold hidden md:table-cell">
                                                    {(() => {
                                                        if (sale.origin === 'Balcão') return 'Vendas';
                                                        if (sale.origin === 'PDV' && !sale.cashSessionDisplayId && !sale.cashSessionId) return 'Vendas';
                                                        return sale.origin;
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-primary">{formatCurrency(sale.total)}</td>
                                                <td className="px-6 py-4 text-muted hidden lg:table-cell">{formatCurrency(sale.payments.reduce((acc, p) => acc + (p.fees || 0), 0))}</td>
                                                <td className={`px-6 py-4 font-bold ${profit >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(profit)}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center">
                                                        <SaleActionsDropdown
                                                            permissions={permissions}
                                                            onView={() => { setSaleToReprint(null); setSaleToView(sale); }}
                                                            onEdit={() => {
                                                                // Allow editing if it's PDV but has no session ID (legacy/bugged sales or manual entry marked as PDV)
                                                                if (sale.origin === 'PDV' && sale.cashSessionId) {
                                                                    showToast(`Vendas feitas pelo PDV (Caixa #${sale.cashSessionDisplayId || '?'}) devem ser editadas no próprio PDV.`, 'info');
                                                                    return;
                                                                }
                                                                setSaleToEdit(sale); setIsModalOpen(true);
                                                            }}
                                                            onReprint={() => { setSaleToView(null); setSaleToReprint(sale); setIsPrintChoiceOpen(true); }}
                                                            onCancel={() => setSaleToCancel(sale)}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 flex justify-between items-center text-sm">
                            <p className="text-muted">Total de Registros: {filteredSales.length}</p>
                            {pageCount > 1 && (
                                <div className="flex items-center gap-2 text-secondary">
                                    <button
                                        onClick={() => paginate(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="p-1 rounded-xl hover:bg-gray-200 disabled:opacity-50"
                                    >
                                        <ChevronLeftIcon className="h-5 w-5" />
                                    </button>
                                    <span>Página {currentPage} de {pageCount}</span>
                                    <button
                                        onClick={() => paginate(currentPage + 1)}
                                        disabled={currentPage === pageCount}
                                        className="p-1 rounded-xl hover:bg-gray-200 disabled:opacity-50"
                                    >
                                        <ChevronRightIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {statusFilter === 'Promissoria' && (
                <div className="bg-red-50 border border-red-200 rounded-3xl p-4 flex justify-between items-center text-red-800 shadow-sm">
                    <span className="font-bold text-red-800">Total Pago em Promissória (nesta lista):</span>
                    <span className="text-xl font-black text-red-700">
                        {formatCurrency(filteredSales.reduce((acc, sale) => acc + sale.payments.filter(p => p.type === 'pending').reduce((sum, p) => sum + p.value, 0), 0))}
                    </span>
                </div>
            )}


            <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><SpinnerIcon /></div>}>
                <NewSaleModal
                    isOpen={isModalOpen}
                    onClose={() => { setIsModalOpen(false); setSaleToEdit(null); }}
                    onSaleSaved={handleSaleSaved}
                    customers={customers}
                    users={users}
                    permissionProfiles={permissionProfiles}
                    products={products}
                    suppliers={suppliers}
                    onAddNewCustomer={handleAddNewCustomer}
                    onAddProduct={handleAddNewProduct}
                    brands={brands}
                    categories={categories}
                    productModels={productModels}
                    grades={grades}
                    gradeValues={gradeValues}
                    receiptTerms={receiptTerms}
                    paymentMethods={paymentMethods}
                    saleToEdit={saleToEdit}
                />
            </Suspense>

            {isSimulatorOpen && (
                <CardPaymentModal
                    isOpen={isSimulatorOpen}
                    onClose={() => setIsSimulatorOpen(false)}
                    onConfirm={() => setIsSimulatorOpen(false)}
                    amountDue={0}
                    isSimulator={true}
                />
            )}

            {saleToView && <SaleDetailModal sale={saleToView} productMap={productMap} customers={customers} users={users} onClose={() => setSaleToView(null)} />}

            {
                isPrintChoiceOpen && saleToReprint && (
                    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70]">
                        <div className="bg-surface p-6 rounded-3xl shadow-xl w-full max-w-sm">
                            <h3 className="text-lg font-bold mb-4 text-primary">Escolha o Formato de Impressão</h3>
                            <p className="text-sm text-muted mb-6">Selecione o layout para o recibo da venda #{saleToReprint.id}.</p>
                            <div className="flex flex-col gap-4">
                                <button onClick={() => { setReceiptModalFormat('A4'); setIsPrintChoiceOpen(false); }} className="w-full text-left flex items-center gap-4 p-4 border rounded-xl hover:bg-surface-secondary hover:border-accent">
                                    <DocumentTextIcon className="h-8 w-8 text-accent" />
                                    <div>
                                        <p className="font-semibold">Formato A4</p>
                                        <p className="text-xs text-muted">Layout padrão para impressoras comuns.</p>
                                    </div>
                                </button>
                                <button onClick={() => { setReceiptModalFormat('thermal'); setIsPrintChoiceOpen(false); }} className="w-full text-left flex items-center gap-4 p-4 border rounded-xl hover:bg-surface-secondary hover:border-accent">
                                    <TicketIcon className="h-8 w-8 text-accent" />
                                    <div>
                                        <p className="font-semibold">Cupom 80mm</p>
                                        <p className="text-xs text-muted">Layout para impressoras térmicas.</p>
                                    </div>
                                </button>
                            </div>
                            <button onClick={() => { setIsPrintChoiceOpen(false); setSaleToReprint(null); }} className="mt-6 w-full px-4 py-2 bg-gray-200 text-secondary rounded-xl hover:bg-gray-300 transition-colors">Cancelar</button>
                        </div>
                    </div>
                )
            }

            {
                saleToReprint && receiptModalFormat && (
                    <SaleReceiptModal
                        sale={saleToReprint}
                        format={receiptModalFormat}
                        productMap={productMap}
                        customers={customers}
                        users={users}
                        onClose={() => {
                            setSaleToReprint(null);
                            setReceiptModalFormat(null);
                        }}
                    />
                )
            }

            {
                saleToCancel && (
                    <DeleteWithReasonModal
                        isOpen={!!saleToCancel}
                        onClose={() => setSaleToCancel(null)}
                        onConfirm={handleCancelSaleConfirm}
                        title="Cancelar Venda"
                        message={`Você está prestes a cancelar a venda #${saleToCancel.id}. Os produtos serão retornados ao estoque. Por favor, informe o motivo.`}
                    />
                )
            }
        </div >
    );
};

export default Vendas;
