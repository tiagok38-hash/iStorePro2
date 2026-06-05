import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Smartphone, ChevronRight, ChevronLeft, Check, Phone, User, Mail, Loader2, AlertCircle, MessageCircle, Share2 } from 'lucide-react';
import { getPublicAvaliacaoData, submitAvaliacaoLead, PublicAvaliacaoData } from '../../services/avaliacaoService.ts';
import { AvaliacaoDevice, AvaliacaoCondition, AvaliacaoPart } from '../../types.ts';

// ─── Helpers ──────────────────────────────────────────────────
const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Step = 'device' | 'condition' | 'parts' | 'contact' | 'result';
const STEPS: Step[] = ['device', 'condition', 'parts', 'contact', 'result'];
const STEP_LABELS: Record<Step, string> = {
    device: 'Dispositivo',
    condition: 'Estado',
    parts: 'Defeitos',
    contact: 'Contato',
    result: 'Resultado',
};

// ─── Componente: Stepper ──────────────────────────────────────
const Stepper: React.FC<{ current: Step; collectContact: boolean }> = ({ current, collectContact }) => {
    const steps = collectContact ? STEPS : STEPS.filter(s => s !== 'contact');
    const currentIdx = steps.indexOf(current);
    return (
        <div className="flex items-center justify-center gap-0 mb-8">
            {steps.map((step, idx) => (
                <React.Fragment key={step}>
                    <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
                            idx < currentIdx ? 'bg-violet-600 text-white' :
                            idx === currentIdx ? 'bg-violet-600 text-white ring-4 ring-violet-200' :
                            'bg-gray-100 text-gray-400'
                        }`}>
                            {idx < currentIdx ? <Check size={14} /> : idx + 1}
                        </div>
                        <span className={`text-xs mt-1 font-semibold hidden sm:block ${idx === currentIdx ? 'text-violet-700' : 'text-gray-400'}`}>
                            {STEP_LABELS[step]}
                        </span>
                    </div>
                    {idx < steps.length - 1 && (
                        <div className={`h-0.5 flex-1 mx-2 transition-all duration-500 ${idx < currentIdx ? 'bg-violet-500' : 'bg-gray-100'}`} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};

// ─── Step 1: Dispositivo ──────────────────────────────────────
const DeviceStep: React.FC<{
    devices: AvaliacaoDevice[];
    selected: { brand: string; model: string; storage: string; color: string; deviceId: string };
    onChange: (v: any) => void;
    onNext: () => void;
}> = ({ devices, selected, onChange, onNext }) => {
    const brands = useMemo(() => [...new Set(devices.map(d => d.brand))].sort(), [devices]);
    const models = useMemo(() => devices.filter(d => d.brand === selected.brand), [devices, selected.brand]);
    const selectedDevice = useMemo(() => devices.find(d => d.id === selected.deviceId), [devices, selected.deviceId]);

    const canAdvance = selected.deviceId && (
        (selectedDevice?.storageOptions.length === 0 || selected.storage) &&
        (selectedDevice?.colorOptions.length === 0 || selected.color)
    );

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-black text-gray-900">Qual é o seu aparelho?</h2>
                <p className="text-sm text-gray-500 mt-1">Selecione a marca e modelo do dispositivo para avaliação</p>
            </div>

            {/* Marca */}
            <div>
                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Marca</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {brands.map(b => (
                        <button key={b} onClick={() => onChange({ brand: b, model: '', storage: '', color: '', deviceId: '' })}
                            className={`px-3 py-2.5 rounded-xl text-sm font-semibold text-center transition-all duration-200 border-2 ${selected.brand === b ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-100 bg-white text-gray-600 hover:border-violet-200 hover:bg-violet-50/50'}`}>
                            {b}
                        </button>
                    ))}
                </div>
            </div>

            {/* Modelo */}
            {selected.brand && (
                <div className="animate-fade-in">
                    <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Modelo</label>
                    <div className="grid grid-cols-2 gap-2">
                        {models.map(d => (
                            <button key={d.id} onClick={() => onChange({ ...selected, model: d.model, deviceId: d.id, storage: '', color: '' })}
                                className={`px-4 py-3 rounded-xl text-sm font-semibold text-left transition-all duration-200 border-2 ${selected.deviceId === d.id ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-100 bg-white text-gray-600 hover:border-violet-200 hover:bg-violet-50/50'}`}>
                                {d.model}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Storage */}
            {selectedDevice && selectedDevice.storageOptions.length > 0 && (
                <div className="animate-fade-in">
                    <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Armazenamento</label>
                    <div className="flex flex-wrap gap-2">
                        {selectedDevice.storageOptions.map(s => (
                            <button key={s} onClick={() => onChange({ ...selected, storage: s })}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${selected.storage === s ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-100 bg-white text-gray-600 hover:border-violet-200'}`}>
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Color */}
            {selectedDevice && selectedDevice.colorOptions.length > 0 && (
                <div className="animate-fade-in">
                    <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Cor</label>
                    <div className="flex flex-wrap gap-2">
                        {selectedDevice.colorOptions.map(c => (
                            <button key={c} onClick={() => onChange({ ...selected, color: c })}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${selected.color === c ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-100 bg-white text-gray-600 hover:border-violet-200'}`}>
                                {c}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <button onClick={onNext} disabled={!canAdvance}
                className="w-full flex items-center justify-center gap-2 py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-2xl font-black text-base transition-all duration-200 active:scale-[0.98]">
                Próximo <ChevronRight size={20} />
            </button>
        </div>
    );
};

// ─── Step 2: Condição ─────────────────────────────────────────
const ConditionStep: React.FC<{
    conditions: AvaliacaoCondition[];
    selected: string;
    onChange: (id: string) => void;
    onNext: () => void;
    onBack: () => void;
}> = ({ conditions, selected, onChange, onNext, onBack }) => (
    <div className="space-y-6">
        <div>
            <h2 className="text-xl font-black text-gray-900">Qual é o estado do aparelho?</h2>
            <p className="text-sm text-gray-500 mt-1">Selecione a opção que melhor descreve a condição atual</p>
        </div>
        <div className="space-y-3">
            {conditions.map(c => (
                <button key={c.id} onClick={() => onChange(c.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200 ${selected === c.id ? 'border-violet-500 bg-violet-50' : 'border-gray-100 bg-white hover:border-violet-200 hover:bg-violet-50/30'}`}>
                    <span className="text-3xl flex-shrink-0">{c.icon || '📱'}</span>
                    <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm ${selected === c.id ? 'text-violet-800' : 'text-gray-800'}`}>{c.label}</p>
                        {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${c.deductionValue === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {c.deductionValue === 0 ? 'Sem dedução' : c.deductionType === 'percentage' ? `-${c.deductionValue}%` : `-${fmtCurrency(c.deductionValue)}`}
                    </span>
                    {selected === c.id && <Check size={18} className="text-violet-600 flex-shrink-0" />}
                </button>
            ))}
        </div>
        <div className="flex gap-3">
            <button onClick={onBack} className="flex items-center gap-2 px-5 py-4 border border-gray-200 rounded-2xl font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <ChevronLeft size={18} />
            </button>
            <button onClick={onNext} disabled={!selected}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-2xl font-black text-base transition-all duration-200 active:scale-[0.98]">
                Próximo <ChevronRight size={20} />
            </button>
        </div>
    </div>
);

// ─── Step 3: Defeitos ─────────────────────────────────────────
const PartsStep: React.FC<{
    parts: AvaliacaoPart[];
    selected: string[];
    onChange: (ids: string[]) => void;
    onNext: () => void;
    onBack: () => void;
}> = ({ parts, selected, onChange, onNext, onBack }) => {
    const toggle = (id: string) => {
        onChange(selected.includes(id) ? selected.filter(i => i !== id) : [...selected, id]);
    };
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-black text-gray-900">O aparelho tem algum defeito?</h2>
                <p className="text-sm text-gray-500 mt-1">Selecione tudo que se aplica (pode deixar em branco se estiver OK)</p>
            </div>
            <div className="space-y-2">
                {parts.map(p => {
                    const isSelected = selected.includes(p.id);
                    return (
                        <button key={p.id} onClick={() => toggle(p.id)}
                            className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all duration-200 ${isSelected ? 'border-red-300 bg-red-50' : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'}`}>
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'border-red-500 bg-red-500' : 'border-gray-300'}`}>
                                {isSelected && <Check size={12} className="text-white" />}
                            </div>
                            <span className={`font-semibold text-sm flex-1 ${isSelected ? 'text-red-800' : 'text-gray-700'}`}>{p.label}</span>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${isSelected ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                                {p.deductionType === 'percentage' ? `-${p.deductionValue}%` : `-${fmtCurrency(p.deductionValue)}`}
                            </span>
                        </button>
                    );
                })}
                {parts.length === 0 && (
                    <div className="text-center py-10 text-gray-400">
                        <Check size={32} className="mx-auto mb-2 text-emerald-500" />
                        <p className="font-medium text-emerald-600">Nenhuma avaria configurada</p>
                        <p className="text-xs mt-1">Continue para o próximo passo</p>
                    </div>
                )}
            </div>
            <div className="flex gap-3">
                <button onClick={onBack} className="flex items-center gap-2 px-5 py-4 border border-gray-200 rounded-2xl font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                    <ChevronLeft size={18} />
                </button>
                <button onClick={onNext}
                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-black text-base transition-all duration-200 active:scale-[0.98]">
                    {selected.length === 0 ? 'Sem defeitos — Próximo' : `${selected.length} defeito(s) — Próximo`}
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
    );
};

// ─── Step 4: Contato ──────────────────────────────────────────
const ContactStep: React.FC<{
    contact: { name: string; phone: string; email: string };
    onChange: (v: any) => void;
    onNext: () => void;
    onBack: () => void;
    saving: boolean;
}> = ({ contact, onChange, onNext, onBack, saving }) => (
    <div className="space-y-6">
        <div>
            <h2 className="text-xl font-black text-gray-900">Seus dados para contato</h2>
            <p className="text-sm text-gray-500 mt-1">Informe como podemos entrar em contato com você sobre a oferta</p>
        </div>
        <div className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Nome *</label>
                <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={contact.name} onChange={e => onChange({ ...contact, name: e.target.value })}
                        placeholder="Seu nome completo" autoComplete="name"
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">WhatsApp *</label>
                <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={contact.phone} onChange={e => onChange({ ...contact, phone: e.target.value })}
                        placeholder="(11) 99999-9999" type="tel" autoComplete="tel"
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">E-mail <span className="font-normal text-gray-400 normal-case">(opcional)</span></label>
                <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={contact.email} onChange={e => onChange({ ...contact, email: e.target.value })}
                        placeholder="seu@email.com" type="email" autoComplete="email"
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
            </div>
        </div>
        {/* Honeypot anti-spam */}
        <input type="text" name="website" autoComplete="off" tabIndex={-1} style={{ display: 'none' }} aria-hidden="true" />

        <div className="flex gap-3">
            <button onClick={onBack} className="flex items-center gap-2 px-5 py-4 border border-gray-200 rounded-2xl font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <ChevronLeft size={18} />
            </button>
            <button onClick={onNext} disabled={!contact.name.trim() || !contact.phone.trim() || saving}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-2xl font-black text-base transition-all duration-200 active:scale-[0.98]">
                {saving ? <Loader2 size={18} className="animate-spin" /> : null}
                {saving ? 'Calculando...' : 'Ver Resultado'} <ChevronRight size={20} />
            </button>
        </div>
    </div>
);

// ─── Step 5: Resultado ────────────────────────────────────────
const ResultStep: React.FC<{
    device: { brand: string; model: string; storage: string; color: string };
    conditionLabel: string;
    baseValue: number;
    deductions: { label: string; type: string; value: number; amount: number }[];
    finalValue: number;
    validityDays?: number;
    whatsapp?: string;
    onRestart: () => void;
}> = ({ device, conditionLabel, baseValue, deductions, finalValue, validityDays, whatsapp, onRestart }) => {
    const validUntil = validityDays
        ? new Date(Date.now() + validityDays * 86400000).toLocaleDateString('pt-BR')
        : null;

    const whatsappMsg = encodeURIComponent(
        `Olá! Fiz a avaliação do meu ${device.brand} ${device.model} ${device.storage} ${device.color} e recebi o valor de ${fmtCurrency(finalValue)}. Gostaria de usar como parte do pagamento em uma compra!`
    );
    const whatsappUrl = whatsapp ? `https://wa.me/55${whatsapp.replace(/\D/g, '')}?text=${whatsappMsg}` : null;

    return (
        <div className="space-y-6">
            <div className="text-center">
                <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={32} className="text-violet-600" />
                </div>
                <h2 className="text-2xl font-black text-gray-900">Avaliação Concluída!</h2>
                <p className="text-sm text-gray-500 mt-1">{device.brand} {device.model} · {device.storage} {device.color}</p>
            </div>

            {/* Breakdown */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Detalhamento</p>
                </div>
                <div className="divide-y divide-gray-50">
                    <div className="flex justify-between items-center px-5 py-3">
                        <span className="text-sm text-gray-600">Valor base ({device.storage} {device.color})</span>
                        <span className="font-bold text-gray-900">{fmtCurrency(baseValue)}</span>
                    </div>
                    <div className="flex justify-between items-center px-5 py-3 bg-gray-50/50">
                        <span className="text-sm text-gray-600">Condição: {conditionLabel}</span>
                        <span className="font-bold text-red-500">
                            -{fmtCurrency(deductions.find(d => d.label === conditionLabel)?.amount || 0)}
                        </span>
                    </div>
                    {deductions.filter(d => d.label !== conditionLabel).map((d, i) => (
                        <div key={i} className="flex justify-between items-center px-5 py-3">
                            <span className="text-sm text-gray-600">{d.label}</span>
                            <span className="font-bold text-red-500">-{fmtCurrency(d.amount)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Valor final em destaque */}
            <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-6 text-center text-white">
                <p className="text-sm font-semibold opacity-80 uppercase tracking-wider">Valor Estimado para Trade-In</p>
                <p className="text-5xl font-black mt-2 tracking-tight">{fmtCurrency(finalValue)}</p>
                {validUntil && (
                    <p className="text-sm mt-3 opacity-70">⏰ Válido até {validUntil}</p>
                )}
            </div>

            {/* CTAs */}
            <div className="space-y-3">
                {whatsappUrl && (
                    <a href={whatsappUrl} target="_blank" rel="noreferrer"
                        className="flex items-center justify-center gap-3 w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-base transition-all active:scale-[0.98]">
                        <MessageCircle size={20} />
                        Quero usar esse valor em uma compra!
                    </a>
                )}
                <button onClick={onRestart}
                    className="flex items-center justify-center gap-2 w-full py-3 border border-gray-200 text-gray-600 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition-colors">
                    Avaliar outro aparelho
                </button>
            </div>

            <p className="text-xs text-center text-gray-400">
                Esta avaliação é uma estimativa sujeita à verificação presencial do aparelho.
            </p>
        </div>
    );
};

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────
const AvaliacaoPublic: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<PublicAvaliacaoData | null>(null);
    const [step, setStep] = useState<Step>('device');
    const [saving, setSaving] = useState(false);

    // State per step
    const [deviceSel, setDeviceSel] = useState({ brand: '', model: '', storage: '', color: '', deviceId: '' });
    const [conditionSel, setConditionSel] = useState('');
    const [partsSel, setPartsSel] = useState<string[]>([]);
    const [contact, setContact] = useState({ name: '', phone: '', email: '' });

    // Resultado calculado
    const [result, setResult] = useState<{ baseValue: number; deductions: any[]; finalValue: number; conditionLabel: string } | null>(null);

    useEffect(() => {
        if (!slug) { setError('Link inválido.'); setLoading(false); return; }
        getPublicAvaliacaoData(slug)
            .then(d => {
                if (!d.settings?.isActive) { setError('Este formulário está temporariamente desativado.'); }
                else { setData(d); }
            })
            .catch(() => setError('Loja não encontrada ou formulário indisponível.'))
            .finally(() => setLoading(false));
    }, [slug]);

    const collectContact = data?.settings?.collectContact ?? true;
    const steps: Step[] = collectContact ? STEPS : STEPS.filter(s => s !== 'contact');

    const calculateResult = () => {
        if (!data) return null;
        const device = data.devices.find(d => d.id === deviceSel.deviceId);
        if (!device) return null;

        const variantKey = `${deviceSel.storage}__${deviceSel.color}`;
        const variantKeyStorage = `${deviceSel.storage}__`;
        const variantKeyColor = `__${deviceSel.color}`;
        const baseValue =
            device.baseValues[variantKey] ??
            device.baseValues[variantKeyStorage] ??
            device.baseValues[variantKeyColor] ??
            Object.values(device.baseValues)[0] ?? 0;

        const condition = data.conditions.find(c => c.id === conditionSel);
        const selectedParts = data.parts.filter(p => partsSel.includes(p.id));

        const deductions: any[] = [];

        if (condition && condition.deductionValue > 0) {
            const amount = condition.deductionType === 'percentage' ? baseValue * condition.deductionValue / 100 : condition.deductionValue;
            deductions.push({ label: condition.label, type: condition.deductionType, value: condition.deductionValue, amount });
        }

        selectedParts.forEach(p => {
            const amount = p.deductionType === 'percentage' ? baseValue * p.deductionValue / 100 : p.deductionValue;
            deductions.push({ label: p.label, type: p.deductionType, value: p.deductionValue, amount });
        });

        const totalDeduction = deductions.reduce((s, d) => s + d.amount, 0);
        const floorValue = data.settings?.floorValue ?? 0;
        const finalValue = Math.max(floorValue, baseValue - totalDeduction);

        return { baseValue, deductions, finalValue, conditionLabel: condition?.label ?? '' };
    };

    const handleSubmitAndNext = async () => {
        const calc = calculateResult();
        if (!calc || !data) return;
        setResult(calc);

        const saveAndGo = async () => {
            setSaving(true);
            try {
                await submitAvaliacaoLead({
                    companyId: data.company?.id ?? '',
                    deviceBrand: deviceSel.brand,
                    deviceModel: deviceSel.model,
                    deviceStorage: deviceSel.storage,
                    deviceColor: deviceSel.color,
                    conditionLabel: calc.conditionLabel,
                    partsSelected: data.parts.filter(p => partsSel.includes(p.id)).map(p => ({
                        id: p.id, label: p.label, deductionType: p.deductionType, deductionValue: p.deductionValue,
                        amount: calc.deductions.find(d => d.label === p.label)?.amount ?? 0,
                    })),
                    baseValue: calc.baseValue,
                    deductions: calc.deductions,
                    finalValue: calc.finalValue,
                    customerName: contact.name || undefined,
                    customerPhone: contact.phone || undefined,
                    customerEmail: contact.email || undefined,
                });
            } catch (e) {
                console.warn('Failed to save lead:', e);
            } finally {
                setSaving(false);
            }
        };

        // Salva em background (não bloqueia navegação)
        saveAndGo();
        setStep('result');
    };

    const nextStep = (currentStep: Step) => {
        const idx = steps.indexOf(currentStep);
        if (idx < steps.length - 1) setStep(steps[idx + 1]);
    };

    const prevStep = (currentStep: Step) => {
        const idx = steps.indexOf(currentStep);
        if (idx > 0) setStep(steps[idx - 1]);
    };

    const restart = () => {
        setDeviceSel({ brand: '', model: '', storage: '', color: '', deviceId: '' });
        setConditionSel(''); setPartsSel([]); setContact({ name: '', phone: '', email: '' });
        setResult(null); setStep('device');
    };

    if (loading) return (
        <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 flex items-center justify-center">
            <div className="text-center">
                <Loader2 size={36} className="animate-spin text-violet-500 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">Carregando avaliação...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 flex items-center justify-center p-4">
            <div className="text-center max-w-sm">
                <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-black text-gray-800">Formulário Indisponível</h2>
                <p className="text-sm text-gray-500 mt-2">{error}</p>
            </div>
        </div>
    );

    const calc = result || (step === 'result' ? calculateResult() : null);

    return (
        <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-white/60 shadow-sm">
                <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
                    {data?.company?.logoUrl ? (
                        <img src={data.company.logoUrl} alt={data.company.name} className="h-8 w-auto object-contain" />
                    ) : (
                        <div className="flex items-center gap-2">
                            <Smartphone size={20} className="text-violet-600" />
                            <span className="font-black text-gray-900 text-sm">{data?.company?.name || 'Avaliação'}</span>
                        </div>
                    )}
                    <div className="flex-1" />
                    <span className="text-xs bg-violet-100 text-violet-700 font-bold px-2.5 py-1 rounded-full">Trade-In</span>
                </div>
            </header>

            {/* Body */}
            <main className="max-w-lg mx-auto px-5 py-8">
                {/* Welcome */}
                {step === 'device' && data?.settings?.welcomeMessage && (
                    <div className="bg-violet-50 border border-violet-100 rounded-2xl px-4 py-3 mb-6 text-sm text-violet-800 font-medium">
                        {data.settings.welcomeMessage}
                    </div>
                )}

                {/* Stepper */}
                {step !== 'result' && <Stepper current={step} collectContact={collectContact} />}

                {/* Steps */}
                {step === 'device' && (
                    <DeviceStep
                        devices={data?.devices || []}
                        selected={deviceSel}
                        onChange={setDeviceSel}
                        onNext={() => nextStep('device')}
                    />
                )}
                {step === 'condition' && (
                    <ConditionStep
                        conditions={data?.conditions || []}
                        selected={conditionSel}
                        onChange={setConditionSel}
                        onNext={() => nextStep('condition')}
                        onBack={() => prevStep('condition')}
                    />
                )}
                {step === 'parts' && (
                    <PartsStep
                        parts={data?.parts || []}
                        selected={partsSel}
                        onChange={setPartsSel}
                        onNext={() => collectContact ? nextStep('parts') : handleSubmitAndNext()}
                        onBack={() => prevStep('parts')}
                    />
                )}
                {step === 'contact' && (
                    <ContactStep
                        contact={contact}
                        onChange={setContact}
                        onNext={handleSubmitAndNext}
                        onBack={() => prevStep('contact')}
                        saving={saving}
                    />
                )}
                {step === 'result' && calc && (
                    <ResultStep
                        device={deviceSel}
                        conditionLabel={calc.conditionLabel}
                        baseValue={calc.baseValue}
                        deductions={calc.deductions}
                        finalValue={calc.finalValue}
                        validityDays={data?.settings?.validityDays}
                        whatsapp={data?.settings?.whatsapp || data?.company?.whatsapp}
                        onRestart={restart}
                    />
                )}
            </main>

            {/* Footer */}
            <footer className="pb-8 pt-4 text-center">
                <p className="text-xs text-gray-400">Avaliação online — os valores são estimativas sujeitas à vistoria presencial</p>
            </footer>
        </div>
    );
};

export default AvaliacaoPublic;
