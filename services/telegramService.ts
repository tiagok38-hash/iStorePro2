// Telegram Bot Integration for Sale Notifications
// Supports both multi-tenant (per-company credentials from DB) and
// fallback to global environment variables for backward compatibility.

// Global env fallback  (used if company has no configured token)
const ENV_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '';
const ENV_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID || '';

/**
 * Returns the active credentials: company-specific first, then env fallback.
 */
const resolveCredentials = (botToken?: string, chatId?: string) => ({
    token: botToken || ENV_BOT_TOKEN,
    chatId: chatId || ENV_CHAT_ID,
});

interface SaleNotificationData {
    productDescription: string; // Ex: "iPhone 13 128GB Seminovo"
    profit: number;
    dailyProfit?: number; // Total profit of the day
    // Multi-tenant: company-specific credentials (optional)
    botToken?: string;
    chatId?: string;
}

export const sendSaleNotification = async (data: SaleNotificationData): Promise<boolean> => {
    const { token, chatId } = resolveCredentials(data.botToken, data.chatId);

    if (!token || !chatId) {
        console.warn('Telegram credentials not configured. Skipping notification.');
        return false;
    }

    try {
        const profitFormatted = data.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const timeBRT = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date());

        let message = `[${timeBRT}] ${data.productDescription} vendido! Lucro R$ ${profitFormatted} 💰`;

        if (data.dailyProfit !== undefined && data.dailyProfit > 0) {
            const dailyProfitFormatted = data.dailyProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            message += `\n\n💲 Lucro do dia: R$ ${dailyProfitFormatted}`;
        }

        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message }),
        });

        const result = await response.json();
        if (result.ok) return true;

        console.error('❌ Telegram notification failed:', result);
        return false;
    } catch (error) {
        console.error('❌ Error sending Telegram notification:', error);
        return false;
    }
};

interface PurchaseNotificationData {
    userName: string;
    supplierName: string;
    total: number;
    // Multi-tenant
    botToken?: string;
    chatId?: string;
}

export const sendPurchaseNotification = async (data: PurchaseNotificationData): Promise<boolean> => {
    const { token, chatId } = resolveCredentials(data.botToken, data.chatId);

    if (!token || !chatId) {
        console.warn('Telegram credentials not configured. Skipping notification.');
        return false;
    }

    try {
        const totalFormatted = data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const message = `Nova compra lançada no estoque por ${data.userName} 📦 ${data.supplierName} - R$ ${totalFormatted}`;

        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message }),
        });

        const result = await response.json();
        if (result.ok) return true;

        console.error('❌ Telegram purchase notification failed:', result);
        return false;
    } catch (error) {
        console.error('❌ Error sending Telegram purchase notification:', error);
        return false;
    }
};

/**
 * Sends a test message to verify the bot is working.
 * Accepts company-specific credentials for multi-tenant support.
 */
export const testTelegramConnection = async (botToken?: string, chatId?: string): Promise<{ ok: boolean; error?: string }> => {
    const { token, chatId: resolvedChatId } = resolveCredentials(botToken, chatId);

    if (!token || !resolvedChatId) {
        return { ok: false, error: 'Credenciais não configuradas. Preencha o Token e o Chat ID antes de testar.' };
    }

    try {
        const message = `🔔 *Teste de Conexão*\n\nParabéns\\! A integração do seu sistema com o Telegram está funcionando perfeitamente\\! ✅\n\nA partir de agora, você receberá avisos das vendas aqui mesmo\\.`;

        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: resolvedChatId, text: message, parse_mode: 'MarkdownV2' }),
        });

        const result = await response.json();
        if (result.ok) return { ok: true };

        const apiError = result.description || 'Erro desconhecido da API do Telegram.';
        return { ok: false, error: apiError };
    } catch (error: any) {
        return { ok: false, error: error?.message || 'Erro de conexão com o Telegram.' };
    }
};
