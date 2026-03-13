
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    ShieldCheck,
    Calendar as CalendarIcon,
    Smartphone,
    UserCircle
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getServiceOrders, getCustomers, getCustomerDevices, updateServiceOrder, returnOsPartsStock } from '../../services/mockApi';
import { ServiceOrder, Customer, CustomerDevice } from '../../types';
import Modal from '../../components/Modal';
import CustomerModal from '../../components/CustomerModal';
import { ServiceOrderElectronicDevicesModal } from '../../components/ServiceOrderElectronicDevicesModal';
import {
    calculateWarrantyExpiry,
    getRemainingDays,
    formatDateBR,
    startOfDay,
    endOfDay,
    toDateValue,
    getTodayStart,
    getWarrantyStatus,
    getTodayDateString
} from '../../utils/dateUtils';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import QuickOSModal from '../../components/QuickOSModal';
import ServiceOrderPrintModal from '../../components/print/ServiceOrderPrintModal';
import DeleteWithReasonModal from '../../components/DeleteWithReasonModal';

// --- Constants ---
type OSStatus = 'Orçamento' | 'Análise' | 'Aprovado' | 'Em Reparo' | 'Aguardando Peça' | 'Pronto' | 'Entregue' | 'Cancelada';

const STATUS_COLUMNS: OSStatus[] = ['Orçamento', 'Análise', 'Aprovado', 'Em Reparo', 'Aguardando Peça', 'Pronto', 'Entregue', 'Cancelada'];

const STATUS_CONFIG: Record<OSStatus, { color: string, bg: string, border: string, dot: string, gradient: string, dropBg: string }> = {
    'Orçamento': { color: 'text-indigo-700', bg: 'bg-indigo-100/80', border: 'border-indigo-200', dot: 'bg-indigo-500', gradient: 'from-indigo-100 to-indigo-50', dropBg: 'bg-indigo-50' },
    'Análise': { color: 'text-orange-700', bg: 'bg-orange-100/80', border: 'border-orange-200', dot: 'bg-orange-500', gradient: 'from-orange-100 to-orange-50', dropBg: 'bg-orange-50' },
    'Aprovado': { color: 'text-cyan-700', bg: 'bg-cyan-100/80', border: 'border-cyan-200', dot: 'bg-cyan-500', gradient: 'from-cyan-100 to-cyan-50', dropBg: 'bg-cyan-50' },
    'Em Reparo': { color: 'text-blue-700', bg: 'bg-blue-100/80', border: 'border-blue-200', dot: 'bg-blue-500', gradient: 'from-blue-100 to-blue-50', dropBg: 'bg-blue-50' },
    'Aguardando Peça': { color: 'text-amber-700', bg: 'bg-amber-100/80', border: 'border-amber-200', dot: 'bg-amber-500', gradient: 'from-amber-100 to-amber-50', dropBg: 'bg-amber-50' },
    'Pronto': { color: 'text-purple-700', bg: 'bg-purple-100/80', border: 'border-purple-300', dot: 'bg-purple-600', gradient: 'from-purple-100 to-purple-50', dropBg: 'bg-purple-50' },
    'Entregue': { color: 'text-emerald-700', bg: 'bg-emerald-100/80', border: 'border-emerald-200', dot: 'bg-emerald-500', gradient: 'from-emerald-100 to-emerald-50', dropBg: 'bg-emerald-50' },
    'Cancelada': { color: 'text-red-700', bg: 'bg-red-100/80', border: 'border-red-200', dot: 'bg-red-500', gradient: 'from-red-100 to-red-50', dropBg: 'bg-red-50' },
};

