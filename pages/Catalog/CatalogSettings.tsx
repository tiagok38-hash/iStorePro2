import React, { useState, useEffect, useRef } from 'react';
import { Save, Loader2, Phone, Store, Globe, Layers, Plus, Pencil, Trash2, X, Check, GripVertical, ChevronDown, ExternalLink } from 'lucide-react';
import { getCompanyInfo, updateCompanyInfo, getCatalogSections, addCatalogSection, updateCatalogSection, deleteCatalogSection } from '../../services/mockApi.ts';
import { CompanyInfo } from '../../types.ts';
import { useToast } from '../../contexts/ToastContext.tsx';

interface Section {
    id: string;
    name: string;
    emoji: string;
    displayOrder: number;
    sortOrder?: string;
}

const EMOJI_OPTIONS = ['⭐', '📱', '📦', '🎧', '🔥', '📋', '💎', '🎁', '🛒', '💰', '🏷️', '✨', '📲', '⚡', '🛡️', '🎯'];
const SORT_OPTIONS = [
    { value: 'newest', label: 'Mais Recentes' },
    { value: 'oldest', label: 'Mais Antigos' },
    { value: 'lowest_price', label: 'Menor Preço' },
    { value: 'highest_price', label: 'Maior Preço' },
];

const CatalogSettings: React.FC = () => {
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [whatsapp, setWhatsapp] = useState('');
    const [storeName, setStoreName] = useState('');
    const [sections, setSections] = useState<Section[]>([]);
    const [editingSection, setEditingSection] = useState<Section | null>(null);
    const [newSectionName, setNewSectionName] = useState('');
    const [newSectionEmoji, setNewSectionEmoji] = useState('📋');
    const [newSectionSort, setNewSectionSort] = useState('newest');
    const [showNewSection, setShowNewSection] = useState(false);

    // DnD State
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

    const catalogUrl = `${window.location.origin}${window.location.pathname}#/catalogo/loja`;

    useEffect(() => {
        const load = async () => {
            try {
                const [info, secs] = await Promise.all([getCompanyInfo(), getCatalogSections()]);
                if (info) {
                    setWhatsapp(info.whatsapp || '');
                    setStoreName(info.name || '');
                }
                setSections(secs);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateCompanyInfo({ whatsapp, name: storeName } as any);
            showToast('Configurações salvas!', 'success');
        } catch {
            showToast('Erro ao salvar', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddSection = async () => {
        if (!newSectionName.trim()) return;
        try {
            const added = await addCatalogSection({
                name: newSectionName.trim(),
                emoji: newSectionEmoji,
                displayOrder: sections.length,
                sortOrder: newSectionSort,
            });
            setSections(prev => [...prev, added]);
            setNewSectionName('');
            setNewSectionEmoji('📋');
            setNewSectionSort('newest');
            setShowNewSection(false);
            showToast('Seção criada!', 'success');
        } catch {
            showToast('Erro ao criar seção', 'error');
        }
    };

    const handleUpdateSection = async (section: Section) => {
        try {
            await updateCatalogSection(section.id, {
                name: section.name,
                emoji: section.emoji,
                sortOrder: section.sortOrder || 'newest'
            });
            setSections(prev => prev.map(s => s.id === section.id ? section : s));
            setEditingSection(null);
            showToast('Seção atualizada!', 'success');
        } catch {
            showToast('Erro ao atualizar seção', 'error');
        }
    };

    const handleDeleteSection = async (id: string) => {
        if (!confirm('Remover esta seção? Os produtos desta seção ficarão sem categoria.')) return;
        try {
            await deleteCatalogSection(id);
            setSections(prev => prev.filter(s => s.id !== id));
            showToast('Seção removida!', 'success');
        } catch {
            showToast('Erro ao remover seção', 'error');
        }
    };

    // DnD Handlers
    const handleDragStart = (index: number) => {
        setDraggedItemIndex(index);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Allows dropping
    };

    const handleDrop = async (targetIndex: number) => {
        if (draggedItemIndex === null || draggedItemIndex === targetIndex) return;

        const updatedSections = [...sections];
        const [draggedItem] = updatedSections.splice(draggedItemIndex, 1);
        updatedSections.splice(targetIndex, 0, draggedItem);

        // Update displayOrder locally and optimistic GUI update
        const reordered = updatedSections.map((s, i) => ({ ...s, displayOrder: i }));
        setSections(reordered);
        setDraggedItemIndex(null);

        // Save new order to backend
        try {
            // Update all sections with new order
            await Promise.all(reordered.map((s) => updateCatalogSection(s.id, { displayOrder: s.displayOrder })));
            showToast('Ordem das seções atualizada', 'success');
        } catch (error) {
            console.error(error);
            showToast('Erro ao salvar nova ordem', 'error');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-24 px-4 sm:px-6 lg:px-8">
            <div>
                <h1 className="text-2xl font-bold text-primary">Configurações do Catálogo</h1>
                <p className="text-secondary text-sm mt-1">Ajuste as informações que aparecem na sua vitrine pública</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Left Column: Sections (Full layout with DnD) */}
                <div className="glass-card p-6 space-y-5 lg:col-span-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary font-semibold">
                            <Layers size={18} className="text-emerald-500" />
                            Seções do Catálogo
                        </div>
                        <button
                            onClick={() => setShowNewSection(!showNewSection)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors"
                        >
                            <Plus size={14} /> Nova Seção
                        </button>
                    </div>

                    <p className="text-sm text-secondary leading-relaxed">
                        Arraste os itens pelos pontinhos <span className="inline-block align-middle bg-gray-100 rounded px-1"><GripVertical size={10} className="inline" /></span> para reordenar.
                    </p>

                    {showNewSection && (
                        <div className="flex items-center gap-2 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 animate-fade-in shadow-sm flex-wrap">
                            <div className="relative">
                                <select
                                    value={newSectionEmoji}
                                    onChange={e => setNewSectionEmoji(e.target.value)}
                                    className="w-[70px] pl-3 pr-2 py-2 border border-gray-200 rounded-lg text-center text-xl bg-white cursor-pointer focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                                >
                                    {EMOJI_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                                </select>
                            </div>
                            <input
                                type="text"
                                placeholder="Nome da seção..."
                                value={newSectionName}
                                onChange={e => setNewSectionName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddSection()}
                                className="flex-1 min-w-[150px] px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                                autoFocus
                            />
                            <div className="relative">
                                <select
                                    value={newSectionSort}
                                    onChange={e => setNewSectionSort(e.target.value)}
                                    className="w-[140px] px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white cursor-pointer focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                                >
                                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={handleAddSection} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm hover:shadow">
                                    <Check size={14} />
                                </button>
                                <button onClick={() => setShowNewSection(false)} className="p-2 text-gray-400 hover:text-gray-600 bg-white border border-gray-100 rounded-lg">
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Sections List */}
                    <div className="space-y-2">
                        {sections.map((section, index) => (
                            <div
                                key={section.id}
                                draggable={!editingSection}
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={handleDragOver}
                                onDrop={() => handleDrop(index)}
                                className={`flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl group hover:border-emerald-200 transition-all ${draggedItemIndex === index ? 'opacity-50 border-dashed border-emerald-400 bg-emerald-50' : ''}`}
                            >
                                <div
                                    className="cursor-models cursor-pointer p-2 text-gray-300 hover:text-emerald-500 transition-colors bg-gray-50 rounded-lg hover:bg-emerald-50"
                                    title="Segure e arraste para reordenar"
                                >
                                    <GripVertical size={16} />
                                </div>

                                {editingSection?.id === section.id ? (
                                    <>
                                        <div className="relative">
                                            <select
                                                value={editingSection.emoji}
                                                onChange={e => setEditingSection({ ...editingSection, emoji: e.target.value })}
                                                className="w-[70px] pl-3 pr-2 py-1.5 border border-gray-200 rounded-lg text-center text-xl bg-white cursor-pointer focus:ring-2 focus:ring-emerald-500/20"
                                            >
                                                {EMOJI_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                                            </select>
                                        </div>
                                        <input
                                            type="text"
                                            value={editingSection.name}
                                            onChange={e => setEditingSection({ ...editingSection, name: e.target.value })}
                                            onKeyDown={e => e.key === 'Enter' && handleUpdateSection(editingSection)}
                                            className="flex-1 min-w-[150px] px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20"
                                            autoFocus
                                        />
                                        <div className="relative">
                                            <select
                                                value={editingSection.sortOrder || 'newest'}
                                                onChange={e => setEditingSection({ ...editingSection, sortOrder: e.target.value })}
                                                className="w-[140px] px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white cursor-pointer focus:ring-2 focus:ring-emerald-500/20"
                                            >
                                                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => handleUpdateSection(editingSection)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                                                <Check size={14} />
                                            </button>
                                            <button onClick={() => setEditingSection(null)} className="p-1.5 text-gray-400 hover:text-gray-600">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-xl flex-shrink-0 w-[40px] text-center">{section.emoji}</span>
                                        <span className="flex-1 text-sm font-medium text-primary select-none">{section.name}</span>
                                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setEditingSection({ ...section })} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                <Pencil size={13} />
                                            </button>
                                            <button onClick={() => handleDeleteSection(section.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                        {sections.length === 0 && (
                            <div className="text-center py-10 px-4 border-2 border-dashed border-gray-100 rounded-xl">
                                <Layers size={32} className="mx-auto text-gray-200 mb-2" />
                                <p className="text-sm text-secondary font-medium">Nenhuma seção criada</p>
                                <p className="text-xs text-muted">Clique em "Nova Seção" para começar</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Store Info (Grouped) */}
                <div className="glass-card p-6 space-y-6 self-start">
                    <div className="flex items-center gap-2 text-primary font-semibold border-b border-gray-100 pb-4 mb-2">
                        <Store size={18} className="text-emerald-500" />
                        Informações da Loja
                    </div>

                    <div className="space-y-5">
                        {/* Store Name */}
                        <div>
                            <label className="block text-xs font-semibold text-primary mb-1.5 uppercase tracking-wider">Nome da Loja</label>
                            <div className="relative">
                                <Store size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                <input
                                    type="text"
                                    value={storeName}
                                    onChange={e => setStoreName(e.target.value)}
                                    placeholder="Ex: iStore Pro"
                                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-gray-50/50 focus:bg-white"
                                />
                            </div>
                        </div>

                        {/* WhatsApp */}
                        <div>
                            <label className="block text-xs font-semibold text-primary mb-1.5 uppercase tracking-wider">WhatsApp Delivery</label>
                            <div className="relative">
                                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                <input
                                    type="text"
                                    value={whatsapp}
                                    onChange={e => setWhatsapp(e.target.value)}
                                    placeholder="5511999999999"
                                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-gray-50/50 focus:bg-white"
                                />
                            </div>
                            <p className="text-[10px] text-muted mt-1.5 ml-1">
                                Número que receberá os pedidos. Use o formato internacional (ex: 55 + DDD + Numero).
                            </p>
                        </div>

                        {/* Link */}
                        <div className="pt-2">
                            <label className="block text-xs font-semibold text-primary mb-1.5 uppercase tracking-wider">Link Público</label>
                            <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl group hover:border-emerald-200 transition-colors">
                                <Globe size={16} className="text-emerald-500 flex-shrink-0" />
                                <code className="text-xs text-secondary font-mono truncate flex-1 select-all hover:text-primary transition-colors cursor-text" title="Clique para selecionar">{catalogUrl}</code>
                                <a
                                    href={catalogUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex-shrink-0"
                                    title="Abrir vitrine"
                                >
                                    <ExternalLink size={14} />
                                </a>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="pt-4 mt-4">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-emerald-500/20 disabled:opacity-70 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                Salvar Configurações
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CatalogSettings;
