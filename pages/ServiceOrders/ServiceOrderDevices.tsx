import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Plus, Search, Clock, Calendar, Cpu, FileText, User, Wrench, Image as ImageIcon, ShoppingCart, Edit, Trash2, CheckCircle, MessageCircle } from 'lucide-react';
import Modal from '../../components/Modal';
import { WhatsAppIcon } from '../../components/icons';
import { ServiceOrderElectronicDevicesModal } from '../../components/ServiceOrderElectronicDevicesModal';
import DeleteWithReasonModal from '../../components/DeleteWithReasonModal';
import { useToast } from '../../contexts/ToastContext';
import { Customer, Brand, Category, ProductModel, Grade, GradeValue, CustomerDevice } from '../../types';
import { getCustomers, getBrands, getCategories, getProductModels, getGrades, getGradeValues, getCustomerDevices, addCustomerDevice, updateCustomerDevice, deleteCustomerDevice, getServiceOrders } from '../../services/mockApi';

// Types and Mock Data Interfaces
export type ElectronicType = 'Produtos Apple' | 'Smartphone' | 'Tablets' | 'Computadores' | 'Notebooks' | 'Caixas de Som' | 'Outros';

// O MOCK_DEVICES agora é carregado do banco de dados via API.

const FILTER_OPTIONS: (ElectronicType | 'Todos')[] = [
    'Todos',
    'Produtos Apple',
    'Smartphone',
    'Tablets',
    'Computadores',
    'Notebooks',
    'Caixas de Som',
    'Outros'
];

