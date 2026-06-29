
import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Sale, Product, Customer, User, SaleItem, PermissionProfile, Brand, Category, ProductModel, Grade, GradeValue, Supplier, ReceiptTermParameter, PermissionSet } from '../types.ts';
import { getSales, getProducts, getCustomers, getUsers, addCustomer, addProduct, formatCurrency, cancelSale, getPermissionProfiles, getBrands, getCategories, getProductModels, getGrades, getGradeValues, getSuppliers, getReceiptTerms, getPaymentMethods } from '../services/mockApi.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import { SuspenseFallback } from '../components/GlobalLoading.tsx';
import { SpinnerIcon, EllipsisVerticalIcon, CalendarDaysIcon, ChevronDownIcon, CloseIcon, PlusIcon, TrashIcon, SearchIcon, MinusIcon, EyeIcon, EditIcon, PrinterIcon, XCircleIcon, DocumentTextIcon, TicketIcon, ChevronLeftIcon, ChevronRightIcon, WhatsAppIcon, CreditCardIcon, SmartphoneIcon } from '../components/icons.tsx';
import CardPaymentModal from '../components/CardPaymentModal.tsx';
import SaleDetailModal from '../components/SaleDetailModal.tsx';
import DeleteWithReasonModal from '../components/DeleteWithReasonModal.tsx';
import SaleReceiptModal from '../components/SaleReceiptModal.tsx';
import CustomDatePicker from '../components/CustomDatePicker.tsx';
import { toDateValue } from '../utils/dateUtils.ts';
import { getWhatsAppLink } from '../utils/whatsappUtils.ts';
import { getItemCostSnapshot } from '../utils/financialUtils.ts';

import { lazyWithRetry } from '../utils/lazyWithRetry.ts';

// Lazy load heavy modal component (with auto-retry on chunk fail)
const NewSaleModal = lazyWithRetry(() => import('../components/NewSaleModal.tsx'), 'NewSaleModal');


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

const normalizePaymentMethod = (str: string): string => {
    if (!str) return '';
    let s = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+de\s+/g, ' ').trim();
    if (s === 'credito') return 'cartao credito';
    if (s === 'debito') return 'cartao debito';
    return s;
};


// --- Sub-components ---

