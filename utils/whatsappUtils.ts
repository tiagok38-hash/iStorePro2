
/**
 * Utility to handle WhatsApp integration consistently across the application.
 */

/**
 * Formata um número de telefone para o padrão WhatsApp: apenas números e com prefixo 55 (Brasil).
 * @param phone O número de telefone (pode conter máscaras).
 * @returns O número formatado ou vazio se inválido.
 */
export const formatWhatsAppNumber = (phone: string | undefined | null): string => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (!cleaned) return '';

    // Se já começar com 55 e tiver um tamanho compatível com Brasil (55 + DDD + 8 ou 9 dígitos)
    // Brasil: 12 ou 13 dígitos no total com 55.
    // Aceitamos qualquer número longo que comece com 55 como já estando correto.
    if (cleaned.startsWith('55') && cleaned.length >= 11) {
        return cleaned;
    }

    // Para números do Brasil (DDD + Número), adicionamos o 55.
    // Se o número for muito curto (ex: apenas 8 dígitos sem DDD), ainda adicionamos 55 
    // mas o ideal é que o banco tenha o DDD.
    return `55${cleaned}`;
};

/**
 * Gera o link para o WhatsApp (wa.me).
 * @param phone Telefone destino.
 * @param message Mensagem opcional.
 */
export const getWhatsAppLink = (phone: string | undefined | null, message?: string): string => {
    const formattedPhone = formatWhatsAppNumber(phone);

    // Se não houver telefone, gera um link genérico (sem número)
    if (!formattedPhone) {
        const textParam = message ? `?text=${encodeURIComponent(message)}` : '';
        return `https://wa.me/${textParam}`;
    }

    const textParam = message ? `?text=${encodeURIComponent(message)}` : '';
    return `https://wa.me/${formattedPhone}${textParam}`;
};

/**
 * Abre o WhatsApp em uma nova aba.
 */
export const openWhatsApp = (phone: string | undefined | null, message?: string): void => {
    const url = getWhatsAppLink(phone, message);
    window.open(url, '_blank', 'noopener,noreferrer');
};