const calculateOSProfit = (os: any) => {
    const totalCost = (os.items || []).reduce((acc: number, item: any) => acc + ((item.cost || 0) * (item.quantity || 1)), 0);
    return (os.total || 0) - totalCost;
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
                    ? 'bg-indigo-100/60 border-indigo-200/80 hover:border-indigo-400/50 hover:bg-indigo-100/80 transition-all'
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
            <div className="mb-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-black text-indigo-600 bg-indigo-50/50 border border-indigo-200/60 shadow-sm">
                <div className="w-6 h-3.5 bg-indigo-500 rounded-full relative flex-shrink-0 shadow-inner">
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
                const profit = calculateOSProfit(os);
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
        return (localStorage.getItem('os_view_mode') as 'kanban' | 'list') || 'list';
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

    // Global search state
    const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
    const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
    const [allDevices, setAllDevices] = useState<CustomerDevice[]>([]);
    const [selectedDeviceForModal, setSelectedDeviceForModal] = useState<CustomerDevice | null>(null);
    const [customerForEdit, setCustomerForEdit] = useState<Customer | null>(null);
    const globalSearchRef = useRef<HTMLDivElement>(null);

    // Drag & Drop state
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<OSStatus | null>(null);
    const [warrantyFilter, setWarrantyFilter] = useState<'all' | 'active' | 'expiring_month'>('all');

    // Date filters
    const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
    const [startDate, setStartDate] = useState<string>(() => toDateValue(new Date()));
    const [endDate, setEndDate] = useState<string>(() => toDateValue(new Date()));

    const handlePeriodChange = (period: typeof periodFilter) => {
        setPeriodFilter(period);
        const today = new Date();

        if (period === 'all') {
            setStartDate('');
            setEndDate('');
            return;
        }

        let start = new Date(today);
        let end = new Date(today);

        switch (period) {
            case 'today':
                setStartDate(toDateValue(today));
                setEndDate(toDateValue(today));
                break;
            case 'yesterday':
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);
                setStartDate(toDateValue(yesterday));
                setEndDate(toDateValue(yesterday));
                break;
            case 'week':
                const firstDayOfWeek = today.getDate() - today.getDay();
                const weekStart = new Date(today.setDate(firstDayOfWeek));
                setStartDate(toDateValue(weekStart));
                setEndDate(toDateValue(new Date()));
                break;
            case 'month':
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                setStartDate(toDateValue(monthStart));
                setEndDate(toDateValue(new Date()));
                break;
        }
    };

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

    const loadGlobalSearchData = useCallback(async () => {
        try {
            const [custData, devData] = await Promise.all([getCustomers(), getCustomerDevices()]);
            setAllCustomers(custData || []);
            setAllDevices(devData || []);
        } catch { /* silencioso */ }
    }, []);

    React.useEffect(() => {
        loadOrders();
        loadGlobalSearchData();
    }, [loadGlobalSearchData]);

    // Fechar dropdown ao clicar fora
    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (globalSearchRef.current && !globalSearchRef.current.contains(e.target as Node)) {
                setGlobalSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Auto-open quick OS modal via query param (e.g. from ServiceOrderForm)
    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('quickOS') === '1') {
            setIsQuickOSOpen(true);
        }
    }, [location.search]);

    const filteredOrders = React.useMemo(() => {
        return orders.filter(os => {
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
                if (os.status === 'Cancelada' || os.status === 'Cancelado') {
                    matchWarranty = false;
                } else {
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
            }

            let matchDate = true;
            if ((startDate || endDate) && os.entryDate) {
                const entryDate = new Date(os.entryDate).getTime();
                if (startDate) {
                    const sDate = startOfDay(startDate).getTime();
                    if (entryDate < sDate) matchDate = false;
                }
                if (endDate) {
                    const eDate = endOfDay(endDate).getTime();
                    if (entryDate > eDate) matchDate = false;
                }
            }

            return matchSearch && matchStatus && matchWarranty && matchDate;
        });
    }, [orders, searchTerm, statusFilter, warrantyFilter, startDate, endDate]);

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
            // Retornar peças ao estoque ao cancelar a OS
            try {
                await returnOsPartsStock(osToCancel);
            } catch (e) {
                // Falha silenciosa ou log de erro
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
            <div className={`flex flex-col ${viewMode === 'kanban' ? 'h-full' : 'min-h-full pb-10'}`}>
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
                            className={`p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-primary text-white shadow-sm' : 'text-secondary hover:bg-gray-50'}`}
                            title="Visualização Kanban"
                        >
                            <Columns size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow-sm' : 'text-secondary hover:bg-gray-50'}`}
                            title="Visualização em Lista"
                        >
                            <List size={18} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
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

                {/* Date Filters Row */}
                <div className="flex flex-wrap items-center gap-3 mb-6 animate-in fade-in slide-in-from-top-1 duration-300">
                    {/* Global Search with dropdown */}
                    <div className="relative flex-1 sm:flex-initial" ref={globalSearchRef}>
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/50" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar cliente, CPF, aparelho..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setGlobalSearchOpen(e.target.value.length > 1); }}
                            onFocus={() => searchTerm.length > 1 && setGlobalSearchOpen(true)}
                            className="w-full sm:w-72 h-10 pl-9 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all"
                        />
                        {/* Global Search Dropdown */}
                        {globalSearchOpen && searchTerm.length > 1 && (() => {
                            const sl = searchTerm.toLowerCase();
                            const matchedCustomers = allCustomers.filter(c =>
                                (c.name || '').toLowerCase().includes(sl) ||
                                (c.cpf || '').includes(searchTerm) ||
                                (c.phone || '').includes(searchTerm)
                            ).slice(0, 3);
                            const matchedDevices = allDevices.filter(d =>
                                (d.customerName || '').toLowerCase().includes(sl) ||
                                (d.customerCpf || '').includes(searchTerm) ||
                                (d.model || '').toLowerCase().includes(sl) ||
                                (d.imei || '').includes(searchTerm)
                            ).slice(0, 3);
                            const matchedOS = orders.filter(o =>
                                (o.customerName || '').toLowerCase().includes(sl) ||
                                (o.displayId?.toString() || '').includes(searchTerm) ||
                                (o.deviceModel || '').toLowerCase().includes(sl)
                            ).slice(0, 5);
                            const hasAnything = matchedCustomers.length > 0 || matchedDevices.length > 0 || matchedOS.length > 0;
                            if (!hasAnything) return null;
                            return (
                                <div className="absolute top-full left-0 mt-2 w-[360px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-[200] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    {matchedCustomers.length > 0 && (
                                        <div>
                                            <div className="px-4 pt-3 pb-1 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cliente</div>
                                            {matchedCustomers.map(c => (
                                                <button key={c.id} onClick={() => { setCustomerForEdit(c); setGlobalSearchOpen(false); setSearchTerm(''); }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                                                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                                                        <UserCircle size={16} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-gray-900 truncate">{c.name}</p>
                                                        <p className="text-[11px] text-gray-400">{c.phone || c.cpf || 'Sem contato'}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {matchedDevices.length > 0 && (
                                        <div className="border-t border-gray-50">
                                            <div className="px-4 pt-3 pb-1 text-[10px] font-black text-gray-400 uppercase tracking-widest">Eletrônicos</div>
                                            {matchedDevices.map(d => (
                                                <button key={d.id} onClick={() => { setSelectedDeviceForModal(d); setGlobalSearchOpen(false); setSearchTerm(''); }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                                        <Smartphone size={14} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-gray-900 truncate">{d.model}</p>
                                                        <p className="text-[11px] text-gray-400 truncate">{d.customerName} {d.imei ? `• ${d.imei}` : ''}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {matchedOS.length > 0 && (
                                        <div className="border-t border-gray-50">
                                            <div className="px-4 pt-3 pb-1 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ordens de Serviço</div>
                                            {matchedOS.map(os => (
                                                <button key={os.id} onClick={() => { navigate(`/service-orders/edit/${os.id}`); setGlobalSearchOpen(false); setSearchTerm(''); }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
                                                        <Wrench size={14} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-bold text-gray-900">OS-{os.displayId}</p>
                                                            <span className="text-[10px] font-bold text-gray-400 truncate">{os.deviceModel}</span>
                                                        </div>
                                                        <p className="text-[11px] text-gray-400 truncate">{os.customerName}</p>
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${os.status === 'Entregue' ? 'bg-emerald-100 text-emerald-700' :
                                                        os.status === 'Cancelada' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                                        }`}>{os.status}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Status filter - only in list mode */}
                    {viewMode === 'list' && (
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="h-10 px-3 bg-white border border-gray-200 rounded-xl text-sm font-black focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all text-secondary cursor-pointer"
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
                            className="h-10 px-3 bg-white border border-gray-200 rounded-xl text-sm font-black focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all text-secondary cursor-pointer"
                        >
                            <option value="all">Garantias (Todas)</option>
                            <option value="active">Garantias Ativas</option>
                            <option value="expiring_month">Expiram este Mês</option>
                        </select>
                    )}

                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                        <button
                            onClick={() => handlePeriodChange('today')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${periodFilter === 'today' ? 'bg-primary text-white shadow-md' : 'text-secondary hover:bg-gray-50'}`}
                        >
                            Hoje
                        </button>
                        <button
                            onClick={() => handlePeriodChange('yesterday')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${periodFilter === 'yesterday' ? 'bg-primary text-white shadow-md' : 'text-secondary hover:bg-gray-50'}`}
                        >
                            Ontem
                        </button>
                        <button
                            onClick={() => handlePeriodChange('week')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${periodFilter === 'week' ? 'bg-primary text-white shadow-md' : 'text-secondary hover:bg-gray-50'}`}
                        >
                            Semana
                        </button>
                        <button
                            onClick={() => handlePeriodChange('month')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${periodFilter === 'month' ? 'bg-primary text-white shadow-md' : 'text-secondary hover:bg-gray-50'}`}
                        >
                            Mês
                        </button>
                        <button
                            onClick={() => handlePeriodChange('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${periodFilter === 'all' ? 'bg-primary text-white shadow-md' : 'text-secondary hover:bg-gray-50'}`}
                        >
                            Todos
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-white px-3 h-10 rounded-full border border-gray-200 shadow-sm">
                        <CalendarIcon size={14} className="text-secondary/50" />
                        <div className="flex items-center gap-1">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => { setStartDate(e.target.value); setPeriodFilter('custom'); }}
                                className="text-xs font-black text-secondary !bg-transparent outline-none cursor-pointer !border-0 !p-0"
                            />
                            <span className="text-gray-300 text-[10px] font-bold">ATÉ</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setPeriodFilter('custom'); }}
                                className="text-xs font-black text-secondary !bg-transparent outline-none cursor-pointer !border-0 !p-0"
                            />
                        </div>
                    </div>

                    {(startDate || endDate) && (
                        <button
                            onClick={() => handlePeriodChange('all')}
                            className="text-[10px] font-black text-red-500 hover:text-red-600 uppercase tracking-tighter"
                        >
                            Limpar Filtros
                        </button>
                    )}
                </div>

                {/* Content Area */}
                {viewMode === 'list' ? (
                    // LIST VIEW
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
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
                                        <th className="px-4 py-3 font-bold">Garantia</th>
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
                                            const profit = calculateOSProfit(os);

                                            return (
                                                <tr key={os.id} className={`transition-colors group ${os.isOrcamentoOnly ? 'bg-indigo-100/40 hover:bg-indigo-100/60' : 'hover:bg-gray-50/50'}`}>
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
                                                            const status = getWarrantyStatus(latestExpiry);
                                                            const isExpired = status === 'expired';
                                                            const days = getRemainingDays(latestExpiry);

                                                            return (
                                                                <div className="flex flex-col">
                                                                    <div className={`flex items-center gap-1 text-[10px] font-black ${isExpired ? 'text-red-500' : 'text-emerald-600'}`}>
                                                                        <ShieldCheck size={10} />
                                                                        {formatDateBR(latestExpiry)}
                                                                    </div>
                                                                    <span className={`text-[9px] font-bold ${isExpired ? 'text-red-400' : 'text-gray-400'}`}>
                                                                        {isExpired ? 'Expirada' : (days === 0 ? 'Expira hoje' : `Faltam ${days} ${days === 1 ? 'dia' : 'dias'}`)}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>
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
                                    const profit = calculateOSProfit(os);

                                    return (
                                        <div key={os.id} onClick={() => navigate(`/service-orders/edit/${os.id}`)} className={`p-4 transition-colors cursor-pointer ${os.isOrcamentoOnly ? 'bg-indigo-100/40 hover:bg-indigo-100/60 active:bg-indigo-200/40' : 'active:bg-gray-50'}`}>
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

            {/* Device Detail Modal - from global search */}
            {selectedDeviceForModal && (() => {
                const customer = allCustomers.find(c => c.id === selectedDeviceForModal.customerId);
                const relatedOsList = orders.filter(os => os.customerDeviceId === selectedDeviceForModal.id);
                const history = relatedOsList.length > 0 ? relatedOsList.map(os => ({ osId: os.displayId, status: os.status, id: os.id })) : (selectedDeviceForModal.history || []);

                return (
                <Modal
                    isOpen={!!selectedDeviceForModal}
                    onClose={() => setSelectedDeviceForModal(null)}
                    title="Detalhes do Eletrônico"
                    className="!max-w-2xl"
                >
                    <div className="space-y-4">
                        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 flex items-start gap-4">
                            <div className="w-16 h-16 bg-white border border-gray-200 rounded-2xl flex items-center justify-center shrink-0">
                                <Smartphone size={28} className="text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-black text-primary truncate">{selectedDeviceForModal.model}</h2>
                                <p className="text-sm text-secondary">{selectedDeviceForModal.type} {selectedDeviceForModal.brand ? `• ${selectedDeviceForModal.brand}` : ''}</p>
                                <div className="mt-1 flex items-center justify-between">
                                    <p className="text-sm font-bold text-primary flex items-center gap-1.5">
                                        <UserCircle size={14} className="text-purple-400" />
                                        {selectedDeviceForModal.customerName}
                                    </p>
                                    {customer?.phone && (
                                        <a href={`https://wa.me/55${customer.phone.replace(/\D/g, '')}?text=Olá!`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors">
                                           <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                                           WhatsApp
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {selectedDeviceForModal.imei && (
                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">IMEI 1</p>
                                    <p className="font-mono text-sm font-bold text-primary">{selectedDeviceForModal.imei}</p>
                                </div>
                            )}
                            {selectedDeviceForModal.imei2 && (
                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">IMEI 2</p>
                                    <p className="font-mono text-sm font-bold text-primary">{selectedDeviceForModal.imei2}</p>
                                </div>
                            )}
                            {selectedDeviceForModal.serialNumber && (
                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Número de Série</p>
                                    <p className="font-mono text-sm font-bold text-primary">{selectedDeviceForModal.serialNumber}</p>
                                </div>
                            )}
                            {selectedDeviceForModal.color && (
                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Cor</p>
                                    <p className="text-sm font-bold text-primary">{selectedDeviceForModal.color}</p>
                                </div>
                            )}
                        </div>
                        {history.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Histórico de OS</h3>
                                <div className="space-y-2">
                                    {history.slice(0, 5).map((h: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                                            <button 
                                                className="text-sm font-bold text-primary flex items-center gap-1.5 hover:text-indigo-600 transition-colors" 
                                                onClick={() => { if(h.id) { navigate(`/service-orders/edit/${h.id}`); setSelectedDeviceForModal(null); } }}
                                                title="Abrir OS"
                                            >
                                                OS-{h.osId}
                                            </button>
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${h.status === 'Entregue' ? 'bg-emerald-100 text-emerald-700' : h.status === 'Cancelada' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}>{h.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
                );
            })()}

            {/* Customer Edit Modal - from global search */}
            {customerForEdit && (
                <CustomerModal
                    entity={customerForEdit}
                    initialType="Cliente"
                    onClose={() => setCustomerForEdit(null)}
                    onSave={async (data, entityType, personType) => {
                        try {
                            const { updateCustomer: updateCust } = await import('../../services/mockApi');
                            await updateCust({ ...data, id: customerForEdit.id } as any);
                            setCustomerForEdit(null);
                            loadGlobalSearchData();
                            showToast('Cliente atualizado com sucesso!', 'success');
                        } catch {
                            showToast('Erro ao salvar cliente.', 'error');
                        }
                    }}
                />
            )}
        </>
    );
};

export default ServiceOrderList;
