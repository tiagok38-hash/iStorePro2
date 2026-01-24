
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PurchaseOrder, PurchaseItem, Supplier, ProductCondition, Product, Brand, Category, ProductModel, Grade, GradeValue, ProductVariation, Customer, ProductConditionParameter, StorageLocationParameter, WarrantyParameter, ReceiptTermParameter } from '../types.ts';
import { addPurchaseOrder, updatePurchaseOrder, formatCurrency, findOrCreateSupplierFromCustomer, getProductConditions, getStorageLocations, getWarranties, getReceiptTerms } from '../services/mockApi.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import { XCircleIcon, TrashIcon, PlusIcon, SpinnerIcon, BarcodeIcon, PrinterIcon, ArrowRightCircleIcon, CheckIcon, ChevronLeftIcon } from './icons.tsx';
import CurrencyInput from './CurrencyInput.tsx';
import SearchableDropdown from './SearchableDropdown.tsx';
import CustomerModal from './CustomerModal.tsx';

interface PurchaseOrderModalProps {
    suppliers: Supplier[];
    customers: Customer[];
    brands: Brand[];
    categories: Category[];
    productModels: ProductModel[];
    grades: Grade[];
    gradeValues: GradeValue[];
    onClose: (refresh: boolean) => void;
    purchaseOrderToEdit?: PurchaseOrder | null;
    onAddNewSupplier: (supplierData: Omit<Supplier, 'id'>) => Promise<Supplier | null>;
}

type CurrentItemType = Omit<PurchaseItem, 'id'> & { storage?: string, variations: ProductVariation[], barcode?: string };

const emptyItem: CurrentItemType = {
    productDetails: { brand: 'Apple', category: '', subCategory: '', model: '', color: '', condition: 'Novo', warranty: '1 ano', storageLocation: 'Estoque Principal' },
    barcode: '',
    quantity: 1,
    unitCost: 0,
    additionalUnitCost: 0,
    finalUnitCost: 0,
    hasImei: true,
    storage: '',
    variations: [],
    minimumStock: 1,
    controlByBarcode: false,
};

