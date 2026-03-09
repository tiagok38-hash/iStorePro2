import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    CheckCircle2,
    Smartphone,
    Clock,
    Hash,
    AlertCircle,
    Wrench,
    Search,
    ShieldCheck,
    Package,
    User,
    Phone
} from 'lucide-react';
import { WhatsAppIcon } from '../../components/icons';
import { getWhatsAppLink } from '../../utils/whatsappUtils.ts';
import { getPublicServiceOrderTracking, formatCurrency } from '../../services/mockApi.ts';
import { ServiceOrder, CompanyInfo, ReceiptTermParameter } from '../../types.ts';

const STATUS_STEPS = [
    { id: 'Orçamento', label: 'Orçamento', icon: Hash },
    { id: 'Análise', label: 'Análise', icon: Search },
    { id: 'Aprovado', label: 'Aprovado', icon: CheckCircle2 },
    { id: 'Em Reparo', label: 'Em Reparo', icon: Wrench },
    { id: 'Aguardando Peça', label: 'Aguardando Peça', icon: Package },
    { id: 'Pronto', label: 'Pronto', icon: Smartphone },
    { id: 'Entregue', label: 'Entregue', icon: ShieldCheck }
];

const PublicOSTracking: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [os, setOs] = useState<ServiceOrder | null>(null);
    const [company, setCompany] = useState<CompanyInfo | null>(null);
    const [receiptTerm, setReceiptTerm] = useState<ReceiptTermParameter | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadPublicData = async () => {
            setLoading(true);
            try {
                // Fetch using the public RPC to bypass RLS for unauthenticated users
                const { os: osData, company: companyData, receiptTerm: termData } = await getPublicServiceOrderTracking(token || '');

                if (!osData) {
                    setError("Ordem de Serviço não encontrada.");
                } else if (osData.status === 'Entregue') {
                    setError("Este link de acompanhamento expirou pois o equipamento já foi entregue.");
                    setOs(osData);
                } else {
                    setOs(osData);
                    setReceiptTerm(termData);
                }
                setCompany(companyData);
            } catch (err) {
                setError("Ocorreu um erro ao buscar os dados.");
            } finally {
                setLoading(false);
            }
        };
        loadPublicData();
    }, [token]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-medium animate-pulse">Consultando status...</p>
                </div>
            </div>
        );
    }

    const brandColor = company?.brand_color || '#6B21A8';

    if (error && (!os || os.status === 'Entregue')) {
        const isExpired = os?.status === 'Entregue';
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
                {company?.logoUrl && <img src={company.logoUrl} alt={company.name} className="h-16 mb-6 object-contain" />}
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-gray-100">
                    <div className={`w-16 h-16 ${isExpired ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-red-500'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                        {isExpired ? <ShieldCheck size={32} /> : <AlertCircle size={32} />}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                        {isExpired ? "Acompanhamento Finalizado" : "Erro ao Localizar OS"}
                    </h2>
                    <p className="text-gray-500 mb-6">{error}</p>
                    {company?.whatsapp && (
                        <a
                            href={getWhatsAppLink(company.whatsapp)}
                            className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:scale-[1.02] transition-transform"
                        >
                            <WhatsAppIcon size={20} className="fill-white" />
                            Falar com a Loja
                        </a>
                    )}
                </div>
            </div>
        );
    }

    const currentStatusIndex = STATUS_STEPS.findIndex(step =>
        step.id === os?.status || (os?.status === 'Aberto' && step.id === 'Orçamento')
    );

    return (
        <div className="min-h-screen bg-[#F8F9FD] pb-24">
            <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
                <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {company?.logoUrl && <img src={company.logoUrl} alt={company.name} className="h-8 w-auto object-contain" />}
                        <span className="font-bold text-gray-800 truncate">{company?.name}</span>
                    </div>
                    <div className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold text-gray-500">
                        OS #{os?.displayId}
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
                <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="font-black text-lg uppercase tracking-tight" style={{ color: brandColor }}>Status do Reparo</h2>
                        <div className="flex items-center gap-2 text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-emerald-100">
                            <Clock size={14} className="animate-spin-slow" /> Realtime
                        </div>
                    </div>

                    <div className="relative pl-2">
                        <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-gray-100"></div>
                        <div
                            className="absolute left-[19px] top-0 w-0.5 transition-all duration-1000 ease-out"
                            style={{
                                backgroundColor: brandColor,
                                height: `${(currentStatusIndex / (STATUS_STEPS.length - 1)) * 100}%`
                            }}
                        ></div>

                        <div className="space-y-8 relative">
                            {STATUS_STEPS.map((step, index) => {
                                const isCompleted = index < currentStatusIndex;
                                const isCurrent = index === currentStatusIndex;
                                const Icon = step.icon;

                                return (
                                    <div key={step.id} className="flex items-center gap-4">
                                        <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 z-10
                                            ${isCompleted ? 'bg-white' : isCurrent ? 'bg-white shadow-lg shadow-purple-100 scale-110' : 'bg-gray-50 border-gray-100'}`}
                                            style={{
                                                borderColor: isCompleted || isCurrent ? brandColor : '#F3F4F6',
                                                color: isCurrent ? brandColor : isCompleted ? brandColor : '#9CA3AF'
                                            }}
                                        >
                                            {isCompleted ? <CheckCircle2 size={20} fill={brandColor} className="text-white" /> : <Icon size={18} />}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`text-sm font-bold ${isCurrent ? 'text-gray-900' : 'text-gray-400'}`}>
                                                {step.label}
                                            </span>
                                            {isCurrent && (
                                                <span className="text-[10px] font-medium text-gray-500 animate-pulse">Sua OS está nesta etapa</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-400 text-[11px] uppercase tracking-widest mb-4">Aparelho</h3>
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400">
                            <Smartphone size={24} />
                        </div>
                        <div>
                            <p className="font-bold text-lg text-gray-900">{os?.deviceModel}</p>
                            <p className="text-xs text-gray-400 mt-1">S/N: {os?.serialNumber || os?.imei || '-'}</p>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-50 grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                                <User size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cliente</p>
                                <p className="text-sm font-bold text-gray-900 truncate">{os?.customerName}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
                                <Phone size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Telefone</p>
                                <p className="text-sm font-bold text-gray-900 truncate">{os?.phone || '-'}</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 leading-relaxed">
                    <h3 className="font-bold text-gray-400 text-[11px] uppercase tracking-widest mb-3">Defeito Relatado</h3>
                    <p className="text-sm text-gray-700 italic">"{os?.defectDescription}"</p>

                    {os?.attendantObservations && (
                        <div className="mt-4 pt-4 border-t border-gray-50">
                            <h3 className="font-bold text-gray-400 text-[11px] uppercase tracking-widest mb-3">Observações do Atendimento</h3>
                            <p className="text-sm text-gray-600">{os.attendantObservations}</p>
                        </div>
                    )}
                </section>

                {receiptTerm && (
                    <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 overflow-hidden">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldCheck size={18} className="text-emerald-500" />
                            <h3 className="font-bold text-gray-900 text-sm uppercase tracking-tight">{receiptTerm.name}</h3>
                        </div>
                        <div className="space-y-3">
                            {receiptTerm.warrantyTerm?.content && (
                                <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Termos e Condições</h4>
                                    <div className="text-xs text-gray-600 font-medium leading-relaxed whitespace-pre-wrap italic">
                                        {receiptTerm.warrantyTerm.content}
                                    </div>
                                </div>
                            )}
                            {receiptTerm.warrantyExclusions?.content && (
                                <div className="p-4 bg-red-50/20 rounded-2xl border border-red-100/20">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-2">Exclusões de Garantia</h4>
                                    <div className="text-xs text-red-600/70 font-medium leading-relaxed whitespace-pre-wrap italic">
                                        {receiptTerm.warrantyExclusions.content}
                                    </div>
                                </div>
                            )}
                            {receiptTerm.imageRights?.content && (
                                <div className="p-4 bg-blue-50/20 rounded-2xl border border-blue-100/20">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">Uso de Imagem</h4>
                                    <div className="text-xs text-blue-600/70 font-medium leading-relaxed whitespace-pre-wrap italic">
                                        {receiptTerm.imageRights.content}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-400 text-[11px] uppercase tracking-widest mb-4">Resumo Financeiro</h3>
                    <div className="space-y-3 pb-4 border-b border-dashed border-gray-100">
                        {os?.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm">
                                <span className="text-gray-600">{item.description}</span>
                                <span className="font-bold text-gray-900">{formatCurrency(item.price * item.quantity)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-400 uppercase">Total</span>
                        <span className="text-2xl font-black" style={{ color: brandColor }}>{formatCurrency(os?.total || 0)}</span>
                    </div>
                </section>
            </main>

            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[60%] max-w-[400px] z-[100]">
                <a
                    href={getWhatsAppLink(company?.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full h-14 bg-emerald-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-200 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-wider overflow-hidden group"
                >
                    <div className="h-full px-4 flex items-center bg-emerald-600/30">
                        <WhatsAppIcon size={28} className="text-white fill-white" />
                    </div>
                    <span className="flex-1 pr-4 text-center">Falar com Suporte</span>
                </a>
            </div>

            <footer className="mt-8 text-center px-6 pb-12">
                <p className="text-[10px] text-gray-400 font-medium">Canal oficial de acompanhamento - {company?.name}</p>
                <p className="text-[9px] text-gray-300 mt-1 uppercase tracking-widest font-black">iStore Pro ERP</p>
            </footer>
        </div>
    );
};

export default PublicOSTracking;
