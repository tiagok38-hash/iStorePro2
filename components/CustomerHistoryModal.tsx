
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import { getServiceOrders, getCustomerDevices } from '../services/mockApi';
import { ServiceOrder, CustomerDevice, Customer } from '../types';
import { 
    HistoryIcon, 
    SmartphoneIcon, 
    WrenchIcon, 
    CalendarDaysIcon, 
    SuccessIcon, 
    ClockIcon,
    ArrowRightCircleIcon,
    ShieldCheckIcon
} from './icons';
import { formatCurrency } from '../utils/formatters';
import StatusBadge from './StatusBadge';
import GlobalLoading from './GlobalLoading';

interface CustomerHistoryModalProps {
    customer: Customer;
    onClose: () => void;
}

const CustomerHistoryModal: React.FC<CustomerHistoryModalProps> = ({ customer, onClose }) => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
    const [devices, setDevices] = useState<CustomerDevice[]>([]);
    const [activeTab, setActiveTab] = useState<'os' | 'devices'>('os');

    useEffect(() => {
        const loadHistory = async () => {
            setIsLoading(true);
            try {
                const [allOS, allDevices] = await Promise.all([
                    getServiceOrders(),
                    getCustomerDevices()
                ]);

                // Filter by customer ID
                setServiceOrders(allOS.filter(os => os.customerId === customer.id));
                setDevices(allDevices.filter(d => d.customerId === customer.id));
            } catch (error) {
                console.error("Error loading customer history:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadHistory();
    }, [customer.id]);

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <Modal 
            isOpen={true} 
            onClose={onClose} 
            title={`Histórico: ${customer.name}`}
            maxWidth="max-w-4xl"
        >
            <div className="flex flex-col h-[70vh]">
                {/* Header Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <WrenchIcon size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Ordens de Serviço</p>
                            <p className="text-2xl font-black text-blue-900">{serviceOrders.length}</p>
                        </div>
                    </div>
                    <div className="bg-purple-50/50 rounded-2xl p-4 border border-purple-100 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                            <SmartphoneIcon size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-purple-600 uppercase tracking-wider">Aparelhos</p>
                            <p className="text-2xl font-black text-purple-900">{devices.length}</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-100 p-1 rounded-xl mb-6 w-full">
                    <button
                        onClick={() => setActiveTab('os')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeTab === 'os' 
                            ? 'bg-white text-gray-800 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Histórico de OS
                    </button>
                    <button
                        onClick={() => setActiveTab('devices')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeTab === 'devices' 
                            ? 'bg-white text-gray-800 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Aparelhos Vinculados
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-gray-500 font-medium">Carregando histórico...</p>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'os' && (
                                <div className="space-y-4">
                                    {serviceOrders.length === 0 ? (
                                        <div className="text-center py-10 text-gray-400">
                                            <WrenchIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                            <p>Nenhuma ordem de serviço encontrada.</p>
                                        </div>
                                    ) : (
                                        serviceOrders.map(os => (
                                            <div 
                                                key={os.id} 
                                                onClick={() => navigate(`/service-orders/edit/${os.id}`)}
                                                className="relative group bg-white border border-gray-100 rounded-2xl p-4 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-pointer overflow-hidden"
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-black text-gray-400 uppercase tracking-tighter">OS #{os.displayId}</span>
                                                            <StatusBadge status={os.status} />
                                                        </div>
                                                        <h4 className="font-bold text-gray-800">{os.deviceModel}</h4>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-black text-gray-900">{formatCurrency(os.total)}</p>
                                                        <p className="text-[10px] text-gray-400 font-medium">{formatDate(os.createdAt)}</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-4 text-xs">
                                                    <div className="flex items-center gap-2 text-gray-500 bg-gray-50/50 p-2 rounded-lg border border-gray-100/50">
                                                        <ClockIcon size={14} className="text-blue-500" />
                                                        <span className="truncate">Entrada: {new Date(os.entryDate).toLocaleDateString('pt-BR')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-gray-500 bg-gray-50/50 p-2 rounded-lg border border-gray-100/50">
                                                        <SuccessIcon size={14} className="text-green-500" />
                                                        <span className="truncate">Técnico: {os.responsibleName}</span>
                                                    </div>
                                                </div>

                                                {os.status === 'Entregue e Faturado' && os.exitDate && (
                                                    <div className="mt-2 flex items-center gap-2 px-2 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 text-[11px] font-bold">
                                                        <ShieldCheckIcon size={14} />
                                                        <span>Faturado em: {formatDate(os.exitDate)}</span>
                                                    </div>
                                                )}

                                                {os.technicalReport && (
                                                    <div className="mt-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100 border-dashed">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Laudo Técnico</p>
                                                        <p className="text-xs text-secondary italic line-clamp-2">{os.technicalReport}</p>
                                                    </div>
                                                )}

                                                <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <ArrowRightCircleIcon className="text-blue-500 w-6 h-6" />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'devices' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {devices.length === 0 ? (
                                        <div className="col-span-full text-center py-10 text-gray-400">
                                            <SmartphoneIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                            <p>Nenhum aparelho cadastrado.</p>
                                        </div>
                                    ) : (
                                        devices.map(device => (
                                            <div key={device.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex gap-4 hover:border-purple-200 hover:shadow-md transition-all">
                                                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
                                                    <SmartphoneIcon size={24} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-gray-800 truncate">{device.model}</h4>
                                                    <p className="text-xs text-gray-500 mb-2">{device.brand} • {device.color}</p>
                                                    
                                                    <div className="space-y-1">
                                                        {device.imei && (
                                                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                                                <span className="font-bold uppercase">IMEI:</span>
                                                                <span className="font-mono">{device.imei}</span>
                                                            </div>
                                                        )}
                                                        {device.serialNumber && (
                                                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                                                <span className="font-bold uppercase">S/N:</span>
                                                                <span className="font-mono">{device.serialNumber}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default CustomerHistoryModal;
