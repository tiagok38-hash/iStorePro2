// Telegram Bot Integration for Sale Notifications

const TELEGRAM_BOT_TOKEN = '8420006290:AAH4gbmv2Qn1XZ7oj5dlUM7VkAvB_XyL8BA';
const TELEGRAM_CHAT_ID = '853368642';

interface SaleNotificationData {
    productDescription: string; // Ex: "iPhone 13 128GB Seminovo"
    profit: number;
    dailyProfit?: number; // Total profit of the day
}

export const sendSaleNotification = async (data: SaleNotificationData): Promise<boolean> => {
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
            console.log('✅ Telegram notification sent successfully');
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
