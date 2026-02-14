
import React from 'react';

export interface PermissionSet {
    // Sidebar access & general viewing
    canAccessDashboard: boolean;
    canAccessEstoque: boolean;
    canAccessVendas: boolean;
    canAccessPOS: boolean;
    canAccessClientes: boolean;
    canAccessFornecedores: boolean;
    canAccessRelatorios: boolean;
    canAccessEmpresa: boolean;

    // Product permissions
    canCreateProduct: boolean;
    canEditProduct: boolean;
    canDeleteProduct: boolean;

    canEditStock: boolean;

    // Purchase permissions
    canViewPurchases: boolean;
    canCreatePurchase: boolean;
    canEditPurchase: boolean;
    canDeletePurchase: boolean;
    canLaunchPurchase: boolean;
    canViewPurchaseKPIs: boolean;

    // Sales permissions
    canCreateSale: boolean;
    canCancelSale: boolean;
    canViewSalesKPIs: boolean;
    canEditSale: boolean;

    // Company permissions
    canManageCompanyData: boolean;
    canManageUsers: boolean;
    canManagePermissions: boolean;
    canViewAudit: boolean;
    canEditOwnProfile: boolean;
    canManageMarcasECategorias: boolean;

    // granular customer permissions
    canCreateCustomer: boolean;
    canEditCustomer: boolean;
    canViewCustomerHistory: boolean;
    canInactivateCustomer: boolean;
    canDeleteCustomer: boolean;

    // granular supplier permissions
    canCreateSupplier: boolean;
    canEditSupplier: boolean;
    canViewSupplierHistory: boolean;
    canDeleteSupplier: boolean;

    canManagePaymentMethods: boolean;
    canManageBackups: boolean;
    canManageParameters: boolean;
    canAccessFinanceiro: boolean;
    canCreateTransaction: boolean;
    canEditTransaction: boolean;
    canDeleteTransaction: boolean;
    canViewFinancialKPIs: boolean;

    // Service Order permissions
    canAccessServiceOrders: boolean;
    canCreateServiceOrder: boolean;
    canEditServiceOrder: boolean;
    canDeleteServiceOrder: boolean;
    canManageServiceOrderStatus: boolean;

    // CRM permissions
    canAccessCrm: boolean;
    canCreateCrmDeal: boolean;
    canEditCrmDeal: boolean;
    canDeleteCrmDeal: boolean;
    canMoveCrmDeal: boolean;
    canViewAllCrmDeals: boolean;

    // Catalog permissions
    canAccessCatalog: boolean;
    canManageCatalog: boolean;
}

export interface PermissionProfile {
    id: string;
    name: string;
    permissions: PermissionSet;
}


export interface User {
    id: string;
    name: string;
    email: string;
    password?: string;
    permissionProfileId: string;
    phone: string;
    createdAt: string;
    avatarUrl?: string;
    address?: Address;
    lastSessionId?: string;
}

export interface Address {
    street: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city: string;
    state: string;
    zip: string;
}

export interface TradeInEntry {
    id: string;
    productId: string;
    date: string;
    value: number;
    model: string;
    serialNumber?: string;
    imei1?: string;
    imei2?: string;
    batteryHealth?: number;
    saleId: string;
    salespersonName: string;
}

export interface Customer {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: Address;
    createdAt: string;
    avatarUrl?: string;
    cpf?: string;
    rg?: string;
    birthDate?: string;
    isBlocked?: boolean;
    customTag?: string;
    tradeInHistory?: TradeInEntry[];
    instagram?: string;
    active?: boolean;
    credit_limit?: number;
    credit_used?: number;
    allow_credit?: boolean;
}


export type ProductCondition = 'Novo' | 'Seminovo' | 'CPO' | 'Openbox' | 'Reservado';

export interface PriceHistoryEntry {
    id: string;
    oldPrice: number;
    newPrice: number;
    changedBy: string;
    timestamp: string;
}

export interface StockHistoryEntry {
    id: string;
    oldStock: number;
    newStock: number;
    adjustment: number;
    reason: 'Entrada de Compra' | 'Ajuste Manual' | 'Venda' | 'Exclusão de Compra' | 'Venda Cancelada' | 'Edição de Produto' | 'Lançamento de Compra' | 'Cancelamento de Venda' | string;
    relatedId?: string;
    timestamp: string;
    changedBy: string;
    details?: string; // Additional info (e.g. Purchase ID, Client Name, Payment Method)
    previousLocation?: string;
    newLocation?: string;
}

export interface ProductVariation {
    gradeId: string;
    gradeName: string;
    valueId: string;
    valueName: string;
}

