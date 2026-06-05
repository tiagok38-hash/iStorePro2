import React, { useState, useEffect, useCallback } from 'react';
import {
    Settings, Smartphone, Plus, Trash2, Edit3, Check, X, ChevronDown,
    ChevronUp, ToggleLeft, ToggleRight, Save, Copy, ExternalLink, AlertCircle,
    Zap, Tag, Sliders
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext.tsx';
import { useUser } from '../../contexts/UserContext.tsx';
import {
    getAvaliacaoSettings, upsertAvaliacaoSettings,
    getAvaliacaoDevices, addAvaliacaoDevice, updateAvaliacaoDevice, deleteAvaliacaoDevice,
    getAvaliacaoConditions, addAvaliacaoCondition, updateAvaliacaoCondition, deleteAvaliacaoCondition,
    getAvaliacaoParts, addAvaliacaoPart, updateAvaliacaoPart, deleteAvaliacaoPart,
} from '../../services/avaliacaoService.ts';
import {
    AvaliacaoSettings, AvaliacaoDevice, AvaliacaoCondition, AvaliacaoPart
} from '../../types.ts';

// ─── Helpers ──────────────────────────────────────────────────
const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Tab = 'dispositivos' | 'condicoes' | 'defeitos' | 'config';
const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'dispositivos', label: 'Dispositivos', icon: <Smartphone size={16} /> },
    { key: 'condicoes', label: 'Condições', icon: <Sliders size={16} /> },
    { key: 'defeitos', label: 'Defeitos / Peças', icon: <Zap size={16} /> },
    { key: 'config', label: 'Link Público', icon: <Settings size={16} /> },
];

const CONDITION_ICONS = ['✨', '👍', '😐', '⚠️', '🔧', '📱', '💎', '🌟'];

// ─── Sub-componente: Card de seção ─────────────────────────────
const SectionCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
            <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="p-6">{children}</div>
    </div>
);

// ─── Sub-componente: Toggle de ativação ───────────────────────
const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => (
    <button
        onClick={() => !disabled && onChange(!value)}
        className={`transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        type="button"
    >
        {value
            ? <ToggleRight size={28} className="text-violet-600" />
            : <ToggleLeft size={28} className="text-gray-300" />
        }
    </button>
);

// ─── Sub-componente: Badge de tipo de dedução ─────────────────
const DeductionBadge: React.FC<{ type: 'percentage' | 'fixed'; value: number }> = ({ type, value }) => (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${type === 'percentage' ? 'bg-amber-50 text-amber-700' : 'bg-violet-50 text-violet-700'}`}>
        {type === 'percentage' ? `-${value}%` : `-${formatCurrency(value)}`}
    </span>
);

