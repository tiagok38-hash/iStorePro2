import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus, Search, Copy, ExternalLink, MoreVertical, Pencil, Trash2, Eye, EyeOff,
    Package, Filter, ChevronDown, Loader2, Check, X, ShoppingBag, Link as LinkIcon, Image as ImageIcon
} from 'lucide-react';
import { getCatalogItems, updateCatalogItem, deleteCatalogItem, getProducts, getBrands, getCatalogSections, deleteCatalogItems, getCompanyInfo, getPaymentMethods } from '../../services/mockApi.ts';
import { CatalogItem, Product, Brand, CompanyInfo, PaymentMethodParameter } from '../../types.ts';
import { useToast } from '../../contexts/ToastContext.tsx';
import CatalogItemModal from './CatalogItemModal.tsx';

import { useUser } from '../../contexts/UserContext.tsx';

const CatalogAdmin: React.FC = () => {
    const { permissions } = useUser();
    const { showToast } = useToast();
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [brandFilter, setBrandFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [editingField, setEditingField] = useState<{ id: string; field: string } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const catalogUrl = `${window.location.origin}${window.location.pathname}#/catalogo/${companyInfo?.slug || 'loja'}`;

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [catalogData, productsData, brandsData, companyData, paymentMethodsData] = await Promise.all([
                getCatalogItems(),
                getProducts(),
                getBrands(),
                getCompanyInfo(),
                getPaymentMethods()
            ]);
            
            // Find card rates to calculate dynamic cardPrice
            let currentCardRates: { rate: number; installments: number }[] = [];
            const cardMethod = (paymentMethodsData as PaymentMethodParameter[]).find(m => m.type === 'card' && m.active && m.config?.creditWithInterestRates);
            if (cardMethod?.config?.creditWithInterestRates) {
                currentCardRates = cardMethod.config.creditWithInterestRates.sort((a, b) => a.installments - b.installments);
            }

            // Apply dynamic interest rate to all items directly in memory 
            // Using exactly the same repasse formula: V / (1 - R/100)
            const processedItems = catalogData.map(item => {
                if (currentCardRates.length > 0 && item.installments > 1 && item.salePrice > 0) {
                    const rateObj = currentCardRates.find(r => r.installments === item.installments) || currentCardRates[currentCardRates.length - 1]; 
                    if (rateObj && rateObj.rate > 0) {
                        item.cardPrice = item.salePrice / (1 - (rateObj.rate / 100));
                        // Flag that the price is dynamically calculated
                        (item as any).isDynamicCardPrice = true;
                    }
                }
                return item;
            });

            setItems(processedItems);
            setProducts(productsData);
            setBrands(brandsData);
            setCompanyInfo(companyData);
        } catch (error) {
            console.error('Error loading catalog data:', error);
            showToast('Erro ao carregar dados do catálogo', 'error');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleToggleActive = async (item: CatalogItem) => {
        try {
            await updateCatalogItem(item.id, { isActive: !item.isActive });
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, isActive: !i.isActive } : i));
            showToast(item.isActive ? 'Item desativado' : 'Item ativado', 'success');
        } catch {
            showToast('Erro ao atualizar item', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover este item do catálogo?')) return;
        try {
            await deleteCatalogItem(id);
            setItems(prev => prev.filter(i => i.id !== id));
            showToast('Item removido do catálogo', 'success');
        } catch {
            showToast('Erro ao remover item', 'error');
        }
        setMenuOpenId(null);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Tem certeza que deseja remover ${selectedIds.length} itens do catálogo?`)) return;

        setIsLoading(true);
        try {
            await deleteCatalogItems(selectedIds);
            setItems(prev => prev.filter(i => !selectedIds.includes(i.id)));
            setSelectedIds([]);
            showToast(`${selectedIds.length} itens removidos`, 'success');
        } catch {
            showToast('Erro ao remover itens', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredItems.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredItems.map(i => i.id));
        }
    };

    const handleInlineEdit = async (id: string) => {
        if (!editingField) return;
        const value = parseFloat(editValue) || 0;
        const field = editingField.field;
        try {
            await updateCatalogItem(id, { [field]: field === 'displayOrder' || field === 'installments' ? Math.round(value) : value });
            setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
        } catch {
            showToast('Erro ao salvar', 'error');
        }
        setEditingField(null);
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(catalogUrl);
        setLinkCopied(true);
        showToast('Link copiado!', 'success');
        setTimeout(() => setLinkCopied(false), 2000);
    };

    const filteredItems = items.filter(item => {
        const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBrand = !brandFilter || item.productBrand === brandFilter;
        return matchesSearch && matchesBrand;
    });

    const renderInlineInput = (item: CatalogItem, field: string, value: number, prefix = '') => {
        const isEditing = editingField?.id === item.id && editingField?.field === field;

        if (isEditing) {
            return (
                <div className="flex items-center gap-1">
                    <input
                        autoFocus
                        type="number"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleInlineEdit(item.id); if (e.key === 'Escape') setEditingField(null); }}
                        onBlur={() => handleInlineEdit(item.id)}
                        className="w-20 px-2 py-1 text-xs border border-accent rounded-lg focus:ring-2 focus:ring-accent/30 text-right"
                    />
                </div>
            );
        }

        // Disable inline edit of Card Price if dynamically calculated
        const isDynamic = field === 'cardPrice' && (item as any).isDynamicCardPrice;

        if (!permissions?.canEditCatalogItem || isDynamic) {
            return (
                <div className="text-xs text-secondary font-medium text-right w-full" title={isDynamic ? "Calculado automaticamente via taxa padrão" : ""}>
                    {prefix}{value.toLocaleString('pt-BR', { minimumFractionDigits: field === 'displayOrder' || field === 'installments' ? 0 : 2, maximumFractionDigits: 2 })}
                </div>
            );
        }

        return (
            <button
                onClick={() => { setEditingField({ id: item.id, field }); setEditValue(String(value)); }}
                className="text-xs text-primary hover:text-accent font-medium transition-colors text-right w-full group flex items-center justify-end"
                title="Clique para editar"
            >
                {prefix}{value.toLocaleString('pt-BR', { minimumFractionDigits: field === 'displayOrder' || field === 'installments' ? 0 : 2, maximumFractionDigits: 2 })}
                <Pencil size={10} className="inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-primary">Meus Catálogos</h1>
                    <p className="text-secondary text-sm mt-1">Gerencie os produtos que aparecem na sua vitrine virtual</p>
                </div>
                {permissions?.canCreateCatalogItem && (
                    <button
                        onClick={() => { setEditingItem(null); setShowModal(true); }}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-semibold text-sm hover:shadow-lg hover:shadow-emerald-500/25 transition-all active:scale-95"
                    >
                        <Plus size={18} />
                        Adicionar Item
                    </button>
                )}
            </div>

            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-4 rounded-2xl animate-fade-in shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                            <Check size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-primary">{selectedIds.length} itens selecionados</p>
                            <p className="text-xs text-secondary">Selecione uma ação para aplicar em massa</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSelectedIds([])}
                            className="px-4 py-2 text-sm font-semibold text-secondary hover:bg-white rounded-xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-all shadow-md shadow-red-500/20 active:scale-95"
                        >
                            <Trash2 size={16} />
                            Excluir Selecionados
                        </button>
                    </div>
                </div>
            )}

            {/* Public Link Card */}
            <div className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-secondary flex-shrink-0">
                    <LinkIcon size={16} className="text-emerald-500" />
                    <span className="font-medium">Link Público:</span>
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 w-full sm:w-auto">
                    <code className="text-xs text-accent font-mono truncate flex-1">{catalogUrl}</code>
                    <button
                        onClick={handleCopyLink}
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white transition-colors text-secondary hover:text-accent"
                        title="Copiar link"
                    >
                        {linkCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                    <a
                        href={catalogUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white transition-colors text-secondary hover:text-accent"
                        title="Abrir em nova aba"
                    >
                        <ExternalLink size={14} />
                    </a>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                        type="text"
                        placeholder="Buscar por nome do produto..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                </div>
                <select
                    value={brandFilter}
                    onChange={e => setBrandFilter(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm min-w-[160px]"
                >
                    <option value="">Todas as Marcas</option>
                    {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="px-4 py-3 text-left w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.length > 0 && selectedIds.length === filteredItems.length}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Imagem</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider">Ordem</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Descrição</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Seção</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-secondary uppercase tracking-wider">Custo</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-secondary uppercase tracking-wider">Venda (à vista)</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-secondary uppercase tracking-wider">Venda (Cartão)</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider">Parcelas</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider">Ativo</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={11} className="px-6 py-16 text-center">
                                        <Loader2 size={32} className="mx-auto animate-spin text-emerald-500 mb-3" />
                                        <p className="text-secondary text-sm">Carregando catálogo...</p>
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-6 py-16 text-center">
                                        <ShoppingBag size={40} className="mx-auto text-gray-300 mb-3" />
                                        <p className="text-secondary font-medium">Nenhum item no catálogo</p>
                                        <p className="text-muted text-sm mt-1">Clique em "Adicionar Item" para começar</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map(item => (
                                    <tr
                                        key={item.id}
                                        className={`hover:bg-gray-50/50 transition-colors group ${selectedIds.includes(item.id) ? 'bg-emerald-50/30' : ''}`}
                                    >
                                        {/* Checkbox */}
                                        <td className="px-4 py-3 align-middle">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => toggleSelect(item.id)}
                                                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                        </td>
                                        {/* Image */}
                                        <td className="px-4 py-3 align-middle">
                                            <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
                                                {item.imageUrl ? (
                                                    <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                                                ) : (
                                                    <ImageIcon size={20} className="text-gray-300" />
                                                )}
                                            </div>
                                        </td>
                                        {/* Order */}
                                        <td className="px-4 py-3 text-center align-middle">
                                            {renderInlineInput(item, 'displayOrder', item.displayOrder)}
                                        </td>
                                        {/* Description */}
                                        <td className="px-4 py-3 align-middle">
                                            <div>
                                                <p className="font-semibold text-sm text-primary">{item.productName}</p>
                                                <p className="text-xs text-secondary">{item.productBrand} · {item.productCategory}</p>
                                                {item.condition === 'Seminovo' && item.batteryHealth && (
                                                    <span className="inline-block mt-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full">
                                                        🔋 {item.batteryHealth}%
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {/* Section */}
                                        <td className="px-4 py-3 align-middle">
                                            <span className="text-xs text-secondary bg-gray-50 px-2 py-1 rounded-lg">{item.section}</span>
                                        </td>
                                        {/* Prices */}
                                        <td className="px-4 py-3 text-right align-middle">
                                            {renderInlineInput(item, 'costPrice', item.costPrice, 'R$ ')}
                                        </td>
                                        <td className="px-4 py-3 text-right align-middle">
                                            {renderInlineInput(item, 'salePrice', item.salePrice, 'R$ ')}
                                        </td>
                                        <td className="px-4 py-3 text-right align-middle">
                                            {renderInlineInput(item, 'cardPrice', item.cardPrice, 'R$ ')}
                                        </td>
                                        <td className="px-4 py-3 text-center align-middle">
                                            {renderInlineInput(item, 'installments', item.installments)}
                                        </td>
                                        {/* Toggle */}
                                        <td className="px-4 py-3 text-center align-middle">
                                            <button
                                                disabled={!permissions?.canEditCatalogItem}
                                                onClick={() => handleToggleActive(item)}
                                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${item.isActive ? 'bg-blue-600' : 'bg-gray-300'} ${!permissions?.canEditCatalogItem ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${item.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </td>
                                        {/* Actions */}
                                        <td className="px-4 py-3 text-center relative align-middle">
                                            <button
                                                onClick={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
                                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-secondary"
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                            {menuOpenId === item.id && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />
                                                    <div className={`absolute right-4 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 min-w-[150px] animate-fade-in ${filteredItems.indexOf(item) >= filteredItems.length - 2 ? 'bottom-12' : 'top-12'}`}>
                                                        {permissions?.canEditCatalogItem && (
                                                            <button
                                                                onClick={() => { setEditingItem(item); setShowModal(true); setMenuOpenId(null); }}
                                                                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-primary hover:bg-gray-50 transition-colors"
                                                            >
                                                                <Pencil size={14} /> Editar
                                                            </button>
                                                        )}
                                                        {permissions?.canDeleteCatalogItem && (
                                                            <button
                                                                onClick={() => handleDelete(item.id)}
                                                                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                                            >
                                                                <Trash2 size={14} /> Excluir
                                                            </button>
                                                        )}
                                                        {!permissions?.canEditCatalogItem && !permissions?.canDeleteCatalogItem && (
                                                            <div className="px-4 py-2 text-xs text-muted">Sem permissões</div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Stats Footer */}
            {
                !isLoading && items.length > 0 && (
                    <div className="flex items-center justify-between text-sm text-secondary">
                        <span>{items.length} itens no catálogo · {items.filter(i => i.isActive).length} ativos</span>
                    </div>
                )
            }

            {/* Modal */}
            {
                showModal && (
                    <CatalogItemModal
                        item={editingItem}
                        products={products}
                        onClose={() => { setShowModal(false); setEditingItem(null); }}
                        onSaved={() => { setShowModal(false); setEditingItem(null); loadData(); }}
                    />
                )
            }
        </div >
    );
};

export default CatalogAdmin;
