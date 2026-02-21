
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Product, InventoryMovement, MovementReason, User } from '../types.ts';
import { getInventoryMovements, createInventoryMovement } from '../services/mockApi.ts';
import { toDateValue } from '../utils/dateUtils.ts';
import {
    SearchIcon, CloseIcon, XCircleIcon, ClockIcon,
    ChevronLeftIcon, ChevronRightIcon, ArrowsUpDownIcon,
    ArchiveBoxIcon, SpinnerIcon, PlusIcon, MinusIcon
} from './icons.tsx';

interface StockMovementModalProps {
    isOpen: boolean;
    onClose: () => void;
    products: Product[];
    users: User[];
    currentUserId?: string;
    currentUserName?: string;
    onMovementCreated: () => void;
    showToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

const MOVEMENT_REASONS: MovementReason[] = ['Avaria', 'Perda', 'Uso Interno', 'Bonificação', 'Ajuste Manual', 'Devolução', 'Outro'];

const getMonthStart = () => {
    const d = new Date();
    return toDateValue(new Date(d.getFullYear(), d.getMonth(), 1));
};
const getMonthEnd = () => {
    const d = new Date();
    return toDateValue(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

const StockMovementModal: React.FC<StockMovementModalProps> = ({
    isOpen, onClose, products, users, currentUserId, currentUserName, onMovementCreated, showToast
}) => {
    // --- Search ---
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // --- Movement form ---
    const [movementType, setMovementType] = useState<'entrada' | 'saida'>('saida');
    const [quantity, setQuantity] = useState(1);
    const [reason, setReason] = useState<MovementReason | ''>('');
    const [customReason, setCustomReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // --- History ---
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyStartDate, setHistoryStartDate] = useState(getMonthStart());
    const [historyEndDate, setHistoryEndDate] = useState(getMonthEnd());
    const [historyProductFilter, setHistoryProductFilter] = useState('');
    const [historyUserFilter, setHistoryUserFilter] = useState('');
    const [historyTypeFilter, setHistoryTypeFilter] = useState<'' | 'entrada' | 'saida'>('');
    const [historyPage, setHistoryPage] = useState(1);
    const HISTORY_PER_PAGE = 10;

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Load history
    const fetchHistory = useCallback(async () => {
        setLoadingHistory(true);
        try {
            const data = await getInventoryMovements(historyStartDate, historyEndDate);
            setMovements(data);
        } catch {
            showToast('Erro ao carregar histórico de movimentações.', 'error');
        } finally {
            setLoadingHistory(false);
        }
    }, [historyStartDate, historyEndDate, showToast]);

    useEffect(() => {
        if (isOpen) fetchHistory();
    }, [isOpen, fetchHistory]);

    // Focus on open
    useEffect(() => {
        if (isOpen) setTimeout(() => searchInputRef.current?.focus(), 100);
    }, [isOpen]);

    // Search results
    const searchResults = useMemo(() => {
        if (!debouncedSearch.trim() || selectedProduct) return [];
        const q = debouncedSearch.toLowerCase();
        // For entries, show all products; for exits, only those with stock > 0
        return products
            .filter(p => movementType === 'entrada' || p.stock > 0)
            .filter(p =>
                (p.imei1 || '').toLowerCase().includes(q) ||
                (p.imei2 || '').toLowerCase().includes(q) ||
                (p.serialNumber || '').toLowerCase().includes(q) ||
                (p.sku || '').toLowerCase().includes(q) ||
                (p.model || '').toLowerCase().includes(q) ||
                (p.barcodes || []).some(b => b.toLowerCase().includes(q))
            )
            .slice(0, 8);
    }, [debouncedSearch, products, selectedProduct, movementType]);

    // Filtered history
    const filteredMovements = useMemo(() => {
        let filtered = movements;
        if (historyProductFilter.trim()) {
            const q = historyProductFilter.toLowerCase();
            filtered = filtered.filter(m =>
                m.product_name.toLowerCase().includes(q) ||
                (m.imei || '').toLowerCase().includes(q) ||
                (m.serial_number || '').toLowerCase().includes(q)
            );
        }
        if (historyUserFilter) {
            filtered = filtered.filter(m => m.user_name === historyUserFilter);
        }
        if (historyTypeFilter) {
            filtered = filtered.filter(m => m.movement_type === historyTypeFilter);
        }
        return filtered;
    }, [movements, historyProductFilter, historyUserFilter, historyTypeFilter]);

    // History summary
    const summary = useMemo(() => {
        const totalSaidas = filteredMovements.filter(m => m.movement_type === 'saida').reduce((s, m) => s + m.quantity, 0);
        const totalEntradas = filteredMovements.filter(m => m.movement_type === 'entrada').reduce((s, m) => s + m.quantity, 0);
        return { totalSaidas, totalEntradas, saldo: totalEntradas - totalSaidas };
    }, [filteredMovements]);

    // Pagination
    const totalHistoryPages = Math.ceil(filteredMovements.length / HISTORY_PER_PAGE);
    const paginatedMovements = filteredMovements.slice((historyPage - 1) * HISTORY_PER_PAGE, historyPage * HISTORY_PER_PAGE);

    // Unique user names from movements
    const uniqueUsers = useMemo(() => [...new Set(movements.map(m => m.user_name))], [movements]);

    // --- Helpers ---
    const isUniqueProduct = (p: Product) => !!((p.serialNumber || '').trim() || (p.imei1 || '').trim() || (p.imei2 || '').trim());

    // --- Handlers ---
    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product);
        setSearchTerm('');
        setQuantity(1);
        setReason('');
        setCustomReason('');
    };

    const handleCancelSelection = () => {
        setSelectedProduct(null);
        setSearchTerm('');
        setQuantity(1);
        setReason('');
        setCustomReason('');
    };

    const handleSubmit = async () => {
        if (!selectedProduct || !reason) return;
        if (reason === 'Outro' && !customReason.trim()) {
            showToast('Informe o motivo personalizado.', 'warning');
            return;
        }

        // Validations
        if (quantity < 1) {
            showToast('Quantidade mínima é 1.', 'warning');
            return;
        }

        if (movementType === 'saida' && quantity > selectedProduct.stock) {
            showToast(`Estoque insuficiente. Disponível: ${selectedProduct.stock}`, 'warning');
            return;
        }

        setSubmitting(true);
        try {
            await createInventoryMovement(
                {
                    product_id: selectedProduct.id,
                    product_name: selectedProduct.model,
                    imei: selectedProduct.imei1 || undefined,
                    serial_number: selectedProduct.serialNumber || undefined,
                    movement_type: movementType,
                    quantity,
                    reason,
                    custom_reason: reason === 'Outro' ? customReason : undefined,
                },
                currentUserId || 'unknown',
                currentUserName || 'Usuário'
            );
            showToast(
                movementType === 'saida'
                    ? 'Saída de estoque registrada com sucesso!'
                    : 'Entrada de estoque registrada com sucesso!',
                'success'
            );
            handleCancelSelection();
            onMovementCreated();
            fetchHistory();
        } catch (error: any) {
            showToast(error.message || 'Erro ao registrar movimentação.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-5xl max-h-[92vh] bg-surface rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col mx-4">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-orange-50/80 to-amber-50/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-orange-100 text-orange-600 rounded-xl shadow-sm">
                            <ArrowsUpDownIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-gray-800 uppercase tracking-wider">Movimentação de Estoque</h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Entrada e saída manual</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-all active:scale-95">
                        <CloseIcon className="h-5 w-5 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                    {/* === SECTION 1: Search + Form === */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Left: Search */}
                        <div className="space-y-3">
                            <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">1. Buscar Produto</h3>
                            <div className="relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Buscar por IMEI, Nº Série, EAN, SKU ou Descrição"
                                    className="w-full h-11 pl-10 pr-10 border border-gray-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-orange-300/50 focus:border-orange-300 outline-none transition-all"
                                    disabled={!!selectedProduct}
                                />
                                {searchTerm && !selectedProduct && (
                                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        <XCircleIcon className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Search Results */}
                            {searchResults.length > 0 && (
                                <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm bg-white divide-y divide-gray-50 max-h-[280px] overflow-y-auto">
                                    {searchResults.map(p => {
                                        const identifier = (p.imei1 || '').trim() || (p.serialNumber || '').trim();
                                        return (
                                            <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-orange-50/40 transition-colors">
                                                <div className="flex-1 pr-3 min-w-0">
                                                    <p className="text-sm font-bold text-gray-800 truncate">{p.model}</p>
                                                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400 font-medium flex-wrap">
                                                        <span>SKU: {p.sku}</span>
                                                        {identifier && (
                                                            <>
                                                                <span className="opacity-40">·</span>
                                                                <span className="truncate">{p.imei1 ? 'IMEI' : 'S/N'}: {identifier}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 flex-shrink-0">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${p.stock > 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{p.stock} un</span>
                                                    <button
                                                        onClick={() => handleSelectProduct(p)}
                                                        className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all active:scale-95 shadow-sm"
                                                    >
                                                        Selecionar
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {debouncedSearch && searchResults.length === 0 && !selectedProduct && (
                                <div className="text-center py-6 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                                    <ArchiveBoxIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nenhum produto encontrado</p>
                                </div>
                            )}
                        </div>

                        {/* Right: Movement Form */}
                        <div className="space-y-3">
                            <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">2. Movimentação</h3>

                            {!selectedProduct ? (
                                <div className="flex flex-col items-center justify-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                                    <ArrowsUpDownIcon className="h-10 w-10 text-gray-200 mb-3" />
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Selecione um produto</p>
                                    <p className="text-[10px] text-gray-300 mt-1">Use a busca ao lado para encontrar o produto</p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-5 space-y-4">
                                    {/* Selected Product Info */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-gray-800 truncate">{selectedProduct.model}</p>
                                            <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 font-medium flex-wrap">
                                                <span>SKU: {selectedProduct.sku}</span>
                                                {selectedProduct.imei1 && (
                                                    <><span className="opacity-40">·</span><span>IMEI: {selectedProduct.imei1}</span></>
                                                )}
                                                {selectedProduct.serialNumber && (
                                                    <><span className="opacity-40">·</span><span>S/N: {selectedProduct.serialNumber}</span></>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-lg border border-green-200">
                                                Estoque: {selectedProduct.stock}
                                            </span>
                                            <button onClick={handleCancelSelection} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-all" title="Remover seleção">
                                                <CloseIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Movement Type */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Tipo de Movimentação</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setMovementType('saida')}
                                                className={`h-10 flex items-center justify-center gap-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] border ${movementType === 'saida'
                                                        ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20'
                                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                                                    }`}
                                            >
                                                <MinusIcon className="h-4 w-4" />
                                                Saída
                                            </button>
                                            <button
                                                onClick={() => setMovementType('entrada')}
                                                className={`h-10 flex items-center justify-center gap-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] border ${movementType === 'entrada'
                                                        ? 'bg-green-500 text-white border-green-500 shadow-lg shadow-green-500/20'
                                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200'
                                                    }`}
                                            >
                                                <PlusIcon className="h-4 w-4" />
                                                Entrada
                                            </button>
                                        </div>
                                    </div>

                                    {/* Quantity */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Quantidade</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={movementType === 'saida' ? selectedProduct.stock : 9999}
                                            value={quantity}
                                            onChange={e => {
                                                const val = Math.max(1, Number(e.target.value));
                                                setQuantity(movementType === 'saida' ? Math.min(selectedProduct.stock, val) : val);
                                            }}
                                            className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-300/50 focus:border-orange-300 outline-none transition-all"
                                        />
                                        {movementType === 'saida' && (
                                            <p className="text-[10px] text-gray-400 mt-1">Máximo disponível: {selectedProduct.stock} unidade(s)</p>
                                        )}
                                    </div>

                                    {/* Reason */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Motivo</label>
                                        <select
                                            value={reason}
                                            onChange={e => setReason(e.target.value as MovementReason)}
                                            className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-300/50 focus:border-orange-300 outline-none transition-all"
                                        >
                                            <option value="">Selecione o motivo...</option>
                                            {MOVEMENT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>

                                    {/* Custom Reason */}
                                    {reason === 'Outro' && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Descreva o motivo</label>
                                            <input
                                                type="text"
                                                value={customReason}
                                                onChange={e => setCustomReason(e.target.value)}
                                                placeholder="Ex: Devolvido ao fornecedor"
                                                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-300/50 focus:border-orange-300 outline-none transition-all"
                                            />
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-3 pt-2">
                                        <button
                                            onClick={handleSubmit}
                                            disabled={submitting || !reason || (reason === 'Outro' && !customReason.trim())}
                                            className={`flex-1 h-11 text-white rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg ${movementType === 'saida'
                                                    ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                                                    : 'bg-green-500 hover:bg-green-600 shadow-green-500/20'
                                                }`}
                                        >
                                            {submitting && <SpinnerIcon className="h-4 w-4 animate-spin" />}
                                            {movementType === 'saida' ? 'Confirmar Saída' : 'Confirmar Entrada'}
                                        </button>
                                        <button
                                            onClick={handleCancelSelection}
                                            className="h-11 px-5 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-gray-200 transition-all active:scale-[0.98]"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* === SECTION 2: History === */}
                    <div className="space-y-4 pt-2">
                        <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Histórico de Movimentações</h3>

                        {/* Summary KPIs */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-red-50/70 rounded-2xl p-3 border border-red-100/50 text-center">
                                <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Total Saídas</p>
                                <p className="text-xl font-black text-red-600 mt-0.5">{summary.totalSaidas}</p>
                            </div>
                            <div className="bg-green-50/70 rounded-2xl p-3 border border-green-100/50 text-center">
                                <p className="text-[9px] font-black text-green-400 uppercase tracking-widest">Total Entradas</p>
                                <p className="text-xl font-black text-green-600 mt-0.5">{summary.totalEntradas}</p>
                            </div>
                            <div className={`rounded-2xl p-3 border text-center ${summary.saldo >= 0 ? 'bg-blue-50/70 border-blue-100/50' : 'bg-orange-50/70 border-orange-100/50'}`}>
                                <p className={`text-[9px] font-black uppercase tracking-widest ${summary.saldo >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>Saldo Líquido</p>
                                <p className={`text-xl font-black mt-0.5 ${summary.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{summary.saldo >= 0 ? '+' : ''}{summary.saldo}</p>
                            </div>
                        </div>

                        {/* History Filters */}
                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Data Inicial</label>
                                <input
                                    type="date"
                                    value={historyStartDate}
                                    onChange={e => { setHistoryStartDate(e.target.value); setHistoryPage(1); }}
                                    className="h-9 px-3 border border-gray-200 rounded-xl text-xs bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Data Final</label>
                                <input
                                    type="date"
                                    value={historyEndDate}
                                    onChange={e => { setHistoryEndDate(e.target.value); setHistoryPage(1); }}
                                    className="h-9 px-3 border border-gray-200 rounded-xl text-xs bg-white"
                                />
                            </div>
                            <div className="flex-1 min-w-[160px]">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Produto</label>
                                <input
                                    type="text"
                                    value={historyProductFilter}
                                    onChange={e => { setHistoryProductFilter(e.target.value); setHistoryPage(1); }}
                                    placeholder="Filtrar por produto..."
                                    className="w-full h-9 px-3 border border-gray-200 rounded-xl text-xs bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Tipo</label>
                                <select
                                    value={historyTypeFilter}
                                    onChange={e => { setHistoryTypeFilter(e.target.value as '' | 'entrada' | 'saida'); setHistoryPage(1); }}
                                    className="h-9 px-3 border border-gray-200 rounded-xl text-xs bg-white"
                                >
                                    <option value="">Todos</option>
                                    <option value="entrada">Entrada</option>
                                    <option value="saida">Saída</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Usuário</label>
                                <select
                                    value={historyUserFilter}
                                    onChange={e => { setHistoryUserFilter(e.target.value); setHistoryPage(1); }}
                                    className="h-9 px-3 border border-gray-200 rounded-xl text-xs bg-white"
                                >
                                    <option value="">Todos</option>
                                    {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* History Table */}
                        <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="text-[10px] font-bold text-gray-500 uppercase bg-gray-50/80 border-b border-gray-100">
                                    <tr>
                                        <th className="px-3 py-2.5 text-left">Data</th>
                                        <th className="px-3 py-2.5 text-left">Produto</th>
                                        <th className="px-3 py-2.5 text-left">IMEI / Serial</th>
                                        <th className="px-3 py-2.5 text-center">Tipo</th>
                                        <th className="px-3 py-2.5 text-center">Qtd</th>
                                        <th className="px-3 py-2.5 text-left">Motivo</th>
                                        <th className="px-3 py-2.5 text-left">Usuário</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loadingHistory ? (
                                        <tr>
                                            <td colSpan={7} className="py-10 text-center">
                                                <SpinnerIcon className="h-6 w-6 animate-spin text-orange-400 mx-auto" />
                                            </td>
                                        </tr>
                                    ) : paginatedMovements.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-10 text-center">
                                                <ArchiveBoxIcon className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nenhuma movimentação encontrada</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedMovements.map(m => (
                                            <tr key={m.id} className="hover:bg-orange-50/20 transition-colors">
                                                <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{formatDate(m.created_at)}</td>
                                                <td className="px-3 py-2.5 text-xs font-semibold text-gray-800 max-w-[200px] truncate">{m.product_name}</td>
                                                <td className="px-3 py-2.5 text-[10px] text-gray-400 font-mono">{m.imei || m.serial_number || '—'}</td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${m.movement_type === 'saida'
                                                            ? 'bg-red-100 text-red-600'
                                                            : 'bg-green-100 text-green-600'
                                                        }`}>
                                                        {m.movement_type === 'saida' ? '↓ Saída' : '↑ Entrada'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-center text-xs font-black text-gray-800">{m.quantity}</td>
                                                <td className="px-3 py-2.5 text-xs text-gray-600">{m.reason}</td>
                                                <td className="px-3 py-2.5 text-xs text-gray-500">{m.user_name}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalHistoryPages > 1 && (
                            <div className="flex items-center justify-between text-sm">
                                <p className="text-xs font-semibold text-gray-400">
                                    {filteredMovements.length} movimentação{filteredMovements.length !== 1 ? 'ões' : ''}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                        disabled={historyPage === 1}
                                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeftIcon className="h-4 w-4" />
                                    </button>
                                    <span className="text-xs font-bold text-gray-600 min-w-[50px] text-center">
                                        {historyPage} de {totalHistoryPages}
                                    </span>
                                    <button
                                        onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                                        disabled={historyPage === totalHistoryPages}
                                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRightIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockMovementModal;
