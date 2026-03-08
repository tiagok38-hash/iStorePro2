
import React, { useState, useEffect } from 'react';
import {
    SearchIcon,
    Columns,
    List,
    Clock,
    User,
    PlusIcon,
    Zap,
    Eye,
    Edit2,
    Printer,
    XCircle,
    Wrench,
    ShieldCheck
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getServiceOrders, updateServiceOrder, returnOsPartsStock } from '../../services/mockApi';
import { ServiceOrder } from '../../types';
import { calculateWarrantyExpiry, getRemainingDays, formatDateBR } from '../../utils/dateUtils';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import QuickOSModal from '../../components/QuickOSModal';
import ServiceOrderPrintModal from '../../components/print/ServiceOrderPrintModal';
import DeleteWithReasonModal from '../../components/DeleteWithReasonModal';

// --- Constants ---
type OSStatus = 'Orçamento' | 'Análise' | 'Aprovado' | 'Em Reparo' | 'Aguardando Peça' | 'Pronto' | 'Entregue' | 'Cancelada';

const STATUS_COLUMNS: OSStatus[] = ['Orçamento', 'Análise', 'Aprovado', 'Em Reparo', 'Aguardando Peça', 'Pronto', 'Entregue', 'Cancelada'];

const STATUS_CONFIG: Record<OSStatus, { color: string, bg: string, border: string, dot: string, gradient: string, dropBg: string }> = {
    'Orçamento': { color: 'text-red-700', bg: 'bg-red-100/80', border: 'border-red-200', dot: 'bg-red-500', gradient: 'from-red-100 to-red-50', dropBg: 'bg-red-50' },
    'Análise': { color: 'text-orange-700', bg: 'bg-orange-100/80', border: 'border-orange-200', dot: 'bg-orange-500', gradient: 'from-orange-100 to-orange-50', dropBg: 'bg-orange-50' },
    'Aprovado': { color: 'text-cyan-700', bg: 'bg-cyan-100/80', border: 'border-cyan-200', dot: 'bg-cyan-500', gradient: 'from-cyan-100 to-cyan-50', dropBg: 'bg-cyan-50' },
    'Em Reparo': { color: 'text-blue-700', bg: 'bg-blue-100/80', border: 'border-blue-200', dot: 'bg-blue-500', gradient: 'from-blue-100 to-blue-50', dropBg: 'bg-blue-50' },
    'Aguardando Peça': { color: 'text-amber-700', bg: 'bg-amber-100/80', border: 'border-amber-200', dot: 'bg-amber-500', gradient: 'from-amber-100 to-amber-50', dropBg: 'bg-amber-50' },
    'Pronto': { color: 'text-purple-700', bg: 'bg-purple-100/80', border: 'border-purple-300', dot: 'bg-purple-600', gradient: 'from-purple-100 to-purple-50', dropBg: 'bg-purple-50' },
    'Entregue': { color: 'text-emerald-700', bg: 'bg-emerald-100/80', border: 'border-emerald-200', dot: 'bg-emerald-500', gradient: 'from-emerald-100 to-emerald-50', dropBg: 'bg-emerald-50' },
    'Cancelada': { color: 'text-red-700', bg: 'bg-red-100/80', border: 'border-red-200', dot: 'bg-red-500', gradient: 'from-red-100 to-red-50', dropBg: 'bg-red-50' },
};

