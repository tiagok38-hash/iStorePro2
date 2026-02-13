import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Upload, Loader2, Package, ImageIcon, Trash2, CreditCard } from 'lucide-react';
import { addCatalogItem, updateCatalogItem, getPaymentMethods, getCatalogSections } from '../../services/mockApi.ts';
import { CatalogItem, Product, PaymentMethodParameter } from '../../types.ts';
import { useToast } from '../../contexts/ToastContext.tsx';

const CONDITIONS = ['Novo', 'Seminovo', 'Vitrine'];
const MAX_IMAGES = 5;
const MAX_WIDTH = 800;
const WEBP_QUALITY = 0.75;

// ===== Image Compression =====
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            let w = img.width;
            let h = img.height;
            if (w > MAX_WIDTH) { h = Math.round(h * MAX_WIDTH / w); w = MAX_WIDTH; }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject('Canvas not supported'); return; }
            ctx.drawImage(img, 0, 0, w, h);
            // Try WebP first, fallback to JPEG
            let dataUrl = canvas.toDataURL('image/webp', WEBP_QUALITY);
            if (!dataUrl.startsWith('data:image/webp')) {
                dataUrl = canvas.toDataURL('image/jpeg', WEBP_QUALITY);
            }
            resolve(dataUrl);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject('Error loading image'); };
        img.src = url;
    });
};

interface Props {
    item: CatalogItem | null;
    products: Product[];
    onClose: () => void;
    onSaved: () => void;
}

