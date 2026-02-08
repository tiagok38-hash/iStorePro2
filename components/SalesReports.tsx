
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

        const categoryList = Object.entries(categories).map(([name, data]) => ({
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
            const key = `${baseModel}-${storage}-${condition}`;

            if (!groups[key]) {
                groups[key] = {
                    model: baseModel,
                    storage,
                    condition,
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
                const key = `${baseModel}-${storage}-${condition}`;

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

            // Total volume = Stock + Sold
            const displayTotalUnits = g.totalUnits + g.soldCount;

            const margin = avgListPrice > 0 ? ((avgListPrice - avgCost) / avgListPrice) * 100 : 0;

            return {
                ...g,
                stockUnits: g.totalUnits,
                totalUnits: displayTotalUnits,
                avgCost,
                avgWholesale,
                avgListPrice,
                margin
            };
        })
            .filter(g => g.stockUnits > 0)
            .sort((a, b) => b.totalUnits - a.totalUnits);
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

    // 7. Salesperson Ranking
    const sellerStats = useMemo(() => {
        const stats: Record<string, { name: string, sales: number, count: number }> = {};

        filteredSales.forEach(s => {
            const sid = s.salespersonId || 'unknown';
            if (!stats[sid]) {
                const u = users.find(u => u.id === sid);
                stats[sid] = { name: u ? u.name : 'Desconhecido', sales: 0, count: 0 };
            }
            stats[sid].sales += s.total;
            stats[sid].count += 1;
        });

        return Object.values(stats)
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
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                </div>
                <button
                    onClick={() => { setStartDate(new Date().toISOString().split('T')[0]); setEndDate(new Date().toISOString().split('T')[0]); setSellerId('todos'); }}
                    className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 text-gray-600"
                >
                    Limpar
                </button>
                <div className="flex-1 text-right">
                    <button onClick={handleExport} className="h-10 px-4 bg-primary text-white rounded-xl font-bold text-sm shadow hover:bg-primary/90 flex items-center gap-2 ml-auto">
                        <DocumentArrowUpIcon className="w-4 h-4 transform rotate-180" />
                        Exportar CSV
                    </button>
                </div>
            </div>

            {/* 2. Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-3xl">
                    <h3 className="text-sm font-medium text-blue-800">Faturamento</h3>
                    <p className="text-2xl font-bold text-blue-900 mt-1">{formatCurrency(financials.totalSales)}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-3xl">
                    <h3 className="text-sm font-medium text-emerald-800">Lucro Bruto</h3>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">{formatCurrency(financials.profit)}</p>
                    <p className="text-xs font-semibold text-emerald-700 mt-1">Margem: {financials.margin.toFixed(1)}%</p>
                </div>
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-3xl">
                    <h3 className="text-sm font-medium text-purple-800">Ticket Médio</h3>
                    <p className="text-2xl font-bold text-purple-900 mt-1">{formatCurrency(financials.avgTicket)}</p>
                </div>
                <div className="bg-orange-50 border border-orange-100 p-4 rounded-3xl">
                    <h3 className="text-sm font-medium text-orange-800">Descontos</h3>
                    <p className="text-2xl font-bold text-orange-900 mt-1">{formatCurrency(financials.totalDiscounts)}</p>
                </div>
            </div>

            {/* 3. Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payment Methods */}
                <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm flex flex-col">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
                        Formas de Pagamento
                    </h3>
                    <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={paymentStats}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%" cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={2}
                                >
                                    {paymentStats.map((_, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend layout="vertical" verticalAlign="middle" align="right" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Salesperson Rankings */}
                <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm flex flex-col">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="w-1 h-6 bg-orange-500 rounded-full"></span>
                        Ranking de Vendedores
                    </h3>
                    <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[300px]">
                        {sellerStats.map((s, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center font-bold text-gray-600 text-xs">
                                        {idx + 1}º
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 text-sm">{s.name}</p>
                                        <p className="text-xs text-gray-500">{s.count} vendas</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-primary">{formatCurrency(s.sales)}</p>
                                    <p className="text-xs text-gray-500">{s.percent.toFixed(1)}% do total</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. Product Analysis (Apple vs Other & Categories) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4">Apple vs Outros</h3>
                    <div className="space-y-4">
                        {(() => {
                            const totalGross = typeStats.apple.revenue + typeStats.other.revenue;
                            return (
                                <>
                                    <div className="p-4 bg-gray-50 rounded-xl flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-gray-900">Apple</p>
                                            <div className="flex gap-2">
                                                <p className="text-xs text-gray-500">{typeStats.apple.count} itens</p>
                                                <p className="text-xs font-bold text-blue-600">
                                                    ({totalGross > 0 ? ((typeStats.apple.revenue / totalGross) * 100).toFixed(1) : '0.0'}%)
                                                </p>
                                            </div>
                                        </div>
                                        <p className="font-bold text-lg">{formatCurrency(typeStats.apple.revenue)}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-xl flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-gray-900">Não Apple</p>
                                            <div className="flex gap-2">
                                                <p className="text-xs text-gray-500">{typeStats.other.count} itens</p>
                                                <p className="text-xs font-bold text-blue-600">
                                                    ({totalGross > 0 ? ((typeStats.other.revenue / totalGross) * 100).toFixed(1) : '0.0'}%)
                                                </p>
                                            </div>
                                        </div>
                                        <p className="font-bold text-lg">{formatCurrency(typeStats.other.revenue)}</p>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>

                <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4">Top Categorias</h3>
                    <div className="overflow-y-auto max-h-[200px] space-y-2">
                        {typeStats.categoryList.map((cat, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2 last:border-0">
                                <span className="font-medium text-gray-700">{cat.name}</span>
                                <div className="text-right">
                                    <span className="font-bold block">{formatCurrency(cat.revenue)}</span>
                                    <span className="text-[10px] text-emerald-600 block">Mg: {cat.margin.toFixed(0)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 5. Critical: Report by Model */}
            <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                        <span className="w-1 h-6 bg-indigo-600 rounded-full"></span>
                        Média de Preços por Modelo (Estoque + Vendas)
                    </h3>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar modelo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border rounded-xl text-sm w-full sm:w-96 focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                        <SearchIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3">Modelo</th>
                                <th className="px-4 py-3">Condição</th>
                                <th className="px-4 py-3 text-center">Unidades Totais</th>
                                <th className="px-4 py-3 text-right">Custo Médio</th>
                                <th className="px-4 py-3 text-right text-orange-600">Atacado Médio</th>
                                <th className="px-4 py-3 text-right">Venda Média (Tabela)</th>
                                <th className="px-4 py-3 text-right">Margem Média</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredModelStats.slice(0, 50).map((m, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">
                                        {m.model} <span className="text-gray-500 text-xs ml-1">{m.storage !== 'N/A' ? m.storage : ''}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-xl text-xs font-bold ${m.condition === 'Novo' ? 'bg-green-100 text-green-700' :
                                            m.condition === 'Seminovo' ? 'bg-blue-100 text-blue-700' :
                                                m.condition === 'CPO' ? 'bg-orange-100 text-orange-700' :
                                                    m.condition === 'Vitrine' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-gray-100 text-gray-700'
                                            }`}>
                                            {m.condition}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold">{m.totalUnits}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(m.avgCost)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-orange-600">{formatCurrency(m.avgWholesale)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(m.avgListPrice)}</td>
                                    <td className={`px-4 py-3 text-right font-bold ${m.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {m.margin.toFixed(1)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="text-xs text-gray-400 mt-2 text-center">
                        {filteredModelStats.length > 50 ? `Exibindo top 50 de ${filteredModelStats.length} resultados` : `${filteredModelStats.length} resultados encontrados`}
                    </p>
                </div>
            </div>

            {/* 6. Cancelled Sales */}
            {cancelledSales.length > 0 && (
                <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm">
                    <h3 className="font-bold text-red-600 mb-4">Vendas Canceladas ({cancelledSales.length})</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-red-50">
                                <tr>
                                    <th className="px-4 py-2">Data</th>
                                    <th className="px-4 py-2">Vendedor</th>
                                    <th className="px-4 py-2">Total Estornado</th>
                                    <th className="px-4 py-2">Motivo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cancelledSales.map(c => (
                                    <tr key={c.id} className="border-b border-gray-100">
                                        <td className="px-4 py-2">{new Date(c.date).toLocaleDateString()}</td>
                                        <td className="px-4 py-2">{users.find(u => u.id === c.salespersonId)?.name || 'N/A'}</td>
                                        <td className="px-4 py-2 font-bold text-red-600">{formatCurrency(c.total)}</td>
                                        <td className="px-4 py-2 italic text-gray-500 max-w-xs truncate">{c.observations || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesReports;
