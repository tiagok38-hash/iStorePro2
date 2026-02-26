import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';
import { Sale, Product, Customer, User, ProductModel } from '../types.ts';
import { getSales, getProducts, getCustomers, getUsers, formatCurrency, getProductModels } from '../services/mockApi.ts';
import { SpinnerIcon, CalendarDaysIcon, TrophyIcon, SearchIcon, ClockIcon, DocumentTextIcon, CurrencyDollarIcon, TrendingUpIcon, ShoppingCartIcon, BanknotesIcon, PackageIcon, WalletIcon, AppleIcon, Squares2x2Icon } from '../components/icons.tsx';
import CustomDatePicker from '../components/CustomDatePicker.tsx';
import PriceListModal from '../components/PriceListModal.tsx';
import { toDateValue } from '../utils/dateUtils.ts';
import SalesReports from '../components/SalesReports.tsx';

const PremiumKpiCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: 'blue' | 'emerald' | 'purple' | 'orange' | 'indigo' | 'red';
    subtitle?: React.ReactNode;
    onClick?: () => void;
}> = ({ title, value, icon, color, subtitle, onClick }) => {
    const colorConfigs = {
        blue: { bg: 'from-blue-600/10 to-blue-600/5', border: 'border-blue-100', text: 'text-blue-600', iconBg: 'bg-blue-600', shadow: 'shadow-blue-500/20' },
        emerald: { bg: 'from-emerald-600/10 to-emerald-600/5', border: 'border-emerald-100', text: 'text-emerald-600', iconBg: 'bg-emerald-600', shadow: 'shadow-emerald-500/20' },
        purple: { bg: 'from-purple-600/10 to-purple-600/5', border: 'border-purple-100', text: 'text-purple-600', iconBg: 'bg-purple-600', shadow: 'shadow-purple-500/20' },
        orange: { bg: 'from-orange-600/10 to-orange-600/5', border: 'border-orange-100', text: 'text-orange-600', iconBg: 'bg-orange-600', shadow: 'shadow-orange-500/20' },
        indigo: { bg: 'from-indigo-600/10 to-indigo-600/5', border: 'border-indigo-100', text: 'text-indigo-600', iconBg: 'bg-indigo-600', shadow: 'shadow-indigo-500/20' },
        red: { bg: 'from-red-600/10 to-red-600/5', border: 'border-red-100', text: 'text-red-600', iconBg: 'bg-red-600', shadow: 'shadow-red-500/20' },
    };

    const config = colorConfigs[color];

    return (
        <div className={`relative overflow-hidden group rounded-[2rem] h-full ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
            <div className={`absolute inset-0 bg-gradient-to-br ${config.bg} group-hover:scale-110 transition-transform duration-500`}></div>
            <div className={`relative bg-white/40 backdrop-blur-md border ${config.border} p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all h-full`}>
                <div className={`${config.iconBg} w-10 h-10 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${config.shadow}`}>
                    <div className="text-white">
                        {React.cloneElement(icon as React.ReactElement, { size: 20 })}
                    </div>
                </div>
                <h3 className={`text-xs font-bold ${config.text} uppercase tracking-wider`}>{title}</h3>
                <p className="text-2xl font-black text-gray-900 mt-1 tracking-tight">{value}</p>
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

const VendasReport: React.FC<{ sales: Sale[], products: Product[], customers: Customer[], users: User[] }> = ({ sales, products, customers, users }) => {
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return toDateValue(new Date(d.getFullYear(), d.getMonth(), 1));
    });
    const [endDate, setEndDate] = useState(toDateValue());
    const [sellerFilter, setSellerFilter] = useState('todos');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

    const userMap = useMemo(() => users.reduce((acc, user) => ({ ...acc, [user.id]: user.name }), {} as Record<string, string>), [users]);
    const customerMap = useMemo(() => customers.reduce((acc, customer) => ({ ...acc, [customer.id]: customer.name }), {} as Record<string, string>), [customers]);
    const productMap = useMemo(() => products.reduce((acc: Record<string, Product>, p) => {
        acc[p.id] = p;
        return acc;
    }, {} as Record<string, Product>), [products]);

    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            const saleDate = new Date(sale.date);

            // Construct dates explicitly to avoid timezone issues with string parsing
            const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
            const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);

            const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
            const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

            const dateMatch = saleDate >= start && saleDate <= end;
            const sellerMatch = sellerFilter === 'todos' || sale.salespersonId === sellerFilter;
            // Alinhar com Financeiro: Considerar apenas "Finalizada"
            const statusMatch = sale.status === 'Finalizada';

            return dateMatch && sellerMatch && statusMatch;
        });
    }, [sales, startDate, endDate, sellerFilter]);

    const { totalSales, totalProfit, salesCount, avgTicket, winnerCategory } = useMemo(() => {
        let totalFaturamento = 0;
        let totalRevenueForProfit = 0;
        let totalCost = 0;

        let appleStats = { faturamento: 0, lucro: 0 };
        let otherStats = { faturamento: 0, lucro: 0 };

        filteredSales.forEach(sale => {
            totalFaturamento += sale.total;
            totalRevenueForProfit += sale.total;

            let saleCost = 0;
            const saleSubtotal = sale.subtotal || 1;

            sale.items.forEach(item => {
                const product = productMap[item.productId];
                const itemCost = ((product?.costPrice || 0) + (product?.additionalCostPrice || 0)) * item.quantity;
                const itemGrossRevenue = item.unitPrice * item.quantity;

                // Calculate item net revenue
                const itemNetRevenue = item.netTotal ?? itemGrossRevenue;
                const itemProfit = itemNetRevenue - itemCost;

                if ((product?.brand || '').toLowerCase().includes('apple')) {
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

        const salesCount = filteredSales.length;
        const totalProfitOverall = totalRevenueForProfit - totalCost;
        const avgTicket = salesCount > 0 ? totalFaturamento / salesCount : 0;

        // Find winner based on net revenue
        const winner = appleStats.faturamento >= otherStats.faturamento ? 'Apple' : 'Não Apple';
        const winnerData = appleStats.faturamento >= otherStats.faturamento ? appleStats : otherStats;

        return {
            totalSales: totalFaturamento,
            totalProfit: totalProfitOverall,
            salesCount,
            avgTicket,
            winnerCategory: {
                name: winner,
                faturamento: winnerData.faturamento,
                lucro: winnerData.lucro
            }
        };
    }, [filteredSales, productMap]);

    const salesByDayData = useMemo(() => {
        const salesByDay = filteredSales.reduce<Record<string, { faturamento: number; lucro: number; vendas: number }>>((acc, sale) => {
            const day = new Date(sale.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            if (!acc[day]) {
                acc[day] = { faturamento: 0, lucro: 0, vendas: 0 };
            }
            const saleCost = sale.items.reduce((cost, item) => {
                const product = productMap[item.productId];
                return cost + ((product?.costPrice || 0) + (product?.additionalCostPrice || 0)) * item.quantity;
            }, 0);
            const revenue = sale.total;

            acc[day].faturamento += sale.total;
            acc[day].lucro += revenue - saleCost;
            acc[day].vendas += 1;
            return acc;
        }, {});

        return Object.entries(salesByDay).map(([name, data]) => ({ name, ...(data as any) }))
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
        const productSales = filteredSales.flatMap(s => s.items).reduce<Record<string, { name: string; revenue: number }>>((acc, item) => {
            if (!acc[item.productId]) {
                // Truncate long names for better chart display if needed, but keeping full here
                acc[item.productId] = { name: productMap[item.productId]?.model || 'Desconhecido', revenue: 0 };
            }
            acc[item.productId].revenue += item.quantity * item.unitPrice;
            return acc;
        }, {});
        return Object.values(productSales).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 10);
    }, [filteredSales, productMap]);

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <PremiumKpiCard
                    title="Faturamento Total"
                    value={formatCurrency(totalSales)}
                    icon={<CurrencyDollarIcon />}
                    color="blue"
                />
                <PremiumKpiCard
                    title="Lucro Líquido"
                    value={formatCurrency(totalProfit)}
                    icon={<TrendingUpIcon />}
                    color={totalProfit >= 0 ? "emerald" : "red"}
                />
                <PremiumKpiCard
                    title="Vendas Realizadas"
                    value={salesCount}
                    icon={<ShoppingCartIcon />}
                    color="purple"
                />
                <PremiumKpiCard
                    title="Ticket Médio"
                    value={formatCurrency(avgTicket)}
                    icon={<BanknotesIcon />}
                    color="orange"
                />
                <PremiumKpiCard
                    title="Categoria Vencedora"
                    value={winnerCategory.name}
                    icon={<TrophyIcon />}
                    color="indigo"
                    subtitle={
                        <div className="space-y-0.5">
                            <div className="flex justify-between text-[10px]">
                                <span className="text-indigo-600 font-bold uppercase">Faturamento</span>
                                <span className="text-indigo-900 font-black">{formatCurrency(winnerCategory.faturamento)}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-indigo-600 font-bold uppercase">Lucro</span>
                                <span className="text-emerald-700 font-black">{formatCurrency(winnerCategory.lucro)}</span>
                            </div>
                        </div>
                    }
                />
            </div>

            <div className="bg-white border border-gray-100 rounded-[2rem] p-4 flex flex-wrap items-end gap-6 shadow-sm">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">De</label>
                    <CustomDatePicker
                        value={startDate}
                        onChange={setStartDate}
                        max={toDateValue()}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Até</label>
                    <CustomDatePicker
                        value={endDate}
                        onChange={setEndDate}
                        max={toDateValue()}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Vendedor</label>
                    <select
                        value={sellerFilter}
                        onChange={(e) => setSellerFilter(e.target.value)}
                        className="h-11 px-6 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500 outline-none focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                    >
                        <option value="todos">Todos os Vendedores</option>
                        {users.filter(u => u.active !== false).map(user => (
                            <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm flex flex-col">
                <h3 className="font-black text-gray-900 mb-6 flex items-center gap-3 text-lg uppercase tracking-tight">
                    <span className="w-2 h-8 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full"></span>
                    Evolução Diária
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={salesByDayData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barGap={0}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                        />
                        <YAxis
                            tickFormatter={(value) => new Intl.NumberFormat('pt-BR', { notation: "compact", compactDisplay: "short" }).format(value)}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                        <Bar dataKey="faturamento" fill={COLORS.primary} name="Faturamento" radius={[4, 4, 0, 0]} maxBarSize={50} />
                        <Bar dataKey="lucro" fill={COLORS.success} name="Lucro" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                </ResponsiveContainer>
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
                    <h3 className="font-black text-gray-900 mb-6 flex items-center gap-3 text-lg uppercase tracking-tight">
                        <span className="w-2 h-8 bg-gradient-to-b from-orange-400 to-orange-600 rounded-full"></span>
                        Top 10 Produtos
                    </h3>
                    <div className="space-y-4 mt-2">
                        {(() => {
                            const maxRevenue = Math.max(...topSellingProducts.map(p => p.revenue), 1);
                            return topSellingProducts.map((product, index) => (
                                <div key={index} className="flex items-center gap-3 group">
                                    <div className="w-[180px] shrink-0">
                                        <p className="text-[11px] font-bold text-gray-900 leading-tight group-hover:text-primary transition-colors">
                                            {product.name}
                                        </p>
                                    </div>
                                    <div className="flex-1 flex items-center gap-3">
                                        <div className="relative flex-1 h-6 bg-gray-50 rounded-lg overflow-hidden border border-gray-100/50">
                                            <div
                                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-purple-600 rounded-r-md shadow-sm group-hover:from-purple-600 group-hover:to-purple-700 transition-all duration-500"
                                                style={{ width: `${(product.revenue / maxRevenue) * 100}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs font-black text-gray-900 shrink-0 min-w-[90px] text-right">
                                            {formatCurrency(product.revenue)}
                                        </span>
                                    </div>
                                </div>
                            ));
                        })()}
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
                                    return cost + ((product?.costPrice || 0) + (product?.additionalCostPrice || 0)) * item.quantity;
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
                    <div className="flex items-center justify-between mt-8 border-t border-gray-100 pt-6">
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

