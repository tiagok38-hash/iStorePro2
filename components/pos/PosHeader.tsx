
import React, { useState, useEffect } from 'react';
import { CashRegisterIcon, ArchiveBoxIcon } from '../icons.tsx';

interface PosHeaderProps {
    cashId?: number;
    onOpenStockSearch: () => void;
}

export const PosHeader: React.FC<PosHeaderProps> = ({ cashId, onOpenStockSearch }) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <header className="bg-white/80 backdrop-blur-md min-h-16 pt-[env(safe-area-inset-top)] border-b border-gray-200 flex flex-col justify-center px-4 md:px-6 shrink-0 relative z-10">
            <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-3">
                    <h1 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
                        <div className="p-1.5 bg-success/10 rounded-xl">
                            <CashRegisterIcon className="h-5 w-5 md:h-6 md:w-6 text-success" />
                        </div>
                        <span className="hidden xs:inline">PDV iStore</span>
                    </h1>
                    {cashId && (
                        <div className="flex items-center gap-1.5 bg-success/5 text-success px-3 py-1.5 rounded-full border border-success/20 animate-pulse-subtle">
                            <div className="w-1.5 h-1.5 bg-success rounded-full"></div>
                            <span className="text-[10px] md:text-xs font-black uppercase tracking-wider">
                                Caixa #{cashId}
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3 md:gap-6">
                    <button
                        onClick={onOpenStockSearch}
                        className="flex items-center gap-2 bg-gray-100/80 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl font-bold text-[10px] md:text-xs uppercase transition-all active:scale-95 border border-gray-200"
                        title="Busca Rápida Estoque"
                    >
                        <ArchiveBoxIcon className="h-4 w-4 md:h-5 md:w-5 text-gray-500" />
                        <span className="hidden sm:inline">Estoque</span>
                    </button>
                    <div className="text-right hidden md:block">
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-1">Status do Sistema</p>
                        <p className="text-[11px] font-black text-success font-mono uppercase">Online • {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default React.memo(PosHeader);
