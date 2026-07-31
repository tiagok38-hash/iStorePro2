import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList, AreaChart, Area } from 'recharts';
import { Sale, Product, Customer, User, ProductModel, Category } from '../types.ts';
import { getSales, getProducts, getProductsInStock, getCustomers, getUsers, formatCurrency, getProductModels, getCategories } from '../services/mockApi.ts';
import { SpinnerIcon, CalendarDaysIcon, TrophyIcon, SearchIcon, ClockIcon, DocumentTextIcon, CurrencyDollarIcon, TrendingUpIcon, ShoppingCartIcon, BanknotesIcon, PackageIcon, WalletIcon, AppleIcon, Squares2x2Icon } from '../components/icons.tsx';
import CustomDatePicker from '../components/CustomDatePicker.tsx';
import PriceListModal from '../components/PriceListModal.tsx';
import { toDateValue } from '../utils/dateUtils.ts';
import SalesReports from '../components/SalesReports.tsx';
import AveragePriceReport from '../components/AveragePriceReport.tsx';
import { getItemCostSnapshot } from '../utils/financialUtils.ts';

const PremiumKpiCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: 'blue' | 'emerald' | 'purple' | 'orange' | 'indigo' | 'red';
    subtitle?: React.ReactNode;
    onClick?: () => void;
    trend?: { value: number; label?: string };
    progress?: { current: number; total: number; label: string };
}> = ({ title, value, icon, color, subtitle, onClick, trend, progress }) => {
    const colorConfigs = {
        blue: { bg: 'from-blue-600/10 to-blue-600/5', border: 'border-blue-100', text: 'text-blue-600', iconBg: 'bg-blue-600', shadow: 'shadow-blue-500/20', progressBg: 'bg-blue-600' },
        emerald: { bg: 'from-emerald-600/10 to-emerald-600/5', border: 'border-emerald-100', text: 'text-emerald-600', iconBg: 'bg-emerald-600', shadow: 'shadow-emerald-500/20', progressBg: 'bg-emerald-600' },
        purple: { bg: 'from-purple-600/10 to-purple-600/5', border: 'border-purple-100', text: 'text-purple-600', iconBg: 'bg-purple-600', shadow: 'shadow-purple-500/20', progressBg: 'bg-purple-600' },
        orange: { bg: 'from-orange-600/10 to-orange-600/5', border: 'border-orange-100', text: 'text-orange-600', iconBg: 'bg-orange-600', shadow: 'shadow-orange-500/20', progressBg: 'bg-orange-600' },
        indigo: { bg: 'from-indigo-600/10 to-indigo-600/5', border: 'border-indigo-100', text: 'text-indigo-600', iconBg: 'bg-indigo-600', shadow: 'shadow-indigo-500/20', progressBg: 'bg-indigo-600' },
        red: { bg: 'from-red-600/10 to-red-600/5', border: 'border-red-100', text: 'text-red-600', iconBg: 'bg-red-600', shadow: 'shadow-red-500/20', progressBg: 'bg-red-600' },
    };

    const config = colorConfigs[color];
    const trendPositive = trend && trend.value >= 0;
    const trendZero = trend && trend.value === 0;
    const progressPct = progress ? Math.min(100, (progress.current / progress.total) * 100) : 0;

    return (
        <div className={`relative overflow-hidden group rounded-[2rem] h-full ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
            <div className={`absolute inset-0 bg-gradient-to-br ${config.bg} group-hover:scale-110 transition-transform duration-500`}></div>
            <div className={`relative bg-white/40 backdrop-blur-md border ${config.border} p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all h-full flex flex-col`}>
                <div className="flex items-start justify-between mb-4">
                    <div className={`${config.iconBg} w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${config.shadow} flex-shrink-0`}>
                        <div className="text-white">
                            {React.cloneElement(icon as React.ReactElement, { size: 20 })}
                        </div>
                    </div>
                    {trend !== undefined && !trendZero && (
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-black px-2 py-1 rounded-xl ${
                            trendPositive
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : 'bg-red-50 text-red-500 border border-red-200'
                        }`}>
                            {trendPositive ? '▲' : '▼'} {Math.abs(trend.value).toFixed(1)}%
                        </span>
                    )}
                    {trend !== undefined && trendZero && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-black px-2 py-1 rounded-xl bg-gray-50 text-gray-400 border border-gray-200">
                            — 0%
                        </span>
                    )}
                </div>
                <h3 className={`text-xs font-bold ${config.text} uppercase tracking-wider`}>{title}</h3>
                <p className="text-2xl font-black text-gray-900 mt-1 tracking-tight flex-1">{value}</p>
                {progress && (
                    <div className="mt-3">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{progress.label}</span>
                            <span className="text-[9px] font-black text-gray-500">{progressPct.toFixed(0)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${config.progressBg} rounded-full transition-all duration-700`}
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    </div>
                )}
                {subtitle && <div className="mt-2">{subtitle}</div>}
            </div>
        </div>
    );
};

// Enhanced Custom Tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="glass-card p-4 border border-white/20 rounded-3xl shadow-xl min-w-[200px]">
                <p className="font-bold text-gray-800 mb-2 border-b pb-1">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-4 py-1">
                        <span className="text-sm font-medium flex items-center gap-2" style={{ color: entry.color }}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                            {entry.name}:
                        </span>
                        <span className="text-sm font-bold text-gray-700">
                            {entry.name === 'Vendas' || entry.name === 'Quantidade'
                                ? entry.value
                                : formatCurrency(entry.value)}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const COLORS = {
    primary: '#3b82f6',   // Blue-500
    success: '#10b981',   // Emerald-500
    purple: '#8b5cf6',    // Violet-500
    orange: '#f97316',    // Orange-500
    pink: '#ec4899',      // Pink-500
    cyan: '#06b6d4',      // Cyan-500
    slate: '#64748b'      // Slate-500
};

const PIE_COLORS = [COLORS.primary, COLORS.success, COLORS.orange, COLORS.purple, COLORS.pink, COLORS.cyan, COLORS.slate];

// ─── Quick Date Filter Pill Component ────────────────────────────────────────
type QuickPeriod = 'hoje' | 'ontem' | '7dias' | 'estemes' | 'mesanterior' | 'estano' | 'personalizado';

const QuickDateFilter: React.FC<{
    active: QuickPeriod;
    onSelect: (period: QuickPeriod, start: string, end: string) => void;
    showPickers: boolean;
    startDate: string;
    endDate: string;
    onStartChange: (v: string) => void;
    onEndChange: (v: string) => void;
    users: User[];
    sellerFilter: string;
    onSellerChange: (v: string) => void;
    onClear: () => void;
}> = ({ active, onSelect, showPickers, startDate, endDate, onStartChange, onEndChange, users, sellerFilter, onSellerChange, onClear }) => {
    const pills: { id: QuickPeriod; label: string }[] = [
        { id: 'hoje', label: 'Hoje' },
        { id: 'ontem', label: 'Ontem' },
        { id: '7dias', label: '7 Dias' },
        { id: 'estemes', label: 'Este Mês' },
        { id: 'mesanterior', label: 'Mês Anterior' },
        { id: 'estano', label: 'Este Ano' },
        { id: 'personalizado', label: 'Personalizado' },
    ];

    return (
        <div className="bg-white border border-gray-100 rounded-[2rem] p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mr-1">Período:</span>
                {pills.map(pill => (
                    <button
                        key={pill.id}
                        onClick={() => {
                            const today = new Date();
                            let s = today, e = today;
                            if (pill.id === 'hoje') { s = e = today; }
                            else if (pill.id === 'ontem') {
                                const y = new Date(today); y.setDate(today.getDate() - 1);
                                s = e = y;
                            } else if (pill.id === '7dias') {
                                const d7 = new Date(today); d7.setDate(today.getDate() - 6);
                                s = d7; e = today;
                            } else if (pill.id === 'estemes') {
                                s = new Date(today.getFullYear(), today.getMonth(), 1);
                                e = today;
                            } else if (pill.id === 'mesanterior') {
                                s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                                e = new Date(today.getFullYear(), today.getMonth(), 0);
                            } else if (pill.id === 'estano') {
                                s = new Date(today.getFullYear(), 0, 1);
                                e = today;
                            }
                            if (pill.id !== 'personalizado') {
                                onSelect(pill.id, toDateValue(s), toDateValue(e));
                            } else {
                                onSelect('personalizado', startDate, endDate);
                            }
                        }}
                        className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-200 ${
                            active === pill.id
                                ? 'bg-primary text-white shadow-md shadow-blue-500/30'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'
                        }`}
                    >
                        {pill.label}
                    </button>
                ))}
            </div>
            {showPickers && (
                <div className="flex flex-wrap items-end gap-4 pt-1 border-t border-gray-100">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">De</label>
                        <CustomDatePicker value={startDate} onChange={onStartChange} max={toDateValue()} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Até</label>
                        <CustomDatePicker value={endDate} onChange={onEndChange} max={toDateValue()} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Vendedor</label>
                        <select
                            value={sellerFilter}
                            onChange={(e) => onSellerChange(e.target.value)}
                            className="h-11 px-6 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500 outline-none focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                        >
                            <option value="todos">Todos os Vendedores</option>
                            {users.filter(u => u.active !== false).map(user => (
                                <option key={user.id} value={user.id}>{user.name}</option>
                            ))}
                        </select>
                    </div>
                    <button onClick={onClear} className="h-11 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors">Limpar</button>
                </div>
            )}
            {!showPickers && (
                <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-gray-100">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Vendedor</label>
                        <select
                            value={sellerFilter}
                            onChange={(e) => onSellerChange(e.target.value)}
                            className="h-11 px-6 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500 outline-none focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                        >
                            <option value="todos">Todos os Vendedores</option>
                            {users.filter(u => u.active !== false).map(user => (
                                <option key={user.id} value={user.id}>{user.name}</option>
                            ))}
                        </select>
                    </div>
                    <button onClick={onClear} className="h-11 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors self-end">Limpar</button>
                </div>
            )}
        </div>
    );
};

