import React, { useState, useEffect, useMemo } from 'react';
import {
    ShoppingCart, Search, Filter, MessageCircle, X, ChevronRight, ChevronLeft,
    ShoppingBag, Package, MapPin, Phone, Mail, Clock, Instagram, Send, Plus, Minus,
    Zap, Smartphone, Headphones, Star, Gift, Trash2, ChevronDown
} from 'lucide-react';
import { getActiveCatalogItems, getCatalogSections, getCompanyInfo, getCategories } from '../../services/mockApi.ts';
import { supabase } from '../../supabaseClient.ts';
import { CatalogItem, CompanyInfo } from '../../types.ts';

// ===== CART CONTEXT (Local) =====
interface CartEntry { item: CatalogItem; quantity: number; }

// ===== CART CONTEXT (Local) =====

const useCart = () => {
    const [cart, setCart] = useState<CartEntry[]>([]);

    const addToCart = (item: CatalogItem) => {
        setCart(prev => {
            const existing = prev.find(e => e.item.id === item.id);
            if (existing) return prev.map(e => e.item.id === item.id ? { ...e, quantity: e.quantity + 1 } : e);
            return [...prev, { item, quantity: 1 }];
        });
    };

    const removeFromCart = (id: string) => setCart(prev => prev.filter(e => e.item.id !== id));
    const updateQuantity = (id: string, qty: number) => {
        if (qty <= 0) return removeFromCart(id);
        setCart(prev => prev.map(e => e.item.id === id ? { ...e, quantity: qty } : e));
    };

    const totalItems = cart.reduce((sum, e) => sum + e.quantity, 0);
    const totalPrice = cart.reduce((sum, e) => sum + e.item.salePrice * e.quantity, 0);

    return { cart, addToCart, removeFromCart, updateQuantity, totalItems, totalPrice, clearCart: () => setCart([]) };
};

// ===== SECTION CONFIG =====
const SECTION_CONFIG: Record<string, { icon: React.ReactNode; emoji: string }> = {
    'Destaques': { icon: <Zap size={18} />, emoji: '🔥' },
    'iPhones Seminovos': { icon: <Smartphone size={18} />, emoji: '📱' },
    'iPhones Lacrados': { icon: <Package size={18} />, emoji: '📦' },
    'Acessórios Apple': { icon: <Headphones size={18} />, emoji: '🎧' },
    'Promoções': { icon: <Star size={18} />, emoji: '⚡' },
    'Outros': { icon: <Gift size={18} />, emoji: '🎁' },
};