const CatalogItemModal: React.FC<Props> = ({ item, products, onClose, onSaved }) => {
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showProductSearch, setShowProductSearch] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const [sections, setSections] = useState<{ id: string; name: string; emoji: string; displayOrder: number }[]>([]);
    const [cardMethods, setCardMethods] = useState<PaymentMethodParameter[]>([]);
    const [selectedCardId, setSelectedCardId] = useState('');

    const [form, setForm] = useState({
        productId: item?.productId || '',
        productName: item?.productName || '',
        productBrand: item?.productBrand || '',
        productCategory: item?.productCategory || '',
        costPrice: item?.costPrice || 0,
        salePrice: item?.salePrice || 0,
        cardPrice: item?.cardPrice || 0,
        installments: item?.installments || 1,
        section: item?.section || 'Destaques',
        condition: item?.condition || 'Novo',
        batteryHealth: item?.batteryHealth || undefined,
        imageUrls: item?.imageUrls || (item?.imageUrl ? [item.imageUrl] : []),
        displayOrder: item?.displayOrder || 0,
        isActive: item?.isActive ?? true,
        description: item?.description || '',
    });

    useEffect(() => {
        const load = async () => {
            try {
                const [secs, methods] = await Promise.all([getCatalogSections(), getPaymentMethods()]);
                setSections(secs);
                const cards = (methods as PaymentMethodParameter[]).filter(m => m.type === 'card' && m.active && m.config);
                setCardMethods(cards);
            } catch (e) { console.error(e); }
        };
        load();
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowProductSearch(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Recalculate card price when card or installments change
    useEffect(() => {
        if (!selectedCardId || !form.salePrice) return;
        const card = cardMethods.find(c => c.id === selectedCardId);
        if (!card?.config?.creditWithInterestRates) return;
        const rateEntry = card.config.creditWithInterestRates.find(r => r.installments === form.installments);
        if (rateEntry) {
            const totalWithInterest = form.salePrice * (1 + rateEntry.rate / 100);
            setForm(prev => ({ ...prev, cardPrice: Math.round(totalWithInterest * 100) / 100 }));
        } else {
            setForm(prev => ({ ...prev, cardPrice: form.salePrice }));
        }
    }, [selectedCardId, form.installments, form.salePrice]);

    const filteredProducts = products.filter(p =>
        p.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10);

    const handleSelectProduct = (product: Product) => {
        setForm(prev => ({
            ...prev,
            productId: product.id,
            productName: product.model,
            productBrand: product.brand,
            productCategory: product.category,
            costPrice: product.costPrice || 0,
            salePrice: product.price || 0,
            cardPrice: product.price || 0,
            condition: product.condition || 'Novo',
            batteryHealth: product.batteryHealth || undefined,
            imageUrls: product.photos?.length ? [...product.photos] : prev.imageUrls,
        }));
        setShowProductSearch(false);
        setSearchTerm('');
    };

    const handleSave = async () => {
        if (!form.productName) {
            showToast('Selecione um produto', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const payload = { ...form, imageUrl: form.imageUrls[0] || '' };
            if (item) {
                await updateCatalogItem(item.id, payload);
                showToast('Item atualizado com sucesso!', 'success');
            } else {
                await addCatalogItem(payload);
                showToast('Item adicionado ao catálogo!', 'success');
            }
            onSaved();
        } catch (error) {
            showToast('Erro ao salvar item', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        const remaining = MAX_IMAGES - form.imageUrls.length;
        if (remaining <= 0) {
            showToast(`Máximo de ${MAX_IMAGES} imagens`, 'error');
            return;
        }
        const toProcess = (Array.from(files) as File[]).slice(0, remaining);
        setIsLoading(true);
        try {
            const compressed = await Promise.all(toProcess.map(f => compressImage(f)));
            setForm(prev => ({ ...prev, imageUrls: [...prev.imageUrls, ...compressed] }));
            showToast(`${compressed.length} imagem(ns) comprimida(s) e adicionada(s)`, 'success');
        } catch {
            showToast('Erro ao processar imagens', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const removeImage = (index: number) => {
        setForm(prev => ({ ...prev, imageUrls: prev.imageUrls.filter((_, i) => i !== index) }));
    };

    const sectionOptions = sections.length > 0 ? sections : [
        { id: '1', name: 'Destaques', emoji: '⭐', displayOrder: 0 },
        { id: '2', name: 'iPhones Seminovos', emoji: '📱', displayOrder: 1 },
        { id: '3', name: 'iPhones Lacrados', emoji: '📦', displayOrder: 2 },
        { id: '4', name: 'Acessórios Apple', emoji: '🎧', displayOrder: 3 },
        { id: '5', name: 'Promoções', emoji: '🔥', displayOrder: 4 },
        { id: '6', name: 'Outros', emoji: '📋', displayOrder: 5 },
    ];

    // Available installments from selected card
    const availableInstallments = (() => {
        if (!selectedCardId) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        const card = cardMethods.find(c => c.id === selectedCardId);
        if (!card?.config?.creditWithInterestRates?.length) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        return card.config.creditWithInterestRates.map(r => r.installments).sort((a, b) => a - b);
    })();

    // Current interest rate
    const currentRate = (() => {
        if (!selectedCardId) return 0;
        const card = cardMethods.find(c => c.id === selectedCardId);
        return card?.config?.creditWithInterestRates?.find(r => r.installments === form.installments)?.rate || 0;
    })();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in-up z-10">
                {/* Header */}
                <div className="sticky top-0 bg-white/90 backdrop-blur-sm px-6 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-3xl z-10">
                    <h2 className="text-lg font-bold text-primary">{item ? 'Editar Item' : 'Adicionar ao Catálogo'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Product Search */}
                    {!item && (
                        <div ref={searchRef} className="relative">
                            <label className="block text-sm font-semibold text-primary mb-1.5">Produto do Estoque *</label>
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                <input
                                    type="text"
                                    placeholder="Buscar produto por nome ou marca..."
                                    value={form.productName || searchTerm}
                                    onChange={e => { setSearchTerm(e.target.value); setShowProductSearch(true); if (form.productId) setForm(prev => ({ ...prev, productId: '', productName: '' })); }}
                                    onFocus={() => setShowProductSearch(true)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                                />
                            </div>
                            {showProductSearch && searchTerm && (
                                <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-2xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto">
                                    {filteredProducts.length === 0 ? (
                                        <p className="p-4 text-sm text-secondary text-center">Nenhum produto encontrado</p>
                                    ) : (
                                        filteredProducts.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => handleSelectProduct(p)}
                                                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                    {p.photos?.[0] ? (
                                                        <img src={p.photos[0]} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Package size={16} className="text-gray-300" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-primary truncate">{p.model}</p>
                                                    <p className="text-xs text-secondary">{p.brand} · {p.condition} · Estoque: {p.stock}</p>
                                                </div>
                                                <span className="text-sm font-bold text-emerald-600">R$ {p.price?.toLocaleString()}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Descrição (Opcional)</label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Adicione detalhes sobre o produto..."
                            rows={3}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                    </div>

                    {/* Multi-Image Upload */}
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">
                            Imagens do Produto <span className="text-muted font-normal">({form.imageUrls.length}/{MAX_IMAGES})</span>
                        </label>
                        <div className="flex flex-wrap gap-3">
                            {form.imageUrls.map((url, i) => (
                                <div key={i} className="relative w-20 h-20 rounded-xl bg-gray-50 border-2 border-gray-200 overflow-hidden group">
                                    <img src={url} alt="" className="w-full h-full object-contain" />
                                    <button
                                        onClick={() => removeImage(i)}
                                        className="absolute top-0.5 right-0.5 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={10} />
                                    </button>
                                    {i === 0 && (
                                        <span className="absolute bottom-0 left-0 right-0 bg-emerald-500 text-white text-[8px] text-center py-0.5 font-bold">
                                            CAPA
                                        </span>
                                    )}
                                </div>
                            ))}
                            {form.imageUrls.length < MAX_IMAGES && (
                                <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors">
                                    <Upload size={16} className="text-gray-400" />
                                    <span className="text-[9px] text-gray-400 mt-1">Upload</span>
                                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                                </label>
                            )}
                        </div>
                        <p className="text-[11px] text-muted mt-2">Até {MAX_IMAGES} imagens. Auto-comprimidas em WebP ~800px.</p>
                    </div>

                    {/* Section & Condition */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-primary mb-1.5">Seção</label>
                            <select
                                value={form.section}
                                onChange={e => setForm(prev => ({ ...prev, section: e.target.value }))}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                            >
                                {sectionOptions.map(s => <option key={s.id} value={s.name}>{s.emoji} {s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-primary mb-1.5">Condição</label>
                            <select
                                value={form.condition}
                                onChange={e => setForm(prev => ({ ...prev, condition: e.target.value }))}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                            >
                                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Battery Health */}
                    {form.condition === 'Seminovo' && (
                        <div className="animate-fade-in">
                            <label className="block text-sm font-semibold text-primary mb-1.5">Saúde da Bateria (%)</label>
                            <input
                                type="number" min={0} max={100}
                                value={form.batteryHealth || ''}
                                onChange={e => setForm(prev => ({ ...prev, batteryHealth: parseInt(e.target.value) || undefined }))}
                                placeholder="Ex: 86"
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                            />
                        </div>
                    )}

                    {/* Prices */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm font-semibold text-primary mb-1.5">Custo</label>
                            <input
                                type="number" step="0.01"
                                value={form.costPrice || ''}
                                onChange={e => setForm(prev => ({ ...prev, costPrice: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-primary mb-1.5">À Vista</label>
                            <input
                                type="number" step="0.01"
                                value={form.salePrice || ''}
                                onChange={e => setForm(prev => ({ ...prev, salePrice: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-primary mb-1.5">Cartão</label>
                            <input
                                type="number" step="0.01"
                                value={form.cardPrice || ''}
                                onChange={e => setForm(prev => ({ ...prev, cardPrice: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    {/* Card Selection & Installments */}
                    <div className="glass-card p-4 space-y-3 bg-blue-50/50 border border-blue-100">
                        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                            <CreditCard size={16} className="text-blue-500" />
                            Parcelamento com Juros
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-secondary mb-1">Cartão / Maquininha</label>
                                <select
                                    value={selectedCardId}
                                    onChange={e => setSelectedCardId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                                >
                                    <option value="">Manual (sem calcular)</option>
                                    {cardMethods.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-secondary mb-1">Qtd. Parcelas</label>
                                <select
                                    value={form.installments}
                                    onChange={e => setForm(prev => ({ ...prev, installments: parseInt(e.target.value) || 1 }))}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                                >
                                    {availableInstallments.map(n => (
                                        <option key={n} value={n}>{n}x</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {selectedCardId && currentRate > 0 && (
                            <div className="text-xs text-blue-700 bg-blue-100 rounded-lg px-3 py-2 animate-fade-in">
                                Taxa: <span className="font-bold">{currentRate.toFixed(2)}%</span> ·
                                Parcela: <span className="font-bold">R$ {(form.cardPrice / form.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> ·
                                Total Cartão: <span className="font-bold">R$ {form.cardPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        )}
                    </div>

                    {/* Display Order */}
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Ordem de Exibição</label>
                        <input
                            type="number" min={0}
                            value={form.displayOrder}
                            onChange={e => setForm(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 0 }))}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm px-6 py-4 border-t border-gray-100 flex justify-end gap-3 rounded-b-3xl">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-secondary hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading || !form.productName}
                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg disabled:opacity-50 transition-all"
                    >
                        {isLoading && <Loader2 size={16} className="animate-spin" />}
                        {item ? 'Salvar Alterações' : 'Adicionar ao Catálogo'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CatalogItemModal;
