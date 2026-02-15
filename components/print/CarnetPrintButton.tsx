import React, { useRef, useState, useEffect } from 'react';
import { PrinterIcon } from '../icons';
import { useReactToPrint } from 'react-to-print';
import { CreditInstallment, Sale, Customer, CompanyInfo } from '../../types';
import { formatCurrency, getCompanyInfo, getSale, getCustomer } from '../../services/mockApi';
import { CarnetPrintDocs } from './CarnetPrintDocs';
import { useToast } from '../../contexts/ToastContext';

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
    const [shouldPrint, setShouldPrint] = useState(false);
    const [printData, setPrintData] = useState<{
        sale: Sale | null;
        customer: Customer | null;
        company: CompanyInfo | null;
    }>({ sale: null, customer: null, company: null });
    const { showToast } = useToast();

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
    });

    // Effect to trigger print after data is loaded and component is rendered
    useEffect(() => {
        if (shouldPrint && printData.sale && printData.customer && printData.company && componentRef.current) {
            handlePrint();
            setShouldPrint(false);
        }
    }, [shouldPrint, printData, handlePrint]);

    const handlePrepareAndPrint = async () => {
        if (!saleId || loading) return;

        setLoading(true);
        try {
            const company = await getCompanyInfo();
            const sale = await getSale(saleId);

            if (!sale) {
                showToast(`Venda #${saleId} não encontrada no sistema.`, 'error');
                setLoading(false);
                return;
            }

            const customer = await getCustomer(sale.customerId || '');
            if (!customer) {
                showToast(`Cliente da venda #${saleId} não encontrado.`, 'error');
                setLoading(false);
                return;
            }

            setPrintData({
                sale,
                customer,
                company: company || { name: 'Minha Loja', address: 'Endereço', city: 'Cidade', state: 'UF', phone: '00 0000-0000' } as any
            });

            // Set flag to trigger print in useEffect after re-render
            setShouldPrint(true);
        } catch (error: any) {
            console.error("Error preparing print data:", error);
            showToast('Erro ao preparar impressão do carnê. Tente novamente.', 'error');
            setLoading(false);
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

            <button
                onClick={handlePrepareAndPrint}
                className={className || "flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors shadow-sm disabled:opacity-50"}
                disabled={loading || !saleId}
            >
                <PrinterIcon size={16} />
                {loading ? 'Carregando...' : (buttonLabel || "Imprimir Carnê")}
            </button>
        </>
    );
};