const KpiCard: React.FC<{ title: string; value: string; bgColor: string; textColor?: string; projection?: string }> = React.memo(({ title, value, bgColor, textColor = 'text-primary', projection }) => (
    <div className={`p-2.5 sm:p-4 rounded-3xl ${bgColor} ${textColor} flex flex-col justify-center min-h-[64px] sm:min-h-[auto]`}>
        <h3 className="text-[10px] sm:text-sm font-bold uppercase tracking-wider opacity-70 leading-tight">{title}</h3>
        <p className="text-base sm:text-2xl font-black mt-0.5 sm:mt-1 truncate">{value}</p>
        {projection && (
            <p className="text-xs font-bold opacity-80 mt-0.5 truncate" title="Projeção baseada na média diária do mês atual">
                ↗ Proj.: {projection}
            </p>
        )}
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
    const [paymentFilter, setPaymentFilter] = useState('todos');
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
            // Stage 1a: Metadados críticos (4 requests máx simultâneas)
            // Roteadores domésticos tipicamente suportam 6-10 conexões TCP/host.
            // Dividir em grupos de 4 evita esgotar a tabela NAT e causar ERR_INTERNET_DISCONNECTED.
            const [profilesData, brandsData, categoriesData, modelsData] = await Promise.all([
                fetchItem('Permissions', getPermissionProfiles, []),
                fetchItem('Brands', getBrands, []),
                fetchItem('Categories', getCategories, []),
                fetchItem('Models', getProductModels, [])
            ]);

            setPermissionProfiles(profilesData);
            setBrands(brandsData);
            setCategories(categoriesData);
            setProductModels(modelsData);

            // Stage 1b: Restante dos metadados (4 requests)
            const [gradesData, gradeValuesData, receiptTermsData, paymentMethodsData] = await Promise.all([
                fetchItem('Grades', getGrades, []),
                fetchItem('GradeValues', getGradeValues, []),
                fetchItem('ReceiptTerms', getReceiptTerms, []),
                fetchItem('PaymentMethods', getPaymentMethods, [])
            ]);

            setGrades(gradesData || []);
            setGradeValues(gradeValuesData);
            setReceiptTerms(receiptTermsData);
            setPaymentMethods((paymentMethodsData || []).filter((m: any) => m.name && !m.name.toLowerCase().includes('pagseguro')));

            // Stage 2: Vendas (crítico — exibido imediatamente)
            let salesData: Sale[] = [];
            try {
                const canSeeAllSales = permissions?.canViewAllSales || permissions?.canManageUsers || permissions?.canManagePermissions || permissions?.canViewAudit;
                const userIdToFilter = canSeeAllSales ? undefined : user?.id;

                let fetchStartDate = startDate;
                const now = new Date();
                const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

                if (endDate >= currentMonthStart && startDate > currentMonthStart) {
                    fetchStartDate = currentMonthStart;
                }

                salesData = await getSales(userIdToFilter, undefined, fetchStartDate, endDate);
            } catch (err) {
                console.error('Vendas: Failed to fetch sales:', err);
                throw new Error('Falha ao carregar lista de vendas.');
            }

            const sortedSales = [...salesData].sort((a, b) => {
                const dateA = a.date ? new Date(a.date).getTime() : 0;
                const dateB = b.date ? new Date(b.date).getTime() : 0;
                return dateB - dateA;
            });
            setSales(sortedSales);

            // Loading principal liberado — usuário já vê as vendas
            if (!silent) setLoading(false);

            // Stage 3: Dados de suporte em background (2 requests por vez para não sobrecarregar)
            const productSelect = 'id,sku,brand,category,model,price,wholesalePrice,costPrice,additionalCostPrice,stock,minimumStock,serialNumber,imei1,imei2,batteryHealth,condition,warranty,createdAt,updatedAt,createdBy,color,storageLocation,storage,purchaseOrderId,purchaseItemId,supplierId,origin,commission_enabled,commission_type,commission_value,discount_limit_type,discount_limit_value,barcodes';

            // Grupo A: os dois fetchs de produtos (mais pesados) primeiro
            const [allProductsData, productsData] = await Promise.all([
                fetchItem('ProductsAll', () => getProducts({ select: productSelect, onlyInStock: false }), []),
                fetchItem('Products', () => getProducts({ select: productSelect, onlyInStock: true }), [])
            ]);
            const pMap: Record<string, Product> = {};
            allProductsData.forEach((p: Product) => { pMap[p.id] = p; });
            setProductMap(pMap);
            setProducts(productsData);

            // Grupo B: clientes e usuários
            const [customersData, usersData] = await Promise.all([
                fetchItem('Customers', () => getCustomers(false), []),
                fetchItem('Users', getUsers, [])
            ]);
            const cMap: Record<string, Customer> = {};
            customersData.forEach((c: Customer) => { cMap[c.id] = c; });
            setCustomers(customersData);
            setCustomerMap(cMap);
            setUsers(usersData);
            const uMap: Record<string, User> = {};
            usersData.forEach((u: User) => { uMap[u.id] = u; });
            setUserMap(uMap);

            // Grupo C: fornecedores (menor prioridade)
            fetchItem('Suppliers', getSuppliers, []).then(setSuppliers);

        } catch (error: any) {
            const isAbort = error?.name === 'AbortError' || error?.message?.includes('aborted');
            if (isAbort) {
                console.warn('Vendas: Fetch aborted.');
            } else {
                console.error('Vendas: Error fetching data:', error);

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
        setPaymentFilter('todos');
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
            if (statusFilter === 'Crediário') {
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

            // Se o filtro for Crediário, queremos ver todas, inclusive as canceladas que geraram crediário? 
            // Geralmente cancelada anula a dívida, então talvez devêssemos ignorar canceladas se o filtro for Crediário?
            // O padrão atual mostra canceladas se statusFilter == 'Cancelada'.
            // Vou assumir que se filtrar por Crediário, queremos ver as ativas.
            if (statusFilter === 'Crediário') {
                statusMatch = statusMatch && sale.status !== 'Cancelada';
            }

            const paymentMatch = paymentFilter === 'todos' || (sale.payments || []).some(
                p => p.method && normalizePaymentMethod(p.method) === normalizePaymentMethod(paymentFilter)
            );

            if (sale.status === 'Rascunho') return false;

            return dateMatch && sellerMatch && statusMatch && customerMatch && paymentMatch;
        });
    }, [sales, startDate, endDate, sellerFilter, statusFilter, paymentFilter, debouncedCustomerSearch, customerMap]);

    // Reset page number when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [startDate, endDate, sellerFilter, statusFilter, paymentFilter, customerSearch]);

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
        const usersWithSalesInView = new Set(sales.map(s => s.salespersonId));

        const relevantUsers = users.filter(u => 
            (sellerProfileIds.has(u.permissionProfileId) && u.active !== false) || 
            usersWithSalesInView.has(u.id)
        );

        return relevantUsers.sort((a, b) => {
            const aActive = a.active !== false;
            const bActive = b.active !== false;
            if (aActive && !bActive) return -1;
            if (!aActive && bActive) return 1;
            return a.name.localeCompare(b.name);
        });
    }, [users, permissionProfiles, sales]);

    const kpi = useMemo(() => {
        const activeSales = filteredSales.filter(s => s.status !== 'Cancelada');
        const faturamento = activeSales.reduce((sum, sale) => sum + sale.total, 0);
        const ticketMedio = activeSales.length > 0 ? faturamento / activeSales.length : 0;

        const lucro = filteredSales.reduce((sum, sale) => {
            if (sale.status === 'Cancelada') return sum;
            const cost = (sale.items || []).reduce((itemSum, item) => {
                // Snapshot do custo na época da venda (correto para histórico financeiro)
                const product = productMap[item.productId];
                return itemSum + getItemCostSnapshot(item, product) * item.quantity;
            }, 0);
            const revenue = sale.total;
            return sum + (revenue - cost);
        }, 0);
        const taxas = filteredSales.reduce((sum, sale) => {
            if (sale.status === 'Cancelada') return sum;
            return sum + (sale.payments || []).reduce((acc, p) => acc + (p.fees || 0), 0);
        }, 0);

        // Projeção baseada na média diária do mês atual
        const now = new Date();
        const monthStart        = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const monthEnd          = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const daysPassedInMonth = now.getDate();
        const daysInMonth       = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        const monthlyProfit = sales
            .filter(s => s.status !== 'Cancelada' && new Date(s.date) >= monthStart && new Date(s.date) <= monthEnd)
            .reduce((sum, sale) => {
                const cost = (sale.items || []).reduce((itemSum, item) => {
                    const product = productMap[item.productId];
                    return itemSum + getItemCostSnapshot(item, product) * item.quantity;
                }, 0);
                return sum + sale.total - cost;
            }, 0);

        const dailyAvg = daysPassedInMonth > 0 ? monthlyProfit / daysPassedInMonth : 0;

        const periodDaysMap: Record<string, number> = {
            hoje: 1, '7dias': 7, '15dias': 15, Mes: daysInMonth, personalizado: (() => {
                const s = new Date(startDate + 'T00:00:00');
                const e = new Date(endDate + 'T00:00:00');
                return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
            })()
        };
        const lucroProjection = dailyAvg * (periodDaysMap[activePeriod] ?? 1);

        return { faturamento, lucro, taxas, ticketMedio, lucroProjection };
    }, [filteredSales, productMap, sales, activePeriod, startDate, endDate]);

    // KPIs por forma de pagamento (apenas vendas ativas no período filtrado)
    const paymentKpis = useMemo(() => {
        const totals: Record<string, number> = {};

        filteredSales
            .filter(s => s.status !== 'Cancelada')
            .forEach(sale => {
                (sale.payments || []).forEach(p => {
                    if (!p.method) return;
                    let canonicalMethod = p.method;
                    const normalizedPMethod = normalizePaymentMethod(p.method);
                    const matchedMethod = paymentMethods.find((pm: any) => pm.name && normalizePaymentMethod(pm.name) === normalizedPMethod);
                    if (matchedMethod) {
                        canonicalMethod = matchedMethod.name;
                    }
                    totals[canonicalMethod] = (totals[canonicalMethod] || 0) + (p.value || 0);
                });
            });
        // Ordenar do maior para o menor valor
        return Object.entries(totals)
            .sort((a, b) => b[1] - a[1])
            .map(([method, total]) => ({ method, total }));
    }, [filteredSales, paymentMethods]);

    const handleAddNewCustomer = useCallback(async (customerData: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer | null> => {
        try {
            const newCustomer = await addCustomer(customerData);
            setCustomers(prev => [...prev, newCustomer]);
            setCustomerMap(prev => ({ ...prev, [newCustomer.id]: newCustomer }));
            // We removed the success toast from here because NewSaleView shows it when nc is returned.
            // Actually, we can keep it here, but NewSaleView also shows it. Better to remove it from NewSaleView.
            return newCustomer;
        } catch (error: any) {
            showToast(error.message || 'Erro ao salvar novo cliente.', 'error');
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
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-3 sm:mb-4">
                            <KpiCard title="Faturamento" value={formatCurrency(kpi.faturamento)} bgColor="bg-blue-100" />
                            <KpiCard title="Ticket Médio" value={formatCurrency(kpi.ticketMedio)} bgColor="bg-purple-100" />
                            <KpiCard title="Taxas" value={formatCurrency(kpi.taxas)} bgColor="bg-red-100" />
                            {permissions?.canViewSaleProfit && (
                                <KpiCard
                                    title="Lucro"
                                    value={formatCurrency(kpi.lucro)}
                                    bgColor={kpi.lucro >= 0 ? "bg-green-100" : "bg-red-100"}
                                    textColor={kpi.lucro >= 0 ? "text-green-700" : "text-red-700"}
                                    projection={formatCurrency(kpi.lucroProjection)}
                                />
                            )}
                        </div>
                        {paymentKpis.length > 0 && (
                            <div className="mb-4 sm:mb-5">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 ml-0.5">Por forma de pagamento</p>
                                <div className="flex flex-wrap gap-2">
                                    {paymentKpis.map(({ method, total }) => (
                                        <button
                                            key={method}
                                            onClick={() => setPaymentFilter(prev => prev === method ? 'todos' : method)}
                                            title={`Clique para filtrar por ${method}`}
                                            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border text-left transition-all duration-200 active:scale-95 ${
                                                paymentFilter === method
                                                    ? 'bg-accent text-white border-accent shadow-lg shadow-accent/25 ring-2 ring-accent/20'
                                                    : 'bg-surface border-border hover:border-accent/40 hover:bg-accent/5'
                                            }`}
                                        >
                                            <span className={`text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${paymentFilter === method ? 'text-white/80' : 'text-muted'}`}>{method}</span>
                                            <span className={`font-black text-sm whitespace-nowrap ${paymentFilter === method ? 'text-white' : 'text-accent'}`}>{formatCurrency(total)}</span>
                                        </button>
                                    ))}
                                    {paymentFilter !== 'todos' && (
                                        <button
                                            onClick={() => setPaymentFilter('todos')}
                                            className="flex items-center gap-1 px-3 py-2 rounded-2xl border border-dashed border-red-200 text-xs font-bold text-red-400 hover:text-red-600 hover:border-red-400 transition-all active:scale-95"
                                        >
                                            × Limpar
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
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
                                <option key={user.id} value={user.id}>
                                    {user.name} {user.active === false ? '(Inativo)' : ''}
                                </option>
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
                            <option value="Crediário">Crediário</option>
                            <option value="PDV">PDV</option>
                        </select>
                        <select
                            value={paymentFilter}
                            onChange={e => setPaymentFilter(e.target.value)}
                            className="flex-1 sm:flex-none px-3 py-1.5 border rounded-xl bg-surface border-border h-9 sm:h-10 text-xs sm:text-sm min-w-[140px] transition-colors"
                        >
                            <option value="todos">Forma de Pgto</option>
                            {paymentMethods.map((pm: any) => (
                                <option key={pm.id || pm.name} value={pm.name}>{pm.name}</option>
                            ))}
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

            <div className="card-premium">
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
                                <thead className="text-left text-xs font-bold text-gray-900 bg-gray-50/50 uppercase border-b border-white/20">
                                    <tr>
                                        <th className="px-6 py-4">ID</th>
                                        <th className="px-6 py-4">Data</th>
                                        <th className="px-6 py-4 hidden sm:table-cell">Vendedor</th>
                                        <th className="px-6 py-4">Cliente</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 hidden md:table-cell">Origem</th>
                                        <th className="px-6 py-4">Total</th>
                                        <th className="px-6 py-4 hidden lg:table-cell">Taxas</th>
                                        {permissions?.canViewSaleProfit && <th className="px-6 py-4">Lucro</th>}
                                        <th className="px-6 py-4 text-center">Ações</th>
                                    </tr>
                                </thead>
                                {currentSales.length === 0 ? (
                                    <tbody>
                                        <tr>
                                            <td colSpan={permissions?.canViewSaleProfit ? 10 : 9} className="px-6 py-12 text-center text-muted italic">
                                                Nenhuma venda encontrada para os filtros selecionados.
                                            </td>
                                        </tr>
                                    </tbody>
                                ) : currentSales.map(sale => {
                                    const cost = (sale.items || []).reduce((acc, item) => {
                                        const product = productMap[item.productId];
                                        // Snapshot do custo na época da venda
                                        return acc + getItemCostSnapshot(item, product) * item.quantity;
                                    }, 0);
                                    const revenue = sale.total;
                                    const profit = revenue - cost;
                                    const colSpanTotal = permissions?.canViewSaleProfit ? 10 : 9;

                                    const displayItems = (sale.items || []).slice(0, 2);
                                    const remainingItemsCount = (sale.items || []).length - 2;

                                    return (
                                        <tbody key={sale.id} className="border-t border-b border-gray-200 hover:bg-gray-50/50 transition-colors duration-150 group">
                                            <tr className="text-xs sm:text-sm">
                                                <td className="px-6 py-5 font-bold text-primary border-0">{sale.id}</td>
                                                <td className="px-6 py-5 text-muted border-0">
                                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                        <span className="font-bold text-gray-700">{new Date(sale.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                                        <span className="font-semibold text-gray-500 text-[11px] sm:text-xs bg-gray-100 px-1.5 py-0.5 rounded-md">{new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-primary hidden sm:table-cell border-0">
                                                    <div className="flex items-center gap-1.5 font-bold">
                                                        <span>{userMap[sale.salespersonId]?.name?.split(' ')[0] || (sale as any).salespersonName?.split(' ')[0] || 'N/A'}</span>
                                                        {userMap[sale.salespersonId]?.active === false && (
                                                            <span className="px-1.5 py-0.5 text-[9px] font-black rounded-full bg-gray-100 text-gray-500 border border-gray-200 uppercase mt-0.5" title="Vendedor Inativo">Inativo</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 border-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-primary font-black sm:font-bold truncate max-w-[150px] sm:max-w-none text-[13px] sm:text-sm">{customerMap[sale.customerId]?.name || sale.customerName || 'N/A'}</span>
                                                        {customerMap[sale.customerId]?.phone && (
                                                            <a
                                                                href={getWhatsAppLink(customerMap[sale.customerId]?.phone)}
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
                                                <td className="px-6 py-5 border-0">
                                                    <div className="flex gap-1 flex-wrap">
                                                        {getStatusBadge(sale.status)}
                                                        {/* Only show Crediário tag if sale is NOT cancelled */}
                                                        {sale.status !== 'Cancelada' && sale.payments.some(p => p.type === 'pending') && (
                                                            <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black rounded-xl bg-red-50 text-red-700 border border-red-200 shadow-sm">Crediário</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-primary font-bold hidden md:table-cell border-0">
                                                    {(() => {
                                                        if (sale.origin === 'Balcão') return 'Vendas';
                                                        if (sale.origin === 'PDV' && !sale.cashSessionDisplayId && !sale.cashSessionId) return 'Vendas';
                                                        return sale.origin;
                                                    })()}
                                                </td>
                                                <td className="px-6 py-5 font-bold text-primary border-0">{formatCurrency(sale.total)}</td>
                                                <td className="px-6 py-5 text-muted hidden lg:table-cell border-0">{formatCurrency(sale.payments.reduce((acc, p) => acc + (p.fees || 0), 0))}</td>
                                                {permissions?.canViewSaleProfit && (
                                                    <td className={`px-6 py-5 font-bold border-0 ${profit >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(profit)}</td>
                                                )}
                                                <td className="px-6 py-5 border-0">
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
                                            <tr>
                                                <td colSpan={colSpanTotal} className="px-6 pb-5 pt-0 border-0">
                                                    <div className="flex flex-col gap-1.5 -mt-3 scale-95 origin-left">
                                                        {displayItems.map((item, idx) => {
                                                            const product = productMap[item.productId];
                                                            const identifiers = [];
                                                            const imei = product?.imei1 || (item as any).imei1;
                                                            const sn = product?.serialNumber || (item as any).serialNumber;
                                                            if (imei) identifiers.push(`IMEI: ${imei}`);
                                                            if (sn) identifiers.push(`S/N: ${sn}`);
                                                            if (product?.barcode) identifiers.push(`EAN: ${product.barcode}`);
                                                            if (product?.sku) identifiers.push(`SKU: ${product.sku}`);

                                                            const discountStr = item.discountValue > 0 ? ` (Desc: ${item.discountType === '%' ? `${item.discountValue}%` : formatCurrency(item.discountValue)})` : '';
                                                            const priceStr = `${item.quantity}x ${formatCurrency(item.salePrice || item.unitPrice)}${discountStr}`;
                                                            const itemName = (item as any).productName || (item as any).model || item.name || product?.model || 'Produto Desconhecido';

                                                            return (
                                                                <div key={idx} className="flex flex-wrap items-center gap-1.5 text-xs sm:text-[13px] text-gray-500 group-hover:text-gray-600 transition-colors w-full font-bold">
                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        <SmartphoneIcon className="w-4 h-4 opacity-40 group-hover:opacity-60" />
                                                                        <span className="text-gray-500 group-hover:text-gray-700" title={itemName}>{itemName}</span>
                                                                    </div>
                                                                    {identifiers.length > 0 && (
                                                                        <>
                                                                            <span className="text-gray-300 hidden sm:inline">•</span>
                                                                            <span className="font-mono tracking-tight text-[10px] sm:text-[11px] opacity-100 break-all">{identifiers.join(' | ')}</span>
                                                                        </>
                                                                    )}
                                                                    <span className="text-gray-300 hidden sm:inline">•</span>
                                                                    <span className="whitespace-nowrap">{priceStr}</span>
                                                                </div>
                                                            );
                                                        })}
                                                        <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs mt-0.5 ml-0">
                                                            {remainingItemsCount > 0 && (
                                                                <span className="text-gray-400 font-bold" title="Abra a venda para ver todos os produtos">
                                                                    + {remainingItemsCount} outro{remainingItemsCount > 1 ? 's' : ''} produto{remainingItemsCount > 1 ? 's' : ''}
                                                                </span>
                                                            )}
                                                            {(sale.payments && sale.payments.length > 0) && (
                                                                <div className="flex flex-wrap items-center gap-1.5 text-gray-400 font-bold w-full mt-1">
                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        <CreditCardIcon className="w-4 h-4 opacity-40 group-hover:opacity-60" />
                                                                        <span className="text-[11px] sm:text-xs">Pagamento:</span>
                                                                    </div>
                                                                    {sale.payments.map((p, idx) => {
                                                                        const isInstallment = p.installments && p.installments > 1;
                                                                        const total = p.value + (p.fees || 0);

                                                                        // Compiling additional details
                                                                        const extras = [];
                                                                        if (p.pixVariation) extras.push(p.pixVariation);
                                                                        if (p.card && p.card !== p.method) extras.push(p.card);
                                                                        if (p.tradeInDetails?.model) extras.push(p.tradeInDetails.model);
                                                                        if (p.internalNote) extras.push(p.internalNote);
                                                                        const extraStr = extras.length > 0 ? ` [${extras.join(' | ')}]` : '';

                                                                        const methodBaseStr = isInstallment ? `${p.method} (${p.installments}x)` : p.method;
                                                                        const methodStr = `${methodBaseStr}${extraStr}`;

                                                                        const feeStr = (p.fees && p.fees > 0) ? `+ ${formatCurrency(p.fees)} juros (Total: ${formatCurrency(total)})` : '';
                                                                        return (
                                                                            <div key={idx} className="flex items-center gap-1 shrink-0">
                                                                                <span className="text-gray-500">{methodStr}:</span>
                                                                                <span className="text-gray-600 font-black">{formatCurrency(p.value)}</span>
                                                                                {feeStr && <span className="text-gray-400 ml-0.5">{feeStr}</span>}
                                                                                {idx < sale.payments.length - 1 && <span className="text-gray-300 ml-1.5">•</span>}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                            {/* Spacer semi-visible border for separation */}
                                            <tr className="bg-gray-50/20">
                                                <td colSpan={colSpanTotal} className="p-0 border-0 h-[1px]"></td>
                                            </tr>
                                        </tbody>
                                    );
                                })}
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

            {statusFilter === 'Crediário' && (
                <div className="bg-red-50 border border-red-200 rounded-3xl p-4 flex justify-between items-center text-red-800 shadow-sm">
                    <span className="font-bold text-red-800">Total Pago no Crediário (nesta lista):</span>
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

            {saleToView && <SaleDetailModal sale={saleToView} productMap={productMap} customers={customers} users={users} suppliers={suppliers} onClose={() => setSaleToView(null)} />}

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
