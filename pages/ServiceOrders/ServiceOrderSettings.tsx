import React, { useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import {
    CreditCardIcon, WrenchIcon, Cog6ToothIcon
} from '../../components/icons';
import PaymentMethodSettings from '../../components/Settings/PaymentMethodSettings';
import ParameterSettings from '../../components/Settings/ParameterSettings';
import ServiceOrderPreferences from '../../components/Settings/ServiceOrderPreferences';

const ServiceOrderSettings: React.FC = () => {
    const { permissions } = useUser();
    const [activeTab, setActiveTab] = useState('parameters');

    const tabs = [
        { id: 'parameters', label: 'Parâmetros', icon: <WrenchIcon className="h-5 w-5" /> },
        { id: 'payments', label: 'Meios de Pagamento', icon: <CreditCardIcon className="h-5 w-5" /> },
        { id: 'preferences', label: 'Preferências', icon: <Cog6ToothIcon className="h-5 w-5" /> },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'parameters': return <ParameterSettings />;
            case 'payments': return <PaymentMethodSettings />;
            case 'preferences': return <ServiceOrderPreferences />;
            default: return <ParameterSettings />;
        }
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Cog6ToothIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
                    <p className="text-gray-500 text-sm">Gerencie parâmetros, empresa e sistema</p>
                </div>
            </div>

            {/* Top Tab Navigation — horizontal, one line */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 w-fit">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${activeTab === tab.id
                                ? 'bg-gray-900 text-white shadow-md'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            {React.cloneElement(tab.icon as React.ReactElement, {
                                className: `h-4 w-4 ${activeTab === tab.id ? 'text-white' : 'text-gray-400'}`
                            })}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
                {renderContent()}
            </div>
        </div>
    );
};

export default ServiceOrderSettings;

