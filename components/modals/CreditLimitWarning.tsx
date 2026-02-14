import React from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import ReactDOM from 'react-dom';
import { formatCurrency } from '../../services/mockApi.ts';

interface CreditLimitWarningProps {
    isOpen: boolean;
    onClose: () => void;
    customerName: string;
    creditLimit: number;
    creditUsed: number;
    purchaseAmount: number;
    onOverride?: () => void; // Admin override
    onOpenProfile?: () => void; // Shortcut to fix limit
}

const CreditLimitWarning: React.FC<CreditLimitWarningProps> = ({
    isOpen, onClose, customerName, creditLimit, creditUsed, purchaseAmount, onOverride, onOpenProfile
}) => {
    if (!isOpen) return null;

    const available = creditLimit - creditUsed;
    const overflow = purchaseAmount - available;

    const modalContent = (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">

                {/* Header with Red Warning Style */}
                <div className="bg-red-50 p-6 flex flex-col items-center border-b border-red-100 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-3 shadow-inner">
                        <Lock className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-xl font-black text-red-900 uppercase tracking-tight">Crédito Bloqueado</h2>
                    <p className="text-sm text-red-700 font-medium mt-1">Limite insuficiente para esta venda.</p>
                </div>

                <div className="p-6 space-y-5">

                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                            <span className="text-xs font-bold text-gray-500 uppercase">Cliente</span>
                            <span className="text-sm font-bold text-gray-800 truncate max-w-[180px]">{customerName}</span>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Limite Total</span>
                                <span className="font-medium text-gray-900">{formatCurrency(creditLimit)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Utilizado</span>
                                <span className="font-medium text-red-600">{formatCurrency(creditUsed)}</span>
                            </div>
                            <div className="flex justify-between text-sm pt-1 border-t border-gray-200 mt-1">
                                <span className="text-gray-700 font-bold">Disponível</span>
                                <span className="font-bold text-gray-900">{formatCurrency(available)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-center">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Tentativa de Venda</p>
                        <p className="text-2xl font-black text-gray-800">{formatCurrency(purchaseAmount)}</p>
                        <p className="text-xs font-bold text-red-500 mt-1">
                            Faltam {formatCurrency(overflow)} de limite
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                        {onOpenProfile && (
                            <button
                                onClick={() => { onClose(); onOpenProfile(); }}
                                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                            >
                                Ajustar Limite do Cliente
                            </button>
                        )}

                        {/* 
                        {onOverride && (
                            <button 
                                onClick={onOverride}
                                className="w-full py-3 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl font-bold transition-all text-xs uppercase tracking-wide"
                            >
                                Autorizar com Senha Gerente
                            </button>
                        )}
                        */}

                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all"
                        >
                            Cancelar Venda
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default CreditLimitWarning;
