
import React from 'react';
import { PixIcon, CashIcon, CreditCardIcon, DeviceExchangeIcon, ReceiptIcon } from '../icons.tsx';

export const getPaymentIcon = (name: string, type: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('pix')) return <PixIcon />; // Uses the new, official Pix icon
    if (lower.includes('troca')) return <DeviceExchangeIcon />;
    if (lower.includes('dinheiro') || lower.includes('espécie')) return <CashIcon />;
    if (lower.includes('crediário') || lower.includes('promissória')) return <ReceiptIcon />;
    if (type === 'card' || lower.includes('cartão') || lower.includes('cre')) return <CreditCardIcon />;
    return <CashIcon />;
};
