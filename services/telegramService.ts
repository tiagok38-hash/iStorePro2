// Telegram Bot Integration for Sale Notifications

// Get credentials from environment variables (secure - not exposed in code)
const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID || '';

interface SaleNotificationData {
    productDescription: string; // Ex: "iPhone 13 128GB Seminovo"
    profit: number;
    dailyProfit?: number; // Total profit of the day
}

export const sendSaleNotification = async (data: SaleNotificationData): Promise<boolean> => {
    // Skip if credentials not configured
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn('Telegram credentials not configured. Skipping notification.');
        return false;
    }

    try {
        const profitFormatted = data.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        let message = `${data.productDescription} vendido! Lucro R$ ${profitFormatted} 💰`;

        // Add daily profit if available
        if (data.dailyProfit !== undefined && data.dailyProfit > 0) {
            const dailyProfitFormatted = data.dailyProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            message += `\n\n💲 Lucro do dia: R$ ${dailyProfitFormatted}`;
        }

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message
            })
        });

        const result = await response.json();

        if (result.ok) {
            // Notification sent successfully
            return true;
        } else {
            console.error('❌ Telegram notification failed:', result);
            return false;
        }
    } catch (error) {
        console.error('❌ Error sending Telegram notification:', error);
        return false;
    }
};

// Test function to verify the bot is working
export const testTelegramConnection = async (): Promise<boolean> => {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn('Telegram credentials not configured.');
        return false;
    }

    try {
        const message = `🔔 Teste de Conexão\n\nA integração do iStore com o Telegram está funcionando! ✅`;

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message
            })
        });

        const result = await response.json();
        return result.ok;
    } catch (error) {
        console.error('Error testing Telegram connection:', error);
        return false;
    }
};

interface PurchaseNotificationData {
    userName: string;
    supplierName: string;
    total: number;
}

export const sendPurchaseNotification = async (data: PurchaseNotificationData): Promise<boolean> => {
    // Skip if credentials not configured
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn('Telegram credentials not configured. Skipping notification.');
        return false;
    }

    try {
        const totalFormatted = data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        // Format: Nova compra lancada no estoque por (nome do usuario que lancou) 📦 (nome do fornecedor) - R$ (total da compra)
        const message = `Nova compra lançada no estoque por ${data.userName} 📦 ${data.supplierName} - R$ ${totalFormatted}`;

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message
            })
        });

        const result = await response.json();

        if (result.ok) {
            return true;
        } else {
            console.error('❌ Telegram purchase notification failed:', result);
            return false;
        }
    } catch (error) {
        console.error('❌ Error sending Telegram purchase notification:', error);
        return false;
    }
};
