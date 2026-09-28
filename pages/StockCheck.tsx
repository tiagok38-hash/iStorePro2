import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product } from '../types.ts';
import { getProductsInStock } from '../services/mockApi.ts';
import { formatStorageUnit } from '../utils/formatters.ts';
import {
    CheckIcon,
    SuccessIcon,
    BarcodeIcon,
    ArrowPathIcon,
    PrinterIcon,
    TrashIcon,
    CloseIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    SpinnerIcon,
    SmartphoneIcon,
    PackageIcon,
    ClipboardListIcon,
    TagIcon
} from '../components/icons.tsx';

interface CheckedItemMeta {
    checkedAt: string;
}

interface InventorySession {
    sessionId: string;
    startedAt: string;
    lastUpdatedAt: string;
    checkedMap: Record<string, CheckedItemMeta>;
    notes?: Record<string, string>;
}

interface StockCheckFilters {
    active: boolean;
    source: string;
    selectedType?: 'apple' | 'other' | null;
    categories?: string[];
    conditions?: string[];
    models?: string[];
    storages?: string[];
    colors?: string[];
    brands?: string[];
    locationName?: string;
    productIds?: string[];
    timestamp?: number;
    totalCount?: number;
}

const STORAGE_KEY = 'istore_stock_check_session_v1';
const FILTERS_KEY = 'istore_stock_check_filters';

// Sintetizador de áudio simples para feedback sonoro de bip sem arquivos externos
const playBeep = (type: 'success' | 'error' | 'uncheck') => {
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now); // A5
            osc.frequency.setValueAtTime(1174.66, now + 0.08); // D6
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'uncheck') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.setValueAtTime(440, now + 0.08); // A4
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.start(now);
            osc.stop(now + 0.18);
        } else {
            // error
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        }
    } catch {
        // Silently fail if audio not allowed by browser policy
    }
};