// ─── ABA: Dispositivos ─────────────────────────────────────────
const DevicesTab: React.FC<{ devices: AvaliacaoDevice[]; onRefresh: () => void }> = ({ devices, onRefresh }) => {
    const { showToast } = useToast();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ brand: '', model: '', storagesRaw: '', colorsRaw: '' });
    const [baseValues, setBaseValues] = useState<Record<string, string>>({});

    const variants = React.useMemo(() => {
        const storages = form.storagesRaw.split(',').map(s => s.trim()).filter(Boolean);
        const colors = form.colorsRaw.split(',').map(c => c.trim()).filter(Boolean);
        if (!storages.length && !colors.length) return [];
        if (!storages.length) return colors.map(c => ({ key: `__${c}`, label: c }));
        if (!colors.length) return storages.map(s => ({ key: `${s}__`, label: s }));
        return storages.flatMap(s => colors.map(c => ({ key: `${s}__${c}`, label: `${s} — ${c}` })));
    }, [form.storagesRaw, form.colorsRaw]);

    const resetForm = () => {
        setForm({ brand: '', model: '', storagesRaw: '', colorsRaw: '' });
        setBaseValues({});
        setEditingId(null);
        setShowForm(false);
    };

    const loadForEdit = (d: AvaliacaoDevice) => {
        setForm({
            brand: d.brand,
            model: d.model,
            storagesRaw: d.storageOptions.join(', '),
            colorsRaw: d.colorOptions.join(', '),
        });
        const bvStr: Record<string, string> = {};
        Object.entries(d.baseValues).forEach(([k, v]) => { bvStr[k] = String(v); });
        setBaseValues(bvStr);
        setEditingId(d.id);
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.brand.trim() || !form.model.trim()) {
            showToast('Marca e modelo são obrigatórios.', 'error'); return;
        }
        setSaving(true);
        try {
            const storageOptions = form.storagesRaw.split(',').map(s => s.trim()).filter(Boolean);
            const colorOptions = form.colorsRaw.split(',').map(c => c.trim()).filter(Boolean);
            const parsedBaseValues: Record<string, number> = {};
            Object.entries(baseValues).forEach(([k, v]) => {
                const n = parseFloat(v.replace(',', '.'));
                if (!isNaN(n)) parsedBaseValues[k] = n;
            });

            if (editingId) {
                await updateAvaliacaoDevice(editingId, {
                    brand: form.brand.trim(),
                    model: form.model.trim(),
                    storageOptions,
                    colorOptions,
                    baseValues: parsedBaseValues,
                });
                showToast('Dispositivo atualizado!', 'success');
            } else {
                await addAvaliacaoDevice({
                    brand: form.brand.trim(),
                    model: form.model.trim(),
                    storageOptions,
                    colorOptions,
                    baseValues: parsedBaseValues,
                    isActive: true,
                    displayOrder: devices.length,
                });
                showToast('Dispositivo adicionado!', 'success');
            }
            resetForm();
            onRefresh();
        } catch (e: any) {
            showToast(e.message || 'Erro ao salvar.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este dispositivo?')) return;
        try {
            await deleteAvaliacaoDevice(id);
            showToast('Dispositivo removido.', 'success');
            onRefresh();
        } catch (e: any) {
            showToast(e.message || 'Erro ao excluir.', 'error');
        }
    };

    const handleToggleActive = async (d: AvaliacaoDevice) => {
        try {
            await updateAvaliacaoDevice(d.id, { isActive: !d.isActive });
            onRefresh();
        } catch (e: any) {
            showToast(e.message || 'Erro.', 'error');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">{devices.length} dispositivo(s) cadastrado(s)</p>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                    <Plus size={16} /> Adicionar Dispositivo
                </button>
            </div>

            {showForm && (
                <SectionCard title={editingId ? 'Editar Dispositivo' : 'Novo Dispositivo'}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Marca *</label>
                                <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                                    placeholder="Ex: Samsung" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Modelo *</label>
                                <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                                    placeholder="Ex: Galaxy S24" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Armazenamentos <span className="font-normal text-gray-400">(separados por vírgula)</span></label>
                                <input value={form.storagesRaw} onChange={e => setForm(f => ({ ...f, storagesRaw: e.target.value }))}
                                    placeholder="Ex: 128GB, 256GB" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Cores <span className="font-normal text-gray-400">(separadas por vírgula)</span></label>
                                <input value={form.colorsRaw} onChange={e => setForm(f => ({ ...f, colorsRaw: e.target.value }))}
                                    placeholder="Ex: Preto, Branco, Azul" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                            </div>
                        </div>

                        {variants.length > 0 && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-2">Valor Base por Variante (R$)</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {variants.map(v => (
                                        <div key={v.key} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                                            <span className="text-xs text-gray-600 flex-1 truncate">{v.label}</span>
                                            <input
                                                value={baseValues[v.key] ?? ''}
                                                onChange={e => setBaseValues(bv => ({ ...bv, [v.key]: e.target.value }))}
                                                placeholder="0"
                                                className="w-20 text-right border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
                                <Check size={15} /> {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                            <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </SectionCard>
            )}

            {devices.length === 0 && !showForm && (
                <div className="text-center py-16 text-gray-400">
                    <Smartphone size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Nenhum dispositivo cadastrado</p>
                    <p className="text-sm mt-1">Adicione os modelos elegíveis para trade-in</p>
                </div>
            )}

            <div className="space-y-3">
                {devices.map(d => (
                    <div key={d.id} className={`bg-white rounded-2xl border transition-all ${d.isActive ? 'border-gray-100 shadow-sm' : 'border-gray-100 opacity-60'}`}>
                        <div className="flex items-center gap-4 px-5 py-4">
                            <div className="p-2 bg-violet-50 rounded-xl">
                                <Smartphone size={20} className="text-violet-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-800 text-sm">{d.brand} {d.model}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {d.storageOptions.length > 0 && <span>{d.storageOptions.join(', ')}</span>}
                                    {d.colorOptions.length > 0 && <span className="ml-2">· {d.colorOptions.join(', ')}</span>}
                                </p>
                                {Object.keys(d.baseValues).length > 0 && (
                                    <p className="text-xs text-violet-600 font-medium mt-1">
                                        {Object.entries(d.baseValues).slice(0, 2).map(([k, v]) => `${k.replace('__', '/')} → ${formatCurrency(v)}`).join(' · ')}
                                        {Object.keys(d.baseValues).length > 2 && ` +${Object.keys(d.baseValues).length - 2} variantes`}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <Toggle value={d.isActive} onChange={() => handleToggleActive(d)} />
                                <button onClick={() => loadForEdit(d)} className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-colors">
                                    <Edit3 size={16} />
                                </button>
                                <button onClick={() => handleDelete(d.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── ABA: Condições ────────────────────────────────────────────
const ConditionsTab: React.FC<{ conditions: AvaliacaoCondition[]; onRefresh: () => void }> = ({ conditions, onRefresh }) => {
    const { showToast } = useToast();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ label: '', description: '', icon: '📱', deductionType: 'percentage' as 'percentage' | 'fixed', deductionValue: '' });

    const resetForm = () => { setForm({ label: '', description: '', icon: '📱', deductionType: 'percentage', deductionValue: '' }); setEditingId(null); setShowForm(false); };

    const loadForEdit = (c: AvaliacaoCondition) => {
        setForm({ label: c.label, description: c.description || '', icon: c.icon || '📱', deductionType: c.deductionType, deductionValue: String(c.deductionValue) });
        setEditingId(c.id); setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.label.trim()) { showToast('Nome da condição é obrigatório.', 'error'); return; }
        setSaving(true);
        try {
            const payload = {
                label: form.label.trim(),
                description: form.description.trim() || undefined,
                icon: form.icon,
                deductionType: form.deductionType,
                deductionValue: parseFloat(form.deductionValue.replace(',', '.')) || 0,
                displayOrder: editingId ? (conditions.find(c => c.id === editingId)?.displayOrder ?? 0) : conditions.length,
                isActive: true,
            };
            if (editingId) {
                await updateAvaliacaoCondition(editingId, payload);
                showToast('Condição atualizada!', 'success');
            } else {
                await addAvaliacaoCondition(payload);
                showToast('Condição adicionada!', 'success');
            }
            resetForm(); onRefresh();
        } catch (e: any) {
            showToast(e.message || 'Erro.', 'error');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir esta condição?')) return;
        try { await deleteAvaliacaoCondition(id); showToast('Condição removida.', 'success'); onRefresh(); }
        catch (e: any) { showToast(e.message || 'Erro.', 'error'); }
    };

    const handleToggle = async (c: AvaliacaoCondition) => {
        try { await updateAvaliacaoCondition(c.id, { isActive: !c.isActive }); onRefresh(); }
        catch (e: any) { showToast(e.message || 'Erro.', 'error'); }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">{conditions.length} condição(ões) configurada(s)</p>
                <button onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors">
                    <Plus size={16} /> Adicionar Condição
                </button>
            </div>

            {showForm && (
                <SectionCard title={editingId ? 'Editar Condição' : 'Nova Condição'}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nome *</label>
                                <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                                    placeholder="Ex: Perfeito Estado" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Ícone</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {CONDITION_ICONS.map(ic => (
                                        <button key={ic} type="button" onClick={() => setForm(f => ({ ...f, icon: ic }))}
                                            className={`text-lg w-9 h-9 rounded-lg flex items-center justify-center transition-all ${form.icon === ic ? 'bg-violet-100 ring-2 ring-violet-500' : 'bg-gray-50 hover:bg-gray-100'}`}>
                                            {ic}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Descrição <span className="font-normal text-gray-400">(opcional)</span></label>
                            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Ex: Aparelho sem nenhum defeito ou arranhão" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tipo de Dedução</label>
                                <select value={form.deductionType} onChange={e => setForm(f => ({ ...f, deductionType: e.target.value as any }))}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
                                    <option value="percentage">Percentual (%)</option>
                                    <option value="fixed">Valor Fixo (R$)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                    {form.deductionType === 'percentage' ? 'Desconto (%)' : 'Desconto (R$)'}
                                </label>
                                <input value={form.deductionValue} onChange={e => setForm(f => ({ ...f, deductionValue: e.target.value }))}
                                    placeholder="0" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                            </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                                <Check size={15} /> {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                            <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-500 rounded-xl border border-gray-200 hover:bg-gray-50">Cancelar</button>
                        </div>
                    </div>
                </SectionCard>
            )}

            {conditions.length === 0 && !showForm && (
                <div className="text-center py-16 text-gray-400">
                    <Sliders size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Nenhuma condição configurada</p>
                    <p className="text-sm mt-1">Ex: Perfeito Estado (0%), Bom (-10%), Regular (-25%)</p>
                </div>
            )}

            <div className="space-y-2">
                {conditions.map(c => (
                    <div key={c.id} className={`bg-white rounded-2xl border px-5 py-4 flex items-center gap-4 ${c.isActive ? 'border-gray-100 shadow-sm' : 'border-gray-100 opacity-60'}`}>
                        <span className="text-2xl">{c.icon}</span>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 text-sm">{c.label}</p>
                            {c.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{c.description}</p>}
                        </div>
                        <DeductionBadge type={c.deductionType} value={c.deductionValue} />
                        <Toggle value={c.isActive} onChange={() => handleToggle(c)} />
                        <button onClick={() => loadForEdit(c)} className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-colors"><Edit3 size={16} /></button>
                        <button onClick={() => handleDelete(c.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── ABA: Defeitos / Peças ─────────────────────────────────────
const PartsTab: React.FC<{ parts: AvaliacaoPart[]; onRefresh: () => void }> = ({ parts, onRefresh }) => {
    const { showToast } = useToast();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ label: '', deductionType: 'fixed' as 'percentage' | 'fixed', deductionValue: '', requiresPhoto: false, requiresNote: false });

    const resetForm = () => { setForm({ label: '', deductionType: 'fixed', deductionValue: '', requiresPhoto: false, requiresNote: false }); setEditingId(null); setShowForm(false); };

    const loadForEdit = (p: AvaliacaoPart) => {
        setForm({ label: p.label, deductionType: p.deductionType, deductionValue: String(p.deductionValue), requiresPhoto: p.requiresPhoto ?? false, requiresNote: p.requiresNote ?? false });
        setEditingId(p.id); setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.label.trim()) { showToast('Descrição do defeito é obrigatória.', 'error'); return; }
        setSaving(true);
        try {
            const payload = {
                label: form.label.trim(),
                deductionType: form.deductionType,
                deductionValue: parseFloat(form.deductionValue.replace(',', '.')) || 0,
                requiresPhoto: form.requiresPhoto,
                requiresNote: form.requiresNote,
                displayOrder: editingId ? (parts.find(p => p.id === editingId)?.displayOrder ?? 0) : parts.length,
                isActive: true,
            };
            if (editingId) { await updateAvaliacaoPart(editingId, payload); showToast('Defeito atualizado!', 'success'); }
            else { await addAvaliacaoPart(payload); showToast('Defeito adicionado!', 'success'); }
            resetForm(); onRefresh();
        } catch (e: any) { showToast(e.message || 'Erro.', 'error'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este defeito?')) return;
        try { await deleteAvaliacaoPart(id); showToast('Defeito removido.', 'success'); onRefresh(); }
        catch (e: any) { showToast(e.message || 'Erro.', 'error'); }
    };

    const handleToggle = async (p: AvaliacaoPart) => {
        try { await updateAvaliacaoPart(p.id, { isActive: !p.isActive }); onRefresh(); }
        catch (e: any) { showToast(e.message || 'Erro.', 'error'); }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">{parts.length} defeito(s) / peça(s) configurada(s)</p>
                <button onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors">
                    <Plus size={16} /> Adicionar Defeito
                </button>
            </div>

            {showForm && (
                <SectionCard title={editingId ? 'Editar Defeito' : 'Novo Defeito'}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Descrição *</label>
                            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                                placeholder="Ex: Tela trincada, Bateria abaixo de 80%..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tipo de Dedução</label>
                                <select value={form.deductionType} onChange={e => setForm(f => ({ ...f, deductionType: e.target.value as any }))}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
                                    <option value="fixed">Valor Fixo (R$)</option>
                                    <option value="percentage">Percentual (%)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{form.deductionType === 'percentage' ? 'Desconto (%)' : 'Desconto (R$)'}</label>
                                <input value={form.deductionValue} onChange={e => setForm(f => ({ ...f, deductionValue: e.target.value }))}
                                    placeholder="0" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                            </div>
                        </div>
                        <div className="flex gap-6">
                            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                                <input type="checkbox" checked={form.requiresPhoto} onChange={e => setForm(f => ({ ...f, requiresPhoto: e.target.checked }))} className="rounded text-violet-600" />
                                Requer foto
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                                <input type="checkbox" checked={form.requiresNote} onChange={e => setForm(f => ({ ...f, requiresNote: e.target.checked }))} className="rounded text-violet-600" />
                                Requer observação
                            </label>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                                <Check size={15} /> {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                            <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-500 rounded-xl border border-gray-200 hover:bg-gray-50">Cancelar</button>
                        </div>
                    </div>
                </SectionCard>
            )}

            {parts.length === 0 && !showForm && (
                <div className="text-center py-16 text-gray-400">
                    <Zap size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Nenhum defeito cadastrado</p>
                    <p className="text-sm mt-1">Ex: Tela trincada (-R$150), Bateria fraca (-10%)</p>
                </div>
            )}

            <div className="space-y-2">
                {parts.map(p => (
                    <div key={p.id} className={`bg-white rounded-2xl border px-5 py-4 flex items-center gap-4 ${p.isActive ? 'border-gray-100 shadow-sm' : 'border-gray-100 opacity-60'}`}>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm">{p.label}</p>
                            <div className="flex gap-2 mt-1">
                                {p.requiresPhoto && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">📷 foto</span>}
                                {p.requiresNote && <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">📝 observação</span>}
                            </div>
                        </div>
                        <DeductionBadge type={p.deductionType} value={p.deductionValue} />
                        <Toggle value={p.isActive} onChange={() => handleToggle(p)} />
                        <button onClick={() => loadForEdit(p)} className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-colors"><Edit3 size={16} /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── ABA: Config / Link Público ────────────────────────────────
const ConfigTab: React.FC<{ settings: AvaliacaoSettings | null; onRefresh: () => void }> = ({ settings, onRefresh }) => {
    const { showToast } = useToast();
    const { user } = useUser();
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        isActive: true,
        welcomeMessage: '',
        whatsapp: '',
        collectContact: true,
        floorValue: '0',
        validityDays: '',
    });

    useEffect(() => {
        if (settings) {
            setForm({
                isActive: settings.isActive,
                welcomeMessage: settings.welcomeMessage || '',
                whatsapp: settings.whatsapp || '',
                collectContact: settings.collectContact,
                floorValue: String(settings.floorValue || 0),
                validityDays: settings.validityDays ? String(settings.validityDays) : '',
            });
        }
    }, [settings]);

    const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/#/avaliacao/${user?.companyId || 'sua-loja'}` : '';

    const handleCopyLink = () => {
        navigator.clipboard.writeText(publicUrl).then(() => showToast('Link copiado!', 'success'));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await upsertAvaliacaoSettings({
                id: settings?.id,
                companyId: settings?.companyId || '',
                isActive: form.isActive,
                welcomeMessage: form.welcomeMessage || undefined,
                whatsapp: form.whatsapp || undefined,
                collectContact: form.collectContact,
                floorValue: parseFloat(form.floorValue.replace(',', '.')) || 0,
                validityDays: form.validityDays ? parseInt(form.validityDays) : undefined,
            });
            showToast('Configurações salvas!', 'success');
            onRefresh();
        } catch (e: any) {
            showToast(e.message || 'Erro ao salvar.', 'error');
        } finally { setSaving(false); }
    };

    return (
        <div className="space-y-5">
            {/* Link Público */}
            <SectionCard title="Link Público de Avaliação" subtitle="Compartilhe este link com seus clientes">
                <div className="flex items-center gap-3 bg-violet-50 rounded-xl px-4 py-3">
                    <span className="text-sm text-violet-800 font-mono flex-1 truncate">{publicUrl}</span>
                    <button onClick={handleCopyLink} className="p-2 hover:bg-violet-100 rounded-lg transition-colors text-violet-600">
                        <Copy size={16} />
                    </button>
                    <a href={publicUrl} target="_blank" rel="noreferrer" className="p-2 hover:bg-violet-100 rounded-lg transition-colors text-violet-600">
                        <ExternalLink size={16} />
                    </a>
                </div>
                <div className="flex items-center justify-between mt-4">
                    <div>
                        <p className="text-sm font-semibold text-gray-700">Link Ativo</p>
                        <p className="text-xs text-gray-400">Quando desativado, o formulário público fica indisponível</p>
                    </div>
                    <Toggle value={form.isActive} onChange={v => setForm(f => ({ ...f, isActive: v }))} />
                </div>
            </SectionCard>

            {/* Mensagem e WhatsApp */}
            <SectionCard title="Personalização">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mensagem de Boas-vindas</label>
                        <textarea value={form.welcomeMessage} onChange={e => setForm(f => ({ ...f, welcomeMessage: e.target.value }))}
                            rows={3} placeholder="Ex: Avalie seu aparelho e troque por um novo com desconto!"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">WhatsApp para Contato <span className="font-normal text-gray-400">(com DDD, sem +55)</span></label>
                        <input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                            placeholder="Ex: 11999999999" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                    </div>
                </div>
            </SectionCard>

            {/* Regras */}
            <SectionCard title="Regras de Avaliação">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-gray-700">Solicitar dados do cliente</p>
                            <p className="text-xs text-gray-400">Nome e WhatsApp são pedidos antes de mostrar o resultado</p>
                        </div>
                        <Toggle value={form.collectContact} onChange={v => setForm(f => ({ ...f, collectContact: v }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Valor Mínimo Garantido (R$)</label>
                            <input value={form.floorValue} onChange={e => setForm(f => ({ ...f, floorValue: e.target.value }))}
                                placeholder="0" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                            <p className="text-xs text-gray-400 mt-1">A avaliação nunca ficará abaixo deste valor</p>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Validade da Avaliação <span className="font-normal text-gray-400">(dias)</span></label>
                            <input value={form.validityDays} onChange={e => setForm(f => ({ ...f, validityDays: e.target.value }))}
                                placeholder="Ex: 7" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                        </div>
                    </div>
                </div>
            </SectionCard>

            <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50">
                    <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Configurações'}
                </button>
            </div>
        </div>
    );
};

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────
const AvaliacaoConfig: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('dispositivos');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [devices, setDevices] = useState<AvaliacaoDevice[]>([]);
    const [conditions, setConditions] = useState<AvaliacaoCondition[]>([]);
    const [parts, setParts] = useState<AvaliacaoPart[]>([]);
    const [settings, setSettings] = useState<AvaliacaoSettings | null>(null);

    const fetchAll = useCallback(async () => {
        try {
            const [devs, conds, pts, stgs] = await Promise.all([
                getAvaliacaoDevices(),
                getAvaliacaoConditions(),
                getAvaliacaoParts(),
                getAvaliacaoSettings(),
            ]);
            setDevices(devs);
            setConditions(conds);
            setParts(pts);
            setSettings(stgs);
            setError(null);
        } catch (e: any) {
            setError('Erro ao carregar configurações. Execute o SQL de criação das tabelas no Supabase primeiro.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black text-gray-900">Configurações de Avaliação</h1>
                <p className="text-gray-500 text-sm mt-1">Configure dispositivos, condições e regras para o seu formulário de trade-in</p>
            </div>

            {error && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-amber-800">
                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-sm">Tabelas não encontradas</p>
                        <p className="text-sm mt-0.5">{error}</p>
                        <p className="text-xs mt-2 text-amber-600">Execute o arquivo <code className="bg-amber-100 px-1 rounded">sql/create_avaliacao_module.sql</code> no painel do Supabase.</p>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === tab.key
                            ? 'bg-white text-violet-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {!error && (
                <>
                    {activeTab === 'dispositivos' && <DevicesTab devices={devices} onRefresh={fetchAll} />}
                    {activeTab === 'condicoes' && <ConditionsTab conditions={conditions} onRefresh={fetchAll} />}
                    {activeTab === 'defeitos' && <PartsTab parts={parts} onRefresh={fetchAll} />}
                    {activeTab === 'config' && <ConfigTab settings={settings} onRefresh={fetchAll} />}
                </>
            )}
        </div>
    );
};

export default AvaliacaoConfig;
