import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.ts';
import { Calendar, BarChart3, MessageCircle, ShoppingBag, Eye } from 'lucide-react';
import { CatalogEvent, CatalogItem } from '../../types.ts';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CatalogStats: React.FC = () => {
    const [period, setPeriod] = useState<'hoje' | 'ontem' | 'semana' | 'mes' | 'personalizado'>('hoje');
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // metrics
    const [totalViews, setTotalViews] = useState(0);
    const [totalConversations, setTotalConversations] = useState(0);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                let start = startOfDay(new Date());
                let end = endOfDay(new Date());

                if (period === 'hoje') {
                    // already set
                } else if (period === 'ontem') {
                    start = startOfDay(subDays(new Date(), 1));
                    end = endOfDay(subDays(new Date(), 1));
                } else if (period === 'semana') {
                    start = startOfWeek(new Date(), { locale: ptBR });
                    end = endOfWeek(new Date(), { locale: ptBR });
                } else if (period === 'mes') {
                    start = startOfMonth(new Date());
                    end = endOfMonth(new Date());
                } else if (period === 'personalizado') {
                    start = startOfDay(new Date(startDate + 'T00:00:00'));
                    end = endOfDay(new Date(endDate + 'T23:59:59'));
                }

                const startStr = start.toISOString();
                const endStr = end.toISOString();

                const { data, error } = await supabase
                    .from('catalog_events')
                    .select(`
                        id, event_type, product_id, catalog_item_id, created_at,
                        catalog_items ( product_name, product_brand )
                    `)
                    .gte('created_at', startStr)
                    .lte('created_at', endStr);

                if (error) {
                    console.error('Error fetching stats:', error);
                    return;
                }

                if (data) {
                    // Views
                    const views = data.filter(e => e.event_type === 'PAGE_VIEW').length;
                    setTotalViews(views);

                    // Conversations
                    const convs = data.filter(e => e.event_type === 'WHATSAPP_CLICK').length;
                    setTotalConversations(convs);

                    // Top Products in Cart
                    const cartAdds = data.filter(e => e.event_type === 'CART_ADD' && e.catalog_item_id);
                    const productMap: Record<string, { name: string, cnt: number }> = {};

                    cartAdds.forEach(e => {
                        const cid = e.catalog_item_id as string;
                        if (!productMap[cid]) {
                            // Using any to access joined data
                            const cItem = (e as any).catalog_items;
                            productMap[cid] = {
                                name: cItem ? `${cItem.product_brand} ${cItem.product_name}` : 'Produto Desconhecido',
                                cnt: 0
                            };
                        }
                        productMap[cid].cnt++;
                    });

                    const sortedTop = Object.values(productMap).sort((a, b) => b.cnt - a.cnt).slice(0, 5);
                    setTopProducts(sortedTop);
                }

            } catch (e) {
                console.error('Fetch stats error', e);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [period, startDate, endDate]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Estatísticas do Catálogo</h2>
                    <p className="text-gray-500 text-sm">Acompanhe as visualizações e interações no seu catálogo virtual.</p>
                </div>
            </div>

            {/* Filter */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
                <div className="flex gap-2">
                    {['hoje', 'ontem', 'semana', 'mes', 'personalizado'].map((option) => (
                        <button
                            key={option}
                            onClick={() => setPeriod(option as any)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${period === option
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                        </button>
                    ))}
                </div>

                {period === 'personalizado' && (
                    <div className="flex items-center gap-2 md:ml-4 mt-2 md:mt-0">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block p-2"
                        />
                        <span className="text-gray-500">até</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block p-2"
                        />
                    </div>
                )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
                            <Eye size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Acessos Totais</p>
                            <h3 className="text-3xl font-bold text-gray-900">
                                {loading ? '...' : totalViews}
                            </h3>
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-auto">Visualizações do catálogo neste período</p>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                            <MessageCircle size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Conversas Iniciadas</p>
                            <h3 className="text-3xl font-bold text-gray-900">
                                {loading ? '...' : totalConversations}
                            </h3>
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-auto">Cliques no botão do WhatsApp</p>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl">
                            <ShoppingBag size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Produtos na Sacola</p>
                            <h3 className="text-3xl font-bold text-gray-900">
                                {loading ? '...' : topProducts.reduce((sum, p) => sum + p.cnt, 0)}
                            </h3>
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-auto">Ações de "Adicionar à Sacola"</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <ShoppingBag size={20} className="text-emerald-500" />
                    Produtos Mais Colocados na Sacola
                </h3>

                {loading ? (
                    <div className="animate-pulse space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-12 bg-gray-100 rounded-xl"></div>
                        ))}
                    </div>
                ) : topProducts.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        Nenhum produto adicionado à sacola no período selecionado.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {topProducts.map((p, index) => (
                            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                                <span className="font-semibold text-gray-900 truncate pr-4">{index + 1}. {p.name}</span>
                                <span className="flex-shrink-0 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-xl font-bold text-sm">
                                    {p.cnt} adições
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CatalogStats;
