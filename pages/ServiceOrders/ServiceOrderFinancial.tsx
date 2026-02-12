import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, CreditCard } from 'lucide-react';

const ServiceOrderFinancial: React.FC = () => {
    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                <DollarSign className="text-green-500" />
                Financeiro
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-green-100 rounded-xl text-green-600">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-secondary text-sm font-medium">Receita Total</p>
                            <h3 className="text-2xl font-bold text-gray-900">R$ 0,00</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-red-100 rounded-xl text-red-600">
                            <TrendingDown size={24} />
                        </div>
                        <div>
                            <p className="text-secondary text-sm font-medium">Despesas</p>
                            <h3 className="text-2xl font-bold text-gray-900">R$ 0,00</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <p className="text-secondary text-sm font-medium">Saldo</p>
                            <h3 className="text-2xl font-bold text-gray-900">R$ 0,00</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
                <p>Módulo Financeiro em desenvolvimento.</p>
            </div>
        </div>
    );
};

export default ServiceOrderFinancial;
