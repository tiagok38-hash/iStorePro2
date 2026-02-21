
import React, { useState, useRef } from 'react';
import {
    SearchIcon,
    Filter,
    Columns,
    List,
    MoreVertical,
    Clock,
    Calendar,
    User,
    Smartphone,
    AlertCircle,
    CheckCircle2,
    WrenchIcon,
    PlusIcon,
    ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getServiceOrders, updateServiceOrder } from '../../services/mockApi';
import { ServiceOrder } from '../../types';
import { useToast } from '../../contexts/ToastContext';

// --- Constants ---
type OSStatus = 'Aberto' | 'Análise' | 'Orçamento' | 'Aprovado' | 'Em Reparo' | 'Pronto' | 'Entregue';

const STATUS_COLUMNS: OSStatus[] = ['Aberto', 'Análise', 'Orçamento', 'Aprovado', 'Em Reparo', 'Pronto', 'Entregue'];

const STATUS_CONFIG: Record<OSStatus, { color: string, bg: string, border: string, dot: string, gradient: string, dropBg: string }> = {
    'Aberto': { color: 'text-gray-700', bg: 'bg-gray-100/80', border: 'border-gray-200', dot: 'bg-gray-400', gradient: 'from-gray-100 to-gray-50', dropBg: 'bg-gray-100' },
    'Análise': { color: 'text-blue-700', bg: 'bg-blue-100/80', border: 'border-blue-200', dot: 'bg-blue-500', gradient: 'from-blue-100 to-blue-50', dropBg: 'bg-blue-50' },
    'Orçamento': { color: 'text-orange-700', bg: 'bg-orange-100/80', border: 'border-orange-200', dot: 'bg-orange-500', gradient: 'from-orange-100 to-orange-50', dropBg: 'bg-orange-50' },
    'Aprovado': { color: 'text-emerald-700', bg: 'bg-emerald-100/80', border: 'border-emerald-200', dot: 'bg-emerald-500', gradient: 'from-emerald-100 to-emerald-50', dropBg: 'bg-emerald-50' },
    'Em Reparo': { color: 'text-purple-700', bg: 'bg-purple-100/80', border: 'border-purple-200', dot: 'bg-purple-500', gradient: 'from-purple-100 to-purple-50', dropBg: 'bg-purple-50' },
    'Pronto': { color: 'text-green-700', bg: 'bg-green-100/80', border: 'border-green-300', dot: 'bg-green-600', gradient: 'from-green-100 to-green-50', dropBg: 'bg-green-50' },
    'Entregue': { color: 'text-slate-500', bg: 'bg-slate-50/80', border: 'border-slate-100', dot: 'bg-slate-300', gradient: 'from-slate-100 to-slate-50', dropBg: 'bg-slate-50' },
};

// --- Components ---
const StatusBadge = ({ status }: { status: string }) => (
    <span className={`px-2 py-1 rounded-md text-xs font-bold border ${STATUS_CONFIG[status as OSStatus]?.bg || 'bg-gray-100'} ${STATUS_CONFIG[status as OSStatus]?.color || 'text-gray-700'} ${STATUS_CONFIG[status as OSStatus]?.border || 'border-gray-200'}`}>
        {status}
    </span>
);

interface KanbanCardProps {
    os: any;
    onClick: () => void;
    onDragStart: (e: React.DragEvent, os: any) => void;
    onDragEnd: (e: React.DragEvent) => void;
    isDragging: boolean;
}