export interface ProductChecklist {
    [key: string]: boolean | string | number | undefined; // For toggle switches and text fields
    notes?: string;
    services?: string;
    checklistDate?: string;
    repairCost?: number;
}


export interface Product {
    id: string;
    sku: string;
    brand: string;
    category: string;
    model: string;
    price: number;
    wholesalePrice?: number; // Preço de Atacado (ATC)
    costPrice?: number;
    additionalCostPrice?: number;
    markup?: number;
    stock: number;
    minimumStock?: number;
    serialNumber: string;
    imei1: string;
    imei2?: string;
    batteryHealth: number;
    condition: ProductCondition;
    warranty: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    color?: string;
    storageLocation?: string;
    storage?: number;
    purchaseOrderId?: string;
    purchaseItemId?: string;
    supplierId?: string;
    priceHistory?: PriceHistoryEntry[];
    stockHistory?: StockHistoryEntry[];
    variations?: ProductVariation[];
    barcodes?: string[];
    origin?: 'Compra' | 'Troca' | 'Comprado de Cliente';
    checklist?: ProductChecklist;
    observations?: string;
    photos?: string[];
    accessories?: string[];
}

export interface Service {
    id: string;
    name: string;
    description?: string;
    price: number;
    cost: number;
    warranty?: string; // e.g. "90 dias", "3 meses"
    createdAt: string;
    updatedAt: string;
}

export interface ServiceOrderChecklist {
    scratch?: boolean;
    cracked_screen?: boolean;
    dented?: boolean;
    no_power?: boolean;
    no_wifi?: boolean;
    bad_battery?: boolean;
    front_camera_fail?: boolean;
    rear_camera_fail?: boolean;
    no_sound?: boolean;
    mic_fail?: boolean;
    others?: boolean;
    othersDescription?: string;
}

export interface ServiceOrderItem {
    id: string;
    description: string;
    type: 'service' | 'part';
    price: number;
    quantity: number;
}

export interface ServiceOrder {
    id: string;
    displayId: number;
    customerId: string;
    customerName: string;
    deviceModel: string;
    imei: string;
    serialNumber?: string;
    passcode?: string;
    patternLock?: number[];
    checklist: ServiceOrderChecklist;
    defectDescription: string;
    technicalReport?: string;
    observations?: string;
    status: 'Aberto' | 'Em Análise' | 'Aguardando Aprovação' | 'Aprovado' | 'Em Andamento' | 'Concluído' | 'Entregue' | 'Cancelado';
    items: ServiceOrderItem[];
    subtotal: number;
    discount: number;
    total: number;
    createdAt: string;
    updatedAt: string;
    responsibleId: string;
    responsibleName: string;
    photos?: string[];
    entryDate: string;
    exitDate?: string;
}

// FIX: Added CartItem interface to be used across components like NewSaleModal.
export interface CartItem extends Product {
    quantity: number;
    salePrice: number;
    discountType: '%' | 'R$';
    discountValue: number;
    priceType?: 'sale' | 'cost' | 'wholesale';
}

export interface SaleItem {
    productId: string;
    quantity: number;
    unitPrice: number;
    priceType?: 'sale' | 'cost' | 'wholesale';
}

export type PaymentMethodType = 'Pix' | 'Dinheiro' | 'Crédito' | 'Débito' | 'Aparelho na Troca' | 'Crediário' | string;

export interface Payment {
    id: string;
    method: PaymentMethodType;
    value: number;
    type?: string;
    fees?: number;
    feePercentage?: number;
    installments?: number;
    installmentsValue?: number;
    card?: string; // e.g. 'Crédito - Cartão de Crédito'
    tradeInDetails?: {
        productId?: string;
        model: string;
        serialNumber?: string;
        imei1?: string;
        imei2?: string;
        batteryHealth?: number;
        condition?: string;
        newProductPayload?: any;
    };
    creditDetails?: {
        entryAmount: number;
        installments: number;
        frequency: 'mensal' | 'quinzenal';
        firstDueDate: string;
        interestRate: number;
        totalAmount: number;
        installmentValue: number;
        totalInstallments: number;
    };
    internalNote?: string;
    pixVariation?: string; // Selected variation for Pix payments
}


export interface Sale {
    id: string;
    customerId: string;
    salespersonId: string;
    items: SaleItem[];
    subtotal: number;
    discount: number;
    total: number;
    payments: Payment[];
    date: string;
    posTerminal: string;
    status: 'Finalizada' | 'Pendente' | 'Cancelada' | 'Editada';
    origin: string;
    leadOrigin?: string;
    warrantyTerm?: string;
    observations?: string;
    internalObservations?: string;
    cancellationReason?: string;
    cashSessionId?: string;
    cashSessionDisplayId?: number;
}

