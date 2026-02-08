
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CashRegisterIcon, CalculatorIcon, ShoppingCartPlusIcon, ArchiveBoxIcon, Cog6ToothIcon, LogoutIcon, UserCircleIcon
} from '../icons.tsx';
import { useUser } from '../../contexts/UserContext.tsx';

type PosView = 'caixas' | 'pdv' | 'estoque' | 'resumo' | 'config';

interface PosSidebarProps {
    activeView: PosView;
    onViewChange: (view: PosView) => void;
}

export const PosSidebar: React.FC<PosSidebarProps> = ({ activeView, onViewChange }) => {
    const { logout, user } = useUser();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const items: { label: string; view: PosView; icon: React.ReactElement }[] = [
        { label: 'Meu Caixa', view: 'resumo', icon: <CalculatorIcon /> },
        { label: 'PDV', view: 'pdv', icon: <ShoppingCartPlusIcon /> },
        { label: 'Caixas', view: 'caixas', icon: <ArchiveBoxIcon /> },
        { label: 'Config', view: 'config', icon: <Cog6ToothIcon /> },
    ];

    return (
        <aside
            className="fixed bottom-0 left-0 right-0 md:static md:w-20 md:h-screen bg-[#111827] border-t md:border-t-0 md:border-r border-white/5 flex flex-col shadow-2xl z-[60] transition-all duration-300 rounded-t-[32px] md:rounded-none overflow-hidden"
        >
            <div className="flex flex-col h-full">
                {/* Desktop Logo */}
                <div className="hidden md:flex mb-10 px-2 pt-10 justify-center">
                    <CashRegisterIcon className="h-10 w-10 text-[#50CA93] animate-pulse-slow" />
                </div>

                {/* Main Navigation Section */}
                <nav className="flex flex-row md:flex-col flex-1 items-center justify-around md:justify-start md:gap-8 px-2 md:px-0 min-h-[72px] md:min-h-0">
                    {items.map(item => {
                        const isActive = activeView === item.view;
                        return (
                            <button
                                key={item.view}
                                onClick={() => onViewChange(item.view)}
                                className={`flex flex-col items-center justify-center transition-all duration-300 group
                                    ${isActive
                                        ? 'w-12 h-12 md:w-14 md:h-14 bg-[#50CA93] rounded-2xl shadow-lg shadow-[#50CA93]/30 scale-110 md:scale-100'
                                        : 'w-12 h-12 text-gray-400 hover:text-white hover:bg-white/5 rounded-2xl'}
                                `}
                            >
                                {React.cloneElement(item.icon as React.ReactElement, {
                                    className: `h-6 w-6 md:h-7 md:w-7 transition-transform duration-300 ${isActive ? 'text-white' : 'group-hover:scale-110'}`
                                })}
                                {/* Labels - Desktop Only */}
                                <span className={`text-[10px] font-bold uppercase tracking-tight text-center leading-none mt-1 hidden md:block transition-colors ${isActive ? 'text-[#50CA93]' : 'text-gray-500 group-hover:text-white'}`}>
                                    {item.label.split(' ')[0]}
                                </span>
                            </button>
                        );
                    })}

                    {/* Integrated Logout on Mobile, Bottom on Desktop */}
                    <button
                        onClick={handleLogout}
                        className="flex flex-col items-center justify-center w-12 h-12 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 group md:mt-auto md:mb-8"
                    >
                        <LogoutIcon className="h-6 w-6 md:h-7 md:w-7 transition-transform group-hover:scale-110" />
                        <span className="text-[10px] font-bold uppercase tracking-tight text-center leading-none mt-1 hidden md:block">Sair</span>
                    </button>
                </nav>

                {/* Desktop User Context */}
                <div className="hidden md:flex flex-col items-center gap-2 group cursor-default pb-10">
                    <div className="h-10 w-10 rounded-full border-2 border-white/10 overflow-hidden bg-gray-800 flex items-center justify-center transition-all group-hover:border-[#50CA93]/50">
                        {user?.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                        ) : (
                            <UserCircleIcon className="h-8 w-8 text-gray-600" />
                        )}
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 truncate max-w-[64px] transition-colors group-hover:text-white uppercase tracking-tighter">
                        {user?.name?.split(' ')[0] || 'Perfil'}
                    </span>
                </div>

                {/* Mobile Safe Area Spacer */}
                <div className="h-[env(safe-area-inset-bottom,16px)] md:hidden bg-transparent shrink-0" />
            </div>
        </aside>
    );
};

export default React.memo(PosSidebar);
