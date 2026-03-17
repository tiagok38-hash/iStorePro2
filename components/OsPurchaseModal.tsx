/**
 * OsPurchaseModal — Wrapper que reutiliza o PurchaseOrderModal do ERP principal
 * em modo 'os' (sem opção Apple, título diferente, salva no estoque de OS).
 */
import React from 'react';
import { PurchaseOrderModal } from './PurchaseOrderModal';
import { Supplier, Brand, Category, ProductModel, Grade, GradeValue, PurchaseOrder } from '../types';
import { OsPart, addSupplier } from '../services/mockApi';

interface OsPurchaseModalProps {
    isOpen: boolean;
    onClose: (refresh?: boolean) => void;
    osParts: OsPart[];
    suppliers: Supplier[];
    userId?: string;
    userName?: string;
    brands: Brand[];
    categories: Category[];
    productModels: ProductModel[];
    grades: Grade[];
    gradeValues: GradeValue[];
    purchaseOrderToEdit?: PurchaseOrder | null;
}

const OsPurchaseModal: React.FC<OsPurchaseModalProps> = ({
    isOpen, onClose, osParts, suppliers, userId, userName,
    brands, categories, productModels, grades, gradeValues,
    purchaseOrderToEdit
}) => {
    if (!isOpen) return null;

    const handleAddNewSupplier = async (supplierData: Omit<Supplier, 'id'>) => {
        return await addSupplier(supplierData);
    };

    return (
        <PurchaseOrderModal
            mode="os"
            suppliers={suppliers}
            brands={brands}
            categories={categories}
            productModels={productModels}
            grades={grades}
            gradeValues={gradeValues}
            purchaseOrderToEdit={purchaseOrderToEdit}
            onClose={(refresh) => onClose(refresh)}
            userId={userId}
            userName={userName}
            onAddNewSupplier={handleAddNewSupplier}
        />
    );
};

export default OsPurchaseModal;
