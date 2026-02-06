
import React from 'react';
import { Product, Customer, User, Sale, PermissionProfile, Brand, Category, ProductModel, Grade, GradeValue, Supplier, ReceiptTermParameter, PaymentMethodParameter } from '../types.ts';
import { CloseIcon } from './icons.tsx';
import NewSaleView from './pos/NewSaleView.tsx';

interface NewSaleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaleSaved: (newSale: Sale) => void;
    customers: Customer[];
    users: User[];
    products: Product[];
    suppliers: Supplier[];
    permissionProfiles: PermissionProfile[];
    brands: Brand[];
    categories: Category[];
    productModels: ProductModel[];
    grades: Grade[];
    gradeValues: GradeValue[];
    receiptTerms: ReceiptTermParameter[];
    onAddNewCustomer: (customerData: Omit<Customer, 'id' | 'createdAt'>) => Promise<Customer | null>;
    onAddProduct: (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { selectedCustomerId?: string }) => Promise<Product | null>;
    openCashSessionId?: string | null;
    saleToEdit?: Sale | null;
    paymentMethods: PaymentMethodParameter[];
}

import { createPortal } from 'react-dom';
import { getNextSaleId } from '../services/mockApi.ts';

const NewSaleModal: React.FC<NewSaleModalProps> = (props) => {
    const [nextId, setNextId] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!props.saleToEdit && props.isOpen) {
            getNextSaleId().then(setNextId);
        } else {
            setNextId(null);
        }
    }, [props.saleToEdit, props.isOpen]);

    if (!props.isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center bg-black/60 backdrop-blur-sm p-0 lg:p-4 animate-fade-in overflow-hidden">
            <div className="bg-white rounded-none lg:rounded-2xl shadow-2xl w-full max-w-6xl h-[100dvh] lg:h-auto lg:max-h-[95vh] flex flex-col relative animate-scale-in">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
                    <h2 className="text-xl font-bold text-gray-800">
                        {props.saleToEdit ? `Editar Venda #${props.saleToEdit.id}` : (nextId ? `Nova Venda #${nextId.replace('ID-', '')}` : 'Nova Venda')}
                    </h2>
                    <button onClick={props.onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><CloseIcon className="h-6 w-6 text-gray-500" /></button>
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar p-2">
                    <NewSaleView
                        {...props}
                        onCancel={props.onClose}
                        onSaleSaved={(sale) => {
                            props.onSaleSaved(sale);
                            props.onClose();
                        }}
                    />
                </div>
            </div>
        </div>,
        document.body
    );
};

export default NewSaleModal;