export const StockCheck: React.FC = () => {
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'checked'>('all');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    // Filtros oriundos da ferramenta de geração de lista
    const [appliedFilters, setAppliedFilters] = useState<StockCheckFilters | null>(() => {
        try {
            const raw = localStorage.getItem(FILTERS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.active) return parsed;
            }
        } catch (e) {
            console.error('Erro ao ler filtros do localStorage:', e);
        }
        return null;
    });
    const [isFilterEnforced, setIsFilterEnforced] = useState(true);
    
    // Controle da sessão persistida
    const [session, setSession] = useState<InventorySession>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Erro ao ler sessão do localStorage:', e);
        }
        return {
            sessionId: 'inv_' + Date.now(),
            startedAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            checkedMap: {}
        };
    });

    // Feedback visual de bip recente
    const [recentCheckedId, setRecentCheckedId] = useState<string | null>(null);
    const [scanMessage, setScanMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Modais
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [copiedReport, setCopiedReport] = useState(false);

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Atualiza filtros com base na URL ao abrir
    useEffect(() => {
        const hash = window.location.hash || '';
        if (hash.includes('full=true')) {
            setIsFilterEnforced(false);
        } else if (hash.includes('from=pricelist') || hash.includes('filtered=true')) {
            setIsFilterEnforced(true);
            try {
                const raw = localStorage.getItem(FILTERS_KEY);
                if (raw) {
                    setAppliedFilters(JSON.parse(raw));
                }
            } catch (e) {
                console.error(e);
            }
        }
    }, []);

    // Salva no localStorage a cada alteração da sessão
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        } catch (e) {
            console.error('Erro ao gravar sessão no localStorage:', e);
        }
    }, [session]);

    // Carrega os produtos em estoque com paginação completa
    const loadProducts = async () => {
        setIsLoading(true);
        try {
            const data = await getProductsInStock();
            // Ordenar por Modelo e depois por Cor/Armazenamento
            const sorted = [...data].sort((a, b) => {
                const catComp = (a.category || '').localeCompare(b.category || '');
                if (catComp !== 0) return catComp;
                const modelComp = (a.model || '').localeCompare(b.model || '');
                if (modelComp !== 0) return modelComp;
                return (a.color || '').localeCompare(b.color || '');
            });
            setAllProducts(sorted);
        } catch (error) {
            console.error('Falha ao carregar estoque para conferência:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadProducts();
    }, []);

    // Produtos filtrados estritamente pela seleção feita na ferramenta de listas
    const products = useMemo(() => {
        if (!appliedFilters || !appliedFilters.active || !isFilterEnforced) {
            return allProducts;
        }

        // 1. Filtragem exata por IDs selecionados na geração de lista
        if (appliedFilters.productIds && appliedFilters.productIds.length > 0) {
            const idSet = new Set(appliedFilters.productIds);
            return allProducts.filter(p => idSet.has(p.id));
        }

        // 2. Fallback baseado nos critérios
        let res = allProducts;
        if (appliedFilters.selectedType === 'apple') {
            res = res.filter(p => (p.brand || '').toLowerCase().includes('apple'));
        } else if (appliedFilters.selectedType === 'other') {
            res = res.filter(p => !(p.brand || '').toLowerCase().includes('apple'));
            if (appliedFilters.brands && appliedFilters.brands.length > 0) {
                res = res.filter(p => appliedFilters.brands!.some(b => b.toLowerCase().trim() === (p.brand || '').toLowerCase().trim()));
            }
        }

        if (appliedFilters.categories && appliedFilters.categories.length > 0) {
            res = res.filter(p => appliedFilters.categories!.some(cat => cat.toLowerCase().trim() === (p.category || '').toLowerCase().trim()));
        }
        if (appliedFilters.conditions && appliedFilters.conditions.length > 0) {
            res = res.filter(p => appliedFilters.conditions!.some(cond => cond.toLowerCase().trim() === (p.condition || '').toLowerCase().trim()));
        }
        if (appliedFilters.models && appliedFilters.models.length > 0) {
            res = res.filter(p => appliedFilters.models!.some(mod => mod.toLowerCase().trim() === (p.model || '').toLowerCase().trim()));
        }
        if (appliedFilters.storages && appliedFilters.storages.length > 0) {
            res = res.filter(p => appliedFilters.storages!.includes(p.storage?.toString() || ''));
        }
        if (appliedFilters.colors && appliedFilters.colors.length > 0) {
            res = res.filter(p => appliedFilters.colors!.some(col => col.toLowerCase().trim() === (p.color || '').toLowerCase().trim()));
        }
        if (appliedFilters.locationName) {
            res = res.filter(p => p.storageLocation === appliedFilters.locationName);
        }

        return res;
    }, [allProducts, appliedFilters, isFilterEnforced]);

    const handleToggleEnforceFilter = () => {
        setIsFilterEnforced(prev => !prev);
    };

    const handleClearSavedFilter = () => {
        setAppliedFilters(null);
        setIsFilterEnforced(false);
        try {
            localStorage.removeItem(FILTERS_KEY);
        } catch (e) {
            console.error(e);
        }
    };

    // Toggle de check individual com persistência instantânea
    const handleToggleCheck = (productId: string) => {
        setSession(prev => {
            const nextChecked = { ...prev.checkedMap };
            const isCurrentlyChecked = !!nextChecked[productId];

            if (isCurrentlyChecked) {
                delete nextChecked[productId];
                playBeep('uncheck');
            } else {
                nextChecked[productId] = {
                    checkedAt: new Date().toISOString()
                };
                playBeep('success');
            }

            return {
                ...prev,
                lastUpdatedAt: new Date().toISOString(),
                checkedMap: nextChecked
            };
        });
    };

    // Submissão do leitor/busca de código de barras
    const handleScanSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const term = searchQuery.trim().toLowerCase();
        if (!term) return;

        // Procura produto correspondente por IMEI, Serial ou SKU (ou código de barras)
        const found = products.find(p => {
            const imei1 = (p.imei1 || '').toLowerCase();
            const imei2 = (p.imei2 || '').toLowerCase();
            const serial = (p.serialNumber || '').toLowerCase();
            const sku = (p.sku || '').toLowerCase();
            const barcodes = (p.barcodes || []).map(b => b.toLowerCase());

            return imei1 === term ||
                   imei2 === term ||
                   serial === term ||
                   sku === term ||
                   barcodes.includes(term);
        });

        if (found) {
            // Se já estava conferido, apenas avisa
            const wasChecked = !!session.checkedMap[found.id];
            if (!wasChecked) {
                setSession(prev => ({
                    ...prev,
                    lastUpdatedAt: new Date().toISOString(),
                    checkedMap: {
                        ...prev.checkedMap,
                        [found.id]: { checkedAt: new Date().toISOString() }
                    }
                }));
                playBeep('success');
            } else {
                playBeep('success');
            }

            setRecentCheckedId(found.id);
            setScanMessage({
                text: `${wasChecked ? 'Já conferido:' : 'Conferido com sucesso:'} ${found.model} ${found.color || ''} (IMEI/Serial: ${found.imei1 || found.serialNumber || found.sku})`,
                type: 'success'
            });

            // Rolagem suave até o item encontrado
            const el = document.getElementById(`product-row-${found.id}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            setSearchQuery('');
        } else {
            playBeep('error');
            setScanMessage({
                text: `Item não encontrado no estoque com o código "${searchQuery}". Verifique o valor digitado.`,
                type: 'error'
            });
        }

        // Limpa aviso após 4s
        setTimeout(() => {
            setScanMessage(null);
        }, 4000);
    };

    // Reiniciar conferência
    const handleResetSession = () => {
        const newSession: InventorySession = {
            sessionId: 'inv_' + Date.now(),
            startedAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            checkedMap: {}
        };
        setSession(newSession);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
        } catch (e) {
            console.error(e);
        }
        setShowResetConfirm(false);
        setScanMessage({ text: 'Nova conferência iniciada!', type: 'success' });
        setTimeout(() => setScanMessage(null), 3000);
    };

    // Estatísticas gerais
    const stats = useMemo(() => {
        const total = products.length;
        let checked = 0;

        products.forEach(p => {
            if (session.checkedMap[p.id]) checked++;
        });

        const pending = Math.max(0, total - checked);
        const percent = total > 0 ? Math.round((checked / total) * 100) : 0;

        return { total, checked, pending, percent };
    }, [products, session.checkedMap]);

    // Lista de categorias distintas
    const categories = useMemo(() => {
        const set = new Set<string>();
        products.forEach(p => {
            if (p.category) set.add(p.category);
        });
        return Array.from(set).sort();
    }, [products]);

    // Filtragem dos produtos
    const filteredProducts = useMemo(() => {
        const term = searchQuery.trim().toLowerCase();

        return products.filter(p => {
            const isChecked = !!session.checkedMap[p.id];

            // Filtro de status
            if (statusFilter === 'pending' && isChecked) return false;
            if (statusFilter === 'checked' && !isChecked) return false;

            // Filtro de categoria
            if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;

            // Filtro de busca textual (se não submeteu no bipador, filtra em tempo real)
            if (term) {
                const matchModel = (p.model || '').toLowerCase().includes(term);
                const matchColor = (p.color || '').toLowerCase().includes(term);
                const matchImei1 = (p.imei1 || '').toLowerCase().includes(term);
                const matchImei2 = (p.imei2 || '').toLowerCase().includes(term);
                const matchSerial = (p.serialNumber || '').toLowerCase().includes(term);
                const matchSku = (p.sku || '').toLowerCase().includes(term);
                const matchLocation = (p.storageLocation || '').toLowerCase().includes(term);

                if (!matchModel && !matchColor && !matchImei1 && !matchImei2 && !matchSerial && !matchSku && !matchLocation) {
                    return false;
                }
            }

            return true;
        });
    }, [products, session.checkedMap, statusFilter, selectedCategory, searchQuery]);

    // Agrupamento por Categoria -> Modelo
    const grouped = useMemo(() => {
        const map: Record<string, Record<string, Product[]>> = {};

        filteredProducts.forEach(p => {
            const cat = p.category || 'Outros';
            const mod = p.model || 'Sem Modelo';

            if (!map[cat]) map[cat] = {};
            if (!map[cat][mod]) map[cat][mod] = [];

            map[cat][mod].push(p);
        });

        return map;
    }, [filteredProducts]);

    const toggleGroupCollapse = (key: string) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // Monta o texto do relatório de faltantes / conferência
    const generateReportText = () => {
        const checkedItems = products.filter(p => !!session.checkedMap[p.id]);
        const missingItems = products.filter(p => !session.checkedMap[p.id]);

        const dateStr = new Date(session.startedAt).toLocaleString('pt-BR');
        const updatedStr = new Date(session.lastUpdatedAt).toLocaleString('pt-BR');

        let text = `📦 *RELATÓRIO DE CONFERÊNCIA DE ESTOQUE - iStorePro*\n`;
        text += `Início: ${dateStr}\n`;
        text += `Última Atualização: ${updatedStr}\n`;
        text += `-------------------------------------------\n`;
        text += `📊 *RESUMO GERAL:*\n`;
        text += `• Total no Estoque: ${stats.total} itens\n`;
        text += `• Conferidos (OK): ${stats.checked} itens (${stats.percent}%)\n`;
        text += `• Pendentes/Faltantes: ${stats.pending} itens\n`;
        text += `-------------------------------------------\n\n`;

        if (missingItems.length > 0) {
            text += `🚨 *ITENS PENDENTES / FALTANTES (${missingItems.length}):*\n`;
            missingItems.forEach((p, idx) => {
                const storageStr = p.storage ? ` ${formatStorageUnit(p.storage)}` : '';
                const colorStr = p.color ? ` - ${p.color}` : '';
                const idStr = p.imei1 ? `IMEI: ${p.imei1}` : (p.serialNumber ? `S/N: ${p.serialNumber}` : `SKU: ${p.sku}`);
                const locStr = p.storageLocation ? ` | 📍 ${p.storageLocation}` : '';

                text += `${idx + 1}. ${p.model}${storageStr}${colorStr} (${idStr}${locStr})\n`;
            });
            text += `\n-------------------------------------------\n\n`;
        }

        text += `✅ *ITENS CONFERIDOS (${checkedItems.length}):*\n`;
        checkedItems.forEach((p, idx) => {
            const storageStr = p.storage ? ` ${formatStorageUnit(p.storage)}` : '';
            const colorStr = p.color ? ` - ${p.color}` : '';
            const idStr = p.imei1 ? `IMEI: ${p.imei1}` : (p.serialNumber ? `S/N: ${p.serialNumber}` : `SKU: ${p.sku}`);
            text += `${idx + 1}. ${p.model}${storageStr}${colorStr} (${idStr})\n`;
        });

        return text;
    };

    const handleCopyReport = () => {
        const text = generateReportText();
        navigator.clipboard.writeText(text);
        setCopiedReport(true);
        setTimeout(() => setCopiedReport(false), 3000);
    };

    const handlePrintReport = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
            {/* Topbar Fixo com Indicador de Progresso */}
            <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-xl px-4 py-3 sm:px-6">
                <div className="max-w-7xl mx-auto flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
                                <SuccessIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                                    Conferência de Estoque
                                    <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        Ativo
                                    </span>
                                </h1>
                                <p className="text-xs text-slate-400">
                                    Salvamento automático no dispositivo • Não perde progresso ao fechar
                                </p>
                            </div>
                        </div>

                        {/* Botões de Ação do Topo */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowReportModal(true)}
                                className="h-10 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 shadow-sm"
                                title="Visualizar Resumo da Conferência"
                            >
                                <ClipboardListIcon className="w-4 h-4 text-emerald-400" />
                                <span className="hidden sm:inline">Relatório / Resumo</span>
                            </button>

                            <button
                                onClick={loadProducts}
                                disabled={isLoading}
                                className="h-10 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                                title="Atualizar dados do estoque"
                            >
                                <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
                                <span className="hidden md:inline">Recarregar</span>
                            </button>

                            <button
                                onClick={() => setShowResetConfirm(true)}
                                className="h-10 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95"
                                title="Limpar checks e iniciar novo inventário"
                            >
                                <TrashIcon className="w-4 h-4" />
                                <span className="hidden lg:inline">Reiniciar</span>
                            </button>
                        </div>
                    </div>

                    {/* Barra de Progresso e Métricas */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-4 bg-slate-950/60 p-2.5 sm:p-3 rounded-2xl border border-slate-800/80">
                        <div className="flex flex-col">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total em Estoque</span>
                            <span className="text-base sm:text-xl font-black text-slate-100">{stats.total} itens</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                                <CheckIcon className="w-3.5 h-3.5" /> Conferidos
                            </span>
                            <span className="text-base sm:text-xl font-black text-emerald-400">
                                {stats.checked} <span className="text-xs font-medium text-slate-400">({stats.percent}%)</span>
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Pendentes</span>
                            <span className="text-base sm:text-xl font-black text-amber-400">{stats.pending} itens</span>
                        </div>

                        {/* Barra visual de preenchimento */}
                        <div className="col-span-3 w-full bg-slate-800 h-2.5 rounded-full overflow-hidden mt-1 border border-slate-700/50">
                            <div
                                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300 shadow-sm shadow-emerald-500/50"
                                style={{ width: `${stats.percent}%` }}
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* Aviso Flutuante de Bip / Leitura */}
            {scanMessage && (
                <div
                    className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl border text-sm font-bold flex items-center gap-3 animate-bounce transition-all ${
                        scanMessage.type === 'success'
                            ? 'bg-emerald-600 text-white border-emerald-400/30'
                            : 'bg-rose-600 text-white border-rose-400/30'
                    }`}
                >
                    {scanMessage.type === 'success' ? (
                        <SuccessIcon className="w-5 h-5 flex-shrink-0" />
                    ) : (
                        <CloseIcon className="w-5 h-5 flex-shrink-0" />
                    )}
                    <span>{scanMessage.text}</span>
                </div>
            )}

            {/* Barra de Ferramentas / Bipador e Filtros */}
            <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 flex flex-col gap-6">
                {/* Banner Informativo de Filtro da Geração de Lista */}
                {appliedFilters && appliedFilters.active && (
                    <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-500/40 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg shadow-emerald-950/30">
                        <div className="flex items-start sm:items-center gap-3">
                            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                                <TagIcon className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                                        Filtro da Geração de Lista Ativo
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold">
                                        {products.length} {products.length === 1 ? 'item' : 'itens'} selecionados (de {allProducts.length} no estoque)
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-bold border border-slate-700">
                                        {appliedFilters.selectedType === 'apple' ? '🍎 Apple' : '📱 Outros'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-400">
                                    {appliedFilters.categories && appliedFilters.categories.length > 0 && (
                                        <span>Categorias: <strong className="text-slate-200">{appliedFilters.categories.join(', ')}</strong></span>
                                    )}
                                    {appliedFilters.conditions && appliedFilters.conditions.length > 0 && (
                                        <span>Condições: <strong className="text-slate-200">{appliedFilters.conditions.join(', ')}</strong></span>
                                    )}
                                    {appliedFilters.storages && appliedFilters.storages.length > 0 && (
                                        <span>Capacidades: <strong className="text-slate-200">{appliedFilters.storages.map(s => `${s}GB`).join(', ')}</strong></span>
                                    )}
                                    {appliedFilters.colors && appliedFilters.colors.length > 0 && (
                                        <span>Cores: <strong className="text-slate-200">{appliedFilters.colors.join(', ')}</strong></span>
                                    )}
                                    {appliedFilters.locationName && (
                                        <span className="text-amber-400 font-bold">📍 Local: {appliedFilters.locationName}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 self-end md:self-auto">
                            <button
                                onClick={handleToggleEnforceFilter}
                                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                                    isFilterEnforced
                                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-600/20'
                                }`}
                                title={isFilterEnforced ? "Visualizar todos os produtos do estoque geral" : "Restringir apenas aos produtos selecionados"}
                            >
                                {isFilterEnforced ? `Ver Todo o Estoque (${allProducts.length})` : `Restringir Seleção (${products.length})`}
                            </button>
                            <button
                                onClick={handleClearSavedFilter}
                                className="px-2.5 py-2 text-slate-400 hover:text-rose-400 text-xs font-bold transition-colors"
                                title="Remover este filtro permanentemente"
                            >
                                Remover
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-slate-800/60 p-4 rounded-2xl border border-slate-700/50">
                    {/* Bipador / Input com suporte a leitor físico ou digitação */}
                    <form onSubmit={handleScanSubmit} className="flex-1 relative flex items-center">
                        <div className="absolute left-4 text-slate-400 pointer-events-none flex items-center gap-1.5">
                            <BarcodeIcon className="w-5 h-5 text-emerald-400" />
                        </div>
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Bipe com leitor de código de barras ou digite IMEI, Serial, SKU..."
                            className="w-full pl-12 pr-28 py-3.5 bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-100 placeholder-slate-500 rounded-xl text-sm font-medium transition-all shadow-inner outline-none"
                        />
                        <button
                            type="submit"
                            className="absolute right-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-emerald-600/20"
                        >
                            Bipar
                        </button>
                    </form>

                    {/* Filtros de Status (Todos, Pendentes, Conferidos) */}
                    <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-700/60 self-start sm:self-auto overflow-x-auto w-full lg:w-auto">
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                statusFilter === 'all'
                                    ? 'bg-slate-700 text-white shadow'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            Todos ({stats.total})
                        </button>
                        <button
                            onClick={() => setStatusFilter('pending')}
                            className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                statusFilter === 'pending'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'text-slate-400 hover:text-amber-300'
                            }`}
                        >
                            Pendentes ({stats.pending})
                        </button>
                        <button
                            onClick={() => setStatusFilter('checked')}
                            className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                statusFilter === 'checked'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'text-slate-400 hover:text-emerald-300'
                            }`}
                        >
                            Conferidos ({stats.checked})
                        </button>
                    </div>

                    {/* Filtro por Categoria */}
                    {categories.length > 0 && (
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            aria-label="Filtrar por Categoria"
                            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold py-3.5 px-3 rounded-xl focus:border-emerald-500 outline-none cursor-pointer"
                        >
                            <option value="all">Todas as Categorias</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Lista de Produtos Agrupada */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 bg-slate-800/30 rounded-3xl border border-slate-800">
                        <SpinnerIcon className="w-10 h-10 animate-spin text-emerald-400" />
                        <span className="text-sm font-bold text-slate-400 animate-pulse">
                            Carregando produtos do estoque...
                        </span>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-slate-800/30 rounded-3xl border border-slate-800">
                        <PackageIcon className="w-14 h-14 text-slate-600 mb-3" />
                        <h3 className="text-base font-bold text-slate-300">Nenhum produto encontrado</h3>
                        <p className="text-xs text-slate-500 max-w-sm mt-1">
                            {searchQuery
                                ? `Nenhum item corresponde ao termo "${searchQuery}" nos filtros selecionados.`
                                : statusFilter === 'pending'
                                ? 'Parabéns! Todos os produtos nos filtros selecionados já foram conferidos!'
                                : 'Não há produtos disponíveis com os critérios atuais.'}
                        </p>
                        {(searchQuery || statusFilter !== 'all' || selectedCategory !== 'all') && (
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setStatusFilter('all');
                                    setSelectedCategory('all');
                                }}
                                className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
                            >
                                Limpar Filtros
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {Object.entries(grouped).map(([categoryName, modelsMap]) => {
                            const categoryItemsCount = Object.values(modelsMap).reduce((acc, curr) => acc + curr.length, 0);
                            const categoryCheckedCount = Object.values(modelsMap).reduce(
                                (acc, curr) => acc + curr.filter(p => !!session.checkedMap[p.id]).length,
                                0
                            );
                            const isCatCollapsed = !!collapsedGroups[`cat_${categoryName}`];

                            return (
                                <div key={categoryName} className="flex flex-col gap-3">
                                    {/* Cabeçalho de Categoria */}
                                    <button
                                        onClick={() => toggleGroupCollapse(`cat_${categoryName}`)}
                                        className="flex items-center justify-between p-3.5 bg-slate-800/80 hover:bg-slate-800 rounded-2xl border border-slate-700/60 transition-all text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                                                <SmartphoneIcon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h2 className="text-sm font-black uppercase tracking-wider text-slate-100">
                                                    {categoryName}
                                                </h2>
                                                <span className="text-[11px] font-bold text-slate-400">
                                                    {categoryCheckedCount} de {categoryItemsCount} conferidos ({categoryItemsCount > 0 ? Math.round((categoryCheckedCount / categoryItemsCount) * 100) : 0}%)
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-700/50 hidden sm:block">
                                                <div
                                                    className="bg-emerald-500 h-full rounded-full transition-all"
                                                    style={{ width: `${categoryItemsCount > 0 ? (categoryCheckedCount / categoryItemsCount) * 100 : 0}%` }}
                                                />
                                            </div>
                                            {isCatCollapsed ? (
                                                <ChevronRightIcon className="w-5 h-5 text-slate-400" />
                                            ) : (
                                                <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                                            )}
                                        </div>
                                    </button>

                                    {/* Modelos da Categoria */}
                                    {!isCatCollapsed && (
                                        <div className="flex flex-col gap-4 pl-0 sm:pl-2">
                                            {Object.entries(modelsMap).map(([modelName, items]) => {
                                                const modelKey = `${categoryName}_${modelName}`;
                                                const isModelCollapsed = !!collapsedGroups[modelKey];
                                                const modelCheckedCount = items.filter(p => !!session.checkedMap[p.id]).length;

                                                return (
                                                    <div
                                                        key={modelName}
                                                        className="bg-slate-950/40 rounded-2xl border border-slate-800/80 overflow-hidden shadow-sm"
                                                    >
                                                        {/* Sub-cabeçalho de Modelo */}
                                                        <div
                                                            onClick={() => toggleGroupCollapse(modelKey)}
                                                            className="px-4 py-2.5 bg-slate-800/40 hover:bg-slate-800/60 border-b border-slate-800/60 flex items-center justify-between cursor-pointer select-none"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {isModelCollapsed ? (
                                                                    <ChevronRightIcon className="w-4 h-4 text-slate-400" />
                                                                ) : (
                                                                    <ChevronDownIcon className="w-4 h-4 text-slate-400" />
                                                                )}
                                                                <span className="text-xs font-black text-slate-200 uppercase tracking-wide">
                                                                    {modelName}
                                                                </span>
                                                                <span className="text-[11px] font-semibold text-slate-400">
                                                                    ({modelCheckedCount}/{items.length})
                                                                </span>
                                                            </div>
                                                            {modelCheckedCount === items.length && items.length > 0 && (
                                                                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                                    100% Conferido
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Linhas de Produtos Individuais */}
                                                        {!isModelCollapsed && (
                                                            <div className="divide-y divide-slate-800/50">
                                                                {items.map((product) => {
                                                                    const isChecked = !!session.checkedMap[product.id];
                                                                    const checkMeta = session.checkedMap[product.id];
                                                                    const isRecent = recentCheckedId === product.id;

                                                                    return (
                                                                        <div
                                                                            key={product.id}
                                                                            id={`product-row-${product.id}`}
                                                                            onClick={() => handleToggleCheck(product.id)}
                                                                            className={`p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 transition-all cursor-pointer select-none ${
                                                                                isChecked
                                                                                    ? 'bg-emerald-950/20 hover:bg-emerald-950/30 border-l-4 border-l-emerald-500'
                                                                                    : 'hover:bg-slate-800/40 border-l-4 border-l-transparent'
                                                                            } ${isRecent ? 'ring-2 ring-emerald-400 bg-emerald-900/30' : ''}`}
                                                                        >
                                                                            {/* Detalhes do Produto */}
                                                                            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                                                                <div className="flex flex-wrap items-center gap-2">
                                                                                    <span className={`text-sm font-bold tracking-tight ${isChecked ? 'text-emerald-300 line-through decoration-emerald-500/40' : 'text-slate-100'}`}>
                                                                                        {product.model}
                                                                                    </span>

                                                                                    {product.storage && (
                                                                                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-extrabold border border-slate-700">
                                                                                            {formatStorageUnit(product.storage)}
                                                                                        </span>
                                                                                    )}

                                                                                    {product.color && (
                                                                                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-bold border border-slate-700">
                                                                                            {product.color}
                                                                                        </span>
                                                                                    )}

                                                                                    {product.condition && (
                                                                                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 text-[10px] font-bold border border-indigo-500/20 uppercase">
                                                                                            {product.condition}
                                                                                        </span>
                                                                                    )}

                                                                                    {product.batteryHealth > 0 && (
                                                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                                                                                            product.batteryHealth >= 80
                                                                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                                                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                                                        }`}>
                                                                                            🔋 {product.batteryHealth}%
                                                                                        </span>
                                                                                    )}
                                                                                </div>

                                                                                {/* Identificadores (IMEI, Serial, SKU, Localização) */}
                                                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                                                                                    {product.imei1 && (
                                                                                        <span className="flex items-center gap-1">
                                                                                            <span className="text-slate-500 font-sans font-semibold">IMEI 1:</span>
                                                                                            <strong className="text-slate-200 select-all">{product.imei1}</strong>
                                                                                        </span>
                                                                                    )}

                                                                                    {product.imei2 && (
                                                                                        <span className="flex items-center gap-1">
                                                                                            <span className="text-slate-500 font-sans font-semibold">IMEI 2:</span>
                                                                                            <strong className="text-slate-300 select-all">{product.imei2}</strong>
                                                                                        </span>
                                                                                    )}

                                                                                    {product.serialNumber && (
                                                                                        <span className="flex items-center gap-1">
                                                                                            <span className="text-slate-500 font-sans font-semibold">S/N:</span>
                                                                                            <strong className="text-slate-200 select-all">{product.serialNumber}</strong>
                                                                                        </span>
                                                                                    )}

                                                                                    {product.sku && (
                                                                                        <span className="flex items-center gap-1">
                                                                                            <span className="text-slate-500 font-sans font-semibold">SKU:</span>
                                                                                            <span className="text-slate-300">{product.sku}</span>
                                                                                        </span>
                                                                                    )}

                                                                                    {product.storageLocation && (
                                                                                        <span className="flex items-center gap-1 font-sans text-amber-400/90 font-bold">
                                                                                            📍 {product.storageLocation}
                                                                                        </span>
                                                                                    )}
                                                                                </div>

                                                                                {isChecked && checkMeta && (
                                                                                    <span className="text-[10px] text-emerald-400/80 font-medium">
                                                                                        Conferido às {new Date(checkMeta.checkedAt).toLocaleTimeString('pt-BR')}
                                                                                    </span>
                                                                                )}
                                                                            </div>

                                                                            {/* Botão de Check Grande para Toque no Celular */}
                                                                            <div className="w-full sm:w-auto flex items-center justify-end">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleToggleCheck(product.id);
                                                                                    }}
                                                                                    className={`w-full sm:w-12 h-12 rounded-xl flex items-center justify-center transition-all border shadow-md active:scale-90 ${
                                                                                        isChecked
                                                                                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-400 shadow-emerald-500/30'
                                                                                            : 'bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-slate-300 border-slate-700'
                                                                                    }`}
                                                                                    title={isChecked ? 'Desmarcar check' : 'Marcar como conferido'}
                                                                                >
                                                                                    {isChecked ? (
                                                                                        <div className="flex items-center gap-2 sm:gap-0">
                                                                                            <CheckIcon className="w-6 h-6 stroke-[3]" />
                                                                                            <span className="sm:hidden text-xs font-black uppercase tracking-wider">Conferido</span>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="flex items-center gap-2 sm:gap-0">
                                                                                            <div className="w-5 h-5 rounded-md border-2 border-slate-600" />
                                                                                            <span className="sm:hidden text-xs font-bold uppercase tracking-wider">Marcar Check</span>
                                                                                        </div>
                                                                                    )}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Modal de Confirmação para Reiniciar */}
            {showResetConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-md w-full shadow-2xl space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                            <TrashIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Iniciar Nova Conferência?</h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Esta ação limpará todos os {stats.checked} checks marcados nesta conferência. Essa ação não pode ser desfeita.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => setShowResetConfirm(false)}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleResetSession}
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-rose-600/20 active:scale-95"
                            >
                                Sim, Limpar Tudo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Relatório e Resumo */}
            {showReportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                                    <ClipboardListIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Relatório da Conferência</h3>
                                    <p className="text-xs text-slate-400">Resumo de itens conferidos e faltantes</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                            >
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Conteúdo do Relatório */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-3 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
                                    <p className="text-xl font-black text-white">{stats.total}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-emerald-400">Conferidos</span>
                                    <p className="text-xl font-black text-emerald-400">{stats.checked}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-amber-400">Pendentes</span>
                                    <p className="text-xl font-black text-amber-400">{stats.pending}</p>
                                </div>
                            </div>

                            {/* Prévia do Texto */}
                            <div className="space-y-2">
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                    Texto Formatado (para WhatsApp ou Impressão):
                                </span>
                                <pre className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs font-mono text-slate-300 max-h-60 overflow-y-auto whitespace-pre-wrap">
                                    {generateReportText()}
                                </pre>
                            </div>
                        </div>

                        {/* Rodapé do Modal */}
                        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between gap-3">
                            <button
                                onClick={handlePrintReport}
                                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                            >
                                <PrinterIcon className="w-4 h-4 text-slate-400" />
                                Imprimir
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCopyReport}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                                >
                                    <ClipboardListIcon className="w-4 h-4" />
                                    {copiedReport ? 'Copiado!' : 'Copiar para WhatsApp'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockCheck;