const ServiceOrderDevices: React.FC = () => {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [productModels, setProductModels] = useState<ProductModel[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [gradeValues, setGradeValues] = useState<GradeValue[]>([]);

    const [devices, setDevices] = useState<CustomerDevice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { showToast } = useToast();
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deviceToDelete, setDeviceToDelete] = useState<string | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [fetchedCustomers, fetchedBrands, fetchedCats, fetchedModels, fetchedGrades, fetchedGradeValues, fetchedDevices, fetchedOrders] = await Promise.all([
                getCustomers(), getBrands(), getCategories(), getProductModels(), getGrades(), getGradeValues(), getCustomerDevices(), getServiceOrders()
            ]);
            setCustomers(fetchedCustomers);
            setBrands(fetchedBrands);
            setCategories(fetchedCats);
            setProductModels(fetchedModels);
            setGrades(fetchedGrades);
            setGradeValues(fetchedGradeValues);
            
            const devicesWithHistory = fetchedDevices.map(device => {
                const deviceOrders = fetchedOrders.filter(so => so.customerDeviceId === device.id);
                const history = deviceOrders.map(so => ({
                    id: so.id,
                    osId: so.displayId ? `OS-${String(so.displayId).padStart(4, '0')}` : so.id,
                    status: so.status,
                    date: so.entryDate || so.createdAt,
                    exitDate: so.exitDate || so.estimatedDate,
                    problemsReported: [so.defectDescription].filter(Boolean) as string[],
                    attendantObservations: so.attendantObservations,
                    technicalReport: so.technicalReport,
                    attendant: so.attendantName || 'Não informado',
                    technician: so.responsibleName || 'Não informado',
                    photos: [] as string[]
                }));
                // Sort history by date descending
                history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                return { ...device, history };
            });

            setDevices(devicesWithHistory);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<ElectronicType | 'Todos'>('Todos');
    const [selectedDevice, setSelectedDevice] = useState<CustomerDevice | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Form state (simplified for example)
    const [formData, setFormData] = useState<Partial<CustomerDevice>>({
        type: 'Smartphone',
        model: '',
        brand: '',
        color: '',
        imei: '',
        customerName: '',
    });

    const filteredDevices = devices.filter(device => {
        const lowerSearch = searchTerm.toLowerCase();
        const matchesSearch = device.model.toLowerCase().includes(lowerSearch) ||
            (device.imei && device.imei.includes(searchTerm)) ||
            (device.imei2 && device.imei2.includes(searchTerm)) ||
            (device.serialNumber && device.serialNumber.toLowerCase().includes(lowerSearch)) ||
            (device.ean && device.ean.includes(searchTerm)) ||
            device.customerName.toLowerCase().includes(lowerSearch) ||
            (device.customerCpf && device.customerCpf.includes(searchTerm)) ||
            (device.history || []).some(h => (h.osId || '').toLowerCase().includes(lowerSearch));

        const matchesType = typeFilter === 'Todos' || device.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const handleDelete = (id: string) => {
        setDeviceToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async (reason: string) => {
        if (!deviceToDelete) return;
        try {
            await deleteCustomerDevice(deviceToDelete);
            setDevices(prev => prev.filter(d => d.id !== deviceToDelete));
            setSelectedDevice(null);
            setIsDeleteModalOpen(false);
            setDeviceToDelete(null);
            showToast("Eletrônico excluído com sucesso!", 'success');
        } catch (error) {
            console.error("Erro ao excluir:", error);
            showToast("Erro ao excluir o eletrônico.", 'error');
        }
    };

    const handleEdit = (device: CustomerDevice) => {
        setFormData(device);
        setIsAddModalOpen(true);
        setSelectedDevice(null);
    };

    const handleSaveDevice = () => {
        // Implement save logic for add/edit
        setIsAddModalOpen(false);
        setFormData({ type: 'Smartphone', model: '', brand: '', color: '', imei: '', customerName: '' });
        showToast("Eletrônico salvo com sucesso!", 'success');
    };

    const handleSaveNewDevice = async (deviceData: any) => {
        try {
            if (deviceData.id && devices.some(d => d.id === deviceData.id)) {
                // Edit
                await updateCustomerDevice(deviceData.id, deviceData);
                showToast("Eletrônico atualizado com sucesso!", 'success');
            } else {
                // New
                await addCustomerDevice(deviceData);
                showToast("Eletrônico cadastrado com sucesso!", 'success');
            }
            loadData(); // Reload all to be sure
        } catch (error) {
            console.error("Erro ao salvar:", error);
            showToast("Erro ao salvar o eletrônico.", 'error');
        }
    };

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            {/* Header Area */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent shrink-0">
                        <Smartphone size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-primary">Eletrônicos Cadastrados</h1>
                        <p className="text-sm text-secondary font-medium">Gestão e histórico de aparelhos cadastrados</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                    <div className="relative w-full sm:w-64 xl:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por IMEI, SN, EAN, OS, CPF ou Cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-11 pl-10 pr-4 bg-white border border-gray-200 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all text-sm font-medium"
                        />
                    </div>

                    <div className="flex w-full sm:w-auto gap-3">
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as ElectronicType | 'Todos')}
                            className="flex-1 sm:flex-none h-11 px-4 bg-white border border-gray-200 text-gray-600 rounded-xl focus:border-accent outline-none font-medium text-sm transition-all"
                        >
                            {FILTER_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => {
                                setFormData({ type: 'Smartphone', model: '', brand: '', color: '', imei: '', customerName: '' });
                                setIsAddModalOpen(true);
                            }}
                            className="h-11 px-5 bg-accent hover:bg-accent/90 text-white rounded-xl shadow-lg shadow-accent/20 transition-all flex items-center gap-2 font-bold text-sm shrink-0"
                        >
                            <Plus size={18} />
                            <span className="hidden sm:inline">Adicionar Eletrônico</span>
                            <span className="sm:hidden">Adicionar</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredDevices.map(device => {
                    const history = device.history || [];
                    const isEmReparo = history.some(h => (h.status as any) === 'Em Reparo' || (h.status as any) === 'Aberto');
                    const isEntregue = history.some(h => (h.status as any) === 'Concluído') && !isEmReparo && history.length > 0;

                    return (
                        <div
                            key={device.id}
                            onClick={() => setSelectedDevice(device)}
                            className="bg-white p-3.5 rounded-2xl border border-gray-200 hover:border-accent/40 cursor-pointer transition-all hover:shadow-md group flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex justify-between items-start mb-2 gap-2">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-primary text-sm leading-tight group-hover:text-accent transition-colors">
                                            {device.model} {!device.model.toLowerCase().includes(device.color.toLowerCase()) && <span className="text-secondary font-medium">({device.color})</span>}
                                        </h3>
                                        <p className="text-[11px] text-secondary font-medium">{device.type} • {device.brand}</p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleEdit(device); }}
                                            className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-gray-50 rounded"
                                            title="Editar"
                                        >
                                            <Edit size={12} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(device.id); }}
                                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 bg-gray-50 rounded"
                                            title="Excluir"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1 mb-3">
                                    <div className="text-[11px] font-mono text-gray-500 bg-gray-50 p-1 rounded flex items-center gap-1.5 truncate">
                                        <Cpu size={10} className="shrink-0" /> IMEI: {device.imei}
                                    </div>
                                    <div className="text-[11px] text-secondary flex items-center gap-1.5 font-medium">
                                        <User size={10} className="shrink-0" /> {device.customerName}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5 mt-auto">
                                {device.soldInStore && (
                                    <span className="px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                        <ShoppingCart size={10} /> Vendido Loja
                                    </span>
                                )}
                                {device.hasPreviousRepair && (
                                    <span className="px-2 py-1 bg-purple-50 text-purple-600 border border-purple-100 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                        <Wrench size={10} /> Retorno
                                    </span>
                                )}
                                {isEmReparo && (
                                    <span className="px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                        <Clock size={10} /> Em Reparo
                                    </span>
                                )}
                                {isEntregue && (
                                    <span className="px-2 py-1 bg-green-50 text-green-600 border border-green-200 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                        <CheckCircle size={10} /> Entregue
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {
                filteredDevices.length === 0 && (
                    <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 flex flex-col items-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <Search className="text-gray-300" size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-400 mb-1">Nenhum eletrônico encontrado</h3>
                        <p className="text-sm text-gray-400">Verifique os filtros ou tente buscar por outro termo.</p>
                    </div>
                )
            }

            {/* Device Details & History Modal */}
            <Modal
                isOpen={!!selectedDevice}
                onClose={() => setSelectedDevice(null)}
                title="Detalhes do Eletrônico"
                className="!max-w-3xl md:!max-w-4xl"
            >
                {selectedDevice && (
                    <div className="space-y-6">
                        {/* Device Header Card */}
                        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 relative overflow-hidden flex flex-col md:flex-row gap-6 items-start">
                            <div className="w-24 h-24 bg-white border border-gray-200 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                                <Smartphone size={40} className="text-gray-400" />
                            </div>
                            <div className="flex-1">
                                <div className="flex flex-wrap gap-2 mb-2 items-center">
                                    <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs font-bold">{selectedDevice.type}</span>
                                    {selectedDevice.soldInStore && (
                                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                                            <ShoppingCart size={12} /> Vendido pela Loja
                                        </span>
                                    )}
                                    {selectedDevice.hasPreviousRepair && (
                                        <span className="px-2.5 py-1 bg-purple-50 text-purple-600 border border-purple-100 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                                            <Wrench size={12} /> Retorno Assistência
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <h2 className="text-2xl font-black text-primary mb-1 leading-tight">
                                        {selectedDevice.model}
                                        {!selectedDevice.model.toLowerCase().includes(selectedDevice.color.toLowerCase()) && (
                                            <span className="text-secondary font-medium"> ({selectedDevice.color})</span>
                                        )}
                                    </h2>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button onClick={() => handleEdit(selectedDevice)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(selectedDevice.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-secondary font-medium mb-4">
                                    {selectedDevice.brand} • Cliente: <span className="font-bold text-primary">{selectedDevice.customerName}</span>
                                    {customers.find(c => c.name === selectedDevice.customerName)?.phone && (
                                        <span className="ml-3 inline-flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg text-xs border border-emerald-100">
                                            <WhatsAppIcon size={14} /> {customers.find(c => c.name === selectedDevice.customerName)?.phone}
                                        </span>
                                    )}
                                </p>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">IMEI 1</span>
                                        <span className="text-sm font-mono text-primary font-bold truncate" title={selectedDevice.imei}>{selectedDevice.imei || '-'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">IMEI 2</span>
                                        <span className="text-sm font-mono text-primary font-bold truncate" title={selectedDevice.imei2}>{selectedDevice.imei2 || '-'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Número de série</span>
                                        <span className="text-sm font-mono text-primary font-bold truncate" title={selectedDevice.serialNumber}>{selectedDevice.serialNumber || '-'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">EAN</span>
                                        <span className="text-sm font-mono text-primary font-bold truncate" title={selectedDevice.ean}>{selectedDevice.ean || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Service History Timeline */}
                        <div>
                            <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
                                <Clock className="text-accent" size={20} /> Histórico de OS do Aparelho
                            </h3>

                            {(selectedDevice.history || []).length === 0 ? (
                                <p className="text-center text-gray-400 py-4 text-sm">Nenhum histórico de conserto encontrado.</p>
                            ) : (
                                <div className="relative border-l-2 border-gray-100 ml-4 space-y-6 pb-2">
                                    {(selectedDevice.history || []).map((record, index) => (
                                        <div key={record.id} className="relative pl-6">
                                            {/* Status Dot */}
                                            <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-4 border-white ${record.status === 'Concluído' ? 'bg-emerald-500' :
                                                record.status === 'Em Reparo' ? 'bg-blue-500' : 'bg-red-500'
                                                }`}
                                            />

                                            <div className="bg-red-50/70 border border-red-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex flex-wrap justify-between items-start gap-4 mb-3">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-bold text-primary">{record.osId}</span>
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${record.status === 'Concluído' ? 'bg-emerald-100 text-emerald-700' :
                                                                record.status === 'Em Reparo' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                                                                }`}>
                                                                {record.status}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs font-medium text-secondary mt-1 flex-wrap">
                                                            <span className="flex items-center gap-1.5"><Calendar size={12} /> Entrada: {new Date(record.date).toLocaleDateString('pt-BR')}</span>
                                                            {record.exitDate && (
                                                                <span className="flex items-center gap-1.5 text-orange-600"><Clock size={12} /> Entrega: {new Date(record.exitDate).toLocaleDateString('pt-BR')}</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => navigate(`/service-orders/edit/${record.id}`)}
                                                        className="px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                                                    >
                                                        <FileText size={14} /> Abrir OS
                                                    </button>
                                                </div>

                                                <div className="space-y-3">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Problemas Relatados</p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {record.problemsReported.length > 0 ? record.problemsReported.map((problem, i) => (
                                                                <span key={i} className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-xs font-medium">
                                                                    {problem}
                                                                </span>
                                                            )) : <span className="text-gray-400 text-xs italic">Nenhum relatado</span>}
                                                        </div>
                                                    </div>

                                                    {record.attendantObservations && (
                                                        <div>
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Observações do Atendente</p>
                                                            <div className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                                                {record.attendantObservations}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {record.technicalReport && (
                                                        <div>
                                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Laudo Técnico</p>
                                                            <div className="text-xs text-gray-800 bg-yellow-50 p-2.5 rounded-lg border border-yellow-200 shadow-sm">
                                                                {record.technicalReport}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100 text-xs">
                                                        <div>
                                                            <span className="text-gray-400 font-medium">Atendente: </span>
                                                            <span className="font-bold text-primary">{record.attendant}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400 font-medium">Técnico: </span>
                                                            <span className="font-bold text-primary">{record.technician}</span>
                                                        </div>
                                                    </div>

                                                    {record.photos.length > 0 && (
                                                        <div>
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                                                <ImageIcon size={12} /> Fotos ({record.photos.length})
                                                            </p>
                                                            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                                                {record.photos.map((photo, i) => (
                                                                    <div key={i} className="w-16 h-16 rounded-lg bg-gray-200 border border-gray-300 shrink-0 overflow-hidden relative group cursor-pointer">
                                                                        <img src={photo} alt="Evidência" className="w-full h-full object-cover" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Add / Edit Form Modal */}
            <ServiceOrderElectronicDevicesModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                customers={customers}
                brands={brands}
                categories={categories}
                productModels={productModels}
                grades={grades}
                gradeValues={gradeValues}
                onSave={handleSaveNewDevice}
                initialData={formData}
            />

            <DeleteWithReasonModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setDeviceToDelete(null);
                }}
                onConfirm={confirmDelete}
                title="Excluir Eletrônico"
                message="Informe o motivo da exclusão deste aparelho. Esta ação removerá o registro do sistema."
            />
        </div >
    );
};

export default ServiceOrderDevices;