export interface Supplier {
    id: string;
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
    cnpj: string;
    address: string;
    linkedCustomerId?: string;
    avatarUrl?: string;
    instagram?: string;
}

export interface PurchaseItem {
    id: string;
    productId?: string; // Link to existing product
    productDetails: {
        brand: string;
        category: string;
        subCategory?: string;
        model: string;
        color: string;
        condition: ProductCondition;
        warranty: string;
        storageLocation: string;
        imei1?: string;
        imei2?: string;
        serialNumber?: string;
        batteryHealth?: number;
    };
    quantity: number;
    unitCost: number;
    additionalUnitCost: number;
    finalUnitCost: number;
    hasImei?: boolean;
    minimumStock?: number;
    barcodes?: string[];
    controlByBarcode?: boolean;
}

export type StockStatus = 'Lançado' | 'Pendente' | 'Parcialmente Lançado' | 'Cancelada';
export type FinancialStatus = 'Pendente' | 'Pago';

export interface PurchaseOrder {
    id: string;
    displayId: number;
    locatorId: string;
    purchaseDate: string;
    origin: string;
    purchaseTerm?: string;
    supplierId: string;
    supplierName: string;
    items: PurchaseItem[];
    total: number;
    additionalCost: number;
    stockStatus: StockStatus;
    financialStatus: FinancialStatus;
    status?: 'Pendente' | 'Cancelada' | 'Finalizada';
    cancellationReason?: string;
    createdAt: string;
    createdBy: string;
    isCustomerPurchase?: boolean;
    observations?: string;
    dollarRate?: number;
    shippingCost?: number;
    shippingType?: 'R$' | 'US$' | '%';
}

export interface CashMovement {
    id: string;
    type: 'suprimento' | 'sangria';
    amount: number;
    reason: string;
    timestamp: string;
    userId: string;
}

export interface CashSession {
    id: string;
    displayId: number;
    openTime: string;
    closeTime?: string;
    status: 'aberto' | 'fechado';
    openingBalance: number; // Abertura
    withdrawals: number;    // Sangria
    deposits: number;       // Suprimento
    transactionsValue: number; // Movimentação
    cashInRegister: number;
    userId: string;
    movements?: CashMovement[];
}

export interface CreditSettings {
    id: string;
    defaultInterestRate: number;
    lateFeePercentage: number;
}

export interface CreditInstallment {
    id: string;
    saleId: string;
    customerId: string;
    installmentNumber: number;
    totalInstallments: number;
    dueDate: string;
    amount: number;
    status: 'pending' | 'paid' | 'partial' | 'overdue';
    amountPaid: number;
    interestApplied: number;
    penaltyApplied: number;
    paidAt?: string;
    paymentMethod?: string;
    observation?: string;
}

export interface TodaySale {
    id: string;
    time: string;
    product: string;
    amount: number;
    profit: number;
}

export interface Brand {
    id: string;
    name: string;
}

export interface Category {
    id: string;
    name: string;
    brandId: string;
}

export interface ProductModel {
    id: string;
    name: string;
    categoryId: string;
    imageUrl?: string;
}

export interface Grade {
    id: string;
    name: string;
}

export interface GradeValue {
    id: string;
    name: string;
    gradeId: string;
}

export enum AuditActionType {
    CREATE = 'CREATE',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
    SALE_CREATE = 'SALE_CREATE',
    SALE_CANCEL = 'SALE_CANCEL',
    STOCK_ADJUST = 'STOCK_ADJUST',
    STOCK_LAUNCH = 'STOCK_LAUNCH',
    PURCHASE_LAUNCH = 'PURCHASE_LAUNCH',
    STOCK_REVERT = 'STOCK_REVERT',
    LOGIN = 'LOGIN',
    LOGOUT = 'LOGOUT',
    CASH_OPEN = 'CASH_OPEN',
    CASH_CLOSE = 'CASH_CLOSE',
    CASH_WITHDRAWAL = 'CASH_WITHDRAWAL',
    CASH_SUPPLY = 'CASH_SUPPLY',
}

