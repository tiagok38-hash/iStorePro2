import React, { useState, useMemo } from 'react';
import { Product, ProductModel } from '../types.ts';
import { formatCurrency } from '../services/mockApi.ts';
import { SearchIcon } from './icons.tsx';

interface AveragePriceReportProps {
    products: Product[];
    productModels: ProductModel[];
}

const AveragePriceReport: React.FC<AveragePriceReportProps> = ({ products, productModels }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [modelCurrentPage, setModelCurrentPage] = useState(1);
    const [modelItemsPerPage, setModelItemsPerPage] = useState(15);

    const modelStats = useMemo(() => {
        const sortedModels = [...productModels].sort((a, b) => b.name.length - a.name.length);

        const getBaseModel = (fullName: string) => {
            let name = fullName.trim();
            const lowerName = name.toLowerCase();

            for (const m of sortedModels) {
                if (lowerName.includes(m.name.toLowerCase())) {
                    return m.name;
                }
            }

            const iphoneMatch = name.match(/iPhone\s+(?:\d+|X|SE|[IV]+)(?:\s?(?:Pro|Max|Plus|Mini|Ultra))*/i);
            if (iphoneMatch) return iphoneMatch[0];

            const ipadMatch = name.match(/iPad\s+(?:Air|Mini|Pro)?(?:\s?\d+(?:th|rd|nd|st)?\s?Gen)?(?:\s?\d+(\.\d+)?["”])?/i);
            if (ipadMatch) return ipadMatch[0];

            const watchMatch = name.match(/Apple\s?Watch\s+(?:Series\s?\d+|Ultra|SE)/i);
            if (watchMatch) return watchMatch[0];

            name = name.replace(/\b\d+\/?\d*\s*[GT]B\b/gi, '');

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
            totalSaleList: number
        }> = {};

        products.forEach(p => {
            if (!p.model) return;
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

            const condition = String(p.condition || 'N/A').trim();
            const brand = String(p.brand || '').trim();
            const category = String(p.category || '').trim();

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
                    totalSaleList: 0
                };
            }

            const stockQty = p.stock || 0;
            if (stockQty > 0) {
                groups[key].totalUnits += stockQty;
                groups[key].totalCost += ((p.costPrice || 0) + (p.additionalCostPrice || 0)) * stockQty;
                groups[key].totalWholesale += (p.wholesalePrice || 0) * stockQty;
                groups[key].totalSaleList += (p.price || 0) * stockQty;
            }
        });

        return Object.values(groups).map(g => {
            const avgCost = g.totalUnits > 0 ? g.totalCost / g.totalUnits : 0;
            const avgWholesale = g.totalUnits > 0 ? g.totalWholesale / g.totalUnits : 0;
            const avgListPrice = g.totalUnits > 0 ? g.totalSaleList / g.totalUnits : 0;

            const margin = avgListPrice > 0 ? ((avgListPrice - avgCost) / avgListPrice) * 100 : 0;

            return {
                ...g,
                stockUnits: g.totalUnits,
                avgCost,
                avgWholesale,
                avgListPrice,
                margin
            };
        })
            .filter(g => g.stockUnits > 0)
            .sort((a, b) => b.stockUnits - a.stockUnits);
    }, [products, productModels]);

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

    React.useEffect(() => { setModelCurrentPage(1); }, [searchTerm, modelItemsPerPage]);

    return (
        <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm overflow-hidden mt-6">
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
    );
};

export default AveragePriceReport;