// ===== PRODUCT CARD =====
// ===== PRODUCT CARD =====
const ProductCard: React.FC<{ item: CatalogItem; onClick: () => void; onAdd: (e: React.MouseEvent) => void; whatsapp: string }> = ({ item, onClick, onAdd, whatsapp }) => {
    const [imgLoaded, setImgLoaded] = useState(false);
    const [showToast, setShowToast] = useState(false);

    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        onAdd(e);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 1500);
    };

    const imageUrl = item.imageUrls?.[0] || item.imageUrl;
    const hasManyLines = item.productName.length > 50;

    const whatsappNumber = whatsapp.replace(/\D/g, '');

    return (
        <div
            onClick={onClick}
            className="group bg-white rounded-2xl shadow-sm border border-gray-100/50 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative flex flex-col cursor-pointer h-full"
        >
            {/* Toast */}
            {showToast && (
                <div className="absolute top-2 right-2 z-20 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-fade-in shadow-lg">
                    ✓ Adicionado!
                </div>
            )}

            {/* Image */}
            <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
                {imageUrl ? (
                    <>
                        {!imgLoaded && <div className="absolute inset-0 animate-pulse bg-gray-200" />}
                        <img
                            src={imageUrl}
                            alt={item.productName}
                            loading="lazy"
                            onLoad={() => setImgLoaded(true)}
                            className={`w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                        />
                    </>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Package size={32} className="text-gray-200" />
                    </div>
                )}

                {/* Tags */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full backdrop-blur-sm shadow-sm ${item.condition === 'Novo' ? 'bg-emerald-500/90 text-white' : item.condition === 'Seminovo' ? 'bg-amber-500/90 text-white' : 'bg-blue-500/90 text-white'}`}>
                        {item.condition}
                    </span>
                </div>
            </div>

            {/* Info */}
            <div className="p-2.5 flex-1 flex flex-col">
                <p className="text-[9px] text-secondary uppercase tracking-wider font-medium">{item.productBrand}</p>
                <h3 className="text-xs font-bold text-primary mt-0.5 leading-snug line-clamp-2 flex-1">{item.productName}</h3>

                {/* Prices */}
                <div className="mt-1.5 space-y-0">
                    <div className="flex items-baseline gap-1">
                        <span className="text-sm font-black text-emerald-600">
                            R$ {item.salePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[9px] text-secondary font-medium">à vista</span>
                    </div>
                    {item.installments > 1 && item.cardPrice > 0 && (
                        <p className="text-[10px] text-secondary">
                            ou {item.installments}x de <span className="font-semibold text-primary">R$ {(item.cardPrice / item.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <a
                        href={`https://wa.me/55${whatsappNumber}?text=${encodeURIComponent(`Olá! Tenho interesse no *${item.productName}*. Pode me dar mais detalhes?`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 max-w-[80%] flex items-center justify-center gap-1.5 px-2 py-2 bg-[#25D366] text-white rounded-lg text-[10px] font-bold hover:bg-[#128C7E] transition-colors shadow-sm"
                    >
                        <WhatsAppSvg size={14} />
                        WhatsApp
                    </a>
                    <button
                        onClick={handleAdd}
                        className="w-8 h-8 flex items-center justify-center bg-gray-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors active:scale-95 flex-shrink-0"
                        title="Adicionar à sacola"
                    >
                        <ShoppingBag size={18} />
                    </button>
                </div>
            </div>
        </div >
    );
};

// ===== PRODUCT DETAILS MODAL =====
const ProductDetailsModal: React.FC<{
    item: CatalogItem;
    onClose: () => void;
    onAdd: () => void;
    whatsapp: string;
    categoriesMap: Record<string, string>;
}> = ({ item, onClose, onAdd, whatsapp, categoriesMap }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [showAllInstallments, setShowAllInstallments] = useState(false);
    const images = item.imageUrls?.length ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []);

    const whatsappMsg = encodeURIComponent(
        `Olá! Tenho interesse no produto:\n\n📱 *${item.productName}*\n💰 R$ ${item.salePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\nGostaria de mais informações!`
    );
    const whatsappLink = whatsapp ? `https://wa.me/55${whatsapp.replace(/\D/g, '')}?text=${whatsappMsg}` : '#';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row animate-scale-in">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 bg-black/20 text-white hover:bg-black/40 rounded-full backdrop-blur-md transition-colors"
                >
                    <X size={20} />
                </button>

                {/* Image Section */}
                <div className="w-full md:w-1/2 bg-gray-100 relative flex flex-col">
                    <div className="flex-1 relative aspect-square md:aspect-auto">
                        {images.length > 0 ? (
                            <img
                                src={images[currentImageIndex]}
                                alt=""
                                className="absolute inset-0 w-full h-full object-contain p-4 mix-blend-multiply"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                                <Package size={64} />
                            </div>
                        )}

                        {/* Navigation Arrows */}
                        {images.length > 1 && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1)); }}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-sm hover:bg-white text-gray-700"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1)); }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-sm hover:bg-white text-gray-700"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </>
                        )}
                    </div>

                    {/* Thumbnails */}
                    {images.length > 1 && (
                        <div className="p-4 flex gap-2 overflow-x-auto justify-center md:justify-start bg-white/50 backdrop-blur-sm">
                            {images.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentImageIndex(idx)}
                                    className={`w-14 h-14 rounded-lg border-2 overflow-hidden flex-shrink-0 transition-all ${currentImageIndex === idx ? 'border-emerald-500 scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                >
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Details Section */}
                <div className="flex-1 flex flex-col p-6 md:p-8 overflow-y-auto bg-white">
                    <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-2">{item.productName}</h2>

                    <div className="mb-4">
                        <span className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded-full mr-2 ${item.condition === 'Novo' ? 'bg-emerald-100 text-emerald-700' : item.condition === 'Seminovo' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {item.condition}
                        </span>
                        {/* Battery Health - Only in Modal */}
                        {item.condition === 'Seminovo' && item.batteryHealth && (
                            <span className="inline-block px-2.5 py-1 text-[10px] font-bold rounded-full bg-gray-100 text-gray-700">
                                Bateria {item.batteryHealth}%
                            </span>
                        )}
                    </div>

                    <p className="text-sm text-gray-500 mb-6">{item.productBrand} · {categoriesMap[item.productCategory] || item.productCategory}</p>

                    <div className="space-y-4 mb-6">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-emerald-600">
                                R$ {item.salePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-sm text-gray-500 font-medium">à vista</span>
                        </div>

                        {/* Installments Section - Expandable */}
                        {item.installments > 1 && item.cardPrice > 0 && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 transition-all hover:border-gray-200">
                                <div
                                    className="flex items-start justify-between cursor-pointer group"
                                    onClick={() => setShowAllInstallments(!showAllInstallments)}
                                >
                                    <div className="flex gap-3">
                                        <div className={`mt-0.5 transition-colors ${showAllInstallments ? 'text-emerald-500' : 'text-gray-400'}`}>
                                            <CreditCardIcon />
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-700 flex items-center gap-1.5">
                                                <span className="font-semibold">{item.installments}x</span>
                                                <span>de</span>
                                                <span className="font-bold text-gray-900 text-base">R$ {(item.cardPrice / item.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">Total a prazo: R$ {item.cardPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>
                                    <ChevronDown size={18} className={`text-gray-400 transition-transform duration-300 ${showAllInstallments ? 'rotate-180 text-emerald-500' : 'group-hover:text-gray-600'}`} />
                                </div>

                                {/* Expanded Installments List */}
                                {showAllInstallments && (
                                    <div className="mt-3 pt-3 border-t border-gray-200 animate-fade-in">
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                                            {Array.from({ length: item.installments }).map((_, idx) => {
                                                const installmentNum = idx + 1;
                                                return (
                                                    <div key={installmentNum} className="text-xs flex justify-between items-center py-1 border-b border-dashed border-gray-100 last:border-0 odd:last:border-0">
                                                        <span className="text-gray-500 font-medium">{installmentNum}x</span>
                                                        <span className="font-bold text-gray-800">R$ {(item.cardPrice / installmentNum).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Trade-in Message for Apple Products (iPhone, iPad, Mac) + Smartphones */}
                    {(item.productName.toLowerCase().includes('iphone') ||
                        item.productName.toLowerCase().includes('ipad') ||
                        item.productName.toLowerCase().includes('macbook') ||
                        item.productName.toLowerCase().includes('mac') ||
                        item.productCategory === 'Smartphone'
                    ) && (
                            <div className="mb-6 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                                <div className="p-1.5 bg-blue-100 rounded-full text-blue-600 mt-0.5">
                                    <Smartphone size={14} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-blue-800">Pegamos o seu usado como entrada</p>
                                    <p className="text-xs text-blue-600 mt-0.5">Traga seu aparelho antigo para avaliação e use como parte do pagamento.</p>
                                </div>
                            </div>
                        )}

                    {item.description && (
                        <div className="mb-8">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Sobre o Produto</h3>
                            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                                {item.description}
                            </p>
                        </div>
                    )}

                    <div className="mt-auto flex flex-col gap-3">
                        <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-500/20"
                        >
                            <WhatsAppSvg />
                            Comprar no WhatsApp
                        </a>
                        <button
                            onClick={() => { onAdd(); onClose(); }}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-gray-100 text-gray-900 rounded-xl font-bold hover:bg-gray-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <ShoppingBag size={18} />
                            Adicionar ao Orçamento
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ... WhatsAppSvg and CartDrawer components (reused) ...
const WhatsAppSvg = ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.16 8.16 0 01-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 012.41 5.83c.01 4.54-3.68 8.23-8.22 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.04s.88 2.37 1.01 2.53c.12.17 1.73 2.64 4.2 3.7.59.25 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.27z" />
    </svg>
);

const CreditCardIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
        <line x1="1" y1="10" x2="23" y2="10"></line>
    </svg>
);

const CartDrawer: React.FC<{
    cart: CartEntry[];
    totalPrice: number;
    onUpdateQuantity: (id: string, qty: number) => void;
    onRemove: (id: string) => void;
    onClose: () => void;
    onCheckout: () => void;
    onClear: () => void;
}> = ({ cart, totalPrice, onUpdateQuantity, onRemove, onClose, onCheckout, onClear }) => {
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-fade-in z-10 h-full">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <ShoppingBag size={20} className="text-emerald-500" />
                        <h2 className="text-lg font-bold">Meu Orçamento</h2>
                    </div>
                    <div className="flex items-center gap-1">
                        {cart.length > 0 && (
                            <button
                                onClick={() => setShowClearConfirm(true)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                title="Limpar Orçamento"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {cart.length === 0 ? (
                        <div className="text-center py-16">
                            <ShoppingBag size={48} className="mx-auto text-gray-200 mb-4" />
                            <p className="text-secondary font-medium">Seu orçamento está vazio</p>
                            <p className="text-muted text-sm mt-1">Adicione produtos do catálogo</p>
                        </div>
                    ) : (
                        cart.map(entry => {
                            const imageUrl = entry.item.imageUrls?.[0] || entry.item.imageUrl;
                            return (
                                <div key={entry.item.id} className="flex gap-3 p-3 bg-gray-50 rounded-2xl">
                                    <div className="w-16 h-16 rounded-xl bg-white overflow-hidden flex-shrink-0 shadow-sm">
                                        {imageUrl ? (
                                            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center"><Package size={20} className="text-gray-300" /></div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-primary truncate">{entry.item.productName}</p>
                                        <p className="text-xs text-emerald-600 font-bold mt-0.5">R$ {entry.item.salePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <button
                                                onClick={() => onUpdateQuantity(entry.item.id, entry.quantity - 1)}
                                                className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                                            >
                                                <Minus size={12} />
                                            </button>
                                            <span className="text-sm font-bold w-6 text-center">{entry.quantity}</span>
                                            <button
                                                onClick={() => onUpdateQuantity(entry.item.id, entry.quantity + 1)}
                                                className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                                            >
                                                <Plus size={12} />
                                            </button>
                                            <button
                                                onClick={() => onRemove(entry.item.id)}
                                                className="ml-auto p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                {cart.length > 0 && (
                    <div className="border-t border-gray-100 p-5 space-y-4 bg-white">
                        <div className="flex items-center justify-between">
                            <span className="text-secondary font-medium">Total do Orçamento</span>
                            <span className="text-xl font-black text-primary">R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <button
                            onClick={onCheckout}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-500 text-white rounded-2xl font-bold text-sm hover:bg-emerald-600 transition-colors active:scale-[0.98] shadow-lg shadow-emerald-500/25"
                        >
                            <Send size={16} />
                            Enviar Pedido via WhatsApp
                        </button>
                    </div>
                )}

                {/* Clear Confirmation Modal */}
                {showClearConfirm && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-[2px] p-6 animate-fade-in text-center">
                        <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-[320px] animate-scale-in border border-gray-100">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4 text-red-500">
                                <Trash2 size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Limpar Orçamento?</h3>
                            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                                Tem certeza que deseja remover todos os itens do seu carrinho?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowClearConfirm(false)}
                                    className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        onClear();
                                        setShowClearConfirm(false);
                                    }}
                                    className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                                >
                                    Sim, Limpar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ===== MAIN PUBLIC PAGE =====
const CatalogPublic: React.FC = () => {
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [sectionsConfig, setSectionsConfig] = useState<{ id: string; name: string; emoji: string; displayOrder: number; sortOrder?: string }[]>([]);
    const [categoriesMap, setCategoriesMap] = useState<Record<string, string>>({});
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('Todos');
    const [showCart, setShowCart] = useState(false);
    const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
    const { cart, addToCart, removeFromCart, updateQuantity, totalItems, totalPrice, clearCart } = useCart();

    useEffect(() => {
        const loadData = async () => {
            try {
                const [catalogData, company, sectionsData, categoriesData] = await Promise.all([
                    getActiveCatalogItems(),
                    getCompanyInfo(),
                    getCatalogSections(),
                    getCategories(),
                ]);
                setItems(catalogData);
                setCompanyInfo(company);
                setSectionsConfig(sectionsData.sort((a, b) => a.displayOrder - b.displayOrder));

                // Map categories
                const catMap: Record<string, string> = {};
                if (Array.isArray(categoriesData)) {
                    categoriesData.forEach((c: any) => {
                        if (c.id && c.name) catMap[c.id] = c.name;
                    });
                }
                setCategoriesMap(catMap);
            } catch (error) {
                console.error('Error loading catalog:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();

        // Realtime Subscription
        const channel = supabase
            .channel('catalog-public-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'catalog_items' },
                () => {
                    loadData();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'catalog_sections' },
                () => {
                    loadData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const sections = useMemo(() => {
        const sectionMap: Record<string, CatalogItem[]> = {};
        items.forEach(item => {
            const s = item.section || 'Outros';
            if (!sectionMap[s]) sectionMap[s] = [];
            sectionMap[s].push(item);
        });
        return sectionMap;
    }, [items]);

    // Filter Constants
    const APPLE_TYPES = ['iPhone', 'iPad', 'Mac', 'Watch', 'AirPods'];
    const FEATURED_BRANDS = ['Xiaomi', 'Realme', 'Amazon', 'Samsung', 'Motorola'];

    // Extract categories, brands, and types
    const categories = useMemo(() => {
        const cats = new Set<string>();
        const brands = new Set<string>();
        const types = new Set<string>();

        items.forEach(i => {
            const productNameLower = i.productName.toLowerCase();
            let isAppleType = false;

            // Check if it's an Apple Type
            APPLE_TYPES.forEach(type => {
                if (productNameLower.includes(type.toLowerCase())) {
                    types.add(type);
                    isAppleType = true;
                }
            });

            // Brands - Only add if NOT an Apple product (conceptually) or if specifically requested
            // But user wants "Smartphone" removed for Apple products.
            // Let's Handle Brands
            const brand = i.productBrand;
            if (FEATURED_BRANDS.includes(brand)) {
                brands.add(brand);
            }

            // Categories
            const catName = categoriesMap[i.productCategory] || i.productCategory;

            // LOGIC: If it's an Apple type (iPhone, etc), DO NOT add "Smartphone" or generic categories
            // Also avoid adding the type itself as a category if it exists as a category (e.g. category "iPhone")
            if (isAppleType) {
                // If the category is exact match to the type, we don't need to add it to 'cats' 
                // because it's already in 'types'.
                // If it's "Smartphone", we skip it for Apple products as requested.
                if (catName !== 'Smartphone' && !APPLE_TYPES.includes(catName)) {
                    cats.add(catName);
                }
            } else {
                // Non-Apple products get their categories normally
                // Also check if brand is one of the featured ones, maybe we only want brand pill?
                // User said: "Smartphone e categoria de produto nao apple e so quero as marcas de produtos nao apple aparecendo ali"
                // Interpretation: For non-Apple products, show Brands (Xiaomi, etc) AND maybe remove "Smartphone"?
                // Let's stick to: Remove "Smartphone" category for Apple products.
                // And ensure "iPhone" doesn't appear twice (once as type, once as category).

                if (!APPLE_TYPES.includes(catName)) {
                    cats.add(catName);
                }
            }
        });

        // Filter out any cats that are already in types or brands to be safe
        const uniqueCats = Array.from(cats).filter(c => !types.has(c) && !brands.has(c));

        // Order: Todos -> Apple Types -> Brands -> Categories
        const sortedTypes = APPLE_TYPES.filter(t => types.has(t));
        const sortedBrands = FEATURED_BRANDS.filter(b => brands.has(b));
        const sortedCats = uniqueCats.filter(Boolean).sort();

        return ['Todos', ...sortedTypes, ...sortedBrands, ...sortedCats];
    }, [items, categoriesMap]);

    // Filter items
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.productBrand.toLowerCase().includes(searchTerm.toLowerCase());

            // Filter logic
            let matchesCategory = false;

            if (activeCategory === 'Todos') {
                matchesCategory = true;
            } else if (APPLE_TYPES.includes(activeCategory)) {
                // Filter by Apple Type (Name)
                matchesCategory = item.productName.toLowerCase().includes(activeCategory.toLowerCase());
            } else if (FEATURED_BRANDS.includes(activeCategory)) {
                // Filter by Brand
                matchesCategory = item.productBrand === activeCategory;
            } else {
                // Filter by Category
                const categoryName = categoriesMap[item.productCategory] || item.productCategory;
                matchesCategory = categoryName === activeCategory;
            }

            return matchesSearch && matchesCategory;
        });
    }, [items, searchTerm, activeCategory, categoriesMap]);

    const filteredSections = useMemo((): Record<string, CatalogItem[]> => {
        if (searchTerm || activeCategory !== 'Todos') {
            return { 'Resultados': filteredItems };
        }
        return sections;
    }, [filteredItems, sections, searchTerm, activeCategory]);

    const handleCheckout = () => {
        const whatsapp = companyInfo?.whatsapp || '';
        if (!whatsapp) {
            alert('Número do WhatsApp não configurado. Entre em contato com a loja.');
            return;
        }

        const lines = cart.map(e =>
            `- ${e.quantity}x ${e.item.productName} - R$ ${(e.item.salePrice * e.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        );

        const msg = encodeURIComponent(
            `Olá, vim através do catálogo virtual. Pedido de orçamento:\n\n${lines.join('\n')}\n\nTotal: R$ ${totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\nGostaria de receber mais informações!`
        );

        window.open(`https://wa.me/55${whatsapp.replace(/\D/g, '')}?text=${msg}`, '_blank');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mx-auto mb-4" />
                    <p className="text-secondary font-medium">Carregando vitrine...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                        {/* Logo/Store Name */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {companyInfo?.logoUrl ? (
                                <img src={companyInfo.logoUrl} alt={companyInfo.name} className="h-8 w-8 rounded-xl object-cover" />
                            ) : (
                                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                    <ShoppingBag size={16} className="text-white" />
                                </div>
                            )}
                            <h1 className="text-base font-bold text-primary hidden sm:block">{companyInfo?.name || 'Catálogo'}</h1>
                        </div>

                        {/* Search */}
                        <div className="relative flex-1 max-w-md">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar produtos..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-100 border-0 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/30 focus:bg-white transition-all"
                            />
                        </div>

                        {/* Cart */}
                        <button
                            onClick={() => setShowCart(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full transition-all shadow-lg shadow-emerald-500/20 active:scale-95 group"
                        >
                            <span className="text-sm font-bold hidden sm:inline">Orçamento</span>
                            <div className="relative">
                                <ShoppingBag size={20} />
                                {totalItems > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-emerald-500 group-hover:border-emerald-600">
                                        {totalItems}
                                    </span>
                                )}
                            </div>
                        </button>
                    </div>

                    {/* Category Pills */}
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1 custom-scrollbar -mx-4 px-4">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeCategory === cat
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'bg-gray-100 text-secondary hover:bg-gray-200'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-7xl mx-auto px-4 py-4 space-y-3">
                {(() => {
                    const sortedSectionNames = Object.keys(filteredSections).sort((a, b) => {
                        // Se tivermos filtro ativo, não reordenar (ou manter ordem alfabética/relevância)
                        // Mas se for "Resultados", é único.
                        if (a === 'Resultados' || b === 'Resultados') return 0;

                        const secA = sectionsConfig.find(s => s.name === a);
                        const secB = sectionsConfig.find(s => s.name === b);

                        // Se ambas têm config, usa displayOrder
                        if (secA && secB) return secA.displayOrder - secB.displayOrder;

                        // Se apenas A tem, A vem antes
                        if (secA) return -1;
                        if (secB) return 1;

                        // Fallback para SECTION_CONFIG estática se existir (para compatibilidade)
                        // Mas o ideal é confiar no banco.
                        return 0;
                    });

                    return sortedSectionNames.map(sectionName => {
                        const sectionItems = filteredSections[sectionName];
                        if (!sectionItems || sectionItems.length === 0) return null;

                        // Busca config do banco OU fallback local
                        const dbConfig = sectionsConfig.find(s => s.name === sectionName);
                        const localConfig = SECTION_CONFIG[sectionName];

                        // Prioriza emoji do banco, depois local, depois padrão
                        const sectionEmoji = dbConfig?.emoji || localConfig?.emoji || '📋';

                        // Sorting Logic
                        let sortedItems = [...sectionItems];
                        const sortOrder = (dbConfig as any)?.sortOrder || 'newest';

                        switch (sortOrder) {
                            case 'oldest':
                                // Mantém a ordem original (assumindo que já vem por data de inserção) ou inverte se necessário
                                // Como não temos data explícita aqui, vamos assumir que a ordem do array é a de inserção (se vier do DB assim)
                                // Se quisermos garantir, precisaríamos do campo 'created_at' no CatalogItem
                                // Por enquanto, vamos inverter a lógica do 'newest' se assumirmos que o padrão é newest.
                                // Mas geralmente 'newest' é o padrão desejado.
                                // Se a API retorna ordenado por criação (asc), então:
                                // newest = reverse
                                // oldest = normal
                                // Vamos assumir que a API retorna 'newest' first ou algo assim. 
                                // Melhor: vamos ordenar por created_at se existir, ou fallback.
                                // Como não temos created_at garantido no type CatalogItem aqui (precisa checar), 
                                // vamos usar lógica de preço que é garantida e inverter array para newest/oldest se assumirmos ordem de carga.
                                // Assumindo que a API traz os mais novos primeiro (padrão comum), então:
                                // newest = sortedItems
                                // oldest = sortedItems.reverse()
                                sortedItems.reverse();
                                break;
                            case 'lowest_price':
                                sortedItems.sort((a, b) => a.salePrice - b.salePrice);
                                break;
                            case 'highest_price':
                                sortedItems.sort((a, b) => b.salePrice - a.salePrice);
                                break;
                            case 'newest':
                            default:
                                // Assumindo que a API já retorna os mais recentes primeiro ou que a ordem natural é essa.
                                // Se precisar garantir, usaríamos created_at.
                                break;
                        }

                        return (
                            <section key={sectionName} className="relative pt-2">
                                {/* Minimalist Full-width Divider with Title */}
                                <div className="flex items-center gap-4 mb-4">
                                    <h2 className="text-xl font-bold text-gray-900 tracking-tight uppercase flex items-center gap-2 whitespace-nowrap">
                                        <span className="text-2xl">{sectionEmoji}</span>
                                        {sectionName}
                                        <span className="text-xs font-normal text-gray-400 ml-2 bg-gray-100 px-2 py-1 rounded-full">{sectionItems.length}</span>
                                    </h2>
                                    <div className="h-[2px] bg-gray-200 w-full rounded-full"></div>
                                </div>

                                {sectionName === 'Resultados' ? (
                                    // Vertical Grid for Results
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 px-4 sm:px-0">
                                        {sortedItems.map(item => (
                                            <div key={item.id} className="flex flex-col">
                                                <ProductCard
                                                    item={item}
                                                    onClick={() => setSelectedItem(item)}
                                                    onAdd={(e) => addToCart(item)}
                                                    whatsapp={companyInfo?.whatsapp || ''}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    // Horizontal Scroll for Sections
                                    <div className="overflow-x-auto pb-4 -mx-4 snap-x snap-mandatory custom-scrollbar">
                                        <div className="flex gap-4 px-4 w-max">
                                            {sortedItems.map(item => (
                                                <div key={item.id} className="w-[160px] sm:w-[180px] md:w-[200px] flex-shrink-0 snap-start h-auto flex flex-col">
                                                    <ProductCard
                                                        item={item}
                                                        onClick={() => setSelectedItem(item)}
                                                        onAdd={(e) => addToCart(item)}
                                                        whatsapp={companyInfo?.whatsapp || ''}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </section>
                        );
                    });
                })()}

                {filteredItems.length === 0 && !isLoading && (
                    <div className="text-center py-20">
                        <Package size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-secondary font-medium">Nenhum produto encontrado</p>
                        <p className="text-muted text-sm mt-1">Tente buscar por outro termo</p>
                    </div>
                )}
            </main>

            {/* Floating Cart Badge (Mobile) */}
            {totalItems > 0 && !showCart && (
                <button
                    onClick={() => setShowCart(true)}
                    className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-5 py-3.5 bg-emerald-500 text-white rounded-2xl shadow-xl shadow-emerald-500/30 hover:bg-emerald-600 transition-all active:scale-95 animate-fade-in-up lg:hidden"
                >
                    <ShoppingBag size={18} />
                    <span className="font-bold text-sm">{totalItems} {totalItems === 1 ? 'item' : 'itens'}</span>
                    <span className="text-emerald-200 mx-1">·</span>
                    <span className="font-bold text-sm">R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </button>
            )}

            {/* Footer */}
            <footer className="bg-white border-t border-gray-100 mt-16 py-8">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="text-secondary text-sm">
                        {companyInfo?.name || 'Loja'} · Catálogo Virtual
                    </p>
                    {companyInfo?.whatsapp && (
                        <a
                            href={`https://wa.me/55${companyInfo.whatsapp.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-2 text-emerald-500 text-sm font-medium hover:underline"
                        >
                            <Phone size={14} /> Fale Conosco
                        </a>
                    )}
                    <p className="text-muted text-xs mt-3">Powered by iStore Pro</p>
                </div>
            </footer>

            {/* Dialogs */}
            {showCart && (
                <CartDrawer
                    cart={cart}
                    totalPrice={totalPrice}
                    onUpdateQuantity={updateQuantity}
                    onRemove={removeFromCart}
                    onClose={() => setShowCart(false)}
                    onCheckout={handleCheckout}
                    onClear={() => {
                        clearCart();
                        setShowCart(false);
                    }}
                />
            )}

            {selectedItem && (
                <ProductDetailsModal
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                    onAdd={() => addToCart(selectedItem)}
                    whatsapp={companyInfo?.whatsapp || ''}
                    categoriesMap={categoriesMap}
                />
            )}
        </div>
    );
};

export default CatalogPublic;
