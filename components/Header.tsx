import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogoIcon, UserCircleIcon, LogoutIcon } from './icons.tsx';
import { useUser } from '../contexts/UserContext.tsx';

const Logo: React.FC = () => (
    <Link to="/" className="flex items-center h-full overflow-hidden">
        <div className="relative h-14 w-44 flex items-center overflow-hidden">
            <img
                src="/logo_header_wide.png"
                alt="iStorePro"
                className="absolute h-[240%] w-auto max-w-none left-0 top-[52%] -translate-y-1/2"
                style={{ mixBlendMode: 'multiply' }}
            />
        </div>
    </Link>
);

interface HeaderProps {
    onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = () => {
    const { user, logout } = useUser();
    const navigate = useNavigate();

    const handleLogout = async () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="bg-surface h-16 flex items-center justify-between px-4 border-b border-border lg:hidden sticky top-0 z-30">
            <Logo />

            <div className="flex items-center gap-3">
                <Link to="/company?tab=perfil" className="flex items-center justify-center">
                    {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt="Perfil" className="h-8 w-8 rounded-full border border-border" />
                    ) : (
                        <UserCircleIcon className="h-8 w-8 text-muted" />
                    )}
                </Link>
                <button onClick={handleLogout} className="text-muted hover:text-danger p-1" aria-label="Sair">
                    <LogoutIcon className="h-6 w-6" />
                </button>
            </div>
        </header>
    );
};

export default Header;