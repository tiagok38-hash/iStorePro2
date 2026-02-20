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
    // Find receipt body element inside the container
    const container = document.getElementById(elementId);
    const element = container?.querySelector('.receipt-body') as HTMLElement
        ?? document.querySelector('.receipt-body') as HTMLElement;

    if (!element) {
        throw new Error('Elemento do recibo não encontrado');
    }

    // Capture the HTML as a canvas image
    const canvas = await html2canvas(element, {
        scale: 1.5, // Lower scale for smaller file + faster generation
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        foreignObjectRendering: false, // Avoid document.write issues
        removeContainer: true,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.85); // JPEG for smaller size
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    let pdf: jsPDF;

    if (format === 'thermal') {
        const pdfWidth = 80;
        const pdfHeight = (imgHeight * pdfWidth) / imgWidth;
        pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfWidth, pdfHeight] });
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    } else {
        pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const a4UsableWidth = 190;
        const scaledHeight = (imgHeight * a4UsableWidth) / imgWidth;
        pdf.addImage(imgData, 'JPEG', 10, 10, a4UsableWidth, scaledHeight);
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
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * Share via WhatsApp: generates PDF, downloads it, then opens WhatsApp with message.
 */
export async function shareViaWhatsApp(options: ShareReceiptOptions): Promise<void> {
    const { saleId, customerName, customerPhone, format, receiptElementId } = options;
    const message = generateThankYouMessage(saleId, customerName);
    const filename = `Comprovante_Venda_${saleId}.pdf`;

    try {
        const pdfBlob = await generateReceiptPDF(receiptElementId, format);
        const file = new File([pdfBlob], filename, { type: 'application/pdf' });

        // Try Web Share API with file (works on mobile Chrome/Safari)
        if (navigator.share && navigator.canShare) {
            try {
                const shareData = { title: `Comprovante de Venda #${saleId}`, text: message, files: [file] };
                if (navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                    return;
                }
            } catch (shareErr: any) {
                // If user cancelled share dialog, just return
                if (shareErr?.name === 'AbortError') return;
                // If share failed, fall through to download + wa.me
            }
        }

        // Fallback: Download the PDF, then open WhatsApp with the message
        downloadBlob(pdfBlob, filename);

        const phone = customerPhone?.replace(/\D/g, '') || '';
        const phoneWithCountry = phone.startsWith('55') ? phone : `55${phone}`;
        const waUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message + `\n\n📎 O PDF foi baixado. Anexe-o na conversa.`)}`;

        setTimeout(() => {
            window.open(waUrl, '_blank');
        }, 300);
    } catch (error: any) {
        console.error('Erro ao compartilhar via WhatsApp:', error);
        // Last resort fallback: just open whatsapp with text
        const phone = customerPhone?.replace(/\D/g, '') || '';
        const phoneWithCountry = phone.startsWith('55') ? phone : `55${phone}`;
        window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`, '_blank');
    }
}

/**
 * Share via Email: generates PDF, downloads it, then opens mailto.
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
        if (navigator.share && navigator.canShare) {
            try {
                const shareData = { title: subject, text: message, files: [file] };
                if (navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                    return;
                }
            } catch (shareErr: any) {
                if (shareErr?.name === 'AbortError') return;
            }
        }

        // Fallback: Download the PDF, then open mailto
        downloadBlob(pdfBlob, filename);

        const to = customerEmail || '';
        const body = message + `\n\nO PDF "${filename}" foi baixado. Anexe-o ao e-mail.`;

        setTimeout(() => {
            window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }, 300);
    } catch (error: any) {
        console.error('Erro ao compartilhar via email:', error);
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

    const pdfBlob = await generateReceiptPDF(receiptElementId, format);
    downloadBlob(pdfBlob, filename);
}
