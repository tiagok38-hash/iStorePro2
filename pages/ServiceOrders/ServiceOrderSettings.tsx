import React, { useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import {
    CreditCardIcon, WrenchIcon, UserCircleIcon
} from '../../components/icons';
import PaymentMethodSettings from '../../components/Settings/PaymentMethodSettings';
import ParameterSettings from '../../components/Settings/ParameterSettings';
import Users from '../Users';

const ServiceOrderSettings: React.FC = () => {
    const { permissions } = useUser();
    const [activeTab, setActiveTab] = useState('users');
    const tabs = [
        { id: 'users', label: 'Usuários e Permissões', icon: <UserCircleIcon className="h-5 w-5" /> },
        { id: 'parameters', label: 'Parâmetros', icon: <WrenchIcon className="h-5 w-5" /> },
        { id: 'payments', label: 'Meios de Pagamento', icon: <CreditCardIcon className="h-5 w-5" /> },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'users': return <Users />;
            case 'parameters': return <ParameterSettings />;
            case 'payments': return <PaymentMethodSettings />;
            default: return <Users />;
        }
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
                    <p className="text-gray-500">Gerencie parâmetros, empresa e sistema</p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
                {/* Sidebar Navigation */}
                <div className="w-full lg:w-64 flex-shrink-0">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 space-y-1 sticky top-0">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-all ${activeTab === tab.id
                                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-primary'
                                    }`}
                            >
                                {React.cloneElement(tab.icon as React.ReactElement, {
                                    className: `h-5 w-5 ${activeTab === tab.id ? 'text-white' : 'text-gray-400'}`
                                })}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 min-w-0">
                    <div className="h-full">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServiceOrderSettings;