// --- Components ---
const StatusBadge = ({ status }: { status: string }) => {
    const displayStatus = status === 'Aberto' ? 'Orçamento' : status;
    const cfg = STATUS_CONFIG[displayStatus as OSStatus] || { color: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-200' };
    return (
        <span className={`px-2 py-1 rounded-md text-xs font-bold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
            {displayStatus}
        </span>
    );
};

interface KanbanCardProps {
    os: any;
    onClick: () => void;
    onDragStart: (e: React.DragEvent, os: any) => void;
    onDragEnd: (e: React.DragEvent) => void;
    isDragging: boolean;
    onCancel: (osId: string) => void;
    showProfit?: boolean;
}

const KanbanCard: React.FC<KanbanCardProps> = ({ os, onClick, onDragStart, onDragEnd, isDragging, onCancel, showProfit }) => (
    <div
        draggable
        onDragStart={(e) => onDragStart(e, os)}
        onDragEnd={onDragEnd}
        onClick={onClick}
        className={`p-3 rounded-xl shadow-sm border hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative select-none
            ${isDragging ? 'opacity-40 scale-95 rotate-1' : 'opacity-100'}
            ${os.status === 'Cancelada'
                ? 'bg-red-50/80 border-red-200 hover:border-red-300'
                : os.isOrcamentoOnly
                    ? 'bg-amber-100/60 border-amber-200/80 hover:border-amber-400/50 hover:bg-amber-100/80 transition-all'
                    : 'bg-white border-gray-100 hover:border-accent/40'}
            `}
    >
        <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-secondary bg-white px-1.5 py-0.5 rounded border border-gray-200 shadow-sm">
                    OS-{os.displayId}
                </span>
                {os.status === 'Cancelada' && (
                    <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">
                        Cancelada
                    </span>
                )}
            </div>
            <div className="flex items-center gap-1">
                {os.isQuick && (
                    <span title="OS Rápida" className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100">
                        <Zap size={11} className="text-amber-500 fill-amber-400" />
                    </span>
                )}
                {os.priority === 'Urgent' && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Urgente" />}
                {os.status !== 'Cancelada' && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onCancel(os.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-all"
                        title="Cancelar OS"
                    >
                        <XCircle size={12} />
                    </button>
                )}
            </div>
        </div>

        <h4 className="font-bold text-sm text-primary mb-1 truncate">{os.deviceModel}</h4>
        <p className="text-xs text-secondary mb-3 flex items-center gap-1">
            <User size={10} /> {os.customerName}
        </p>

        {os.isOrcamentoOnly && os.status !== 'Cancelada' && (
            <div className="mb-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-black text-amber-600 bg-amber-50/50 border border-amber-200/60 shadow-sm">
                <div className="w-6 h-3.5 bg-amber-500 rounded-full relative flex-shrink-0 shadow-inner">
                    <div className="absolute right-0.5 top-[2px] w-2.5 h-2.5 bg-white rounded-full shadow-sm"></div>
                </div>
                Orçamento
            </div>
        )}

        <div className="flex flex-col gap-1 pt-2 border-t border-black/5">
            <div className="flex items-center gap-1 text-[10px] text-gray-500 font-medium whitespace-nowrap overflow-hidden">
                <Clock size={10} className="shrink-0" /> {os.entryDate ? new Date(os.entryDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
            </div>
            {os.status === 'Cancelada' && os.cancellationReason && (
                <div className="bg-red-100/50 p-1.5 rounded-lg border border-red-200 mt-1">
                    <p className="text-[9px] font-bold text-red-600 uppercase tracking-tighter mb-0.5">Motivo Cancelamento:</p>
                    <p className="text-[10px] text-red-700 leading-tight italic line-clamp-2" title={os.cancellationReason}>"{os.cancellationReason}"</p>
                </div>
            )}
        </div>
        <div className="flex justify-between items-end mt-1">
            {os.total > 0 && <span className="text-xs font-black text-gray-900">R$ {os.total.toLocaleString()}</span>}
            {showProfit && (() => {
                const totalCost = (os.items || []).reduce((acc: number, item: any) => acc + ((item.cost || 0) * (item.quantity || 1)), 0);
                const profit = (os.total || 0) - totalCost;
                return profit > 0 ? (
                    <span className="text-[10px] font-bold text-emerald-600">Lucro: R$ {profit.toLocaleString()}</span>
                ) : null;
            })()}
        </div>
    </div>
);



const ServiceOrderList: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();
    const { user: loggedInUser, permissions } = useUser();
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>(() => {
        return (localStorage.getItem('os_view_mode') as 'kanban' | 'list') || 'kanban';
    });

    useEffect(() => {
        localStorage.setItem('os_view_mode', viewMode);
    }, [viewMode]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('Todos');
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isQuickOSOpen, setIsQuickOSOpen] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [selectedOSForPrint, setSelectedOSForPrint] = useState<any>(null);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [osToCancel, setOsToCancel] = useState<string | null>(null);

    // Drag & Drop state
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<OSStatus | null>(null);
    const [warrantyFilter, setWarrantyFilter] = useState<'all' | 'active' | 'expiring_month'>('all');

    const loadOrders = async () => {
        setIsLoading(true);
        try {
            const data = await getServiceOrders();
            setOrders(data || []);
        } catch (error) {
            showToast("Erro ao carregar ordens de serviço", "error");
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        loadOrders();
    }, []);

    // Auto-open quick OS modal via query param (e.g. from ServiceOrderForm)
    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('quickOS') === '1') {
            setIsQuickOSOpen(true);
        }
    }, [location.search]);

    const filteredOrders = orders.filter(os => {
        const searchLower = searchTerm.toLowerCase();
        const matchSearch =
            (os.customerName || '').toLowerCase().includes(searchLower) ||
            (os.deviceModel || '').toLowerCase().includes(searchLower) ||
            (os.imei || '').toLowerCase().includes(searchLower) ||
            (os.serialNumber || '').toLowerCase().includes(searchLower) ||
            (os.displayId?.toString() || '').includes(searchTerm) ||
            os.id.includes(searchTerm);
        const matchStatus = statusFilter === 'Todos' || os.status === statusFilter;

        let matchWarranty = true;
        if (warrantyFilter !== 'all') {
            const items = os.items || [];
            const osExitDate = os.exitDate;
            if (!osExitDate) {
                matchWarranty = false;
            } else {
                const itemExpiries = items
                    .filter((i: any) => i.warranty)
                    .map((i: any) => calculateWarrantyExpiry(osExitDate, i.warranty));

                if (itemExpiries.length === 0) {
                    matchWarranty = false;
                } else {
                    const latestExpiry = new Date(Math.max(...itemExpiries.map((d: any) => d.getTime())));
                    const now = new Date();

                    if (warrantyFilter === 'active') {
                        matchWarranty = latestExpiry > now;
                    } else if (warrantyFilter === 'expiring_month') {
                        const currentMonth = now.getMonth();
                        const currentYear = now.getFullYear();
                        matchWarranty = latestExpiry.getMonth() === currentMonth && latestExpiry.getFullYear() === currentYear;
                    }
                }
            }
        }

        return matchSearch && matchStatus && matchWarranty;
    });

    // ---- DRAG & DROP HANDLERS ----
    const handleDragStart = (e: React.DragEvent, os: any) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', os.id);
        setDraggingId(os.id);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        setDraggingId(null);
        setDragOverColumn(null);
    };

    const handleDragOver = (e: React.DragEvent, status: OSStatus) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverColumn(status);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        // Only clear if leaving the column itself (not a child element)
        const related = e.relatedTarget as Node | null;
        if (!e.currentTarget.contains(related)) {
            setDragOverColumn(null);
        }
    };

    const handleDrop = async (e: React.DragEvent, newStatus: OSStatus) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        if (!id) return;

        const os = orders.find(o => o.id === id);
        if (!os || os.status === newStatus) {
            setDraggingId(null);
            setDragOverColumn(null);
            return;
        }

        // Optimistic update
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
        setDraggingId(null);
        setDragOverColumn(null);

        try {
            await updateServiceOrder(id, { status: newStatus } as any);
            showToast(`OS movida para "${newStatus}"`, 'success');
        } catch (error) {
            showToast("Erro ao mover OS. Tente novamente.", 'error');
            // Revert
            setOrders(prev => prev.map(o => o.id === id ? { ...o, status: os.status } : o));
        }
    };

    const handleCancelOS = async (reason: string) => {
        if (!osToCancel) return;
        try {
            // Se a OS era 'Entregue', devolver peças ao estoque
            const osData = orders.find(o => o.id === osToCancel);
            if (osData && osData.status === 'Entregue') {
                try {
                    await returnOsPartsStock(osToCancel);
                } catch (e) {
                    // Fail silently or handle accordingly
                }
            }
            await updateServiceOrder(osToCancel, {
                status: 'Cancelada',
                cancellationReason: reason
            } as any);
            showToast('OS cancelada com sucesso.', 'success');
            setIsCancelModalOpen(false);
            setOsToCancel(null);
            loadOrders();
        } catch {
            showToast('Erro ao cancelar a OS.', 'error');
        }
    };

    return (
        <>
            <div className="flex flex-col h-full">
                {/* Page Title */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-primary rounded-2xl text-white shadow-lg shadow-primary/20">
                        <Wrench size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-primary tracking-tight">Ordens de Serviço</h1>
                        <p className="text-sm font-medium text-secondary">Gerenciamento completo de atendimentos</p>
                    </div>
                </div>

                {/* Header Controls */}
                <div className="flex flex-col lg:flex-row justify-between items-center gap-4 mb-6 sticky top-0 z-30 bg-[#F6F5FB]/90 backdrop-blur-sm py-2">
                    <div className="flex items-center gap-2 bg-white rounded-xl shadow-sm border border-gray-200 p-1">
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-accent text-white shadow-sm' : 'text-secondary hover:bg-gray-50'}`}
                            title="Visualização Kanban"
                        >
                            <Columns size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-accent text-white shadow-sm' : 'text-secondary hover:bg-gray-50'}`}
                            title="Visualização em Lista"
                        >
                            <List size={18} />
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <div className="relative flex-1 sm:flex-initial">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/50" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar OS..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full sm:w-64 h-10 pl-9 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all"
                            />
                        </div>

                        {/* Status filter - only in list mode */}
                        {viewMode === 'list' && (
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="h-10 px-3 bg-white border border-gray-200 rounded-xl text-sm font-black focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all text-secondary cursor-pointer border-r-8 border-transparent"
                            >
                                <option value="Todos">Status</option>
                                <option value="Orçamento">Orçamento</option>
                                <option value="Análise">Análise</option>
                                <option value="Aprovado">Aprovado</option>
                                <option value="Em Reparo">Em Reparo</option>
                                <option value="Aguardando Peça">Aguardando Peça</option>
                                <option value="Pronto">Pronto</option>
                                <option value="Entregue">Entregue</option>
                                <option value="Cancelada">Cancelada</option>
                            </select>
                        )}

                        {/* Warranty filter - only in list mode */}
                        {viewMode === 'list' && (
                            <select
                                value={warrantyFilter}
                                onChange={(e) => setWarrantyFilter(e.target.value as any)}
                                className="h-10 px-3 bg-white border border-gray-200 rounded-xl text-sm font-black focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all text-secondary cursor-pointer border-r-8 border-transparent"
                            >
                                <option value="all">Garantias (Todas)</option>
                                <option value="active">Garantias Ativas</option>
                                <option value="expiring_month">Expiram este Mês</option>
                            </select>
                        )}

                        <button
                            onClick={() => navigate('/service-orders/new')}
                            className="bg-primary text-white h-10 px-4 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform flex items-center gap-2 whitespace-nowrap"
                        >
                            <PlusIcon size={16} />
                            Nova OS
                        </button>
                        <button
                            onClick={() => setIsQuickOSOpen(true)}
                            className="bg-amber-400 hover:bg-amber-500 text-white h-10 px-4 rounded-xl text-sm font-bold shadow-lg shadow-amber-400/30 hover:scale-105 transition-transform flex items-center gap-2 whitespace-nowrap"
                        >
                            <Zap size={16} className="fill-white" />
                            OS Rápida
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                {viewMode === 'list' ? (
                    // LIST VIEW
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex-1">
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50/50 text-secondary uppercase text-[10px] font-bold tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 font-bold">OS #</th>
                                        <th className="px-4 py-3 font-bold">Cliente</th>
                                        <th className="px-4 py-3 font-bold">Aparelho</th>
                                        <th className="px-4 py-3 font-bold">Status</th>
                                        <th className="px-4 py-3 font-bold">Técnico</th>
                                        <th className="px-3 py-3 font-bold w-[100px]">Dt. Entrada</th>
                                        <th className="px-3 py-3 font-bold w-[100px]">Dt. Prevista</th>
                                        {warrantyFilter !== 'all' && <th className="px-4 py-3 font-bold">Garantia</th>}
                                        <th className="px-4 py-3 font-bold text-right">Valor</th>
                                        {permissions?.canViewServiceOrderProfit && <th className="px-4 py-3 font-bold text-right">Lucro</th>}
                                        <th className="px-4 py-3 font-bold text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={10} className="px-6 py-12 text-center text-secondary">Carregando...</td>
                                        </tr>
                                    ) : filteredOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="px-6 py-12 text-center text-secondary">Nenhuma ordem de serviço encontrada.</td>
                                        </tr>
                                    ) : (
                                        filteredOrders.map(os => {
                                            const totalCost = (os.items || []).reduce((acc: number, item: any) => acc + ((item.cost || 0) * (item.quantity || 1)), 0);
                                            const profit = (os.total || 0) - totalCost;

                                            return (
                                                <tr key={os.id} className={`transition-colors group ${os.isOrcamentoOnly ? 'bg-amber-100/40 hover:bg-amber-100/60' : 'hover:bg-gray-50/50'}`}>
                                                    <td className="px-4 py-3 font-medium text-primary">
                                                        <div className="flex items-center gap-1">
                                                            {os.isQuick && <Zap size={11} className="text-amber-500 fill-amber-400 flex-shrink-0" />}
                                                            <span className="cursor-pointer hover:text-accent" onClick={() => navigate(`/service-orders/edit/${os.id}`)}>OS-{os.displayId}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-secondary">{os.customerName}</td>
                                                    <td className="px-4 py-3 font-medium text-primary">{os.deviceModel}</td>
                                                    <td className="px-4 py-3"><StatusBadge status={os.status} /></td>
                                                    <td className="px-4 py-3 text-secondary text-sm">{os.responsibleName || '-'}</td>
                                                    <td className="px-4 py-3 text-secondary text-sm">
                                                        {os.entryDate ? new Date(os.entryDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-secondary text-sm">
                                                        {os.estimatedDate ? new Date(os.estimatedDate).toLocaleDateString('pt-BR') : '-'}
                                                    </td>
                                                    {warrantyFilter !== 'all' && (
                                                        <td className="px-4 py-3">
                                                            {(() => {
                                                                const items = os.items || [];
                                                                const osExitDate = os.exitDate;
                                                                if (!osExitDate) return <span className="text-gray-400 text-[10px]">—</span>;

                                                                const itemExpiries = items
                                                                    .filter((i: any) => i.warranty)
                                                                    .map((i: any) => calculateWarrantyExpiry(osExitDate, i.warranty));

                                                                if (itemExpiries.length === 0) return <span className="text-gray-400 text-[10px]">—</span>;

                                                                const latestExpiry = new Date(Math.max(...itemExpiries.map((d: any) => d!.getTime())));
                                                                const days = getRemainingDays(latestExpiry);
                                                                const isExpired = days < 0;

                                                                return (
                                                                    <div className="flex flex-col">
                                                                        <div className={`flex items-center gap-1 text-[10px] font-black ${isExpired ? 'text-red-500' : 'text-emerald-600'}`}>
                                                                            <ShieldCheck size={10} />
                                                                            {formatDateBR(latestExpiry)}
                                                                        </div>
                                                                        <span className={`text-[9px] font-bold ${isExpired ? 'text-red-400' : 'text-gray-400'}`}>
                                                                            {isExpired ? 'Expirada' : `Faltam ${days} dias`}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-3 text-right font-black text-gray-900">{os.total > 0 ? `R$ ${os.total.toLocaleString()}` : '-'}</td>
                                                    {permissions?.canViewServiceOrderProfit && (
                                                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{profit > 0 ? `R$ ${profit.toLocaleString()}` : '-'}</td>
                                                    )}
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1 justify-end">
                                                            <button
                                                                onClick={() => navigate(`/service-orders/edit/${os.id}`)}
                                                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                                                title="Visualizar / Editar"
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => navigate(`/service-orders/edit/${os.id}`)}
                                                                className="p-1.5 rounded-lg text-gray-400 hover:text-accent hover:bg-accent/10 transition-all"
                                                                title="Editar"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedOSForPrint(os);
                                                                    setIsPrintModalOpen(true);
                                                                }}
                                                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
                                                                title="Re-imprimir"
                                                            >
                                                                <Printer size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setOsToCancel(os.id);
                                                                    setIsCancelModalOpen(true);
                                                                }}
                                                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                                                title="Cancelar OS"
                                                            >
                                                                <XCircle size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile List View */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {isLoading ? (
                                <div className="p-8 text-center text-secondary">Carregando...</div>
                            ) : filteredOrders.length === 0 ? (
                                <div className="p-8 text-center text-secondary">Nenhuma ordem de serviço encontrada.</div>
                            ) : (
                                filteredOrders.map(os => {
                                    const totalCost = (os.items || []).reduce((acc: number, item: any) => acc + ((item.cost || 0) * (item.quantity || 1)), 0);
                                    const profit = (os.total || 0) - totalCost;

                                    return (
                                        <div key={os.id} onClick={() => navigate(`/service-orders/edit/${os.id}`)} className={`p-4 transition-colors cursor-pointer ${os.isOrcamentoOnly ? 'bg-amber-100/40 hover:bg-amber-100/60 active:bg-amber-200/40' : 'active:bg-gray-50'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-primary">OS-{os.displayId}</span>
                                                    <span className="text-[10px] text-gray-400">{os.entryDate ? new Date(os.entryDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span>
                                                </div>
                                                <StatusBadge status={os.status} />
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <h4 className="font-bold text-sm text-primary mb-0.5">{os.deviceModel}</h4>
                                                    <p className="text-xs text-secondary flex items-center gap-1">
                                                        <User size={12} /> {os.customerName}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    {os.total > 0 && (
                                                        <span className="font-black text-gray-900 text-sm">R$ {os.total.toLocaleString()}</span>
                                                    )}
                                                    {permissions?.canViewServiceOrderProfit && profit > 0 && (
                                                        <span className="font-bold text-emerald-600 text-[10px]">Lucro: R$ {profit.toLocaleString()}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                ) : (
                    // KANBAN VIEW
                    <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-40">
                                <div className="text-center">
                                    <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                    <p className="text-secondary text-sm">Carregando...</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Hint text */}
                                <p className="text-[11px] text-gray-400 mb-3 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                    Arraste os cartões para mover entre os status
                                </p>
                                <div className="flex gap-4 min-w-[max-content] h-full">
                                    {STATUS_COLUMNS.map(status => {
                                        const columnItems = filteredOrders.filter(os =>
                                            os.status === status || (status === 'Orçamento' && os.status === 'Aberto')
                                        );
                                        const isOver = dragOverColumn === status;
                                        const cfg = STATUS_CONFIG[status];

                                        return (
                                            <div
                                                key={status}
                                                className={`w-[268px] flex flex-col h-full rounded-2xl border flex-shrink-0 transition-all duration-200
                                                ${isOver
                                                        ? `${cfg.dropBg} border-dashed ${cfg.border} border-2 shadow-lg scale-[1.01]`
                                                        : `bg-gray-50/50 ${cfg.border} border`
                                                    }`}
                                                onDragOver={(e) => handleDragOver(e, status)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, status)}
                                            >
                                                {/* Column Header */}
                                                <div className={`p-4 border-b-2 flex justify-between items-center rounded-t-2xl bg-gradient-to-b ${cfg.gradient} ${cfg.border.replace('border-', 'border-b-')}`}>
                                                    <h3 className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2 ${cfg.color}`}>
                                                        <span className={`w-2 h-2 rounded-full shadow-sm ${cfg.dot}`}></span>
                                                        {status}
                                                    </h3>
                                                    <span className="bg-white/90 px-2 py-0.5 rounded-lg text-[10px] font-black text-gray-500 border border-gray-100 shadow-sm">
                                                        {columnItems.length}
                                                    </span>
                                                </div>

                                                {/* Cards Area */}
                                                <div className="p-2 flex-1 overflow-y-auto space-y-2 custom-scrollbar min-h-[80px]">
                                                    {columnItems.map(os => (
                                                        <KanbanCard
                                                            key={os.id}
                                                            os={os}
                                                            onClick={() => navigate(`/service-orders/edit/${os.id}`)}
                                                            onDragStart={handleDragStart}
                                                            onDragEnd={handleDragEnd}
                                                            isDragging={draggingId === os.id}
                                                            onCancel={(id) => {
                                                                setOsToCancel(id);
                                                                setIsCancelModalOpen(true);
                                                            }}
                                                            showProfit={permissions?.canViewServiceOrderProfit}
                                                        />
                                                    ))}
                                                    {columnItems.length === 0 && (
                                                        <div className={`h-24 flex items-center justify-center border-2 border-dashed rounded-xl transition-all
                                                        ${isOver ? `${cfg.border} border-opacity-50 bg-white/50` : 'border-gray-100'}`}>
                                                            <p className={`text-[10px] font-medium ${isOver ? cfg.color : 'text-gray-300'}`}>
                                                                {isOver ? 'Soltar aqui' : 'Vazio'}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {isQuickOSOpen && (
                <QuickOSModal
                    onClose={() => setIsQuickOSOpen(false)}
                    onSaved={() => {
                        setIsQuickOSOpen(false);
                        loadOrders();
                    }}
                />
            )}

            {isPrintModalOpen && selectedOSForPrint && (
                <ServiceOrderPrintModal
                    serviceOrder={selectedOSForPrint}
                    initialFormat="thermal"
                    onClose={() => {
                        setIsPrintModalOpen(false);
                        setSelectedOSForPrint(null);
                    }}
                />
            )}

            {/* Cancel Modal with Reason */}
            <DeleteWithReasonModal
                isOpen={isCancelModalOpen}
                onClose={() => {
                    setIsCancelModalOpen(false);
                    setOsToCancel(null);
                }}
                onConfirm={handleCancelOS}
                title="Cancelar Ordem de Serviço"
                message="Informe o motivo do cancelamento. Esta ação não poderá ser desfeita."
                reasonLabel="Motivo do Cancelamento*"
            />
        </>
    );
};

export default ServiceOrderList;
