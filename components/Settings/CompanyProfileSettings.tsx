import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import { CompanyInfo } from '../../types';
import { getCompanyInfo, updateCompanyInfo, formatPhone } from '../../services/mockApi';
import Button from '../Button';
import { CheckIcon, EditIcon, SpinnerIcon } from '../icons';
import ImageCropperModal from '../ImageCropperModal';

const CompanyProfileSettings: React.FC = () => {
    const { showToast } = useToast();
    const { permissions, user } = useUser();
    const [companyData, setCompanyData] = useState<Partial<CompanyInfo>>({});
    const [loading, setLoading] = useState(true);
    const logoInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        setLoading(true);
        getCompanyInfo().then(info => {
            setCompanyData(info);
        }).finally(() => setLoading(false));
    }, []);

    const canEdit = permissions?.canManageCompanyData;

    const [isCropperOpen, setIsCropperOpen] = useState(false);
    const [tempImage, setTempImage] = useState<string | null>(null);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setTempImage(reader.result as string);
                setIsCropperOpen(true);
                // Reset input
                if (logoInputRef.current) logoInputRef.current.value = '';
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleCropSave = (croppedBase64: string) => {
        setCompanyData(prev => ({ ...prev, logoUrl: croppedBase64 }));
        setIsCropperOpen(false);
        setTempImage(null);
        showToast('Logo atualizada e recortada com sucesso!', 'info');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'whatsapp') {
            setCompanyData(prev => ({ ...prev, [name]: formatPhone(value) }));
        } else {
            setCompanyData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleClearAddress = () => {
        setCompanyData(prev => ({
            ...prev, cep: '', address: '', numero: '', complemento: '', bairro: '', city: '', state: ''
        }));
    };

    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Also clear localStorage fallback if removing logo
            if (!companyData.logoUrl) {
                localStorage.removeItem('company_logo_fallback');
            }
            await updateCompanyInfo(companyData as CompanyInfo, user?.id || 'system', user?.name || 'Sistema');
            showToast('Dados da empresa salvos com sucesso!', 'success');
            // Don't reload - keep current state values as the source of truth
        } catch (error) {
            console.error('Erro ao salvar:', error);
            showToast('Erro ao salvar os dados da empresa.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const inputClasses = "w-full px-3 py-2 border rounded-xl bg-transparent border-border focus:ring-success focus:border-success text-sm h-10 disabled:bg-gray-100";
    const labelClasses = "block text-sm font-medium text-primary mb-1";

    if (loading) return <div className="flex justify-center items-center p-8"><SpinnerIcon /></div>;

    return (
        <div className="bg-surface rounded-3xl border border-border p-6 space-y-6 shadow-sm">
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Forms */}
                <div className="flex-1 space-y-6">
                    <div className="p-4 border border-gray-100 bg-white/50 rounded-3xl space-y-4 shadow-sm">
                        <h3 className="font-semibold text-primary">Dados Principais</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><label className={labelClasses}>Nome Fantasia</label><input name="name" value={companyData.name || ''} onChange={handleInputChange} className={inputClasses} disabled={!canEdit} required /></div>
                            <div><label className={labelClasses}>Razão Social</label><input name="razaoSocial" value={companyData.razaoSocial || ''} onChange={handleInputChange} className={inputClasses} disabled={!canEdit} /></div>
                            <div><label className={labelClasses}>CNPJ / CPF</label><input name="cnpj" value={companyData.cnpj || ''} onChange={handleInputChange} className={inputClasses} disabled={!canEdit} required /></div>
                            <div><label className={labelClasses}>Inscrição Estadual</label><input name="inscricaoEstadual" value={companyData.inscricaoEstadual || ''} onChange={handleInputChange} className={inputClasses} disabled={!canEdit} /></div>
                        </div>
                    </div>
                    <div className="p-4 border border-gray-100 bg-white/50 rounded-3xl space-y-4 shadow-sm">
                        <h3 className="font-semibold text-primary">Contato</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div><label className={labelClasses}>WhatsApp</label><input name="whatsapp" value={companyData.whatsapp || ''} onChange={handleInputChange} className={inputClasses} maxLength={15} disabled={!canEdit} required /></div>
                            <div><label className={labelClasses}>Email</label><input name="email" type="email" value={companyData.email || ''} onChange={handleInputChange} className={inputClasses} disabled={!canEdit} required /></div>
                            <div><label className={labelClasses}>Instagram</label><input name="instagram" value={companyData.instagram || ''} onChange={handleInputChange} className={inputClasses} placeholder="@suaempresa" disabled={!canEdit} /></div>
                        </div>
                    </div>
                    <div className="p-4 border border-gray-100 bg-white/50 rounded-3xl space-y-4 shadow-sm">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-primary">Endereço</h3>
                            {canEdit && <button onClick={handleClearAddress} className="text-sm text-accent p-1 rounded-xl hover:bg-accent-light">Limpar</button>}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <div className="sm:col-span-1"><label className={labelClasses}>CEP</label><input name="cep" value={companyData.cep || ''} onChange={handleInputChange} className={inputClasses} disabled={!canEdit} required /></div>
                            <div className="sm:col-span-3"><label className={labelClasses}>Logradouro</label><input name="address" value={companyData.address || ''} onChange={handleInputChange} className={inputClasses} disabled={!canEdit} required /></div>
                            <div className="sm:col-span-1"><label className={labelClasses}>Número</label><input name="numero" value={companyData.numero || ''} onChange={handleInputChange} className={inputClasses} disabled={!canEdit} /></div>
                            <div className="sm:col-span-1"><label className={labelClasses}>Complemento</label><input name="complemento" value={companyData.complemento || ''} onChange={handleInputChange} className={inputClasses} disabled={!canEdit} /></div>
                            <div className="sm:col-span-2"><label className={labelClasses}>Bairro</label><input name="bairro" value={companyData.bairro || ''} onChange={handleInputChange} className={inputClasses} disabled={!canEdit} /></div>
                            <div className="sm:col-span-3"><label className={labelClasses}>Cidade</label><input name="city" value={companyData.city || ''} onChange={handleInputChange} className={inputClasses} disabled={!canEdit} required /></div>
                            <div className="sm:col-span-1"><label className={labelClasses}>UF</label><select name="state" value={companyData.state || ''} onChange={handleInputChange} className={inputClasses} disabled={!canEdit} required><option>PE</option></select></div>
                        </div>
                    </div>
                </div>
                {/* Logo */}
                <div className="w-full lg:w-52 flex-shrink-0">
                    <div className="p-4 border border-gray-100 bg-white/50 rounded-3xl text-center sticky top-8 shadow-sm">
                        <h3 className="font-semibold text-primary mb-4">Logo</h3>
                        <input
                            type="file"
                            ref={logoInputRef}
                            onChange={handleLogoChange}
                            className="hidden"
                            accept="image/*"
                            disabled={!canEdit}
                        />
                        <div className="relative w-40 h-40 mx-auto">
                            {companyData.logoUrl ? (
                                <img src={companyData.logoUrl} alt={companyData.name} className="w-full h-full object-cover border border-border rounded-full p-1" />
                            ) : (
                                <div className="w-full h-full border-2 border-dashed border-border rounded-full flex items-center justify-center text-center bg-gray-50">
                                    <span className="text-muted text-sm px-2">Adicionar Logo</span>
                                </div>
                            )}
                            {canEdit && (
                                <button
                                    type="button"
                                    onClick={() => logoInputRef.current?.click()}
                                    className="absolute -bottom-1 -right-1 bg-white p-2.5 rounded-full shadow-lg hover:bg-gray-100 transition-colors border border-gray-100"
                                    title="Adicionar ou alterar logo"
                                >
                                    <EditIcon className="w-5 h-5 text-primary" />
                                </button>
                            )}
                        </div>
                        {(companyData.logoUrl && canEdit) && (
                            <button onClick={() => setCompanyData(prev => ({ ...prev, logoUrl: '' }))} className="mt-4 text-xs text-danger hover:underline">Remover Logo</button>
                        )}
                    </div>
                </div>
            </div>
            {canEdit && (
                <div className="flex justify-end pt-4 border-t mt-6">
                    <Button onClick={handleSave} variant="success" loading={saving} icon={<CheckIcon className="h-5 w-5" />}>Salvar Alterações</Button>
                </div>
            )}

            <ImageCropperModal
                isOpen={isCropperOpen}
                imageUrl={tempImage}
                onClose={() => setIsCropperOpen(false)}
                onCrop={handleCropSave}
                aspectRatio={1}
            />
        </div>
    );
};

export default CompanyProfileSettings;