const appleProductHierarchy = {
    'Acessórios': {
        'Adaptador de energia USB-C de 20W': { 'Padrão': ['Branco'] },
        'Adaptador de energia USB-C de 35W com duas portas USB-C': { 'Padrão': ['Branco'] },
        'Adaptador de energia USB de 5W': { 'Padrão': ['Branco'] },
        'AirTag (1 un.)': { 'Padrão': ['Branco/Prata'] },
        'AirTag (Kit 4 un.)': { 'Padrão': ['Branco/Prata'] },
        'Apple Pencil 1 (2015, 1ª Geração) Lightning': { 'Padrão': ['Branco'] },
        'Apple Pencil 2 (2018, 2ª Geração)': { 'Padrão': ['Branco'] },
        'Apple Pencil Pro': { 'Padrão': ['Branco'] },
        'Apple Pencil USB-C (2023)': { 'Padrão': ['Branco'] },
        'Cabo carregador magnético para Apple Watch (1m) USB': { 'Padrão': ['Branco'] },
        'Cabo carregador magnético para Apple Watch (1m) USB-C': { 'Padrão': ['Branco'] },
        'Cabo de USB-C para Lightning (1m)': { 'Padrão': ['Branco'] },
        'Cabo de USB-C para Lightning (2m)': { 'Padrão': ['Branco'] },
        'Cabo de USB para Lightning (1m)': { 'Padrão': ['Branco'] },
        'Cabo de USB para Lightning (2m)': { 'Padrão': ['Branco'] },
        'Cabo USB-C 60W (1m)': { 'Padrão': ['Branco'] },
        'Cabo USB-C 60W (2m)': { 'Padrão': ['Branco'] },
        'Carregador MagSafe 20W': { 'Padrão': ['Branco'] },
        'Magic Keyboard com teclado numérico (USB-C) com Touch ID': { 'Padrão': ['Branco', 'Preto'] },
        'Magic Keyboard com teclado numérico (USB-C) sem Touch ID': { 'Padrão': ['Branco', 'Preto'] },
        'Magic Keyboard Folio para iPad (10ª geração)': { 'Padrão': ['Branco', 'Preto'] },
        'Magic Keyboard para iPad Air M2 de 11" polegadas': { 'Padrão': ['Branco', 'Preto'] },
        'Magic Keyboard para iPad Air M2 de 13" polegadas': { 'Padrão': ['Branco', 'Preto'] },
        'Magic Keyboard para iPad Pro M4 de 11" polegadas': { 'Padrão': ['Branco', 'Preto'] },
        'Magic Keyboard para iPad Pro M4 de 13" polegadas': { 'Padrão': ['Branco', 'Preto'] },
        'Magic Keyboard (USB-C) com Touch ID': { 'Padrão': ['Branco', 'Preto'] },
        'Magic Keyboard (USB-C) sem Touch ID': { 'Padrão': ['Branco', 'Preto'] },
        'Magic Mouse 2': { 'Padrão': ['Branco', 'Preto'] },
        'Magic Trackpad': { 'Padrão': ['Branco', 'Preto'] },
        'Smart Keyboard para iPad 7/8/9': { 'Padrão': ['Cinza', 'Preto'] }
    },
    'AirPods': {
        'AirPods 2': { 'Padrão': ['Branco'] },
        'AirPods 3': { 'Padrão': ['Branco'] },
        'AirPods 4': { 'Padrão': ['Branco'] },
        'AirPods 4 com Cancelamento Ativo de Ruído': { 'Padrão': ['Branco'] },
        'AirPods Max': { 'Padrão': ['Green', 'Pink', 'Silver', 'Sky Blue', 'Space Gray'] },
        'AirPods Max (2024)': { 'Padrão': ['Green', 'Pink', 'Silver', 'Sky Blue', 'Space Gray'] },
        'AirPods Pro 1': { 'Padrão': ['Branco'] },
        'AirPods Pro 2': { 'Padrão': ['Branco'] },
        'AirPods Pro 3': { 'Padrão': ['Branco'] }
    },
    'EarPods': {
        'Conector Lightning': { 'Padrão': ['Branco'] },
        'Conector USB-C': { 'Padrão': ['Branco'] },
        'Conector de 3,5 mm': { 'Padrão': ['Branco'] }
    },
    'iPad': {
        'iPad 10 (2022) 10,9″ Wi-Fi': { '64GB': ['Azul', 'Rosa', 'Amarelo', 'Prata (Silver)'], '256GB': ['Azul', 'Rosa', 'Amarelo', 'Prata (Silver)'] },
        'iPad 10 (2022) 10,9″ Wi-Fi + Cellular': { '64GB': ['Azul', 'Rosa', 'Amarelo', 'Prata (Silver)'], '256GB': ['Azul', 'Rosa', 'Amarelo', 'Prata (Silver)'] },
        'iPad 11 (2025) 10,9″ Wi-Fi': { '128GB': ['Azul', 'Prata (Silver)', 'Rosa', 'Amarelo'], '256GB': ['Azul', 'Prata (Silver)', 'Rosa', 'Amarelo'], '512GB': ['Azul', 'Prata (Silver)', 'Rosa', 'Amarelo'] },
        'iPad 11 (2025) 10,9″ Wi-Fi + Cellular': { '128GB': ['Azul', 'Prata (Silver)', 'Rosa', 'Amarelo'], '256GB': ['Azul', 'Prata (Silver)', 'Rosa', 'Amarelo'], '512GB': ['Azul', 'Prata (Silver)', 'Rosa', 'Amarelo'] },
        'iPad 9 (2021) 10,2″ Wi-Fi': { '64GB': ['Cinza-espacial (Space Gray)', 'Prata (Silver)', 'Dourado (Gold)'], '256GB': ['Cinza-espacial (Space Gray)', 'Prata (Silver)', 'Dourado (Gold)'] },
        'iPad 9 (2021) 10,2″ Wi-Fi + Cellular': { '64GB': ['Cinza-espacial', 'Prata', 'Dourado'], '256GB': ['Cinza-espacial', 'Prata', 'Dourado'] },
        'iPad Air 4 (2020) 10,9″ Wi-Fi': { '64GB': ['Cinza-espacial (Space Gray)', 'Prata (Silver)', 'Verde (Green)', 'Ouro-rosa (Rose Gold)', 'Azul-céu (Sky Blue)'], '256GB': ['Cinza-espacial (Space Gray)', 'Prata (Silver)', 'Verde (Green)', 'Ouro-rosa (Rose Gold)', 'Azul-céu (Sky Blue)'] },
        'iPad Air 4 (2020) 10,9″ Wi-Fi + Cellular': { '64GB': ['Cinza-espacial', 'Prata', 'Verde', 'Ouro-rosa', 'Azul-céu'], '256GB': ['Cinza-espacial', 'Prata', 'Verde', 'Ouro-rosa', 'Azul-céu'] },
        'iPad Air 5 M1 (2022) 10,9″ Wi-Fi': { '64GB': ['Cinza-espacial (Space Gray)', 'Starlight', 'Midnight', 'Azul (Blue)'], '256GB': ['Cinza-espacial (Space Gray)', 'Starlight', 'Midnight', 'Azul (Blue)'] },
        'iPad Air 5 M1 (2022) 10,9″ Wi-Fi + Cellular': { '64GB': ['Cinza-espacial', 'Starlight', 'Midnight', 'Azul'], '256GB': ['Cinza-espacial', 'Starlight', 'Midnight', 'Azul'] },
        'iPad Air M2 (2024) 11″ Wi-Fi': { '128GB': ['Cinza-espacial (Space Gray)', 'Prata (Silver)', 'Azul (Blue)', 'Roxo (Purple)'], '256GB': ['Cinza-espacial (Space Gray)', 'Prata (Silver)', 'Azul (Blue)', 'Roxo (Purple)'], '512GB': ['Cinza-espacial (Space Gray)', 'Prata (Silver)', 'Azul (Blue)', 'Roxo (Purple)'], '1TB': ['Cinza-espacial (Space Gray)', 'Prata (Silver)', 'Azul (Blue)', 'Roxo (Purple)'] },
        'iPad Air M2 (2024) 11″ Wi-Fi + Cellular': { '128GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '256GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '512GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '1TB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'] },
        'iPad Air M2 (2024) 13″ Wi-Fi': { '128GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '256GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '512GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '1TB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'] },
        'iPad Air M2 (2024) 13″ Wi-Fi + Cellular': { '128GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '256GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '512GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '1TB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'] },
        'iPad Air M3 (2025) 11″ Wi-Fi': { '128GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '256GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '512GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '1TB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'] },
        'iPad Air M3 (2025) 11″ Wi-Fi + Cellular': { '128GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '256GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '512GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '1TB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'] },
        'iPad Air M3 (2025) 13″ Wi-Fi': { '128GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '256GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '512GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '1TB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'] },
        'iPad Air M3 (2025) 13″ Wi-Fi + Cellular': { '128GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '256GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '512GB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'], '1TB': ['Cinza-espacial', 'Prata', 'Azul', 'Roxo'] },
        'iPad mini 6 (2021) 8,3″': { '64GB': ['Azul', 'Roxo', 'Estelar (Starlight)', 'Cinza-espacial'], '256GB': ['Azul', 'Roxo', 'Estelar (Starlight)', 'Cinza-espacial'] },
        'iPad mini 7 (2024) 8,3″': { '128GB': ['Cinza-espacial', 'Estelar (Starlight)', 'Roxo (Purple)', 'Azul (Blue)'], '256GB': ['Cinza-espacial', 'Estelar (Starlight)', 'Roxo (Purple)', 'Azul (Blue)'], '512GB': ['Cinza-espacial', 'Estelar (Starlight)', 'Roxo (Purple)', 'Azul (Blue)'] },
        'iPad Pro 3 M1 (2021) 11″ Wi-Fi': { '128GB': ['Prata (Silver)', 'Cinza-espacial (Space Gray)'], '256GB': ['Prata (Silver)', 'Cinza-espacial (Space Gray)'], '512GB': ['Prata (Silver)', 'Cinza-espacial (Space Gray)'], '1TB': ['Prata (Silver)', 'Cinza-espacial (Space Gray)'], '2TB': ['Prata (Silver)', 'Cinza-espacial (Space Gray)'] },
        'iPad Pro 3 M1 (2021) 11″ Wi-Fi + Cellular': { '128GB': ['Prata', 'Cinza-espacial'], '256GB': ['Prata', 'Cinza-espacial'], '512GB': ['Prata', 'Cinza-espacial'], '1TB': ['Prata', 'Cinza-espacial'], '2TB': ['Prata', 'Cinza-espacial'] },
        'iPad Pro 4 M2 (2022) 11″ Wi-Fi': { '128GB': ['Prata', 'Cinza-espacial'], '256GB': ['Prata', 'Cinza-espacial'], '512GB': ['Prata', 'Cinza-espacial'], '1TB': ['Prata', 'Cinza-espacial'], '2TB': ['Prata', 'Cinza-espacial'] },
        'iPad Pro 4 M2 (2022) 11″ Wi-Fi + Cellular': { '128GB': ['Prata', 'Cinza-espacial'], '256GB': ['Prata', 'Cinza-espacial'], '512GB': ['Prata', 'Cinza-espacial'], '1TB': ['Prata', 'Cinza-espacial'], '2TB': ['Prata', 'Cinza-espacial'] },
        'iPad Pro 4 M2 (2022) 12,9″ Wi-Fi': { '128GB': ['Prata', 'Cinza-espacial'], '256GB': ['Prata', 'Cinza-espacial'], '512GB': ['Prata', 'Cinza-espacial'], '1TB': ['Prata', 'Cinza-espacial'], '2TB': ['Prata', 'Cinza-espacial'] },
        'iPad Pro 4 M2 (2022) 12,9″ Wi-Fi + Cellular': { '128GB': ['Prata', 'Cinza-espacial'], '256GB': ['Prata', 'Cinza-espacial'], '512GB': ['Prata', 'Cinza-espacial'], '1TB': ['Prata', 'Cinza-espacial'], '2TB': ['Prata', 'Cinza-espacial'] },
        'iPad Pro M4 (2024) 11″ Wi-Fi': { '256GB': ['Prata', 'Preto-espacial (Space Black)'], '512GB': ['Prata', 'Preto-espacial (Space Black)'], '1TB': ['Prata', 'Preto-espacial (Space Black)'], '2TB': ['Prata', 'Preto-espacial (Space Black)'] },
        'iPad Pro M4 (2024) 11″ Wi-Fi + Cellular': { '256GB': ['Prata', 'Preto-espacial'], '512GB': ['Prata', 'Preto-espacial'], '1TB': ['Prata', 'Preto-espacial'], '2TB': ['Prata', 'Preto-espacial'] },
        'iPad Pro M4 (2024) 13″ Wi-Fi': { '256GB': ['Prata', 'Preto-espacial'], '512GB': ['Prata', 'Preto-espacial'], '1TB': ['Prata', 'Preto-espacial'], '2TB': ['Prata', 'Preto-espacial'] },
        'iPad Pro M4 (2024) 13″ Wi-Fi + Cellular': { '256GB': ['Prata', 'Preto-espacial'], '512GB': ['Prata', 'Preto-espacial'], '1TB': ['Prata', 'Preto-espacial'], '2TB': ['Prata', 'Preto-espacial'] }
    },
    'iPhone': {
        'iPhone 6s': { '16GB': ['Cinza-espacial', 'Prata', 'Dourado', 'Ouro Rosa'], '32GB': ['Cinza-espacial', 'Prata', 'Dourado', 'Ouro Rosa'], '64GB': ['Cinza-espacial', 'Prata', 'Dourado', 'Ouro Rosa'], '128GB': ['Cinza-espacial', 'Prata', 'Dourado', 'Ouro Rosa'], },
        'iPhone 6s Plus': { '16GB': ['Cinza-espacial', 'Prata', 'Dourado', 'Ouro Rosa'], '32GB': ['Cinza-espacial', 'Prata', 'Dourado', 'Ouro Rosa'], '64GB': ['Cinza-espacial', 'Prata', 'Dourado', 'Ouro Rosa'], '128GB': ['Cinza-espacial', 'Prata', 'Dourado', 'Ouro Rosa'], },
        'iPhone 7': { '32GB': ['Preto (Matte)', 'Preto Brilhante (Jet Black)', 'Prata', 'Dourado', 'Ouro Rosa', '(PRODUCT)RED'], '128GB': ['Preto (Matte)', 'Preto Brilhante (Jet Black)', 'Prata', 'Dourado', 'Ouro Rosa', '(PRODUCT)RED'], '256GB': ['Preto (Matte)', 'Preto Brilhante (Jet Black)', 'Prata', 'Dourado', 'Ouro Rosa', '(PRODUCT)RED'], },
        'iPhone 7 Plus': { '32GB': ['Preto (Matte)', 'Preto Brilhante (Jet Black)', 'Prata', 'Dourado', 'Ouro Rosa', '(PRODUCT)RED'], '128GB': ['Preto (Matte)', 'Preto Brilhante (Jet Black)', 'Prata', 'Dourado', 'Ouro Rosa', '(PRODUCT)RED'], '256GB': ['Preto (Matte)', 'Preto Brilhante (Jet Black)', 'Prata', 'Dourado', 'Ouro Rosa', '(PRODUCT)RED'], },
        'iPhone 8': { '64GB': ['Cinza-espacial', 'Prata', 'Dourado', '(PRODUCT)RED'], '128GB': ['Cinza-espacial', 'Prata', 'Dourado', '(PRODUCT)RED'], '256GB': ['Cinza-espacial', 'Prata', 'Dourado', '(PRODUCT)RED'], },
        'iPhone 8 Plus': { '64GB': ['Cinza-espacial', 'Prata', 'Dourado', '(PRODUCT)RED'], '128GB': ['Cinza-espacial', 'Prata', 'Dourado', '(PRODUCT)RED'], '256GB': ['Cinza-espacial', 'Prata', 'Dourado', '(PRODUCT)RED'], },
        'iPhone X': { '64GB': ['Cinza-espacial', 'Prata'], '256GB': ['Cinza-espacial', 'Prata'], },
        'iPhone XR': { '64GB': ['Preto', 'Branco', 'Azul', 'Amarelo', 'Coral', '(PRODUCT)RED'], '128GB': ['Preto', 'Branco', 'Azul', 'Amarelo', 'Coral', '(PRODUCT)RED'], '256GB': ['Preto', 'Branco', 'Azul', 'Amarelo', 'Coral', '(PRODUCT)RED'], },
        'iPhone XS': { '64GB': ['Cinza-espacial', 'Prata', 'Dourado'], '256GB': ['Cinza-espacial', 'Prata', 'Dourado'], '512GB': ['Cinza-espacial', 'Prata', 'Dourado'], },
        'iPhone XS Max': { '64GB': ['Cinza-espacial', 'Prata', 'Dourado'], '256GB': ['Cinza-espacial', 'Prata', 'Dourado'], '512GB': ['Cinza-espacial', 'Prata', 'Dourado'], },
        'iPhone 11': { '64GB': ['Preto', 'Branco', 'Roxo', 'Verde', 'Amarelo', '(PRODUCT)RED'], '128GB': ['Preto', 'Branco', 'Roxo', 'Verde', 'Amarelo', '(PRODUCT)RED'], '256GB': ['Preto', 'Branco', 'Roxo', 'Verde', 'Amarelo', '(PRODUCT)RED'], },
        'iPhone 11 Pro': { '64GB': ['Verde Meia-Noite', 'Cinza-espacial', 'Prata', 'Dourado'], '256GB': ['Verde Meia-Noite', 'Cinza-espacial', 'Prata', 'Dourado'], '512GB': ['Verde Meia-Noite', 'Cinza-espacial', 'Prata', 'Dourado'], },
        'iPhone 11 Pro Max': { '64GB': ['Verde Meia-Noite', 'Cinza-espacial', 'Prata', 'Dourado'], '256GB': ['Verde Meia-Noite', 'Cinza-espacial', 'Prata', 'Dourado'], '512GB': ['Verde Meia-Noite', 'Cinza-espacial', 'Prata', 'Dourado'], },
        'iPhone 12 mini': { '64GB': ['Preto', 'Branco', 'Roxo', 'Azul', 'Verde', '(PRODUCT)RED'], '128GB': ['Preto', 'Branco', 'Roxo', 'Azul', 'Verde', '(PRODUCT)RED'], '256GB': ['Preto', 'Branco', 'Roxo', 'Azul', 'Verde', '(PRODUCT)RED'], },
        'iPhone 12': { '64GB': ['Preto', 'Branco', 'Roxo', 'Azul', 'Verde', '(PRODUCT)RED'], '128GB': ['Preto', 'Branco', 'Roxo', 'Azul', 'Verde', '(PRODUCT)RED'], '256GB': ['Preto', 'Branco', 'Roxo', 'Azul', 'Verde', '(PRODUCT)RED'], },
        'iPhone 12 Pro': { '128GB': ['Grafite', 'Prata', 'Dourado', 'Azul-Pacífico'], '256GB': ['Grafite', 'Prata', 'Dourado', 'Azul-Pacífico'], '512GB': ['Grafite', 'Prata', 'Dourado', 'Azul-Pacífico'], },
        'iPhone 12 Pro Max': { '128GB': ['Grafite', 'Prata', 'Dourado', 'Azul-Pacífico'], '256GB': ['Grafite', 'Prata', 'Dourado', 'Azul-Pacífico'], '512GB': ['Grafite', 'Prata', 'Dourado', 'Azul-Pacífico'], },
        'iPhone 13 mini': { '128GB': ['Meia-noite', 'Estelar', 'Rosa', 'Azul', 'Verde', '(PRODUCT)RED'], '256GB': ['Meia-noite', 'Estelar', 'Rosa', 'Azul', 'Verde', '(PRODUCT)RED'], '512GB': ['Meia-noite', 'Estelar', 'Rosa', 'Azul', 'Verde', '(PRODUCT)RED'], },
        'iPhone 13': { '128GB': ['Meia-noite', 'Estelar', 'Rosa', 'Azul', 'Verde', '(PRODUCT)RED'], '256GB': ['Meia-noite', 'Estelar', 'Rosa', 'Azul', 'Verde', '(PRODUCT)RED'], '512GB': ['Meia-noite', 'Estelar', 'Rosa', 'Azul', 'Verde', '(PRODUCT)RED'], },
        'iPhone 13 Pro': { '128GB': ['Grafite', 'Prata', 'Dourado', 'Azul-Sierra', 'Verde-alpino'], '256GB': ['Grafite', 'Prata', 'Dourado', 'Azul-Sierra', 'Verde-alpino'], '512GB': ['Grafite', 'Prata', 'Dourado', 'Azul-Sierra', 'Verde-alpino'], '1TB': ['Grafite', 'Prata', 'Dourado', 'Azul-Sierra', 'Verde-alpino'], },
        'iPhone 13 Pro Max': { '128GB': ['Grafite', 'Prata', 'Dourado', 'Azul-Sierra', 'Verde-alpino'], '256GB': ['Grafite', 'Prata', 'Dourado', 'Azul-Sierra', 'Verde-alpino'], '512GB': ['Grafite', 'Prata', 'Dourado', 'Azul-Sierra', 'Verde-alpino'], '1TB': ['Grafite', 'Prata', 'Dourado', 'Azul-Sierra', 'Verde-alpino'], },
        'iPhone 14': { '128GB': ['Meia-noite', 'Roxo', 'Estelar', 'Azul', 'Amarelo', '(PRODUCT)RED'], '256GB': ['Meia-noite', 'Roxo', 'Estelar', 'Azul', 'Amarelo', '(PRODUCT)RED'], '512GB': ['Meia-noite', 'Roxo', 'Estelar', 'Azul', 'Amarelo', '(PRODUCT)RED'], },
        'iPhone 14 Plus': { '128GB': ['Meia-noite', 'Roxo', 'Estelar', 'Azul', 'Amarelo', '(PRODUCT)RED'], '256GB': ['Meia-noite', 'Roxo', 'Estelar', 'Azul', 'Amarelo', '(PRODUCT)RED'], '512GB': ['Meia-noite', 'Roxo', 'Estelar', 'Azul', 'Amarelo', '(PRODUCT)RED'], },
        'iPhone 14 Pro': { '128GB': ['Roxo-profundo', 'Preto-espacial', 'Prata', 'Dourado'], '256GB': ['Roxo-profundo', 'Preto-espacial', 'Prata', 'Dourado'], '512GB': ['Roxo-profundo', 'Preto-espacial', 'Prata', 'Dourado'], '1TB': ['Roxo-profundo', 'Preto-espacial', 'Prata', 'Dourado'], },
        'iPhone 14 Pro Max': { '128GB': ['Roxo-profundo', 'Preto-espacial', 'Prata', 'Dourado'], '256GB': ['Roxo-profundo', 'Preto-espacial', 'Prata', 'Dourado'], '512GB': ['Roxo-profundo', 'Preto-espacial', 'Prata', 'Dourado'], '1TB': ['Roxo-profundo', 'Preto-espacial', 'Prata', 'Dourado'], },
        'iPhone 15': { '128GB': ['Preto', 'Azul', 'Verde', 'Amarelo', 'Rosa'], '256GB': ['Preto', 'Azul', 'Verde', 'Amarelo', 'Rosa'], '512GB': ['Preto', 'Azul', 'Verde', 'Amarelo', 'Rosa'], },
        'iPhone 15 Plus': { '128GB': ['Preto', 'Azul', 'Verde', 'Amarelo', 'Rosa'], '256GB': ['Preto', 'Azul', 'Verde', 'Amarelo', 'Rosa'], '512GB': ['Preto', 'Azul', 'Verde', 'Amarelo', 'Rosa'], },
        'iPhone 15 Pro': { '128GB': ['Titânio Preto', 'Titânio Branco', 'Titânio Azul', 'Titânio Natural'], '256GB': ['Titânio Preto', 'Titânio Branco', 'Titânio Azul', 'Titânio Natural'], '512GB': ['Titânio Preto', 'Titânio Branco', 'Titânio Azul', 'Titânio Natural'], '1TB': ['Titânio Preto', 'Titânio Branco', 'Titânio Azul', 'Titânio Natural'], },
        'iPhone 15 Pro Max': { '256GB': ['Titânio Preto', 'Titânio Branco', 'Titânio Azul', 'Titânio Natural'], '512GB': ['Titânio Preto', 'Titânio Branco', 'Titânio Azul', 'Titânio Natural'], '1TB': ['Titânio Preto', 'Titânio Branco', 'Titânio Azul', 'Titânio Natural'], },
        'iPhone 16': { '128GB': ['Preto', 'Branco', 'Rosa', 'Verde-azulado (Teal)', 'Ultramarino'], '256GB': ['Preto', 'Branco', 'Rosa', 'Verde-azulado (Teal)', 'Ultramarino'], '512GB': ['Preto', 'Branco', 'Rosa', 'Verde-azulado (Teal)', 'Ultramarino'], },
        'iPhone 16 Plus': { '128GB': ['Preto', 'Branco', 'Rosa', 'Verde-azulado (Teal)', 'Ultramarino'], '256GB': ['Preto', 'Branco', 'Rosa', 'Verde-azulado (Teal)', 'Ultramarino'], '512GB': ['Preto', 'Branco', 'Rosa', 'Verde-azulado (Teal)', 'Ultramarino'], },
        'iPhone 16 Pro': { '128GB': ['Titânio Preto', 'Titânio Branco', 'Titânio Natural', 'Titânio Deserto'], '256GB': ['Titânio Preto', 'Titânio Branco', 'Titânio Natural', 'Titânio Deserto'], '512GB': ['Titânio Preto', 'Titânio Branco', 'Titânio Natural', 'Titânio Deserto'], '1TB': ['Titânio Preto', 'Titânio Branco', 'Titânio Natural', 'Titânio Deserto'], },
        'iPhone 16 Pro Max': { '256GB': ['Titânio Preto', 'Titânio Branco', 'Titânio Natural', 'Titânio Deserto'], '512GB': ['Titânio Preto', 'Titânio Branco', 'Titânio Natural', 'Titânio Deserto'], '1TB': ['Titânio Preto', 'Titânio Branco', 'Titânio Natural', 'Titânio Deserto'], },
        'iPhone 17': { '256GB': ['Preto', 'Branco', 'Azul Névoa', 'Sálvia', 'Lavanda'], '512GB': ['Preto', 'Branco', 'Azul Névoa', 'Sálvia', 'Lavanda'], },
        'iPhone Air': { '256GB': ['Preto Espacial', 'Branco Nuvem', 'Dourado Claro', 'Azul Céu'], '512GB': ['Preto Espacial', 'Branco Nuvem', 'Dourado Claro', 'Azul Céu'], '1TB': ['Preto Espacial', 'Branco Nuvem', 'Dourado Claro', 'Azul Céu'], },
        'iPhone 17 Pro': { '256GB': ['Laranja Cósmico', 'Azul Profundo', 'Prateado'], '512GB': ['Laranja Cósmico', 'Azul Profundo', 'Prateado'], '1TB': ['Laranja Cósmico', 'Azul Profundo', 'Prateado'], '2TB': ['Laranja Cósmico', 'Azul Profundo', 'Prateado'], },
        'iPhone 17 Pro Max': { '256GB': ['Laranja Cósmico', 'Azul Profundo', 'Prateado'], '512GB': ['Laranja Cósmico', 'Azul Profundo', 'Prateado'], '1TB': ['Laranja Cósmico', 'Azul Profundo', 'Prateado'], '2TB': ['Laranja Cósmico', 'Azul Profundo', 'Prateado'], },
    },
    'Mac': {
        'MacBook Pro (2024, 14") M4 Max': {
            '36GB/1TB': ['Preto-espacial', 'Prateado'],
            '48GB/1TB': ['Preto-espacial', 'Prateado'],
            '64GB/2TB': ['Preto-espacial', 'Prateado'],
            '128GB/4TB': ['Preto-espacial', 'Prateado']
        },
        'MacBook Pro (2024, 16") M4 Max': {
            '36GB/1TB': ['Preto-espacial', 'Prateado'],
            '48GB/1TB': ['Preto-espacial', 'Prateado'],
            '64GB/2TB': ['Preto-espacial', 'Prateado'],
            '128GB/4TB': ['Preto-espacial', 'Prateado']
        },
        'MacBook Pro (2024, 16") M4 Pro': {
            '24GB/512GB': ['Preto-espacial', 'Prateado'],
            '24GB/1TB': ['Preto-espacial', 'Prateado'],
            '48GB/1TB': ['Preto-espacial', 'Prateado']
        },
        'Mac Mini M4 (2024)': {
            '16GB/256GB': ['Prateado'],
            '16GB/512GB': ['Prateado'],
            '24GB/512GB': ['Prateado']
        },
        'Mac Mini M4 Pro (2024)': {
            '24GB/512GB': ['Prateado'],
            '24GB/1TB': ['Prateado'],
            '32GB/1TB': ['Prateado']
        },
        'Mac Studio M2 Max (2023)': {
            '32GB/512GB': ['Prateado'],
            '64GB/1TB': ['Prateado']
        },
        'Mac Studio M2 Ultra (2023)': {
            '64GB/1TB': ['Prateado'],
            '96GB/2TB': ['Prateado'],
            '128GB/2TB': ['Prateado']
        },
        'MacBook Air (2017, 13") Intel': {
            '8GB/128GB': ['Prata'],
            '8GB/256GB': ['Prata']
        },
        'MacBook Air (2018, 13") Intel': {
            '8GB/128GB': ['Prata', 'Dourado', 'Cinza-espacial'],
            '8GB/256GB': ['Prata', 'Dourado', 'Cinza-espacial'],
            '16GB/256GB': ['Prata', 'Dourado', 'Cinza-espacial']
        },
        'MacBook Air (2019, 13") Intel': {
            '8GB/128GB': ['Prata', 'Dourado', 'Cinza-espacial'],
            '8GB/256GB': ['Prata', 'Dourado', 'Cinza-espacial'],
            '16GB/256GB': ['Prata', 'Dourado', 'Cinza-espacial']
        },
        'MacBook Air (2020, 13") Intel': {
            '8GB/256GB': ['Prata', 'Dourado', 'Cinza-espacial'],
            '8GB/512GB': ['Prata', 'Dourado', 'Cinza-espacial'],
            '16GB/256GB': ['Prata', 'Dourado', 'Cinza-espacial'],
            '16GB/512GB': ['Prata', 'Dourado', 'Cinza-espacial']
        },
        'MacBook Air (2020, 13.3") M1': {
            '8GB/256GB': ['Prata', 'Dourado', 'Cinza-espacial'],
            '8GB/512GB': ['Prata', 'Dourado', 'Cinza-espacial'],
            '16GB/256GB': ['Prata', 'Dourado', 'Cinza-espacial'],
            '16GB/512GB': ['Prata', 'Dourado', 'Cinza-espacial']
        },
        'MacBook Air (2022, 13.6") M2': {
            '8GB/256GB': ['Meia-noite', 'Estelar', 'Prateado', 'Cinza-espacial'],
            '8GB/512GB': ['Meia-noite', 'Estelar', 'Prateado', 'Cinza-espacial'],
            '16GB/256GB': ['Meia-noite', 'Estelar', 'Prateado', 'Cinza-espacial'],
            '16GB/512GB': ['Meia-noite', 'Estelar', 'Prateado', 'Cinza-espacial'],
            '24GB/512GB': ['Meia-noite', 'Estelar', 'Prateado', 'Cinza-espacial']
        },
        'MacBook Air (2023, 15") M2': {
            '8GB/256GB': ['Meia-noite', 'Estelar', 'Prateado', 'Cinza-espacial'],
            '8GB/512GB': ['Meia-noite', 'Estelar', 'Prateado', 'Cinza-espacial'],
            '16GB/512GB': ['Meia-noite', 'Estelar', 'Prateado', 'Cinza-espacial'],
            '24GB/1TB': ['Meia-noite', 'Estelar', 'Prateado', 'Cinza-espacial']
        },
        'MacBook Air (2024, 13") M3 (8-core/10-core GPU)': {
            '8GB/256GB': ['Meia-noite', 'Estelar', 'Prateado', 'Cinza-espacial'],
            '8GB/512GB': ['Meia-noite', 'Estelar', 'Prateado', 'Cinza-espacial'],
            '16GB/512GB': ['Meia-noite', 'Estelar', 'Prateado', 'Cinza-espacial'],
            '24GB/1TB': ['Meia-noite', 'Estelar', 'Prateado', 'Cinza-espacial']
        },
        'MacBook Air (2024, 15") M3': {
            '8GB/256GB': ['Meia-noite', 'Estelar', 'Prateado', 'Cinza-espacial'],
            '8GB/512GB': ['Meia-noite', 'Estelar', 'Prateado', 'Cinza-espacial'],
            '16GB/512GB': ['Meia-noite', 'Estelar', 'Prateado', 'Cinza-espacial'],
            '24GB/1TB': ['Meia-noite', 'Estelar', 'Prateado', 'Cinza-espacial']
        },
        'MacBook Air (2025, 13.6") M4': {
            '16GB/256GB': ['Azul-céu', 'Prateado', 'Estelar', 'Meia-noite'],
            '16GB/512GB': ['Azul-céu', 'Prateado', 'Estelar', 'Meia-noite'],
            '24GB/512GB': ['Azul-céu', 'Prateado', 'Estelar', 'Meia-noite']
        },
        'MacBook Air (2025, 15.3") M4': {
            '16GB/256GB': ['Azul-céu', 'Prateado', 'Estelar', 'Meia-noite'],
            '16GB/512GB': ['Azul-céu', 'Prateado', 'Estelar', 'Meia-noite'],
            '24GB/512GB': ['Azul-céu', 'Prateado', 'Estelar', 'Meia-noite']
        },
        'MacBook Pro (2012, 13") i5 2.5GHz': {
            '8GB/500GB (HDD)': ['Prata'],
            '8GB/256GB (SSD)': ['Prata']
        },
        'MacBook Pro (2012, 13") i7 2.9GHz': {
            '8GB/750GB (HDD)': ['Prata'],
            '8GB/256GB (SSD)': ['Prata']
        },
        'MacBook Pro (2013, 13", Retina) i5 2.4GHz': {
            '8GB/128GB': ['Prata'],
            '8GB/256GB': ['Prata']
        },
        'MacBook Pro (2013, 13", Retina) i5 2.6GHz': {
            '8GB/256GB': ['Prata'],
            '8GB/512GB': ['Prata']
        },
        'MacBook Pro (2013, 15", Retina) i7 2.8GHz': {
            '16GB/512GB': ['Prata'],
            '16GB/1TB': ['Prata']
        },
        'MacBook Pro (2015, 15", Retina) i7 3.1GHz': {
            '16GB/256GB': ['Prata'],
            '16GB/512GB': ['Prata']
        },
        'MacBook Pro (2017, 13") i5 3.1GHz': {
            '8GB/256GB': ['Prata', 'Cinza-espacial'],
            '8GB/512GB': ['Prata', 'Cinza-espacial']
        },
        'MacBook Pro (2020, 13") M1': {
            '8GB/256GB': ['Prata', 'Cinza-espacial'],
            '8GB/512GB': ['Prata', 'Cinza-espacial'],
            '16GB/256GB': ['Prata', 'Cinza-espacial'],
            '16GB/512GB': ['Prata', 'Cinza-espacial']
        },
        'MacBook Pro (2021, 14") M1 Pro': {
            '16GB/512GB': ['Prata', 'Cinza-espacial'],
            '16GB/1TB': ['Prata', 'Cinza-espacial'],
            '32GB/1TB': ['Prata', 'Cinza-espacial']
        },
        'MacBook Pro (2021, 16") M1 Pro': {
            '16GB/512GB': ['Prata', 'Cinza-espacial'],
            '16GB/1TB': ['Prata', 'Cinza-espacial'],
            '32GB/1TB': ['Prata', 'Cinza-espacial']
        },
        'MacBook Pro (2022, 13") M2': {
            '8GB/256GB': ['Prata', 'Cinza-espacial'],
            '8GB/512GB': ['Prata', 'Cinza-espacial'],
            '16GB/512GB': ['Prata', 'Cinza-espacial'],
            '24GB/1TB': ['Prata', 'Cinza-espacial']
        },
        'MacBook Pro (2023, 14.2") M3 (8-core CPU, 10-core GPU)': {
            '8GB/512GB': ['Prata', 'Preto-espacial'],
            '16GB/512GB': ['Prata', 'Preto-espacial']
        },
        'MacBook Pro (2023, 14.2") M3 Max (14-core CPU, 30-core GPU)': {
            '36GB/1TB': ['Prata', 'Preto-espacial'],
            '48GB/1TB': ['Prata', 'Preto-espacial'],
            '64GB/2TB': ['Prata', 'Preto-espacial']
        },
        'MacBook Pro (2023, 14.2") M3 Pro (11-core CPU, 14-core GPU)': {
            '18GB/512GB': ['Prata', 'Preto-espacial'],
            '18GB/1TB': ['Prata', 'Preto-espacial'],
            '36GB/1TB': ['Prata', 'Preto-espacial']
        },
        'MacBook Pro (2023, 14") M2 Max (12-core CPU, 30-core GPU)': {
            '32GB/1TB': ['Prata', 'Cinza-espacial'],
            '64GB/1TB': ['Prata', 'Cinza-espacial']
        },
        'MacBook Pro (2023, 14") M2 Max (12-core CPU, 38-core GPU)': {
            '32GB/1TB': ['Prata', 'Cinza-espacial'],
            '64GB/1TB': ['Prata', 'Cinza-espacial']
        },
        'MacBook Pro (2023, 14") M2 Pro': {
            '16GB/512GB': ['Prata', 'Cinza-espacial'],
            '16GB/1TB': ['Prata', 'Cinza-espacial'],
            '32GB/1TB': ['Prata', 'Cinza-espacial']
        },
        'MacBook Pro (2023, 16.2") M3 Max (14-core CPU, 30-core GPU)': {
            '36GB/1TB': ['Prata', 'Preto-espacial'],
            '48GB/1TB': ['Prata', 'Preto-espacial'],
            '64GB/2TB': ['Prata', 'Preto-espacial']
        },
        'MacBook Pro (2023, 16.2") M3 Pro (12-core CPU, 18-core GPU)': {
            '18GB/512GB': ['Prata', 'Preto-espacial'],
            '18GB/1TB': ['Prata', 'Preto-espacial'],
            '36GB/1TB': ['Prata', 'Preto-espacial']
        },
        'MacBook Pro (2024, 14") M4': {
            '24GB/512GB': ['Preto-espacial', 'Prateado'],
            '36GB/1TB': ['Preto-espacial', 'Prateado'],
            '48GB/1TB': ['Preto-espacial', 'Prateado'],
            '64GB/2TB': ['Preto-espacial', 'Prateado'],
            '128GB/4TB': ['Preto-espacial', 'Prateado']
        },
        'iMac (2017, 21.5", Retina 4K) Intel': {
            '8GB/1TB (Fusion/HD)': ['Prata'],
            '16GB/1TB (config.)': ['Prata']
        },
        'iMac (2017, 27", Retina 5K) Intel': {
            '8GB/1TB (Fusion)': ['Prata'],
            '16GB/1TB (config.)': ['Prata']
        },
        'iMac (2019, 21.5", Retina 4K) Intel': {
            '8GB/1TB (Fusion/HD)': ['Prata'],
            '16GB/1TB (config.)': ['Prata']
        },
        'iMac (2019, 27", Retina 5K) Intel': {
            '8GB/1TB (Fusion/SSD)': ['Prata'],
            '16GB/1TB': ['Prata']
        },
        'iMac (2020, 27", Retina 5K) Intel': {
            '8GB/512GB': ['Prata'],
            '8GB/1TB': ['Prata'],
            '16GB/1TB': ['Prata']
        },
        'iMac (2021, 24") M1 (7-GPU)': {
            '8GB/256GB': ['Azul', 'Verde', 'Rosa', 'Prata', 'Amarelo', 'Laranja', 'Roxo'],
            '8GB/512GB': ['Azul', 'Verde', 'Rosa', 'Prata', 'Amarelo', 'Laranja', 'Roxo']
        },
        'iMac (2021, 24") M1 (8-GPU)': {
            '8GB/256GB': ['Azul', 'Verde', 'Rosa', 'Prata', 'Amarelo', 'Laranja', 'Roxo'],
            '8GB/512GB': ['Azul', 'Verde', 'Rosa', 'Prata', 'Amarelo', 'Laranja', 'Roxo'],
            '16GB/512GB': ['Azul', 'Verde', 'Rosa', 'Prata', 'Amarelo', 'Laranja', 'Roxo']
        },
        'iMac (2023, 24") M3': {
            '8GB/256GB': ['Azul', 'Verde', 'Rosa', 'Prata', 'Amarelo', 'Laranja', 'Roxo'],
            '8GB/512GB': ['Azul', 'Verde', 'Rosa', 'Prata', 'Amarelo', 'Laranja', 'Roxo'],
            '16GB/512GB': ['Azul', 'Verde', 'Rosa', 'Prata', 'Amarelo', 'Laranja', 'Roxo']
        },
        'iMac (2024, 24") M4': {
            '8GB/256GB': ['Azul', 'Verde', 'Rosa', 'Prata', 'Amarelo', 'Laranja', 'Roxo'],
            '8GB/512GB': ['Azul', 'Verde', 'Rosa', 'Prata', 'Amarelo', 'Laranja', 'Roxo'],
            '16GB/512GB': ['Azul', 'Verde', 'Rosa', 'Prata', 'Amarelo', 'Laranja', 'Roxo']
        }
    },
    'Watch': {
        'Apple Watch SE (1ª Geração, 2020) 40mm (GPS)': { 'Padrão': ['Prata (Silver)', 'Cinza-espacial (Space Gray)', 'Dourado (Gold)'] },
        'Apple Watch SE (1ª Geração, 2020) 44mm (GPS)': { 'Padrão': ['Prata (Silver)', 'Cinza-espacial (Space Gray)', 'Dourado (Gold)'] },
        'Apple Watch SE (1ª Geração, 2020) 40mm (GPS + Cellular)': { 'Padrão': ['Prata (Silver)', 'Cinza-espacial (Space Gray)', 'Dourado (Gold)'] },
        'Apple Watch SE (1ª Geração, 2020) 44mm (GPS + Cellular)': { 'Padrão': ['Prata (Silver)', 'Cinza-espacial (Space Gray)', 'Dourado (Gold)'] },
        'Apple Watch SE (2ª Geração, 2022) 40mm (GPS)': { 'Padrão': ['Meia-noite (Midnight)', 'Estelar (Starlight)', 'Prata (Silver)'] },
        'Apple Watch SE (2ª Geração, 2022) 44mm (GPS)': { 'Padrão': ['Meia-noite (Midnight)', 'Estelar (Starlight)', 'Prata (Silver)'] },
        'Apple Watch SE (2ª Geração, 2022) 40mm (GPS + Cellular)': { 'Padrão': ['Meia-noite (Midnight)', 'Estelar (Starlight)', 'Prata (Silver)'] },
        'Apple Watch SE (2ª Geração, 2022) 44mm (GPS + Cellular)': { 'Padrão': ['Meia-noite (Midnight)', 'Estelar (Starlight)', 'Prata (Silver)'] },
        'Apple Watch SE (3ª Geração, 2025) 40mm (GPS)': { 'Padrão': ['Meia-noite (Midnight)', 'Estelar (Starlight)', 'Rosa (Pink)', 'Prata (Silver)'] },
        'Apple Watch SE (3ª Geração, 2025) 44mm (GPS)': { 'Padrão': ['Meia-noite (Midnight)', 'Estelar (Starlight)', 'Rosa (Pink)', 'Prata (Silver)'] },
        'Apple Watch SE (3ª Geração, 2025) 40mm (GPS + Cellular)': { 'Padrão': ['Meia-noite (Midnight)', 'Estelar (Starlight)', 'Rosa (Pink)', 'Prata (Silver)'] },
        'Apple Watch SE (3ª Geração, 2025) 44mm (GPS + Cellular)': { 'Padrão': ['Meia-noite (Midnight)', 'Estelar (Starlight)', 'Rosa (Pink)', 'Prata (Silver)'] },
        'Apple Watch Series 3 (2017) 38mm (GPS)': { 'Padrão': ['Prata (Silver)', 'Cinza-espacial (Space Gray)'] },
        'Apple Watch Series 3 (2017) 42mm (GPS)': { 'Padrão': ['Prata (Silver)', 'Cinza-espacial (Space Gray)'] },
        'Apple Watch Series 4 (2018) 40mm (GPS)': { 'Padrão': ['Prata (Silver)', 'Cinza-espacial (Space Gray)', 'Dourado (Gold)'] },
        'Apple Watch Series 4 (2018) 44mm (GPS)': { 'Padrão': ['Prata (Silver)', 'Cinza-espacial (Space Gray)', 'Dourado (Gold)'] },
        'Apple Watch Series 4 (2018) 40mm (GPS + Cellular)': { 'Padrão': ['Prata (Silver)', 'Cinza-espacial (Space Gray)', 'Dourado (Gold)'] },
        'Apple Watch Series 4 (2018) 44mm (GPS + Cellular)': { 'Padrão': ['Prata (Silver)', 'Cinza-espacial (Space Gray)', 'Dourado (Gold)'] },
        'Apple Watch Series 5 (2019) 40mm (GPS) Alumínio': { 'Padrão': ['Prata', 'Cinza-espacial', 'Dourado'] },
        'Apple Watch Series 5 (2019) 44mm (GPS) Alumínio': { 'Padrão': ['Prata', 'Cinza-espacial', 'Dourado'] },
        'Apple Watch Series 5 (2019) 40mm (GPS + Cellular) Alumínio': { 'Padrão': ['Prata', 'Cinza-espacial', 'Dourado'] },
        'Apple Watch Series 5 (2019) 44mm (GPS + Cellular) Alumínio': { 'Padrão': ['Prata', 'Cinza-espacial', 'Dourado'] },
        'Apple Watch Series 5 (2019) 40mm (GPS + Cellular) Aço Inoxidável': { 'Padrão': ['Prata', 'Dourado', 'Preto-espacial'] },
        'Apple Watch Series 5 (2019) 44mm (GPS + Cellular) Aço Inoxidável': { 'Padrão': ['Prata', 'Dourado', 'Preto-espacial'] },
        'Apple Watch Series 5 (2019) 40mm (GPS + Cellular) Titânio': { 'Padrão': ['Natural', 'Preto-espacial'] },
        'Apple Watch Series 5 (2019) 44mm (GPS + Cellular) Titânio': { 'Padrão': ['Natural', 'Preto-espacial'] },
        'Apple Watch Series 6 (2020) 40mm (GPS)': { 'Padrão': ['Azul (Blue)', '(PRODUCT)RED', 'Prata (Silver)', 'Dourado (Gold)', 'Cinza-espacial (Space Gray)'] },
        'Apple Watch Series 6 (2020) 44mm (GPS)': { 'Padrão': ['Azul (Blue)', '(PRODUCT)RED', 'Prata (Silver)', 'Dourado (Gold)', 'Cinza-espacial (Space Gray)'] },
        'Apple Watch Series 6 (2020) 40mm (GPS + Cellular)': { 'Padrão': ['Azul (Blue)', '(PRODUCT)RED', 'Prata (Silver)', 'Dourado (Gold)', 'Cinza-espacial (Space Gray)'] },
        'Apple Watch Series 6 (2020) 44mm (GPS + Cellular)': { 'Padrão': ['Azul (Blue)', '(PRODUCT)RED', 'Prata (Silver)', 'Dourado (Gold)', 'Cinza-espacial (Space Gray)'] },
        'Apple Watch Series 7 (2021) 41mm (GPS)': { 'Padrão': ['Verde (Green)', 'Azul (Blue)', 'Meia-noite (Midnight)', 'Estelar (Starlight)', '(PRODUCT)RED'] },
        'Apple Watch Series 7 (2021) 45mm (GPS)': { 'Padrão': ['Verde (Green)', 'Azul (Blue)', 'Meia-noite (Midnight)', 'Estelar (Starlight)', '(PRODUCT)RED'] },
        'Apple Watch Series 7 (2021) 41mm (GPS + Cellular)': { 'Padrão': ['Verde (Green)', 'Azul (Blue)', 'Meia-noite (Midnight)', 'Estelar (Starlight)', '(PRODUCT)RED'] },
        'Apple Watch Series 7 (2021) 45mm (GPS + Cellular)': { 'Padrão': ['Verde (Green)', 'Azul (Blue)', 'Meia-noite (Midnight)', 'Estelar (Starlight)', '(PRODUCT)RED'] },
        'Apple Watch Series 8 (2022) 41mm (GPS)': { 'Padrão': ['Meia-noite (Midnight)', 'Estelar (Starlight)', 'Prata (Silver)', '(PRODUCT)RED'] },
        'Apple Watch Series 8 (2022) 45mm (GPS)': { 'Padrão': ['Meia-noite (Midnight)', 'Estelar (Starlight)', 'Prata (Silver)', '(PRODUCT)RED'] },
        'Apple Watch Series 8 (2022) 41mm (GPS + Cellular)': { 'Padrão': ['Meia-noite (Midnight)', 'Estelar (Starlight)', 'Prata (Silver)', '(PRODUCT)RED'] },
        'Apple Watch Series 8 (2022) 45mm (GPS + Cellular)': { 'Padrão': ['Meia-noite (Midnight)', 'Estelar (Starlight)', 'Prata (Silver)', '(PRODUCT)RED'] },
        'Apple Watch Series 9 (2023) 41mm (GPS) Alumínio': { 'Padrão': ['Meia-noite (Midnight)', 'Estelar (Starlight)', 'Prata (Silver)', 'Rosa (Pink)', '(PRODUCT)RED'] },
        'Apple Watch Series 9 (2023) 45mm (GPS) Alumínio': { 'Padrão': ['Meia-noite (Midnight)', 'Estelar (Starlight)', 'Prata (Silver)', 'Rosa (Pink)', '(PRODUCT)RED'] },
        'Apple Watch Series 9 (2023) 41mm (GPS + Cellular) Alumínio': { 'Padrão': ['Meia-noite (Midnight)', 'Estelar (Starlight)', 'Prata (Silver)', 'Rosa (Pink)', '(PRODUCT)RED'] },
        'Apple Watch Series 9 (2023) 45mm (GPS + Cellular) Alumínio': { 'Padrão': ['Meia-noite (Midnight)', 'Estelar (Starlight)', 'Prata (Silver)', 'Rosa (Pink)', '(PRODUCT)RED'] },
        'Apple Watch Series 9 (2023) 41mm (GPS + Cellular) Titânio': { 'Padrão': ['Natural', 'Preto-espacial'] },
        'Apple Watch Series 9 (2023) 45mm (GPS + Cellular) Titânio': { 'Padrão': ['Natural', 'Preto-espacial'] },
        'Apple Watch Series 10 (2024) 42mm (GPS) Alumínio': { 'Padrão': ['Meia-noite', 'Estelar', 'Rosa', 'Azul-claro'] },
        'Apple Watch Series 10 (2024) 46mm (GPS) Alumínio': { 'Padrão': ['Meia-noite', 'Estelar', 'Rosa', 'Azul-claro'] },
        'Apple Watch Series 10 (2024) 42mm (GPS + Cellular) Alumínio': { 'Padrão': ['Meia-noite', 'Estelar', 'Rosa', 'Azul-claro'] },
        'Apple Watch Series 10 (2024) 46mm (GPS + Cellular) Alumínio': { 'Padrão': ['Meia-noite', 'Estelar', 'Rosa', 'Azul-claro'] },
        'Apple Watch Series 10 (2024) 42mm (GPS + Cellular) Titânio': { 'Padrão': ['Natural', 'Preto-espacial'] },
        'Apple Watch Series 10 (2024) 46mm (GPS + Cellular) Titânio': { 'Padrão': ['Natural', 'Preto-espacial'] },
        'Apple Watch Series 11 (2025) 42mm (GPS) Alumínio': { 'Padrão': ['Meia-noite', 'Estelar', 'Prata', 'Azul'] },
        'Apple Watch Series 11 (2025) 46mm (GPS) Alumínio': { 'Padrão': ['Meia-noite', 'Estelar', 'Prata', 'Azul'] },
        'Apple Watch Series 11 (2025) 42mm (GPS + Cellular) Alumínio': { 'Padrão': ['Meia-noite', 'Estelar', 'Prata', 'Azul'] },
        'Apple Watch Series 11 (2025) 46mm (GPS + Cellular) Alumínio': { 'Padrão': ['Meia-noite', 'Estelar', 'Prata', 'Azul'] },
        'Apple Watch Series 11 (2025) 42mm (GPS + Cellular) Titânio': { 'Padrão': ['Natural', 'Preto-espacial'] },
        'Apple Watch Series 11 (2025) 46mm (GPS + Cellular) Titânio': { 'Padrão': ['Natural', 'Preto-espacial'] },
        'Apple Watch Ultra (1ª Geração, 2022) 49mm (GPS + Cellular)': { 'Padrão': ['Natural (Titanium Natural)'] },
        'Apple Watch Ultra 2 (2ª Geração, 2024) 49mm (GPS + Cellular)': { 'Padrão': ['Natural (Titanium Natural)'] },
        'Apple Watch Ultra 3 (3ª Geração, 2025) 49mm (GPS + Cellular)': { 'Padrão': ['Natural (Titanium Natural)', 'Preto-espacial (Space Black Titanium)'] },
    }
};

export const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({ suppliers, customers, brands, categories, productModels, grades, gradeValues, onClose, purchaseOrderToEdit, onAddNewSupplier }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<Partial<PurchaseOrder>>({});
    const [items, setItems] = useState<Partial<PurchaseItem>[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Step 2 state
    const [currentItem, setCurrentItem] = useState<Partial<CurrentItemType>>(JSON.parse(JSON.stringify(emptyItem)));
    const [productType, setProductType] = useState<'Apple' | 'Produto'>('Apple');
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [isCustomerPurchase, setIsCustomerPurchase] = useState(false);
    const [currentGradeId, setCurrentGradeId] = useState('');
    const [currentValueId, setCurrentValueId] = useState('');
    const [isMinimumStockEnabled, setIsMinimumStockEnabled] = useState(false);
    const [showVariations, setShowVariations] = useState(false);

    // Dynamic parameters from Empresa > Parâmetros
    const [conditionOptions, setConditionOptions] = useState<ProductConditionParameter[]>([]);
    const [locationOptions, setLocationOptions] = useState<StorageLocationParameter[]>([]);
    const [warrantyOptions, setWarrantyOptions] = useState<WarrantyParameter[]>([]);
    const [terms, setTerms] = useState<ReceiptTermParameter[]>([]);


    const { showToast } = useToast();
    const { user } = useUser();

    // Fetch dynamic parameters on mount
    useEffect(() => {
        const fetchParameters = async () => {
            const [conditions, locations, warranties, termsData] = await Promise.all([
                getProductConditions(),
                getStorageLocations(),
                getWarranties(),
                getReceiptTerms()
            ]);
            setConditionOptions(conditions);
            setLocationOptions(locations);
            setWarrantyOptions(warranties);
            setTerms(termsData);
        };
        fetchParameters();
    }, []);

    useEffect(() => {
        if (purchaseOrderToEdit) {
            setFormData(purchaseOrderToEdit);
            setItems(purchaseOrderToEdit.items);
            setIsCustomerPurchase(purchaseOrderToEdit.isCustomerPurchase || false);
            setStep(1); // Start editing from Step 1
        } else {
            // Format date as YYYY-MM-DDTHH:mm for datetime-local input
            // Using toLocaleString to format, then converting to the required input format
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

            setFormData({
                purchaseDate: localDateTime,
                additionalCost: 0,
                financialStatus: 'Pendente',
                stockStatus: 'Pendente',
                origin: 'Compra Nacional',
            });
            setItems([]);
            setIsCustomerPurchase(false);
            setStep(1);
        }
    }, [purchaseOrderToEdit]);

    const subTotal = useMemo(() => {
        return items.reduce((sum, item) => sum + (item.finalUnitCost || 0) * (item.quantity || 0), 0);
    }, [items]);

    const calculatedAdditionalCost = useMemo(() => {
        if (formData.origin === 'Importação') {
            const shipping = formData.shippingCost || 0;
            const type = formData.shippingType || 'R$';
            const rate = formData.dollarRate || 0;

            if (type === 'US$') return shipping * (rate || 1);
            if (type === '%') return subTotal * (shipping / 100);
            return shipping;
        }
        return formData.additionalCost || 0;
    }, [formData.origin, formData.shippingCost, formData.shippingType, formData.dollarRate, subTotal, formData.additionalCost]);

    const total = useMemo(() => {
        return subTotal + calculatedAdditionalCost;
    }, [subTotal, calculatedAdditionalCost]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSupplierChange = async (selectedId: string | null) => {
        if (!selectedId) {
            setFormData(prev => ({ ...prev, supplierId: undefined, supplierName: undefined }));
            return;
        }
        const supplier = suppliers.find(s => s.id === selectedId);
        if (supplier) {
            setFormData(prev => ({ ...prev, supplierId: selectedId, supplierName: supplier.name }));
            setIsCustomerPurchase(!!supplier.linkedCustomerId);
            return;
        }
        const customer = customers.find(c => c.id === selectedId);
        if (customer) {
            try {
                const convertedSupplier = await findOrCreateSupplierFromCustomer(customer);
                setFormData(prev => ({ ...prev, supplierId: convertedSupplier.id, supplierName: convertedSupplier.name }));
                setIsCustomerPurchase(true);
            } catch (error) {
                showToast('Erro ao vincular cliente como fornecedor.', 'error');
            }
        }
    }

    const goToStep2 = () => {
        if (!formData.supplierId) {
            showToast('Por favor, selecione um fornecedor.', 'error');
            return;
        }
        setStep(2);
    }

    const handleSaveNewSupplier = async (entityData: any, entityType: 'Cliente' | 'Fornecedor' | 'Ambos', personType: 'Pessoa Física' | 'Pessoa Jurídica') => {
        const supplierPayload: Omit<Supplier, 'id'> = {
            name: entityData.name,
            contactPerson: entityData.name,
            email: entityData.email,
            phone: entityData.phone,
            cnpj: entityData.cnpj || '',
            address: `${entityData.address?.street || ''}, ${entityData.address?.number || ''}`.trim()
        };
        const newSupplier = await onAddNewSupplier(supplierPayload);
        if (newSupplier) {
            // Directly set the supplier data without relying on the props list (which may not have updated yet)
            setFormData(prev => ({ ...prev, supplierId: newSupplier.id, supplierName: newSupplier.name }));
            setIsCustomerPurchase(false);
            setIsSupplierModalOpen(false);
            showToast(`Fornecedor "${newSupplier.name}" criado e selecionado!`, 'success');
        }
    };

    const handleCurrentItemChange = (field: keyof CurrentItemType, value: any) => {
        const updatedItem = { ...currentItem, [field]: value };
        if (field === 'unitCost' || field === 'additionalUnitCost') {
            updatedItem.finalUnitCost = (updatedItem.unitCost || 0) + (updatedItem.additionalUnitCost || 0);
        }
        setCurrentItem(updatedItem as any);
    };

    const handleToggleMinimumStock = (checked: boolean) => {
        setIsMinimumStockEnabled(checked);
        if (!checked) {
            const { minimumStock, ...rest } = currentItem;
            setCurrentItem(rest);
        } else {
            setCurrentItem(prev => ({ ...prev, minimumStock: prev.minimumStock || 1 }));
        }
    };

    const handleProductDetailChange = (field: keyof PurchaseItem['productDetails'], value: any) => {
        let finalValue = value;
        if (field === 'batteryHealth' && value !== '') {
            finalValue = parseInt(value, 10);
        }
        const updatedDetails = { ...currentItem.productDetails!, [field]: finalValue };
        setCurrentItem({ ...currentItem, productDetails: updatedDetails });
    };

    const handleAppleFilterChange = (field: 'category' | 'model' | 'storage' | 'color', value: string) => {
        const updatedItem = JSON.parse(JSON.stringify(currentItem));
        switch (field) {
            case 'category':
                updatedItem.productDetails.category = value;
                updatedItem.productDetails.model = '';
                updatedItem.storage = '';
                updatedItem.productDetails.color = '';
                break;
            case 'model':
                updatedItem.productDetails.model = value;
                updatedItem.storage = '';
                updatedItem.productDetails.color = '';
                break;
            case 'storage':
                updatedItem.storage = value;
                updatedItem.productDetails.color = '';
                break;
            case 'color':
                updatedItem.productDetails.color = value;
                break;
        }
        setCurrentItem(updatedItem);
    };

    const handlePrintTerm = () => {
        if (!formData.purchaseTerm) return;
        const term = terms.find(t => t.name === formData.purchaseTerm);
        if (term) {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                const content = (term as any).content || 'Conteúdo do termo não disponível.';
                printWindow.document.write(`
                    <html>
                        <head>
                            <title>${term.name}</title>
                            <style>
                                body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; color: #333; }
                                h1 { text-align: center; margin-bottom: 30px; font-size: 24px; text-transform: uppercase; }
                                .content { white-space: pre-wrap; margin-bottom: 60px; text-align: justify; }
                                .signatures { display: flex; justify-content: space-between; margin-top: 100px; }
                                .signature-box { border-top: 1px solid #000; width: 45%; text-align: center; padding-top: 10px; }
                            </style>
                        </head>
                        <body>
                            <h1>${term.name}</h1>
                            <div class="content">${content}</div>
                            
                            <div class="signatures">
                                <div class="signature-box">
                                    <p>Assinatura do Cliente</p>
                                    <small>${formData.supplierName || 'Cliente'}</small>
                                </div>
                                <div class="signature-box">
                                    <p>Assinatura da Loja</p>
                                    <small>${user?.name || 'Vendedor'}</small>
                                </div>
                            </div>
                            <script>
                                window.onload = () => {
                                    window.print();
                                    setTimeout(() => window.close(), 500);
                                };
                            </script>
                        </body>
                    </html>
                `);
                printWindow.document.close();
            }
        } else {
            showToast('Termo não encontrado.', 'error');
        }
    };

    const handleAddVariation = () => {
        if (!currentGradeId) return;
        const grade = grades.find(g => g.id === currentGradeId);
        const value = currentValueId ? gradeValues.find(v => v.id === currentValueId) : null;

        if (!grade) return;

        const newVariation: ProductVariation = {
            gradeId: grade.id,
            gradeName: grade.name,
            valueId: currentValueId || '',
            valueName: value ? value.name : ''
        };
        const existingVariations = currentItem.variations || [];
        const existingIndex = existingVariations.findIndex(v => v.gradeId === newVariation.gradeId);
        let newVariations = [];
        if (existingIndex > -1) {
            newVariations = [...existingVariations];
            newVariations[existingIndex] = newVariation;
        } else {
            newVariations = [...existingVariations, newVariation];
        }
        setCurrentItem(prev => ({ ...prev, variations: newVariations }));
        setCurrentGradeId('');
        setCurrentValueId('');
    };

    const handleRemoveVariation = (index: number) => {
        setCurrentItem(prev => ({ ...prev, variations: prev.variations?.filter((_, i) => i !== index) || [] }));
    };

    const handleAddItem = () => {
        const finalProductDetails = { ...currentItem.productDetails! };
        let modelString = '';
        const variationString = (currentItem.variations || []).map(v => v.valueName).join(' ');

        if (productType === 'Apple') {
            const categoryName = currentItem.productDetails?.category || '';
            const modelName = currentItem.productDetails?.model || '';
            if (modelName.includes(categoryName)) {
                modelString = `${modelName} ${currentItem.storage || ''} ${currentItem.productDetails?.color || ''} ${variationString}`.trim().replace(/\s+/g, ' ');
            } else {
                modelString = `${categoryName} ${modelName} ${currentItem.storage || ''} ${currentItem.productDetails?.color || ''} ${variationString}`.trim().replace(/\s+/g, ' ');
            }
            finalProductDetails.model = modelString;
            finalProductDetails.brand = 'Apple';
        } else {
            const brandObj = brands.find(b => b.id === currentItem.productDetails?.brand);
            const brandName = brandObj?.name || currentItem.productDetails?.brand || '';
            finalProductDetails.brand = brandName;

            const categoryObj = categories.find(c => c.id === currentItem.productDetails?.category);
            const categoryName = categoryObj?.name || currentItem.productDetails?.category || '';

            const modelObj = productModels.find(m => m.id === currentItem.productDetails?.model);
            const modelName = modelObj?.name || '';

            modelString = `${categoryName} ${brandName} ${modelName} ${variationString}`.trim().replace(/\s+/g, ' ');

            finalProductDetails.model = modelString;
        }

        if (!modelString) {
            showToast('Preencha os detalhes do produto (modelo, etc).', 'warning');
            return;
        }

        const newItem: Partial<PurchaseItem> = {
            id: `new-${items.length}-${Date.now()}`,
            ...(currentItem as Omit<PurchaseItem, 'id'>),
            productDetails: finalProductDetails,
            barcodes: currentItem.barcode ? [currentItem.barcode] : [],
            controlByBarcode: !!currentItem.barcode,
        };
        delete (newItem as any).storage;
        setItems([...items, newItem]);

        // Reset currentItem to prevent contamination
        const resetItem = JSON.parse(JSON.stringify(emptyItem));
        if (productType === 'Produto') {
            resetItem.productDetails.brand = '';
        }
        setCurrentItem(resetItem);
        setCurrentGradeId('');
        setCurrentValueId('');
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (items.length === 0) {
            showToast('Adicione pelo menos um item à compra.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const sanitizedItems = items.map((item) => {
                const { ...rest } = item; // Keep ID
                return {
                    id: item.id, // Preserve ID
                    productDetails: {
                        brand: item.productDetails?.brand || '',
                        category: item.productDetails?.category || '',
                        model: item.productDetails?.model || '',
                        color: item.productDetails?.color || '',
                        condition: item.productDetails?.condition || 'Novo',
                        warranty: item.productDetails?.warranty || '1 ano',
                        storageLocation: item.productDetails?.storageLocation || 'Estoque Principal',
                    },
                    barcodes: item.barcode ? [item.barcode] : [],
                    quantity: Number(item.quantity || 0),
                    unitCost: Number(item.unitCost || 0),
                    additionalUnitCost: Number(item.additionalUnitCost || 0),
                    finalUnitCost: Number(item.finalUnitCost || 0),
                    hasImei: !!item.hasImei,
                    minimumStock: item.minimumStock ? Number(item.minimumStock) : undefined,
                    variations: item.variations || [],
                    controlByBarcode: !!item.controlByBarcode
                };
            }) as PurchaseItem[];

            if (purchaseOrderToEdit) {
                const purchaseData: PurchaseOrder = {
                    ...purchaseOrderToEdit,
                    ...formData,
                    isCustomerPurchase,
                    items: sanitizedItems,
                    total: total,
                    additionalCost: formData.additionalCost || 0,
                };
                await updatePurchaseOrder(purchaseData);
                showToast('Compra atualizada com sucesso!', 'success');
            } else {
                let currentSupplierName = formData.supplierName;
                if (!currentSupplierName && formData.supplierId) {
                    const supplier = suppliers.find(s => s.id === formData.supplierId);
                    const customer = customers.find(c => c.id === formData.supplierId);
                    currentSupplierName = supplier?.name || customer?.name || 'Fornecedor Desconhecido';
                }

                const purchaseData: Omit<PurchaseOrder, 'id' | 'displayId' | 'createdAt' | 'locatorId'> = {
                    purchaseDate: formData.purchaseDate!,
                    supplierId: formData.supplierId!,
                    supplierName: currentSupplierName!,
                    origin: formData.origin!,
                    isCustomerPurchase,
                    purchaseTerm: formData.purchaseTerm,
                    items: sanitizedItems,
                    total: total,
                    additionalCost: formData.additionalCost || 0,
                    stockStatus: 'Pendente',
                    financialStatus: 'Pendente',
                    createdBy: user?.name || 'Keiler',
                    observations: formData.observations,
                };
                await addPurchaseOrder(purchaseData);
                showToast('Compra criada com sucesso!', 'success');
            }
            onClose(true);
        } catch (error) {
            showToast('Erro ao salvar a compra.', 'error');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const combinedSupplierOptions = useMemo(() => {
        const supplierOpts = suppliers.map(s => ({ value: s.id, label: s.name || 'Fornecedor Sem Nome' }));
        const linkedCustomerIds = new Set(suppliers.map(s => s.linkedCustomerId).filter(Boolean));
        const customerOpts = customers.filter(c => !linkedCustomerIds.has(c.id)).map(c => ({ value: c.id, label: c.name || 'Cliente Sem Nome' }));
        return [...supplierOpts, ...customerOpts].sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    }, [suppliers, customers]);

    const filteredCategories = useMemo(() => {
        if (!currentItem.productDetails?.brand) return [];
        return categories.filter(c => c.brandId === currentItem.productDetails?.brand);
    }, [categories, currentItem.productDetails?.brand]);

    const filteredModels = useMemo(() => {
        if (!currentItem.productDetails?.category) return [];
        return productModels.filter(m => m.categoryId === currentItem.productDetails?.category);
    }, [productModels, currentItem.productDetails?.category]);

    const availableAppleModels = useMemo(() => {
        const category = currentItem.productDetails?.category;
        if (category && appleProductHierarchy[category as keyof typeof appleProductHierarchy]) {
            return Object.keys(appleProductHierarchy[category as keyof typeof appleProductHierarchy]);
        }
        return [];
    }, [currentItem.productDetails?.category]);

    const isMemoryless = useMemo(() => {
        const category = currentItem.productDetails?.category;
        return category === 'AirPods' || category === 'EarPods' || category === 'Watch' || category === 'Acessórios';
    }, [currentItem.productDetails?.category]);

    const availableAppleMemories = useMemo(() => {
        if (isMemoryless) return [];
        const category = currentItem.productDetails?.category as any;
        const model = currentItem.productDetails?.model as any;
        if (category && model && (appleProductHierarchy as any)[category]?.[model]) {
            return Object.keys((appleProductHierarchy as any)[category][model]);
        }
        return [];
    }, [currentItem.productDetails?.category, currentItem.productDetails?.model, isMemoryless]);

    const availableAppleColors = useMemo(() => {
        const category = currentItem.productDetails?.category as any;
        const model = currentItem.productDetails?.model as any;
        const storage = (isMemoryless ? 'Padrão' : currentItem.storage) as any;
        if (category && model && storage && (appleProductHierarchy as any)[category]?.[model]?.[storage]) {
            return (appleProductHierarchy as any)[category][model][storage] as readonly string[];
        }
        return [];
    }, [currentItem.productDetails?.category, currentItem.productDetails?.model, currentItem.storage, isMemoryless]);

    const availableGradeValues = useMemo(() => {
        if (!currentGradeId) return [];
        return gradeValues.filter(v => v.gradeId === currentGradeId);
    }, [gradeValues, currentGradeId]);

    const inputClasses = "w-full p-2.5 border rounded-xl bg-transparent border-border focus:ring-2 focus:ring-success/20 focus:border-success text-sm h-11 transition-all outline-none";
    const labelClasses = "block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5 ml-1";

    const renderStep1 = () => (
        <>
            <div className="flex justify-between items-center p-4 md:p-5 border-b border-gray-100 bg-white sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-gray-900 text-white rounded-2xl transform -rotate-3 shadow-lg">
                        <ArrowRightCircleIcon className="h-5 w-5 md:h-6 md:w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-primary tracking-tight leading-none">Lançamento de Compras</h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Registro de entrada de mercadoria</p>
                    </div>
                </div>
                <button type="button" onClick={() => onClose(false)} className="p-2 md:p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all active:scale-95 group shadow-sm">
                    <XCircleIcon className="h-6 w-6 group-hover:scale-110 transition-transform" />
                </button>
            </div>
            <div className="p-3 md:p-5 space-y-4 md:space-y-5 flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-end bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                    <div>
                        <label className="text-xs font-bold text-muted block mb-1">Data da compra*</label>
                        <input
                            type="datetime-local"
                            name="purchaseDate"
                            value={formData.purchaseDate || ''}
                            onChange={handleFormChange}
                            className={`${inputClasses} w-full text-xs md:text-sm`}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-muted block mb-1">Origem*</label>
                        <select name="origin" value={formData.origin || ''} onChange={handleFormChange} className={`${inputClasses} w-full text-xs md:text-sm`}>
                            <option>Compra Nacional</option>
                            <option>Importação</option>
                        </select>
                    </div>

                    {formData.origin === 'Importação' && (
                        <div className="col-span-full grid grid-cols-2 gap-2 bg-gray-50 border border-dashed border-gray-200 p-2 rounded-lg animate-fade-in">
                            <div>
                                <label className="text-[10px] font-bold text-muted block mb-0.5">Dólar (R$)</label>
                                <CurrencyInput
                                    value={formData.dollarRate}
                                    onChange={(v) => setFormData(prev => ({ ...prev, dollarRate: v || 0 }))}
                                    className={`${inputClasses} w-full h-9 text-xs`}
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-muted block mb-0.5">Frete</label>
                                <div className="flex gap-1 h-9">
                                    <CurrencyInput
                                        value={formData.shippingCost}
                                        onChange={(v) => setFormData(prev => ({ ...prev, shippingCost: v || 0 }))}
                                        className={`${inputClasses} flex-1 h-full text-xs`}
                                        showPrefix={false}
                                    />
                                    <select
                                        name="shippingType"
                                        value={formData.shippingType || 'R$'}
                                        onChange={(e) => setFormData(prev => ({ ...prev, shippingType: e.target.value as any }))}
                                        className={`${inputClasses} w-12 px-1 h-full text-xs`}
                                    >
                                        <option value="R$">R$</option>
                                        <option value="US$">US$</option>
                                        <option value="%">%</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:items-end">
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1 ml-1 block">Fornecedor / Cliente*</label>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="flex items-center h-11 bg-gray-100/50 px-3 rounded-xl border border-gray-200 shadow-sm shrink-0">
                                <input type="checkbox" id="isCustomerPurchase" checked={isCustomerPurchase} onChange={e => setIsCustomerPurchase(e.target.checked)} className="h-4 w-4 text-accent rounded" />
                                <label htmlFor="isCustomerPurchase" className="ml-2 text-xs font-bold text-gray-600 cursor-pointer">De Cliente</label>
                            </div>
                            <div className="flex flex-1 gap-2">
                                <div className="flex-1 min-w-0">
                                    <SearchableDropdown options={combinedSupplierOptions} value={formData.supplierId || null} onChange={handleSupplierChange} placeholder="Buscar..." />
                                </div>
                                <button type="button" onClick={() => setIsSupplierModalOpen(true)} className="h-11 w-11 flex-shrink-0 bg-success text-white rounded-xl flex items-center justify-center hover:bg-success/90 transition-all active:scale-95 shadow-md shadow-success/10">
                                    <PlusIcon className="h-6 w-6" />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="w-full md:w-48">
                        <label className="text-sm font-bold text-muted block mb-1">Termo de Compra</label>
                        <div className="flex gap-2">
                            <select name="purchaseTerm" value={formData.purchaseTerm || ''} onChange={handleFormChange} className={inputClasses}>
                                <option value="">Selecione...</option>
                                {terms.map(t => (
                                    <option key={t.id} value={t.name}>{t.name}</option>
                                ))}
                            </select>
                            {isCustomerPurchase && formData.purchaseTerm && (
                                <button
                                    type="button"
                                    onClick={handlePrintTerm}
                                    title="Imprimir Termo"
                                    className="h-10 w-10 flex-shrink-0 bg-gray-100 text-gray-600 rounded-md flex items-center justify-center hover:bg-gray-200 border border-gray-200"
                                >
                                    <PrinterIcon className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Corner Button - Moved even further inside */}
                <div className="flex justify-end pt-3 pb-5 px-8 md:px-6">
                    <button
                        type="button"
                        onClick={goToStep2}
                        className="w-full md:w-auto px-10 py-3 bg-gray-900 text-white rounded-2xl hover:bg-black font-black shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95 group"
                    >
                        <span className="text-base md:text-lg font-bold">Avançar para Itens</span>
                        <ArrowRightCircleIcon className="h-6 w-6 md:h-7 md:w-7 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </>
    );

    const renderStep2 = () => (
        <>
            <div className="flex justify-between items-center p-4 md:p-5 border-b border-gray-100 bg-white sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-gray-900 text-white rounded-2xl transform -rotate-3 shadow-lg">
                        <PlusIcon className="h-5 w-5 md:h-6 md:w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-primary tracking-tight leading-none">Itens da Compra</h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Lançamento detalhado de produtos</p>
                    </div>
                </div>
                <button type="button" onClick={() => onClose(false)} className="p-2 md:p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all active:scale-95 group shadow-sm">
                    <XCircleIcon className="h-6 w-6 group-hover:scale-110 transition-transform" />
                </button>
            </div>
            <div className="p-3 md:p-5 space-y-4 md:space-y-5 flex-1 overflow-y-auto custom-scrollbar">
                <div className="bg-gray-50/50 p-4 md:p-5 rounded-3xl border border-gray-100 space-y-4 md:space-y-5">

                    <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                        <div className="flex items-center space-x-6">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="productType"
                                    value="Apple"
                                    checked={productType === 'Apple'}
                                    onChange={() => {
                                        setProductType('Apple');
                                        const reset = JSON.parse(JSON.stringify(emptyItem));
                                        setCurrentItem({ ...reset, hasImei: true });
                                    }}
                                    className="form-radio h-5 w-5 text-accent"
                                />
                                <span className="font-bold text-gray-700">Apple</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="productType"
                                    value="Produto"
                                    checked={productType === 'Produto'}
                                    onChange={() => {
                                        setProductType('Produto');
                                        const reset = JSON.parse(JSON.stringify(emptyItem));
                                        reset.productDetails.brand = '';
                                        setCurrentItem(reset);
                                    }}
                                    className="form-radio h-5 w-5 text-accent"
                                />
                                <span className="font-bold text-gray-700">Produto</span>
                            </label>
                        </div>
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs md:text-sm text-blue-600">
                            Para cadastrar Marcar, Categorias e Grades, <a href="/#/company?tab=marcas" target="_blank" rel="noopener noreferrer" className="font-bold underline">clique aqui</a>
                        </div>
                    </div>
                    <div className={`grid grid-cols-1 ${(productType === 'Apple' && currentItem.productDetails?.condition === 'Seminovo') ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4`}>
                        <div><label className={labelClasses}>Tempo de Garantia*</label><select value={currentItem.productDetails?.warranty} onChange={e => handleProductDetailChange('warranty', e.target.value)} className={inputClasses}>{warrantyOptions.length === 0 ? <option>Carregando...</option> : <>{currentItem.productDetails?.warranty && !warrantyOptions.some(w => w.name.toLowerCase() === currentItem.productDetails?.warranty?.toLowerCase()) && <option value={currentItem.productDetails?.warranty}>{currentItem.productDetails?.warranty}</option>}{warrantyOptions.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}</>}</select></div>
                        <div><label className={labelClasses}>Local do estoque</label><select value={currentItem.productDetails?.storageLocation} onChange={e => handleProductDetailChange('storageLocation', e.target.value)} className={inputClasses}>{locationOptions.length === 0 ? <option>Carregando...</option> : <>{currentItem.productDetails?.storageLocation && !locationOptions.some(l => l.name.toLowerCase() === currentItem.productDetails?.storageLocation?.toLowerCase()) && <option value={currentItem.productDetails?.storageLocation}>{currentItem.productDetails?.storageLocation}</option>}{locationOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</>}</select></div>
                        <div><label className={labelClasses}>Condição</label><select value={currentItem.productDetails?.condition} onChange={e => handleProductDetailChange('condition', e.target.value as ProductCondition)} className={inputClasses}>{conditionOptions.length === 0 ? <option>Carregando...</option> : <>{currentItem.productDetails?.condition && !conditionOptions.some(c => c.name.toLowerCase() === currentItem.productDetails?.condition?.toLowerCase()) && <option value={currentItem.productDetails?.condition}>{currentItem.productDetails?.condition}</option>}{conditionOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</>}</select></div>
                        {productType === 'Apple' && currentItem.productDetails?.condition === 'Seminovo' && (
                            <div>
                                <label className={labelClasses}>Saúde Bateria (%)</label>
                                <input
                                    type="number"
                                    value={currentItem.productDetails?.batteryHealth ?? 100}
                                    onChange={e => handleProductDetailChange('batteryHealth', e.target.value)}
                                    className={inputClasses}
                                    min="0" max="100"
                                />
                            </div>
                        )}
                    </div>

                    {productType === 'Apple' ? (
                        <div className="space-y-4">
                            <div className={`grid grid-cols-2 ${!isMemoryless ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
                                <div><label className={labelClasses}>Categoria*</label><select value={currentItem.productDetails?.category || ''} onChange={(e) => handleAppleFilterChange('category', e.target.value)} className={`${inputClasses} h-10`}><option value="">Selecione</option>{Object.keys(appleProductHierarchy).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                <div><label className={labelClasses}>Modelo*</label><select value={currentItem.productDetails?.model || ''} onChange={(e) => handleAppleFilterChange('model', e.target.value)} className={`${inputClasses} h-10`} disabled={!currentItem.productDetails?.category}><option value="">Selecione</option>{availableAppleModels.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                                {!isMemoryless && <div><label className={labelClasses}>Memória*</label><select value={currentItem.storage || ''} onChange={e => handleAppleFilterChange('storage', e.target.value)} className={`${inputClasses} h-10`} disabled={!currentItem.productDetails?.model}><option value="">Selecione</option>{availableAppleMemories.map(m => <option key={m} value={m}>{m}</option>)}</select></div>}
                                <div><label className={labelClasses}>Cor*</label><select value={currentItem.productDetails?.color || ''} onChange={(e) => handleAppleFilterChange('color', e.target.value)} className={`${inputClasses} h-10`} disabled={!currentItem.productDetails?.model || (!isMemoryless && !currentItem.storage)}><option value="">Selecione</option>{availableAppleColors.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            </div>
                            <div className="flex justify-start">
                                <button type="button" onClick={() => setShowVariations(s => !s)} className="text-sm font-semibold text-accent hover:underline flex items-center gap-1"><PlusIcon className="h-4 w-4" /> Adicionar Variação (Ex: Vitrine, Caixa Amassada)</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div><label className={labelClasses}>Marca*</label><select value={currentItem.productDetails?.brand || ''} onChange={e => { const val = e.target.value; setCurrentItem(prev => ({ ...prev, productDetails: { ...prev.productDetails!, brand: val, category: '', model: '' } })); }} className={`${inputClasses} h-10`}><option value="">Selecione</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                                <div><label className={labelClasses}>Categoria*</label><select value={currentItem.productDetails?.category || ''} onChange={e => { const val = e.target.value; setCurrentItem(prev => ({ ...prev, productDetails: { ...prev.productDetails!, category: val, model: '' } })); }} className={`${inputClasses} h-10`} disabled={!currentItem.productDetails?.brand}><option value="">Selecione</option>{filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                                <div><label className={labelClasses}>Modelo*</label><select value={currentItem.productDetails?.model || ''} onChange={e => handleProductDetailChange('model', e.target.value)} className={`${inputClasses} h-10`} disabled={!currentItem.productDetails?.category}><option value="">Selecione</option>{filteredModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                            </div>
                            <div className="flex justify-start">
                                <button type="button" onClick={() => setShowVariations(s => !s)} className="text-sm font-semibold text-accent hover:underline flex items-center gap-1"><PlusIcon className="h-4 w-4" /> Adicionar Variação (Cor, Armazenamento, etc)</button>
                            </div>
                        </div>
                    )}

                    {showVariations && (
                        <div className="col-span-full p-6 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-4">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">Grades / Variações Adicionais</label>
                            <div className="flex flex-wrap gap-2 my-2">
                                {currentItem.variations?.map((v, index) => (
                                    <div key={index} className="flex items-center gap-1 bg-gray-200 rounded-full px-2 py-1 text-sm">
                                        <span className="font-semibold">{v.gradeName}:</span>
                                        <span>{v.valueName}</span>
                                        <button type="button" onClick={() => handleRemoveVariation(index)}><XCircleIcon className="h-4 w-4 text-muted hover:text-danger" /></button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-end gap-3 p-4 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 block ml-1">Grade</label>
                                    <select value={currentGradeId} onChange={e => { setCurrentGradeId(e.target.value); setCurrentValueId(''); }} className={`${inputClasses}`}>
                                        <option value="">Selecione...</option>
                                        {grades.filter(g => productType === 'Apple' ? g.name.toLowerCase() !== 'cor' : true).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 block ml-1">Valor</label>
                                    <select value={currentValueId} onChange={e => setCurrentValueId(e.target.value)} className={`${inputClasses}`} disabled={!currentGradeId}>
                                        <option value="">Selecione...</option>
                                        {availableGradeValues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </select>
                                </div>
                                <button type="button" onClick={handleAddVariation} className="px-3 py-1 bg-accent text-white rounded-md h-9 flex items-center gap-1 text-sm"><PlusIcon className="h-4 w-4" /> Adicionar</button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                        <div>
                            <label className={labelClasses}>Qtd.</label>
                            <input type="number" min="1" value={currentItem.quantity} onChange={(e) => handleCurrentItemChange('quantity', parseInt(e.target.value) || 1)} className={`${inputClasses} text-center font-bold`} />
                        </div>
                        <div><label className={labelClasses}>Custo Unit.</label><CurrencyInput value={currentItem.unitCost} onChange={v => handleCurrentItemChange('unitCost', v || 0)} className={inputClasses} /></div>
                        <div><label className={labelClasses}>Adicional (Unit.)</label><CurrencyInput value={currentItem.additionalUnitCost} onChange={v => handleCurrentItemChange('additionalUnitCost', v || 0)} className={inputClasses} /></div>
                        <div>
                            <label className={labelClasses}>Final (Unit.)</label>
                            <div className={`${inputClasses} bg-gray-100 flex items-center text-xs md:text-sm`}>{formatCurrency(currentItem.finalUnitCost)}</div>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mt-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={currentItem.hasImei}
                                        onChange={e => handleCurrentItemChange('hasImei', e.target.checked)}
                                        disabled={productType === 'Apple'}
                                        className={`form-checkbox h-4 w-4 text-accent rounded ${productType === 'Apple' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    />
                                    <span className="text-sm font-semibold text-gray-600">Controlar por IMEI/Serial</span>
                                </label>
                                {productType !== 'Apple' && (
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="checkbox" checked={isMinimumStockEnabled} onChange={(e) => handleToggleMinimumStock(e.target.checked)} className="form-checkbox h-4 w-4 text-accent rounded" />
                                        <span className="text-sm font-semibold text-gray-600">Estoque mínimo</span>
                                    </label>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-3 px-3 border rounded-xl bg-gray-100/50 border-gray-200 h-11 transition-all focus-within:ring-2 focus-within:ring-accent/20 focus-within:border-accent w-full sm:w-64 shadow-inner">
                                    <BarcodeIcon className="h-4 w-4 text-muted shrink-0" />
                                    <input
                                        type="text"
                                        value={currentItem.barcode || ''}
                                        onChange={(e) => handleCurrentItemChange('barcode', e.target.value)}
                                        className="bg-transparent border-none text-sm outline-none w-full placeholder:text-gray-400 font-bold"
                                        placeholder="CÓDIGO DE BARRAS..."
                                    />
                                </div>
                                {isMinimumStockEnabled && productType !== 'Apple' && (
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Qtd. Mínima:</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={currentItem.minimumStock ?? 1}
                                            onChange={(e) => handleCurrentItemChange('minimumStock', parseInt(e.target.value) || 1)}
                                            className={`${inputClasses} w-20 h-8 text-center font-bold`}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <button type="button" onClick={handleAddItem} className="w-full lg:w-auto px-8 py-3 bg-success text-white rounded-xl font-bold hover:bg-success/90 flex items-center justify-center gap-2 transition-all shadow-lg shadow-success/20">
                            <PlusIcon className="h-6 w-6" /> Adicionar Item
                        </button>
                    </div>
                </div>

                <div className="border border-border rounded-lg overflow-x-auto flex-1 min-h-[150px]">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100/50 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                            <tr>
                                <th className="p-4 text-left first:rounded-tl-2xl">Qtd</th>
                                <th className="p-4 text-left">Item / Descrição</th>
                                <th className="p-4 text-right">Custo Un.</th>
                                <th className="p-4 text-right">Custo Adic.</th>
                                <th className="p-4 text-right">Subtotal</th>
                                <th className="p-4 text-center last:rounded-tr-2xl">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {items.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-muted">Nenhum item adicionado.</td></tr>
                            ) : items.map((item, index) => (
                                <tr key={index}>
                                    <td className="p-4 text-left">{item.quantity}</td>
                                    <td className="p-4 text-left font-medium text-primary">
                                        {item.productDetails?.model}
                                        <div className="text-xs text-muted font-normal">
                                            {item.productDetails?.condition} - {item.productDetails?.warranty}
                                            {item.productDetails?.storageLocation && ` (${item.productDetails.storageLocation})`}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">{formatCurrency(item.unitCost)}</td>
                                    <td className="p-4 text-right">{formatCurrency(item.additionalUnitCost)}</td>
                                    <td className="p-4 text-right font-semibold">{formatCurrency((item.finalUnitCost || 0) * (item.quantity || 0))}</td>
                                    <td className="p-4 text-center">
                                        <button onClick={() => removeItem(index)} className="text-danger hover:bg-red-50 p-2 rounded-xl transition-colors"><TrashIcon className="h-5 w-5" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-gray-100 pt-3 mt-2">
                    <div className="w-full sm:w-1/3">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1 block">Observações</label>
                        <textarea name="observations" value={formData.observations || ''} onChange={handleFormChange} className={`${inputClasses} h-10 py-1.5`} placeholder="Notas..." />
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                        <div className="flex gap-4 text-xs"><span className="text-muted">Subtotal:</span><span className="font-bold text-gray-700">{formatCurrency(subTotal)}</span></div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted">Custo Adicional:</span>
                            {formData.origin === 'Importação' ? (
                                <span className="text-xs font-bold w-24 text-right">{formatCurrency(calculatedAdditionalCost)}</span>
                            ) : (
                                <CurrencyInput
                                    value={formData.additionalCost}
                                    onChange={v => setFormData(p => ({ ...p, additionalCost: v || 0 }))}
                                    className="w-24 p-1 border-b border-gray-200 text-right text-xs bg-transparent outline-none focus:border-accent"
                                />
                            )}
                        </div>
                        <div className="flex gap-4 text-base font-black text-primary border-t border-dashed border-gray-200 pt-1 mt-1"><span>Total:</span><span>{formatCurrency(total)}</span></div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center pt-3 pb-5 gap-4 px-8 md:px-6">
                <button type="button" onClick={() => setStep(1)} className="w-full md:w-auto px-8 py-3 bg-white border-2 border-gray-100 text-gray-500 rounded-2xl hover:bg-gray-50 font-bold transition-all order-2 md:order-1 active:scale-95 flex items-center justify-center gap-2">
                    <ChevronLeftIcon className="h-5 w-5" />
                    Voltar
                </button>
                <div className="flex gap-4 w-full md:w-auto order-1 md:order-2">
                    <button type="button" onClick={() => onClose(false)} className="hidden md:block px-6 py-3 text-gray-400 font-bold hover:text-red-500 transition-colors">Cancelar</button>
                    <button type="submit" onClick={handleSubmit} disabled={isSaving} className="w-full md:w-auto px-12 py-3 bg-success text-white rounded-2xl hover:bg-success/90 font-black flex items-center justify-center gap-3 disabled:bg-muted transition-all shadow-xl shadow-success/20 active:scale-95">
                        {isSaving ? <SpinnerIcon className="h-6 w-6 animate-spin" /> : (
                            <>
                                Finalizar Compra
                                <CheckIcon className="h-6 w-6" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </>
    );

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[9999] p-4 animate-fade-in font-sans">
            <form className="bg-surface w-full max-w-5xl h-auto max-h-[92vh] rounded-[2rem] md:rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col overflow-visible animate-scale-in">
                {step === 1 ? renderStep1() : renderStep2()}
            </form>
            {isSupplierModalOpen && <CustomerModal entity={null} initialType="Fornecedor" onClose={() => setIsSupplierModalOpen(false)} onSave={handleSaveNewSupplier as any} />}
        </div>,
        document.body
    );
};