export enum AuditEntityType {
    PRODUCT = 'PRODUCT',
    CUSTOMER = 'CUSTOMER',
    SUPPLIER = 'SUPPLIER',
    SALE = 'SALE',
    PURCHASE_ORDER = 'PURCHASE_ORDER',
    USER = 'USER',
    PAYMENT_METHOD = 'PAYMENT_METHOD',
    BRAND = 'BRAND',
    CATEGORY = 'CATEGORY',
    PRODUCT_MODEL = 'PRODUCT_MODEL',
    GRADE = 'GRADE',
    GRADE_VALUE = 'GRADE_VALUE',
    WARRANTY = 'WARRANTY',
    STORAGE_LOCATION = 'STORAGE_LOCATION',
    CONDITION = 'CONDITION',
    RECEIPT_TERM = 'RECEIPT_TERM',
    PERMISSION_PROFILE = 'PERMISSION_PROFILE',
    CASH_SESSION = 'CASH_SESSION',
    SERVICE = 'SERVICE',
    SERVICE_ORDER = 'SERVICE_ORDER',
}

export interface AuditLog {
    id: string;
    timestamp: string;
    userId: string;
    userName: string;
    action: AuditActionType;
    entity: AuditEntityType;
    entityId?: string;
    details: string;
}

export interface ProductConditionParameter {
    id: string;
    name: string;
}

export interface StorageLocationParameter {
    id: string;
    name: string;
}

export interface WarrantyParameter {
    id: string;
    name: string;
    days: number;
}


export interface InstallmentRate {
    installments: number;
    rate: number;
}

export interface CardConfigData {
    debitRate: number;
    creditWithInterestRates: InstallmentRate[]; // Customer pays
    creditNoInterestRates: InstallmentRate[];   // Seller pays
}

export type PaymentMethodCategory = 'cash' | 'card' | 'pending';

export interface PaymentMethodParameter {
    id: string;
    name: string;
    type: PaymentMethodCategory;
    active: boolean;
    allowInternalNotes?: boolean;
    config?: CardConfigData;
    variations?: string[];
}

export interface CompanyInfo {
    id?: string;
    name: string;
    razaoSocial?: string;
    logoUrl?: string;
    cnpj?: string;
    inscricaoEstadual?: string;
    address?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    city?: string;
    state?: string;
    cep?: string;
    email?: string;
    whatsapp?: string;
    instagram?: string;
}


export interface ReceiptTermSection {
    content: string;
    showOnReceipt: boolean;
}

export interface ReceiptTermParameter {
    id: string;
    name: string;
    warrantyTerm?: ReceiptTermSection;
    warrantyExclusions?: ReceiptTermSection;
    imageRights?: ReceiptTermSection;
}

// Catalog Module
export interface CatalogItem {
    id: string;
    productId: string;
    displayOrder: number;
    costPrice: number;
    salePrice: number;
    cardPrice: number;
    installments: number;
    section: string;
    isActive: boolean;
    imageUrl?: string;
    imageUrls?: string[];
    condition: string;
    batteryHealth?: number;
    productName: string;
    productBrand: string;
    productCategory: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    // Joined from products table
    product?: Product;
}

// Financial Module
export interface TransactionCategory {
    id: string;
    name: string;
    type: 'income' | 'expense';
    group_name: string;
    icon?: string;
    color?: string;
    is_default?: boolean;
    company_id?: string;
}

export interface FinancialTransaction {
    id: string;
    type: 'income' | 'expense';
    description: string;
    amount: number;
    category_id: string;
    category?: TransactionCategory;
    due_date: string;
    payment_date?: string;
    status: 'pending' | 'paid' | 'overdue';
    payment_method?: string;
    entity_name?: string;
    entity_type?: 'customer' | 'supplier';
    is_recurring: boolean;
    recurrence_interval?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    attachment_url?: string;
    notes?: string;
    company_id?: string;
    created_by?: string;
    created_at: string;
    updated_at?: string;
}

// CRM Module
export type CrmColumn = 'new_leads' | 'negotiating' | 'awaiting_stock' | 'awaiting_payment' | 'won' | 'lost';
export type CrmPriority = 'hot' | 'warm' | 'cold';
export type CrmOrigin = 'instagram' | 'whatsapp' | 'indicacao' | 'passante' | 'olx' | 'site' | 'outro';

export interface CrmDeal {
    id: string;
    client_id?: string;
    client_name?: string;
    client_phone?: string;
    status_column: CrmColumn;
    value: number;
    product_interest?: string;
    priority: CrmPriority;
    origin?: CrmOrigin;
    assigned_to?: string;
    assigned_to_name?: string;
    follow_up_date?: string;
    notes?: string;
    sort_order: number;
    company_id?: string;
    created_by?: string;
    created_at: string;
    updated_at?: string;
}

export interface CrmActivity {
    id: string;
    deal_id: string;
    type: 'note' | 'status_change' | 'follow_up' | 'whatsapp' | 'call';
    content: string;
    created_by?: string;
    created_by_name?: string;
    created_at: string;
}
