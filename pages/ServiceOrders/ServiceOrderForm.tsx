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
    Lock,
    Camera,
    Image as ImageIcon,
    X,
    Eye,
    Package,
    ChevronLeft,
    Printer,
    Tag,
    Zap,
    DollarSign,
    PencilLine,
    ShieldCheck,
    Smartphone
} from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { openWhatsApp } from '../../utils/whatsappUtils.ts';
import { calculateWarrantyExpiry, formatDateBR, toDateTimeLocalValue, getTodayDateString } from '../../utils/dateUtils.ts';
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
    getOsParts,
    getOsWarranties,
    getWarranties,
    OsPart,
    getCustomerDevices,
    addCustomerDevice,
    updateCustomerDevice,
    getBrands,
    getCategories,
    getProductModels,
    getGrades,
    getGradeValues,
    getChecklistItems,
    getCompanyInfo,
    deductOsPartsStock,
    returnOsPartsStock
} from '../../services/mockApi';
import { getOsReceiptTerms, getOsTypes } from '../../services/parametersService';
import { generateCommissionsForOS } from '../../services/commissionService.ts';
import { formatStorageUnit, deduplicateWarranties, cleanUUIDs, cleanDeviceDescription } from '../../utils/formatters.ts';
import { compressImage } from '../../utils/imageUtils.ts';
import { WhatsAppIcon } from '../../components/icons';
import { User, Customer, ServiceOrderItem, ServiceOrderChecklist, PermissionProfile, Service, CustomerDevice, ChecklistItemParameter, CompanyInfo, Brand, Category, ProductModel, Grade, GradeValue, ReceiptTermParameter } from '../../types';
import CustomerModal from '../../components/CustomerModal';
import QuickOSModal from '../../components/QuickOSModal';
import PatternGrid from '../../components/PatternGrid';
import CameraModal from '../../components/CameraModal';
import ItemSelectionModal from '../../components/ItemSelectionModal';
import { ServiceOrderElectronicDevicesModal } from '../../components/ServiceOrderElectronicDevicesModal';
import ServiceOrderPrintModal from '../../components/print/ServiceOrderPrintModal';
import OSBillingModal from '../../components/OSBillingModal';
import DeleteWithReasonModal from '../../components/DeleteWithReasonModal';

