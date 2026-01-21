
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
        <aside className="fixed bottom-0 w-full h-16 md:static md:w-20 md:h-full bg-gray-900 flex flex-row md:flex-col items-center justify-between md:justify-start px-2 md:px-0 py-0 md:py-6 text-white shrink-0 shadow-2xl z-20">
            <div className="hidden md:block mb-4 animate-pulse-slow">
                <CashRegisterIcon className="h-10 w-10 text-success" />
            </div>

            <nav className="flex flex-row md:flex-col gap-1 md:gap-4 w-full md:w-full px-0 md:px-2 justify-evenly md:justify-start">
                {items.map(item => (
                    <button
                        key={item.view}
                        onClick={() => onViewChange(item.view)}
                        className={`p-2 md:p-3 rounded-xl flex flex-col items-center gap-1 transition-all group ${activeView === item.view
                            ? 'bg-success text-white shadow-lg shadow-success/20 scale-105'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        title={item.label}
                    >
                        {React.cloneElement(item.icon as React.ReactElement, {
                            className: `h-6 w-6 transition-transform group-hover:scale-110 ${activeView === item.view ? 'animate-bounce-subtle' : ''}`
                        })}
                        <span className="text-[9px] font-bold uppercase tracking-tighter hidden sm:block md:block">{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="flex flex-row md:flex-col items-center gap-2 md:gap-4 md:mt-auto w-auto md:w-full md:px-2 md:pb-2 ml-2 md:ml-0">
                <div className="hidden md:block w-full h-px bg-white/10 mb-2"></div>

                {/* User Profile - Hidden on mobile */}
                <div className="hidden md:flex flex-col items-center gap-1 group cursor-default">
                    <div className="h-10 w-10 rounded-full border-2 border-white/20 overflow-hidden bg-gray-800 flex items-center justify-center transition-all group-hover:border-success/50">
                        {user?.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                        ) : (
                            <UserCircleIcon className="h-8 w-8 text-gray-500" />
                        )}
                    </div>
                    <span className="text-[9px] font-bold text-gray-400 truncate max-w-[64px] transition-colors group-hover:text-white uppercase tracking-tighter">
                        {user?.name?.split(' ')[0] || 'Usuário'}
                    </span>
                </div>

                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    className="p-2 md:p-3 w-10 h-10 md:w-12 md:h-12 rounded-xl text-gray-400 hover:text-danger hover:bg-danger/10 transition-all flex items-center justify-center group"
                    title="Sair do PDV"
                >
                    <LogoutIcon className="h-6 w-6 transition-transform group-hover:scale-110" />
                </button>
            </div>
        </aside>
    );
};

export default React.memo(PosSidebar);
