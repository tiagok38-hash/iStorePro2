import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Customer, Supplier, Address } from '../types.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { SpinnerIcon, SearchIcon, EditIcon, CheckIcon, UserCircleIcon, PhotographIcon, CameraIcon, TrashIcon, CloseIcon } from './icons.tsx';
import { formatPhone } from '../services/mockApi.ts';
import CameraModal from './CameraModal.tsx';
import { compressImage } from '../utils/imageUtils.ts';

const formatCPF = (value: string) => {
    return value
        .replace(/\D/g, '')
        .substring(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2');
};

const formatCNPJ = (value: string) => {
    return value
        .replace(/\D/g, '')
        .substring(0, 14)
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
};

const formatBirthDate = (value: string) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, '').substring(0, 8);

    // Format as dd/mm/aaaa
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const ufs = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

type Entity = Partial<Customer & Supplier>;

interface FormDataType extends Omit<Entity, 'address'> {
    address?: Address;
}

interface CustomerModalProps {
    entity: Entity | null;
    initialType: 'Cliente' | 'Fornecedor';
    onClose: () => void;
    onSave: (entityData: FormDataType, entityType: 'Cliente' | 'Fornecedor' | 'Ambos', personType: 'Pessoa Física' | 'Pessoa Jurídica') => void;
    isSaving?: boolean;
}

import Button from './Button.tsx';

