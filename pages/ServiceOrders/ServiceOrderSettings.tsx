import React, { useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import {
    Cog6ToothIcon, CreditCardIcon, WrenchIcon, ShieldCheckIcon,
    BuildingOfficeIcon, ArchiveBoxArrowDownIcon, UserCircleIcon
} from '../../components/icons';
import CompanyProfileSettings from '../../components/Settings/CompanyProfileSettings';
import PaymentMethodSettings from '../../components/Settings/PaymentMethodSettings';
import ParameterSettings from '../../components/Settings/ParameterSettings';
import AuditSettings from '../../components/Settings/AuditSettings';
import BackupSettings from '../../components/Settings/BackupSettings';
import ServiceOrderSettingsUsers from './ServiceOrderSettingsUsers';

const ServiceOrderSettings: React.FC = () => {
    const { permissions } = useUser();
    const [activeTab, setActiveTab] = useState('profile');

    const tabs = [
        { id: 'profile', label: 'Empresa', icon: <BuildingOfficeIcon className="h-5 w-5" /> },
        { id: 'users', label: 'Usuários', icon: <UserCircleIcon className="h-5 w-5" /> },
        { id: 'parameters', label: 'Parâmetros', icon: <WrenchIcon className="h-5 w-5" /> },
        { id: 'payments', label: 'Pagamentos', icon: <CreditCardIcon className="h-5 w-5" /> },
        { id: 'audit', label: 'Auditoria', icon: <ShieldCheckIcon className="h-5 w-5" /> },
        { id: 'backup', label: 'Backup', icon: <ArchiveBoxArrowDownIcon className="h-5 w-5" /> }
    ];

    // Filter tabs based on permissions if needed
    // For now assuming high-level access for settings, or components handle their own permissions

    const renderContent = () => {
        switch (activeTab) {
            case 'profile': return <CompanyProfileSettings />;
            case 'users': return <ServiceOrderSettingsUsers />;
            case 'parameters': return <ParameterSettings />;
            case 'payments': return <PaymentMethodSettings />;
            case 'audit': return <AuditSettings />;
            case 'backup': return <BackupSettings />;
            default: return <CompanyProfileSettings />;
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
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-full">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServiceOrderSettings;
