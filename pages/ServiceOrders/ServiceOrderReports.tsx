import React from 'react';
import { BarChart2, FileText, PieChart } from 'lucide-react';

const ServiceOrderReports: React.FC = () => {
    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                <BarChart2 className="text-purple-500" />
                Relatórios
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {['Vendas', 'Serviços', 'Técnicos', 'Estoque'].map((report) => (
                    <button key={report} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all text-left group">
                        <div className="mb-4 p-3 bg-gray-50 rounded-xl w-fit group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
                            <FileText size={24} />
                        </div>
                        <h3 className="font-bold text-gray-900">{report}</h3>
                        <p className="text-sm text-gray-500">Visualizar relatório detalhado</p>
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-gray-400">
                <PieChart size={48} className="mb-4 opacity-50" />
                <p>Selecione um relatório para visualizar.</p>
            </div>
        </div>
    );
};

export default ServiceOrderReports;
