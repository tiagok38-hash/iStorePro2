
import React, { useState, useEffect, useRef } from 'react';
import {
    User as UserIcon,
    Wrench,
    FileText,
    Save,
    ArrowLeft,
    CheckCircle2,
    Search,
    Plus,
    Trash2,
    Unlock,
    Camera,
    Image as ImageIcon,
    X,
    Eye,
    Package,
    ChevronRight,
    ChevronLeft,
    Printer,
    Tag,
    Zap
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { openWhatsApp } from '../../utils/whatsappUtils.ts';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import {
    getUsers,
    getCustomers,
    addCustomer,
    addServiceOrder,
    getServiceOrder,
    updateServiceOrder,
    formatCurrency,
    getPermissionProfiles,
    getServices,
    getProducts,
    getCustomerDevices,
    getChecklistItems
} from '../../services/mockApi';
import { WhatsAppIcon } from '../../components/icons';
import { User, Customer, ServiceOrderItem, ServiceOrderChecklist, PermissionProfile, Service, Product, CustomerDevice, ChecklistItemParameter } from '../../types';
import CustomerModal from '../../components/CustomerModal';
import QuickOSModal from '../../components/QuickOSModal';
import CameraModal from '../../components/CameraModal';
import ItemSelectionModal from '../../components/ItemSelectionModal';
import CustomerDeviceModal from '../../components/CustomerDeviceModal';
import ServiceOrderPrintModal from '../../components/print/ServiceOrderPrintModal';



type TabId = 'client_device' | 'diagnosis' | 'financial';
const TAB_ORDER: TabId[] = ['client_device', 'diagnosis', 'financial'];

const ServiceOrderForm: React.FC = () => {
    const navigate = useNavigate();
    const { id: editId } = useParams<{ id: string }>();
    const isEditing = !!editId;
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
    const [activeTab, setActiveTab] = useState<TabId>('client_device');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingEdit, setIsLoadingEdit] = useState(isEditing);
    const [displayId, setDisplayId] = useState<number | null>(null);
    const [isQuickOSOpen, setIsQuickOSOpen] = useState(false);

    // Data Sources
    const [users, setUsers] = useState<User[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

    // Catalogs
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
    const [customerDevices, setCustomerDevices] = useState<CustomerDevice[]>([]);
    const [profiles, setProfiles] = useState<PermissionProfile[]>([]);

    // Selection Modals
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);

    // Form Data
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerResults, setShowCustomerResults] = useState(false);

    const [responsibleId, setResponsibleId] = useState('');
    const [attendantId, setAttendantId] = useState('');

    const [customerDeviceId, setCustomerDeviceId] = useState('');
    const [deviceModel, setDeviceModel] = useState('');
    const [imei, setImei] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [deviceSearch, setDeviceSearch] = useState('');
    const [showDeviceResults, setShowDeviceResults] = useState(false);
    const [passcode, setPasscode] = useState('');
    const [patternLock, setPatternLock] = useState<number[]>([]);

    const [checklist, setChecklist] = useState<ServiceOrderChecklist>({});
    const [othersDescription, setOthersDescription] = useState('');

    const [defectDescription, setDefectDescription] = useState('');
    const [attendantObservations, setAttendantObservations] = useState('');
    const [technicalReport, setTechnicalReport] = useState('');
    const [observations, setObservations] = useState('');

    const [photos, setPhotos] = useState<string[]>([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    // Financial
    const [items, setItems] = useState<ServiceOrderItem[]>([]);
    const [discount, setDiscount] = useState(0);

    // OS Status (para edição)
    const [osStatus, setOsStatus] = useState<string>('Orçamento');
    // Orçamento only toggle (para criação)
    const [isOrcamentoOnly, setIsOrcamentoOnly] = useState(false);
    // Datas
    const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [estimatedDate, setEstimatedDate] = useState('');
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [printFormat, setPrintFormat] = useState<'A4' | 'thermal'>('thermal');

    // Refs para controle de clique fora
    const customerSearchRef = useRef<HTMLDivElement>(null);
    const deviceSearchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
                setShowCustomerResults(false);
            }
            if (deviceSearchRef.current && !deviceSearchRef.current.contains(event.target as Node)) {
                setShowDeviceResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- Effects ---
    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (currentUser && !responsibleId) {
            setResponsibleId(currentUser.id);
        }
        if (currentUser && !attendantId) {
            setAttendantId(currentUser.id);
        }
    }, [currentUser]);

    // Carrega dados da OS ao editar
    useEffect(() => {
        if (isEditing && editId) {
            loadServiceOrderData(editId);
        }
    }, [editId]);

    const [availableChecklistItems, setAvailableChecklistItems] = useState<ChecklistItemParameter[]>([]);

    const loadData = async () => {
        try {
            const [usersData, customersData, servicesData, productsData, devicesData, checklistData, profilesData] = await Promise.all([
                getUsers(),
                getCustomers(),
                getServices(),
                getProducts(),
                getCustomerDevices(),
                getChecklistItems(),
                getPermissionProfiles()
            ]);
            setUsers(usersData);
            setCustomers(customersData);
            setAvailableServices(servicesData);
            setAvailableProducts(productsData);
            setCustomerDevices(devicesData);
            setAvailableChecklistItems(checklistData);
            setProfiles(profilesData);
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Erro ao carregar dados iniciais.");
        }
    };

    const loadServiceOrderData = async (id: string) => {
        setIsLoadingEdit(true);
        try {
            const so = await getServiceOrder(id);
            if (!so) {
                toast.error("Ordem de Serviço não encontrada.");
                navigate('/service-orders/list');
                return;
            }

            // Preencher todos os campos com os dados da OS
            setCustomerDeviceId(so.customerDeviceId || '');
            setDeviceModel(so.deviceModel || '');
            setImei(so.imei || '');
            setSerialNumber(so.serialNumber || '');
            setPasscode(so.passcode || '');
            setPatternLock(so.patternLock || []);
            setChecklist(so.checklist || {});
            setOthersDescription((so.checklist as any)?.othersDescription || '');
            setDefectDescription(so.defectDescription || '');
            setAttendantObservations(so.attendantObservations || '');
            setTechnicalReport(so.technicalReport || '');
            setObservations(so.observations || '');
            setPhotos(so.photos || []);
            setItems(so.items || []);
            setDiscount(so.discount || 0);
            setResponsibleId(so.responsibleId || '');
            setAttendantId((so as any).attendantId || '');
            setOsStatus(so.status || 'Orçamento');
            setIsOrcamentoOnly(!!(so as any).isOrcamentoOnly);
            setDisplayId(so.displayId || null);
            if ((so as any).entryDate) setEntryDate(new Date((so as any).entryDate).toISOString().slice(0, 10));
            if ((so as any).estimatedDate) setEstimatedDate(new Date((so as any).estimatedDate).toISOString().slice(0, 10));

            // Carregar e selecionar cliente
            if (so.customerName) {
                setCustomerSearch(so.customerName);
                // Buscar cliente completo por ID
                if (so.customerId) {
                    const custList = await getCustomers();
                    const cust = custList.find(c => c.id === so.customerId);
                    if (cust) {
                        setSelectedCustomer(cust);
                    } else {
                        // Fallback: criar objeto parcial
                        setSelectedCustomer({
                            id: so.customerId,
                            name: so.customerName,
                        } as Customer);
                    }
                }
            }
        } catch (error) {
            console.error("Error loading service order:", error);
            toast.error("Erro ao carregar dados da OS.");
        } finally {
            setIsLoadingEdit(false);
        }
    };

    // --- Tab navigation ---
    const currentTabIndex = TAB_ORDER.indexOf(activeTab);
    const canGoNext = currentTabIndex < TAB_ORDER.length - 1;
    const canGoPrev = currentTabIndex > 0;

    const goToNextTab = () => {
        if (canGoNext) setActiveTab(TAB_ORDER[currentTabIndex + 1]);
    };

    const goToPrevTab = () => {
        if (canGoPrev) setActiveTab(TAB_ORDER[currentTabIndex - 1]);
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

    const filteredDevices = customerDevices.filter(d => {
        const owner = customers.find(c => c.id === d.customerId);
        const matchCustomer = selectedCustomer ? d.customerId === selectedCustomer.id : true;
        const matchSearch = deviceSearch ? (
            (d.model && d.model.toLowerCase().includes(deviceSearch.toLowerCase())) ||
            (d.imei && d.imei.includes(deviceSearch)) ||
            (d.serialNumber && d.serialNumber.toLowerCase().includes(deviceSearch.toLowerCase())) ||
            (d.brand && d.brand.toLowerCase().includes(deviceSearch.toLowerCase())) ||
            (owner && owner.cpf && owner.cpf.includes(deviceSearch))
        ) : true;
        return matchCustomer && matchSearch;
    }).slice(0, 5);

    const handleSelectDevice = (device: CustomerDevice) => {
        setCustomerDeviceId(device.id);
        setDeviceModel(device.model);
        setImei(device.imei || '');
        setSerialNumber(device.serialNumber || '');
        setDeviceSearch(device.model);
        setShowDeviceResults(false);

        // Se ainda não tiver cliente selecionado, auto-selecionar o dono do aparelho
        if (!selectedCustomer) {
            const owner = customers.find(c => c.id === device.customerId);
            if (owner) handleSelectCustomer(owner);
        }
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
            catalogItemId: item.id, // Adicionado para cálculo de lucro
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
                attendantObservations,
                technicalReport,
                observations,
                status: (isEditing ? osStatus : 'Orçamento') as any,
                isOrcamentoOnly,
                items,
                subtotal,
                discount,
                total,
                responsibleId,
                responsibleName: responsible?.name || 'Sistema',
                attendantId,
                attendantName: users.find(u => u.id === attendantId)?.name || currentUser?.name || 'Sistema',
                photos,
                entryDate: entryDate ? new Date(entryDate + 'T12:00:00').toISOString() : new Date().toISOString(),
                estimatedDate: estimatedDate ? new Date(estimatedDate + 'T12:00:00').toISOString() : undefined,
                customerDeviceId
            };

            if (isEditing && editId) {
                await updateServiceOrder(editId, serviceOrderData);
                toast.success("Ordem de Serviço atualizada com sucesso!");
            } else {
                await addServiceOrder(serviceOrderData);
                toast.success("Ordem de Serviço criada com sucesso!");
            }
            navigate('/service-orders/list');
        } catch (error) {
            toast.error("Erro ao salvar Ordem de Serviço.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- Pattern Lock Grid ---
    const PatternGrid = () => (
        <div className="grid grid-cols-3 gap-4 w-40 mx-auto select-none">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(dot => {
                const indexInPattern = patternLock.indexOf(dot);
                const isSelected = indexInPattern !== -1;
                return (
                    <button
                        key={dot}
                        type="button"
                        onClick={() => {
                            if (isSelected) {
                                setPatternLock(prev => prev.filter(p => p !== dot));
                            } else {
                                setPatternLock(prev => [...prev, dot]);
                            }
                        }}
                        className={`w-10 h-10 rounded-full border-[3px] transition-all flex items-center justify-center font-bold text-sm ${isSelected
                            ? 'bg-accent border-accent text-white scale-110 shadow-md'
                            : 'bg-white border-gray-300 hover:border-accent/50 text-transparent shadow-inner'
                            }`}
                    >
                        {isSelected ? indexInPattern + 1 : ''}
                    </button>
                )
            })}
        </div>
    );

    if (isLoadingEdit) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-secondary text-sm">Carregando OS...</p>
                </div>
            </div>
        );
    }

    const TAB_LABELS: Record<TabId, string> = {
        client_device: 'Próximo: Diagnóstico',
        diagnosis: 'Próximo: Orçamento',
        financial: 'Salvar OS',
    };

    return (
        <div className="max-w-[1400px] w-full px-4 md:px-8 mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start gap-4 mb-8 justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/service-orders/list')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft size={24} className="text-secondary" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black text-primary">
                                {isEditing
                                    ? <span>OS-<span className="text-accent">{displayId ?? '...'}</span></span>
                                    : 'Nova Ordem de Serviço'
                                }
                            </h1>
                        </div>
                        <p className="text-secondary text-sm">
                            {isEditing ? 'Editar dados do atendimento' : 'Preencha os dados do atendimento'}
                        </p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 self-start sm:self-auto">
                    {/* Print / Share actions - only visible when editing */}
                    {isEditing && (
                        <>
                            <button
                                onClick={() => {
                                    setPrintFormat('A4');
                                    setIsPrintModalOpen(true);
                                }}
                                title="Imprimir A4"
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-all shadow-sm"
                            >
                                <Printer size={15} />
                                A4
                            </button>
                            <button
                                onClick={() => {
                                    setPrintFormat('thermal');
                                    setIsPrintModalOpen(true);
                                }}
                                title="Imprimir 80mm"
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-all shadow-sm"
                            >
                                <Printer size={15} />
                                80mm
                            </button>
                            <button
                                onClick={() => window.print()}
                                title="Imprimir Etiqueta"
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-all shadow-sm"
                            >
                                <Tag size={15} />
                                Etiqueta
                            </button>
                            <button
                                onClick={() => {
                                    const trackingUrl = `${window.location.origin}/#/os/track/${editId}`;
                                    const msg = `Olá, sua Ordem de Serviço *OS-${displayId}* foi registrada!\n\nAparelho: ${deviceModel}\nStatus: ${osStatus}\n\nAcompanhe o status em tempo real aqui: ${trackingUrl}\n\nAguarde, entraremos em contato em breve.`;

                                    openWhatsApp(selectedCustomer?.phone, msg);
                                }}
                                title="Enviar WhatsApp"
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#25D366] hover:bg-[#128C7E] transition-all shadow-sm shadow-green-500/20"
                            >
                                <WhatsAppIcon size={16} className="text-white fill-white" />
                                WhatsApp
                            </button>
                        </>
                    )}

                    <div className="flex flex-wrap gap-2 self-start sm:self-auto">
                        {!isEditing && (
                            <button
                                onClick={() => setIsQuickOSOpen(true)}
                                className="bg-amber-500 hover:bg-amber-600 text-white h-11 px-6 rounded-2xl text-sm font-black shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
                            >
                                <Zap size={16} className="fill-white" />
                                OS Rápida
                            </button>
                        )}

                        <button
                            onClick={() => navigate('/service-orders/list')}
                            className="bg-red-100 hover:bg-red-200 text-red-500 h-11 px-6 rounded-2xl text-sm font-black active:scale-95 transition-all flex items-center justify-center"
                        >
                            Cancelar
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="bg-gray-800 hover:bg-gray-900 text-white h-11 px-8 rounded-2xl text-sm font-black shadow-xl shadow-gray-200 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            <Save size={18} />
                            {isLoading ? 'Salvando...' : 'Salvar OS'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Left Column - Navigation & Progress */}
                <div className="space-y-4 lg:sticky lg:top-8 h-fit">
                    <button
                        onClick={() => setActiveTab('client_device')}
                        className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${activeTab === 'client_device' ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-transparent border-transparent hover:bg-white/50'
                            }`}
                    >
                        <div className={`p-2 rounded-xl ${activeTab === 'client_device' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                            <UserIcon size={20} />
                        </div>
                        <div>
                            <h3 className={`font-bold ${activeTab === 'client_device' ? 'text-white' : 'text-gray-500'}`}>Cliente e Aparelho</h3>
                            <p className={`text-xs ${activeTab === 'client_device' ? 'text-white/80' : 'text-secondary'}`}>Dados iniciais e checklist</p>
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveTab('diagnosis')}
                        className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${activeTab === 'diagnosis' ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-transparent border-transparent hover:bg-white/50'
                            }`}
                    >
                        <div className={`p-2 rounded-xl ${activeTab === 'diagnosis' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                            <Wrench size={20} />
                        </div>
                        <div>
                            <h3 className={`font-bold ${activeTab === 'diagnosis' ? 'text-white' : 'text-gray-500'}`}>Diagnóstico</h3>
                            <p className={`text-xs ${activeTab === 'diagnosis' ? 'text-white/80' : 'text-secondary'}`}>Defeito e laudo técnico</p>
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveTab('financial')}
                        className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${activeTab === 'financial' ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-transparent border-transparent hover:bg-white/50'
                            }`}
                    >
                        <div className={`p-2 rounded-xl ${activeTab === 'financial' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className={`font-bold ${activeTab === 'financial' ? 'text-white' : 'text-gray-500'}`}>Orçamento</h3>
                            <p className={`text-xs ${activeTab === 'financial' ? 'text-white/80' : 'text-secondary'}`}>Peças, serviços e totais</p>
                        </div>
                    </button>

                    {/* Attendant + Responsible Selectors in Sidebar */}
                    <div className="mt-8 p-4 bg-white/50 rounded-2xl border border-gray-100 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Atendente (Entrada)</label>
                            <select
                                value={attendantId}
                                onChange={(e) => setAttendantId(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-sm font-medium focus:ring-2 focus:ring-accent/20 outline-none"
                            >
                                <option value="">Selecione...</option>
                                {users.filter(u => u.active !== false).map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Responsável Técnico</label>
                            <select
                                value={responsibleId}
                                onChange={(e) => setResponsibleId(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-sm font-medium focus:ring-2 focus:ring-accent/20 outline-none"
                            >
                                <option value="">Selecione...</option>
                                {users
                                    .filter(u => {
                                        const profile = profiles.find(p => p.id === u.permissionProfileId);
                                        const profileName = profile?.name?.toLowerCase() || '';
                                        return u.active !== false && (profileName.includes('técnico') || profileName.includes('tecnico'));
                                    })
                                    .map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))
                                }
                            </select>
                        </div>
                    </div>

                    {/* Status selector em modo edição */}
                    {isEditing && (
                        <div className="p-4 bg-white/50 rounded-2xl border border-gray-100">
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Status da OS</label>
                            <select
                                value={osStatus}
                                onChange={async (e) => {
                                    const newStatus = e.target.value;
                                    setOsStatus(newStatus);
                                    // Instant sync if editing
                                    if (isEditing && editId) {
                                        try {
                                            await updateServiceOrder(editId, { status: newStatus } as any);
                                            toast.success(`Status atualizado para ${newStatus}`);
                                        } catch (err) {
                                            toast.error("Erro ao sincronizar status.");
                                        }
                                    }
                                }}
                                className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-sm font-medium focus:ring-2 focus:ring-accent/20 outline-none"
                            >
                                {['Orçamento', 'Análise', 'Aprovado', 'Em Reparo', 'Aguardando Peça', 'Pronto', 'Entregue'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>

                            <div className="mt-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const trackingUrl = `${window.location.origin}/#/os/track/${editId}`;
                                        const msg = `Olá, o status da sua Ordem de Serviço *OS-${displayId}* foi atualizado!\n\nStatus Atual: *${osStatus}*\nAparelho: ${deviceModel}\n\nAcompanhe seu reparo em tempo real aqui: ${trackingUrl}`;

                                        openWhatsApp(selectedCustomer?.phone, msg);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-2 w-full rounded-xl text-xs font-bold text-white bg-[#25D366] hover:bg-[#128C7E] transition-all shadow-md shadow-green-500/20"
                                >
                                    <WhatsAppIcon size={14} className="fill-white" />
                                    Notificar Status via WhatsApp
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column - Form Content */}
                <div className="lg:col-span-3 bg-white border border-gray-200 p-6 sm:p-8 rounded-3xl shadow-sm min-h-[600px] flex flex-col">

                    {/* TAB 1: CLIENT & DEVICE */}
                    {activeTab === 'client_device' && (
                        <div className="space-y-6 animate-fade-in flex-1">
                            {/* Client Search + Date Filters + Orcamento Toggle all in one row */}
                            <div>
                                <label className="block text-sm font-bold text-primary mb-2">Cliente</label>
                                <div className="flex flex-wrap gap-2 items-end">
                                    {/* Client search */}
                                    <div ref={customerSearchRef} className="relative flex-1 min-w-[200px]">
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

                                    {/* Add client button */}
                                    <button
                                        onClick={() => setIsCustomerModalOpen(true)}
                                        className="h-12 w-12 flex items-center justify-center bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-xl transition-colors flex-shrink-0"
                                        title="Novo Cliente"
                                    >
                                        <Plus size={20} />
                                    </button>

                                    {/* Data Entrada - fully clickable */}
                                    <div className="flex flex-col min-w-[130px]">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Data Entrada</label>
                                        <label className="relative cursor-pointer">
                                            <input
                                                type="date"
                                                value={entryDate}
                                                onChange={e => setEntryDate(e.target.value)}
                                                className="w-full h-12 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all cursor-pointer"
                                            />
                                        </label>
                                    </div>

                                    {/* Data Prevista - fully clickable */}
                                    <div className="flex flex-col min-w-[130px]">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Data Prevista</label>
                                        <label className="relative cursor-pointer">
                                            <input
                                                type="date"
                                                value={estimatedDate}
                                                onChange={e => setEstimatedDate(e.target.value)}
                                                className="w-full h-12 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all cursor-pointer"
                                            />
                                        </label>
                                    </div>

                                    {/* Toggle Orçamento */}
                                    <div className={`h-12 flex items-center gap-2 px-3 rounded-xl border transition-all flex-shrink-0 ${isOrcamentoOnly
                                        ? 'bg-amber-50 border-amber-300'
                                        : 'bg-gray-50 border-gray-200'
                                        }`}>
                                        <button
                                            type="button"
                                            onClick={() => setIsOrcamentoOnly(!isOrcamentoOnly)}
                                            className={`relative w-10 h-5 rounded-full transition-all duration-300 flex-shrink-0 ${isOrcamentoOnly ? 'bg-amber-500 shadow-sm' : 'bg-gray-300'
                                                }`}
                                        >
                                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${isOrcamentoOnly ? 'left-[22px]' : 'left-0.5'
                                                }`} />
                                        </button>
                                        <span className={`text-xs font-bold whitespace-nowrap ${isOrcamentoOnly ? 'text-amber-600' : 'text-gray-400'
                                            }`}>Orçamento</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                                    <div className="flex justify-between items-center mb-4">
                                        <label className="block text-sm font-bold text-primary">Aparelho do Cliente (Busca por IMEI/Serial)</label>
                                        <button
                                            onClick={() => setIsDeviceModalOpen(true)}
                                            className="h-8 px-3 flex items-center gap-1 bg-accent text-white rounded-lg text-xs font-bold transition-colors hover:bg-accent/90"
                                            title="Novo Aparelho"
                                        >
                                            <Plus size={14} /> Novo Aparelho
                                        </button>
                                    </div>
                                    <div ref={deviceSearchRef} className="relative mb-4">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Buscar aparelhos do cliente ou bipar IMEI..."
                                            value={deviceSearch}
                                            onChange={e => {
                                                setDeviceSearch(e.target.value);
                                                setShowDeviceResults(true);
                                            }}
                                            onFocus={() => setShowDeviceResults(true)}
                                            className="w-full h-12 pl-10 pr-4 bg-white border border-gray-200 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all"
                                        />
                                        {showDeviceResults && deviceSearch && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                                                {filteredDevices.length > 0 ? (
                                                    filteredDevices.map(d => (
                                                        <button
                                                            key={d.id}
                                                            onClick={() => handleSelectDevice(d)}
                                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                                                        >
                                                            <div className="font-bold text-primary">{d.brand} {d.model}</div>
                                                            <div className="text-xs text-secondary font-mono">
                                                                {d.imei && `IMEI: ${d.imei} `}
                                                                {d.serialNumber && `SN: ${d.serialNumber}`}
                                                            </div>
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-3 text-sm text-gray-400">Nenhum aparelho encontrado. Cadastre um novo.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Modelo</label>
                                            <input
                                                type="text"
                                                placeholder="Ex: iPhone 13 Pro"
                                                value={deviceModel}
                                                onChange={e => setDeviceModel(e.target.value)}
                                                className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg outline-none text-sm focus:border-accent"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">IMEI</label>
                                                <input
                                                    type="text"
                                                    placeholder="IMEI"
                                                    value={imei}
                                                    onChange={e => setImei(e.target.value)}
                                                    className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg outline-none text-sm font-mono focus:border-accent"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Serial Number</label>
                                                <input
                                                    type="text"
                                                    placeholder="Opcional"
                                                    value={serialNumber}
                                                    onChange={e => setSerialNumber(e.target.value)}
                                                    className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg outline-none text-sm font-mono focus:border-accent"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 pt-4 border-t border-gray-100">
                                {/* Lock Pattern / Password */}
                                <div className="sm:col-span-4 lg:col-span-3">
                                    <label className="block text-sm font-bold text-primary mb-4 flex items-center gap-2">
                                        <Unlock size={16} /> Senha / Padrão
                                    </label>
                                    <div className="flex flex-col gap-4">
                                        <div className="w-full">
                                            <input
                                                type="text"
                                                placeholder="Senha numérica (PIN) ou Alfanumérica"
                                                value={passcode}
                                                onChange={e => setPasscode(e.target.value)}
                                                className="w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm mb-4 outline-none focus:border-accent shadow-sm"
                                            />
                                            <p className="text-[11px] font-bold text-gray-500 mb-2">Ou desenhe o padrão abaixo (a numeração indica a ordem exata da sequência):</p>
                                        </div>
                                        <div className="flex flex-col items-start w-full">
                                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 shadow-inner inline-block">
                                                <PatternGrid />
                                            </div>
                                            {patternLock.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPatternLock([])}
                                                    className="mt-3 text-xs text-red-500 hover:text-red-700 hover:underline font-bold"
                                                >
                                                    Limpar Padrão
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Visual Checklist */}
                                <div className="sm:col-span-8 lg:col-span-9">
                                    <label className="block text-sm font-bold text-primary mb-4 flex items-center gap-2">
                                        <CheckCircle2 size={16} /> Estado Físico (Checklist)
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {availableChecklistItems.map(item => (
                                            <button
                                                type="button"
                                                key={item.id}
                                                onClick={() => toggleCondition(item.id as keyof ServiceOrderChecklist)}
                                                className={`flex items-center gap-2 p-3 rounded-2xl border-2 transition-all ${checklist[item.id as keyof ServiceOrderChecklist]
                                                    ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-sm'
                                                    : 'bg-white border-gray-100 text-gray-500 hover:border-purple-200 hover:bg-purple-50/30'
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${checklist[item.id as keyof ServiceOrderChecklist] ? 'bg-purple-500 text-white shadow-sm' : 'bg-gray-100 border border-gray-300 text-transparent'}`}>
                                                    <CheckCircle2 size={12} strokeWidth={4} />
                                                </div>
                                                <span className="text-xs font-bold leading-tight text-left flex-1">{item.name}</span>
                                            </button>
                                        ))}

                                        {/* "Outros" Button */}
                                        <button
                                            type="button"
                                            onClick={() => toggleCondition('others')}
                                            className={`flex items-center gap-2 p-3 rounded-2xl border-2 transition-all ${checklist.others
                                                ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-sm'
                                                : 'bg-white border-gray-100 text-gray-500 hover:border-purple-200 hover:bg-purple-50/30'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${checklist.others ? 'bg-purple-500 text-white shadow-sm' : 'bg-gray-100 border border-gray-300 text-transparent'}`}>
                                                <CheckCircle2 size={12} strokeWidth={4} />
                                            </div>
                                            <span className="text-xs font-bold leading-tight text-left flex-1">Outros</span>
                                        </button>
                                    </div>
                                    {checklist.others && (
                                        <input
                                            type="text"
                                            placeholder="Descreva outros problemas ou itens..."
                                            value={othersDescription}
                                            onChange={e => setOthersDescription(e.target.value)}
                                            className="mt-3 w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-500 shadow-sm"
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
                        <div className="space-y-6 animate-fade-in flex-1">
                            <div>
                                <label className="block text-sm font-bold text-primary mb-2">Defeito Relatado pelo Cliente</label>
                                <textarea
                                    rows={4}
                                    placeholder="Descreva o problema relatado..."
                                    value={defectDescription}
                                    onChange={e => setDefectDescription(e.target.value)}
                                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all resize-none mb-4"
                                />

                                <label className="block text-sm font-bold text-primary mb-2">Observações Feitas Pelo Atendente</label>
                                <textarea
                                    rows={4}
                                    placeholder="Observações do atendente no recebimento..."
                                    value={attendantObservations}
                                    onChange={e => setAttendantObservations(e.target.value)}
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
                        <div className="space-y-6 animate-fade-in flex-1">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg text-primary">Peças e Serviços</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsServiceModalOpen(true)}
                                        className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 border border-blue-100"
                                    >
                                        <Wrench size={16} /> Adicionar Serviço
                                    </button>
                                    <button
                                        onClick={() => setIsProductModalOpen(true)}
                                        className="px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 border border-orange-100"
                                    >
                                        <Package size={16} /> Adicionar Peça
                                    </button>
                                    <button
                                        onClick={addItem}
                                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-primary rounded-xl text-sm font-bold transition-colors flex items-center gap-2 border border-gray-200"
                                    >
                                        <Plus size={16} /> Item Avulso
                                    </button>
                                </div>
                            </div>

                            <div className="border border-gray-200 rounded-xl overflow-x-auto mb-6">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200 text-left text-xs font-bold text-secondary uppercase">
                                        <tr>
                                            <th className="px-4 py-4">Descrição</th>
                                            <th className="px-4 py-4 w-48">Tipo</th>
                                            <th className="px-4 py-4 w-28 text-center">Qtd</th>
                                            <th className="px-4 py-4 w-32 text-right">Valor Unit.</th>
                                            <th className="px-4 py-4 w-32 text-right">Total</th>
                                            <th className="px-4 py-4 w-10"></th>
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
                                                            className="w-full h-11 px-3 bg-white border border-gray-200 rounded-lg outline-none focus:border-accent font-medium text-sm transition-all"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={item.type}
                                                            onChange={e => updateItem(item.id, 'type', e.target.value)}
                                                            className="w-full h-11 px-3 bg-white border border-gray-200 rounded-lg outline-none text-sm focus:border-accent transition-all"
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
                                                            className="w-full h-11 px-2 text-center bg-white border border-gray-200 rounded-lg outline-none focus:border-accent transition-all" min="1"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg h-11 px-3 focus-within:border-accent transition-all">
                                                            <span className="text-gray-300 text-sm font-medium flex-shrink-0">R$</span>
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                value={item.price === 0 ? '' : item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                placeholder="0,00"
                                                                onChange={e => {
                                                                    const raw = e.target.value.replace(/\D/g, '');
                                                                    const numeric = Number(raw) / 100;
                                                                    updateItem(item.id, 'price', isNaN(numeric) ? 0 : numeric);
                                                                }}
                                                                className="w-full text-right bg-transparent outline-none font-medium text-primary text-sm"
                                                            />
                                                        </div>
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
                                            className="w-full text-right font-medium text-emerald-600 bg-transparent border-0 outline-none ring-0 focus:ring-0"
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

                    {/* ---- NAVIGATION FOOTER ---- */}
                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-100">
                        {/* Botão Voltar */}
                        {canGoPrev ? (
                            <button
                                onClick={goToPrevTab}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-secondary border border-gray-200 hover:bg-gray-50 transition-colors"
                            >
                                <ChevronLeft size={16} />
                                Voltar
                            </button>
                        ) : (
                            <div />
                        )}

                        {/* Botão Avançar ou Salvar */}
                        {canGoNext ? (
                            <button
                                onClick={goToNextTab}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-accent shadow-lg shadow-accent/20 hover:scale-105 transition-transform"
                            >
                                {TAB_LABELS[activeTab]}
                                <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button
                                onClick={handleSave}
                                disabled={isLoading}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-primary shadow-lg shadow-primary/20 hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save size={16} />
                                {isLoading ? 'Salvando...' : 'Salvar OS'}
                            </button>
                        )}
                    </div>

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

            {isDeviceModalOpen && (
                <CustomerDeviceModal
                    isOpen={isDeviceModalOpen}
                    onClose={() => setIsDeviceModalOpen(false)}
                    customer={selectedCustomer}
                    onSuccess={(device) => {
                        setCustomerDevices([...customerDevices, device]);
                        handleSelectDevice(device);
                    }}
                />
            )}

            {isQuickOSOpen && (
                <QuickOSModal
                    onClose={() => setIsQuickOSOpen(false)}
                    onSaved={() => {
                        setIsQuickOSOpen(false);
                        navigate('/service-orders/list');
                    }}
                />
            )}

            {isPrintModalOpen && (
                <ServiceOrderPrintModal
                    serviceOrder={{
                        id: editId || '',
                        displayId: displayId || 0,
                        customerId: selectedCustomer?.id || '',
                        customerName: selectedCustomer?.name || 'Cliente Avulso',
                        customerDeviceId,
                        deviceModel,
                        imei,
                        serialNumber,
                        passcode,
                        patternLock,
                        checklist: { ...checklist, othersDescription },
                        defectDescription,
                        attendantObservations,
                        technicalReport,
                        observations,
                        photos,
                        items,
                        discount,
                        subtotal: items.reduce((acc, item) => acc + (item.price * item.quantity), 0),
                        total: items.reduce((acc, item) => acc + (item.price * item.quantity), 0) - discount,
                        status: osStatus,
                        entryDate,
                        estimatedDate,
                        responsibleId,
                        responsibleName: users.find(u => u.id === responsibleId)?.name || 'Técnico',
                        attendantId,
                        attendantName: users.find(u => u.id === attendantId)?.name || currentUser?.name || 'Sistema',
                        createdAt: entryDate, // Use entryDate as fallback
                        updatedAt: new Date().toISOString()
                    } as any}
                    initialFormat={printFormat}
                    onClose={() => setIsPrintModalOpen(false)}
                />
            )}
        </div>
    );
};

export default ServiceOrderForm;
