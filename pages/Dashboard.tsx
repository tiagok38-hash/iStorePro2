
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { getProducts, getCustomers, getSales, formatCurrency, getPaymentMethods, getUsers, getServiceOrders, getServices, getSuppliers } from '../services/mockApi.ts';
import { Product, Customer, Sale, PaymentMethodParameter, PermissionSet, User, ServiceOrder, Service, Supplier } from '../types.ts';
import { SmartphoneIcon, TagIcon, UserIcon, CubeIcon, ChartBarIcon, CurrencyDollarIcon, ClockIcon, CreditCardIcon, PlusIcon, DeviceExchangeIcon, ArchiveBoxIcon, UsersIcon, AppleIcon, ShoppingCartIcon, EyeIcon, EyeSlashIcon, WrenchIcon, PackageIcon, TrendingUpIcon } from '../components/icons.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import { SuspenseFallback } from '../components/GlobalLoading.tsx';
import SaleDetailModal from '../components/SaleDetailModal.tsx';

// --- Permission Guard ---
const getPermissionForRoute = (to: string, permissions: PermissionSet | null): boolean => {
    if (!permissions) return false;
    const path = to.split('?')[0];
    switch (path) {
        case '/vendas': return permissions.canAccessVendas;
        case '/products': return permissions.canAccessEstoque;
        case '/customers': return permissions.canAccessClientes;
        case '/reports': return permissions.canAccessRelatorios;
        default: return true;
    }
};

const ProtectedLink: React.FC<{
    to: string;
    className?: string;
    children: React.ReactNode;
    permissions: PermissionSet | null;
    onDenied: () => void;
}> = ({ to, className, children, permissions, onDenied }) => {
    const navigate = useNavigate();
    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (getPermissionForRoute(to, permissions)) {
            navigate(to);
        } else {
            onDenied();
        }
    };
    return (
        <a href={to} onClick={handleClick} className={className}>
            {children}
        </a>
    );
};

// --- Components ---
const InfoBanner: React.FC = React.memo(() => (
    <div className="bg-accent-light text-accent text-sm font-medium px-4 py-2 rounded-2xl flex items-center gap-2 border border-accent/10 shadow-sm shadow-accent/5 flex-1 justify-center">
        <SmartphoneIcon className="h-4 w-4" />
        <span>Bem-vindo ao iStore! Fique de olho para novidades.</span>
    </div>
));

const LowStockBanner: React.FC<{ count: number; isPrivacyMode?: boolean }> = React.memo(({ count, isPrivacyMode }) => (
    <Link to="/reports?tab=estoque&filter=low_stock" className="bg-danger-light text-danger text-sm font-medium px-4 py-2 rounded-2xl flex items-center gap-2 hover:bg-red-200 transition-all border border-danger/10 shadow-sm shadow-danger/5 flex-1 justify-center">
        <TagIcon className="h-4 w-4" />
        <span className="font-semibold text-center">Produtos com estoque baixo: {isPrivacyMode ? '***' : count}</span>
    </Link>
));

const FinancialDiscrepancyBanner: React.FC<{ count: number; isPrivacyMode?: boolean }> = React.memo(({ count, isPrivacyMode }) => (
    <Link to="/vendas?filter=discrepancy" className="bg-orange-100 text-orange-700 text-sm font-medium px-4 py-2 rounded-2xl flex items-center gap-2 hover:bg-orange-200 transition-all border border-orange-200/50 shadow-sm shadow-orange-500/5 flex-1 justify-center animate-pulse">
        <CurrencyDollarIcon className="h-4 w-4" />
        <span className="font-semibold text-center">Atenção: {isPrivacyMode ? '***' : count} vendas com divergência financeira</span>
    </Link>
));


const StatCard: React.FC<{ title: string; value: string | number; subValue1?: string; subValue2?: string; subValue3?: string; className?: string; icon?: React.ReactNode; isPrivacyMode?: boolean; to?: string }> = React.memo(({ title, value, subValue1, subValue2, subValue3, className, icon, isPrivacyMode, to }) => {
    const content = (
        <div className={`p-6 bg-white/80 backdrop-blur-md rounded-3xl border border-gray-300/80 shadow-[0_8px_30px_rgba(123,97,255,0.15)] flex flex-col h-full group transition-all duration-300 ${to ? 'hover:shadow-[0_16px_40px_rgba(123,97,255,0.22)] hover:scale-[1.01] hover:-translate-y-0.5 cursor-pointer' : ''} ${className || ''}`}>
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    {icon && <div className="text-secondary">{icon}</div>}
                    <h3 className="text-sm font-black text-secondary uppercase tracking-wider">{title}</h3>
                </div>
                {!to && <button className="text-[10px] font-black tracking-widest text-muted bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-all">ATUALIZAR</button>}
            </div>
            <p className="text-3xl font-bold text-primary mt-2">{isPrivacyMode ? '****' : value}</p>
            {subValue1 && <p className="text-sm text-blue-600 font-semibold mt-1">{isPrivacyMode ? '****' : subValue1}</p>}
            {subValue2 && <p className="text-base text-success font-semibold">{isPrivacyMode ? '****' : subValue2}</p>}
            {subValue3 && <p className="text-base text-success font-semibold">{isPrivacyMode ? '****' : subValue3}</p>}
        </div>
    );

    if (to) {
        return <Link to={to} className="block h-full">{content}</Link>;
    }
    return content;
});

