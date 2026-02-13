
import React, { useState, useEffect, useRef } from 'react';
import {
    User as UserIcon,
    Smartphone,
    Wrench,
    FileText,
    Save,
    ArrowLeft,
    CheckCircle2,
    Search,
    Plus,
    Trash2,
    Grid3x3,
    Unlock,
    Battery,
    Wifi,
    Cpu,
    Camera,
    Speaker,
    Mic,
    Plug,
    Image as ImageIcon,
    X,
    Eye,
    Package
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import {
    getUsers,
    getCustomers,
    addCustomer,
    addServiceOrder,
    formatCurrency
} from '../../services/mockApi';
import { User, Customer, ServiceOrderItem, ServiceOrderChecklist } from '../../types';
import CustomerModal from '../../components/CustomerModal';
import CameraModal from '../../components/CameraModal';
import ItemSelectionModal from '../../components/ItemSelectionModal';
import { getServices, getProducts } from '../../services/mockApi';
import { Service, Product } from '../../types';

// --- Types ---
// (ServiceOrderItem is now imported from types.ts if available, or defined locally matching it)

// --- Icons for Checklist ---
const CONDITION_ICONS = [
    { id: 'scratch', label: 'Arranhado', icon: Grid3x3 },
    { id: 'cracked_screen', label: 'Tela Trincada', icon: Smartphone },
    { id: 'dented', label: 'Amassado', icon: Grid3x3 },
    { id: 'no_power', label: 'Não Liga', icon: Plug },
    { id: 'no_wifi', label: 'Sem Wi-Fi', icon: Wifi },
    { id: 'bad_battery', label: 'Bateria Ruim', icon: Battery },
    { id: 'front_camera_fail', label: 'Câm. Frontal', icon: Camera },
    { id: 'rear_camera_fail', label: 'Câm. Traseira', icon: Camera },
    { id: 'no_sound', label: 'Sem Som', icon: Speaker },
    { id: 'mic_fail', label: 'Mic Ruim', icon: Mic },
    { id: 'others', label: 'Outros', icon: CheckCircle2 },
];

const ServiceOrderForm: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user: currentUser } = useUser();

    // Toast helper to maintain existing syntax
    const toast = {
        success: (msg: string) => showToast(msg, 'success'),
        error: (msg: string) => showToast(msg, 'error'),
        info: (msg: string) => showToast(msg, 'info'),
        warning: (msg: string) => showToast(msg, 'warning'),
    };

    // --- State ---
    const [activeTab, setActiveTab] = useState<'client_device' | 'diagnosis' | 'financial'>('client_device');
    const [isLoading, setIsLoading] = useState(false);

    // Data Sources
    const [users, setUsers] = useState<User[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

    // Catalogs
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    const [availableProducts, setAvailableProducts] = useState<Product[]>([]);

    // Selection Modals
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);

    // Form Data
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerResults, setShowCustomerResults] = useState(false);

    const [responsibleId, setResponsibleId] = useState('');

    const [deviceModel, setDeviceModel] = useState('');
    const [imei, setImei] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [passcode, setPasscode] = useState('');
    const [patternLock, setPatternLock] = useState<number[]>([]);

    const [checklist, setChecklist] = useState<ServiceOrderChecklist>({});
    const [othersDescription, setOthersDescription] = useState('');

    const [defectDescription, setDefectDescription] = useState('');
    const [technicalReport, setTechnicalReport] = useState('');
    const [observations, setObservations] = useState(''); // New Field

    const [photos, setPhotos] = useState<string[]>([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    // Financial
    const [items, setItems] = useState<ServiceOrderItem[]>([]);
    const [discount, setDiscount] = useState(0);

    // --- Effects ---
    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (currentUser && !responsibleId) {
            setResponsibleId(currentUser.id);
        }
    }, [currentUser]);

    const loadData = async () => {
        try {
            const [usersData, customersData, servicesData, productsData] = await Promise.all([
                getUsers(),
                getCustomers(),
                getServices(),
                getProducts()
            ]);
            setUsers(usersData);
            setCustomers(customersData);
            setAvailableServices(servicesData);
            setAvailableProducts(productsData);
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Erro ao carregar dados iniciais.");
        }
    };

    // --- Search Logic ---
    const filteredCustomers = (customers || []).filter(c =>
        (c.name && c.name.toLowerCase().includes(customerSearch.toLowerCase())) ||
        (c.cpf && c.cpf.includes(customerSearch)) ||
        (c.phone && c.phone.includes(customerSearch))
    ).slice(0, 5); // Limit results

    const handleSelectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        setCustomerSearch(customer.name);
        setShowCustomerResults(false);
    };

    // --- Form Logic ---
    const toggleCondition = (key: keyof ServiceOrderChecklist) => {
        setChecklist(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleAddPhoto = (photoData: string) => {
        setPhotos([...photos, photoData]);
        setIsCameraOpen(false);
    };

    const removePhoto = (index: number) => {
        setPhotos(photos.filter((_, i) => i !== index));
    };

    const addItem = () => {
        const newItem: ServiceOrderItem = {
            id: Date.now().toString(),
            description: 'Novo Item / Serviço',
            type: 'service',
            price: 0,
            quantity: 1
        };
        setItems([...items, newItem]);
    };

    const handleAddItemFromCatalog = (item: Service | Product, type: 'service' | 'part') => {
        const newItem: ServiceOrderItem = {
            id: Date.now().toString(),
            description: type === 'service' ? (item as Service).name : (item as Product).model,
            type: type,
            price: item.price,
            quantity: 1
        };
        setItems([...items, newItem]);
        toast.success(`${type === 'service' ? 'Serviço' : 'Peça'} adicionado(a)!`);
    };

    const removeItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    const updateItem = (id: string, field: keyof ServiceOrderItem, value: any) => {
        setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    // --- Calculation ---
    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const total = subtotal - discount;

    // --- Save ---
    const handleSave = async () => {
        if (!selectedCustomer) {
            toast.error("Selecione um cliente.");
            return;
        }
        if (!deviceModel) {
            toast.error("Informe o modelo do aparelho.");
            return;
        }
        if (!responsibleId) {
            toast.error("Selecione o responsável.");
            return;
        }

        setIsLoading(true);
        try {
            const responsible = users.find(u => u.id === responsibleId);

            const serviceOrderData = {
                customerId: selectedCustomer.id,
                customerName: selectedCustomer.name,
                deviceModel,
                imei,
                serialNumber,
                passcode,
                patternLock,
                checklist: {
                    ...checklist,
                    othersDescription: checklist.others ? othersDescription : undefined
                },
                defectDescription,
                technicalReport,
                observations,
                status: 'Aberto' as const,
                items,
                subtotal,
                discount,
                total,
                responsibleId,
                responsibleName: responsible?.name || 'Sistema',
                photos,
                entryDate: new Date().toISOString()
            };

            await addServiceOrder(serviceOrderData);
            toast.success("Ordem de Serviço criada com sucesso!");
            navigate('/service-orders');
        } catch (error) {
            toast.error("Erro ao salvar Ordem de Serviço.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- Pattern Lock Grid ---
    const PatternGrid = () => (
        <div className="grid grid-cols-3 gap-4 w-32 mx-auto select-none">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(dot => (
                <button
                    key={dot}
                    type="button"
                    onClick={() => {
                        if (patternLock.includes(dot)) {
                            setPatternLock(prev => prev.filter(p => p !== dot));
                        } else {
                            setPatternLock(prev => [...prev, dot]);
                        }
                    }}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${patternLock.includes(dot)
                        ? 'bg-accent border-accent scale-110'
                        : 'bg-transparent border-gray-300 hover:border-accent/50'
                        }`}
                />
            ))}
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-8 justify-between">
                <div className="flex items-center gap-4 self-start sm:self-auto">
                    <button onClick={() => navigate('/service-orders')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft size={24} className="text-secondary" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-primary">Nova Ordem de Serviço</h1>
                        <p className="text-secondary text-sm">Preencha os dados do atendimento</p>
                    </div>
                </div>
                <div className="flex gap-3 self-end sm:self-auto">
                    <button
                        onClick={() => navigate('/service-orders')}
                        className="px-6 py-2 rounded-xl text-sm font-bold text-secondary border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-primary shadow-lg shadow-primary/20 hover:scale-105 transition-transform flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={18} />
                        {isLoading ? 'Salvando...' : 'Salvar OS'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Navigation & Progress */}
                <div className="space-y-2 lg:sticky lg:top-8 h-fit">
                    <button
                        onClick={() => setActiveTab('client_device')}
                        className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${activeTab === 'client_device' ? 'bg-white border-accent shadow-md' : 'bg-transparent border-transparent hover:bg-white/50'
                            }`}
                    >
                        <div className={`p-2 rounded-xl ${activeTab === 'client_device' ? 'bg-accent text-white' : 'bg-gray-100 text-gray-400'}`}>
                            <UserIcon size={20} />
                        </div>
                        <div>
                            <h3 className={`font-bold ${activeTab === 'client_device' ? 'text-primary' : 'text-gray-500'}`}>Cliente e Aparelho</h3>
                            <p className="text-xs text-secondary">Dados iniciais e checklist</p>
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveTab('diagnosis')}
                        className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${activeTab === 'diagnosis' ? 'bg-white border-accent shadow-md' : 'bg-transparent border-transparent hover:bg-white/50'
                            }`}
                    >
                        <div className={`p-2 rounded-xl ${activeTab === 'diagnosis' ? 'bg-accent text-white' : 'bg-gray-100 text-gray-400'}`}>
                            <Wrench size={20} />
                        </div>
                        <div>
                            <h3 className={`font-bold ${activeTab === 'diagnosis' ? 'text-primary' : 'text-gray-500'}`}>Diagnóstico</h3>
                            <p className="text-xs text-secondary">Defeito e laudo técnico</p>
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveTab('financial')}
                        className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${activeTab === 'financial' ? 'bg-white border-accent shadow-md' : 'bg-transparent border-transparent hover:bg-white/50'
                            }`}
                    >
                        <div className={`p-2 rounded-xl ${activeTab === 'financial' ? 'bg-accent text-white' : 'bg-gray-100 text-gray-400'}`}>
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className={`font-bold ${activeTab === 'financial' ? 'text-primary' : 'text-gray-500'}`}>Orçamento</h3>
                            <p className="text-xs text-secondary">Peças, serviços e totais</p>
                        </div>
                    </button>

                    {/* Visual Responsible Selector in Sidebar */}
                    <div className="mt-8 p-4 bg-white/50 rounded-2xl border border-gray-100">
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Responsável Técnico</label>
                        <select
                            value={responsibleId}
                            onChange={(e) => setResponsibleId(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-sm font-medium focus:ring-2 focus:ring-accent/20 outline-none"
                        >
                            <option value="">Selecione...</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Right Column - Form Content */}
                <div className="lg:col-span-2 bg-white/70 backdrop-blur-sm border border-white/40 p-6 sm:p-8 rounded-3xl shadow-sm min-h-[600px]">

                    {/* TAB 1: CLIENT & DEVICE */}
                    {activeTab === 'client_device' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Client Search */}
                            <div>
                                <label className="block text-sm font-bold text-primary mb-2">Cliente</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Buscar cliente..."
                                            value={customerSearch}
                                            onChange={e => {
                                                setCustomerSearch(e.target.value);
                                                setShowCustomerResults(true);
                                            }}
                                            onFocus={() => setShowCustomerResults(true)}
                                            className="w-full h-12 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all"
                                        />
                                        {showCustomerResults && customerSearch && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                                                {filteredCustomers.length > 0 ? (
                                                    filteredCustomers.map(c => (
                                                        <button
                                                            key={c.id}
                                                            onClick={() => handleSelectCustomer(c)}
                                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                                                        >
                                                            <div className="font-bold text-primary">{c.name}</div>
                                                            <div className="text-xs text-secondary">{c.phone} - {c.cpf}</div>
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-3 text-sm text-gray-400">Nenhum cliente encontrado.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setIsCustomerModalOpen(true)}
                                        className="h-12 w-12 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-primary rounded-xl transition-colors"
                                        title="Novo Cliente"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-primary mb-2">Modelo do Aparelho</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: iPhone 13 Pro"
                                        value={deviceModel}
                                        onChange={e => setDeviceModel(e.target.value)}
                                        className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-primary mb-2">IMEI / Serial</label>
                                    <input
                                        type="text"
                                        placeholder="IMEI"
                                        value={imei}
                                        onChange={e => setImei(e.target.value)}
                                        className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all font-mono mb-2"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Serial Number (Opcional)"
                                        value={serialNumber}
                                        onChange={e => setSerialNumber(e.target.value)}
                                        className="w-full h-10 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all font-mono text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                                {/* Lock Pattern / Password */}
                                <div>
                                    <label className="block text-sm font-bold text-primary mb-4 flex items-center gap-2">
                                        <Unlock size={16} /> Senha / Padrão
                                    </label>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                placeholder="Senha numérica (PIN)"
                                                value={passcode}
                                                onChange={e => setPasscode(e.target.value)}
                                                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm mb-4 outline-none focus:border-accent"
                                            />
                                            <p className="text-xs text-gray-400">Ou desenhe o padrão ao lado:</p>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                            <PatternGrid />
                                        </div>
                                    </div>
                                </div>

                                {/* Visual Checklist */}
                                <div>
                                    <label className="block text-sm font-bold text-primary mb-4 flex items-center gap-2">
                                        <CheckCircle2 size={16} /> Estado Físico (Checklist)
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {CONDITION_ICONS.map(cond => (
                                            <button
                                                type="button"
                                                key={cond.id}
                                                onClick={() => toggleCondition(cond.id as keyof ServiceOrderChecklist)}
                                                className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${checklist[cond.id as keyof ServiceOrderChecklist]
                                                    ? 'bg-red-50 border-red-200 text-red-600'
                                                    : 'bg-white border-gray-100 text-gray-400 hover:border-gray-300'
                                                    }`}
                                            >
                                                <cond.icon size={16} className="mb-1" />
                                                <span className="text-[10px] font-medium leading-tight text-center">{cond.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                    {checklist.others && (
                                        <input
                                            type="text"
                                            placeholder="Descreva outros problemas..."
                                            value={othersDescription}
                                            onChange={e => setOthersDescription(e.target.value)}
                                            className="mt-2 w-full h-8 px-2 text-xs bg-gray-50 border-b border-gray-300 outline-none focus:border-accent"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Photos Section */}
                            <div className="pt-4 border-t border-gray-100">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="block text-sm font-bold text-primary flex items-center gap-2">
                                        <ImageIcon size={16} /> Fotos do Aparelho
                                    </label>
                                    <button
                                        onClick={() => setIsCameraOpen(true)}
                                        className="text-xs flex items-center gap-1 text-accent font-bold hover:underline"
                                    >
                                        <Camera size={14} /> Adicionar Foto
                                    </button>
                                </div>

                                {photos.length > 0 ? (
                                    <div className="flex gap-4 overflow-x-auto pb-2">
                                        {photos.map((photo, index) => (
                                            <div key={index} className="relative w-24 h-24 flex-shrink-0 group">
                                                <img src={photo} alt={`Foto ${index + 1}`} className="w-full h-full object-cover rounded-lg border border-gray-200" />
                                                <button
                                                    onClick={() => removePhoto(index)}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => setIsCameraOpen(true)}
                                        className="w-full h-24 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors"
                                    >
                                        <Camera size={24} className="mb-2" />
                                        <span className="text-xs">Toque para adicionar fotos</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: DIAGNOSIS */}
                    {activeTab === 'diagnosis' && (
                        <div className="space-y-6 animate-fade-in">
                            <div>
                                <label className="block text-sm font-bold text-primary mb-2">Defeito Relatado pelo Cliente</label>
                                <textarea
                                    rows={4}
                                    placeholder="Descreva o problema relatado..."
                                    value={defectDescription}
                                    onChange={e => setDefectDescription(e.target.value)}
                                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all resize-none"
                                />
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <label className="block text-sm font-bold text-primary mb-2 flex items-center gap-2">
                                    <Wrench size={16} className="text-accent" />
                                    Laudo Técnico
                                </label>
                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                                    <textarea
                                        rows={6}
                                        placeholder="Diagnóstico técnico, testes realizados..."
                                        value={technicalReport}
                                        onChange={e => setTechnicalReport(e.target.value)}
                                        className="w-full p-0 bg-transparent border-none focus:ring-0 outline-none placeholder:text-amber-700/50 text-amber-900"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-gray-100">
                                <label className="block text-sm font-bold text-primary mb-2 flex items-center gap-2">
                                    <Eye size={16} className="text-gray-500" />
                                    Observações Internas (Não sai na impressão)
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Observações internas sobre o atendimento..."
                                    value={observations}
                                    onChange={e => setObservations(e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all resize-none text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {/* TAB 3: FINANCIAL */}
                    {activeTab === 'financial' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg text-primary">Peças e Serviços</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsServiceModalOpen(true)}
                                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 border border-blue-100"
                                    >
                                        <Wrench size={14} /> Adicionar Serviço
                                    </button>
                                    <button
                                        onClick={() => setIsProductModalOpen(true)}
                                        className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 border border-orange-100"
                                    >
                                        <Package size={14} /> Adicionar Peça
                                    </button>
                                    <button
                                        onClick={addItem}
                                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-primary rounded-lg text-xs font-bold transition-colors flex items-center gap-1 border border-gray-200"
                                    >
                                        <Plus size={14} /> Item Avulso
                                    </button>
                                </div>
                            </div>

                            <div className="border border-gray-200 rounded-xl overflow-x-auto mb-6">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200 text-left text-xs font-bold text-secondary uppercase">
                                        <tr>
                                            <th className="px-4 py-3">Descrição</th>
                                            <th className="px-4 py-3 w-24">Tipo</th>
                                            <th className="px-4 py-3 w-20 text-center">Qtd</th>
                                            <th className="px-4 py-3 w-32 text-right">Valor Unit.</th>
                                            <th className="px-4 py-3 w-32 text-right">Total</th>
                                            <th className="px-4 py-3 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {items.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">Nenhum item adicionado</td>
                                            </tr>
                                        ) : (
                                            items.map((item) => (
                                                <tr key={item.id}>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={item.description}
                                                            onChange={e => updateItem(item.id, 'description', e.target.value)}
                                                            className="w-full bg-transparent outline-none focus:underline font-medium"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={item.type}
                                                            onChange={e => updateItem(item.id, 'type', e.target.value)}
                                                            className="bg-transparent outline-none text-xs"
                                                        >
                                                            <option value="service">Serviço</option>
                                                            <option value="part">Peça</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
                                                            className="w-full text-center bg-transparent outline-none" min="1"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <input
                                                            type="number"
                                                            value={item.price}
                                                            onChange={e => updateItem(item.id, 'price', Number(e.target.value))}
                                                            className="w-full text-right bg-transparent outline-none"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium text-primary">
                                                        {formatCurrency(item.price * item.quantity)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => removeItem(item.id)}
                                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals Section */}
                            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-3">
                                <div className="flex justify-between text-sm text-secondary">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm text-secondary">
                                    <span>Desconto</span>
                                    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-gray-200 w-32">
                                        <span className="text-gray-400">R$</span>
                                        <input
                                            type="number"
                                            value={discount}
                                            onChange={e => setDiscount(Number(e.target.value))}
                                            className="w-full outline-none text-right font-medium text-emerald-600"
                                        />
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                                    <span className="font-bold text-lg text-primary">Total Final</span>
                                    <span className="font-black text-2xl text-accent">{formatCurrency(total)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {isCustomerModalOpen && (
                <CustomerModal
                    entity={null}
                    initialType="Cliente"
                    onClose={() => setIsCustomerModalOpen(false)}
                    onSave={async (data) => {
                        try {
                            const newCustomer = await addCustomer({
                                ...data,
                                createdAt: new Date().toISOString()
                            }, currentUser?.id, currentUser?.name);

                            if (newCustomer) {
                                // Update local list
                                setCustomers(prev => [...prev, newCustomer]);
                                // Auto-select
                                handleSelectCustomer(newCustomer);
                                toast.success("Cliente cadastrado e selecionado!");
                            }
                        } catch (error) {
                            console.error("Error creating customer from OS:", error);
                            toast.error("Erro ao criar cliente.");
                        } finally {
                            setIsCustomerModalOpen(false);
                        }
                    }}
                />
            )}

            <CameraModal
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onCapture={handleAddPhoto}
            />

            <ItemSelectionModal
                isOpen={isServiceModalOpen}
                onClose={() => setIsServiceModalOpen(false)}
                title="Selecionar Serviço"
                type="service"
                items={availableServices}
                onSelect={(item) => handleAddItemFromCatalog(item, 'service')}
            />

            <ItemSelectionModal
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                title="Selecionar Peça"
                type="part"
                items={availableProducts}
                onSelect={(item) => handleAddItemFromCatalog(item, 'part')}
            />

        </div>
    );
};

export default ServiceOrderForm;