const CustomerModal: React.FC<CustomerModalProps> = ({ entity, initialType, onClose, onSave, isSaving }) => {
    const [activeTab, setActiveTab] = useState('dados');
    const [formData, setFormData] = useState<FormDataType>({ address: {} });
    const [entityType, setEntityType] = useState<'Cliente' | 'Fornecedor' | 'Ambos'>(initialType);
    const [personType, setPersonType] = useState<'Pessoa Física' | 'Pessoa Jurídica'>('Pessoa Física');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isFetchingCep, setIsFetchingCep] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
    const [isPhotoMenuOpen, setIsPhotoMenuOpen] = useState(false);
    const photoMenuRef = useRef<HTMLDivElement>(null);
    const photoButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isPhotoMenuOpen && photoMenuRef.current && !photoMenuRef.current.contains(event.target as Node) && photoButtonRef.current && !photoButtonRef.current.contains(event.target as Node)) {
                setIsPhotoMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isPhotoMenuOpen]);


    useEffect(() => {
        const addressObject: Address = { zip: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' };
        if (entity?.address && typeof entity.address !== 'string') {
            Object.assign(addressObject, entity.address);
        }

        const initialFormData: FormDataType = {
            name: entity?.name || '',
            email: entity?.email || '',
            phone: entity?.phone || '',
            cpf: entity?.cpf || '',
            rg: entity?.rg || '',
            birthDate: entity?.birthDate || '',
            cnpj: entity?.cnpj || '',
            address: addressObject,
            id: entity?.id,
            avatarUrl: entity?.avatarUrl,
            instagram: entity?.instagram || '',
        };

        setFormData(initialFormData);
        setPhotoPreview(entity?.avatarUrl || null);
        setEntityType(entity?.cnpj ? 'Fornecedor' : initialType);
        setPersonType(entity?.cnpj ? 'Pessoa Jurídica' : 'Pessoa Física');

    }, [entity, initialType]);

    const validateField = (name: string, value: any): string => {
        if (name === 'zip' && value && value.replace(/\D/g, '').length < 8) {
            return 'CEP inválido (precisa ter 8 caracteres)';
        }
        if (name === 'cpf' && personType === 'Pessoa Física' && value && value.replace(/\D/g, '').length < 11) {
            return 'CPF inválido (precisa ter 11 caracteres)';
        }
        return '';
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        const newErrors = { ...errors };
        const error = validateField(name, value);
        if (error) {
            newErrors[name] = error;
        } else {
            delete newErrors[name];
        }
        setErrors(newErrors);

        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({ ...prev, [parent]: { ...(prev as any)[parent], [child]: value } }));
        } else {
            let formattedValue = value;
            if (name === 'cpf') formattedValue = formatCPF(value);
            else if (name === 'cnpj') formattedValue = formatCNPJ(value);
            else if (name === 'phone') formattedValue = formatPhone(value);
            setFormData(prev => ({ ...prev, [name]: formattedValue }));
        }
    };

    const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const cep = e.target.value.replace(/\D/g, '');

        setFormData(prev => ({ ...prev, address: { ...prev.address!, zip: cep } }));
        setErrors(prev => ({ ...prev, zip: cep.length > 0 && cep.length < 8 ? 'CEP inválido (precisa ter 8 caracteres)' : '' }));

        if (cep.length === 8) {
            setIsFetchingCep(true);
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                if (!response.ok) throw new Error('CEP API request failed');
                const data = await response.json();
                if (!data.erro) {
                    setFormData(prev => ({
                        ...prev,
                        address: {
                            ...prev.address!, street: data.logradouro, city: data.localidade, state: data.uf,
                            zip: cep, neighborhood: data.bairro,
                        }
                    }));
                } else {
                    showToast('CEP não encontrado.', 'warning');
                }
            } catch (error) {
                showToast('Erro ao buscar CEP.', 'error');
            } finally {
                setIsFetchingCep(false);
            }
        }
    };

    const handleClearAddress = () => {
        setFormData(prev => ({
            ...prev,
            address: { zip: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
        }));
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            try {
                // Compress image before setting it
                const compressedBase64 = await compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.7 });
                setPhotoPreview(compressedBase64);
                setFormData(prev => ({ ...prev, avatarUrl: compressedBase64 }));
            } catch (error) {
                console.error("Error compressing image:", error);
                showToast("Erro ao processar imagem.", "error");
            }
        }
    };

    const handleRemovePhoto = () => {
        setPhotoPreview(null);
        setFormData(prev => ({ ...prev, avatarUrl: '' }));
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData, entityType, personType);
    };

    const inputClasses = "p-2 border rounded-xl bg-white border-border focus:ring-1 focus:ring-green-500 focus:border-green-500 w-full text-sm h-9";
    const labelClasses = "block text-xs font-bold text-gray-700 mb-0.5 uppercase tracking-wide";

    const entityTypeClasses = (type: string) => `flex items-center gap-2 p-2 border rounded-xl cursor-pointer transition-colors ${entityType === type ? 'bg-green-100 border-green-300 text-green-800 font-semibold' : ''}`;
    const personTypeClasses = (type: string) => `flex items-center gap-2 p-2 border rounded-xl cursor-pointer transition-colors ${personType === type ? 'bg-green-100 border-green-300 text-green-800 font-semibold' : ''}`;

    const TabButton: React.FC<{ name: string; icon: React.ReactNode; label: string }> = ({ name, icon, label }) => (
        <button type="button" onClick={() => setActiveTab(name)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-sm transition-colors ${activeTab === name ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-100'}`}>
            {icon}
            {label}
        </button>
    );

    const modalContent = (
        <div className="fixed inset-0 flex justify-center items-center p-0 sm:p-4" style={{ zIndex: 99999 }}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative glass-card w-full h-full sm:h-auto sm:max-h-[95vh] sm:rounded-3xl shadow-2xl sm:max-w-3xl flex flex-col animate-fade-in-up overflow-hidden">
                {/* Header - Always visible */}
                <div className="flex justify-between items-center p-3 border-b border-white/20 bg-white/40 backdrop-blur-md shadow-sm flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="bg-green-100 p-1.5 rounded-xl"><UserCircleIcon className="h-5 w-5 text-green-600" /></div>
                        <h2 className="text-base sm:text-lg font-bold text-gray-800">Cadastro de Cliente/Fornecedor</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2.5 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                        aria-label="Fechar modal"
                    >
                        <CloseIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Form Content */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-3 py-2 border-b border-white/20 bg-white/30 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <TabButton name="dados" icon={<CheckIcon className="h-4 w-4" />} label="Dados" />
                            <TabButton name="endereco" icon={<CheckIcon className="h-4 w-4" />} label="Endereço" />
                        </div>
                    </div>

                    <div className="p-3 sm:p-5 space-y-4 bg-transparent flex-1 overflow-y-auto">
                        {activeTab === 'dados' && (
                            <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                                <div className="w-full md:w-auto flex flex-col items-center space-y-2 pt-2">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handlePhotoChange}
                                        className="hidden"
                                        accept="image/*"
                                    />
                                    <div className="relative group">
                                        <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-white shadow-md">
                                            {photoPreview ? (
                                                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <UserCircleIcon className="w-16 h-16 text-gray-400" />
                                            )}
                                        </div>
                                        <button
                                            ref={photoButtonRef}
                                            type="button"
                                            onClick={() => setIsPhotoMenuOpen(p => !p)}
                                            className="absolute bottom-0 right-0 bg-white p-1 rounded-full shadow-lg hover:bg-gray-100 transition-colors border border-gray-100"
                                            title="Adicionar ou alterar foto"
                                        >
                                            <EditIcon className="w-3.5 h-3.5 text-primary" />
                                        </button>

                                        {isPhotoMenuOpen && (
                                            <div ref={photoMenuRef} className="absolute top-0 left-full ml-2 w-36 bg-white rounded-xl shadow-xl border border-gray-100 z-20 overflow-hidden">
                                                <button
                                                    type="button"
                                                    onClick={() => { fileInputRef.current?.click(); setIsPhotoMenuOpen(false); }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-50 text-gray-700"
                                                >
                                                    <PhotographIcon className="h-3.5 w-3.5" />
                                                    Galeria
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setIsCameraModalOpen(true); setIsPhotoMenuOpen(false); }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-50 text-gray-700"
                                                >
                                                    <CameraIcon className="h-3.5 w-3.5" />
                                                    Câmera
                                                </button>
                                                {photoPreview && (
                                                    <button
                                                        type="button"
                                                        onClick={handleRemovePhoto}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-red-50 text-red-600 border-t border-gray-50"
                                                    >
                                                        <TrashIcon className="h-3.5 w-3.5" />
                                                        Remover
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className={entityTypeClasses('Cliente')}><input type="radio" name="entityType" value="Cliente" checked={entityType === 'Cliente'} onChange={() => setEntityType('Cliente')} className="form-radio text-green-600 w-3.5 h-3.5" /> <span className="text-xs">Cliente</span></label>
                                        <label className={entityTypeClasses('Fornecedor')}><input type="radio" name="entityType" value="Fornecedor" checked={entityType === 'Fornecedor'} onChange={() => setEntityType('Fornecedor')} className="form-radio text-green-600 w-3.5 h-3.5" /> <span className="text-xs">Fornecedor</span></label>
                                        <label className={entityTypeClasses('Ambos')}><input type="radio" name="entityType" value="Ambos" checked={entityType === 'Ambos'} onChange={() => setEntityType('Ambos')} className="form-radio text-green-600 w-3.5 h-3.5" /> <span className="text-xs">Ambos</span></label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className={personTypeClasses('Pessoa Física')}><input type="radio" name="personType" value="Pessoa Física" checked={personType === 'Pessoa Física'} onChange={() => setPersonType('Pessoa Física')} className="form-radio text-green-600 w-3.5 h-3.5" /> <span className="text-xs">Pessoa Física</span></label>
                                        <label className={personTypeClasses('Pessoa Jurídica')}><input type="radio" name="personType" value="Pessoa Jurídica" checked={personType === 'Pessoa Jurídica'} onChange={() => setPersonType('Pessoa Jurídica')} className="form-radio text-green-600 w-3.5 h-3.5" /> <span className="text-xs">Pessoa Jurídica</span></label>
                                    </div>
                                    <div><label className={labelClasses}>Nome Completo*</label><input name="name" value={formData.name || ''} onChange={handleChange} className={inputClasses} required /></div>

                                    {personType === 'Pessoa Física' ? (
                                        <>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div><label className={labelClasses}>CPF</label><input name="cpf" value={formData.cpf || ''} onChange={handleChange} className={`${inputClasses} ${errors.cpf ? 'border-red-500' : ''}`} /><p className="text-red-600 text-[10px] mt-0.5">{errors.cpf}</p></div>
                                                <div><label className={labelClasses}>RG</label><input name="rg" value={formData.rg || ''} onChange={handleChange} className={inputClasses} /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div><label className={labelClasses}>Nascimento</label><input name="birthDate" type="text" placeholder="dd/mm/aaaa" value={formData.birthDate || ''} onChange={(e) => setFormData(prev => ({ ...prev, birthDate: formatBirthDate(e.target.value) }))} className={inputClasses} /></div>
                                                <div><label className={labelClasses}>WhatsApp*</label><input name="phone" value={formData.phone || ''} onChange={handleChange} className={inputClasses} required /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div><label className={labelClasses}>Instagram</label><input name="instagram" value={formData.instagram || ''} onChange={handleChange} className={inputClasses} /></div>
                                                <div><label className={labelClasses}>Email</label><input name="email" type="email" value={formData.email || ''} onChange={handleChange} className={inputClasses} /></div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div><label className={labelClasses}>CNPJ</label><input name="cnpj" value={formData.cnpj || ''} onChange={handleChange} className={inputClasses} /></div>
                                                <div><label className={labelClasses}>Insc. Estadual</label><input name="ie" className={inputClasses} /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div><label className={labelClasses}>WhatsApp*</label><input name="phone" value={formData.phone || ''} onChange={handleChange} className={inputClasses} required /></div>
                                                <div><label className={labelClasses}>Instagram</label><input name="instagram" value={formData.instagram || ''} onChange={handleChange} className={inputClasses} /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div><label className={labelClasses}>Email</label><input name="email" type="email" value={formData.email || ''} onChange={handleChange} className={inputClasses} /></div>
                                            </div>
                                        </>
                                    )}
                                    <div className="text-right pt-2"><button type="button" onClick={() => setActiveTab('endereco')} className="px-3 py-1.5 bg-gray-700 text-white rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-gray-800 transition-colors">Endereço →</button></div>
                                </div>
                            </div>
                        )}
                        {activeTab === 'endereco' && (
                            <div className="space-y-3">
                                {/* CEP with buttons on same line */}
                                {/* CEP with buttons on same line */}
                                <div>
                                    <label className={labelClasses}>CEP</label>
                                    <div className="flex gap-2 items-start">
                                        <div className="flex-1">
                                            <input name="zip" value={formData.address?.zip || ''} onChange={handleCepChange} className={`${inputClasses} ${errors.zip ? 'border-red-500' : ''}`} maxLength={8} />
                                            <p className="text-red-600 text-[10px] mt-0.5 min-h-[15px]">{errors.zip}</p>
                                        </div>
                                        <button type="button" className="px-3 h-9 bg-green-500 text-white rounded-xl text-xs flex items-center justify-center hover:bg-green-600 transition-colors shadow-sm"><SearchIcon className="h-4 w-4" /></button>
                                        <button type="button" onClick={handleClearAddress} className="px-3 h-9 bg-gray-200 text-gray-700 rounded-xl text-xs flex items-center justify-center hover:bg-gray-300 transition-colors shadow-sm"><TrashIcon className="h-4 w-4" /></button>
                                    </div>
                                </div>
                                {/* Logradouro + Número */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className={labelClasses}>Logradouro</label><input name="address.street" value={formData.address?.street || ''} onChange={handleChange} className={inputClasses} /></div>
                                    <div><label className={labelClasses}>Número</label><input name="address.number" value={formData.address?.number || ''} onChange={handleChange} className={inputClasses} /></div>
                                </div>
                                {/* Bairro + Complemento */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className={labelClasses}>Bairro</label><input name="address.neighborhood" value={formData.address?.neighborhood || ''} onChange={handleChange} className={inputClasses} /></div>
                                    <div><label className={labelClasses}>Complemento</label><input name="address.complement" value={formData.address?.complement || ''} onChange={handleChange} className={inputClasses} /></div>
                                </div>
                                {/* Cidade + UF */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className={labelClasses}>Cidade</label><input name="address.city" value={formData.address?.city || ''} onChange={handleChange} className={inputClasses} /></div>
                                    <div><label className={labelClasses}>UF</label><select name="address.state" value={formData.address?.state || ''} onChange={handleChange} className={inputClasses}><option value="">-</option>{ufs.map(uf => <option key={uf} value={uf}>{uf}</option>)}</select></div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end p-3 bg-white/30 border-t border-white/20 gap-2 flex-shrink-0">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs uppercase tracking-wide hover:bg-gray-100 transition-colors">
                            Cancelar
                        </button>
                        <Button type="submit" variant="success" loading={isSaving} icon={<CheckIcon className="h-4 w-4" />} className="text-xs font-bold uppercase tracking-wide">
                            Salvar
                        </Button>
                    </div>
                </form>
            </div>

            <CameraModal
                isOpen={isCameraModalOpen}
                onClose={() => setIsCameraModalOpen(false)}
                onCapture={(imageData) => {
                    setPhotoPreview(imageData);
                    setFormData(prev => ({ ...prev, avatarUrl: imageData }));
                    setIsCameraModalOpen(false);
                }}
            />
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default CustomerModal;