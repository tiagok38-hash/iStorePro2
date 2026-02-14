import React from 'react';

interface StatusBadgeProps {
    status: string;
    className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
    let colorClass = 'bg-gray-100 text-gray-600';

    switch (status) {
        case 'paid':
        case 'Pago':
        case 'Finalizada':
            colorClass = 'bg-emerald-100 text-emerald-700';
            break;
        case 'pending':
        case 'Pendente':
            colorClass = 'bg-yellow-100 text-yellow-700';
            break;
        case 'overdue':
        case 'Atrasado':
            colorClass = 'bg-red-100 text-red-700';
            break;
        case 'partial':
        case 'Parcial':
            colorClass = 'bg-orange-100 text-orange-700';
            break;
        case 'Cancelada':
            colorClass = 'bg-gray-200 text-gray-500 line-through';
            break;
        default:
            colorClass = 'bg-gray-100 text-gray-600';
    }

    return (
        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${colorClass} ${className}`}>
            {status}
        </span>
    );
};

export default StatusBadge;
