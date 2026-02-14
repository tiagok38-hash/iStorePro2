import React, { useRef, useState } from 'react';
import { PrinterIcon } from 'lucide-react';
import ReactToPrint from 'react-to-print';
import { CreditInstallment, Sale, Customer, CompanyInfo } from '../../types.ts';
import { formatCurrency, getCompanyInfo, getSale, getCustomer } from '../../services/mockApi.ts';
import { CarnetPrintDocs } from './CarnetPrintDocs.tsx';

interface CarnetPrintButtonProps {
    saleId: string | undefined;
    installments: CreditInstallment[];
    buttonLabel?: string;
    className?: string;
}

export const CarnetPrintButton: React.FC<CarnetPrintButtonProps> = ({
    saleId,
    installments,
    buttonLabel = "Imprimir Carnê",
    className
}) => {
    const componentRef = useRef<any>(null);
    const [loading, setLoading] = useState(false);
    const [printData, setPrintData] = useState<{
        sale: Sale | null;
        customer: Customer | null;
        company: CompanyInfo | null;
    }>({ sale: null, customer: null, company: null });

    const handleBeforeGetContent = async () => {
        if (!saleId) return;
        setLoading(true);
        try {
            // Fetch necessary data
            // 1. Company Info
            // 2. Sale
            // 3. Customer
            const company = await getCompanyInfo(); // Mock or fetch
            const sale = await getSale(saleId);
            const customer = await getCustomer(sale?.customerId || '');

            setPrintData({
                sale,
                customer,
                company: company || { name: 'Minha Loja', address: 'Endereço', city: 'Cidade', state: 'UF', phone: '00 0000-0000' } as any
            });
        } catch (error) {
            console.error("Error preparing print data:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div style={{ display: 'none' }}>
                {printData.sale && printData.customer && printData.company && (
                    <CarnetPrintDocs
                        ref={componentRef}
                        sale={printData.sale}
                        customer={printData.customer}
                        company={printData.company}
                        installments={installments}
                    />
                )}
            </div>

            <ReactToPrint
                trigger={() => (
                    <button
                        className={className || "flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors shadow-sm disabled:opacity-50"}
                        disabled={loading || !saleId}
                    >
                        <PrinterIcon size={16} />
                        {loading ? 'Carregando...' : buttonLabel}
                    </button>
                )}
                content={() => componentRef.current}
                onBeforeGetContent={handleBeforeGetContent}
            />
        </>
    );
};
