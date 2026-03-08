
import React, { useState, useMemo } from 'react';
import { Sale, Product, Customer, User } from '../types';
import { formatCurrency } from '../services/mockApi';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import CustomDatePicker from './CustomDatePicker';
import { DocumentArrowUpIcon, SearchIcon } from './icons';

interface SalesReportsProps {
    sales: Sale[];
    products: Product[];
    customers: Customer[];
    users: User[];
    productModels: ProductModel[];
}

import { ProductModel } from '../types';

const COLORS = {
    primary: '#3b82f6',
    success: '#10b981',
    purple: '#8b5cf6',
    orange: '#f97316',
    pink: '#ec4899',
    cyan: '#06b6d4',
    slate: '#64748b',
    red: '#ef4444'
};

const PIE_COLORS = [COLORS.primary, COLORS.success, COLORS.orange, COLORS.purple, COLORS.pink, COLORS.cyan, COLORS.slate];

const SalesReports: React.FC<SalesReportsProps> = ({ sales, products, customers, users, productModels }) => {
    // 1. Filters
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [sellerId, setSellerId] = useState('todos');

    // Pagination for Model Analysis
    const [modelCurrentPage, setModelCurrentPage] = useState(1);
    const [modelItemsPerPage, setModelItemsPerPage] = useState(15);

    // Pagination for Cancelled Sales
    const [cancelCurrentPage, setCancelCurrentPage] = useState(1);
    const [cancelItemsPerPage, setCancelItemsPerPage] = useState(15);

    // Helper: Product Map
    const productMap = useMemo(() => {
        return products.reduce((acc, p) => {
            acc[p.id] = p;
            return acc;
        }, {} as Record<string, Product>);
    }, [products]);

    // 2. Filtered Data
    const filteredSales = useMemo(() => {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59.999');

        return sales.filter(s => {
            const d = new Date(s.date);
            const inDate = d >= start && d <= end;
            const matchSeller = sellerId === 'todos' || s.salespersonId === sellerId;
            const notCancelled = s.status !== 'Cancelada';
            return inDate && matchSeller && notCancelled;
        });
    }, [sales, startDate, endDate, sellerId]);

    const cancelledSales = useMemo(() => {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59.999');
        return sales.filter(s => {
            const d = new Date(s.date);
            return d >= start && d <= end && s.status === 'Cancelada';
        });
    }, [sales, startDate, endDate]);

    // 3. Financial Reports
    const financials = useMemo(() => {
        let totalSales = 0;
        let totalCost = 0;
        let totalDiscounts = 0;
        let totalItems = 0;

        filteredSales.forEach(s => {
            totalSales += s.total;
            totalDiscounts += (s.subtotal - s.total);

            s.items.forEach(item => {
                totalItems += item.quantity;
                const p = productMap[item.productId];
                if (p) {
                    const cost = (p.costPrice || 0) + (p.additionalCostPrice || 0);
                    totalCost += cost * item.quantity;
                }
            });
        });

        const grossProfit = (totalSales + totalDiscounts) - totalCost - totalDiscounts; // Revenue - Cost (Discount already deducted from Total)
        // Wait, s.total is (subtotal - discount). 
        // Profit = s.total - Cost.
        const profit = totalSales - totalCost;
        const margin = totalSales > 0 ? (profit / totalSales) * 100 : 0;
        const avgTicket = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;

        return { totalSales, totalCost, profit, margin, avgTicket, totalItems, totalDiscounts };
    }, [filteredSales, productMap]);

    // 4. Payment Methods
    const paymentStats = useMemo(() => {
        const stats: Record<string, number> = {};

        filteredSales.forEach(s => {
            s.payments?.forEach(p => {
                const method = p.method;
                stats[method] = (stats[method] || 0) + p.value;
            });
        });

        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredSales]);

    // 5. Product Type (Apple vs Non-Apple) & Category
    const typeStats = useMemo(() => {
        const apple = { name: 'Apple', revenue: 0, count: 0 };
        const other = { name: 'Não Apple', revenue: 0, count: 0 };
        const categories: Record<string, { revenue: number, cost: number, count: number }> = {};

        filteredSales.forEach(s => {
            s.items.forEach(item => {
                const p = productMap[item.productId];
                if (!p) return;

                const lineTotal = item.unitPrice * item.quantity; // Gross line revenue
                // We need to distribute discount? For simplicity use lineTotal, or pro-rate.
                // Simpler: use unitPrice as "sold price" (it usually is net of item discount if system supports it, but here discount is on sale). 
                // Let's approximate revenue as unitPrice * quantity.

                const isApple = (p.brand || '').toLowerCase().includes('apple');
                if (isApple) {
                    apple.revenue += lineTotal;
                    apple.count += item.quantity;
                } else {
                    other.revenue += lineTotal;
                    other.count += item.quantity;
                }

                const cat = p.category || 'Sem Categoria';
                if (!categories[cat]) categories[cat] = { revenue: 0, cost: 0, count: 0 };
                categories[cat].revenue += lineTotal;
                categories[cat].count += item.quantity;
                categories[cat].cost += ((p.costPrice || 0) + (p.additionalCostPrice || 0)) * item.quantity;
            });
        });

        // Adjust revenues for global sale discounts? 
        // It's hard to attribute global discount to specific items without pro-rating.
        // For "Type" reports, gross revenue is often acceptable to see volume.

        const categoryList = Object.entries(categories)
            .filter(([name]) => {
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name);
                return name !== 'Sem Categoria' && !isUuid;
            })
            .map(([name, data]) => ({
                name,
                revenue: data.revenue,
                count: data.count,
                margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0
            })).sort((a, b) => b.revenue - a.revenue);

        return { apple, other, categoryList };
    }, [filteredSales, productMap]);



    const displayedCancelledSales = useMemo(() => {
        const start = (cancelCurrentPage - 1) * cancelItemsPerPage;
        return cancelledSales.slice(start, start + cancelItemsPerPage);
    }, [cancelledSales, cancelCurrentPage, cancelItemsPerPage]);

    const totalCancelPages = Math.ceil(cancelledSales.length / cancelItemsPerPage);

    // Reset pages on filter changes
    React.useEffect(() => { setCancelCurrentPage(1); }, [startDate, endDate, cancelItemsPerPage]);

    // 7. Salesperson Ranking
    const sellerStats = useMemo(() => {
        const stats: Record<string, { id: string, name: string, sales: number, count: number }> = {};

        filteredSales.forEach(s => {
            const sid = s.salespersonId || 'unknown';
            if (!stats[sid]) {
                const u = users.find(u => u.id === sid);
                stats[sid] = { id: sid, name: u ? u.name : 'Desconhecido', sales: 0, count: 0 };
            }
            stats[sid].sales += s.total;
            stats[sid].count += 1;
        });

        return Object.values(stats)
            .filter(s => {
                if (s.id === 'unknown') return false;
                const u = users.find(user => user.id === s.id);
                return u?.active !== false;
            })
            .map(s => ({
                ...s,
                avgTicket: s.count > 0 ? s.sales / s.count : 0,
                percent: financials.totalSales > 0 ? (s.sales / financials.totalSales) * 100 : 0
            }))
            .sort((a, b) => b.sales - a.sales);
    }, [filteredSales, users, financials.totalSales]);

    // Export Function
    const handleExport = () => {
        const headers = ['Relatório de Vendas', `Período: ${startDate} a ${endDate}`, ''];
        const kpiRows = [
            ['Faturamento', formatCurrency(financials.totalSales)],
            ['Lucro', formatCurrency(financials.profit)],
            ['Ticket Médio', formatCurrency(financials.avgTicket)],
            ['Itens Vendidos', financials.totalItems]
        ];

        // Simple CSV construction
        let csvContent = "data:text/csv;charset=utf-8,"
            + headers.join('\n') + '\n\n'
            + kpiRows.map(e => e.join(';')).join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `relatorio_vendas_${startDate}_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* 1. Filters */}
            <div className="bg-surface p-4 rounded-3xl border border-border flex flex-wrap items-end gap-4 shadow-sm">
                <CustomDatePicker label="De" value={startDate} onChange={setStartDate} />
                <CustomDatePicker label="Até" value={endDate} onChange={setEndDate} />
                <div>
                    <label className="text-[10px] uppercase font-bold text-muted mb-1 block">Vendedor</label>
                    <select
                        value={sellerId}
                        onChange={e => setSellerId(e.target.value)}
                        className="h-10 pl-3 pr-8 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    >
                        <option value="todos">Todos</option>
                        {users.filter(u => u.active !== false).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                </div>
                <button
                    onClick={() => { setStartDate(new Date().toISOString().split('T')[0]); setEndDate(new Date().toISOString().split('T')[0]); setSellerId('todos'); }}
                    className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 text-gray-600"
                >
                    Limpar
                </button>
                <div className="flex-1 text-right">
                    <button onClick={handleExport} className="h-12 px-6 bg-gradient-to-br from-[#10b981] to-[#059669] text-white rounded-2xl hover:opacity-95 text-xs font-black flex items-center gap-3 shadow-lg shadow-emerald-500/20 uppercase tracking-widest transition-all active:scale-95 border border-white/20 whitespace-nowrap ml-auto">
                        <DocumentArrowUpIcon className="w-6 h-6 transform rotate-180" />
                        Exportar CSV
                    </button>
                </div>
            </div>

            {/* 2. Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Faturamento */}
                <div className="relative overflow-hidden group rounded-[2rem]">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-blue-600/5 group-hover:scale-110 transition-transform duration-500"></div>
                    <div className="relative bg-white/40 backdrop-blur-md border border-blue-100 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all h-full">
                        <div className="bg-blue-600 w-10 h-10 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
                            <span className="text-white font-bold">$</span>
                        </div>
                        <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Faturamento</h3>
                        <p className="text-2xl font-black text-gray-900 mt-1 tracking-tight">{formatCurrency(financials.totalSales)}</p>
                    </div>
                </div>

                {/* Lucro Bruto */}
                <div className="relative overflow-hidden group rounded-[2rem]">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 to-emerald-600/5 group-hover:scale-110 transition-transform duration-500"></div>
                    <div className="relative bg-white/40 backdrop-blur-md border border-emerald-100 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all h-full">
                        <div className="bg-emerald-600 w-10 h-10 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
                            <span className="text-white font-bold">↑</span>
                        </div>
                        <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Lucro Bruto</h3>
                        <p className="text-2xl font-black text-gray-900 mt-1 tracking-tight">{formatCurrency(financials.profit)}</p>
                        <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold mt-2">
                            Mg: {financials.margin.toFixed(1)}%
                        </div>
                    </div>
                </div>

                {/* Ticket Médio */}
                <div className="relative overflow-hidden group rounded-[2rem]">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-purple-600/5 group-hover:scale-110 transition-transform duration-500"></div>
                    <div className="relative bg-white/40 backdrop-blur-md border border-purple-100 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all h-full">
                        <div className="bg-purple-600 w-10 h-10 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-purple-500/20">
                            <span className="text-white font-bold">~</span>
                        </div>
                        <h3 className="text-xs font-bold text-purple-600 uppercase tracking-wider">Ticket Médio</h3>
                        <p className="text-2xl font-black text-gray-900 mt-1 tracking-tight">{formatCurrency(financials.avgTicket)}</p>
                    </div>
                </div>

                {/* Descontos */}
                <div className="relative overflow-hidden group rounded-[2rem]">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-600/10 to-orange-600/5 group-hover:scale-110 transition-transform duration-500"></div>
                    <div className="relative bg-white/40 backdrop-blur-md border border-orange-100 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all h-full">
                        <div className="bg-orange-600 w-10 h-10 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-orange-500/20">
                            <span className="text-white font-bold">-</span>
                        </div>
                        <h3 className="text-xs font-bold text-orange-600 uppercase tracking-wider">Descontos</h3>
                        <p className="text-2xl font-black text-gray-900 mt-1 tracking-tight">{formatCurrency(financials.totalDiscounts)}</p>
                    </div>
                </div>
            </div>

            {/* 3. Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payment Methods */}
                <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm flex flex-col">
                    <h3 className="font-black text-gray-900 mb-6 flex items-center gap-3 text-lg uppercase tracking-tight">
                        <span className="w-2 h-8 bg-gradient-to-b from-purple-400 to-purple-600 rounded-full"></span>
                        Formas de Pagamento
                    </h3>
                    <div className="flex-1 min-h-[300px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={paymentStats}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%" cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={8}
                                    cornerRadius={6}
                                >
                                    {paymentStats.map((_, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                                            stroke="none"
                                            className="hover:opacity-80 transition-opacity cursor-pointer"
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '1.5rem',
                                        border: 'none',
                                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                                        padding: '1rem'
                                    }}
                                    itemStyle={{ fontWeight: '900', color: '#111827' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Legend
                                    layout="vertical"
                                    verticalAlign="middle"
                                    align="right"
                                    formatter={(value) => <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Salesperson Rankings */}
                <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm flex flex-col">
                    <h3 className="font-black text-gray-900 mb-6 flex items-center gap-3 text-lg uppercase tracking-tight">
                        <span className="w-2 h-8 bg-gradient-to-b from-orange-400 to-orange-600 rounded-full"></span>
                        Ranking de Vendedores
                    </h3>
                    <div className="flex-1 flex flex-col gap-4 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                        {sellerStats.map((s, idx) => (
                            <div key={idx} className="group relative flex items-center justify-between p-4 rounded-2xl bg-gray-50/50 hover:bg-orange-50 transition-all border border-transparent hover:border-orange-100">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm transition-all shadow-sm
                                        ${idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-orange-200' :
                                            idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white shadow-gray-200' :
                                                idx === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-700 text-white shadow-orange-100' :
                                                    'bg-white text-gray-400 border border-gray-200'}`}>
                                        {idx + 1}º
                                    </div>
                                    <div>
                                        <p className="font-black text-gray-900 text-sm group-hover:text-orange-900 transition-colors uppercase tracking-tight">{s.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="inline-block w-1 h-1 bg-gray-300 rounded-full"></span>
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">{s.count} vendas concretizadas</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-emerald-500 text-base tracking-tight">{formatCurrency(s.sales)}</p>
                                    <div className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400 group-hover:text-orange-600 transition-colors uppercase tracking-widest">
                                        {s.percent.toFixed(1)}% <span className="opacity-50">do total</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. Product Analysis (Apple vs Other & Categories) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm">
                    <h3 className="font-black text-gray-900 mb-6 flex items-center gap-3 text-lg uppercase tracking-tight">
                        <span className="w-2 h-8 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full"></span>
                        Apple vs Outros
                    </h3>
                    <div className="space-y-4">
                        {(() => {
                            const totalGross = typeStats.apple.revenue + typeStats.other.revenue;
                            return (
                                <>
                                    <div className="p-6 bg-gray-50/50 rounded-2xl flex justify-between items-center border border-gray-50 group hover:bg-blue-50 hover:border-blue-100 transition-all">
                                        <div>
                                            <p className="font-black text-gray-900 uppercase text-xs tracking-widest group-hover:text-blue-900">Apple Inc.</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">{typeStats.apple.count} produtos</span>
                                                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                <p className="text-xs font-black text-blue-600">
                                                    {totalGross > 0 ? ((typeStats.apple.revenue / totalGross) * 100).toFixed(1) : '0.0'}%
                                                </p>
                                            </div>
                                        </div>
                                        <p className="font-black text-xl text-gray-900 tracking-tight">{formatCurrency(typeStats.apple.revenue)}</p>
                                    </div>
                                    <div className="p-6 bg-gray-50/50 rounded-2xl flex justify-between items-center border border-gray-50 group hover:bg-gray-100 hover:border-gray-200 transition-all">
                                        <div>
                                            <p className="font-black text-gray-900 uppercase text-xs tracking-widest group-hover:text-gray-900">Multimarcas</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">{typeStats.other.count} produtos</span>
                                                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                <p className="text-xs font-black text-gray-500">
                                                    {totalGross > 0 ? ((typeStats.other.revenue / totalGross) * 100).toFixed(1) : '0.0'}%
                                                </p>
                                            </div>
                                        </div>
                                        <p className="font-black text-xl text-gray-900 tracking-tight">{formatCurrency(typeStats.other.revenue)}</p>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm">
                    <h3 className="font-black text-gray-900 mb-6 flex items-center gap-3 text-lg uppercase tracking-tight">
                        <span className="w-2 h-8 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-full"></span>
                        Top Categorias
                    </h3>
                    <div className="overflow-y-auto max-h-[220px] space-y-3 pr-2 custom-scrollbar">
                        {typeStats.categoryList.map((cat, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 rounded-xl hover:bg-emerald-50/50 transition-colors border-b border-gray-50 last:border-0">
                                <div>
                                    <span className="font-black text-gray-900 uppercase text-[11px] tracking-tight">{cat.name}</span>
                                    <span className="inline-flex items-center ml-3 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase">
                                        {cat.margin.toFixed(0)}% Mg
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="font-black text-gray-900 text-sm tracking-tight block">{formatCurrency(cat.revenue)}</span>
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{cat.count} unidades</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>


            {/* 6. Cancelled Sales */}
            {cancelledSales.length > 0 && (
                <div className="bg-red-50/30 border border-red-100 rounded-[2rem] p-8 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                        <div className="flex items-center gap-4">
                            <span className="w-2 h-10 bg-gradient-to-b from-red-400 to-red-600 rounded-full"></span>
                            <div>
                                <h3 className="font-black text-2xl text-red-600 tracking-tight leading-none uppercase">Vendas Canceladas</h3>
                                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mt-1.5">{cancelledSales.length} registros encontrados</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Exibir:</span>
                            <select
                                value={cancelItemsPerPage}
                                onChange={(e) => setCancelItemsPerPage(Number(e.target.value))}
                                className="bg-white border border-red-100 rounded-xl px-3 py-2 text-xs font-black outline-none focus:ring-4 focus:ring-red-500/10 transition-all cursor-pointer text-red-600"
                            >
                                <option value={15}>15</option>
                                <option value={30}>30</option>
                                <option value={45}>45</option>
                            </select>
                        </div>
                    </div>
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-separate border-spacing-y-2">
                            <thead className="text-[10px] text-red-300 font-black uppercase tracking-[0.2em]">
                                <tr>
                                    <th className="px-6 py-4">Data</th>
                                    <th className="px-6 py-4">Vendedor</th>
                                    <th className="px-6 py-4 text-right">Total Estornado</th>
                                    <th className="px-6 py-4">Observações</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {displayedCancelledSales.map(c => (
                                    <tr key={c.id} className="group">
                                        <td className="px-6 py-4 bg-white/50 rounded-l-2xl border-y border-l border-red-50 group-hover:bg-white transition-colors">
                                            <span className="font-bold text-gray-600">{new Date(c.date).toLocaleDateString()}</span>
                                        </td>
                                        <td className="px-6 py-4 bg-white/50 border-y border-red-50 group-hover:bg-white transition-colors">
                                            <span className="font-black text-gray-900 uppercase text-xs">{users.find(u => u.id === c.salespersonId)?.name || 'N/A'}</span>
                                        </td>
                                        <td className="px-6 py-4 bg-white/50 border-y border-red-50 group-hover:bg-white transition-colors text-right">
                                            <span className="font-black text-red-600">{formatCurrency(c.total)}</span>
                                        </td>
                                        <td className="px-6 py-4 bg-white/50 rounded-r-2xl border-y border-r border-red-50 group-hover:bg-white transition-colors max-w-xs truncate italic text-gray-400 font-medium">
                                            {c.observations || 'Nenhum motivo detalhado'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {totalCancelPages > 1 && (
                        <div className="flex items-center justify-between mt-8 border-t border-red-100/50 pt-6">
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">
                                Página {cancelCurrentPage} de {totalCancelPages}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCancelCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={cancelCurrentPage === 1}
                                    className="h-10 px-6 border border-red-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all text-red-600"
                                >
                                    Anterior
                                </button>
                                <button
                                    onClick={() => setCancelCurrentPage(p => Math.min(totalCancelPages, p + 1))}
                                    disabled={cancelCurrentPage === totalCancelPages}
                                    className="h-10 px-6 border border-red-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all text-red-600"
                                >
                                    Próxima
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SalesReports;
