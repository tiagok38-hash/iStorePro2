import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogoIcon, UserCircleIcon, LogoutIcon } from './icons.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import { useChat } from '../contexts/ChatContext.tsx';
import { CompanyInfo } from '../types.ts';
import { getCompanyInfo } from '../services/mockApi.ts';
import ChatBadge from './chat/ChatBadge.tsx';

const Logo: React.FC = () => (
    <Link to="/" className="flex items-center h-full overflow-hidden">
        <img
            src="/logo_header.png"
            alt="iStorePro"
            className="h-10 w-auto object-contain"
        />
    </Link>
);


interface HeaderProps {
    // onMenuClick removed as it was unused and sidebar is lg:only
}

const Header: React.FC<HeaderProps> = () => {

    const { user, logout } = useUser();
    const navigate = useNavigate();
    const [companyInfo, setCompanyInfo] = React.useState<CompanyInfo | null>(null);
    const { isChatOpen, toggleChat, unreadCount } = useChat();

    React.useEffect(() => {
        const fetchInfo = () => {
            getCompanyInfo().then(setCompanyInfo);
        };
        fetchInfo();
        window.addEventListener('companyInfoUpdated', fetchInfo);
        return () => {
            window.removeEventListener('companyInfoUpdated', fetchInfo);
        };
    }, []);

    const handleLogout = async () => {
        logout();
        navigate('/login');
    };

    const [isOnline, setIsOnline] = React.useState(navigator.onLine);

    React.useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <header className="glass min-h-[60px] pt-[env(safe-area-inset-top)] flex flex-col justify-center px-4 border-b border-white/20 lg:hidden sticky top-0 z-30 shadow-sm backdrop-blur-md">
            <div className="flex items-center justify-between h-[60px]">
                <Logo />

                <div className="flex items-center gap-3">
                    {/* Botão Chat (mobile) */}
                    <ChatBadge
                        count={unreadCount}
                        onClick={toggleChat}
                        isOpen={isChatOpen}
                    />

                    <div className="flex items-center">
                        {companyInfo?.logoUrl && (
                            <div className="relative z-0 -mr-2">
                                <img
                                    src={companyInfo.logoUrl}
                                    alt={companyInfo.name}
                                    className="h-9 w-9 rounded-full border border-border object-cover"
                                />
                            </div>
                        )}
                        <Link to="/company?tab=perfil" className="flex items-center justify-center relative z-10 transition-transform active:scale-95">
                            <div className="absolute -bottom-0.5 -right-0.5 z-20 flex h-3 w-3">
                                {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full h-3 w-3 border-2 border-white ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                            </div>
                            {user?.avatarUrl ? (
                                <img src={user.avatarUrl} alt="Perfil" className="h-9 w-9 rounded-full border-2 border-surface object-cover shadow-sm bg-surface" />
                            ) : (
                                <div className="h-9 w-9 rounded-full bg-surface border-2 border-surface flex items-center justify-center shadow-sm text-muted">
                                    <UserCircleIcon className="h-9 w-9" />
                                </div>
                            )}
                        </Link>
                    </div>
                    <button onClick={handleLogout} className="text-muted hover:text-danger p-1" aria-label="Sair">
                        <LogoutIcon className="h-6 w-6" />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;