// ─── Donut Center Label ───────────────────────────────────────────────────────
const DonutCenterLabel: React.FC<{ cx?: number; cy?: number; total: number; topMethod: string }> = ({ cx = 0, cy = 0, total, topMethod }) => (
    <g>
        <text x={cx} y={cy - 10} textAnchor="middle" dominantBaseline="central" className="fill-gray-900" style={{ fontSize: 18, fontWeight: 900, fontFamily: 'inherit' }}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(total)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="central" className="fill-gray-400" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, fontFamily: 'inherit' }}>
            {topMethod.toUpperCase()}
        </text>
    </g>
);

const VendasReport: React.FC<{ sales: Sale[], products: Product[], customers: Customer[], users: User[], categories?: Category[] }> = ({ sales, products, customers, users, categories = [] }) => {
    const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>('estemes');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return toDateValue(new Date(d.getFullYear(), d.getMonth(), 1));
    });
    const [endDate, setEndDate] = useState(toDateValue());
    const [sellerFilter, setSellerFilter] = useState('todos');
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [productSortBy, setProductSortBy] = useState<'faturamento' | 'quantidade'>('faturamento');
    const [productConditionFilter, setProductConditionFilter] = useState('todos');
    const [productStorageFilter, setProductStorageFilter] = useState('todos');
    const [productCategoryFilter, setProductCategoryFilter] = useState('todos');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);
    const [chartMode, setChartMode] = useState<'bar' | 'area' | 'ticket'>('bar');

    const userMap = useMemo(() => users.reduce((acc, user) => ({ ...acc, [user.id]: user.name }), {} as Record<string, string>), [users]);
    const customerMap = useMemo(() => customers.reduce((acc, customer) => ({ ...acc, [customer.id]: customer.name }), {} as Record<string, string>), [customers]);
    const categoryMap = useMemo(() => categories.reduce((acc, cat) => ({ ...acc, [cat.id]: cat.name }), {} as Record<string, string>), [categories]);
    const productMap = useMemo(() => products.reduce((acc: Record<string, Product>, p) => {
        acc[p.id] = p;
        return acc;
    }, {} as Record<string, Product>), [products]);

    const filterSalesByDateRange = useCallback((saleList: Sale[], sDate: string, eDate: string, seller: string) => {
        return saleList.filter(sale => {
            const saleDate = new Date(sale.date);
            const [sY, sM, sD] = sDate.split('-').map(Number);
            const start = new Date(sY, sM - 1, sD, 0, 0, 0, 0);
            const [eY, eM, eD] = eDate.split('-').map(Number);
            const end = new Date(eY, eM - 1, eD, 23, 59, 59, 999);
            return saleDate >= start && saleDate <= end &&
                (seller === 'todos' || sale.salespersonId === seller) &&
                sale.status !== 'Cancelada';
        });
    }, []);

    const filteredSales = useMemo(() =>
        filterSalesByDateRange(sales, startDate, endDate, sellerFilter),
        [sales, startDate, endDate, sellerFilter, filterSalesByDateRange]
    );

    // ─── Previous Period (period-over-period) ────────────────────────────────
    const previousPeriodSales = useMemo(() => {
        const [sY, sM, sD] = startDate.split('-').map(Number);
        const [eY, eM, eD] = endDate.split('-').map(Number);
        const startMs = new Date(sY, sM - 1, sD).getTime();
        const endMs = new Date(eY, eM - 1, eD).getTime();
        const durationMs = endMs - startMs + 86400000; // +1 day
        const prevEnd = new Date(startMs - 1);
        const prevStart = new Date(startMs - durationMs);
        return filterSalesByDateRange(sales, toDateValue(prevStart), toDateValue(prevEnd), sellerFilter);
    }, [sales, startDate, endDate, sellerFilter, filterSalesByDateRange]);

    const calcKpis = useCallback((saleList: Sale[]) => {
        let totalFaturamento = 0;
        let totalCost = 0;
        let appleStats = { faturamento: 0, lucro: 0 };
        let otherStats = { faturamento: 0, lucro: 0 };

        saleList.forEach(sale => {
            totalFaturamento += sale.total;
            let saleCost = 0;
            sale.items.forEach(item => {
                const product = productMap[item.productId];
                const itemCost = getItemCostSnapshot(item, product) * item.quantity;
                const itemNetRevenue = item.unitPrice * item.quantity;
                const itemProfit = itemNetRevenue - itemCost;
                const brand = (product?.brand || (item as any).brand || '').toLowerCase();
                const model = (product?.model || (item as any).productName || (item as any).model || '').toLowerCase();
                const isApple = brand.includes('apple') || 
                                model.includes('iphone') || 
                                model.includes('ipad') || 
                                model.includes('macbook') || 
                                model.includes('apple') || 
                                model.includes('airpods') || 
                                model.includes('watch');
                if (isApple) {
                    appleStats.faturamento += itemNetRevenue;
                    appleStats.lucro += itemProfit;
                } else {
                    otherStats.faturamento += itemNetRevenue;
                    otherStats.lucro += itemProfit;
                }
                saleCost += itemCost;
            });
            totalCost += saleCost;
        });

        const count = saleList.length;
        const profit = totalFaturamento - totalCost;
        const avgTicket = count > 0 ? totalFaturamento / count : 0;
        const winner = appleStats.faturamento >= otherStats.faturamento ? 'Apple' : 'Não Apple';
        const winnerData = appleStats.faturamento >= otherStats.faturamento ? appleStats : otherStats;
        return { totalSales: totalFaturamento, totalProfit: profit, salesCount: count, avgTicket, winnerCategory: { name: winner, ...winnerData } };
    }, [productMap]);

    const { totalSales, totalProfit, salesCount, avgTicket, winnerCategory } = useMemo(() => calcKpis(filteredSales), [filteredSales, calcKpis]);
    const prevKpis = useMemo(() => calcKpis(previousPeriodSales), [previousPeriodSales, calcKpis]);

    const trendPct = useCallback((curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return ((curr - prev) / Math.abs(prev)) * 100;
    }, []);

    // Meta mensal de faturamento (ajustável no futuro)
    const MONTHLY_REVENUE_GOAL = 1_500_000;

    const salesByDayData = useMemo(() => {
        const salesByDay = filteredSales.reduce<Record<string, { faturamento: number; lucro: number; vendas: number; ticketMedio: number }>>((acc, sale) => {
            const day = new Date(sale.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            if (!acc[day]) {
                acc[day] = { faturamento: 0, lucro: 0, vendas: 0, ticketMedio: 0 };
            }
            // Snapshot do custo na época da venda
            const saleCost = sale.items.reduce((cost, item) => {
                const product = productMap[item.productId];
                return cost + getItemCostSnapshot(item, product) * item.quantity;
            }, 0);
            const revenue = sale.total;

            acc[day].faturamento += sale.total;
            acc[day].lucro += revenue - saleCost;
            acc[day].vendas += 1;
            return acc;
        }, {});

        return Object.entries(salesByDay).map(([name, data]) => {
            const ticketMedio = data.vendas > 0 ? data.faturamento / data.vendas : 0;
            return { name, ...data, ticketMedio };
        })
        .sort((a, b) => {
            const [dayA, monthA] = a.name.split('/');
            const [dayB, monthB] = b.name.split('/');
            return new Date(`${new Date().getFullYear()}-${monthA}-${dayA}`).getTime() - new Date(`${new Date().getFullYear()}-${monthB}-${dayB}`).getTime();
        });
    }, [filteredSales, productMap]);

    const salesByPaymentMethodData = useMemo(() => {
        const paymentData = filteredSales.flatMap(s => s.payments).reduce((acc, payment) => {
            const method = payment.method;
            if (!acc[method]) {
                acc[method] = 0;
            }
            acc[method] += payment.value;
            return acc;
        }, {} as Record<string, number>);

        // Calculate percentages for tooltip if needed, but Recharts handles pie slices prop
        return Object.entries(paymentData)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => (b.value as number) - (a.value as number)); // Sort for better visualization
    }, [filteredSales]);

    const topSellingProducts = useMemo(() => {
        const productSales = filteredSales.flatMap(s => s.items).reduce<Record<string, { name: string; revenue: number; profit: number; quantity: number; condition: string; storage: string; category: string; brand: string }>>((acc, item) => {
            const product = productMap[item.productId];
            let baseName = product?.model || item.productName || item.model || 'Produto Removido';
            
            const brand = (product?.brand || (item as any).brand || '').trim();
            const storage = String(product?.storage || item.storage || '').trim();
            const color = product?.color || item.color;
            const rawCategory = (product?.category || (item as any).category || '').trim();
            let category = categoryMap[rawCategory] || rawCategory;
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category);
            
            const lowerName = baseName.toLowerCase();
            if (!category || isUuid || category === 'Geral') {
                if (lowerName.includes('iphone')) category = 'iPhone';
                else if (lowerName.includes('ipad')) category = 'iPad';
                else if (lowerName.includes('macbook') || lowerName.includes('mac ')) category = 'MacBook';
                else if (lowerName.includes('airpods')) category = 'AirPods';
                else if (lowerName.includes('watch')) category = 'Apple Watch';
                else if (lowerName.includes('cabo') || lowerName.includes('fonte') || lowerName.includes('case') || lowerName.includes('capa')) category = 'Acessórios';
                else category = 'Geral';
            }

            let condition = product?.condition || item.condition || '';
            if (!condition || condition === 'Não informada') {
                if (lowerName.includes('novo') || lowerName.includes('lacrado') || lowerName.includes('cpo')) {
                    condition = 'Novo';
                } else if (lowerName.includes('seminovo') || lowerName.includes('usado')) {
                    condition = 'Seminovo';
                } else {
                    condition = 'Novo';
                }
            }
            
            if (storage && !baseName.includes(storage)) baseName += ` ${storage}`;
            if (color && !baseName.includes(color)) baseName += ` ${color}`;
            
            const uniqueKey = `${baseName.trim()}_${condition}`;

            if (!acc[uniqueKey]) {
                acc[uniqueKey] = { name: baseName.trim(), revenue: 0, profit: 0, quantity: 0, condition, storage, category, brand };
            }

            const itemRevenue = item.quantity * item.unitPrice;
            const itemCost = getItemCostSnapshot(item, product) * item.quantity;
            const itemProfit = itemRevenue - itemCost;

            acc[uniqueKey].revenue += itemRevenue;
            acc[uniqueKey].profit += itemProfit;
            acc[uniqueKey].quantity += item.quantity;

            return acc;
        }, {});
        return Object.values(productSales);
    }, [filteredSales, productMap, categoryMap]);

    const availableConditions = useMemo(() => {
        const conditions = new Set<string>();
        topSellingProducts.forEach(p => {
            if (p.condition) conditions.add(p.condition);
        });
        return Array.from(conditions).sort();
    }, [topSellingProducts]);

    const availableStorages = useMemo(() => {
        const storages = new Set<string>();
        topSellingProducts.forEach(p => {
            if (p.storage) storages.add(p.storage);
        });
        return Array.from(storages).sort((a, b) => {
            const numA = parseInt(a, 10) || 0;
            const numB = parseInt(b, 10) || 0;
            return numA - numB;
        });
    }, [topSellingProducts]);

    const availableCategories = useMemo(() => {
        const categories = new Set<string>();
        topSellingProducts.forEach(p => {
            if (p.category) categories.add(p.category);
        });
        return Array.from(categories).sort();
    }, [topSellingProducts]);

    const filteredTopSellingProducts = useMemo(() => {
        let list = topSellingProducts;
        
        if (productConditionFilter !== 'todos') {
            const condTarget = productConditionFilter.toLowerCase();
            list = list.filter(p => {
                const cond = (p.condition || '').toLowerCase();
                if (condTarget === 'novo') {
                    return cond.includes('novo') || cond.includes('lacrado') || cond.includes('cpo');
                }
                if (condTarget === 'seminovo') {
                    return cond.includes('seminovo') || cond.includes('usado');
                }
                return cond.includes(condTarget);
            });
        }

        if (productStorageFilter !== 'todos') {
            const stTarget = productStorageFilter.toLowerCase();
            list = list.filter(p => p.storage.toLowerCase() === stTarget || p.name.toLowerCase().includes(stTarget));
        }

        if (productCategoryFilter !== 'todos') {
            const catTarget = productCategoryFilter.toLowerCase();
            list = list.filter(p => {
                const cat = (p.category || '').toLowerCase();
                const name = (p.name || '').toLowerCase();
                return cat.includes(catTarget) || name.includes(catTarget);
            });
        }
        
        if (productSearchTerm) {
            const term = productSearchTerm.toLowerCase();
            list = list.filter(p => 
                p.name.toLowerCase().includes(term) || 
                p.brand.toLowerCase().includes(term) || 
                p.category.toLowerCase().includes(term)
            );
        }
        
        list = list.sort((a, b) => {
            if (productSortBy === 'quantidade') {
                return b.quantity - a.quantity;
            }
            return b.revenue - a.revenue;
        });

        const hasActiveFilter = Boolean(productSearchTerm || productConditionFilter !== 'todos' || productStorageFilter !== 'todos' || productCategoryFilter !== 'todos');
        return list.slice(0, hasActiveFilter ? 100 : 10);
    }, [topSellingProducts, productSearchTerm, productConditionFilter, productStorageFilter, productCategoryFilter, productSortBy]);

    // Faturamento total de TODOS os produtos do período (usado como denominador do % de participação)
    const totalAllProductsRevenue = useMemo(() => {
        return topSellingProducts.reduce((sum, p) => sum + p.revenue, 0);
    }, [topSellingProducts]);

    const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
    const displayedSales = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredSales.slice(start, start + itemsPerPage);
    }, [filteredSales, currentPage, itemsPerPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [startDate, endDate, sellerFilter, itemsPerPage]);

    return (
        <div className="space-y-6">
            {/* ── KPI Cards ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-6">
                <PremiumKpiCard
                    title="Faturamento Total"
                    value={formatCurrency(totalSales)}
                    icon={<CurrencyDollarIcon />}
                    color="blue"
                    trend={{ value: trendPct(totalSales, prevKpis.totalSales) }}
                    progress={{ current: totalSales, total: MONTHLY_REVENUE_GOAL, label: `Meta ${formatCurrency(MONTHLY_REVENUE_GOAL)}` }}
                />
                <PremiumKpiCard
                    title="Lucro Líquido"
                    value={formatCurrency(totalProfit)}
                    icon={<TrendingUpIcon />}
                    color={totalProfit >= 0 ? "emerald" : "red"}
                    trend={{ value: trendPct(totalProfit, prevKpis.totalProfit) }}
                />
                <PremiumKpiCard
                    title="Vendas Realizadas"
                    value={salesCount}
                    icon={<ShoppingCartIcon />}
                    color="purple"
                    trend={{ value: trendPct(salesCount, prevKpis.salesCount) }}
                />
                <PremiumKpiCard
                    title="Ticket Médio"
                    value={formatCurrency(avgTicket)}
                    icon={<BanknotesIcon />}
                    color="orange"
                    trend={{ value: trendPct(avgTicket, prevKpis.avgTicket) }}
                />
                <PremiumKpiCard
                    title="Categoria Vencedora"
                    value={winnerCategory.name}
                    icon={<TrophyIcon />}
                    color="indigo"
                    subtitle={
                        <div className="space-y-1 mt-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-indigo-600 font-bold uppercase">Faturamento</span>
                                <span className="text-indigo-900 font-black">{formatCurrency(winnerCategory.faturamento)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-indigo-600 font-bold uppercase">Lucro</span>
                                <span className="text-emerald-700 font-black">{formatCurrency(winnerCategory.lucro)}</span>
                            </div>
                        </div>
                    }
                />
            </div>

            {/* ── Quick Date Filter ─────────────────────────────────────── */}
            <QuickDateFilter
                active={quickPeriod}
                onSelect={(period, s, e) => { setQuickPeriod(period); setStartDate(s); setEndDate(e); }}
                showPickers={quickPeriod === 'personalizado'}
                startDate={startDate}
                endDate={endDate}
                onStartChange={setStartDate}
                onEndChange={setEndDate}
                users={users}
                sellerFilter={sellerFilter}
                onSellerChange={setSellerFilter}
                onClear={() => {
                    setSellerFilter('todos');
                    const d = new Date();
                    setStartDate(toDateValue(new Date(d.getFullYear(), d.getMonth(), 1)));
                    setEndDate(toDateValue());
                    setQuickPeriod('estemes');
                }}
            />

            {/* ── Evolução Diária com toggle Bar / Area ─────────────────── */}
            <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-black text-gray-900 flex items-center gap-3 text-lg uppercase tracking-tight">
                        <span className="w-2 h-8 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full"></span>
                        Evolução Diária
                    </h3>
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
                        <button
                            onClick={() => setChartMode('bar')}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${
                                chartMode === 'bar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'
                            }`}
                        >
                            Barras
                        </button>
                        <button
                            onClick={() => setChartMode('area')}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${
                                chartMode === 'area' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'
                            }`}
                        >
                            Área
                        </button>
                        <button
                            onClick={() => setChartMode('ticket')}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${
                                chartMode === 'ticket' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'
                            }`}
                        >
                            Ticket Médio
                        </button>
                    </div>
                </div>

                {chartMode === 'bar' ? (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={salesByDayData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barGap={0}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} dy={10} />
                            <YAxis tickFormatter={(v) => new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(v)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                            <Bar dataKey="faturamento" fill={COLORS.primary} name="Faturamento" radius={[4, 4, 0, 0]} maxBarSize={50} />
                            <Bar dataKey="lucro" fill={COLORS.success} name="Lucro" radius={[4, 4, 0, 0]} maxBarSize={50} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : chartMode === 'area' ? (
                    <ResponsiveContainer width="100%" height={350}>
                        <AreaChart data={salesByDayData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gradFaturamento" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.18} />
                                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradLucro" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.18} />
                                    <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} dy={10} />
                            <YAxis tickFormatter={(v) => new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(v)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                            <Area type="monotone" dataKey="faturamento" stroke={COLORS.primary} strokeWidth={2.5} fill="url(#gradFaturamento)" name="Faturamento" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                            <Area type="monotone" dataKey="lucro" stroke={COLORS.success} strokeWidth={2.5} fill="url(#gradLucro)" name="Lucro" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <ResponsiveContainer width="100%" height={350}>
                        <AreaChart data={salesByDayData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gradTicket" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} dy={10} />
                            <YAxis tickFormatter={(v) => new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(v)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                            <Area type="monotone" dataKey="ticketMedio" stroke={COLORS.orange} strokeWidth={2.5} fill="url(#gradTicket)" name="Ticket Médio" dot={true} activeDot={{ r: 6, strokeWidth: 0 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm flex flex-col">
                    <h3 className="font-black text-gray-900 mb-6 flex items-center gap-3 text-lg uppercase tracking-tight">
                        <span className="w-2 h-8 bg-gradient-to-b from-purple-400 to-purple-600 rounded-full"></span>
                        Formas de Pagamento
                    </h3>
                    <div className="flex-1 w-full min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={salesByPaymentMethodData}
                                    cx="40%"
                                    cy="50%"
                                    innerRadius={90}
                                    outerRadius={130}
                                    paddingAngle={3}
                                    dataKey="value"
                                    nameKey="name"
                                >
                                    {salesByPaymentMethodData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} strokeWidth={0} />
                                    ))}
                                    <DonutCenterLabel
                                        total={salesByPaymentMethodData.reduce((s, d) => s + (d.value as number), 0)}
                                        topMethod={salesByPaymentMethodData[0]?.name || ''}
                                    />
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    layout="vertical"
                                    verticalAlign="middle"
                                    align="right"
                                    iconType="circle"
                                    formatter={(value, entry: any) => (
                                        <div className="inline-flex items-baseline gap-2 ml-1 mb-3">
                                            <span className="text-sm font-black text-gray-900">{formatCurrency(entry.payload.value)}</span>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{value}</span>
                                        </div>
                                    )}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm flex flex-col">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                        <h3 className="font-black text-gray-900 flex items-center gap-3 text-lg uppercase tracking-tight shrink-0 leading-tight">
                            <span className="w-2 h-10 bg-gradient-to-b from-orange-400 to-orange-600 rounded-full"></span>
                            <div>
                                Produtos<br/>Vendidos
                            </div>
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto sm:justify-end">
                            <div className="relative w-full sm:w-auto shrink-0 flex-1 sm:flex-none sm:min-w-[200px]">
                                <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Buscar produto..."
                                    value={productSearchTerm}
                                    onChange={e => setProductSearchTerm(e.target.value)}
                                    className="pl-9 pr-4 py-2 border rounded-xl bg-gray-50 border-gray-100 focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all outline-none text-xs font-bold w-full"
                                />
                            </div>
                            <select
                                value={productConditionFilter}
                                onChange={e => setProductConditionFilter(e.target.value)}
                                className="flex-1 sm:flex-none w-full sm:w-auto h-[34px] px-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 outline-none focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                            >
                                <option value="todos">Condição: Todas</option>
                                {availableConditions.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                                <option value="Não informada">Não informada</option>
                            </select>
                            {availableStorages.length > 0 && (
                                <select
                                    value={productStorageFilter}
                                    onChange={e => setProductStorageFilter(e.target.value)}
                                    className="flex-1 sm:flex-none w-full sm:w-auto h-[34px] px-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 outline-none focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                                >
                                    <option value="todos">Capacidade: Todas</option>
                                    {availableStorages.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            )}
                            {availableCategories.length > 0 && (
                                <select
                                    value={productCategoryFilter}
                                    onChange={e => setProductCategoryFilter(e.target.value)}
                                    className="flex-1 sm:flex-none w-full sm:w-auto h-[34px] px-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 outline-none focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                                >
                                    <option value="todos">Categoria: Todas</option>
                                    {availableCategories.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            )}
                            <select
                                value={productSortBy}
                                onChange={e => setProductSortBy(e.target.value as any)}
                                className="flex-1 sm:flex-none w-full sm:w-auto h-[34px] px-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 outline-none focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                            >
                                <option value="faturamento">Por Faturamento</option>
                                <option value="quantidade">Por Quantidade</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                        {filteredTopSellingProducts.length > 0 ? (() => {
                            return filteredTopSellingProducts.map((product, index) => {
                                const revenueShare = totalAllProductsRevenue > 0 ? (product.revenue / totalAllProductsRevenue) * 100 : 0;
                                const profitMargin = product.revenue > 0 ? (product.profit / product.revenue) * 100 : 0;
                                const isLoss = product.profit < 0;
                                return (
                                    <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-gray-50/50 hover:bg-gray-100/50 transition-all border border-transparent hover:border-gray-200 gap-3">
                                        <div>
                                            <p className="text-sm font-black text-gray-900 leading-tight uppercase tracking-tight">
                                                {product.name}
                                                {product.condition && product.condition !== 'Não informada' && (
                                                    <span className="ml-2 text-[10px] font-bold text-gray-400 bg-gray-200/50 px-2 py-0.5 rounded-full">{product.condition}</span>
                                                )}
                                            </p>
                                            <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-md bg-gray-200 text-gray-700 text-[10px] font-bold uppercase tracking-widest">
                                                {product.quantity} unidades vendidas
                                            </span>
                                        </div>
                                        <div className="text-left sm:text-right">
                                            <div className="flex items-baseline justify-end gap-2">
                                                <p className="text-base font-black text-primary tracking-tight">{formatCurrency(product.revenue)}</p>
                                                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">{revenueShare.toFixed(1)}%</span>
                                            </div>
                                            <p className={`text-[11px] font-bold mt-0.5 uppercase tracking-tighter ${isLoss ? 'text-red-500' : 'text-emerald-600'}`}>
                                                Lucro: {formatCurrency(product.profit)}
                                            </p>
                                            <p className={`text-[10px] font-bold mt-0.5 uppercase tracking-tighter ${isLoss ? 'text-red-400' : 'text-gray-400'}`}>
                                                Margem: {profitMargin.toFixed(1)}%
                                            </p>
                                        </div>
                                    </div>
                                );
                            });
                        })() : (
                            <div className="p-4 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">Nenhum produto encontrado.</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-4">
                        <span className="w-2 h-10 bg-gradient-to-b from-indigo-400 to-indigo-700 rounded-full"></span>
                        <div>
                            <h3 className="font-black text-2xl text-gray-900 tracking-tight leading-none">Relatório Detalhado de Vendas</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1.5">{filteredSales.length} vendas encontradas</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Exibir:</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => setItemsPerPage(Number(e.target.value))}
                            className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs font-black outline-none focus:ring-4 focus:ring-primary/10 transition-all font-sans"
                        >
                            <option value={15}>15</option>
                            <option value={30}>30</option>
                            <option value={45}>45</option>
                        </select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-muted">
                        <thead className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
                            <tr>
                                <th className="px-6 py-4">ID Venda</th>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Cliente</th>
                                <th className="px-6 py-4">Vendedor</th>
                                <th className="px-6 py-4">Itens</th>
                                <th className="px-6 py-4 text-right">Total</th>
                                <th className="px-6 py-4 text-right">Lucro</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedSales.map(sale => {
                                const saleCost = sale.items.reduce((cost, item) => {
                                    const product = productMap[item.productId];
                                    // Snapshot do custo na época da venda
                                    return cost + getItemCostSnapshot(item, product) * item.quantity;
                                }, 0);
                                const revenue = sale.total;
                                const profit = revenue - saleCost;
                                return (
                                    <tr key={sale.id} className="group hover:bg-gray-50/80 transition-all">
                                        <td className="px-6 py-4 bg-gray-50/30 rounded-l-2xl border-y border-l border-transparent group-hover:border-gray-100 font-bold text-primary">#{sale.id}</td>
                                        <td className="px-6 py-4 bg-gray-50/30 border-y border-transparent group-hover:border-gray-100">{new Date(sale.date).toLocaleDateString('pt-BR')}</td>
                                        <td className="px-6 py-4 bg-gray-50/30 border-y border-transparent group-hover:border-gray-100 font-medium text-gray-900">{customerMap[sale.customerId] || 'N/A'}</td>
                                        <td className="px-6 py-4 bg-gray-50/30 border-y border-transparent group-hover:border-gray-100 font-black text-gray-400 uppercase text-[10px] tracking-widest">{userMap[sale.salespersonId] || 'N/A'}</td>
                                        <td className="px-6 py-4 bg-gray-50/30 border-y border-transparent group-hover:border-gray-100 font-bold text-gray-700">{sale.items.length}</td>
                                        <td className="px-6 py-4 bg-gray-50/30 border-y border-transparent group-hover:border-gray-100 text-right font-black text-primary">{formatCurrency(sale.total)}</td>
                                        <td className={`px-6 py-4 bg-gray-50/30 rounded-r-2xl border-y border-r border-transparent group-hover:border-gray-100 text-right font-black ${profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{formatCurrency(profit)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-8 border-t border-gray-100 pt-6 print:hidden">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Página {currentPage} de {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="h-10 px-6 border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="h-10 px-6 border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};

const EstoqueReport: React.FC<{ products: Product[], sales: Sale[], productModels: ProductModel[], initialFilter: string | null }> = ({ products, sales, productModels, initialFilter }) => {
    const [stockFilter, setStockFilter] = useState('todos');
    const [searchTerm, setSearchTerm] = useState('');
    const [brandFilter, setBrandFilter] = useState('todos');
    const [idleDays, setIdleDays] = useState(30);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

    // Reset page when filters change
    useEffect(() => {
        if (initialFilter === 'low_stock') {
            setStockFilter('baixo');
        } else if (initialFilter === 'parado') {
            setStockFilter('parado');
            setBrandFilter('todos');
        }
    }, [initialFilter]);

    // Reset brand filter to 'todos' when switching to 'parado' view
    useEffect(() => {
        if (stockFilter === 'parado') {
            setBrandFilter('todos');
        } else if (stockFilter === 'zerado') {
            setBrandFilter('non_unique');
        }
    }, [stockFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [stockFilter, searchTerm, brandFilter, idleDays, itemsPerPage]);

    const filteredProducts = useMemo(() => {
        const filtered = products.filter(p => {
            const matchesSearch = p.model.toLowerCase().includes(searchTerm.toLowerCase());

            let matchesBrand = true;
            if (brandFilter === 'apple') {
                matchesBrand = (p.brand || '').toLowerCase().includes('apple');
            } else if (brandFilter === 'outros') {
                matchesBrand = !(p.brand || '').toLowerCase().includes('apple');
            } else if (brandFilter === 'non_unique') {
                matchesBrand = !p.imei1 && !p.serialNumber;
            }

            let matchesStatus = true;
            const getProductDate = (item: Product) => {
                const raw = item.createdAt || (item as any).created_at || (item as any).entry_date;
                if (!raw) return new Date(0);
                const d = new Date(raw);
                return isNaN(d.getTime()) ? new Date(0) : d;
            };

            const createdAt = getProductDate(p);
            const productAgeDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

            switch (stockFilter) {
                case 'baixo':
                    // For non-Apple products in 'baixos' view, exclude unique items (IMEI/SN) 
                    // because unique items are always individual units and don't fit the 'low stock' replenishment model.
                    const isUniqueNonApple = !(p.brand || '').toLowerCase().includes('apple') && (p.imei1 || p.serialNumber);
                    if (brandFilter === 'outros' && isUniqueNonApple) {
                        matchesStatus = false;
                    } else {
                        matchesStatus = p.minimumStock != null && p.stock > 0 && p.stock <= p.minimumStock;
                    }
                    break;
                case 'zerado':
                    matchesStatus = p.stock <= 0;
                    break;
                case 'parado':
                    matchesStatus = productAgeDays >= idleDays && p.stock > 0;
                    break;
                case 'todos':
                default:
                    matchesStatus = true;
            }
            return matchesSearch && matchesStatus && matchesBrand;
        });

        let resultList: Product[] = [];
        if (brandFilter === 'non_unique' || brandFilter === 'outros') {
            const groupedMap: Record<string, Product> = {};
            const finalFiltered: Product[] = [];

            filtered.forEach(p => {
                // Products without IMEI and Serial Number should be grouped
                const isNonUnique = !p.imei1 && !p.serialNumber;

                if (isNonUnique) {
                    const key = `${(p.model || '').trim().toLowerCase()}-${(p.condition || '').trim().toLowerCase()}-${(p.color || '').trim().toLowerCase()}-${(p.storage || '').toString().trim().toLowerCase()}-${p.costPrice || 0}-${p.price || 0}`;
                    if (!groupedMap[key]) {
                        groupedMap[key] = { ...p };
                    } else {
                        groupedMap[key].stock += p.stock;
                    }
                } else {
                    // Unique products (with IMEI or SN) stay as separate lines
                    finalFiltered.push({ ...p });
                }
            });

            resultList = [...finalFiltered, ...Object.values(groupedMap)];
        } else {
            resultList = filtered;
        }

        if (stockFilter === 'parado') {
            resultList = [...resultList].sort((a, b) => {
                const getProductDate = (item: Product) => {
                    const raw = item.createdAt || (item as any).created_at || (item as any).entry_date;
                    if (!raw) return new Date(0);
                    const d = new Date(raw);
                    return isNaN(d.getTime()) ? new Date(0) : d;
                };
                const timeA = getProductDate(a).getTime();
                const timeB = getProductDate(b).getTime();
                return timeA - timeB; // Mais antigo no topo (timestamp menor = data mais antiga no passado)
            });
        }

        return resultList;
    }, [products, stockFilter, searchTerm, brandFilter, idleDays]);

    const displayedProducts = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredProducts.slice(start, start + itemsPerPage);
    }, [filteredProducts, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

    const kpis = useMemo(() => {
        const totalItems = filteredProducts.reduce((sum, p) => sum + p.stock, 0);
        const totalCost = filteredProducts.reduce((sum, p) => sum + ((p.costPrice || 0) + (p.additionalCostPrice || 0)) * p.stock, 0);
        const totalSaleValue = filteredProducts.reduce((sum, p) => sum + p.price * p.stock, 0);

        // Apple Products
        const appleItems = products.filter(p => (p.brand || '').toLowerCase().includes('apple'));
        const appleCount = appleItems.reduce((sum, p) => sum + p.stock, 0);
        const appleCost = appleItems.reduce((sum, p) => sum + ((p.costPrice || 0) + (p.additionalCostPrice || 0)) * p.stock, 0);
        const appleSaleValue = appleItems.reduce((sum, p) => sum + p.price * p.stock, 0);
        const appleMarkup = appleCost > 0 ? ((appleSaleValue - appleCost) / appleCost) * 100 : 0;

        // Non-Apple Products
        const otherItems = products.filter(p => !(p.brand || '').toLowerCase().includes('apple'));
        const otherCount = otherItems.reduce((sum, p) => sum + p.stock, 0);
        const otherCost = otherItems.reduce((sum, p) => sum + ((p.costPrice || 0) + (p.additionalCostPrice || 0)) * p.stock, 0);
        const otherSaleValue = otherItems.reduce((sum, p) => sum + p.price * p.stock, 0);
        const otherMarkup = otherCost > 0 ? ((otherSaleValue - otherCost) / otherCost) * 100 : 0;

        // Calculate idle stock for the KPI specifically
        const idleCount = products.filter(p => {
            const raw = p.createdAt || (p as any).created_at || (p as any).entry_date;
            const d = raw ? new Date(raw) : new Date(0);
            const dateObj = isNaN(d.getTime()) ? new Date(0) : d;
            const age = Math.floor((Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
            return age >= idleDays && p.stock > 0;
        }).length;

        return {
            totalItems,
            totalCost,
            totalSaleValue,
            appleCount,
            appleCost,
            appleSaleValue,
            appleMarkup,
            otherCount,
            otherCost,
            otherSaleValue,
            otherMarkup,
            idleCount
        };
    }, [filteredProducts, products, idleDays]);

    const topSellingData = useMemo(() => {
        // Agrupa por productId, mas guarda também o nome snapshot do item
        const productCounts: Record<string, { count: number; snapshotName: string }> = {};
        sales.forEach(sale => {
            if (sale.status === 'Cancelada') return;
            sale.items.forEach(item => {
                if (!productCounts[item.productId]) {
                    // Monta nome usando dados snapshot do item (caso o produto tenha sido deletado)
                    let name = (item as any).productName || (item as any).model || '';
                    const storage = (item as any).storage;
                    const color = (item as any).color;
                    if (storage && !name.includes(String(storage))) name += ` ${storage}`;
                    if (color && !name.includes(color)) name += ` ${color}`;
                    productCounts[item.productId] = { count: 0, snapshotName: name.trim() };
                }
                productCounts[item.productId].count += item.quantity;
            });
        });

        return Object.entries(productCounts)
            .map(([id, { count, snapshotName }]) => {
                // Prefere o nome do produto atual; usa snapshot se o produto foi removido
                const product = products.find(p => p.id === id);
                const name = product?.model || snapshotName || 'Produto Removido';
                return { name, value: count };
            })
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [sales, products]);

    const highMarginData = useMemo(() => {
        return products
            .map(p => {
                const cost = (p.costPrice || 0) + (p.additionalCostPrice || 0);
                const margin = p.price > 0 ? ((p.price - cost) / p.price) * 100 : 0;
                return { name: p.model, value: margin };
            })
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [products]);

    const getStatus = (product: Product) => {
        if (product.stock <= 0) {
            return <span className="px-2 py-1 text-xs font-semibold rounded-xl bg-gray-200 text-gray-800">Zerado</span>;
        }
        if (product.minimumStock != null && product.stock <= product.minimumStock) {
            return <span className="px-2 py-1 text-xs font-semibold rounded-xl bg-red-100 text-red-800">Baixo</span>;
        }
        return <span className="px-2 py-1 text-xs font-semibold rounded-xl bg-green-100 text-green-800">OK</span>;
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-6">
                <PremiumKpiCard title="Total de Itens" value={kpis.totalItems.toLocaleString('pt-BR')} icon={<PackageIcon />} color="blue" />
                <PremiumKpiCard title="Custo Estoque" value={formatCurrency(kpis.totalCost)} icon={<WalletIcon />} color="orange" />
                <PremiumKpiCard title="Venda Estoque" value={formatCurrency(kpis.totalSaleValue)} icon={<BanknotesIcon />} color="emerald" />

                <PremiumKpiCard
                    title="Estoque Parado"
                    value={kpis.idleCount}
                    icon={<ClockIcon />}
                    color="red"
                    onClick={() => setStockFilter('parado')}
                    subtitle={
                        <select
                            value={idleDays}
                            onChange={(e) => { e.stopPropagation(); setIdleDays(Number(e.target.value)); }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-red-600/20 border border-red-200/20 text-[10px] font-black rounded-lg px-2 py-0.5 outline-none cursor-pointer text-red-700 shadow-sm"
                        >
                            <option value={15}>15 d</option>
                            <option value={30}>30 d</option>
                            <option value={60}>60 d</option>
                        </select>
                    }
                />

                <PremiumKpiCard
                    title="Estoque Apple"
                    value={kpis.appleCount}
                    icon={<AppleIcon className="w-5 h-5 brightness-0 invert" />}
                    color="indigo"
                    subtitle={
                        <div className="space-y-0.5">
                            <div className="flex justify-between text-[10px]">
                                <span className="text-indigo-600 font-bold uppercase">Custo</span>
                                <span className="text-indigo-900 font-black">{formatCurrency(kpis.appleCost)}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-indigo-600 font-bold uppercase">Mg</span>
                                <span className="text-emerald-700 font-black">{kpis.appleMarkup.toFixed(1)}%</span>
                            </div>
                        </div>
                    }
                />

                <PremiumKpiCard
                    title="Estoque Outros"
                    value={kpis.otherCount}
                    icon={<Squares2x2Icon />}
                    color="purple"
                    subtitle={
                        <div className="space-y-0.5">
                            <div className="flex justify-between text-[10px]">
                                <span className="text-purple-600 font-bold uppercase">Custo</span>
                                <span className="text-purple-900 font-black">{formatCurrency(kpis.otherCost)}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-purple-600 font-bold uppercase">Mg</span>
                                <span className="text-emerald-700 font-black">{kpis.otherMarkup.toFixed(1)}%</span>
                            </div>
                        </div>
                    }
                />
            </div>

            <div className="bg-white border border-gray-100 rounded-[2rem] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4 flex-1">
                    <div className="relative flex-1 max-w-md group">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
                            <SearchIcon className="w-5 h-5" />
                        </span>
                        <input
                            type="text"
                            placeholder="Buscar produto..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-xl bg-gray-50 border-gray-100 focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all outline-none h-11 text-sm font-bold"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={brandFilter}
                            onChange={(e) => setBrandFilter(e.target.value)}
                            className="h-11 px-4 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500 outline-none focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                        >
                            <option value="todos">Todos Marcas</option>
                            <option value="apple">Apple</option>
                            <option value="outros">Outros</option>
                            <option value="non_unique">Lotes</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-2xl border border-gray-100 self-start lg:self-center">
                    {['todos', 'baixo', 'zerado', 'parado'].map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setStockFilter(filter)}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${stockFilter === filter
                                ? 'bg-primary text-white shadow-lg shadow-blue-500/20'
                                : 'text-gray-400 hover:text-gray-900 hover:bg-white'
                                }`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-4">
                        <span className="w-2 h-10 bg-gradient-to-b from-indigo-400 to-indigo-700 rounded-full"></span>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-none">Inventário Detalhado</h2>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1.5">{filteredProducts.length} itens encontrados</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 print:hidden">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Exibir:</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => setItemsPerPage(Number(e.target.value))}
                            className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs font-black outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                        >
                            <option value={15}>15</option>
                            <option value={30}>30</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600">
                        <thead className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
                            <tr>
                                <th className="px-6 py-4">Produto</th>
                                <th className="px-6 py-4 text-center">Unidades</th>
                                {stockFilter === 'parado' && <th className="px-6 py-4 text-center">Tempo em Estoque</th>}
                                <th className="px-6 py-4 text-center">Mínimo</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Custo Total</th>
                                <th className="px-6 py-4 text-right">Venda Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {displayedProducts.map(product => (
                                <tr key={product.id} className="group hover:bg-gray-50/80 transition-all">
                                    <td className="px-6 py-4 bg-gray-50/30 rounded-l-2xl border-y border-l border-transparent group-hover:border-gray-100">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="font-black text-gray-900 text-sm tracking-tight">{product.model}</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {product.origin === 'Troca' && (
                                                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-purple-100 text-purple-700 uppercase tracking-widest">Troca</span>
                                                )}
                                                {product.batteryHealth !== undefined && product.batteryHealth > 0 && (product.brand || '').toLowerCase().includes('apple') && product.condition !== 'Novo' && product.condition !== 'CPO' && (
                                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black tracking-widest ${product.batteryHealth < 80 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {product.batteryHealth}% SAÚDE
                                                    </span>
                                                )}
                                                {product.imei1 && (
                                                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-white text-gray-400 border border-gray-100 uppercase tracking-tighter">
                                                        IMEI: {product.imei1}
                                                    </span>
                                                )}
                                                {product.serialNumber && (
                                                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-white text-gray-400 border border-gray-100 uppercase tracking-tighter">
                                                        N/S: {product.serialNumber}
                                                    </span>
                                                )}
                                                {product.variations && product.variations.length > 0 && (
                                                    <span className="italic font-bold text-gray-800 text-[9px] uppercase tracking-tighter">
                                                        {product.variations.map(v => v.valueName ? `${v.gradeName}: ${v.valueName}` : v.gradeName).join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 bg-gray-50/30 text-center border-y border-transparent group-hover:border-gray-100 font-black text-gray-900 text-lg">{product.stock}</td>
                                    {stockFilter === 'parado' && (() => {
                                        const raw = product.createdAt || (product as any).created_at || (product as any).entry_date;
                                        const d = raw ? new Date(raw) : null;
                                        const validDate = d && !isNaN(d.getTime()) ? d : null;
                                        const ageDays = validDate
                                            ? Math.floor((Date.now() - validDate.getTime()) / (1000 * 60 * 60 * 24))
                                            : null;
                                        const ageSeverity = ageDays !== null
                                            ? ageDays >= 180 ? 'bg-red-200 text-red-800 border-red-300'
                                                : ageDays >= 90 ? 'bg-orange-100 text-orange-700 border-orange-200'
                                                    : 'bg-red-100 text-red-700 border-red-200'
                                            : 'bg-gray-100 text-gray-500 border-gray-200';
                                        return (
                                            <td className="px-6 py-4 bg-gray-50/30 text-center border-y border-transparent group-hover:border-gray-100">
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <span className="text-[10px] text-gray-500 font-medium">
                                                        {validDate ? validDate.toLocaleDateString('pt-BR') : '–'}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-xl text-[10px] font-black border ${ageSeverity}`}>
                                                        {ageDays !== null ? `${ageDays} DIAS` : '–'}
                                                    </span>
                                                </div>
                                            </td>
                                        );
                                    })()}
                                    <td className="px-6 py-4 bg-gray-50/30 text-center border-y border-transparent group-hover:border-gray-100 font-bold text-gray-400">{product.minimumStock || '-'}</td>
                                    <td className="px-6 py-4 bg-gray-50/30 text-center border-y border-transparent group-hover:border-gray-100">{getStatus(product)}</td>
                                    <td className="px-6 py-4 bg-gray-50/30 text-right border-y border-transparent group-hover:border-gray-100 font-bold text-gray-400">{formatCurrency(((product.costPrice || 0) + (product.additionalCostPrice || 0)) * product.stock)}</td>
                                    <td className="px-6 py-4 bg-gray-50/30 text-right rounded-r-2xl border-y border-r border-transparent group-hover:border-gray-100 font-black text-gray-900">{formatCurrency(product.price * product.stock)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredProducts.length === 0 && (
                        <div className="text-center py-10 text-gray-400">
                            Nenhum produto encontrado com os filtros atuais.
                        </div>
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 border-t pt-4 print:hidden">
                        <span className="text-sm text-muted">
                            Página {currentPage} de {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-sm border rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 text-sm border rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm flex flex-col">
                    <h3 className="font-bold text-lg mb-6 text-gray-800 flex items-center gap-3 uppercase tracking-tight">
                        <span className="w-2 h-8 bg-gradient-to-b from-indigo-400 to-indigo-600 rounded-full"></span>
                        Produtos Mais Vendidos (Qtd)
                    </h3>
                    <div className="flex-1 w-full min-h-[450px]">
                        <ResponsiveContainer width="100%" height={450}>
                            <BarChart data={topSellingData} layout="vertical" margin={{ top: 5, right: 40, left: 20, bottom: 5 }} barSize={24}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={220}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={({ x, y, payload }: any) => {
                                        const label: string = payload.value || '';
                                        const max = 28;
                                        const display = label.length > max ? label.slice(0, max) + '…' : label;
                                        return (
                                            <text x={x - 210} y={y} dy={4} textAnchor="start" fill="#1f2937" fontSize={12} fontWeight={700}>
                                                {display}
                                            </text>
                                        );
                                    }}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="value" fill={COLORS.purple} name="Quantidade" radius={[0, 4, 4, 0]} background={{ fill: '#f8fafc' }}>
                                    <LabelList dataKey="value" position="right" fontSize={12} fontWeight={800} fill="#111827" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm flex flex-col">
                    <h3 className="font-bold text-lg mb-6 text-gray-800 flex items-center gap-3 uppercase tracking-tight">
                        <span className="w-2 h-8 bg-gradient-to-b from-teal-400 to-teal-600 rounded-full"></span>
                        Maiores Margens de Lucro (%)
                    </h3>
                    <div className="flex-1 w-full min-h-[450px]">
                        <ResponsiveContainer width="100%" height={450}>
                            <BarChart data={highMarginData} layout="vertical" margin={{ top: 5, right: 45, left: 20, bottom: 5 }} barSize={24}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={220}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={({ x, y, payload }: any) => {
                                        const label: string = payload.value || '';
                                        const max = 28;
                                        const display = label.length > max ? label.slice(0, max) + '…' : label;
                                        return (
                                            <text x={x - 210} y={y} dy={4} textAnchor="start" fill="#1f2937" fontSize={12} fontWeight={700}>
                                                {display}
                                            </text>
                                        );
                                    }}
                                />
                                <Tooltip
                                    content={({ active, payload, label }: any) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white p-3 border border-gray-100 rounded-xl shadow-xl">
                                                    <p className="font-bold text-gray-800 border-b pb-1 mb-1">{label}</p>
                                                    <p className="text-sm text-teal-600 font-semibold">Margem: {payload[0].value.toFixed(1)}%</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                    cursor={{ fill: 'transparent' }}
                                />
                                <Bar dataKey="value" fill={COLORS.success} name="Margem (%)" radius={[0, 4, 4, 0]} background={{ fill: '#f8fafc' }}>
                                    <LabelList
                                        dataKey="value"
                                        position="right"
                                        formatter={(val: number) => `${val.toFixed(1)}%`}
                                        fontSize={12}
                                        fontWeight={800}
                                        fill="#065f46"
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <AveragePriceReport products={products} productModels={productModels} />
        </div>
    );
};


const PlaceholderReport: React.FC<{ title: string }> = ({ title }) => (
    <div className="bg-surface p-6 rounded-2xl border border-border text-center text-muted mt-6">
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        <p>Este relatório está em desenvolvimento.</p>
    </div>
);


const Reports: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'estoque');
    const [sales, setSales] = useState<Sale[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [productModels, setProductModels] = useState<ProductModel[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPriceListModalOpen, setIsPriceListModalOpen] = useState(false);

    const tabs = [
        { id: 'estoque', label: 'Estoque' },
        { id: 'vendas', label: 'Gráficos de Vendas' },
        { id: 'sales_reports', label: 'Relatórios de Vendas' },
    ];

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && tabs.some(t => t.id === tab)) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [salesData, productsData, customersData, usersData, modelsData, categoriesData] = await Promise.all([
                    getSales(),
                    getProductsInStock(),
                    getCustomers(false),
                    getUsers(),
                    getProductModels(),
                    getCategories()
                ]);
                setSales(salesData);
                setProducts(productsData);
                setCustomers(customersData);
                setUsers(usersData);
                setProductModels(modelsData);
                setCategories(categoriesData || []);
            } catch (error) {
                console.error("Failed to fetch report data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handlePrintPDF = () => {
        window.print();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Relatórios Executivos</h1>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Inteligência de Negócios & Performance da Loja</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePrintPDF}
                        className="h-12 px-6 bg-gray-900 text-white rounded-2xl hover:bg-black text-xs font-black flex items-center gap-2.5 shadow-lg shadow-gray-900/10 uppercase tracking-widest transition-all active:scale-95 border border-gray-800 whitespace-nowrap"
                    >
                        <DocumentTextIcon className="h-5 w-5 text-indigo-400" /> Exportar PDF Executivo
                    </button>
                    {activeTab === 'estoque' && (
                        <button
                            onClick={() => setIsPriceListModalOpen(true)}
                            className="h-12 px-6 bg-gradient-to-br from-[#9c89ff] to-[#7B61FF] text-white rounded-2xl hover:opacity-95 text-xs font-black flex items-center gap-3 shadow-lg shadow-indigo-500/20 uppercase tracking-widest transition-all active:scale-95 border border-white/20 whitespace-nowrap"
                        >
                            <DocumentTextIcon className="h-6 w-6" /> Gerar Tabela Preços
                        </button>
                    )}
                </div>
            </div>

            {/* Cabeçalho exclusivo da versão impressa/PDF Executivo */}
            <div className="hidden print:block mb-8 p-6 bg-gray-900 text-white rounded-2xl">
                <div className="flex justify-between items-center border-b border-gray-800 pb-4 mb-4">
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">iStorePro — Relatório Executivo</h1>
                        <p className="text-xs text-gray-400">Emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-xs font-bold uppercase tracking-widest bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-lg border border-indigo-500/30">
                            {tabs.find(t => t.id === activeTab)?.label}
                        </span>
                    </div>
                </div>
            </div>

            <div className="inline-flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-sm print:hidden">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setSearchParams({ tab: tab.id }); }}
                        className={`px-8 py-3 rounded-xl text-[13px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-gray-900 hover:bg-white'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-full py-10"><SpinnerIcon /></div>
            ) : (
                <>
                    {activeTab === 'vendas' && <VendasReport sales={sales} products={products} customers={customers} users={users} categories={categories} />}
                    {activeTab === 'sales_reports' && <SalesReports sales={sales} products={products} customers={customers} users={users} productModels={productModels} />}
                    {activeTab === 'estoque' && <EstoqueReport products={products} sales={sales} productModels={productModels} initialFilter={searchParams.get('filter')} />}
                </>
            )}

            {isPriceListModalOpen && (
                <PriceListModal
                    isOpen={isPriceListModalOpen}
                    onClose={() => setIsPriceListModalOpen(false)}
                    products={products}
                />
            )}
        </div>
    );
};

export default Reports;