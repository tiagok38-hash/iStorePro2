import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
    ChevronLeft, ChevronRight, Search, Plus,
    TrendingUp, TrendingDown, DollarSign, Percent, Scale,
    ShoppingBag, Wrench, BarChart2, Package
} from 'lucide-react';
import { format, isSameMonth, parseISO, isToday, startOfMonth, endOfMonth, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import CreditDashboard from '../components/CreditDashboard';
import { supabase } from '../supabaseClient';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return format(date, 'dd/MM/yyyy');
};

export default function Financeiro() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'installments'>(() => {
        const tab = searchParams.get('tab');
        if (tab === 'crediarios') return 'installments';
        if (tab === 'transactions') return 'transactions';
        return 'dashboard';
    });

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [isLoading, setIsLoading] = useState(true);

    // --- DATA STATE ---
    const [sales, setSales] = useState<any[]>([]);
    const [serviceOrders, setServiceOrders] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [inventoryValue, setInventoryValue] = useState(0);

    const [typeFilter, setTypeFilter] = useState('Todos');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [searchQuery, setSearchQuery] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'crediarios') setActiveTab('installments');
        else if (tab === 'transactions') setActiveTab('transactions');
        else setActiveTab('dashboard');
    }, [searchParams]);

    const handleTabChange = (tab: 'dashboard' | 'transactions' | 'installments') => {
        setActiveTab(tab);
        if (tab === 'dashboard') setSearchParams({}, { replace: true });
        else setSearchParams({ tab }, { replace: true });
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            const startStr = startOfMonth(currentMonth).toISOString();
            const endStr = endOfDay(endOfMonth(currentMonth)).toISOString();

            // 1. Account Plans
            // 1. Account Plans (Available if needed in the future)
            const { data: plans } = await supabase.from('transaction_categories').select('*');

            // 2. Transações Financeiras (Mês atual)
            const { data: finTrans } = await supabase
                .from('financial_transactions')
                .select('*, transaction_categories(name, classification)')
                .gte('due_date', startStr)
                .lte('due_date', endStr)
                .order('due_date', { ascending: false });
            if (finTrans) setTransactions(finTrans);

            // 3. Vendas
            const { data: salesData } = await supabase
                .from('sales')
                .select('id, date, total, items, status, payments')
                .in('status', ['Finalizada', 'Editada'])
                .gte('date', startStr)
                .lte('date', endStr);
            if (salesData) setSales(salesData);

            // 4. Ordens de Serviço
            const { data: soData } = await supabase
                .from('service_orders')
                .select('id, entryDate, exitDate, total, items, status, payments, createdAt')
                .in('status', ['Concluído', 'Entregue'])
                .gte('exitDate', startStr)
                .lte('exitDate', endStr);
            if (soData) setServiceOrders(soData);

            // 5. Inventário (Total value in stock based on cost)
            const { data: productsData } = await supabase
                .from('products')
                .select('stock, costPrice, additionalCostPrice')
                .gt('stock', 0);

            if (productsData) {
                const totalInv = productsData.reduce((acc, p) => acc + (p.stock * ((p.costPrice || 0) + (p.additionalCostPrice || 0))), 0);
                setInventoryValue(totalInv);
            }

            // Also fetch Today's specifically if today is not in currentMonth (rare but possible for rigid KPI)
            if (!isSameMonth(new Date(), currentMonth)) {
                const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

                const { data: todaySales } = await supabase
                    .from('sales').select('id, date, total, items, status, payments')
                    .in('status', ['Finalizada', 'Editada']).gte('date', todayStart.toISOString()).lte('date', todayEnd.toISOString());
                if (todaySales) setSales(prev => [...prev.filter(s => !isToday(parseISO(s.date))), ...todaySales]);

                const { data: todaySo } = await supabase
                    .from('service_orders').select('id, exitDate, total, items, status, payments, createdAt')
                    .in('status', ['Concluído', 'Entregue']).gte('exitDate', todayStart.toISOString()).lte('exitDate', todayEnd.toISOString());
                if (todaySo) setServiceOrders(prev => [...prev.filter(so => !isToday(parseISO(so.exitDate || so.createdAt))), ...todaySo]);

                const { data: todayFin } = await supabase
                    .from('financial_transactions').select('*')
                    .gte('due_date', todayStart.toISOString()).lte('due_date', todayEnd.toISOString());
                if (todayFin) setTransactions(prev => [...prev.filter(t => !isToday(parseISO(t.due_date))), ...todayFin]);
            }

        } catch (error) {
            console.error('Error fetching financial data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentMonth]);

    // --- KPI & DASHBOARD CALCULATIONS (ERP LOGIC) ---
    const dashboardMetrics = useMemo(() => {
        let dailyRevenue = 0;
        let dailyExpenses = 0;
        let monthlyRevenue = 0; // Operational Only
        let monthlyExpenses = 0;
        let monthlyCOGS = 0;

        let totalServiceRevenue = 0;
        let totalServiceCOGS = 0;

        const productSalesCount: Record<string, { name: string; qty: number; revenue: number }> = {};
        const serviceProfitMap: Record<string, { name: string; sumProfit: number; count: number }> = {};

        // 1. Process Sales (Revenue & COGS)
        sales.forEach(sale => {
            const isSaleToday = isToday(parseISO(sale.date));
            const isSaleThisMonth = isSameMonth(parseISO(sale.date), currentMonth);

            let saleCOGS = 0;
            const items = Array.isArray(sale.items) ? sale.items : (typeof sale.items === 'string' ? JSON.parse(sale.items || '[]') : []);

            items.forEach((item: any) => {
                const qty = item.quantity || 1;
                const cost = (item.costPrice || 0) * qty;
                saleCOGS += cost;

                if (isSaleThisMonth) {
                    const pName = item.productName || item.model || 'Produto';
                    if (!productSalesCount[pName]) productSalesCount[pName] = { name: pName, qty: 0, revenue: 0 };
                    productSalesCount[pName].qty += qty;
                    productSalesCount[pName].revenue += ((item.unitPrice || 0) * qty);
                }
            });

            if (isSaleToday) dailyRevenue += (sale.total || 0);
            if (isSaleThisMonth) {
                monthlyRevenue += (sale.total || 0);
                monthlyCOGS += saleCOGS;
            }
        });

        // 2. Process Service Orders (Revenue & COGS)
        serviceOrders.forEach(so => {
            const dateStr = so.exitDate || so.createdAt;
            if (!dateStr) return;
            const isSOToday = isToday(parseISO(dateStr));
            const isSOThisMonth = isSameMonth(parseISO(dateStr), currentMonth);

            let soCOGS = 0;
            let soServiceRevenue = 0;
            const items = Array.isArray(so.items) ? so.items : (typeof so.items === 'string' ? JSON.parse(so.items || '[]') : []);

            items.forEach((item: any) => {
                const qty = item.quantity || 1;
                // rule 4: parts are inventory items and have cost
                if (item.type === 'part') {
                    soCOGS += (item.cost || 0) * qty;
                } else if (item.type === 'service') {
                    soServiceRevenue += (item.price || 0) * qty;
                    if (isSOThisMonth) {
                        const sName = item.description || 'Serviço';
                        if (!serviceProfitMap[sName]) serviceProfitMap[sName] = { name: sName, sumProfit: 0, count: 0 };
                        // service profit = revenue - service internal cost (if any, usually 0)
                        const svcProfit = ((item.price || 0) * qty) - ((item.cost || 0) * qty);
                        serviceProfitMap[sName].sumProfit += svcProfit;
                        serviceProfitMap[sName].count += qty;
                    }
                }
            });

            if (isSOToday) dailyRevenue += (so.total || 0);
            if (isSOThisMonth) {
                monthlyRevenue += (so.total || 0);
                monthlyCOGS += soCOGS;
                totalServiceRevenue += soServiceRevenue;
                totalServiceCOGS += soCOGS; // total cost attached to services
            }
        });

        // 3. Process Financial Transactions (Expenses & Other Income)
        transactions.forEach(t => {
            // Check if it's explicitly marked as Purchase to ignore as expense. 
            // The instruction says "Inventory purchases must NOT appear as expenses". 
            // In a robust ERP, purchases are Asset movements. If someone manually inputs an expense with "Compra" category we might filter it.
            // But ideally they use 'expense' only for OPEX. We assume all 'expense' are OPEX.
            const dateStr = t.payment_date || t.due_date;
            if (!dateStr) return;
            const isTxToday = isToday(parseISO(dateStr));
            const isTxThisMonth = isSameMonth(parseISO(dateStr), currentMonth);
            const isPaid = t.status === 'paid';

            if (t.type === 'expense' && isPaid) {
                if (isTxToday) dailyExpenses += t.amount;
                if (isTxThisMonth) monthlyExpenses += t.amount;
            } else if (t.type === 'income' && isPaid) {
                // If it's manual income (not from sales/SO directly, unless double entered).
                // Let's assume manual incomes are part of total cashflow but NOT operational Revenue for gross profit.
                // We will just add to a 'otherIncome' if needed, but the prompt says Revenue = sales + services.
            }
        });

        const grossProfit = monthlyRevenue - monthlyCOGS;
        const netProfit = grossProfit - monthlyExpenses;
        const netCashFlow = monthlyRevenue - monthlyExpenses; // Simplified cash flow formula from prompt

        const avgServiceMargin = totalServiceRevenue > 0
            ? ((totalServiceRevenue - totalServiceCOGS) / totalServiceRevenue) * 100
            : 0;

        const bestSellingProducts = Object.values(productSalesCount).sort((a, b) => b.qty - a.qty).slice(0, 5);
        const mostProfitableServices = Object.values(serviceProfitMap).sort((a, b) => b.sumProfit - a.sumProfit).slice(0, 5);
        const inventoryTurnover = (inventoryValue && inventoryValue > 0) ? monthlyCOGS / inventoryValue : 0;

        return {
            dailyRevenue,
            dailyExpenses,
            monthlyRevenue,
            monthlyExpenses,
            monthlyCOGS,
            grossProfit,
            netProfit,
            netCashFlow,
            avgServiceMargin,
            bestSellingProducts,
            mostProfitableServices,
            inventoryTurnover
        };
    }, [sales, serviceOrders, transactions, inventoryValue, currentMonth]);

    // --- UNIFIED TRANSACTIONS LIST ---
    const unifiedTransactions = useMemo(() => {
        let list: any[] = [];

        // Add Financial DB Transactions
        transactions.forEach(t => {
            if (!isSameMonth(parseISO(t.due_date), currentMonth)) return;
            list.push({
                id: `FT-${t.id}`,
                originalId: t.id,
                source: 'Manual',
                type: t.type === 'income' ? 'Receita' : 'Despesa',
                description: t.description,
                category: t.transaction_categories?.name || 'Geral',
                classification: t.transaction_categories?.classification || 'Variável',
                amount: Number(t.amount),
                date: t.due_date,
                paymentDate: t.payment_date,
                status: t.status === 'paid' ? 'Pago' : (new Date(t.due_date) < new Date() ? 'Vencido' : 'Pendente'),
                paymentMethod: t.payment_method || 'Diversos',
                cogs: 0,
                createdBy: t.created_by || 'Sistema'
            });
        });

        // Add Sales Transactions
        sales.forEach(s => {
            if (!isSameMonth(parseISO(s.date), currentMonth)) return;
            let cogs = 0;
            const items = Array.isArray(s.items) ? s.items : (typeof s.items === 'string' ? JSON.parse(s.items || '[]') : []);
            items.forEach((item: any) => { cogs += ((item.costPrice || 0) * (item.quantity || 1)); });

            list.push({
                id: `SA-${s.id}`,
                originalId: s.id,
                source: 'Venda',
                type: 'Receita',
                description: `Venda ${s.id}`,
                category: 'Vendas de Produtos',
                classification: 'Operacional',
                amount: s.total,
                date: s.date,
                paymentDate: s.date,
                status: 'Pago',
                paymentMethod: Array.isArray(s.payments) && s.payments[0] ? s.payments[0].method : 'Variado',
                cogs: cogs,
                createdBy: 'Sistema PDV'
            });
        });

        // Add Service Order Transactions
        serviceOrders.forEach(so => {
            const d = so.exitDate || so.createdAt;
            if (!d || !isSameMonth(parseISO(d), currentMonth)) return;
            let cogs = 0;
            const items = Array.isArray(so.items) ? so.items : (typeof so.items === 'string' ? JSON.parse(so.items || '[]') : []);
            items.forEach((item: any) => { if (item.type === 'part') cogs += ((item.cost || 0) * (item.quantity || 1)); });

            list.push({
                id: `SO-${so.id}`,
                originalId: so.id,
                source: 'OS',
                type: 'Receita',
                description: `OS ${so.id}`,
                category: 'Serviços Técnicos',
                classification: 'Operacional',
                amount: so.total,
                date: d,
                paymentDate: d,
                status: 'Pago',
                paymentMethod: Array.isArray(so.payments) && so.payments[0] ? so.payments[0].method : 'Variado',
                cogs: cogs,
                createdBy: 'Laboratório'
            });
        });

        // Filter and Sort
        return list.filter(t => {
            if (typeFilter !== 'Todos' && t.type !== typeFilter) return false;
            if (statusFilter !== 'Todos') {
                if (statusFilter === 'Pago' && t.status !== 'Pago') return false;
                if (statusFilter === 'Pendente' && t.status !== 'Pendente') return false;
                if (statusFilter === 'Vencido' && t.status !== 'Vencido') return false;
            }
            if (searchQuery) {
                const s = searchQuery.toLowerCase();
                if (!t.description.toLowerCase().includes(s) && !t.category.toLowerCase().includes(s)) return false;
            }
            return true;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [sales, serviceOrders, transactions, currentMonth, typeFilter, statusFilter, searchQuery]);


    const navMonth = (offset: number) => {
        const d = new Date(currentMonth);
        d.setMonth(d.getMonth() + offset);
        setCurrentMonth(d);
        setCurrentPage(1);
    };

    const handleDeleteTransaction = async (unifiedId: string, originalId: string, source: string) => {
        if (source !== 'Manual') {
            alert('Não é possível excluir Lançamentos automáticos (Vendas/OS) por aqui. Cancele a Venda ou OS na respectiva tela.');
            return;
        }
        if (window.confirm('Deseja realmente excluir este lançamento financeiro?')) {
            const { error } = await supabase.from('financial_transactions').delete().eq('id', originalId);
            if (!error) {
                setTransactions(transactions.filter(t => t.id !== originalId));
            } else {
                alert('Erro ao excluir transação.');
            }
        }
    };

    // --- CHARTS DATA ---
    const monthlyChartData = useMemo(() => {
        const dataMap: Record<string, { name: string, Receitas: number, Despesas: number }> = {};
        const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

        for (let i = 1; i <= daysInMonth; i++) {
            dataMap[i] = { name: `${i}`, Receitas: 0, Despesas: 0 };
        }

        sales.forEach(s => {
            if (isSameMonth(parseISO(s.date), currentMonth)) {
                const day = parseISO(s.date).getDate();
                dataMap[day].Receitas += (s.total || 0);
            }
        });
        serviceOrders.forEach(so => {
            const d = so.exitDate || so.createdAt;
            if (d && isSameMonth(parseISO(d), currentMonth)) {
                const day = parseISO(d).getDate();
                dataMap[day].Receitas += (so.total || 0);
            }
        });
        transactions.forEach(t => {
            const d = t.payment_date || t.due_date;
            if (d && isSameMonth(parseISO(d), currentMonth) && t.status === 'paid') {
                const day = parseISO(d).getDate();
                if (t.type === 'expense') dataMap[day].Despesas += t.amount;
                if (t.type === 'income') dataMap[day].Receitas += t.amount;
            }
        });

        return Object.values(dataMap);
    }, [sales, serviceOrders, transactions, currentMonth]);

    const totalPages = Math.ceil(unifiedTransactions.length / ITEMS_PER_PAGE) || 1;
    const paginatedTransactions = unifiedTransactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto bg-[#F8FAFC] min-h-screen text-gray-900 pb-20">
            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                            <BarChart2 className="text-gray-900 h-8 w-8" />
                            Arquitetura Financeira (ERP)
                        </h1>
                        <p className="text-gray-500 text-sm mt-1 font-medium">Gestão inteligente de Estoque, Caixa e Rentabilidade</p>
                    </div>
                </div>

                <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200 inline-flex">
                    <button onClick={() => handleTabChange('dashboard')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>DASHBOARD (KPIs)</button>
                    <button onClick={() => handleTabChange('transactions')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'transactions' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>LANÇAMENTOS</button>
                    <button onClick={() => handleTabChange('installments')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'installments' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>CREDIÁRIOS</button>
                </div>
            </div>

            {/* Date Nav (Applies to Dashboard and Lançamentos) */}
            {activeTab !== 'installments' && (
                <div className="flex items-center justify-center gap-5 bg-gray-900 py-4 px-8 rounded-3xl border border-gray-800 max-w-md mx-auto shadow-md">
                    <button onClick={() => navMonth(-1)} className="p-2 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-colors"><ChevronLeft size={24} /></button>
                    <span className="font-extrabold w-64 text-center capitalize text-2xl text-white tracking-wide">
                        {format(currentMonth, 'MMMM / yyyy', { locale: ptBR })}
                    </span>
                    <button onClick={() => navMonth(1)} className="p-2 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-colors"><ChevronRight size={24} /></button>
                </div>
            )}

            {isLoading ? (
                <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>
            ) : (
                <>
                    {/* TAB: DASHBOARD (KPIs) */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-6 animate-fade-in">

                            {/* TOP 5 MASTER KPIs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                                    <div className="flex items-center justify-between opacity-80 mb-2"><span className="text-sm font-black uppercase tracking-wider">Receita (Hoje)</span><TrendingUp size={18} /></div>
                                    <div className="text-3xl font-extrabold">{formatCurrency(dashboardMetrics.dailyRevenue)}</div>
                                </div>
                                <div className="bg-gradient-to-br from-rose-500 to-rose-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                                    <div className="flex items-center justify-between opacity-80 mb-2"><span className="text-sm font-black uppercase tracking-wider">Despesas (Hoje)</span><TrendingDown size={18} /></div>
                                    <div className="text-3xl font-extrabold">{formatCurrency(dashboardMetrics.dailyExpenses)}</div>
                                </div>
                                <div className="bg-white border text-gray-900 border-gray-200 rounded-2xl p-5 shadow-sm relative group hover:shadow-md transition-all">
                                    <div className="flex items-center justify-between text-gray-500 mb-2"><span className="text-sm font-bold uppercase">Fluxo de Caixa Líquido</span><Scale size={18} className="text-blue-500" /></div>
                                    <div className={`text-2xl font-extrabold ${dashboardMetrics.netCashFlow >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(dashboardMetrics.netCashFlow)}</div>
                                    <div className="text-xs text-gray-400 mt-1">Receita Mensal - Despesas Mensais</div>
                                </div>
                                <div className="bg-white border text-gray-900 border-gray-200 rounded-2xl p-5 shadow-sm relative group hover:shadow-md transition-all">
                                    <div className="flex items-center justify-between text-gray-500 mb-2"><span className="text-sm font-bold uppercase">Lucro Bruto</span><DollarSign size={18} className="text-emerald-500" /></div>
                                    <div className="text-2xl font-extrabold text-gray-900">{formatCurrency(dashboardMetrics.grossProfit)}</div>
                                    <div className="text-xs text-gray-400 mt-1">Receita Mensal - CMV (Custo de Estoque)</div>
                                </div>
                                <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 shadow-lg relative group transition-all text-white">
                                    <div className="flex items-center justify-between text-emerald-100 mb-2"><span className="text-sm font-bold uppercase">Lucro Líquido</span><BarChart2 size={18} className="text-white" /></div>
                                    <div className="text-2xl font-extrabold text-white">{formatCurrency(dashboardMetrics.netProfit)}</div>
                                    <div className="text-xs text-emerald-100 mt-1">Lucro Bruto - Despesas Operacionais</div>
                                </div>
                            </div>

                            {/* MID SECTION: CHARTS AND INVENTORY */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><TrendingUp className="text-blue-500" /> Receitas vs Despesas (Mês)</h3>
                                    <div className="h-72 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(val) => `R$${val / 1000}k`} />
                                                <Tooltip
                                                    cursor={{ fill: '#F3F4F6' }}
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                    formatter={(value: number) => formatCurrency(value)}
                                                />
                                                <Bar dataKey="Receitas" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                                <Bar dataKey="Despesas" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Inventory & Margins Details */}
                                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Package className="text-orange-500" /> Ativos & Margens</h3>
                                        <div className="space-y-5">
                                            <div>
                                                <div className="flex justify-between text-sm mb-1"><span className="text-gray-500 font-medium">Valor em Estoque (Custo)</span><span className="font-bold text-gray-900">{formatCurrency(inventoryValue)}</span></div>
                                                <div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-orange-500 h-2 rounded-full w-full"></div></div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-sm mb-1"><span className="text-gray-500 font-medium">Custo da Mercadoria Vendida (Mês)</span><span className="font-bold text-orange-600">{formatCurrency(dashboardMetrics.monthlyCOGS)}</span></div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-sm mb-1"><span className="text-gray-500 font-medium">Giro de Estoque (Mês)</span><span className="font-bold text-indigo-600">{dashboardMetrics.inventoryTurnover.toFixed(2)}x</span></div>
                                            </div>
                                            <div className="pt-4 border-t border-gray-100">
                                                <div className="flex justify-between items-center"><span className="text-gray-800 font-bold">Margem Média de Serviços</span><span className="px-3 py-1 bg-emerald-100 text-emerald-700 font-bold text-sm rounded-lg">{dashboardMetrics.avgServiceMargin.toFixed(1)}%</span></div>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* BOTTOM SECTION: RANKINGS */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Top Products */}
                                <div className="bg-white border text-gray-900 border-gray-200 rounded-2xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><ShoppingBag className="text-blue-500" /> Produtos Mais Vendidos</h3>
                                    {dashboardMetrics.bestSellingProducts.length > 0 ? (
                                        <div className="space-y-3">
                                            {dashboardMetrics.bestSellingProducts.map((p, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">{i + 1}</div>
                                                        <span className="font-medium text-sm truncate max-w-[200px]">{p.name}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-bold text-gray-900 text-sm">{p.qty} un</div>
                                                        <div className="text-xs text-gray-500">{formatCurrency(p.revenue)}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">Sem vendas no período</div>
                                    )}
                                </div>

                                {/* Top Services */}
                                <div className="bg-white border text-gray-900 border-gray-200 rounded-2xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Wrench className="text-purple-500" /> Serviços Mais Lucrativos</h3>
                                    {dashboardMetrics.mostProfitableServices.length > 0 ? (
                                        <div className="space-y-3">
                                            {dashboardMetrics.mostProfitableServices.map((s, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">{i + 1}</div>
                                                        <span className="font-medium text-sm truncate max-w-[200px]">{s.name}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-bold text-emerald-600 text-sm">Lucro: {formatCurrency(s.sumProfit)}</div>
                                                        <div className="text-xs text-gray-500">{s.count} vezes realizado</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">Sem serviços no período</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: LANÇAMENTOS TRANSACTIONS TABLE */}
                    {activeTab === 'transactions' && (
                        <div className="animate-fade-in space-y-4">
                            <div className="flex flex-wrap items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                <div className="flex gap-3">
                                    <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border border-gray-300 hover:border-indigo-400 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100 transition-all">
                                        <option value="Todos">Tipo: Todos</option>
                                        <option value="Receita">Receita</option>
                                        <option value="Despesa">Despesa</option>
                                    </select>
                                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 hover:border-indigo-400 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100 transition-all">
                                        <option value="Todos">Status: Todos</option>
                                        <option value="Pago">Pago</option>
                                        <option value="Pendente">Pendente</option>
                                        <option value="Vencido">Vencido</option>
                                    </select>
                                    <div className="relative">
                                        <input
                                            type="text" placeholder="Buscar lançamento..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-[250px] border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-indigo-500 outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                                        />
                                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                    </div>
                                </div>
                                <button className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md hover:bg-gray-800 transition-all flex items-center gap-2">
                                    <Plus size={18} /> Adicionar Lançamento
                                </button>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                                <th className="py-4 px-6">Data</th>
                                                <th className="py-4 px-6">Descrição / Origem</th>
                                                <th className="py-4 px-6">Categoria</th>
                                                <th className="py-4 px-6">Status</th>
                                                <th className="py-4 px-6 text-right">CMV Associado</th>
                                                <th className="py-4 px-6 text-right">Valor Final</th>
                                                <th className="py-4 px-6 text-right">Lucro</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-sm">
                                            {paginatedTransactions.length === 0 ? (
                                                <tr><td colSpan={7} className="py-12 text-center text-gray-400">Nenhum lançamento no período.</td></tr>
                                            ) : paginatedTransactions.map((t) => (
                                                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="py-3 px-6 whitespace-nowrap text-gray-600 font-medium">{formatDate(t.date)}</td>
                                                    <td className="py-3 px-6">
                                                        <div className="font-bold text-gray-900">{t.description}</div>
                                                        <div className="text-[11px] text-gray-400 uppercase tracking-wider mt-0.5">{t.source} • {t.createdBy}</div>
                                                    </td>
                                                    <td className="py-3 px-6"><span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold border border-gray-200">{t.category}</span></td>
                                                    <td className="py-3 px-6">
                                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider border ${t.status === 'Pago' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : t.status === 'Vencido' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                                            {t.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-6 text-right text-gray-400 whitespace-nowrap">
                                                        {t.cogs > 0 ? <span className="text-orange-500 font-medium">-{formatCurrency(t.cogs)}</span> : '—'}
                                                    </td>
                                                    <td className="py-3 px-6 text-right font-black whitespace-nowrap text-base text-gray-900">
                                                        {t.type === 'Receita' ? '+ ' : '- '}{formatCurrency(t.amount)}
                                                    </td>
                                                    <td className="py-3 px-6 text-right font-bold whitespace-nowrap text-emerald-600">
                                                        {t.type === 'Receita' ? formatCurrency(t.amount - (t.cogs || 0)) : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Footer */}
                                <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div className="text-sm font-medium text-gray-500 flex items-center gap-4">
                                        <div>Total registros: <span className="text-gray-900 font-bold">{unifiedTransactions.length}</span></div>
                                        <div className="flex items-center gap-2">
                                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)} className="p-1.5 hover:bg-gray-200 rounded-lg disabled:opacity-50"><ChevronLeft size={16} /></button>
                                            <span className="text-xs bg-white border border-gray-200 px-3 py-1 rounded-md">{currentPage} de {totalPages}</span>
                                            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)} className="p-1.5 hover:bg-gray-200 rounded-lg disabled:opacity-50"><ChevronRight size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: CREDIARIOS */}
                    {activeTab === 'installments' && (
                        <div className="animate-fade-in"><CreditDashboard /></div>
                    )}
                </>
            )}
        </div>
    );
}
