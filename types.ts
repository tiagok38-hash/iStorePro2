
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
    internalNote?: string;
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