const ServiceOrderForm: React.FC = () => {
    const navigate = useNavigate();
    const { id: editId } = useParams<{ id: string }>();
    const isEditing = !!editId;
    const { showToast } = useToast();
    const { user: currentUser, permissions } = useUser();

    // Toast helper to maintain existing syntax
    const toast = {
        success: (msg: string) => showToast(msg, 'success'),
        error: (msg: string) => showToast(msg, 'error'),
        info: (msg: string) => showToast(msg, 'info'),
        warning: (msg: string) => showToast(msg, 'warning'),
    };

    // --- State ---

    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingEdit, setIsLoadingEdit] = useState(isEditing);
    const [displayId, setDisplayId] = useState<number | null>(null);
    const [isQuickOSOpen, setIsQuickOSOpen] = useState(false);
    // Bloqueio de edição para OS Entregues e Faturadas
    const [isLocked, setIsLocked] = useState(false);
    // Marcação de edição
    const [isEdited, setIsEdited] = useState(false);

    // Data Sources
    const [users, setUsers] = useState<User[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

    // Catalogs
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    const [availableOsParts, setAvailableOsParts] = useState<OsPart[]>([]);
    const [customerDevices, setCustomerDevices] = useState<CustomerDevice[]>([]);
    const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
    const [osWarranties, setOsWarranties] = useState<any[]>([]);
    const [receiptTerms, setReceiptTerms] = useState<ReceiptTermParameter[]>([]);
    const [receiptTermId, setReceiptTermId] = useState('');

    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [productModels, setProductModels] = useState<ProductModel[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [gradeValues, setGradeValues] = useState<GradeValue[]>([]);

    // Selection Modals
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);

    // Form Data
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [osPhone, setOsPhone] = useState<string>(''); // telefone salvo diretamente na OS
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerResults, setShowCustomerResults] = useState(false);

    const [responsibleId, setResponsibleId] = useState('');
    const [responsibleName, setResponsibleName] = useState('');
    const [attendantId, setAttendantId] = useState('');
    const [attendantName, setAttendantName] = useState('');

    const [customerDeviceId, setCustomerDeviceId] = useState('');
    const [deviceModel, setDeviceModel] = useState('');
    const [imei, setImei] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [deviceSearch, setDeviceSearch] = useState('');
    const [showDeviceResults, setShowDeviceResults] = useState(false);
    const [passcode, setPasscode] = useState('');
    const [patternLock, setPatternLock] = useState<number[]>([]);
    const [deviceToEdit, setDeviceToEdit] = useState<CustomerDevice | null>(null);

    const [osTypes, setOsTypes] = useState<{id: string, name: string}[]>([]);
    const [selectedOsType, setSelectedOsType] = useState<string>('');

    const [checklist, setChecklist] = useState<ServiceOrderChecklist>({});
    const [othersDescription, setOthersDescription] = useState('');

    const [defectDescription, setDefectDescription] = useState('');
    const [attendantObservations, setAttendantObservations] = useState('');
    const [technicalReport, setTechnicalReport] = useState('');
    const [observations, setObservations] = useState('');

    const [photos, setPhotos] = useState<string[]>([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

    // Financial
    const [items, setItems] = useState<ServiceOrderItem[]>([]);
    const [discount, setDiscount] = useState(0);

    // OS Status (para edição)
    const [osStatus, setOsStatus] = useState<string>('Orçamento');
    // Datas
    const [entryDate, setEntryDate] = useState(() => new Date().toISOString());
    const [estimatedDate, setEstimatedDate] = useState(() => getTodayDateString());
    const [exitDate, setExitDate] = useState<string | null>(null);
    const [justBilled, setJustBilled] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [showPrintMenu, setShowPrintMenu] = useState(false);
    const [printFormat, setPrintFormat] = useState<'A4' | 'thermal'>('thermal');
    const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancellationReason, setCancellationReason] = useState<string | null>(null);
    const [originalStatus, setOriginalStatus] = useState<string | null>(null);
    const location = useLocation();
    const [isWarranty, setIsWarranty] = useState(false);
    const [parentOsId, setParentOsId] = useState<string | null>(null);

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
    }, [editId]);

    useEffect(() => {
        if (!isEditing && currentUser && permissions) {
            const defTech = localStorage.getItem('os_default_technician_id');
            const defWar = localStorage.getItem('os_default_warranty_term');

            const validDefaultTech = permissions.isTechnicianProfile ? currentUser.id : '';

            setResponsibleId(prev => (prev && prev !== '') ? prev : (defTech || validDefaultTech));
            setAttendantId(prev => (prev && prev !== '') ? prev : currentUser.id);
            if (defWar) setReceiptTermId(prev => (prev && prev !== '') ? prev : defWar);
        }
    }, [currentUser, permissions, isEditing]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const warrantyFromId = params.get('warranty_from');
        if (warrantyFromId && !isEditing && (customers.length > 0)) {
            handleWarrantyReentry(warrantyFromId);
        }
    }, [location.search, isEditing, customers]);

    const handleWarrantyReentry = async (originalId: string) => {
        try {
            const originalOs = await getServiceOrder(originalId);
            if (originalOs) {
                const customer = customers.find(c => c.id === originalOs.customerId);
                if (customer) setSelectedCustomer(customer);
                
                setOsPhone(originalOs.phone || '');
                setDeviceModel(originalOs.deviceModel || '');
                setImei(originalOs.imei || '');
                setSerialNumber(originalOs.serialNumber || '');
                setCustomerDeviceId(originalOs.customerDeviceId || '');
                setPasscode(originalOs.passcode || '');
                setPatternLock(originalOs.patternLock || []);
                
                setIsWarranty(true);
                setParentOsId(originalId);
                setDefectDescription(`[GARANTIA] - Retorno da OS #${originalOs.displayId}. Defeito: `);
                
                // Items with 0 price but keep cost and remaining warranty
                const newItems = (originalOs.items || []).map((item: any) => {
                    let remainingWarranty = item.warranty || '';
                    if (originalOs.exitDate && item.warranty) {
                        const expiry = calculateWarrantyExpiry(originalOs.exitDate, item.warranty);
                        if (expiry) {
                            const now = new Date();
                            const diffTime = expiry.getTime() - now.getTime();
                            const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            remainingWarranty = days > 0 ? `${days} dias` : 'Consumida/Expirada';
                        }
                    }
                    
                    return {
                        ...item,
                        unitPrice: 0,
                        totalPrice: 0,
                        warranty: remainingWarranty
                    };
                });
                setItems(newItems);
            }
        } catch (error) {
            console.error('Error loading warranty source:', error);
        }
    };


    const [availableChecklistItems, setAvailableChecklistItems] = useState<ChecklistItemParameter[]>([]);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

    const loadData = async () => {
        try {
            const [
                usersData,
                customersData,
                servicesData,
                osPartsData,
                devicesData,
                checklistData,
                profilesData,
                cInfo,
                osWarrantyData,
                genericWarrantyData,
                brandsData,
                categoriesData,
                modelsData,
                gradesData,
                gradeValuesData,
                receiptTermsData,
                osTypesData
            ] = await Promise.all([
                getUsers(),
                getCustomers(),
                getServices(),
                getOsParts(true),
                getCustomerDevices(),
                getChecklistItems(),
                getPermissionProfiles(),
                getCompanyInfo(),
                getOsWarranties(),
                getWarranties(),
                getBrands(),
                getCategories(),
                getProductModels(),
                getGrades(),
                getGradeValues(),
                getOsReceiptTerms(),
                getOsTypes()
            ]);
            setUsers(usersData);
            setCustomers(customersData);
            setAvailableServices(servicesData);
            setAvailableOsParts(osPartsData);
            setCustomerDevices(devicesData);
            setAvailableChecklistItems(checklistData);
            setProfiles(profilesData);
            setCompanyInfo(cInfo);

            // Merge generic and OS warranties with robust deduplication
            const uniqueWarranties = deduplicateWarranties([...(osWarrantyData || []), ...(genericWarrantyData || [])]);
            setOsWarranties(uniqueWarranties);

            setBrands(brandsData);
            setCategories(categoriesData);
            setProductModels(modelsData);
            setGrades(gradesData);
            setGradeValues(gradeValuesData);
            setReceiptTerms(receiptTermsData);
            setOsTypes(osTypesData);

            // Carrega OS DEPOIS que os dados base estiverem prontos (evita race condition)
            if (isEditing && editId) {
                await loadServiceOrderData(editId, customersData, osTypesData);
            }
        } catch (error) {
            toast.error("Erro ao carregar dados iniciais.");
        }
    };


    const loadServiceOrderData = async (id: string, preloadedCustomers?: any[], preloadedOsTypes?: any[]) => {
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
            setDeviceModel(cleanDeviceDescription(so.deviceModel));
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
            setItems((so.items || []).map(item => ({ ...item, description: cleanUUIDs(item.description) })));
            setDiscount(so.discount || 0);
            setResponsibleId(so.responsibleId || '');
            setResponsibleName(so.responsibleName || '');
            setAttendantId(so.attendantId || '');
            setAttendantName(so.attendantName || '');
            setIsWarranty(!!so.isWarranty);
            setParentOsId(so.parentOsId || null);
            setOsStatus(so.status || 'Orçamento');
            if ((so as any).osType && preloadedOsTypes) {
                const foundType = preloadedOsTypes.find((t: any) => t.name === (so as any).osType);
                if (foundType) setSelectedOsType(foundType.id);
            }
            setDisplayId(so.displayId || null);
            if ((so as any).entryDate) setEntryDate(new Date((so as any).entryDate).toISOString());
            if ((so as any).estimatedDate) setEstimatedDate(new Date((so as any).estimatedDate).toISOString().slice(0, 10));
            if ((so as any).exitDate) setExitDate((so as any).exitDate);
            setReceiptTermId(so.receiptTermId || '');
            setCancellationReason((so as any).cancellationReason || null);
            setOriginalStatus(so.status || 'Orçamento');
            
            // Bloquear edição para OS Entregues e Faturadas
            if (so.status === 'Entregue e Faturado') setIsLocked(true);
            // Carregar estado de edição anterior
            if ((so as any).isEdited) setIsEdited(true);

            // Carregar e selecionar cliente — usando lista já carregada para evitar race condition
            if (so.customerId || so.customerName) {
                setCustomerSearch(so.customerName || '');
                // Salvar o phone diretamente da OS como fallback
                if ((so as any).phone) setOsPhone((so as any).phone);
                const custList = preloadedCustomers && preloadedCustomers.length > 0
                    ? preloadedCustomers
                    : await getCustomers();
                
                // Fallback inteligente: se não tem ID, tenta encontrar pelo nome exato
                const cust = so.customerId 
                    ? custList.find((c: any) => c.id === so.customerId) 
                    : custList.find((c: any) => c.name?.toLowerCase() === so.customerName?.toLowerCase());

                if (cust) {
                    setSelectedCustomer(cust);
                    // Se o cliente do cadastro não tem phone, usar o da OS
                    if (!cust.phone && (so as any).phone) {
                        setOsPhone((so as any).phone);
                    }
                } else {
                    // Fallback: criar objeto parcial com os dados da OS
                    setSelectedCustomer({
                        id: so.customerId || 'os-fallback',
                        name: so.customerName || 'Cliente',
                        phone: (so as any).phone,
                    } as Customer);
                }
            }
        } catch (error) {
            toast.error("Erro ao carregar dados da OS.");
        } finally {
            setIsLoadingEdit(false);
        }
    };



    // --- WhatsApp Action ---
    const handleWhatsAppNotification = () => {
        let phone = selectedCustomer?.phone || osPhone;
        
        // Fallback proativo: se não temos telefone no objeto selecionado mas temos o nome, 
        // tenta buscar na lista global de clientes recém carregada
        if (!phone && selectedCustomer?.name && customers.length > 0) {
            const foundCust = customers.find(c => c.name?.toLowerCase() === selectedCustomer.name.toLowerCase());
            if (foundCust?.phone) {
                phone = foundCust.phone;
            }
        }

        if (!phone) {
            toast.error("O cliente desta OS não possui um telefone cadastrado.");
            return;
        }
        
        const trackingUrl = `${window.location.origin}/#/os/track/${editId}`;
        const firstName = selectedCustomer?.name?.split(' ')[0] || 'Cliente';
        const storeName = companyInfo?.name || 'loja';
        const msg = `Olá, ${firstName}, Somos da assistência da ${storeName}. O status da sua Ordem de Serviço *OS-${displayId}* foi atualizado!\n\nStatus Atual: *${osStatus}*\nAparelho: ${deviceModel}\n\nAcompanhe seu reparo em tempo real aqui: ${trackingUrl}`;
        openWhatsApp(phone, msg);
    };

    // --- Search Logic ---
    const filteredCustomers = (customers || []).filter(c =>
        (c.name && c.name.toLowerCase().includes(customerSearch.toLowerCase())) ||
        (c.cpf && c.cpf.includes(customerSearch)) ||
        (c.phone && c.phone.includes(customerSearch))
    ).slice(0, 5); // Limit results

    const handleSelectCustomer = (customer: Customer, clearDevice: boolean = true) => {
        setSelectedCustomer(customer);
        setCustomerSearch(customer.name);
        setShowCustomerResults(false);
        // Limpa aparelho selecionado ao trocar de cliente
        if (clearDevice) {
            setCustomerDeviceId('');
            setDeviceModel('');
            setImei('');
            setSerialNumber('');
            setDeviceSearch('');
        }
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

    // Função auxiliar para montar descrição completa do aparelho
    const buildDeviceFullLabel = (device: CustomerDevice): string => {
        const brand = device.brand || '';
        const model = device.model || '';
        const isApple = brand.toLowerCase() === 'apple';
        const modelHasBrand = model.toLowerCase().includes(brand.toLowerCase());
        
        const parts = [
            (brand && !isApple && !modelHasBrand) ? brand : '',
            model || '',
            // Evita duplicar se storage/color já estiverem no model
            device.storage && !model.includes(device.storage) ? formatStorageUnit(device.storage) : '',
            device.color && !model.includes(device.color) ? device.color : ''
        ].filter(Boolean);
        return parts.join(' ').trim().replace(/\s+/g, ' ');
    };

    const handleSelectDevice = (device: CustomerDevice, forceSetCustomer: boolean = false, knownCustomers?: Customer[]) => {
        const fullLabel = buildDeviceFullLabel(device);
        setCustomerDeviceId(device.id);
        setDeviceModel(cleanDeviceDescription(fullLabel || device.model || device.brand));
        setImei(device.imei || '');
        setSerialNumber(device.serialNumber || '');
        setDeviceSearch(fullLabel || device.model || '');
        setShowDeviceResults(false);

        // Se ainda não tiver cliente selecionado ou forçado, auto-selecionar o dono do aparelho
        if (!selectedCustomer || forceSetCustomer) {
            const listToSearch = knownCustomers || customers;
            const owner = listToSearch.find(c => c.id === device.customerId);
            if (owner) {
                // Passa false para NÃO limpar o aparelho recém-selecionado
                handleSelectCustomer(owner, false);
            }
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
        setPhotos(prev => [...prev, photoData]);
        setIsCameraOpen(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            const newPhotos: string[] = [];
            for (const file of files) {
                try {
                    const compressed = await compressImage(file, { maxWidth: 520, maxHeight: 520, quality: 0.6 });
                    newPhotos.push(compressed);
                } catch (err) {
                    console.error('Error compressing uploaded image:', err);
                    // Fallback to reader if compression fails for some reason
                    const reader = new FileReader();
                    const result = await new Promise<string>((resolve) => {
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                    });
                    newPhotos.push(result);
                }
            }
            setPhotos(prev => [...prev, ...newPhotos]);
        }
        e.target.value = '';
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

    const handleAddItemFromCatalog = (item: Service | OsPart, type: 'service' | 'part', quantity: number = 1) => {
        const newItem: ServiceOrderItem = {
            id: Date.now().toString(),
            catalogItemId: item.id,
            description: cleanUUIDs(type === 'service' ? (item as Service).name : (item as OsPart).name),
            type: type,
            price: type === 'service' ? (item as Service).price : (item as OsPart).salePrice,
            cost: type === 'service' ? (item as Service).cost : (item as OsPart).costPrice,
            quantity: quantity,
            warranty: item.warranty || ''
        };
        setItems([...items, newItem]);
        toast.success(`${type === 'service' ? 'Serviço' : 'Peça OS'} adicionado(a)!`);
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
    const buildServiceOrderData = (overrideStatus?: string) => {
        const responsible = users.find(u => u.id === responsibleId);
        // Garante que IDs que podem ser 'os-fallback' ou vazios virem como null (UUID válido ou null)
        const safeCustomerId = selectedCustomer?.id && selectedCustomer.id !== 'os-fallback' ? selectedCustomer.id : null;
        const safeResponsibleId = responsibleId && responsibleId.trim() !== '' ? responsibleId : null;
        const safeAttendantId = attendantId && attendantId.trim() !== '' ? attendantId : null;
        const safeCustomerDeviceId = customerDeviceId && customerDeviceId.trim() !== '' ? customerDeviceId : null;
        return {
            customerId: safeCustomerId,
            customerName: selectedCustomer?.name || '',
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
            status: (overrideStatus ?? (isEditing ? osStatus : 'Orçamento')) as any,
            osType: osTypes.find(t => t.id === selectedOsType)?.name || '',
            items,
            subtotal,
            discount,
            total,
            responsibleId: safeResponsibleId,
            responsibleName: responsible?.name || responsibleName || '',
            attendantId: safeAttendantId,
            attendantName: users.find(u => u.id === attendantId)?.name || attendantName || currentUser?.name || '',
            photos,
            entryDate: entryDate || new Date().toISOString(),
            estimatedDate: estimatedDate ? new Date(estimatedDate + 'T12:00:00').toISOString() : undefined,
            customerDeviceId: safeCustomerDeviceId,
            receiptTermId: receiptTermId || undefined,
            phone: selectedCustomer?.phone || osPhone || undefined,
            cancellationReason,
            isWarranty,
            parentOsId
        };
    };

    const handleSave = async () => {
        if (!selectedCustomer && !isEditing) {
            toast.error("Selecione um cliente.");
            return;
        }
        if (imei && imei.length !== 15) {
            toast.error("O IMEI deve ter exatamente 15 números.");
            return;
        }
        if (!deviceModel) {
            toast.error("Informe o modelo do aparelho.");
            return;
        }
        // Em edição, o responsável já pode estar nulo no banco — não bloquear
        if (!responsibleId && !isEditing) {
            toast.error("Selecione o responsável.");
            return;
        }

        setIsLoading(true);
        try {
            const serviceOrderData = buildServiceOrderData();
            const currentStatus = serviceOrderData.status;

            if (isEditing && editId) {
                await updateServiceOrder(editId, { ...serviceOrderData, isEdited: true } as any, currentUser?.id, currentUser?.name);
                
                // --- Lógica de Estoque ---
                // 1. OS mudou PARA "Entregue e Faturado": Baixar estoque
                if (originalStatus !== 'Entregue e Faturado' && currentStatus === 'Entregue e Faturado') {
                    await deductOsPartsStock(editId, displayId || 0, items);
                }
                // 2. OS saiu de "Entregue e Faturado" para outro status: Devolver estoque
                else if (originalStatus === 'Entregue e Faturado' && currentStatus !== 'Entregue e Faturado') {
                    await returnOsPartsStock(editId);
                }
                // 3. Permanece em "Entregue e Faturado": Sincronizar (devolver tudo e baixar de novo para garantir acuidade com as peças atuais)
                else if (originalStatus === 'Entregue e Faturado' && currentStatus === 'Entregue e Faturado') {
                    await returnOsPartsStock(editId);
                    await deductOsPartsStock(editId, displayId || 0, items);
                }

                setIsEdited(true);
                setOriginalStatus(currentStatus);
                toast.success("Ordem de Serviço atualizada com sucesso!");
            } else {
                const created = await addServiceOrder(serviceOrderData, currentUser?.id, currentUser?.name);
                // Se criou direto como Entregue e Faturado (ex: via modal customizado se houver), baixa estoque
                if (currentStatus === 'Entregue e Faturado' && created?.id) {
                    await deductOsPartsStock(created.id, created.displayId || 0, items);
                }
                toast.success("Ordem de Serviço criada com sucesso!");
            }
            navigate('/service-orders/list');
        } catch (error) {
            console.error("Error saving OS:", error);
            toast.error("Erro ao salvar Ordem de Serviço.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- Faturar ---
    const handleBilled = async (_paymentMethodId: string, _paymentMethodName: string, payments: any[] = []) => {
        if (!editId) return;
        // Salva OS com status Entregue e Faturado
        const data = buildServiceOrderData('Entregue e Faturado');
        // Add payments array
        await updateServiceOrder(editId, { ...data, payments } as any, currentUser?.id, currentUser?.name);
        // Baixar peças do estoque (com segurança para devolução se já faturada)
        try {
            if (originalStatus === 'Entregue e Faturado') {
                await returnOsPartsStock(editId);
            }
            await deductOsPartsStock(editId, displayId || 0, items);
        } catch (e) {
            console.error('Erro ao baixar estoque:', e);
        }

        
        // Registrar comissão
        try {
            const sellerId = attendantId || responsibleId || currentUser?.id;
            if (sellerId && currentUser) {
                await generateCommissionsForOS(
                    editId,
                    sellerId,
                    items,
                    currentUser.id,
                    currentUser.name,
                    new Date().toISOString(),
                    'Entregue e Faturado'
                );
            }
        } catch (e) {
            console.error('Erro ao gerar comissões:', e);
        }

        setOsStatus('Entregue e Faturado');
        setJustBilled(true);
        setIsLocked(true);
        toast.success('OS faturada e marcada como Entregue e Faturado!');
    };

    // --- Pattern Lock Grid ---


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



    return (
        <div className="max-w-[1600px] w-full px-4 md:px-8 mx-auto pb-20">
            {/* Header - padrão do sistema */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4 justify-between">
                {/* Lado esquerdo: ícone + título + info */}
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/service-orders/list')} className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0">
                        <ArrowLeft size={20} className="text-secondary" />
                    </button>
                    <div className="p-3 bg-primary rounded-2xl text-white shadow-lg shadow-primary/20 flex-shrink-0">
                        <FileText size={22} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-2xl font-black text-primary tracking-tight">
                                {isEditing
                                    ? <span>OS-<span className="text-accent">{displayId ?? '...'}</span></span>
                                    : 'Nova Ordem de Serviço'
                                }
                            </h1>
                            {isEdited && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-violet-100 border border-violet-200 text-[9px] font-black text-violet-700">
                                    <PencilLine size={10} /> Editada
                                </span>
                            )}
                            {isLocked && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-[9px] font-black text-gray-500">
                                    <Lock size={10} /> Somente Leitura
                                </span>
                            )}
                            {isWarranty && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 border border-amber-600 text-[9px] font-black text-white shadow-sm animate-pulse">
                                    <ShieldCheck size={10} strokeWidth={3} /> GARANTIA (RE-ENTRADA)
                                </span>
                            )}
                        </div>
                        <p className="text-sm font-medium text-secondary">
                            {isEditing ? 'Edição completa do atendimento' : 'Preencha os dados para registrar o atendimento'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Banner de OS bloqueada */}
            {isLocked && (
                <div className="mb-6 flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-2xl px-5 py-3.5">
                    <Lock size={16} className="text-violet-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-violet-800">OS Entregue e Faturado — Edição bloqueada</p>
                        <p className="text-xs text-violet-600">Esta OS já foi faturada. Clique no botão <strong>Habilitar Edição</strong> abaixo para fazer alterações.</p>
                    </div>
                </div>
            )}

            <div className="w-full">
                {/* Main Content Area - Full Width No Sidebar */}
                <div className="flex flex-col gap-3">
                    {/* Botões de Ação na mesma linha (WhatsApp, Impressão, Cancelar, Salvar, Faturar) */}
                    <div className="flex items-center justify-between gap-4 flex-wrap z-30 relative">
                        {/* Lado Esquerdo: WhatsApp e Impressão (apenas se edição) */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {isEditing && (
                                <>
                                    <button
                                        onClick={() => handleWhatsAppNotification()}
                                        title="Enviar WhatsApp"
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black text-white bg-[#25D366] hover:bg-[#128C7E] shadow-md shadow-green-500/20 transition-all hover:scale-105"
                                    >
                                        <WhatsAppIcon size={16} className="text-white fill-white" /> WhatsApp
                                    </button>

                                    {/* Botão Imprimir Único com Dropdown */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowPrintMenu(!showPrintMenu)}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-all hover:scale-105"
                                        >
                                            <Printer size={16} /> Imprimir 
                                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showPrintMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"></path></svg>
                                        </button>
                                        
                                        {showPrintMenu && (
                                            <>
                                                {/* Overlay transparente para fechar ao clicar fora */}
                                                <div className="fixed inset-0 z-40" onClick={() => setShowPrintMenu(false)}></div>
                                                <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                                    <button
                                                        onClick={() => { setShowPrintMenu(false); setPrintFormat('A4'); setIsPrintModalOpen(true); }}
                                                        className="w-full text-left px-4 py-3 hover:bg-gray-50 text-gray-700 text-sm font-bold flex items-center gap-3 border-b border-gray-50 transition-colors"
                                                    >
                                                        <FileText size={18} className="text-gray-400" /> Folha A4
                                                    </button>
                                                    <button
                                                        onClick={() => { setShowPrintMenu(false); setPrintFormat('thermal'); setIsPrintModalOpen(true); }}
                                                        className="w-full text-left px-4 py-3 hover:bg-gray-50 text-gray-700 text-sm font-bold flex items-center gap-3 border-b border-gray-50 transition-colors"
                                                    >
                                                        <Printer size={18} className="text-gray-400" /> Bobina 80mm
                                                    </button>
                                                    <button
                                                        onClick={() => { setShowPrintMenu(false); window.print(); }}
                                                        className="w-full text-left px-4 py-3 hover:bg-gray-50 text-gray-700 text-sm font-bold flex items-center gap-3 transition-colors"
                                                    >
                                                        <Tag size={18} className="text-gray-400" /> Etiqueta do Dispositivo
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Lado Direito: OS Rápida, Cancelar, Salvar, Faturar */}
                        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
                            {!isLocked && (
                                <>
                                    <button
                                        onClick={() => { if (!isLocked) navigate('/service-orders/list'); }}
                                        className="h-11 px-6 rounded-xl text-sm font-black transition-all flex items-center justify-center bg-red-50 border border-red-100 hover:bg-red-100 text-red-500 active:scale-95"
                                    >
                                        Cancelar
                                    </button>



                                    <button
                                        onClick={handleSave}
                                        disabled={isLoading}
                                        className="bg-gray-800 hover:bg-gray-900 text-white shadow-xl shadow-gray-200 active:scale-95 h-11 px-6 rounded-xl text-sm font-black transition-all flex items-center gap-2"
                                    >
                                        <Save size={18} />
                                        {isLoading ? 'Salvando...' : 'Salvar OS'}
                                    </button>

                                    {/* Botão Faturar — só visível ao editar */}
                                    {isEditing && (
                                        <button
                                            onClick={() => { if (!isLocked) setIsBillingModalOpen(true); }}
                                            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-500/30 active:scale-95 h-11 px-6 rounded-xl text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap"
                                        >
                                            <DollarSign size={18} />
                                            Faturar
                                        </button>
                                    )}
                                </>
                            )}

                            {/* Botão Gerar Garantia — visível apenas se Entregue e Faturado (Re-entrada) */}
                            {isEditing && osStatus === 'Entregue e Faturado' && (
                                <button
                                    onClick={() => navigate(`/service-orders/new?warranty_from=${editId}`)}
                                    className="bg-red-500 hover:bg-red-600 text-white h-11 px-6 rounded-xl text-sm font-black shadow-lg shadow-red-500/30 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap ml-2"
                                >
                                    <ShieldCheck size={18} />
                                    Gerar Garantia (Re-entrada)
                                </button>
                            )}

                            {/* Botão principal: Habilitar Edição (se bloqueada) adicionado no FINAL */}
                            {isLocked && (
                                <button
                                    onClick={() => {
                                        setIsLocked(false);
                                        toast.info('Edição habilitada. Salve ao terminar.');
                                    }}
                                    className="bg-violet-600 hover:bg-violet-700 text-white h-11 px-6 rounded-xl text-sm font-black shadow-lg shadow-violet-500/30 active:scale-95 transition-all flex items-center gap-2 ml-2"
                                >
                                    <Unlock size={18} /> Habilitar Edição
                                </button>
                            )}
                        </div>
                    </div>

                    <fieldset disabled={isLocked} className={`bg-white border border-gray-200 p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col relative transition-opacity duration-300 ${isLocked ? 'opacity-80' : ''}`}>
                        {/* COL 1: CLIENT & DEVICE */}
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-center gap-4 border-b border-gray-100 pb-2">
                                <h3 className="font-black text-lg text-primary flex items-center gap-2 whitespace-nowrap">
                                    <UserIcon size={18} className="text-accent" /> Cliente e Aparelho
                                </h3>

                                <div className="flex-1 flex justify-end gap-2 min-w-[300px]">
                                    <div className="w-64 flex flex-col gap-0.5">
                                        <label className="flex items-center gap-1 text-[10px] font-black text-violet-600 uppercase px-0.5">
                                            <UserIcon size={10} /> Atendente
                                        </label>
                                        <select
                                            value={attendantId}
                                            onChange={(e) => setAttendantId(e.target.value)}
                                            className="w-full bg-violet-50 border border-violet-200 rounded-lg px-3 text-xs font-bold focus:ring-2 focus:ring-violet-500/20 outline-none h-8 text-violet-900 hover:bg-violet-100/50 transition-colors"
                                        >
                                            <option value="">Selecionar...</option>
                                            {users.filter(u => u.active !== false || u.id === attendantId).map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-64 flex flex-col gap-0.5">
                                        <label className="flex items-center gap-1 text-[10px] font-black text-sky-600 uppercase px-0.5">
                                            <Wrench size={10} /> Técnico
                                        </label>
                                        <select
                                            value={responsibleId}
                                            onChange={(e) => setResponsibleId(e.target.value)}
                                            className="w-full bg-sky-50 border border-sky-200 rounded-lg px-3 text-xs font-bold focus:ring-2 focus:ring-sky-500/20 outline-none h-8 text-sky-900 hover:bg-sky-100/50 transition-colors"
                                        >
                                            <option value="">Selecionar...</option>
                                            {users
                                                .filter(u => {
                                                    const profile = profiles.find(p => p.id === u.permissionProfileId);
                                                    const isTech = profile?.permissions?.isTechnicianProfile;
                                                    const isActive = u.active !== false;
                                                    const isCurrentlySelected = isEditing && (u.id === responsibleId);
                                                    // Se estiver editando e for o selecionado, mantém mesmo se não for técnico ou inativo
                                                    return (isActive && isTech) || isCurrentlySelected;
                                                })
                                                .map(u => (
                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                    {isEditing && (
                                        <div className="w-64 flex flex-col gap-0.5">
                                            <label className="flex items-center gap-1 text-[10px] font-black text-gray-500 uppercase px-0.5">
                                                Status
                                            </label>
                                            <select
                                                value={osStatus}
                                                onChange={async (e) => {
                                                    const newStatus = e.target.value;
                                                    if (newStatus === 'Cancelada') {
                                                        if (!permissions?.canDeleteServiceOrder) {
                                                            toast.error('Você não tem permissão para cancelar uma ordem de serviço.');
                                                            return;
                                                        }
                                                        setIsCancelModalOpen(true);
                                                        return;
                                                    }
                                                    setOsStatus(newStatus);
                                                    if (newStatus === 'Entregue e Faturado') setIsLocked(true);
                                                    if (isEditing && editId) {
                                                        try {
                                                            await updateServiceOrder(editId, { status: newStatus } as any);
                                                            toast.success(`Status atualizado para ${newStatus}`);
                                                        } catch (err) {
                                                            toast.error("Erro ao sincronizar status.");
                                                        }
                                                    }
                                                }}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 text-xs font-bold focus:ring-2 focus:ring-accent/20 outline-none h-8"
                                            >
                                                {['Orçamento', 'Análise', 'Aprovado', 'Em Reparo', 'Aguardando Peça', 'Pronto', 'Entregue e Faturado', 'Cancelada'].map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-3 flex-1">
                                {/* Client Search + Date Filters + Orcamento Toggle all in one row */}
                                <div className="flex flex-wrap gap-3 items-end">


                                    {/* Client search - with label to align properly */}
                                    <div className="flex flex-col gap-0.5 w-full lg:w-[38%] min-w-[180px]">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Cliente</label>
                                        <div ref={customerSearchRef} className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                            <input
                                                type="text"
                                                placeholder="Buscar cliente..."
                                                value={customerSearch}
                                                onChange={e => {
                                                    setCustomerSearch(e.target.value);
                                                    setShowCustomerResults(true);
                                                }}
                                                onFocus={() => setShowCustomerResults(true)}
                                                disabled={isEditing}
                                                className={`w-full h-10 pl-9 pr-10 bg-red-50 border border-red-200 rounded-xl text-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all ${isEditing ? 'opacity-70' : ''}`}
                                            />
                                            {selectedCustomer && !isEditing && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedCustomer(null);
                                                        setCustomerSearch('');
                                                        setCustomerDeviceId('');
                                                        setDeviceModel('');
                                                        setImei('');
                                                        setSerialNumber('');
                                                        setDeviceSearch('');
                                                    }}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors p-1"
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                            {showCustomerResults && customerSearch && !isEditing && (
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
                                    </div>

                                    {/* Add client button */}
                                    {!isEditing && (
                                        <div className="flex flex-col gap-0.5">
                                            <label className="text-[10px] font-bold text-transparent uppercase select-none">+</label>
                                            <button
                                                type="button"
                                                onClick={() => setIsCustomerModalOpen(true)}
                                                className="h-10 w-10 flex items-center justify-center bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-xl transition-colors flex-shrink-0 border border-violet-200"
                                                title="Novo Cliente"
                                            >
                                                <Plus size={18} />
                                            </button>
                                        </div>
                                    )}

                                    {/* Data Entrada - fully clickable */}
                                    <div className="flex flex-col gap-0.5 min-w-[170px]">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Data/Hora Entrada</label>
                                        <label className="relative cursor-pointer">
                                            <input
                                                type="datetime-local"
                                                value={entryDate ? toDateTimeLocalValue(entryDate) : ''}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val) setEntryDate(new Date(val + '-03:00').toISOString());
                                                }}
                                                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all cursor-pointer"
                                            />
                                        </label>
                                    </div>

                                    {/* Data Prevista - fully clickable */}
                                    <div className="flex flex-col gap-0.5 min-w-[130px]">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Data Prevista</label>
                                        <label className="relative cursor-pointer">
                                            <input
                                                type="date"
                                                value={estimatedDate}
                                                onChange={e => setEstimatedDate(e.target.value)}
                                                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all cursor-pointer"
                                            />
                                        </label>
                                    </div>

                                    {/* Select Tipo de OS */}
                                    <div className="flex flex-col gap-0.5 min-w-[150px]">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Tipo</label>
                                        <select
                                            value={selectedOsType}
                                            onChange={e => setSelectedOsType(e.target.value)}
                                            className="h-10 px-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all text-amber-900 w-full shadow-sm"
                                        >
                                            <option value="">Selecione...</option>
                                            {osTypes.map(type => (
                                                <option key={type.id} value={type.id}>{type.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* === APARELHOS DO CLIENTE SELECIONADO === */}
                                {selectedCustomer && !isEditing && !customerDeviceId && (() => {
                                    const clientDevices = customerDevices.filter(d => d.customerId === selectedCustomer.id);
                                    if (clientDevices.length === 0) return null;
                                    return (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Smartphone size={13} className="text-accent" />
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                                    Aparelhos de {selectedCustomer.name.split(' ')[0]} — toque para usar na OS
                                                </span>
                                            </div>
                                            <div className="flex gap-2 flex-wrap">
                                                {clientDevices.map(d => {
                                                    const isSelected = customerDeviceId === d.id;
                                                    const fullLabel = buildDeviceFullLabel(d);
                                                    return (
                                                        <button
                                                            key={d.id}
                                                            type="button"
                                                            onClick={() => handleSelectDevice(d)}
                                                            className={`flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-200 hover:scale-[1.02] active:scale-95 min-w-[220px] max-w-[380px] ${
                                                                isSelected
                                                                    ? 'bg-accent border-accent text-white shadow-md shadow-accent/30'
                                                                    : 'bg-white border-gray-200 text-gray-700 hover:border-accent/50 hover:bg-accent/5 shadow-sm'
                                                            }`}
                                                        >
                                                            <div className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${
                                                                isSelected ? 'bg-white/20' : 'bg-gray-100'
                                                            }`}>
                                                                <Smartphone size={16} className={isSelected ? 'text-white' : 'text-accent'} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className={`text-sm font-black leading-snug mb-1 ${
                                                                    isSelected ? 'text-white' : 'text-primary'
                                                                }`}>
                                                                    {fullLabel || 'Aparelho não identificado'}
                                                                </div>
                                                                {d.imei && (
                                                                    <div className={`text-[11px] font-mono leading-tight ${
                                                                        isSelected ? 'text-white/80' : 'text-gray-500'
                                                                    }`}>
                                                                        IMEI: {d.imei}
                                                                    </div>
                                                                )}
                                                                {d.imei2 && (
                                                                    <div className={`text-[11px] font-mono leading-tight ${
                                                                        isSelected ? 'text-white/80' : 'text-gray-500'
                                                                    }`}>
                                                                        IMEI 2: {d.imei2}
                                                                    </div>
                                                                )}
                                                                {d.serialNumber && (
                                                                    <div className={`text-[11px] font-mono leading-tight ${
                                                                        isSelected ? 'text-white/80' : 'text-gray-500'
                                                                    }`}>
                                                                        S/N: {d.serialNumber}
                                                                    </div>
                                                                )}
                                                                {!d.imei && !d.imei2 && !d.serialNumber && (
                                                                    <div className={`text-[11px] italic leading-tight ${
                                                                        isSelected ? 'text-white/60' : 'text-gray-400'
                                                                    }`}>
                                                                        Sem IMEI / S/N cadastrado
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {isSelected && (
                                                                <CheckCircle2 size={16} className="text-white flex-shrink-0 mt-0.5" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="grid grid-cols-1 gap-4">
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-xs font-black text-primary uppercase">Detalhes do Dispositivo</label>
                                        </div>
                                        <div className="flex flex-wrap lg:flex-nowrap items-end gap-2">
                                            {!customerDeviceId ? (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            setDeviceToEdit(null);
                                                            setIsDeviceModalOpen(true);
                                                        }}
                                                        className="h-10 px-4 flex items-center gap-2 bg-accent text-white rounded-xl text-xs font-black transition-all hover:scale-105 shadow-md shadow-accent/20 whitespace-nowrap shrink-0"
                                                        title="Novo Aparelho"
                                                    >
                                                        <Plus size={16} /> Novo Aparelho
                                                    </button>

                                                    <div ref={deviceSearchRef} className="relative flex-1 md:flex-[0.6] min-w-[200px]">
                                                        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase pl-1">Buscar Aparelho</label>
                                                        <div className="relative">
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                                            <input
                                                                type="text"
                                                                placeholder="Modelo ou IMEI..."
                                                                value={deviceSearch}
                                                                onChange={e => {
                                                                    setDeviceSearch(e.target.value);
                                                                    setShowDeviceResults(true);
                                                                }}
                                                                onFocus={() => setShowDeviceResults(true)}
                                                                className="w-full h-10 pl-9 pr-9 bg-white border border-gray-200 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all text-sm"
                                                            />
                                                            {customerDeviceId && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setCustomerDeviceId('');
                                                                        setDeviceModel('');
                                                                        setImei('');
                                                                        setSerialNumber('');
                                                                        setDeviceSearch('');
                                                                    }}
                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors p-1"
                                                                    title="Limpar seleção"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {showDeviceResults && deviceSearch && (
                                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                                                {filteredDevices.length > 0 ? (
                                                                    filteredDevices.map(d => (
                                                                        <button
                                                                            type="button"
                                                                            key={d.id}
                                                                            onClick={() => handleSelectDevice(d)}
                                                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                                                                        >
                                                                            <div className="font-bold text-primary">{buildDeviceFullLabel(d)}</div>
                                                                            <div className="text-xs text-secondary font-mono">
                                                                                {d.imei && `IMEI: ${d.imei} `}
                                                                                {d.serialNumber && `N/S: ${d.serialNumber}`}
                                                                            </div>
                                                                        </button>
                                                                    ))
                                                                ) : (
                                                                    <div className="px-4 py-3 text-sm text-gray-400">Nenhum aparelho encontrado.</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex-1 md:flex-[0.6]">
                                                    <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase pl-1">Aparelho Selecionado</label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            readOnly
                                                            value={deviceModel}
                                                            className="flex-1 h-10 px-3 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-primary cursor-not-allowed"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const dev = customerDevices.find(d => d.id === customerDeviceId);
                                                                if (dev) {
                                                                    setDeviceToEdit(dev);
                                                                    setIsDeviceModalOpen(true);
                                                                } else {
                                                                    toast.error("Aparelho não encontrado para edição.");
                                                                }
                                                            }}
                                                            className="flex items-center gap-2 px-3 h-10 bg-white border border-gray-200 text-accent rounded-xl hover:bg-gray-50 transition-all font-bold text-xs shadow-sm whitespace-nowrap"
                                                            title="Editar Aparelho"
                                                        >
                                                            <PencilLine size={14} /> Editar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setCustomerDeviceId('');
                                                                setDeviceModel('');
                                                                setImei('');
                                                                setSerialNumber('');
                                                                setDeviceSearch('');
                                                            }}
                                                            className="flex items-center justify-center w-10 h-10 bg-white border border-gray-200 text-gray-400 rounded-xl hover:text-red-500 hover:border-red-100 transition-all shadow-sm"
                                                            title="Desvincular Aparelho"
                                                        >
                                                            <X size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex-1 sm:max-w-[320px] flex flex-col gap-0.5">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">IMEI</label>
                                                <input
                                                    type="text"
                                                    readOnly
                                                    placeholder="IMEI"
                                                    value={imei}
                                                    className="w-full h-10 px-3 bg-gray-100 border border-gray-200 rounded-xl outline-none text-sm text-gray-500 cursor-not-allowed"
                                                />
                                            </div>

                                            <div className="flex-1 sm:max-w-[280px] flex flex-col gap-0.5">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">N. Série</label>
                                                <input
                                                    type="text"
                                                    readOnly
                                                    placeholder="Opcional"
                                                    value={serialNumber}
                                                    className="w-full h-10 px-3 bg-gray-100 border border-gray-200 rounded-xl outline-none text-sm text-gray-500 cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 pt-4 border-t border-gray-100">
                                    {/* Lock Pattern / Password */}
                                    <div className="sm:col-span-5 lg:col-span-4">
                                        <label className="block text-sm font-black text-primary mb-4 flex items-center gap-2">
                                            <Unlock size={16} className="text-secondary" /> Senha / Padrão
                                        </label>
                                        <div className="flex flex-wrap gap-6 items-start">
                                            {/* Alfanumérica Column */}
                                            <div className="w-52 space-y-1.5">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">Alfanumérica (PIN)</label>
                                                <input
                                                    type="text"
                                                    disabled={isLocked}
                                                    placeholder="Digite a senha..."
                                                    value={passcode}
                                                    onChange={e => setPasscode(e.target.value)}
                                                    className={`w-full h-11 px-3 border rounded-xl text-sm outline-none transition-all shadow-sm ${isLocked ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed' : 'bg-red-50 border-red-200 focus:border-red-400 focus:ring-2 focus:ring-red-100 text-red-900'}`}
                                                />
                                                <p className="text-[9px] text-gray-400 font-medium px-1 leading-tight italic">Senha numérica ou texto</p>
                                            </div>

                                            {/* Pattern Column */}
                                            <div className="w-52 space-y-1.5">
                                                <div className="flex justify-between items-center px-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Padrão de Desenho</label>
                                                    {patternLock.length > 0 && !isLocked && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setPatternLock([])}
                                                            className="text-[9px] text-red-500 hover:text-red-700 font-black uppercase"
                                                        >
                                                            Limpar
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-200 shadow-inner">
                                                    <PatternGrid 
                                                        patternLock={patternLock} 
                                                        setPatternLock={setPatternLock} 
                                                        disabled={isLocked}
                                                    />
                                                </div>
                                                {patternLock.length > 0 && (
                                                    <p className="text-[9px] text-gray-400 font-medium px-1 leading-tight italic">Padrão salvo com {patternLock.length} pontos</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Visual Checklist */}
                                    <div className="sm:col-span-7 lg:col-span-8">
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
                                            <textarea
                                                rows={2}
                                                placeholder="Descreva outros problemas ou itens..."
                                                value={othersDescription}
                                                onChange={e => setOthersDescription(e.target.value)}
                                                className="mt-3 w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-500 shadow-sm resize-none"
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
                                    </div>

                                    {photos.length > 0 && (
                                        <div className="flex gap-4 overflow-x-auto pb-4">
                                            {photos.map((photo, index) => (
                                                <div key={index} className="relative w-24 h-24 flex-shrink-0 group cursor-pointer" onClick={() => setPreviewPhoto(photo)}>
                                                    <img src={photo} alt={`Foto ${index + 1}`} className="w-full h-full object-cover rounded-lg border border-gray-200" />
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); if (!isLocked) removePhoto(index); }}
                                                        disabled={isLocked}
                                                        className={`absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 transition-opacity shadow-sm z-10 hover:bg-red-600 ${isLocked ? 'hidden' : 'opacity-0 group-hover:opacity-100'}`}
                                                    >
                                                        <X size={12} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {!isLocked && (
                                        <div className="flex gap-4 w-full">
                                            <div
                                                onClick={() => { setIsCameraOpen(true); }}
                                                className="flex-1 h-12 border-2 border-dashed border-accent/30 bg-accent/5 rounded-xl flex items-center justify-center transition-all text-accent hover:bg-accent/10 hover:border-accent/50 cursor-pointer gap-2 shadow-sm"
                                            >
                                                <Camera size={20} />
                                                <span className="font-bold text-sm">Tirar Foto</span>
                                            </div>
                                            <label
                                                className="flex-1 h-12 border-2 border-dashed border-accent/30 bg-accent/5 rounded-xl flex items-center justify-center transition-all text-accent hover:bg-accent/10 hover:border-accent/50 cursor-pointer gap-2 shadow-sm"
                                            >
                                                <ImageIcon size={20} />
                                                <span className="font-bold text-sm">Galeria</span>
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    multiple
                                                    className="hidden" 
                                                    onChange={handleFileUpload} 
                                                />
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* COL 2: DIAGNOSIS */}
                        <div className="flex flex-col gap-3 mt-12 pt-8 border-t border-gray-200">
                            <h3 className="font-black text-lg text-primary flex items-center gap-2 border-b border-gray-100 pb-2">
                                <Wrench size={18} className="text-accent" /> Diagnóstico
                            </h3>
                            <div className="space-y-4 flex-1">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-primary mb-2">Defeito Relatado pelo Cliente</label>
                                        <textarea
                                            rows={5}
                                            disabled={isLocked}
                                            placeholder="Descreva o problema relatado..."
                                            value={defectDescription}
                                            onChange={e => setDefectDescription(e.target.value)}
                                            className={`w-full p-4 border rounded-xl outline-none transition-all resize-none ${isLocked ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-50 border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/10'}`}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-primary mb-2">Observações Feitas Pelo Atendente</label>
                                        <textarea
                                            rows={5}
                                            disabled={isLocked}
                                            placeholder="Observações do atendente no recebimento..."
                                            value={attendantObservations}
                                            onChange={e => setAttendantObservations(e.target.value)}
                                            className={`w-full p-4 border rounded-xl outline-none transition-all resize-none ${isLocked ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-50 border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/10'}`}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-100 items-stretch">
                                    <div className="flex-1 flex flex-col">
                                        <label className="block text-sm font-bold text-primary mb-2 flex items-center gap-2">
                                            <Wrench size={16} className="text-accent" />
                                            Laudo Técnico
                                        </label>
                                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex-1 flex flex-col">
                                            <textarea
                                                disabled={isLocked}
                                                placeholder="Diagnóstico técnico, testes realizados..."
                                                value={technicalReport}
                                                onChange={e => setTechnicalReport(e.target.value)}
                                                className={`w-full flex-1 p-0 bg-transparent border-none focus:ring-0 outline-none resize-none min-h-[130px] ${isLocked ? 'text-amber-900/60 cursor-not-allowed' : 'placeholder:text-amber-700/50 text-amber-900'}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-col">
                                        <label className="block text-sm font-bold text-primary mb-2 flex items-center gap-2">
                                            <Eye size={16} className="text-gray-500" />
                                            Observações Internas (Não sai na impressão)
                                        </label>
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex-1 flex flex-col">
                                            <textarea
                                                disabled={isLocked}
                                                placeholder="Observações internas sobre o atendimento..."
                                                value={observations}
                                                onChange={e => setObservations(e.target.value)}
                                                className={`w-full flex-1 p-0 bg-transparent border-none focus:ring-0 outline-none transition-all resize-none text-sm min-h-[130px] ${isLocked ? 'text-gray-500 cursor-not-allowed' : 'text-gray-800'}`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* COL 3: FINANCIAL */}
                        <div className="flex flex-col gap-3 mt-12 pt-8 border-t border-gray-200">
                            <h3 className="font-black text-lg text-primary flex items-center gap-2 border-b border-gray-100 pb-2">
                                <FileText size={18} className="text-accent" /> Orçamento
                            </h3>
                            <div className="space-y-3 flex-1">
                                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                                    <h4 className="font-bold text-sm text-secondary uppercase">Peças e Serviços</h4>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIsServiceModalOpen(true)}
                                            disabled={isLocked}
                                            className={`px-6 py-3 rounded-xl text-base font-black transition-colors flex items-center gap-2 border shadow-sm ${isLocked ? 'bg-gray-100 text-gray-400 border-gray-200 opacity-60 cursor-not-allowed' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-100'}`}
                                        >
                                            <Wrench size={18} /> Adicionar Serviço
                                        </button>
                                        <button
                                            onClick={() => setIsProductModalOpen(true)}
                                            disabled={isLocked}
                                            className={`px-6 py-3 rounded-xl text-base font-black transition-colors flex items-center gap-2 border shadow-sm ${isLocked ? 'bg-gray-100 text-gray-400 border-gray-200 opacity-60 cursor-not-allowed' : 'bg-orange-50 hover:bg-orange-100 text-orange-600 border-orange-100'}`}
                                        >
                                            <Package size={18} /> Adicionar Peça
                                        </button>
                                        <button
                                            onClick={addItem}
                                            disabled={isLocked}
                                            className={`px-6 py-3 rounded-xl text-base font-black transition-colors flex items-center gap-2 border shadow-sm ${isLocked ? 'bg-gray-100 text-gray-400 border-gray-200 opacity-60 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-primary border-gray-200'}`}
                                        >
                                            <Plus size={18} /> Item Avulso
                                        </button>
                                    </div>
                                </div>

                                <div className="border border-gray-200 rounded-xl overflow-x-auto mb-6">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200 text-left text-xs font-bold text-secondary uppercase">
                                            <tr>
                                                <th className="px-1.5 py-4 w-[28%] font-black">Descrição</th>
                                                <th className="px-1.5 py-4 w-40 font-black">Tipo</th>
                                                <th className="px-1.5 py-4 w-60 font-black">Garantia</th>
                                                <th className="px-1.5 py-4 w-20 text-center font-black">Qtd</th>
                                                <th className="px-1.5 py-4 w-32 text-right">Valor Unit.</th>
                                                <th className="px-1.5 py-4 w-28 text-right">Total</th>
                                                <th className="px-1.5 py-4 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {items.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">Nenhum item adicionado</td>
                                                </tr>
                                            ) : (
                                                items.map((item) => (
                                                    <tr key={item.id} className="align-top border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-1.5 pt-3 pb-2">
                                                            <input
                                                                type="text"
                                                                value={item.description}
                                                                onChange={e => updateItem(item.id, 'description', e.target.value)}
                                                                className="w-full h-11 px-3 bg-white border border-gray-200 rounded-lg outline-none focus:border-accent font-medium text-sm transition-all"
                                                            />
                                                        </td>
                                                        <td className="px-1.5 pt-3 pb-2">
                                                            <select
                                                                value={item.type}
                                                                onChange={e => updateItem(item.id, 'type', e.target.value as 'service' | 'part')}
                                                                className="w-full h-11 px-3 bg-white border border-gray-200 rounded-lg outline-none text-sm focus:border-accent transition-all"
                                                                disabled={isLocked}
                                                            >
                                                                <option value="service">Serviço</option>
                                                                <option value="part">Peça</option>
                                                            </select>
                                                        </td>
                                                        <td className="px-1.5 pt-3 pb-2">
                                                            <select
                                                                value={item.warranty || ''}
                                                                onChange={e => updateItem(item.id, 'warranty', e.target.value)}
                                                                className="w-full h-11 px-3 bg-white border border-gray-200 rounded-lg outline-none focus:border-accent font-medium text-sm transition-all"
                                                                disabled={isLocked}
                                                            >
                                                                <option value="">Sem garantia</option>
                                                                {osWarranties
                                                                    .filter(w => w.name.toLowerCase() !== 'sem garantia')
                                                                    .map(w => (
                                                                        <option key={w.id} value={w.name}>{w.name}</option>
                                                                    ))}
                                                            </select>
                                                            <div className="min-h-[18px]">
                                                                {item.warranty && exitDate && (
                                                                    (() => {
                                                                        const expiry = calculateWarrantyExpiry(exitDate, item.warranty);
                                                                        return expiry ? (
                                                                            <div className="flex items-center gap-1 mt-1 text-[10px] font-black text-emerald-600">
                                                                                <ShieldCheck size={10} />
                                                                                Expira: {formatDateBR(expiry)}
                                                                            </div>
                                                                        ) : null;
                                                                    })()
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-1.5 pt-3 pb-2 text-center">
                                                            <input
                                                                type="number"
                                                                value={item.quantity}
                                                                onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
                                                                className="w-full h-11 px-2 text-center bg-white border border-gray-200 rounded-lg outline-none focus:border-accent transition-all" min="1"
                                                            />
                                                        </td>
                                                        <td className="px-1.5 pt-3 pb-2 text-right">
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
                                                                    className="flex-1 w-full h-full bg-transparent border-0 border-transparent outline-none ring-0 focus:ring-0 focus:border-transparent focus:outline-none text-right font-medium text-primary text-sm p-0 shadow-none font-bold"
                                                                    style={{ border: 'none', boxShadow: 'none' }}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-1.5 pt-3 pb-2 text-right font-bold text-primary h-14 align-middle">
                                                            {formatCurrency(item.price * item.quantity)}
                                                        </td>
                                                        <td className="px-1.5 pt-3 pb-2 text-center">
                                                            <button
                                                                onClick={() => { if (!isLocked) removeItem(item.id); }}
                                                                disabled={isLocked}
                                                                className={`transition-colors flex items-center justify-center w-full h-11 ${isLocked ? 'text-gray-200 cursor-not-allowed opacity-50' : 'text-gray-400 hover:text-red-500'}`}
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
                                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200 w-36 focus-within:border-accent group transition-all">
                                            <span className="text-gray-400 font-bold">R$</span>
                                            <input
                                                type="number"
                                                value={discount === 0 ? '' : discount}
                                                placeholder="0"
                                                onChange={e => setDiscount(Number(e.target.value))}
                                                className="w-full text-right font-black text-emerald-600 bg-transparent border-0 outline-none ring-0 focus:ring-0 p-0 shadow-none appearance-none"
                                                style={{ border: 'none', boxShadow: 'none' }}
                                            />
                                        </div>
                                    </div>
                                    <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                                        <span className="font-bold text-lg text-primary">Total Final</span>
                                        <span className="font-black text-2xl text-accent">{formatCurrency(total)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>


                        {/* ---- NAVIGATION FOOTER ---- */}
                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 bg-white z-10 sticky bottom-0">
                            {/* Left Area: Voltar or Empty, AND Termo de Garantia */}
                            <div className="flex items-center gap-4 flex-1">
                                <button
                                    onClick={() => navigate('/service-orders/list')}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-base font-black text-secondary border border-gray-200 hover:bg-gray-50 transition-colors"
                                >
                                    <ChevronLeft size={20} />
                                    Voltar
                                </button>

                                <div className="flex-1 max-w-sm flex items-center gap-3 ml-4">
                                    <label className="text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Termo de Garantia</label>
                                    <select
                                        value={receiptTermId}
                                        onChange={(e) => setReceiptTermId(e.target.value)}
                                        className="w-full bg-red-50 border border-red-200 rounded-lg py-2 px-3 text-sm font-medium focus:ring-2 focus:ring-red-100 outline-none"
                                        disabled={isLocked}
                                    >
                                        <option value="">Selecione um termo...</option>
                                        {receiptTerms.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Botão Salvar */}
                            <div className="flex-shrink-0">
                                <button
                                    onClick={handleSave}
                                    disabled={isLoading}
                                    className="flex items-center gap-3 px-10 py-4 rounded-xl text-base font-black text-white bg-primary shadow-lg shadow-primary/20 hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Save size={20} />
                                    {isLoading ? 'Salvando...' : 'Salvar OS e Sair'}
                                </button>
                            </div>
                        </div> {/* Footer */}
                    </fieldset>
                </div > {/* Content Container */}
            </div > {/* Wide Wrapper (634) */}

            {
                isCustomerModalOpen && (
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
                                    setCustomers(prev => [...prev, newCustomer]);
                                    handleSelectCustomer(newCustomer);
                                    toast.success("Cliente cadastrado e selecionado!");
                                    setIsCustomerModalOpen(false);
                                }
                            } catch (error: any) {
                                console.error("Error creating customer from OS:", error);
                                toast.error(error.message || "Erro ao criar cliente.");
                            }
                        }}
                    />
                )
            }

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
                title="Selecionar Peça (Estoque OS)"
                type="part"
                items={availableOsParts.map(p => ({
                    id: p.id,
                    name: p.name,
                    model: p.name,
                    brand: p.brand || '',
                    category: p.category || '',
                    stock: p.stock,
                    price: p.salePrice,
                    salePrice: p.salePrice,
                    warranty: p.warranty || '',
                    _osPart: p,
                }))}
                onSelect={(item, quantity) => handleAddItemFromCatalog(item._osPart || item, 'part', quantity || 1)}
            />

            {
                isDeviceModalOpen && (
                    <ServiceOrderElectronicDevicesModal
                        isOpen={isDeviceModalOpen}
                        onClose={() => {
                            setIsDeviceModalOpen(false);
                            setDeviceToEdit(null);
                        }}
                        customers={customers}
                        brands={brands}
                        categories={categories}
                        productModels={productModels}
                        grades={grades}
                        gradeValues={gradeValues}
                        initialData={deviceToEdit ? deviceToEdit : (selectedCustomer ? {
                            customerId: selectedCustomer.id,
                            customerName: selectedCustomer.name,
                            customerCpf: selectedCustomer.cpf
                        } : undefined)}
                        onSave={async (device) => {
                            try {
                                let savedDevice;
                                if (deviceToEdit) {
                                  savedDevice = await updateCustomerDevice(deviceToEdit.id, device);
                                  // Update the local list
                                  setCustomerDevices(prev => prev.map(d => d.id === savedDevice.id ? savedDevice : d));
                                  toast.success("Aparelho atualizado com sucesso!");
                                } else {
                                  savedDevice = await addCustomerDevice(device);
                                  setCustomerDevices([...customerDevices, savedDevice]);
                                  toast.success("Aparelho cadastrado e vinculado!");
                                }
                                
                                // Fetch latest customers directly since a new one could have been created in the modal
                                const updatedCustomers = await getCustomers();
                                setCustomers(updatedCustomers);
                                
                                // Força a atualização do cliente e do aparelho recém criados/selecionados
                                handleSelectDevice(savedDevice, true, updatedCustomers);
                                
                                setIsDeviceModalOpen(false);
                                setDeviceToEdit(null);
                            } catch (err) {
                                toast.error("Erro ao salvar aparelho.");
                                console.error(err);
                            }
                        }}
                    />
                )
            }

            {
                isQuickOSOpen && (
                    <QuickOSModal
                        onClose={() => setIsQuickOSOpen(false)}
                        onSaved={() => {
                            setIsQuickOSOpen(false);
                            navigate('/service-orders/list');
                        }}
                    />
                )
            }

            {
                isPrintModalOpen && (
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
                            exitDate: exitDate || undefined,
                            receiptTermId: receiptTermId || undefined,
                            responsibleId,
                            responsibleName: users.find(u => u.id === responsibleId)?.name || 'Técnico',
                            attendantId,
                            attendantName: users.find(u => u.id === attendantId)?.name || currentUser?.name || 'Sistema',
                            createdAt: entryDate,
                            updatedAt: new Date().toISOString()
                        } as any}
                        initialFormat={printFormat}
                        onClose={() => {
                            setIsPrintModalOpen(false);
                            if (justBilled) {
                                navigate('/service-orders/list');
                            }
                        }}
                    />
                )
            }

            {
                isBillingModalOpen && (
                    <OSBillingModal
                        isOpen={isBillingModalOpen}
                        onClose={(action) => {
                            setIsBillingModalOpen(false);
                            if (justBilled && action !== 'print') {
                                navigate('/service-orders/list');
                            }
                        }}
                        serviceOrder={{
                            id: editId || '',
                            displayId,
                            customerName: selectedCustomer?.name || 'Cliente',
                            customerPhone: selectedCustomer?.phone,
                            deviceModel,
                            items,
                            subtotal,
                            discount,
                            total,
                            status: osStatus,
                            defectDescription,
                            technicalReport,
                            observations,
                            attendantObservations,
                            entryDate,
                            attendantName: users.find(u => u.id === attendantId)?.name || currentUser?.name || 'Sistema',
                            responsibleName: users.find(u => u.id === responsibleId)?.name || 'Técnico',
                            checklist,
                            checklistItems: availableChecklistItems,
                        }}
                        onBilled={handleBilled}
                        onPrint={(format) => {
                            setPrintFormat(format);
                            setIsPrintModalOpen(true);
                        }}
                    />
                )
            }

            <DeleteWithReasonModal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                onConfirm={async (reason) => {
                    if (!editId) return;
                    try {
                        await updateServiceOrder(editId, {
                            status: 'Cancelada',
                            cancellationReason: reason
                        } as any);
                        
                        // Devolver estoque se estava faturada
                        if (originalStatus === 'Entregue e Faturado' || osStatus === 'Entregue e Faturado') {
                            await returnOsPartsStock(editId);
                        }

                        setOsStatus('Cancelada');
                        setOriginalStatus('Cancelada');
                        setCancellationReason(reason);
                        toast.success("OS cancelada com sucesso!");
                        setIsCancelModalOpen(false);
                    } catch (err) {
                        toast.error("Erro ao cancelar OS.");
                    }
                }}
                title="Cancelar Ordem de Serviço"
                message="Tem certeza que deseja cancelar esta OS? Informe o motivo obrigatório."
                reasonLabel="Motivo do Cancelamento*"
            />

            {/* Modal de Preview de Foto - Experiência Premium em Tela Cheia */}
            {previewPhoto && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-sm p-2 sm:p-8 animate-in fade-in duration-300" onClick={() => setPreviewPhoto(null)}>
                    <div className="relative w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        <button 
                            className="absolute top-4 right-4 z-[1001] bg-white/10 hover:bg-white/20 text-white p-3 rounded-full backdrop-blur-md transition-all border border-white/10 shadow-xl"
                            onClick={() => setPreviewPhoto(null)}
                        >
                            <X size={24} strokeWidth={3} />
                        </button>
                        <img 
                            src={previewPhoto} 
                            alt="Preview do Aparelho" 
                            className="max-w-full max-h-full object-contain rounded-sm shadow-[0_0_50px_rgba(0,0,0,0.5)] select-none animate-in zoom-in-95 duration-300" 
                        />
                    </div>
                </div>
            )}
        </div >
    );
};

export default ServiceOrderForm;