const EstoqueReport: React.FC<{ products: Product[], sales: Sale[], initialFilter: string | null }> = ({ products, sales, initialFilter }) => {
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
            const createdAt = p.createdAt ? new Date(p.createdAt) : new Date();
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

            return [...finalFiltered, ...Object.values(groupedMap)];
        }

        return filtered;
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
            const createdAt = p.createdAt ? new Date(p.createdAt) : new Date();
            const age = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
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
        const productCounts: Record<string, number> = {};
        sales.forEach(sale => {
            if (sale.status === 'Cancelada') return;
            sale.items.forEach(item => {
                productCounts[item.productId] = (productCounts[item.productId] || 0) + item.quantity;
            });
        });

        // Map counts to product names and sort
        return Object.entries(productCounts)
            .map(([id, count]) => {
                const product = products.find(p => p.id === id);
                return { name: product?.model || 'Desconhecido', value: count };
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
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
                    <div className="flex items-center gap-3">
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
                                                {product.batteryHealth !== undefined && product.batteryHealth > 0 && (product.brand || '').toLowerCase().includes('apple') && (
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
                                                        SN: {product.serialNumber}
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
                                    {stockFilter === 'parado' && (
                                        <td className="px-6 py-4 bg-gray-50/30 text-center border-y border-transparent group-hover:border-gray-100">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-gray-500 font-medium">
                                                    {product.createdAt ? new Date(product.createdAt).toLocaleDateString('pt-BR') : '-'}
                                                </span>
                                                <span className="mt-0.5 px-2 py-0.5 rounded-xl bg-red-100 text-red-700 text-[10px] font-black border border-red-200">
                                                    {Math.floor((Date.now() - (product.createdAt ? new Date(product.createdAt).getTime() : Date.now())) / (1000 * 60 * 60 * 24))} DIAS
                                                </span>
                                            </div>
                                        </td>
                                    )}
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
                    <div className="flex items-center justify-between mt-4 border-t pt-4">
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
                            <BarChart data={topSellingData} layout="vertical" margin={{ top: 5, right: 40, left: 30, bottom: 5 }} barSize={24}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={260} tick={{ fontSize: 11, fontWeight: 700, fill: '#1f2937' }} axisLine={false} tickLine={false} />
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
                            <BarChart data={highMarginData} layout="vertical" margin={{ top: 5, right: 45, left: 30, bottom: 5 }} barSize={24}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={260} tick={{ fontSize: 11, fontWeight: 700, fill: '#1f2937' }} axisLine={false} tickLine={false} />
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
                const [salesData, productsData, customersData, usersData, modelsData] = await Promise.all([
                    getSales(),
                    getProducts(),
                    getCustomers(false),
                    getUsers(),
                    getProductModels()
                ]);
                setSales(salesData);
                setProducts(productsData);
                setCustomers(customersData);
                setUsers(usersData);
                setProductModels(modelsData);
            } catch (error) {
                console.error("Failed to fetch report data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">Relatórios</h1>
                {activeTab === 'estoque' && (
                    <button
                        onClick={() => setIsPriceListModalOpen(true)}
                        className="h-12 px-6 bg-gradient-to-br from-[#9c89ff] to-[#7B61FF] text-white rounded-2xl hover:opacity-95 text-xs font-black flex items-center gap-3 shadow-lg shadow-indigo-500/20 uppercase tracking-widest transition-all active:scale-95 border border-white/20 whitespace-nowrap"
                    >
                        <DocumentTextIcon className="h-6 w-6" /> Gerar Relatório
                    </button>
                )}
            </div>

            <div className="inline-flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-sm">
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
                    {activeTab === 'vendas' && <VendasReport sales={sales} products={products} customers={customers} users={users} />}
                    {activeTab === 'sales_reports' && <SalesReports sales={sales} products={products} customers={customers} users={users} productModels={productModels} />}
                    {activeTab === 'estoque' && <EstoqueReport products={products} sales={sales} initialFilter={searchParams.get('filter')} />}
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