const OpenServiceOrdersCard: React.FC<{ serviceOrders: ServiceOrder[]; isPrivacyMode?: boolean; to?: string }> = React.memo(({ serviceOrders, isPrivacyMode, to }) => {
    const navigate = useNavigate();

    const openOrders = useMemo(() => {
        return serviceOrders
            .filter(os => os.status === 'Aberto')
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [serviceOrders]);

    const recentOrders = useMemo(() => openOrders.slice(0, 5), [openOrders]);

    return (
        <div
            className={`p-6 bg-white/80 backdrop-blur-md rounded-3xl border border-gray-300/80 shadow-[0_8px_30px_rgba(123,97,255,0.15)] flex flex-col h-full group transition-all duration-300 ${to ? 'hover:shadow-[0_16px_40px_rgba(123,97,255,0.22)] hover:scale-[1.01] hover:-translate-y-0.5 cursor-pointer' : ''}`}
            onClick={() => to && navigate(to)}
        >
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shadow-sm">
                        <WrenchIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-secondary uppercase tracking-wider">OS em Aberto</h3>
                        <p className="text-2xl font-black text-gray-800 tracking-tight mt-0.5">{isPrivacyMode ? '***' : openOrders.length}</p>
                    </div>
                </div>
                {to && (
                    <button className="text-[10px] font-black tracking-widest text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-xl hover:bg-amber-100 transition-all uppercase">Ver Todas</button>
                )}
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto max-h-[220px] pr-1 custom-scrollbar">
                {recentOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                        <WrenchIcon className="w-8 h-8 text-gray-300 mb-2" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nenhuma OS em aberto</p>
                    </div>
                ) : (
                    recentOrders.map(os => (
                        <div key={os.id} className="p-3 bg-gray-50/50 hover:bg-white rounded-xl border border-gray-100 transition-all">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[11px] font-black text-amber-600 uppercase tracking-wider">#{os.displayId}</span>
                                <span className="text-[10px] font-bold text-gray-400">{new Date(os.createdAt).toLocaleDateString('pt-BR')}</span>
                            </div>
                            <p className="text-xs font-black text-gray-800 truncate">{os.deviceModel}</p>
                            <p className="text-[10px] text-gray-500 truncate font-medium mt-0.5">{os.customerName}</p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});

const ServiceOrderProfitCard: React.FC<{ serviceOrders: ServiceOrder[]; services: Service[]; products: Product[]; isPrivacyMode?: boolean; to?: string }> = React.memo(({ serviceOrders, services, products, isPrivacyMode, to }) => {
    const navigate = useNavigate();
    const [period, setPeriod] = useState<'today' | 'yesterday' | 'day_before' | 'week' | 'month'>('today');

    const metrics = useMemo(() => {
        const now = new Date();
        let startDate = new Date();
        let endDate = new Date();

        switch (period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                break;
            case 'yesterday':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
                break;
            case 'day_before':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 0, 0, 0);
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 23, 59, 59);
                break;
            case 'week':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 7);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                startDate.setHours(0, 0, 0, 0);
                break;
        }

        const validOS = serviceOrders.filter(os => {
            const date = new Date(os.exitDate || os.updatedAt || os.createdAt);
            const isFinished = ['Entregue', 'Concluído'].includes(os.status as string);
            return date >= startDate && date <= endDate && isFinished && os.status !== 'Cancelado';
        });

        const serviceMap = services.reduce((acc, s) => { acc[s.id] = s; return acc; }, {} as Record<string, Service>);
        const productMap = products.reduce((acc, p) => { acc[p.id] = p; return acc; }, {} as Record<string, Product>);

        // Generate Labels for chart
        let labels: string[] = [];
        const isHourly = ['today', 'yesterday', 'day_before'].includes(period);

        if (isHourly) {
            labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
        } else {
            const days = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const startD = new Date(startDate);
            labels = Array.from({ length: days + 1 }, (_, i) => {
                const d = new Date(startD);
                d.setDate(d.getDate() + i);
                return `${d.getDate()}`;
            });
        }

        const profitByPoint: Record<string, number> = {};
        labels.forEach(l => profitByPoint[l] = 0);

        const getKey = (date: Date) => {
            if (isHourly) return `${date.getHours()}h`;
            return `${date.getDate()}`;
        };

        let totalRevenue = 0;
        let totalCost = 0;

        validOS.forEach(os => {
            const osRevenue = (os.total || (os.subtotal - os.discount));
            let osCost = 0;

            os.items.forEach(item => {
                const refId = (item as any).catalogItemId || item.id;
                if (item.type === 'service') {
                    const s = serviceMap[refId];
                    osCost += (s?.cost || 0) * item.quantity;
                } else {
                    const p = productMap[refId];
                    if (p) {
                        osCost += ((p.costPrice || 0) + (p.additionalCostPrice || 0)) * item.quantity;
                    }
                }
            });

            const osProfit = osRevenue - osCost;
            totalRevenue += osRevenue;
            totalCost += osCost;

            const date = new Date(os.exitDate || os.updatedAt || os.createdAt);
            const key = getKey(date);
            if (profitByPoint[key] !== undefined) profitByPoint[key] += osProfit;
        });

        const chartData = labels.map(l => ({ name: l, value: profitByPoint[l] }));

        return {
            profit: totalRevenue - totalCost,
            revenue: totalRevenue,
            count: validOS.length,
            chartData
        };
    }, [serviceOrders, services, products, period]);

    return (
        <div
            className={`p-6 bg-white/80 backdrop-blur-md rounded-3xl border border-gray-300/80 shadow-[0_8px_30px_rgba(123,97,255,0.15)] flex flex-col h-full group transition-all duration-300 ${to ? 'hover:shadow-[0_16px_40px_rgba(123,97,255,0.22)] hover:scale-[1.01] hover:-translate-y-0.5 cursor-pointer' : ''}`}
            onClick={() => to && navigate(to)}
        >
            <div className="flex flex-row justify-between items-start mb-6 gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm shrink-0">
                        <TrendingUpIcon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-[10px] sm:text-xs font-black text-secondary uppercase tracking-wider">Lucro em OS</h3>
                        <p className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight mt-0.5 break-all line-clamp-2">{isPrivacyMode ? 'R$ ****' : formatCurrency(metrics.profit)}</p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0 mt-1">
                    <select
                        value={period}
                        onChange={(e) => { e.stopPropagation(); setPeriod(e.target.value as any); }}
                        className="text-[10px] font-black tracking-widest text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl hover:bg-gray-100 outline-none transition-all uppercase cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <option value="today">Hoje</option>
                        <option value="yesterday">Ontem</option>
                        <option value="day_before">Anteontem</option>
                        <option value="week">Semana</option>
                        <option value="month">Mês</option>
                    </select>
                    {to && (
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shadow-sm" title="Ver detalhes">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-[100px] -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.chartData}>
                        <defs>
                            <linearGradient id="colorOSProfit" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Tooltip
                            cursor={false}
                            content={<ProfitTooltip period={period === 'today' ? 'day' : period === 'yesterday' ? 'yesterday' : period} />}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#10b981"
                            fillOpacity={1}
                            fill="url(#colorOSProfit)"
                            strokeWidth={2}
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                <div className="bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Faturamento</p>
                    <p className="text-xs font-black text-gray-700">{isPrivacyMode ? 'R$ ****' : formatCurrency(metrics.revenue)}</p>
                </div>
                <div className="bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total de OS</p>
                    <p className="text-xs font-black text-gray-700">{isPrivacyMode ? '***' : metrics.count}</p>
                </div>
            </div>
        </div>
    );
});

const LowStockBulkProductsCard: React.FC<{ products: Product[]; isPrivacyMode?: boolean; to?: string }> = React.memo(({ products, isPrivacyMode, to }) => {
    const navigate = useNavigate();

    const lowStockBulk = useMemo(() => {
        const groupedMap = new Map<string, Product>();
        const finalResults: Product[] = [];

        products.forEach(p => {
            const isUnique = !!((p.serialNumber || '').trim() || (p.imei1 || '').trim() || (p.imei2 || '').trim());
            const hasVariations = p.variations && p.variations.length > 0;

            if (isUnique || hasVariations) {
                finalResults.push(p);
            } else {
                const key = `${p.model}|${p.brand}|${p.color}|${p.storage}|${p.condition}|${p.warranty}|${p.price}-${p.costPrice || 0}-${p.wholesalePrice || 0}|${p.supplierId}|${p.storageLocation}`;
                const existing = groupedMap.get(key);
                if (!existing) groupedMap.set(key, { ...p });
                else existing.stock += p.stock;
            }
        });

        const combinedList = [...finalResults, ...Array.from(groupedMap.values())];

        return combinedList.filter(p => {
            const isUnique = !!((p.serialNumber || '').trim() || (p.imei1 || '').trim() || (p.imei2 || '').trim());
            return !isUnique && p.stock <= (p.minimumStock || 0);
        }).sort((a, b) => (a.stock / (a.minimumStock || 1)) - (b.stock / (b.minimumStock || 1)));
    }, [products]);

    const recentItems = useMemo(() => lowStockBulk.slice(0, 5), [lowStockBulk]);

    return (
        <div
            className={`p-6 bg-white/80 backdrop-blur-md rounded-3xl border border-gray-300/80 shadow-[0_8px_30px_rgba(123,97,255,0.15)] flex flex-col h-full group transition-all duration-300 ${to ? 'hover:shadow-[0_16px_40px_rgba(123,97,255,0.22)] hover:scale-[1.01] hover:-translate-y-0.5 cursor-pointer' : ''}`}
            onClick={() => to && navigate(to)}
        >
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl shadow-sm">
                        <PackageIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-secondary uppercase tracking-wider">Produtos Lote em baixa</h3>
                        <p className="text-2xl font-black text-gray-800 tracking-tight mt-0.5">{isPrivacyMode ? '***' : lowStockBulk.length}</p>
                    </div>
                </div>
                {to && (
                    <button className="text-[10px] font-black tracking-widest text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-xl hover:bg-red-100 transition-all uppercase">Repor</button>
                )}
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto max-h-[220px] pr-1 custom-scrollbar">
                {recentItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                        <PackageIcon className="w-8 h-8 text-gray-300 mb-2" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Estoque OK</p>
                    </div>
                ) : (
                    recentItems.map(p => (
                        <div key={p.id} className="p-3 bg-red-50/30 hover:bg-white rounded-xl border border-red-100/50 transition-all">
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-xs font-black text-gray-800 truncate flex-1 pr-2">{p.model}</p>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${p.stock <= 0 ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'}`}>
                                    {isPrivacyMode ? '***' : p.stock} un
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                <span>Mínimo: {p.minimumStock} un</span>
                                <span className="text-red-500">Repor urgente</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});


const ProfitTooltip: React.FC<any> = ({ active, payload, label, period }) => {
    if (active && payload && payload.length) {
        const formattedLabel = (() => {
            if (!label) return '';
            const labelStr = label.toString();

            if (labelStr.endsWith('h')) return `Hora: ${labelStr}`;
            if (period === 'day' || period === 'yesterday') return `Hora: ${labelStr}h`;

            if (['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'].includes(labelStr)) return `Mês: ${labelStr}`;

            if (/^\d{1,2}$/.test(labelStr)) return `Dia: ${labelStr}`;
            return labelStr;
        })();

        return (
            <div className="bg-white/95 backdrop-blur-md p-4 border border-border rounded-3xl shadow-2xl shadow-emerald-500/10 ring-1 ring-black/5 animate-fade-in">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 border-b border-emerald-50 pb-2 flex items-center gap-2">
                    <ClockIcon className="w-3 h-3" /> {formattedLabel}
                </p>
                <div className="flex items-center gap-3 mt-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div>
                    <span className="text-sm font-black text-gray-800 tracking-tight">
                        {formatCurrency(payload[0].value)}
                    </span>
                </div>
            </div>
        );
    }
    return null;
};

const ProfitCard: React.FC<{ sales: Sale[]; products: Product[]; className?: string; isPrivacyMode?: boolean; to?: string; permissions?: PermissionSet | null; onDenied?: () => void }> = React.memo(({ sales, products, className, isPrivacyMode, to, permissions, onDenied }) => {
    const navigate = useNavigate();
    const [period, setPeriod] = useState<'day' | 'yesterday' | 'week' | 'month' | 'year'>('day');

    const handleNavigate = () => {
        if (!to) return;
        if (permissions && !getPermissionForRoute(to, permissions)) { onDenied?.(); return; }
        navigate(to);
    };

    const { totalProfit, totalRevenue, chartData } = useMemo(() => {
        const now = new Date();
        let startDate = new Date();
        let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        switch (period) {
            case 'day': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0); break;
            case 'yesterday':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
                break;
            case 'week':
                const day = now.getDay();
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day, 0, 0, 0, 0);
                endDate.setDate(startDate.getDate() + 6);
                break;
            case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
            case 'year': startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
                endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
                break;
        }

        const productMap = products.reduce((acc, p) => {
            acc[p.id] = p;
            return acc;
        }, {} as Record<string, Product>);
        const validSales = sales.filter(s => {
            if (s.status === 'Cancelada') return false;
            const d = new Date(s.date);
            return d >= startDate && d <= endDate;
        });

        let totalProfit = 0;
        let totalRevenue = 0;
        const profitByPoint: Record<string, number> = {};

        // Generate Labels
        let labels: string[] = [];
        if (period === 'day' || period === 'yesterday') labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
        else if (period === 'year') labels = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
        else {
            const days = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const startD = new Date(startDate);
            labels = Array.from({ length: days + 1 }, (_, i) => {
                const d = new Date(startD);
                d.setDate(d.getDate() + i);
                return `${d.getDate()}`;
            });
        }
        labels.forEach(l => profitByPoint[l] = 0);

        const getKey = (date: Date) => {
            if (period === 'day' || period === 'yesterday') return `${date.getHours()}h`;
            if (period === 'year') return ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"][date.getMonth()];
            return `${date.getDate()}`;
        };

        validSales.forEach(sale => {
            const itemsCost = sale.items.reduce((sum, item) => {
                const p = productMap[item.productId];
                return sum + ((p?.costPrice || 0) + (p?.additionalCostPrice || 0)) * item.quantity;
            }, 0);
            const profit = (sale.subtotal - sale.discount) - itemsCost;
            totalProfit += profit;
            totalRevenue += sale.total;

            const key = getKey(new Date(sale.date));
            if (profitByPoint[key] !== undefined) profitByPoint[key] += profit;
        });

        const chartData = labels.map(l => ({ name: l, value: profitByPoint[l] }));
        return { totalProfit, totalRevenue, chartData };
    }, [sales, products, period]);

    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return (
        <div className={`p-6 bg-white/80 backdrop-blur-md rounded-3xl border border-gray-300/80 shadow-[0_8px_30px_rgba(123,97,255,0.15)] flex flex-col justify-between transition-all duration-300 h-full ${className || ''}`}>
            <div className="flex flex-row justify-between items-start mb-6 gap-4">
                <div className="flex items-center gap-4 w-full xl:w-auto">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm shrink-0">
                        <CurrencyDollarIcon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-[10px] sm:text-xs font-black text-secondary uppercase tracking-wider">Lucro Estimado</h3>
                        <p className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight mt-0.5 break-all line-clamp-2">{isPrivacyMode ? 'R$ ****' : formatCurrency(totalProfit)}</p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0 mt-1">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as any)}
                        className="text-[10px] font-black tracking-widest text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl hover:bg-gray-100 outline-none transition-all uppercase cursor-pointer"
                    >
                        <option value="day">Hoje</option>
                        <option value="yesterday">Ontem</option>
                        <option value="week">Semana</option>
                        <option value="month">Mês</option>
                        <option value="year">Ano</option>
                    </select>
                    {to && (
                        <button onClick={handleNavigate} className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-all active:scale-95 shadow-sm" title="Ver vendas">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 mt-4" style={{ minHeight: '100px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Tooltip
                            cursor={false}
                            content={<ProfitTooltip period={period} />}
                        />
                        <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-4 pt-3 border-t border-border">
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 to-green-50/50 p-3 border border-emerald-100/50 shadow-sm">
                    <div className="relative flex justify-between items-center z-10">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-600/80">
                            Margem de Lucro (% do Faturamento)
                        </span>
                        <span className="text-base font-bold text-emerald-700 tracking-tight">
                            {profitMargin.toFixed(1)}%
                        </span>
                    </div>
                    {/* Decorative element */}
                    <div className="absolute -right-2 -top-2 w-12 h-12 bg-emerald-100/50 rounded-full blur-lg" />
                </div>
            </div>
        </div>
    );
});

const SalesByDayCard: React.FC<{ sales: Sale[]; customers: Customer[]; products: Product[]; users: User[]; className?: string; isPrivacyMode?: boolean; to?: string; permissions?: PermissionSet | null; onDenied?: () => void }> = React.memo(({ sales, customers, products, users, className, isPrivacyMode, to, permissions, onDenied }) => {
    const navigate = useNavigate();
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

    const handleNavigate = () => {
        if (!to) return;
        if (permissions && !getPermissionForRoute(to, permissions)) { onDenied?.(); return; }
        navigate(to);
    };

    const productMap = useMemo(() => products.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
    }, {} as Record<string, Product>), [products]);

    const customerMap = useMemo(() => customers.reduce((acc, c) => {
        acc[c.id] = c.name;
        return acc;
    }, {} as Record<string, string>), [customers]);

    const todaysSalesList = useMemo(() => {
        const todayStr = new Date().toDateString();
        return sales.filter(s => new Date(s.date).toDateString() === todayStr && s.status !== 'Cancelada');
    }, [sales]);

    const todaysSummary = useMemo(() => {
        const total = todaysSalesList.reduce((sum, s) => sum + s.total, 0);
        const count = todaysSalesList.length;
        return { total, count };
    }, [todaysSalesList]);

    const getPaymentBadges = (sale: Sale) => {
        const methods = [...new Set(sale.payments.map(p => p.method))];
        return methods.slice(0, 2).map(m => {
            const colors: Record<string, string> = {
                'Pix': 'bg-green-100 text-green-700',
                'Dinheiro': 'bg-yellow-100 text-yellow-700',
                'Débito': 'bg-blue-100 text-blue-700',
                'Crédito': 'bg-purple-100 text-purple-700',
                'Aparelho na Troca': 'bg-orange-100 text-orange-700',
                'Crediário': 'bg-red-100 text-red-700',
            };
            return { method: m, color: colors[m] || 'bg-gray-100 text-gray-700' };
        });
    };

    return (
        <>
            <div
                className={`p-6 glass-card h-full flex flex-col group transition-all duration-300 ${to ? 'hover:shadow-[0_16px_40px_rgba(123,97,255,0.22)] hover:scale-[1.01] hover:-translate-y-0.5 cursor-pointer' : ''} ${className || ''}`}
                onClick={handleNavigate}
            >
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm">
                            <ClockIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-secondary uppercase tracking-wider">Vendas de Hoje</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-2xl font-black text-gray-800 tracking-tight">{isPrivacyMode ? 'R$ ****' : formatCurrency(todaysSummary.total)}</span>
                            </div>
                        </div>
                    </div>
                    {todaysSummary.count > 0 && (
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-bold border border-indigo-100">
                            {todaysSummary.count} {todaysSummary.count === 1 ? 'venda' : 'vendas'}
                        </span>
                    )}
                </div>
                {todaysSalesList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 text-center py-8">
                        <ShoppingCartIcon className="w-12 h-12 text-border" />
                        <p className="mt-2 font-semibold">Nenhuma venda ainda...</p>
                        <p className="text-sm text-muted">Aqui você verá suas vendas de hoje.</p>
                    </div>
                ) : (
                    <div className="overflow-y-auto flex-1 space-y-2 custom-scrollbar max-h-72 pr-1">
                        {todaysSalesList.map(sale => (
                            <div key={sale.id} className="p-3 bg-surface-secondary rounded-xl border border-border hover:border-accent transition-colors group/item relative">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-accent text-sm">#{sale.id}</span>
                                        <span className="text-xs text-muted bg-white px-2 py-0.5 rounded">
                                            {new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-primary text-lg">{isPrivacyMode ? 'R$ ****' : formatCurrency(sale.total)}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedSale(sale); }}
                                            className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-accent hover:border-accent transition-all opacity-0 group-hover/item:opacity-100"
                                            title="Ver detalhes"
                                        >
                                            <EyeIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col gap-1.5">
                                        <p className="text-xs text-primary font-medium truncate max-w-[150px] flex items-center gap-1.5" title={customerMap[sale.customerId]}>
                                            <UserIcon className="h-3.5 w-3.5 text-gray-400" />
                                            {customerMap[sale.customerId] || 'Cliente'}
                                        </p>
                                        <p className="text-xs text-muted flex items-center gap-1.5">
                                            <CubeIcon className="h-3.5 w-3.5 text-gray-400" />
                                            {isPrivacyMode ? '***' : sale.items.reduce((sum, i) => sum + i.quantity, 0)} {sale.items.length === 1 ? 'item' : 'itens'}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-1 justify-end">
                                        {getPaymentBadges(sale).map((badge, idx) => (
                                            <span key={idx} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${badge.color}`}>
                                                {badge.method}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {selectedSale && (
                <SaleDetailModal
                    sale={selectedSale}
                    productMap={productMap}
                    customers={customers}
                    users={users}
                    onClose={() => setSelectedSale(null)}
                />
            )}
        </>
    );
});

const BillingTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const formattedLabel = (() => {
            if (!label) return '';
            const lbl = label.toString();
            if (lbl.endsWith('h')) return `Hora: ${lbl}`;
            if (['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'].includes(lbl)) return `Mês: ${lbl}`;
            if (['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].includes(lbl)) return `Dia: ${lbl}`;
            if (/^\d{1,2}$/.test(lbl)) return `Dia: ${lbl}`;
            if (/^\d{4}$/.test(lbl)) return `Ano: ${lbl}`;
            return lbl;
        })();

        return (
            <div className="bg-white/95 backdrop-blur-md p-4 border border-border rounded-3xl shadow-2xl shadow-indigo-500/10 ring-1 ring-black/5 animate-fade-in">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2 flex items-center gap-2">
                    <ClockIcon className="w-3 h-3" /> {formattedLabel}
                </p>
                <div className="space-y-2.5">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-10">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.fill }}></div>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">{entry.name}</span>
                            </div>
                            <span className="text-xs font-black tracking-tight" style={{ color: entry.dataKey === 'lucro' ? '#10b981' : '#3b82f6' }}>
                                {formatCurrency(entry.value)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

const BillingChart: React.FC<{
    data: any[];
    period: string;
    onPeriodChange: (period: 'day' | 'week' | 'month' | 'year' | 'all_years') => void;
    className?: string;
    isPrivacyMode?: boolean;
    onNavigate?: () => void;
}> = React.memo(({ data, period, onPeriodChange, className, isPrivacyMode, onNavigate }) => {
    return (
        <div className={`p-6 glass-card h-full flex flex-col transition-all duration-300 ${className || ''}`}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shadow-sm">
                        <ChartBarIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-secondary uppercase tracking-wider">Faturamento x Lucro</h3>
                        <div className="flex gap-4 mt-1.5">
                            <div className="flex items-center gap-1.5 font-bold">
                                <div className="w-2.5 h-2.5 rounded-full bg-accent"></div>
                                <span className="text-[10px] text-muted uppercase">Faturamento</span>
                            </div>
                            <div className="flex items-center gap-1.5 font-bold">
                                <div className="w-2.5 h-2.5 rounded-full bg-success"></div>
                                <span className="text-[10px] text-muted uppercase">Lucro</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={period}
                        onChange={(e) => onPeriodChange(e.target.value as any)}
                        className="text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500/20 cursor-pointer outline-none transition-all"
                    >
                        <option value="day">Hoje</option>
                        <option value="week">Semana</option>
                        <option value="month">Mês</option>
                        <option value="year">Ano atual</option>
                        <option value="all_years">Anos</option>
                    </select>
                    {onNavigate && (
                        <button onClick={onNavigate} className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-all active:scale-95" title="Ver relatórios">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                        </button>
                    )}
                </div>
            </div>
            <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }} barGap={1} barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-muted)', fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} width={65} tick={{ fill: 'var(--color-muted)', fontSize: 10 }} tickFormatter={(value) => isPrivacyMode ? '****' : formatCurrency(value).replace(',00', '')} />
                        <Tooltip
                            cursor={{ fill: '#9ca3af', opacity: 0.1, radius: 8 }}
                            content={isPrivacyMode ? () => null : <BillingTooltip />}
                        />
                        <Bar dataKey="faturamento" name="Faturamento" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={period === 'day' ? 10 : 35} />
                        <Bar dataKey="lucro" name="Lucro" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={period === 'day' ? 10 : 35} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
});

const PaymentMethodTotalsCard: React.FC<{ sales: Sale[]; activeMethods: PaymentMethodParameter[]; className?: string; isPrivacyMode?: boolean; onNavigate?: () => void }> = React.memo(({ sales, activeMethods, className, isPrivacyMode, onNavigate }) => {
    const [period, setPeriod] = useState<'day' | 'yesterday' | 'week' | 'month' | 'year'>('day');

    const getColorForMethod = (method: string) => {
        const lower = method.toLowerCase();
        if (lower.includes('pix')) return { color: 'bg-green-500', lightColor: 'bg-green-100 text-green-700' };
        if (lower.includes('dinheiro') || lower.includes('espécie')) return { color: 'bg-yellow-500', lightColor: 'bg-yellow-100 text-yellow-700' };
        if (lower.includes('débito')) return { color: 'bg-blue-500', lightColor: 'bg-blue-100 text-blue-700' };
        if (lower.includes('crédito')) return { color: 'bg-purple-500', lightColor: 'bg-purple-100 text-purple-700' };
        if (lower.includes('troca')) return { color: 'bg-orange-500', lightColor: 'bg-orange-100 text-orange-700' };
        if (lower.includes('crediário')) return { color: 'bg-red-500', lightColor: 'bg-red-100 text-red-700' };

        const colors = [
            { color: 'bg-pink-500', lightColor: 'bg-pink-100 text-pink-700' },
            { color: 'bg-indigo-500', lightColor: 'bg-indigo-100 text-indigo-700' },
            { color: 'bg-teal-500', lightColor: 'bg-teal-100 text-teal-700' },
            { color: 'bg-cyan-500', lightColor: 'bg-cyan-100 text-cyan-700' },
            { color: 'bg-rose-500', lightColor: 'bg-rose-100 text-rose-700' },
            { color: 'bg-amber-500', lightColor: 'bg-amber-100 text-amber-700' },
        ];
        const hash = method.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        return colors[Math.abs(hash) % colors.length];
    };

    const allMethodNames = useMemo(() => {
        const configured = activeMethods.map(m => m.name);
        const systemMethods = ['Aparelho na Troca'];
        const all = new Set([...configured, ...systemMethods]);
        return Array.from(all);
    }, [activeMethods]);

    const paymentTotals = useMemo(() => {
        const now = new Date();
        let startDate = new Date();
        let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        switch (period) {
            case 'day':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                break;
            case 'yesterday':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
                break;
            case 'week':
                const dayOfWeek = now.getDay();
                startDate = new Date(now);
                startDate.setDate(now.getDate() - dayOfWeek);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
                endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
                break;
        }

        const filteredSales = sales.filter(sale => {
            const saleDate = new Date(sale.date);
            return sale.status !== 'Cancelada' && saleDate >= startDate && saleDate <= endDate;
        });

        const totals: Record<string, number> = {};
        allMethodNames.forEach(name => totals[name] = 0);

        filteredSales.forEach(sale => {
            sale.payments.forEach(payment => {
                let methodKey = payment.method;
                const normalizeMap: Record<string, string> = {
                    'Crédito': 'Cartão Crédito',
                    'Cartão de crédito': 'Cartão Crédito',
                    'Débito': 'Cartão de débito'
                };
                if (normalizeMap[methodKey] && allMethodNames.includes(normalizeMap[methodKey])) {
                    methodKey = normalizeMap[methodKey];
                }
                if (totals[methodKey] === undefined) totals[methodKey] = 0;
                totals[methodKey] += payment.value;
            });
        });
        return totals;
    }, [sales, period, allMethodNames]);

    const grandTotal = useMemo(() =>
        Object.values(paymentTotals).reduce((sum: number, val: number) => sum + val, 0)
        , [paymentTotals]);

    const renderedList = useMemo(() => {
        const keys = Object.keys(paymentTotals);
        return keys.sort((a, b) => {
            const valA = paymentTotals[a];
            const valB = paymentTotals[b];
            if (valA !== valB) return valB - valA;
            return a.localeCompare(b);
        }).map(key => ({
            key,
            label: key,
            value: paymentTotals[key],
            ...getColorForMethod(key)
        }));
    }, [paymentTotals]);

    return (
        <div className={`p-6 bg-white/80 backdrop-blur-md rounded-3xl border border-gray-300/80 shadow-[0_8px_30px_rgba(123,97,255,0.15)] flex flex-col h-full group transition-all duration-300 ${className || ''}`}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-50 text-orange-600 rounded-xl shadow-sm">
                        <CreditCardIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-secondary uppercase tracking-wider">Metódos de Pagto</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Resumo por período</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as any)}
                        className="text-[10px] font-black tracking-widest text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl hover:bg-gray-100 outline-none transition-all uppercase cursor-pointer"
                    >
                        <option value="day">Hoje</option>
                        <option value="yesterday">Ontem</option>
                        <option value="week">Semana</option>
                        <option value="month">Mês</option>
                        <option value="year">Ano</option>
                    </select>
                    {onNavigate && (
                        <button onClick={onNavigate} className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-600 transition-all active:scale-95" title="Ver vendas">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {renderedList.map(({ key, label, color, lightColor, value }) => {
                    const percentage = grandTotal > 0 ? (value / grandTotal) * 100 : 0;

                    return (
                        <div key={key} className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${color} shrink-0`}></div>
                            <div className="flex-grow">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-medium text-secondary">{label}</span>
                                    <span className="text-sm font-bold text-primary">{isPrivacyMode ? 'R$ ****' : formatCurrency(value)}</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${color} transition-all duration-500`}
                                        style={{ width: `${percentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
                <span className="text-sm font-bold text-muted uppercase">Total Geral</span>
                <span className="text-lg font-bold text-success">{isPrivacyMode ? 'R$ ****' : formatCurrency(grandTotal)}</span>
            </div>
        </div>
    );
});

interface SoldItemInfo {
    productName: string;
    quantity: number;
    saleDate: string;
    saleId: string;
    productId: string;
}

const RecentSoldProductsCard: React.FC<{ soldItems: SoldItemInfo[]; className?: string; isPrivacyMode?: boolean }> = React.memo(({ soldItems, className, isPrivacyMode }) => {
    return (

        <div className={`p-6 bg-white/80 backdrop-blur-md rounded-3xl border border-gray-300/80 shadow-[0_8px_30px_rgba(123,97,255,0.15)] flex flex-col h-full group hover:shadow-[0_16px_40px_rgba(123,97,255,0.22)] hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer ${className || ''}`}>
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shadow-sm">
                    <TagIcon className="h-6 w-6" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-secondary uppercase tracking-wider">Últimas Vendas</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Produtos vendidos recentemente</p>
                </div>
            </div>
            {soldItems.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">Nenhum produto vendido recentemente.</p>
            ) : (
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-sm">
                        <thead className="w-full">
                            <tr className="text-left text-muted text-[10px] uppercase tracking-wider">
                                <th className="font-bold pb-2">Produto</th>
                                <th className="font-bold pb-2 text-center">Qtd</th>
                                <th className="font-bold pb-2 text-right whitespace-nowrap">ID Venda</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {soldItems.map((item, index) => (
                                <tr key={`${item.saleId}-${item.productId}-${index}`} className="group hover:bg-gray-50/50 transition-colors">
                                    <td className="py-2.5">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800 truncate max-w-[280px]" title={item.productName}>{item.productName}</span>
                                            <div className="flex items-center gap-1 text-[8px] text-gray-400 font-bold mt-0.5">
                                                <span>{new Date(item.saleDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                                <span>•</span>
                                                <span>{new Date(item.saleDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2.5 text-center text-xs font-black text-primary">{isPrivacyMode ? '***' : item.quantity}</td>
                                    <td className="py-2.5 text-right text-[10px] font-bold text-gray-400 whitespace-nowrap">#{item.saleId.slice(-4).toUpperCase()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
});

const RecentAddedProductsCard: React.FC<{ products: Product[]; suppliers: Supplier[]; className?: string; isPrivacyMode?: boolean }> = React.memo(({ products, suppliers, className, isPrivacyMode }) => {
    const getSupplierName = (id: string) => {
        const supplier = suppliers.find(s => s.id === id);
        return supplier ? supplier.name : 'COMPRA';
    };

    return (

        <div className={`p-6 bg-white/80 backdrop-blur-md rounded-3xl border border-gray-300/80 shadow-[0_8px_30px_rgba(123,97,255,0.15)] flex flex-col h-full group hover:shadow-[0_16px_40px_rgba(123,97,255,0.22)] hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer ${className || ''}`}>
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm">
                    <PlusIcon className="h-6 w-6" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-secondary uppercase tracking-wider">Estoque Recente</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Últimos produtos adicionados</p>
                </div>
            </div>
            {products.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">Nenhum produto recente.</p>
            ) : (
                <div className="overflow-x-auto flex-1 -mx-2 px-2">
                    <table className="w-full text-sm">
                        <thead className="w-full">
                            <tr className="text-left text-muted text-[10px] uppercase tracking-wider">
                                <th className="font-bold pb-2 pl-1 w-auto">Produto</th>
                                <th className="font-bold pb-2 text-right pr-1 w-auto whitespace-nowrap">Custo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {products.map((product) => (
                                <tr key={product.id} className="group hover:bg-gray-50/50 transition-colors">
                                    <td className="py-2 pl-1 w-full">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800 text-xs sm:text-sm truncate max-w-[180px] xs:max-w-[280px] sm:max-w-[450px]" title={product.model}>{product.model}</span>
                                            {product.variations && product.variations.length > 0 && (
                                                <div className="text-[10px] italic text-gray-500 mt-0.5 truncate max-w-[180px] xs:max-w-[280px] sm:max-w-[450px]">
                                                    {product.variations.map(v => v.valueName ? `${v.gradeName}: ${v.valueName}` : v.gradeName).join(', ')}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {product.origin === 'Compra' ? (
                                                    <span className="text-[7px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold uppercase tracking-tight shadow-sm shrink-0 border border-orange-200/50">
                                                        {getSupplierName(product.supplierId || '')}
                                                    </span>
                                                ) : product.origin === 'Troca' ? (
                                                    <span className="text-[6px] px-1 py-0.5 rounded bg-rose-100 text-rose-700 font-black uppercase tracking-wide shadow-sm shrink-0">TROCA</span>
                                                ) : (
                                                    <span className="text-[6px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-black uppercase tracking-wide shadow-sm shrink-0">CLIENTE</span>
                                                )}
                                                <div className="flex items-center gap-1 text-[8px] text-gray-400 font-bold">
                                                    <span>{new Date(product.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                                    <span>•</span>
                                                    <span>{new Date(product.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2 text-right text-xs font-black text-primary whitespace-nowrap align-top sm:align-middle pr-1">
                                        {isPrivacyMode ? 'R$ ****' : formatCurrency(product.costPrice)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
});

const RecentTradeInProductsCard: React.FC<{ products: Product[]; className?: string; isPrivacyMode?: boolean }> = React.memo(({ products, className, isPrivacyMode }) => {
    return (

        <div className={`p-6 bg-white/80 backdrop-blur-md rounded-3xl border border-gray-300/80 shadow-[0_8px_30px_rgba(123,97,255,0.15)] flex flex-col h-full group hover:shadow-[0_16px_40px_rgba(123,97,255,0.22)] hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer ${className || ''}`}>
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shadow-sm">
                    <DeviceExchangeIcon className="h-6 w-6" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-secondary uppercase tracking-wider">Trocas Recentes</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Aparelhos recebidos na troca</p>
                </div>
            </div>
            {products.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">Nenhum aparelho Trade-in.</p>
            ) : (
                <div className="overflow-x-auto flex-1 -mx-2 px-2">
                    <table className="w-full text-sm">
                        <thead className="w-full">
                            <tr className="text-left text-muted text-[10px] uppercase tracking-wider">
                                <th className="font-bold pb-2 pl-1 w-auto">Aparelho</th>
                                <th className="font-bold pb-2 text-right pr-1 w-auto whitespace-nowrap">Custo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {products.map((product) => (
                                <tr key={product.id} className="group hover:bg-gray-50/50 transition-colors">
                                    <td className="py-2 pl-1 w-full">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800 text-xs sm:text-sm truncate max-w-[180px] xs:max-w-[280px] sm:max-w-[450px]" title={product.model}>{product.model}</span>
                                            {product.variations && product.variations.length > 0 && (
                                                <div className="text-[10px] italic text-gray-500 mt-0.5 truncate max-w-[180px] xs:max-w-[280px] sm:max-w-[450px]">
                                                    {product.variations.map(v => v.valueName ? `${v.gradeName}: ${v.valueName}` : v.gradeName).join(', ')}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[6px] px-1 py-0.5 rounded bg-rose-100 text-rose-700 font-black uppercase tracking-wide shadow-sm shrink-0">TROCA</span>
                                                <div className="flex items-center gap-1 text-[8px] text-gray-400 font-bold">
                                                    <span>{new Date(product.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                                    <span>•</span>
                                                    <span>{new Date(product.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2 text-right text-xs font-black text-primary whitespace-nowrap align-top sm:align-middle pr-1">
                                        {isPrivacyMode ? 'R$ ****' : formatCurrency(product.costPrice)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
});

const StockStatsCard: React.FC<{ products: Product[]; className?: string; isPrivacyMode?: boolean }> = React.memo(({ products, className, isPrivacyMode }) => {
    const stats = useMemo(() => {
        // Status field does not strictly exist on Product type, use stock > 0
        const appleProducts = products.filter(p => p.stock > 0 && p.brand?.toLowerCase().includes('apple'));
        const otherProducts = products.filter(p => p.stock > 0 && !p.brand?.toLowerCase().includes('apple'));

        const calculateMetrics = (items: Product[]) => {
            const count = items.reduce((acc, p) => acc + (p.stock || 1), 0);
            const cost = items.reduce((acc, p) => acc + ((p.costPrice || 0) + (p.additionalCostPrice || 0)) * (p.stock || 1), 0);
            const value = items.reduce((acc, p) => acc + p.price * (p.stock || 1), 0);
            const markup = cost > 0 ? ((value - cost) / cost) * 100 : 0;
            return { count, cost, value, markup };
        };

        const apple = calculateMetrics(appleProducts);
        const others = calculateMetrics(otherProducts);
        const total = {
            count: apple.count + others.count,
            cost: apple.cost + others.cost,
            value: apple.value + others.value,
        };
        const totalMarkup = total.cost > 0 ? ((total.value - total.cost) / total.cost) * 100 : 0;

        return { apple, others, total: { ...total, markup: totalMarkup } };
    }, [products]);

    return (
        <div className={`p-6 bg-white/80 backdrop-blur-md rounded-3xl border border-gray-300/80 shadow-[0_8px_30px_rgba(123,97,255,0.15)] group hover:shadow-[0_16px_40px_rgba(123,97,255,0.22)] hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer h-full ${className || ''}`}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shadow-sm">
                        <ArchiveBoxIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-secondary uppercase tracking-wider">Estoque</h3>
                        <p className="text-2xl font-black text-gray-800 tracking-tight mt-0.5">{isPrivacyMode ? '***' : stats.total.count}</p>
                    </div>
                </div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wide border border-blue-100 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                    Em Tempo Real
                </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Apple Column */}
                <div className="flex flex-col p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-300/80 shadow-sm relative overflow-hidden group">

                    <div className="flex items-center gap-2 mb-3 relative z-10">
                        <div className="w-6 h-6 flex items-center justify-center rounded-full overflow-hidden border border-gray-200 shadow-sm shrink-0 bg-white">
                            <img src="/AppleLog.png" alt="Apple" className="w-full h-full object-cover" />
                        </div>
                        <p className="font-bold text-sm text-gray-800">Apple</p>
                    </div>

                    <div className="relative z-10 flex flex-col flex-1">
                        <div className="text-center mb-4">
                            <p className="text-3xl font-black text-primary tracking-tight leading-none">{isPrivacyMode ? '***' : stats.apple.count}</p>
                            <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">Itens em Estoque</p>
                        </div>

                        <div className="space-y-2 text-xs mt-auto">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-medium">Custo:</span>
                                <span className="font-bold text-gray-800">{isPrivacyMode ? 'R$ ****' : formatCurrency(stats.apple.cost)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-medium">Venda:</span>
                                <span className="font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">{isPrivacyMode ? 'R$ ****' : formatCurrency(stats.apple.value)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-gray-300/80">
                                <span className="text-[10px] font-black text-gray-500 uppercase">Markup</span>
                                <span className="bg-white text-green-700 px-2 py-0.5 rounded-full shadow-sm border border-gray-100 text-[10px] font-black">{isPrivacyMode ? '**' : stats.apple.markup.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Others Column */}
                <div className="flex flex-col p-4 bg-white rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full border border-gray-200 text-gray-400">
                            <CubeIcon className="w-3.5 h-3.5" />
                        </div>
                        <p className="font-bold text-sm text-gray-800">Outros</p>
                    </div>

                    <div className="flex flex-col flex-1">
                        <div className="text-center mb-4">
                            <p className="text-3xl font-black text-primary tracking-tight leading-none">{isPrivacyMode ? '***' : stats.others.count}</p>
                            <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">Itens em Estoque</p>
                        </div>

                        <div className="space-y-2 text-xs mt-auto">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-medium">Custo:</span>
                                <span className="font-bold text-gray-800">{isPrivacyMode ? 'R$ ****' : formatCurrency(stats.others.cost)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-medium">Venda:</span>
                                <span className="font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">{isPrivacyMode ? 'R$ ****' : formatCurrency(stats.others.value)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                <span className="text-[10px] font-black text-gray-500 uppercase">Markup</span>
                                <span className="bg-gray-50 text-green-700 px-2 py-0.5 rounded-full border border-gray-100 text-[10px] font-black">{isPrivacyMode ? '**' : stats.others.markup.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Total Footer */}
            <div className="mt-5 pt-4 border-t border-border">
                <div className="flex items-end justify-between">
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                            <ChartBarIcon className="w-3 h-3" /> Total Geral Estimado
                        </p>
                        <div className="flex gap-3 text-xs text-gray-500">
                            <span>Custo: <strong className="text-gray-700">{isPrivacyMode ? 'R$ ****' : formatCurrency(stats.total.cost)}</strong></span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-primary leading-none">{isPrivacyMode ? 'R$ ****' : formatCurrency(stats.total.value)}</div>
                        <div className="flex justify-end mt-1">
                            <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                {isPrivacyMode ? '**' : `+${stats.total.markup.toFixed(2)}%`} Markup Médio
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

const CustomersStatsCard: React.FC<{ customers: Customer[]; sales: Sale[]; className?: string; isPrivacyMode?: boolean; onNavigate?: () => void }> = React.memo(({ customers, sales, className, isPrivacyMode, onNavigate }) => {
    const navigate = useNavigate();
    const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all_years'>('month');

    // Calculate chart data and metrics
    const { chartData, newCustomersCount, totalDebt } = useMemo(() => {
        const now = new Date();
        let startDate = new Date();
        let endDate = new Date();

        // 1. Determine date range
        switch (period) {
            case 'day':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                break;
            case 'week':
                const dayOfWeek = now.getDay();
                startDate.setDate(now.getDate() - dayOfWeek);
                startDate.setHours(0, 0, 0, 0);
                endDate.setDate(startDate.getDate() + 6);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
                endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
                break;
            case 'all_years':
                startDate = new Date(2000, 0, 1);
                endDate = new Date();
                break;
        }

        // 2. Filter new customers in period
        const newCustomers = customers.filter(c => {
            const dateStr = c.createdAt || c.created_at;
            if (!dateStr) return false;
            const date = new Date(dateStr);
            return date >= startDate && date <= endDate;
        });

        const newCustomersCount = newCustomers.length;

        // 3. Prepare Chart Data
        let chartData: { name: string; count: number }[] = [];

        if (period === 'year' || period === 'all_years') {
            const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
            const counts = new Array(12).fill(0);
            newCustomers.forEach(c => {
                const dateStr = c.createdAt || c.created_at;
                if (dateStr) {
                    const m = new Date(dateStr).getMonth();
                    counts[m]++;
                }
            });
            chartData = months.map((m, i) => ({ name: m, count: counts[i] }));
        } else {
            const map = new Map<number, number>();
            newCustomers.forEach(c => {
                const dateStr = c.createdAt || c.created_at;
                if (dateStr) {
                    const d = new Date(dateStr).getDate();
                    map.set(d, (map.get(d) || 0) + 1);
                }
            });

            if (period === 'day') {
                const byHour = new Array(24).fill(0);
                newCustomers.forEach(c => {
                    const dateStr = c.createdAt || c.created_at;
                    if (dateStr) byHour[new Date(dateStr).getHours()]++;
                });
                chartData = byHour.map((c, i) => ({ name: `${i}h`, count: c }));
            } else {
                const daysInMonth = endDate.getDate(); // Last day
                chartData = Array.from({ length: daysInMonth }, (_, i) => ({
                    name: `${i + 1}`,
                    count: map.get(i + 1) || 0
                }));
            }
        }

        const totalDebt = sales.reduce((acc, sale) => {
            if (sale.status === 'Cancelada') return acc;
            const pending = sale.payments.filter(p => p.type === 'pending').reduce((s, p) => s + p.value, 0);
            return acc + pending;
        }, 0);

        return { chartData, newCustomersCount, totalDebt };
    }, [customers, sales, period]);


    return (
        <div className={`p-6 bg-white/80 backdrop-blur-md rounded-3xl border border-gray-300/80 shadow-[0_8px_30px_rgba(123,97,255,0.15)] flex flex-col justify-between transition-all duration-300 h-full ${className || ''}`}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-xl shadow-sm">
                        <UsersIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-secondary uppercase tracking-wider">Clientes</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-2xl font-black text-gray-800 tracking-tight">{isPrivacyMode ? '***' : customers.length}</p>
                            {newCustomersCount > 0 && (
                                <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">
                                    +{isPrivacyMode ? '***' : newCustomersCount}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as any)}
                        className="text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 hover:bg-gray-100 focus:ring-2 focus:ring-purple-500/20 cursor-pointer outline-none transition-all"
                    >
                        <option value="day">Hoje</option>
                        <option value="week">Semana</option>
                        <option value="month">Mês</option>
                        <option value="year">Ano</option>
                    </select>
                    {onNavigate && (
                        <button onClick={onNavigate} className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 transition-all active:scale-95" title="Ver clientes">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-end">

                <div className="h-16 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorCustomers" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4ade80" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="count" stroke="#4ade80" fillOpacity={1} fill="url(#colorCustomers)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border cursor-pointer group" onClick={() => navigate('/customers?filter=debtors')}>
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-50 to-rose-50/50 p-3 border border-red-100/50 shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:bg-rose-50 group-active:scale-[0.99]">
                    <div className="relative flex justify-between items-center z-10">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-rose-600/80">
                            Valores a receber (Total)
                        </span>
                        <span className="text-base font-bold text-rose-700 tracking-tight">
                            {isPrivacyMode ? 'R$ ****' : formatCurrency(totalDebt)}
                        </span>
                    </div>
                    {/* Decorative element */}
                    <div className="absolute -right-2 -top-2 w-12 h-12 bg-red-100/50 rounded-full blur-lg" />
                </div>
            </div>
        </div>
    );
});

const Dashboard: React.FC = () => {
    const { user, permissions } = useUser();
    const navigate = useNavigate();
    const canViewDashboard = permissions?.canAccessDashboard;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethodParameter[]>([]);
    const [billingPeriod, setBillingPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all_years'>('year');
    const [isPrivacyMode, setIsPrivacyMode] = useState(() => {
        return localStorage.getItem('iStorePro_privacyMode') === 'true';
    });
    const [permissionToast, setPermissionToast] = useState<string | null>(null);

    useEffect(() => {
        localStorage.setItem('iStorePro_privacyMode', isPrivacyMode.toString());
    }, [isPrivacyMode]);

    useEffect(() => {
        if (permissionToast) {
            const timer = setTimeout(() => setPermissionToast(null), 3500);
            return () => clearTimeout(timer);
        }
    }, [permissionToast]);

    const handlePermissionDenied = useCallback(() => {
        setPermissionToast('Você não tem permissão para acessar esta seção.');
    }, []);

    const handleNavigateVendas = useCallback(() => {
        if (getPermissionForRoute('/vendas', permissions)) { navigate('/vendas'); } else { handlePermissionDenied(); }
    }, [permissions, navigate, handlePermissionDenied]);

    const handleNavigateReports = useCallback(() => {
        if (getPermissionForRoute('/reports', permissions)) { navigate('/reports?tab=vendas'); } else { handlePermissionDenied(); }
    }, [permissions, navigate, handlePermissionDenied]);



    const fetchData = useCallback(async (silent = false, retryCount = 0) => {
        if (!silent) setLoading(true);
        if (!silent) setError(null);

        // Helper: Fetches data, logs errors, but returns fallback instead of throwing
        const fetchItem = async <T,>(name: string, fetcher: (uid?: string) => Promise<T>, fallback: T): Promise<T> => {
            try {
                return await fetcher(user?.id);
            } catch (error: any) {
                console.warn(`Dashboard: Falha ao carregar ${name}. Usando fallback.`, error);
                return fallback;
            }
        };

        try {
            // Priority 1: Sales, Products & Customers (Core KPIs)
            // ROBUSTNESS: Only fetch last 365 days of sales for dashboard to keep it fast
            const oneYearAgo = new Date();
            oneYearAgo.setDate(oneYearAgo.getDate() - 365);
            const startDate = oneYearAgo.toISOString().split('T')[0];

            const [salesData, productsData, customersData, serviceOrdersData, servicesData, suppliersData] = await Promise.all([
                fetchItem('Sales', () => getSales(undefined, undefined, startDate), []),
                fetchItem('Products', () => getProducts(), []),
                fetchItem('Customers', () => getCustomers(false), []),
                fetchItem('ServiceOrders', () => getServiceOrders(), []),
                fetchItem('Services', () => getServices(), []),
                fetchItem('Suppliers', () => getSuppliers(), [])
            ]);

            setSales(salesData);
            setProducts(productsData);
            setCustomers(customersData);
            setServiceOrders(serviceOrdersData);
            setServices(servicesData);
            setSuppliers(suppliersData);

            // Priority 2: Configs
            fetchItem('ActiveMethods', getPaymentMethods, []).then(setPaymentMethods);
            fetchItem('Users', getUsers, []).then(setUsers);

        } catch (error: any) {
            console.error('Dashboard: Critical error fetching data:', error);
            if (retryCount < 2) {
                setTimeout(() => fetchData(silent, retryCount + 1), 2000);
                return;
            }
            if (!silent) setError(error.message || 'Falha ao carregar dados do dashboard.');
        } finally {
            if (!silent) setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (canViewDashboard) {
            fetchData();
        }

        // Smart Reload Listener
        const handleSmartReload = () => {
            fetchData(true);
        };
        window.addEventListener('app-reloadData', handleSmartReload);

        const channel = new BroadcastChannel('app_cache_sync');
        channel.onmessage = (event) => {
            if (event.data && event.data.type === 'CLEAR_CACHE') {
                const keys = event.data.keys || event.data.prefixes;
                if (keys && Array.isArray(keys) && keys.some((k: string) => ['sales', 'products', 'customers'].some(type => k.includes(type)))) {
                    fetchData(true);
                }
            }
        };

        return () => {
            window.removeEventListener('app-reloadData', handleSmartReload);
            channel.close();
        };

    }, [fetchData, canViewDashboard]);

    const dashboardMetrics = React.useMemo(() => {
        const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
        const stockCost = products.reduce((acc, p) => acc + ((p.costPrice || 0) + (p.additionalCostPrice || 0)) * p.stock, 0);
        const stockValue = products.reduce((acc, p) => acc + p.price * p.stock, 0);
        const markup = stockCost > 0 ? ((stockValue - stockCost) / stockCost) * 100 : 0;
        const customerCount = customers.length;
        const tradeInCount = products.filter(p => p.origin === 'Troca' && p.stock > 0).reduce((acc, p) => acc + p.stock, 0);

        const now = new Date();
        let billingChartData: { name: string; faturamento: number; lucro: number }[] = [];
        const relevantSales = sales.filter(s => s.status !== 'Cancelada');

        const productMapData = products.reduce((acc, p) => {
            acc[p.id] = p;
            return acc;
        }, {} as Record<string, Product>);

        const calculateProfit = (sale: Sale) => {
            const cost = (sale.items || []).reduce((sum, item) => {
                const p = productMapData[item.productId];
                return sum + ((p?.costPrice || 0) + (p?.additionalCostPrice || 0)) * item.quantity;
            }, 0);
            return (sale.subtotal - sale.discount) - cost;
        };

        if (billingPeriod === 'year') {
            const dataMap = relevantSales
                .filter(sale => new Date(sale.date).getFullYear() === now.getFullYear())
                .reduce((acc, sale) => {
                    const m = new Date(sale.date).getMonth();
                    acc[m] = acc[m] || { billing: 0, profit: 0 };
                    acc[m].billing += sale.total;
                    acc[m].profit += calculateProfit(sale);
                    return acc;
                }, {} as Record<number, { billing: number; profit: number }>);

            const monthNames = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
            billingChartData = monthNames.map((name, i) => ({ name, faturamento: dataMap[i]?.billing || 0, lucro: dataMap[i]?.profit || 0 }));
        } else if (billingPeriod === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const daysInMonth = endOfMonth.getDate();
            const dataMap = relevantSales
                .filter(s => { const d = new Date(s.date); return d >= startOfMonth && d <= endOfMonth; })
                .reduce((acc, sale) => {
                    const day = new Date(sale.date).getDate();
                    acc[day] = acc[day] || { billing: 0, profit: 0 };
                    acc[day].billing += sale.total;
                    acc[day].profit += calculateProfit(sale);
                    return acc;
                }, {} as Record<number, { billing: number; profit: number }>);
            billingChartData = Array.from({ length: daysInMonth }, (_, i) => ({
                name: (i + 1).toString().padStart(2, '0'),
                faturamento: dataMap[i + 1]?.billing || 0,
                lucro: dataMap[i + 1]?.profit || 0
            }));
        } else if (billingPeriod === 'week') {
            const dayOfWeek = now.getDay();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - dayOfWeek);
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            const dataMap = relevantSales
                .filter(s => { const d = new Date(s.date); return d >= startOfWeek && d <= endOfWeek; })
                .reduce((acc, sale) => {
                    const day = new Date(sale.date).getDay();
                    acc[day] = acc[day] || { billing: 0, profit: 0 };
                    acc[day].billing += sale.total;
                    acc[day].profit += calculateProfit(sale);
                    return acc;
                }, {} as Record<number, { billing: number; profit: number }>);
            const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            billingChartData = weekDays.map((name, i) => ({ name, faturamento: dataMap[i]?.billing || 0, lucro: dataMap[i]?.profit || 0 }));
        } else if (billingPeriod === 'day') {
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const dataMap = relevantSales
                .filter(s => new Date(s.date) >= startOfDay)
                .reduce((acc, sale) => {
                    const hour = new Date(sale.date).getHours();
                    acc[hour] = acc[hour] || { billing: 0, profit: 0 };
                    acc[hour].billing += sale.total;
                    acc[hour].profit += calculateProfit(sale);
                    return acc;
                }, {} as Record<number, { billing: number; profit: number }>);
            billingChartData = Array.from({ length: 24 }, (_, i) => ({
                name: `${i.toString().padStart(2, '0')}h`,
                faturamento: dataMap[i]?.billing || 0,
                lucro: dataMap[i]?.profit || 0
            }));
        } else if (billingPeriod === 'all_years') {
            const dataMap = relevantSales.reduce((acc, sale) => {
                const year = new Date(sale.date).getFullYear();
                acc[year] = acc[year] || { billing: 0, profit: 0 };
                acc[year].billing += sale.total;
                acc[year].profit += calculateProfit(sale);
                return acc;
            }, {} as Record<number, { billing: number; profit: number }>);
            const years = Array.from(new Set(relevantSales.map(s => new Date(s.date).getFullYear()))).sort((a: number, b: number) => a - b);
            if (years.length === 0) years.push(now.getFullYear());
            billingChartData = years.map(year => ({ name: year.toString(), faturamento: dataMap[year]?.billing || 0, lucro: dataMap[year]?.profit || 0 }));
        }

        const totalFaturamento = relevantSales.reduce((acc, s) => acc + s.total, 0);
        const totalLucro = relevantSales.reduce((acc, s) => acc + calculateProfit(s), 0);

        return { totalStock, stockCost, stockValue, markup, customerCount, tradeInCount, totalFaturamento, totalLucro, billingChartData };
    }, [products, customers, sales, billingPeriod]);

    const { recentSales, recentSoldItems, recentAddedProducts, recentTradeInProducts } = React.useMemo(() => {
        // Filter out Cancelled and Pending sales to show only finalized/effective sales in "Recent Sold Products"
        const sortedSales = [...sales]
            .filter(s => s.status !== 'Cancelada' && s.status !== 'Pendente')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const recentSales = sortedSales.slice(0, 5);

        const productMap = products.reduce((acc, p) => {
            acc[p.id] = p.model;
            return acc;
        }, {} as Record<string, string>);

        const recentSoldItems: SoldItemInfo[] = sortedSales
            .flatMap(sale => sale.items.map(item => ({
                productName: productMap[item.productId] || 'Desconhecido',
                quantity: item.quantity,
                saleDate: sale.date,
                saleId: sale.id,
                productId: item.productId,
            })))
            .slice(0, 5);

        const sortedProducts = [...products].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const recentAddedProducts = sortedProducts.slice(0, 5);
        const recentTradeInProducts = sortedProducts.filter(p => p.origin === 'Troca').slice(0, 5);

        return { recentSales, recentSoldItems, recentAddedProducts, recentTradeInProducts };
    }, [sales, products]);

    const lowStockCount = useMemo(() => {
        const groupedMap = new Map<string, Product>();
        const finalResults: Product[] = [];

        products.forEach(p => {
            const isUnique = !!((p.serialNumber || '').trim() || (p.imei1 || '').trim() || (p.imei2 || '').trim());
            const hasVariations = p.variations && p.variations.length > 0;

            if (isUnique || hasVariations) {
                finalResults.push(p);
            } else {
                const key = `${p.model}|${p.brand}|${p.color}|${p.storage}|${p.condition}|${p.warranty}|${p.price}-${p.costPrice || 0}-${p.wholesalePrice || 0}|${p.supplierId}|${p.storageLocation}`;
                const existing = groupedMap.get(key);
                if (!existing) groupedMap.set(key, { ...p });
                else existing.stock += p.stock;
            }
        });

        const combinedList = [...finalResults, ...Array.from(groupedMap.values())];

        return combinedList.filter(p => {
            const isUnique = !!((p.serialNumber || '').trim() || (p.imei1 || '').trim() || (p.imei2 || '').trim());
            return !isUnique && p.stock > 0 && p.minimumStock !== undefined && p.stock <= p.minimumStock;
        }).length;
    }, [products]);

    const financialDiscrepancyCount = React.useMemo(() => {
        return sales.filter(s => s.status === 'Finalizada').filter(s => {
            const totalPaid = s.payments.reduce((acc, p) => acc + p.value, 0);
            return s.total > totalPaid + 0.01;
        }).length;
    }, [sales]);


    if (loading) return <SuspenseFallback fullScreen />;
    if (error) return (
        <div className="flex flex-col items-center justify-center h-full gap-4 py-10">
            <p className="text-center text-danger">{error}</p>
            <button
                onClick={() => fetchData()}
                className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
                Tentar Novamente
            </button>
        </div>
    );


    return (
        <div className="space-y-6">

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-primary">Dashboard</h1>
                        <div className="relative group">
                            <button
                                onClick={() => setIsPrivacyMode(!isPrivacyMode)}
                                className={`p-2 rounded-xl transition-all duration-300 shadow-sm border ${isPrivacyMode ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'}`}
                            >
                                {isPrivacyMode ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                            </button>
                            {/* Modern Tooltip/Legend */}
                            <div className="absolute left-0 bottom-full mb-3 hidden group-hover:block transition-all duration-300 z-[100]">
                                <div className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl shadow-2xl whitespace-nowrap animate-slide-up relative underline-offset-4 decoration-indigo-400">
                                    {isPrivacyMode ? 'Mostrar valores sensíveis' : 'Ocultar valores e estoque'}
                                    {/* Tooltip Arrow */}
                                    <div className="absolute top-full left-4 border-8 border-transparent border-t-gray-900"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    {lowStockCount > 0 && <LowStockBanner count={lowStockCount} isPrivacyMode={isPrivacyMode} />}
                    {financialDiscrepancyCount > 0 && <FinancialDiscrepancyBanner count={financialDiscrepancyCount} isPrivacyMode={isPrivacyMode} />}
                    <InfoBanner />
                </div>
            </div>

            <div className="grid gap-4 sm:gap-6 grid-cols-[repeat(auto-fit,minmax(260px,1fr))] auto-rows-fr">
                <ProfitCard sales={sales} products={products} isPrivacyMode={isPrivacyMode} to="/vendas" permissions={permissions} onDenied={handlePermissionDenied} />
                <ServiceOrderProfitCard
                    serviceOrders={serviceOrders}
                    services={services}
                    products={products}
                    isPrivacyMode={isPrivacyMode}
                    to="/service-orders/financial"
                />
                <ProtectedLink to="/products" className="block h-full md:col-span-2" permissions={permissions} onDenied={handlePermissionDenied}>
                    <StockStatsCard products={products} isPrivacyMode={isPrivacyMode} />
                </ProtectedLink>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                    <CustomersStatsCard
                        customers={customers}
                        sales={sales}
                        isPrivacyMode={isPrivacyMode}
                        onNavigate={() => {
                            if (getPermissionForRoute('/customers', permissions)) { navigate('/customers'); } else { handlePermissionDenied(); }
                        }}
                    />
                </div>
                <OpenServiceOrdersCard serviceOrders={serviceOrders} isPrivacyMode={isPrivacyMode} to="/service-orders/list" />
                <ProtectedLink to="/products?filter=low_stock" className="block h-full" permissions={permissions} onDenied={handlePermissionDenied}>
                    <LowStockBulkProductsCard products={products} isPrivacyMode={isPrivacyMode} to="/products?filter=low_stock" />
                </ProtectedLink>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <SalesByDayCard
                        sales={sales}
                        customers={customers}
                        products={products}
                        users={users}
                        isPrivacyMode={isPrivacyMode}
                        to="/vendas?period=hoje"
                        permissions={permissions}
                        onDenied={handlePermissionDenied}
                    />
                </div>
                <div className="lg:col-span-2 min-h-[400px]">
                    <BillingChart data={dashboardMetrics.billingChartData} period={billingPeriod} onPeriodChange={setBillingPeriod} isPrivacyMode={isPrivacyMode} onNavigate={handleNavigateReports} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <ProtectedLink to="/products" className="block h-full" permissions={permissions} onDenied={handlePermissionDenied}><RecentAddedProductsCard products={recentAddedProducts} suppliers={suppliers} isPrivacyMode={isPrivacyMode} /></ProtectedLink>
                <ProtectedLink to="/products?type=troca" className="block h-full" permissions={permissions} onDenied={handlePermissionDenied}><RecentTradeInProductsCard products={recentTradeInProducts} isPrivacyMode={isPrivacyMode} /></ProtectedLink>
                <PaymentMethodTotalsCard sales={sales} activeMethods={paymentMethods} isPrivacyMode={isPrivacyMode} onNavigate={handleNavigateVendas} />
                <ProtectedLink to="/vendas" className="block h-full" permissions={permissions} onDenied={handlePermissionDenied}><RecentSoldProductsCard soldItems={recentSoldItems} isPrivacyMode={isPrivacyMode} /></ProtectedLink>
            </div>
            {/* Permission Denied Toast */}
            {permissionToast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-slide-up">
                    <div className="flex items-center gap-3 bg-red-600 text-white px-5 py-3 rounded-2xl shadow-2xl shadow-red-500/30 border border-red-500">
                        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        <span className="text-sm font-bold">{permissionToast}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
