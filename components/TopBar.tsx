import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightCircleIcon } from './icons.tsx';
import { CompanyInfo } from '../types.ts';
import { getCompanyInfo } from '../services/mockApi.ts';
import { useUser } from '../contexts/UserContext.tsx';
import { useChat } from '../contexts/ChatContext.tsx';
import ChatBadge from './chat/ChatBadge.tsx';

const TopBar: React.FC = () => {
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const { logout } = useUser();
    const navigate = useNavigate();
    const { isChatOpen, toggleChat, unreadCount } = useChat();

    useEffect(() => {
        const fetchInfo = () => {
            getCompanyInfo().then(setCompanyInfo);
        };

        fetchInfo();
        window.addEventListener('companyInfoUpdated', fetchInfo);

        return () => {
            window.removeEventListener('companyInfoUpdated', fetchInfo);
        };
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const [time, setTime] = useState(new Date());
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            clearInterval(timer);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const dateStr = time.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = time.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return (
        <div className="hidden lg:flex items-center justify-end h-16 px-6 glass border-b border-white/20 sticky top-0 z-30 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-6">
                {/* System Status & Clock */}
                <div className="flex items-center gap-4 pr-6 border-r border-border mr-2">
                    <div className="flex items-center gap-3" title={isOnline ? "Sistema Operacional" : "Sem Conexão"}>
                        <div className="relative flex h-2.5 w-2.5">
                            {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] text-muted font-black uppercase tracking-widest leading-none mb-0.5">{dateStr}</span>
                            <span className="text-xs font-black text-gray-700 leading-none tracking-tight">{timeStr}</span>
                        </div>
                    </div>
                </div>

                <div className="text-right">
                    <p className="text-sm text-muted">Você está logado na empresa</p>
                    <p className="font-bold text-primary">{companyInfo?.name || 'Carregando...'}</p>
                </div>
                {companyInfo?.logoUrl && (
                    <img src={companyInfo.logoUrl} alt={companyInfo.name} className="h-10 w-10 rounded-full object-cover border-2 border-border" />
                )}

                {/* Botão Chat (substitui sino) */}
                <ChatBadge
                    count={unreadCount}
                    onClick={toggleChat}
                    isOpen={isChatOpen}
                />

                <button onClick={handleLogout} className="text-muted hover:text-primary" title="Sair">
                    <ArrowRightCircleIcon className="h-7 w-7" />
                </button>
            </div>
        </div>
    );
};

export default TopBar;