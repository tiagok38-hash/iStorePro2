import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Product, InventoryMovement, MovementReason, User, Branch } from '../types.ts';
import { getInventoryMovements, createInventoryMovement } from '../services/inventoryService.ts';
import { getBranches, createBranch, transferStockToBranch, transferStockFromBranchToMain, getBranchInventory } from '../services/branchService.ts';
import { toDateValue } from '../utils/dateUtils.ts';
import {
    SearchIcon, CloseIcon, XCircleIcon, ClockIcon,
    ChevronLeftIcon, ChevronRightIcon, ArrowsUpDownIcon,
    ArchiveBoxIcon, SpinnerIcon, PlusIcon, MinusIcon, HomeIcon, PlusCircleIcon
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

// --- BRANCH MANAGER MODAL ---
const BranchManagerModal: React.FC<{ isOpen: boolean, onClose: () => void, showToast: any, onBranchCreated: () => void, branches: Branch[] }> = ({ isOpen, onClose, showToast, onBranchCreated, branches }) => {
    const [name, setName] = useState('');
    const [city, setCity] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Inventory view mode
    const [viewingBranch, setViewingBranch] = useState<Branch | null>(null);
    const [branchInventory, setBranchInventory] = useState<any[]>([]);
    const [loadingInventory, setLoadingInventory] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!name.trim() || !city.trim()) {
            showToast('Informe o nome e a cidade da filial.', 'warning');
            return;
        }
        setSubmitting(true);
        try {
            await createBranch({ name: name.trim(), city: city.trim() });
            showToast('Filial cadastrada com sucesso!', 'success');
            onBranchCreated();
            setName('');
            setCity('');
        } catch (e: any) {
            showToast(e.message || 'Erro ao criar filial.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleViewInventory = async (branch: Branch) => {
        setViewingBranch(branch);
        setLoadingInventory(true);
        try {
            const data = await getBranchInventory(branch.id);
            setBranchInventory(data);
        } catch (e: any) {
            showToast(e.message || 'Erro ao carregar estoque da filial.', 'error');
        } finally {
            setLoadingInventory(false);
        }
    };

    const formatCurrency = (val: any) => {
        if (val == null || isNaN(Number(val))) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val));
    };

    const appleProducts = branchInventory.filter(item =>
        item.product?.brand?.toLowerCase() === 'apple' ||
        item.product?.category?.toLowerCase()?.includes('apple')
    );
    const otherProducts = branchInventory.filter(item =>
        !(item.product?.brand?.toLowerCase() === 'apple' ||
            item.product?.category?.toLowerCase()?.includes('apple'))
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-5 text-center pt-6 pb-2 border-b border-gray-100 flex items-center justify-between shrink-0">
                    {viewingBranch ? (
                        <button onClick={() => setViewingBranch(null)} className="p-2 bg-gray-50 text-gray-500 hover:text-gray-800 rounded-xl transition-all">
                            <ChevronLeftIcon className="h-5 w-5" />
                        </button>
                    ) : (
                        <div className="w-10 h-10 border border-transparent" /> // spacer
                    )}

                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="w-12 h-12 bg-blue-100 text-blue-500 rounded-2xl flex items-center justify-center mb-2 shadow-inner">
                            <HomeIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest leading-tight">
                            {viewingBranch ? `Estoque: ${viewingBranch.name}` : 'Gerenciar Filiais'}
                        </h2>
                        {!viewingBranch && <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mt-1">Cadastro de filiais e consulta de estoque</p>}
                    </div>

                    <button onClick={onClose} className="p-2 bg-gray-50 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all active:scale-95">
                        <CloseIcon className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 bg-gray-50/50">
                    {viewingBranch ? (
                        <div className="space-y-4 animate-in slide-in-from-right-4">
                            <div className="space-y-6">
                                {loadingInventory ? (
                                    <div className="py-10 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
                                        <SpinnerIcon className="h-6 w-6 animate-spin text-blue-400 mx-auto" />
                                    </div>
                                ) : branchInventory.length === 0 ? (
                                    <div className="py-10 text-center bg-white rounded-2xl border border-gray-100 shadow-sm text-gray-400 text-xs uppercase tracking-widest font-bold">
                                        Sem estoque nesta filial
                                    </div>
                                ) : (
                                    <>
                                        {appleProducts.length > 0 && (
                                            <div>
                                                <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">Produtos Apple</h4>
                                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                                    <table className="w-full text-sm">
                                                        <thead className="text-[10px] font-bold text-gray-500 uppercase bg-gray-50/80 border-b border-gray-100">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left">Produto</th>
                                                                <th className="px-4 py-3 text-left">SKU / IMEI</th>
                                                                <th className="px-4 py-3 text-right">Custo</th>
                                                                <th className="px-4 py-3 text-right">Venda</th>
                                                                <th className="px-4 py-3 text-center">Quant.</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {appleProducts.map(item => (
                                                                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                                                                    <td className="px-4 py-3 text-xs font-bold text-gray-800">{item.product?.model || 'Desconhecido'}</td>
                                                                    <td className="px-4 py-3 text-[10px] font-mono text-gray-400">
                                                                        {item.product?.sku && <span className="block">SKU: {item.product.sku}</span>}
                                                                        {item.product?.imei1 && <span className="block">IM: {item.product.imei1}</span>}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right text-[11px] text-gray-500">{formatCurrency(item.product?.costPrice)}</td>
                                                                    <td className="px-4 py-3 text-right text-[11px] font-bold text-green-600">{formatCurrency(item.product?.price)}</td>
                                                                    <td className="px-4 py-3 text-center text-sm font-black text-blue-600">{item.stock}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                        {otherProducts.length > 0 && (
                                            <div>
                                                <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 mt-4">Produtos Variados</h4>
                                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                                    <table className="w-full text-sm">
                                                        <thead className="text-[10px] font-bold text-gray-500 uppercase bg-gray-50/80 border-b border-gray-100">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left">Produto</th>
                                                                <th className="px-4 py-3 text-left">SKU / IMEI</th>
                                                                <th className="px-4 py-3 text-right">Custo</th>
                                                                <th className="px-4 py-3 text-right">Venda</th>
                                                                <th className="px-4 py-3 text-center">Quant.</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {otherProducts.map(item => (
                                                                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                                                                    <td className="px-4 py-3 text-xs font-bold text-gray-800">{item.product?.model || 'Desconhecido'}</td>
                                                                    <td className="px-4 py-3 text-[10px] font-mono text-gray-400">
                                                                        {item.product?.sku && <span className="block">SKU: {item.product.sku}</span>}
                                                                        {item.product?.imei1 && <span className="block">IM: {item.product.imei1}</span>}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right text-[11px] text-gray-500">{formatCurrency(item.product?.costPrice)}</td>
                                                                    <td className="px-4 py-3 text-right text-[11px] font-bold text-green-600">{formatCurrency(item.product?.price)}</td>
                                                                    <td className="px-4 py-3 text-center text-sm font-black text-blue-600">{item.stock}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Create Branch Form */}
                            <div className="bg-white p-5 rounded-2xl border border-blue-100/50 shadow-sm space-y-4">
                                <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Nova Filial</h3>
                                <div className="flex flex-col md:flex-row gap-3">
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            placeholder="Nome da Filial"
                                            className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-300/50 focus:border-blue-300 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={city}
                                            onChange={e => setCity(e.target.value)}
                                            placeholder="Cidade"
                                            className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-300/50 focus:border-blue-300 outline-none transition-all"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={submitting || !name.trim() || !city.trim()}
                                        className="h-10 px-6 bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                                    >
                                        {submitting ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <PlusIcon className="h-4 w-4" />}
                                        Cadastrar
                                    </button>
                                </div>
                            </div>

                            {/* Branch List */}
                            <div className="space-y-3">
                                <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Filiais Cadastradas</h3>
                                {branches.length === 0 ? (
                                    <p className="text-center text-xs text-gray-400 py-4 uppercase tracking-widest font-bold">Nenhuma filial cadastrada.</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {branches.map(branch => (
                                            <div key={branch.id} className="bg-white rounded-2xl border border-gray-100 p-4 shrink-0 flex items-center justify-between hover:border-blue-200 transition-colors shadow-sm">
                                                <div>
                                                    <p className="font-bold text-gray-800 text-sm">{branch.name}</p>
                                                    <p className="text-[10px] font-bold text-gray-400 mt-0.5 uppercase tracking-widest">{branch.city}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleViewInventory(branch)}
                                                    className="text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 bg-blue-50 py-1.5 px-3 rounded-lg hover:bg-blue-100 transition-colors"
                                                >
                                                    Ver Estoque
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const StockMovementModal: React.FC<StockMovementModalProps> = ({
    isOpen, onClose, products, users, currentUserId, currentUserName, onMovementCreated, showToast
}) => {
    // --- Data ---
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

    // --- Search ---
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // --- Movement form ---
    const [movementType, setMovementType] = useState<'entrada' | 'saida' | 'transfer_out' | 'transfer_in'>('saida');
    const [quantity, setQuantity] = useState(1);
    const [reason, setReason] = useState<MovementReason | ''>('');
    const [customReason, setCustomReason] = useState('');
    const [selectedBranchId, setSelectedBranchId] = useState('');
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

    const fetchBranchesData = useCallback(async () => {
        try {
            const data = await getBranches();
            setBranches(data);
        } catch (e: any) {
            console.error('Error fetching branches', e);
        }
    }, []);

    const fetchHistoryData = useCallback(async () => {
        setLoadingHistory(true);
        try {
            const data = await getInventoryMovements(historyStartDate, historyEndDate);
            setMovements(data);
        } catch (error) {
            console.error('Error loading history:', error);
            showToast('Erro ao carregar histórico.', 'error');
        } finally {
            setLoadingHistory(false);
        }
    }, [historyStartDate, historyEndDate, showToast]);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setDebouncedSearch('');
            setSelectedProduct(null);
            setQuantity(1);
            setReason('');
            setCustomReason('');
            setMovementType('saida');
            setSelectedBranchId('');
            setHistoryPage(1);
            fetchBranchesData();
            fetchHistoryData();
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen, fetchHistoryData, fetchBranchesData]);

    // Search debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const filteredProducts = useMemo(() => {
        if (!debouncedSearch) return [];
        const term = debouncedSearch.toLowerCase();
        return products.filter(p =>
            p.model.toLowerCase().includes(term) ||
            p.sku?.toLowerCase().includes(term) ||
            p.serialNumber?.toLowerCase().includes(term) ||
            p.imei1?.toLowerCase().includes(term)
        ).slice(0, 5); // Max 5 results
    }, [debouncedSearch, products]);

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product);
        setSearchTerm('');
        setDebouncedSearch('');
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
        setSelectedBranchId('');
    };

    const handleSubmit = async () => {
        if (!selectedProduct) return;

        // Validations
        if (quantity < 1) {
            showToast('Quantidade mínima é 1.', 'warning');
            return;
        }

        if (movementType === 'saida' || movementType === 'transfer_out') {
            if (quantity > selectedProduct.stock) {
                showToast(`Estoque principal insuficiente. Disponível: ${selectedProduct.stock}`, 'warning');
                return;
            }
        }

        if (movementType === 'entrada' || movementType === 'saida') {
            if (!reason) return;
            if (reason === 'Outro' && !customReason.trim()) {
                showToast('Informe o motivo personalizado.', 'warning');
                return;
            }
        }

        if (movementType === 'transfer_out' || movementType === 'transfer_in') {
            if (!selectedBranchId) {
                showToast('Selecione uma filial.', 'warning');
                return;
            }
        }

        setSubmitting(true);
        try {
            if (movementType === 'saida' || movementType === 'entrada') {
                await createInventoryMovement(
                    {
                        product_id: selectedProduct.id,
                        product_name: selectedProduct.model,
                        imei: selectedProduct.imei1 || undefined,
                        serial_number: selectedProduct.serialNumber || undefined,
                        movement_type: movementType,
                        quantity,
                        reason: reason,
                        custom_reason: reason === 'Outro' ? customReason : undefined,
                    },
                    currentUserId || 'unknown',
                    currentUserName || 'Usuário'
                );
            } else if (movementType === 'transfer_out') {
                await transferStockToBranch(
                    {
                        product_id: selectedProduct.id,
                        product_name: selectedProduct.model,
                        imei: selectedProduct.imei1 || undefined,
                        serial_number: selectedProduct.serialNumber || undefined,
                        branch_id: selectedBranchId,
                        quantity,
                        reason: customReason
                    },
                    currentUserId || 'unknown',
                    currentUserName || 'Usuário'
                );
            } else if (movementType === 'transfer_in') {
                await transferStockFromBranchToMain(
                    {
                        product_id: selectedProduct.id,
                        product_name: selectedProduct.model,
                        imei: selectedProduct.imei1 || undefined,
                        serial_number: selectedProduct.serialNumber || undefined,
                        branch_id: selectedBranchId,
                        quantity,
                        reason: customReason
                    },
                    currentUserId || 'unknown',
                    currentUserName || 'Usuário'
                );
            }

            let successMsg = 'Movimentação registrada com sucesso!';
            if (movementType === 'transfer_out') successMsg = 'Transferência para filial realizada!';
            if (movementType === 'transfer_in') successMsg = 'Recebimento de filial realizado!';

            showToast(successMsg, 'success');
            onMovementCreated();
            fetchHistoryData();
            handleCancelSelection();
        } catch (error: any) {
            console.error('Error creating movement:', error);
            showToast(error.message || 'Erro ao registrar movimentação.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // --- History Filtering & Summary ---
    const filteredMovements = useMemo(() => {
        return movements.filter(m => {
            const matchProd = historyProductFilter ? m.product_name?.toLowerCase().includes(historyProductFilter.toLowerCase()) : true;
            const matchUser = historyUserFilter ? m.user_name?.toLowerCase().includes(historyUserFilter.toLowerCase()) : true;
            const matchType = historyTypeFilter ? m.movement_type === historyTypeFilter : true;
            return matchProd && matchUser && matchType;
        });
    }, [movements, historyProductFilter, historyUserFilter, historyTypeFilter]);

    const paginatedMovements = useMemo(() => {
        const start = (historyPage - 1) * HISTORY_PER_PAGE;
        return filteredMovements.slice(start, start + HISTORY_PER_PAGE);
    }, [filteredMovements, historyPage]);

    const totalHistoryPages = Math.ceil(filteredMovements.length / HISTORY_PER_PAGE);

    const summary = useMemo(() => {
        let totalEntradas = 0;
        let totalSaidas = 0;
        movements.forEach(m => {
            if (m.movement_type === 'entrada') totalEntradas += m.quantity;
            if (m.movement_type === 'saida') totalSaidas += m.quantity;
        });
        return { totalEntradas, totalSaidas, saldo: totalEntradas - totalSaidas };
    }, [movements]);

    const uniqueUsers = useMemo(() => {
        return Array.from(new Set(movements.map(m => m.user_name).filter(Boolean))).sort();
    }, [movements]);

    const formatDate = (ds: string) => {
        if (!ds) return '';
        const d = new Date(ds);
        return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-5xl h-[85vh] rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                <BranchManagerModal
                    isOpen={isBranchModalOpen}
                    onClose={() => setIsBranchModalOpen(false)}
                    showToast={showToast}
                    onBranchCreated={fetchBranchesData}
                    branches={branches}
                />

                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-100/80 text-orange-500 rounded-2xl flex items-center justify-center shadow-inner">
                            <ArrowsUpDownIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-gray-800 uppercase tracking-widest leading-tight">Movimentação de Estoque</h2>
                            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-bold mt-1">Gere entradas, saídas e transferências entre filiais</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsBranchModalOpen(true)} className="flex items-center gap-2 h-10 px-4 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors border border-blue-200/50">
                            <PlusCircleIcon className="w-4 h-4" />
                            Filiais
                        </button>
                        <button onClick={onClose} className="p-2.5 bg-gray-50 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all active:scale-95">
                            <CloseIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Body scrollable layout */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 bg-gray-50/30">

                    {/* === SECTION 1: ACTION === */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left: Product Search */}
                        <div className="space-y-4">
                            <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Produto</h3>

                            <div className="relative">
                                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Buscar produto por nome, SKU, IMEI..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full h-12 pl-12 pr-4 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-orange-300/50 focus:border-orange-300 outline-none transition-all placeholder-gray-400"
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                        <CloseIcon className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Search Results */}
                            {searchTerm && filteredProducts.length > 0 && !selectedProduct && (
                                <div className="bg-white border text-left border-gray-100 rounded-2xl shadow-lg shadow-gray-200/20 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                    {filteredProducts.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => handleSelectProduct(p)}
                                            className="w-full text-left px-5 py-4 border-b border-gray-50 hover:bg-orange-50/50 flex flex-col transition-colors last:border-0"
                                        >
                                            <p className="font-bold text-gray-800 text-sm truncate">{p.model}</p>
                                            <div className="flex gap-4 mt-1.5 font-mono text-[10px] text-gray-400">
                                                {p.sku && <span>SKU: {p.sku}</span>}
                                                {p.serialNumber && <span>SN: {p.serialNumber}</span>}
                                                {p.imei1 && <span>IM: {p.imei1}</span>}
                                                <span className="text-orange-500 font-black">Estoque Principal: {p.stock}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {searchTerm && filteredProducts.length === 0 && !selectedProduct && (
                                <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center text-gray-500 text-xs shadow-sm">
                                    Nenhum produto encontrado.
                                </div>
                            )}
                        </div>

                        {/* Right: Movement Details */}
                        <div>
                            {!selectedProduct ? (
                                <div className="h-full min-h-[220px] bg-white border border-gray-100 rounded-2xl flex flex-col items-center justify-center text-gray-400 shadow-sm">
                                    <SearchIcon className="h-8 w-8 mb-2 opacity-20" />
                                    <p className="text-xs uppercase tracking-widest font-bold">Busque e selecione um produto</p>
                                </div>
                            ) : (
                                <div className="bg-white border border-orange-200/50 rounded-2xl p-6 shadow-sm space-y-5 animate-in fade-in slide-in-from-right-4 relative">
                                    {/* Selected Product info */}
                                    <div className="pb-4 border-b border-gray-100 flex items-start justify-between">
                                        <div className="pr-4 border-l-2 border-orange-500 pl-3">
                                            <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Produto Selecionado</p>
                                            <h4 className="font-bold text-gray-800 text-sm">{selectedProduct.model}</h4>
                                            <p className="text-[10px] text-gray-400 mt-1 font-mono uppercase">
                                                Estoque Principal: <span className="text-gray-700 font-bold">{selectedProduct.stock}</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Type */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Ação</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setMovementType('saida')}
                                                className={`h-10 flex items-center justify-center gap-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-[0.98] border ${movementType === 'saida'
                                                    ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20'
                                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                                                    }`}
                                            >
                                                <MinusIcon className="h-4 w-4" />
                                                <span>Saída (+M)</span>
                                            </button>
                                            <button
                                                onClick={() => setMovementType('entrada')}
                                                className={`h-10 flex items-center justify-center gap-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-[0.98] border ${movementType === 'entrada'
                                                    ? 'bg-green-500 text-white border-green-500 shadow-lg shadow-green-500/20'
                                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200'
                                                    }`}
                                            >
                                                <PlusIcon className="h-4 w-4" />
                                                <span>Entrada (+M)</span>
                                            </button>
                                            <button
                                                onClick={() => setMovementType('transfer_out')}
                                                className={`h-10 flex items-center justify-center gap-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-[0.98] border ${movementType === 'transfer_out'
                                                    ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20'
                                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200'
                                                    }`}
                                            >
                                                <ArrowsUpDownIcon className="h-4 w-4" />
                                                Transf. para Filial
                                            </button>
                                            <button
                                                onClick={() => setMovementType('transfer_in')}
                                                className={`h-10 flex items-center justify-center gap-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-[0.98] border ${movementType === 'transfer_in'
                                                    ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                                                    }`}
                                            >
                                                <ArrowsUpDownIcon className="h-4 w-4" />
                                                Receber de Filial
                                            </button>
                                        </div>
                                    </div>

                                    {(movementType === 'transfer_out' || movementType === 'transfer_in') && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                                                {movementType === 'transfer_out' ? 'Filial de Destino' : 'Filial de Origem'}
                                            </label>
                                            <select
                                                value={selectedBranchId}
                                                onChange={e => setSelectedBranchId(e.target.value)}
                                                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-300/50 focus:border-orange-300 outline-none transition-all font-semibold"
                                            >
                                                <option value="">Selecione a filial...</option>
                                                {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.city})</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {/* Quantity */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Quantidade</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={(movementType === 'saida' || movementType === 'transfer_out') ? selectedProduct.stock : 9999}
                                            value={quantity}
                                            onChange={e => {
                                                const val = Math.max(1, Number(e.target.value));
                                                setQuantity((movementType === 'saida' || movementType === 'transfer_out') ? Math.min(selectedProduct.stock, val) : val);
                                            }}
                                            className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-300/50 focus:border-orange-300 outline-none transition-all"
                                        />
                                        {(movementType === 'saida' || movementType === 'transfer_out') && (
                                            <p className="text-[10px] text-gray-400 mt-1">Máximo disponível principal: {selectedProduct.stock} unidade(s)</p>
                                        )}
                                    </div>

                                    {/* Reason for Entrada/Saida */}
                                    {(movementType === 'entrada' || movementType === 'saida') && (
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
                                    )}

                                    {/* Custom Reason */}
                                    {((movementType === 'entrada' || movementType === 'saida') && reason === 'Outro') && (
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

                                    {/* Transfer custom reason (Optional) */}
                                    {(movementType === 'transfer_out' || movementType === 'transfer_in') && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Observação (Opcional)</label>
                                            <input
                                                type="text"
                                                value={customReason}
                                                onChange={e => setCustomReason(e.target.value)}
                                                placeholder="Responsável pelo translado..."
                                                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-300/50 focus:border-orange-300 outline-none transition-all"
                                            />
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-3 pt-2">
                                        <button
                                            onClick={handleSubmit}
                                            disabled={submitting || ((movementType === 'entrada' || movementType === 'saida') && !reason) || (reason === 'Outro' && !customReason.trim()) || ((movementType === 'transfer_in' || movementType === 'transfer_out') && !selectedBranchId)}
                                            className={`flex-1 h-11 text-white rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg ${movementType === 'saida'
                                                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                                                : movementType === 'entrada' ? 'bg-green-500 hover:bg-green-600 shadow-green-500/20'
                                                    : movementType === 'transfer_out' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'
                                                        : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
                                                }`}
                                        >
                                            {submitting && <SpinnerIcon className="h-4 w-4 animate-spin" />}
                                            {movementType === 'saida' ? 'Confirmar Saída' : movementType === 'entrada' ? 'Confirmar Entrada' : 'Confirmar Transferência'}
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
                                <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Total Saídas (+ Transf)</p>
                                <p className="text-xl font-black text-red-600 mt-0.5">{summary.totalSaidas}</p>
                            </div>
                            <div className="bg-green-50/70 rounded-2xl p-3 border border-green-100/50 text-center">
                                <p className="text-[9px] font-black text-green-400 uppercase tracking-widest">Total Entradas (+ Transf)</p>
                                <p className="text-xl font-black text-green-600 mt-0.5">{summary.totalEntradas}</p>
                            </div>
                            <div className={`rounded-2xl p-3 border text-center ${summary.saldo >= 0 ? 'bg-blue-50/70 border-blue-100/50' : 'bg-orange-50/70 border-orange-100/50'}`}>
                                <p className={`text-[9px] font-black uppercase tracking-widest ${summary.saldo >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>Saldo Líquido Variado</p>
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
                                        <th className="px-3 py-2.5 text-left">Motivo / Filial</th>
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
                                                <td className="px-3 py-2.5 text-xs text-gray-600">
                                                    <div>{m.reason}</div>
                                                    {(m.transfer_to_branch_id || m.transfer_from_branch_id) && (
                                                        <div className="text-[9px] text-blue-500 font-bold uppercase tracking-widest mt-0.5">Transferência (Filial)</div>
                                                    )}
                                                </td>
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