const KanbanCard: React.FC<KanbanCardProps> = ({ os, onClick, onDragStart, onDragEnd, isDragging }) => (
    <div
        draggable
        onDragStart={(e) => onDragStart(e, os)}
        onDragEnd={onDragEnd}
        onClick={onClick}
        className={`bg-white p-3 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-accent/40 transition-all cursor-grab active:cursor-grabbing group relative select-none
            ${isDragging ? 'opacity-40 scale-95 rotate-1' : 'opacity-100'}`}
    >
        <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-secondary bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">OS-{os.displayId}</span>
            {os.priority === 'Urgent' && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Urgente" />}
        </div>

        <h4 className="font-bold text-sm text-primary mb-1 truncate">{os.deviceModel}</h4>
        <p className="text-xs text-secondary mb-3 flex items-center gap-1">
            <User size={10} /> {os.customerName}
        </p>

        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
                <Clock size={10} /> {os.entryDate ? new Date(os.entryDate).toLocaleDateString() : '-'}
            </div>
            {os.total > 0 && <span className="text-xs font-bold text-emerald-600">R$ {os.total.toLocaleString()}</span>}
        </div>
    </div>
);

const ServiceOrderList: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
    const [searchTerm, setSearchTerm] = useState('');
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Drag & Drop state
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<OSStatus | null>(null);

    const loadOrders = async () => {
        setIsLoading(true);
        try {
            const data = await getServiceOrders();
            setOrders(data || []);
        } catch (error) {
            console.error("Error loading service orders:", error);
            showToast("Erro ao carregar ordens de serviço", "error");
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        loadOrders();
    }, []);

    const filteredOrders = orders.filter(os =>
        (os.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (os.deviceModel || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (os.displayId?.toString() || '').includes(searchTerm) ||
        os.id.includes(searchTerm)
    );

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
            console.error("Error updating service order status:", error);
            showToast("Erro ao mover OS. Tente novamente.", 'error');
            // Revert
            setOrders(prev => prev.map(o => o.id === id ? { ...o, status: os.status } : o));
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 sticky top-0 z-30 bg-[#F6F5FB]/90 backdrop-blur-sm py-2">
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

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/50" size={16} />
                        <input
                            type="text"
                            placeholder="Filtrar OS..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-64 h-10 pl-9 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all"
                        />
                    </div>

                    <button
                        onClick={() => navigate('/service-orders/new')}
                        className="bg-primary text-white h-10 px-4 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform flex items-center gap-2"
                    >
                        <PlusIcon size={16} />
                        Nova OS
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
                                    <th className="px-6 py-4">OS #</th>
                                    <th className="px-6 py-4">Cliente</th>
                                    <th className="px-6 py-4">Aparelho</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Técnico</th>
                                    <th className="px-6 py-4">Data</th>
                                    <th className="px-6 py-4 text-right">Valor</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-secondary">Carregando...</td>
                                    </tr>
                                ) : filteredOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-secondary">Nenhuma ordem de serviço encontrada.</td>
                                    </tr>
                                ) : (
                                    filteredOrders.map(os => (
                                        <tr key={os.id} onClick={() => navigate(`/service-orders/edit/${os.id}`)} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                                            <td className="px-6 py-4 font-medium text-primary">OS-{os.displayId}</td>
                                            <td className="px-6 py-4 text-secondary">{os.customerName}</td>
                                            <td className="px-6 py-4 font-medium text-primary">{os.deviceModel}</td>
                                            <td className="px-6 py-4"><StatusBadge status={os.status} /></td>
                                            <td className="px-6 py-4 text-secondary">{os.responsibleName || '-'}</td>
                                            <td className="px-6 py-4 text-secondary">{os.entryDate ? new Date(os.entryDate).toLocaleDateString() : '-'}</td>
                                            <td className="px-6 py-4 text-right font-bold text-emerald-600">{os.total > 0 ? `R$ ${os.total.toLocaleString()}` : '-'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-gray-400 hover:text-accent opacity-0 group-hover:opacity-100 transition-all">
                                                    <MoreVertical size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
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
                            filteredOrders.map(os => (
                                <div key={os.id} onClick={() => navigate(`/service-orders/edit/${os.id}`)} className="p-4 active:bg-gray-50 transition-colors cursor-pointer">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-primary">OS-{os.displayId}</span>
                                            <span className="text-[10px] text-gray-400">{os.entryDate ? new Date(os.entryDate).toLocaleDateString() : '-'}</span>
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
                                        {os.total > 0 && (
                                            <span className="font-bold text-emerald-600 text-sm">R$ {os.total.toLocaleString()}</span>
                                        )}
                                    </div>
                                </div>
                            ))
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
                                    const columnItems = filteredOrders.filter(os => os.status === status);
                                    const isOver = dragOverColumn === status;
                                    const cfg = STATUS_CONFIG[status];

                                    return (
                                        <div
                                            key={status}
                                            className={`w-72 flex flex-col h-full rounded-2xl border flex-shrink-0 transition-all duration-200
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
    );
};

export default ServiceOrderList;
