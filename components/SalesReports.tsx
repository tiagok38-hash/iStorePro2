
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
            totalDiscounts += (s.discount || 0);

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

    // 6. Advanced Model Pricing (CRITICAL)
    const [searchTerm, setSearchTerm] = useState('');

    const modelStats = useMemo(() => {
        // Group ALL products (sold or in stock) by Model + Storage + Condition
        // key: Model + Storage + Condition

        // Helper to normalize model name
        // Sort models by length descending to match longest specific name first
        const sortedModels = [...productModels].sort((a, b) => b.name.length - a.name.length);

        const getBaseModel = (fullName: string) => {
            let name = fullName.trim();
            const lowerName = name.toLowerCase();

            // 1. Try matching with defined ProductModels (longest first)
            for (const m of sortedModels) {
                if (lowerName.includes(m.name.toLowerCase())) {
                    return m.name; // Return the canonical name
                }
            }

            // 2. Fallback: Regex for iPhone (Strongly typed structure)
            // Matches: iPhone 17, iPhone 17 Pro, iPhone 17 Pro Max, iPhone SE, iPhone X...
            const iphoneMatch = name.match(/iPhone\s+(?:\d+|X|SE|[IV]+)(?:\s?(?:Pro|Max|Plus|Mini|Ultra))*/i);
            if (iphoneMatch) {
                return iphoneMatch[0];
            }

            // 3. Fallback: Regex for iPad
            const ipadMatch = name.match(/iPad\s+(?:Air|Mini|Pro)?(?:\s?\d+(?:th|rd|nd|st)?\s?Gen)?(?:\s?\d+(\.\d+)?["”])?/i);
            if (ipadMatch) {
                return ipadMatch[0];
            }

            // 4. Fallback: Regex for Apple Watch
            const watchMatch = name.match(/Apple\s?Watch\s+(?:Series\s?\d+|Ultra|SE)/i);
            if (watchMatch) {
                return watchMatch[0];
            }

            // 5. Generic Fallback: Clean up common suffixes (Storage, Colors)
            // Remove storage patterns (e.g. 128GB, 256GB, 1TB, 8GB/256GB)
            name = name.replace(/\b\d+\/?\d*\s*[GT]B\b/gi, '');

            // Remove common colors (Basic list + Portuguese variations)
            const colors = [
                'Preto', 'Branco', 'Prateado', 'Dourado', 'Cinza', 'Grafite',
                'Azul', 'Verde', 'Vermelho', 'Rosa', 'Roxo', 'Amarelo', 'Laranja', 'Cobre',
                'Black', 'White', 'Silver', 'Gold', 'Gray', 'Grey', 'Graphite',
                'Blue', 'Green', 'Red', 'Pink', 'Purple', 'Yellow', 'Orange',
                'Midnight', 'Starlight', 'Space', 'Titanium', 'Titânio', 'Natural',
                'Sierra', 'Alpine', 'Deep', 'Cosmico', 'Cósmico', 'Profundo', 'Estelar', 'Meia-noite'
            ];
            const colorRegex = new RegExp(`\\b(${colors.join('|')})\\b`, 'gi');
            name = name.replace(colorRegex, '');

            return name.replace(/\s+/g, ' ').trim();
        };

        const groups: Record<string, {
            model: string,
            storage: string,
            condition: string,
            brand: string,
            category: string,
            totalUnits: number,
            totalCost: number,
            totalWholesale: number,
            totalSaleList: number,
            soldCount: number,
            soldRevenue: number
        }> = {};

        // 1. Scan Inventory (All products)
        products.forEach(p => {
            if (!p.model) return;
            // Normalize model
            const rawModel = String(p.model || '').trim();
            const baseModel = getBaseModel(rawModel);

            // Normalize Storage: Use p.storage or extract from string if p.storage is missing
            let storage = String(p.storage || '');
            if (!storage || storage === '0') {
                const match = rawModel.match(/\b(\d+\s*([GT]B))\b/i);
                if (match) storage = match[0].toUpperCase().replace(/\s+/, '');
                else storage = 'N/A';
            } else {
                // Formatting storage if it's a number (e.g. 128 -> 128GB assumption or just 128)
                // If p.storage is number, append GB if appropriate or leave as is.
                // Assuming p.storage is number of GB
                if (!String(storage).toLowerCase().includes('b')) {
                    storage = `${storage}GB`;
                }
            }

            const condition = String(p.condition || 'N/A').trim();
            const brand = String(p.brand || '').trim();
            const category = String(p.category || '').trim();

            // Key now includes brand and category to separate "Bateria iPhone XR" from "iPhone XR" or "Tela iPhone XR"
            const key = `${brand}-${category}-${baseModel}-${storage}-${condition}`;

            if (!groups[key]) {
                groups[key] = {
                    model: baseModel,
                    storage,
                    condition,
                    brand,
                    category,
                    totalUnits: 0,
                    totalCost: 0,
                    totalWholesale: 0,
                    totalSaleList: 0,
                    soldCount: 0,
                    soldRevenue: 0
                };
            }

            // Weighted Average Calculation based on STOCK
            const stockQty = p.stock || 0;
            if (stockQty > 0) {
                groups[key].totalUnits += stockQty;
                groups[key].totalCost += ((p.costPrice || 0) + (p.additionalCostPrice || 0)) * stockQty;
                groups[key].totalWholesale += (p.wholesalePrice || 0) * stockQty;
                groups[key].totalSaleList += (p.price || 0) * stockQty;
            }
        });

        // 2. Scan Sales
        filteredSales.forEach(s => {
            s.items.forEach(item => {
                const p = productMap[item.productId];
                if (!p) return;

                const rawModel = String(p.model || '').trim();
                const baseModel = getBaseModel(rawModel);

                let storage = String(p.storage || '');
                if (!storage || storage === '0') {
                    const match = rawModel.match(/\b(\d+\s*([GT]B))\b/i);
                    if (match) storage = match[0].toUpperCase().replace(/\s+/, '');
                    else storage = 'N/A';
                } else {
                    if (!String(storage).toLowerCase().includes('b')) {
                        storage = `${storage}GB`;
                    }
                }

                const condition = p.condition || 'N/A';
                const brand = String(p.brand || '').trim();
                const category = String(p.category || '').trim();
                const key = `${brand}-${category}-${baseModel}-${storage}-${condition}`;

                if (groups[key]) {
                    groups[key].soldCount += item.quantity;
                    groups[key].soldRevenue += (item.unitPrice * item.quantity);
                }
            });
        });

        return Object.values(groups).map(g => {
            const avgCost = g.totalUnits > 0 ? g.totalCost / g.totalUnits : 0;
            const avgWholesale = g.totalUnits > 0 ? g.totalWholesale / g.totalUnits : 0;
            const avgListPrice = g.totalUnits > 0 ? g.totalSaleList / g.totalUnits : 0;

            const margin = avgListPrice > 0 ? ((avgListPrice - avgCost) / avgListPrice) * 100 : 0;

            return {
                ...g,
                stockUnits: g.totalUnits,
                totalUnits: g.totalUnits, // Agora foca apenas no estoque atual
                avgCost,
                avgWholesale,
                avgListPrice,
                margin
            };
        })
            .filter(g => g.stockUnits > 0)
            .sort((a, b) => b.stockUnits - a.stockUnits);
    }, [products, filteredSales, productMap, productModels]);

    const filteredModelStats = useMemo(() => {
        if (!searchTerm) return modelStats;
        const lowerSearch = searchTerm.toLowerCase();
        return modelStats.filter(m =>
            (m.model || '').toString().toLowerCase().includes(lowerSearch) ||
            (m.storage || '').toString().toLowerCase().includes(lowerSearch) ||
            (m.condition || '').toString().toLowerCase().includes(lowerSearch)
        );
    }, [modelStats, searchTerm]);

    const displayedModelStats = useMemo(() => {
        const start = (modelCurrentPage - 1) * modelItemsPerPage;
        return filteredModelStats.slice(start, start + modelItemsPerPage);
    }, [filteredModelStats, modelCurrentPage, modelItemsPerPage]);

    const totalModelPages = Math.ceil(filteredModelStats.length / modelItemsPerPage);

    const displayedCancelledSales = useMemo(() => {
        const start = (cancelCurrentPage - 1) * cancelItemsPerPage;
        return cancelledSales.slice(start, start + cancelItemsPerPage);
    }, [cancelledSales, cancelCurrentPage, cancelItemsPerPage]);

    const totalCancelPages = Math.ceil(cancelledSales.length / cancelItemsPerPage);

    // Reset pages on filter changes
    React.useEffect(() => { setModelCurrentPage(1); }, [searchTerm, modelItemsPerPage]);
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

            {/* 5. Critical: Report by Model */}
            <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between flex-1 gap-6">
                        <div>
                            <h3 className="font-black text-2xl text-gray-900 flex items-center gap-3 tracking-tight">
                                <span className="w-2 h-10 bg-gradient-to-b from-indigo-400 to-indigo-700 rounded-full"></span>
                                Estoque e Preços Médios
                            </h3>
                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1 ml-5">ANÁLISE DE PRECO MÉDIO AGRUPADOS POR MODELO E CONDICAO IGUAIS</p>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Exibir:</span>
                                <select
                                    value={modelItemsPerPage}
                                    onChange={(e) => setModelItemsPerPage(Number(e.target.value))}
                                    className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs font-black outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                                >
                                    <option value={15}>15</option>
                                    <option value={30}>30</option>
                                    <option value={45}>45</option>
                                </select>
                            </div>

                            <div className="relative group">
                                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Pesquisar modelo..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="block w-full lg:w-96 pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/30 outline-none transition-all placeholder:text-gray-300"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-separate border-spacing-y-2">
                        <thead className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
                            <tr>
                                <th className="px-6 py-4">Produto</th>
                                <th className="px-6 py-4">Condição</th>
                                <th className="px-6 py-4 text-center">Qtde</th>
                                <th className="px-6 py-4 text-right">Custo Médio</th>
                                <th className="px-6 py-4 text-right text-orange-600">Atacado</th>
                                <th className="px-6 py-4 text-right">Venda (Tabela)</th>
                                <th className="px-6 py-4 text-right">Margem</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {displayedModelStats.map((m, idx) => (
                                <tr key={idx} className="group hover:bg-gray-50/80 transition-all">
                                    <td className="px-6 py-4 bg-gray-50/30 rounded-l-2xl border-y border-l border-transparent group-hover:border-gray-100">
                                        <div className="flex flex-col">
                                            <span className="font-black text-gray-900 text-sm tracking-tight capitalize">{m.model}</span>
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mt-0.5">
                                                {m.brand} • {m.storage !== 'N/A' ? m.storage : 'STD'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 bg-gray-50/30 border-y border-transparent group-hover:border-gray-100">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest
                                            ${m.condition === 'Novo' ? 'bg-emerald-100 text-emerald-700' :
                                                m.condition === 'Seminovo' ? 'bg-indigo-100 text-indigo-700' :
                                                    'bg-gray-100 text-gray-600'}`}>
                                            {m.condition}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 bg-gray-50/30 text-center border-y border-transparent group-hover:border-gray-100">
                                        <span className="font-black text-gray-900">{m.totalUnits}</span>
                                    </td>
                                    <td className="px-6 py-4 bg-gray-50/30 text-right font-bold text-gray-400 border-y border-transparent group-hover:border-gray-100">
                                        {formatCurrency(m.avgCost)}
                                    </td>
                                    <td className="px-6 py-4 bg-gray-50/30 text-right font-black text-orange-600 border-y border-transparent group-hover:border-gray-100">
                                        {formatCurrency(m.avgWholesale)}
                                    </td>
                                    <td className="px-6 py-4 bg-gray-50/30 text-right font-black text-gray-900 border-y border-transparent group-hover:border-gray-100">
                                        {formatCurrency(m.avgListPrice)}
                                    </td>
                                    <td className="px-6 py-4 bg-gray-50/30 text-right rounded-r-2xl border-y border-r border-transparent group-hover:border-gray-100">
                                        <span className="font-black tracking-tighter text-emerald-500">
                                            {m.margin.toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {totalModelPages > 1 && (
                    <div className="flex items-center justify-between mt-8 border-t border-gray-100 pt-6">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Mostrando {Math.min(filteredModelStats.length, modelItemsPerPage)} de {filteredModelStats.length} resultados
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setModelCurrentPage(p => Math.max(1, p - 1))}
                                disabled={modelCurrentPage === 1}
                                className="h-10 px-6 border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setModelCurrentPage(p => Math.min(totalModelPages, p + 1))}
                                disabled={modelCurrentPage === totalModelPages}
                                className="h-10 px-6 border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                )}
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
