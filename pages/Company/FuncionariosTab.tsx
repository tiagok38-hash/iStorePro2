
import React, { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PermissionSet } from '../../types.ts';
import { useUser } from '../../contexts/UserContext.tsx';
import Comissoes from '../Comissoes.tsx';
import BancoHorasTab from '../BancoHorasTab.tsx';
import GerenciarFuncionariosTab from '../GerenciarFuncionariosTab.tsx';

// --- FUNCIONARIOS TAB (Wrapper for Comissoes and Banco de Horas) ---
const FuncionariosTab: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const { permissions } = useUser();
    const activeSubTab = searchParams.get('subtab') || 'comissoes';

    const subTabs = useMemo(() => [
        { id: 'gerencia', label: 'Gerenciar Funcionários', permission: 'canManageEmployees' },
        { id: 'banco_horas', label: 'Banco de Horas', permission: 'canManageBancoHoras' },
        { id: 'comissoes', label: 'Comissões', permission: 'canAccessComissoes' },
    ], []);

    const visibleSubTabs = useMemo(() => {
        if (!permissions) return [];
        return subTabs.filter(tab => permissions[tab.permission as keyof PermissionSet]);
    }, [permissions, subTabs]);

    useEffect(() => {
        if (visibleSubTabs.length > 0 && !visibleSubTabs.find(t => t.id === activeSubTab)) {
            setSearchParams(prev => {
                const newParams = new URLSearchParams(prev);
                newParams.set('subtab', visibleSubTabs[0].id);
                return newParams;
            }, { replace: true });
        }
    }, [visibleSubTabs, activeSubTab, setSearchParams]);

    const renderSubContent = () => {
        switch (activeSubTab) {
            case 'gerencia': return <GerenciarFuncionariosTab />;
            case 'comissoes': return <Comissoes />;
            case 'banco_horas': return <BancoHorasTab />;
            default: return <GerenciarFuncionariosTab />;
        }
    };

    if (visibleSubTabs.length === 0) return <div className="p-8 text-center text-muted">Acesso negado.</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-1 bg-gray-50 p-1.5 rounded-2xl border border-gray-200 w-fit shadow-sm">
                {visibleSubTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setSearchParams(prev => {
                            const newParams = new URLSearchParams(prev);
                            newParams.set('subtab', tab.id);
                            return newParams;
                        }, { replace: true })}
                        className={`px-8 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${activeSubTab === tab.id ? 'bg-primary text-white shadow-md shadow-gray-900/10' : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="w-full">
                {renderSubContent()}
            </div>
        </div>
    );
};

export default FuncionariosTab;
