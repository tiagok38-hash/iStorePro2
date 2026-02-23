import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '../../contexts/UserContext';
import { AuditLog, AuditActionType, AuditEntityType, Sale, PurchaseOrder, Product } from '../../types';
import { getAuditLogs, getSales, getPurchaseOrders, getProducts } from '../../services/mockApi';
import { TrashIcon, PlusIcon, EditIcon, UserCircleIcon, CalculatorIcon, XCircleIcon, ShoppingCartIcon, ArchiveBoxIcon } from '../icons';
import CustomDatePicker from '../CustomDatePicker';
import { toDateValue } from '../../utils/dateUtils';
import { SpinnerIcon } from '../icons';

type PeriodFilter = 'last_hour' | 'today' | 'yesterday' | 'custom';

const AuditSettings: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('today');
    const [customDate, setCustomDate] = useState<string>(toDateValue());

    // Tradução de nomes de ação para português
    const translateAction = (action: AuditActionType): string => {
        const translations: Record<AuditActionType, string> = {
            [AuditActionType.CREATE]: 'Criação',
            [AuditActionType.UPDATE]: 'Atualização',
            [AuditActionType.DELETE]: 'Exclusão',
            [AuditActionType.SALE_CREATE]: 'Venda Realizada',
            [AuditActionType.SALE_CANCEL]: 'Venda Cancelada',
            [AuditActionType.STOCK_ADJUST]: 'Ajuste de Estoque',
            [AuditActionType.STOCK_LAUNCH]: 'Lançamento no Estoque',
            [AuditActionType.PURCHASE_LAUNCH]: 'Lançamento de Compra',
            [AuditActionType.STOCK_REVERT]: 'Reversão de Estoque',
            [AuditActionType.LOGIN]: 'Login',
            [AuditActionType.LOGOUT]: 'Logout',
            [AuditActionType.CASH_OPEN]: 'Abertura de Caixa',
            [AuditActionType.CASH_CLOSE]: 'Fechamento de Caixa',
            [AuditActionType.CASH_WITHDRAWAL]: 'Sangria',
            [AuditActionType.CASH_SUPPLY]: 'Suprimento',
            [AuditActionType.COMMISSION_CREATE]: 'Gerar Comissão',
            [AuditActionType.COMMISSION_CANCEL]: 'Cancelar Comissão',
            [AuditActionType.COMMISSION_CLOSE]: 'Fechar Comissão',
            [AuditActionType.COMMISSION_PAY]: 'Pagar Comissão',
            [AuditActionType.COMMISSION_RECALCULATE]: 'Recalcular Comissão',
        };
        return translations[action] || action;
    };

    // Tradução de nomes de entidade para português
    const translateEntity = (entity: AuditEntityType): string => {
        const translations: Record<AuditEntityType, string> = {
            [AuditEntityType.PRODUCT]: 'Produto',
            [AuditEntityType.CUSTOMER]: 'Cliente',
            [AuditEntityType.SUPPLIER]: 'Fornecedor',
            [AuditEntityType.SALE]: 'Venda',
            [AuditEntityType.PURCHASE_ORDER]: 'Compra',
            [AuditEntityType.USER]: 'Usuário',
            [AuditEntityType.PAYMENT_METHOD]: 'Meio de Pagamento',
            [AuditEntityType.BRAND]: 'Marca',
            [AuditEntityType.CATEGORY]: 'Categoria',
            [AuditEntityType.PRODUCT_MODEL]: 'Modelo',
            [AuditEntityType.GRADE]: 'Grade',
            [AuditEntityType.GRADE_VALUE]: 'Valor de Grade',
            [AuditEntityType.WARRANTY]: 'Garantia',
            [AuditEntityType.STORAGE_LOCATION]: 'Local de Estoque',
            [AuditEntityType.CONDITION]: 'Condição',
            [AuditEntityType.RECEIPT_TERM]: 'Termo de Recibo',
            [AuditEntityType.PERMISSION_PROFILE]: 'Perfil de Permissão',
            [AuditEntityType.CASH_SESSION]: 'Caixa',
            [AuditEntityType.SERVICE]: 'Serviço',
            [AuditEntityType.SERVICE_ORDER]: 'Ordem de Serviço',
            [AuditEntityType.COMMISSION]: 'Comissão',
        };
        return translations[entity] || entity;
    };

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const [logsData, salesData, purchasesData, productsData] = await Promise.all([
                getAuditLogs().catch(() => []),
                getSales().catch(() => []),
                getPurchaseOrders().catch(() => []),
                getProducts().catch(() => [])
            ]);
            setLogs(logsData || []);
            setSales(salesData || []);
            setPurchases(purchasesData || []);
            setProducts(productsData || []);
        } catch (error) {
            console.error('AuditSettings fetch error:', error);
        }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const productMap = useMemo(() => products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, Product>), [products]);
    const saleMap = useMemo(() => sales.reduce((acc, s) => ({ ...acc, [s.id]: s }), {} as Record<string, Sale>), [sales]);
    const purchaseMap = useMemo(() => purchases.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, PurchaseOrder>), [purchases]);

    const getIconAndColor = (log: AuditLog) => {
        if (log.action === AuditActionType.DELETE) return { Icon: TrashIcon, color: 'text-red-600', bg: 'bg-red-100' };
        if (log.action === AuditActionType.CREATE) return { Icon: PlusIcon, color: 'text-green-600', bg: 'bg-green-100' };
        if (log.action === AuditActionType.UPDATE) return { Icon: EditIcon, color: 'text-blue-600', bg: 'bg-blue-100' };
        if (log.action === AuditActionType.LOGIN) return { Icon: UserCircleIcon, color: 'text-green-600', bg: 'bg-green-100' };
        if (log.action === AuditActionType.LOGOUT) return { Icon: UserCircleIcon, color: 'text-gray-600', bg: 'bg-gray-100' };
        if (log.action === AuditActionType.CASH_OPEN) return { Icon: CalculatorIcon, color: 'text-green-600', bg: 'bg-green-100' };
        if (log.action === AuditActionType.CASH_CLOSE) return { Icon: CalculatorIcon, color: 'text-red-600', bg: 'bg-red-100' };
        if (log.action === AuditActionType.CASH_WITHDRAWAL) return { Icon: CalculatorIcon, color: 'text-orange-600', bg: 'bg-orange-100' };
        if (log.action === AuditActionType.CASH_SUPPLY) return { Icon: CalculatorIcon, color: 'text-blue-600', bg: 'bg-blue-100' };

        switch (log.entity) {
            case AuditEntityType.SALE:
                if (log.action === AuditActionType.SALE_CANCEL) return { Icon: XCircleIcon, color: 'text-red-600', bg: 'bg-red-100' };
                return { Icon: ShoppingCartIcon, color: 'text-purple-600', bg: 'bg-purple-100' };
            case AuditEntityType.PRODUCT:
                if (log.action === AuditActionType.STOCK_ADJUST) return { Icon: ArchiveBoxIcon, color: 'text-orange-600', bg: 'bg-orange-100' };
                if (log.action === AuditActionType.STOCK_LAUNCH) return { Icon: ArchiveBoxIcon, color: 'text-teal-600', bg: 'bg-teal-100' };
                return { Icon: ArchiveBoxIcon, color: 'text-indigo-500', bg: 'bg-indigo-100' };
            case AuditEntityType.CUSTOMER:
                return { Icon: UserCircleIcon, color: 'text-pink-500', bg: 'bg-pink-100' };
            case AuditEntityType.SUPPLIER:
                return { Icon: ArchiveBoxIcon, color: 'text-cyan-500', bg: 'bg-cyan-100' };
            default:
                return { Icon: CalculatorIcon, color: 'text-gray-500', bg: 'bg-gray-100' };
        }
    };

    const getRelatedProductInfo = (log: AuditLog) => {
        if (!log.entityId) return null;

        if (log.entity === AuditEntityType.SALE) {
            const sale = saleMap[log.entityId];
            if (sale && sale.items.length > 0) {
                const firstItem = sale.items[0];
                const product = productMap[firstItem.productId];
                const modelName = product ? product.model : 'Produto desconhecido';
                const moreCount = sale.items.length - 1;
                return (
                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-500 bg-gray-50 p-2 rounded-xl border border-gray-100">
                        <ArchiveBoxIcon className="w-4 h-4 text-gray-400" />
                        <span>
                            {modelName}
                            {moreCount > 0 && <span className="text-xs ml-1 bg-gray-200 px-1.5 py-0.5 rounded-full">+{moreCount}</span>}
                        </span>
                    </div>
                );
            }
        }

        if (log.entity === AuditEntityType.PRODUCT) {
            const product = productMap[log.entityId];
            if (product) {
                // Build product identifiers string
                const identifiers = [];
                if (product.imei1) identifiers.push(`IMEI1: ${product.imei1}`);
                if (product.imei2) identifiers.push(`IMEI2: ${product.imei2}`);
                if (product.serialNumber) identifiers.push(`S/N: ${product.serialNumber}`);
                if (product.barcode) identifiers.push(`Cód: ${product.barcode}`);
                if (product.batteryHealth) identifiers.push(`Bateria: ${product.batteryHealth}%`);

                return (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 bg-gray-50 p-2 rounded-xl border border-gray-100">
                        <ArchiveBoxIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="font-medium">{product.model}</span>
                        {identifiers.length > 0 && (
                            <span className="text-xs text-gray-400">
                                | {identifiers.join(' | ')}
                            </span>
                        )}
                    </div>
                );
            }
        }

        // For Purchase/Stock Launch, it might be logged as PRODUCT with action STOCK_LAUNCH or maybe PURCHSE_ORDER
        // The mockApi seems to log STOCK_LAUNCH on PRODUCT entity for simple launches, but if we have PURCHASE_ORDER logs:
        if (log.entity === AuditEntityType.PURCHASE_ORDER) {
            const purchase = purchaseMap[log.entityId];
            if (purchase && purchase.items.length > 0) {
                const firstItem = purchase.items[0];
                const modelName = firstItem.productDetails.model; // Purchase items store details directly
                const moreCount = purchase.items.length - 1;
                return (
                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-500 bg-gray-50 p-2 rounded-xl border border-gray-100">
                        <ArchiveBoxIcon className="w-4 h-4 text-gray-400" />
                        <span>
                            {modelName}
                            {moreCount > 0 && <span className="text-xs ml-1 bg-gray-200 px-1.5 py-0.5 rounded-full">+{moreCount}</span>}
                        </span>
                    </div>
                );
            }
        }

        return null;
    };

    // Filtrar logs por período
    const filteredLogs = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        return logs.filter(log => {
            const logDate = new Date(log.timestamp);

            switch (periodFilter) {
                case 'last_hour':
                    return logDate >= oneHourAgo;
                case 'today':
                    return logDate >= today;
                case 'yesterday':
                    return logDate >= yesterday && logDate < today;
                case 'custom':
                    const customStart = new Date(customDate + 'T00:00:00');
                    const customEnd = new Date(customDate + 'T23:59:59');
                    return logDate >= customStart && logDate <= customEnd;
                default:
                    return true;
            }
        });
    }, [logs, periodFilter, customDate]);

    const logsByDay = useMemo(() => {
        return filteredLogs.reduce((acc, log) => {
            const dateKey = new Date(log.timestamp).toISOString().split('T')[0];
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(log);
            return acc;
        }, {} as Record<string, AuditLog[]>);
    }, [filteredLogs]);

    const sortedDateKeys = useMemo(() => Object.keys(logsByDay).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()), [logsByDay]);

    const formatDateHeader = (dateKey: string) => {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const logDate = new Date(dateKey + 'T00:00:00');

        if (logDate.toDateString() === today.toDateString()) return 'Hoje';
        if (logDate.toDateString() === yesterday.toDateString()) return 'Ontem';
        return logDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    if (loading) return <div className="flex justify-center items-center h-full p-8"><SpinnerIcon /></div>;

    return (
        <div className="bg-surface rounded-3xl border border-border p-4 md:p-6 shadow-sm">
            {/* Filtros de Período */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6 pb-4 border-b border-border">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-600 mr-1">Período:</span>
                    <button
                        onClick={() => setPeriodFilter('last_hour')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${periodFilter === 'last_hour'
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        Últ. hora
                    </button>
                    <button
                        onClick={() => setPeriodFilter('today')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${periodFilter === 'today'
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        Hoje
                    </button>
                    <button
                        onClick={() => setPeriodFilter('yesterday')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${periodFilter === 'yesterday'
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        Ontem
                    </button>
                </div>
                <div className="flex items-center w-full sm:w-auto">
                    <CustomDatePicker
                        value={customDate}
                        onChange={(val) => {
                            setCustomDate(val);
                            setPeriodFilter('custom');
                        }}
                        max={toDateValue()}
                        className="w-full"
                    />
                </div>
                <span className="text-xs text-gray-400 sm:ml-auto">
                    {filteredLogs.length} {filteredLogs.length === 1 ? 'evento' : 'eventos'}
                </span>
            </div>

            {filteredLogs.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <p className="text-lg font-medium">Nenhum evento encontrado</p>
                    <p className="text-sm mt-1">Não há logs de auditoria para o período selecionado.</p>
                </div>
            ) : (
                <div className="relative pl-8">
                    <div className="absolute left-[23px] top-0 bottom-0 w-0.5 bg-gray-200"></div>
                    {sortedDateKeys.map(dateKey => (
                        <div key={dateKey}>
                            <div className="relative -ml-8 mb-6 mt-8 first:mt-0">
                                <div className="bg-surface pr-4 inline-block relative z-10"><h3 className="font-bold text-lg text-primary">{formatDateHeader(dateKey)}</h3></div>
                            </div>
                            {logsByDay[dateKey].map((log) => {
                                const { Icon, color, bg } = getIconAndColor(log);

                                // Função para simplificar e traduzir os detalhes do log
                                const formatLogDetails = () => {
                                    const text = log.details;

                                    // Primeiro, tentar usar a tradução baseada na ação
                                    const actionText = translateAction(log.action);
                                    const entityText = translateEntity(log.entity);

                                    // Remover JSON técnico e simplificar
                                    if (text.includes('Item adicionado em ') || text.includes('Item atualizado em ') || text.includes('Item excluído de ')) {
                                        try {
                                            // Traduzir nome da tabela
                                            const tableTranslations: Record<string, string> = {
                                                'brands': 'Marca',
                                                'categories': 'Categoria',
                                                'product_models': 'Modelo',
                                                'grades': 'Grupo de Grade',
                                                'grade_values': 'Valor de Grade',
                                                'product_conditions': 'Condição',
                                                'storage_locations': 'Local de Estoque',
                                                'warranties': 'Garantia',
                                                'payment_methods': 'Método de Pagamento',
                                                'receipt_terms': 'Termo de Recebimento',
                                                'users': 'Usuário',
                                                'customers': 'Cliente',
                                                'suppliers': 'Fornecedor'
                                            };

                                            let tableName = '';
                                            let rawTableName = '';
                                            for (const [key, value] of Object.entries(tableTranslations)) {
                                                if (text.includes(key)) {
                                                    tableName = value;
                                                    rawTableName = key;
                                                    break;
                                                }
                                            }

                                            // Tentar extrair nome do JSON se houver
                                            const jsonStart = text.indexOf('{');
                                            if (jsonStart !== -1) {
                                                const jsonStr = text.substring(jsonStart);
                                                try {
                                                    const data = JSON.parse(jsonStr);
                                                    const itemName = data.name || data.id || '';

                                                    if (text.includes('adicionado')) return `${tableName || entityText} criado(a): ${itemName}`;
                                                    if (text.includes('atualizado')) return `${tableName || entityText} atualizado(a): ${itemName}`;
                                                    if (text.includes('excluído')) return `${tableName || entityText} excluído(a): ${itemName}`;
                                                } catch (e) {
                                                    // Se falhar o parse do resto da string, tentar o match anterior como fallback
                                                    const jsonMatch = text.match(/\{[^}]+\}/);
                                                    if (jsonMatch) {
                                                        const data = JSON.parse(jsonMatch[0]);
                                                        const itemName = data.name || data.id || '';
                                                        if (text.includes('adicionado')) return `${tableName || entityText} criado(a): ${itemName}`;
                                                        if (text.includes('atualizado')) return `${tableName || entityText} atualizado(a): ${itemName}`;
                                                        if (text.includes('excluído')) return `${tableName || entityText} excluído(a): ${itemName}`;
                                                    }
                                                }
                                            }
                                            // Se não tiver JSON, tentar extrair da própria string (ex: "Item excluído de grade_values: Azul")
                                            else {
                                                const parts = text.split(':');
                                                if (parts.length > 1) {
                                                    const itemName = parts[1].trim();
                                                    if (text.includes('adicionado')) return `${tableName || entityText} criado(a): ${itemName}`;
                                                    if (text.includes('atualizado')) return `${tableName || entityText} atualizado(a): ${itemName}`;
                                                    if (text.includes('excluído')) return `${tableName || entityText} excluído(a): ${itemName}`;
                                                } else if (tableName && rawTableName) {
                                                    // Caso sem nome explícito "Item excluído de grade_values"
                                                    if (text.includes('adicionado')) return `${tableName} criado(a)`;
                                                    if (text.includes('atualizado')) return `${tableName} atualizado(a)`;
                                                    if (text.includes('excluído')) return `${tableName} excluído(a)`;
                                                }
                                            }
                                        } catch (e) {
                                            // Fallback para texto original
                                        }
                                    }

                                    // Simplificar logs com JSON
                                    if (text.includes('Alterações: {') || text.includes('Dados: {')) {
                                        try {
                                            const separator = text.includes('Alterações: {') ? 'Alterações: ' : 'Dados: ';
                                            const [prefix, jsonPart] = text.split(separator);
                                            const data = JSON.parse(jsonPart);

                                            // Simplify payment method logs
                                            if (text.includes('payment_methods')) {
                                                const name = data.name || (data.config ? 'Configuração' : 'Item');
                                                if (prefix.includes('atualizado')) return `Método de Pagamento atualizado: ${name}`;
                                                if (prefix.includes('criado')) return `Novo Método de Pagamento: ${name}`;
                                                if (prefix.includes('removido')) return `Método de Pagamento removido: ${name}`;
                                                return `Método de Pagamento: ${name}`;
                                            }

                                            // Generic simplification - just return the name if available
                                            if (data.name) return `${actionText} - ${entityText}: ${data.name}`;
                                            return prefix.trim();
                                        } catch (e) {
                                            return text;
                                        }
                                    }

                                    return text;
                                };

                                return (
                                    <div key={log.id} className="relative mb-3 pl-2 group hover:bg-gray-50 rounded-xl -ml-2 p-1 transition-colors">
                                        <div className={`absolute left-0 top-2 transform -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center ${bg} ring-4 ring-surface shadow-sm`}><Icon className={`w-3.5 h-3.5 ${color}`} /></div>
                                        <div className="ml-6">
                                            <div className="text-sm leading-snug flex flex-wrap items-baseline gap-1">
                                                <span className="font-mono text-gray-400 text-xs tracking-tight">{new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                <span className="font-medium text-gray-800">{formatLogDetails()}</span>
                                                <span className="text-xs text-gray-400 opacity-60 ml-auto sm:ml-0">- {log.userName}</span>
                                            </div>
                                            {getRelatedProductInfo(log)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AuditSettings;
