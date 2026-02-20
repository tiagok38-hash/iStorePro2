/**
 * Receipt PDF Generation & Sharing Utility
 * Generates a PDF from the receipt HTML and shares via WhatsApp, Email, or downloads.
 */
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

interface ShareReceiptOptions {
    receiptElementId: string;
    saleId: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    format: 'A4' | 'thermal';
}

/**
 * Captures the receipt HTML element and generates a PDF Blob.
 */
async function generateReceiptPDF(elementId: string, format: 'A4' | 'thermal'): Promise<Blob> {
    const element = document.querySelector(`.receipt-body`) as HTMLElement;
    if (!element) throw new Error('Receipt content not found');

    // Capture the HTML as a high-resolution canvas
    const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    let pdf: jsPDF;

    if (format === 'thermal') {
        // Thermal: 80mm width, dynamic height
        const pdfWidth = 80;
        const pdfHeight = (imgHeight * pdfWidth) / imgWidth;
        pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfWidth, pdfHeight] });
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    } else {
        // A4: Standard A4 page
        pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const a4Width = 210;
        const a4UsableWidth = a4Width - 20; // 10mm margin each side
        const scaledHeight = (imgHeight * a4UsableWidth) / imgWidth;
        pdf.addImage(imgData, 'PNG', 10, 10, a4UsableWidth, scaledHeight);
    }

    return pdf.output('blob');
}

/**
 * Generates a friendly thank-you message for the customer.
 */
function generateThankYouMessage(saleId: string, customerName?: string): string {
    const firstName = customerName?.split(' ')[0] || '';
    return [
        `Olá${firstName ? `, ${firstName}` : ''}! 😊`,
        ``,
        `Segue em anexo o comprovante da sua compra #${saleId}.`,
        ``,
        `Agradecemos pela preferência e confiança! 🙏`,
        `Qualquer dúvida, estamos à disposição.`,
        `Volte sempre! 💙`,
    ].join('\n');
}

/**
 * Downloads a blob as a file.
 */
function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Share via WhatsApp using Web Share API (with file) or fallback to wa.me with text.
 */
export async function shareViaWhatsApp(options: ShareReceiptOptions): Promise<void> {
    const { saleId, customerName, customerPhone, format, receiptElementId } = options;
    const message = generateThankYouMessage(saleId, customerName);
    const filename = `Comprovante_Venda_${saleId}.pdf`;

    try {
        const pdfBlob = await generateReceiptPDF(receiptElementId, format);
        const file = new File([pdfBlob], filename, { type: 'application/pdf' });

        // Try Web Share API with file (works on mobile Chrome/Safari)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: `Comprovante de Venda #${saleId}`,
                text: message,
                files: [file],
            });
            return;
        }

        // Fallback: Download the PDF, then open WhatsApp with the message
        downloadBlob(pdfBlob, filename);

        const phone = customerPhone?.replace(/\D/g, '') || '';
        const phoneWithCountry = phone.startsWith('55') ? phone : `55${phone}`;
        const waUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message + `\n\n📎 O PDF "${filename}" foi baixado no seu dispositivo. Anexe-o na conversa.`)}`;
        window.open(waUrl, '_blank');
    } catch (error: any) {
        if (error.name === 'AbortError') return; // User cancelled share dialog
        console.error('Error sharing via WhatsApp:', error);

        // Last resort fallback: just open whatsapp with text
        const phone = customerPhone?.replace(/\D/g, '') || '';
        const phoneWithCountry = phone.startsWith('55') ? phone : `55${phone}`;
        window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`, '_blank');
    }
}

/**
 * Share via Email using Web Share API (with file) or fallback to mailto with download.
 */
export async function shareViaEmail(options: ShareReceiptOptions): Promise<void> {
    const { saleId, customerName, customerEmail, format, receiptElementId } = options;
    const message = generateThankYouMessage(saleId, customerName).replace(/[😊🙏💙]/g, '');
    const subject = `Comprovante de Venda #${saleId}`;
    const filename = `Comprovante_Venda_${saleId}.pdf`;

    try {
        const pdfBlob = await generateReceiptPDF(receiptElementId, format);
        const file = new File([pdfBlob], filename, { type: 'application/pdf' });

        // Try Web Share API with file
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: subject,
                text: message,
                files: [file],
            });
            return;
        }

        // Fallback: Download the PDF, then open mailto
        downloadBlob(pdfBlob, filename);

        const to = customerEmail || '';
        const body = message + `\n\n📎 O PDF "${filename}" foi baixado no seu dispositivo. Anexe-o ao e-mail.`;
        window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('Error sharing via email:', error);

        const to = customerEmail || '';
        window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    }
}

/**
 * Download the receipt as PDF only.
 */
export async function downloadReceiptPDF(options: Pick<ShareReceiptOptions, 'receiptElementId' | 'saleId' | 'format'>): Promise<void> {
    const { receiptElementId, saleId, format } = options;
    const filename = `Comprovante_Venda_${saleId}.pdf`;

    try {
        const pdfBlob = await generateReceiptPDF(receiptElementId, format);
        downloadBlob(pdfBlob, filename);
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
}
