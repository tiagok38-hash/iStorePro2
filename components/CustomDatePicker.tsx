import React, { useState, useEffect, useRef } from 'react';
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import { toDateValue } from '../utils/dateUtils';

interface CustomDatePickerProps {
    value: string;
    onChange: (date: string) => void;
    max?: string;
    min?: string;
    label?: string;
    className?: string;
    title?: string;
    disabled?: boolean;
    align?: 'left' | 'right' | 'auto';
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
    value,
    onChange,
    max,
    min,
    label,
    className,
    title,
    disabled,
    align = 'auto'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const [horizontalAlign, setHorizontalAlign] = useState<'left' | 'right'>('left');
    const [viewDate, setViewDate] = useState(() => {
        if (value) {
            const parsed = new Date(value + 'T12:00:00');
            if (!isNaN(parsed.getTime())) return parsed;
        }
        return new Date();
    });
    const containerRef = useRef<HTMLDivElement>(null);

    const handleToggle = () => {
        if (disabled) return;
        if (!isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;

            // Se o espaço abaixo for menor que 260px e houver mais espaço em cima, abre para cima
            setOpenUpward(spaceBelow < 260 && spaceAbove > spaceBelow);

            // Alinhamento horizontal
            if (align === 'right') {
                setHorizontalAlign('right');
            } else if (align === 'left') {
                setHorizontalAlign('left');
            } else {
                const spaceRight = window.innerWidth - rect.left;
                setHorizontalAlign(spaceRight < 250 ? 'right' : 'left');
            }
        }
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Update viewDate when value changes from outside
    useEffect(() => {
        if (value) {
            const parsed = new Date(value + 'T12:00:00');
            if (!isNaN(parsed.getTime())) {
                setViewDate(parsed);
            }
        }
    }, [value]);

    const handlePrevMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        const nextMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
        if (max && nextMonth > new Date(max + 'T23:59:59')) return;
        setViewDate(nextMonth);
    };

    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const isToday = (day: number) => {
        const d = new Date();
        return d.getDate() === day && d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
    };

    const isSelected = (day: number) => {
        if (!value) return false;
        const d = new Date(value + 'T12:00:00');
        return d.getDate() === day && d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
    };

    const isDisabled = (day: number) => {
        if (max) {
            const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
            if (d > new Date(max + 'T23:59:59')) return true;
        }
        if (min) {
            const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
            if (d < new Date(min + 'T00:00:00')) return true;
        }
        return false;
    };

    const monthName = viewDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    return (
        <div className={`relative ${className || ''}`} ref={containerRef}>
            {label && <label className="text-[10px] font-black uppercase tracking-wider text-muted mb-1 block pl-1">{label}</label>}
            <button
                type="button"
                disabled={disabled}
                onClick={handleToggle}
                className={`flex items-center gap-2 px-3 border rounded-xl text-sm font-medium w-full h-[48px] shadow-sm transition-colors ${
                    disabled 
                        ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed opacity-80' 
                        : 'bg-white border-gray-200 text-gray-700 hover:border-primary/50'
                } ${className || ''}`}
                title={disabled ? 'Restrito a administradores' : title}
            >
                <CalendarDaysIcon className={`w-4 h-4 ${disabled ? 'text-gray-400' : 'text-primary'}`} />
                <span className="truncate">
                    {value ? new Date(value + 'T12:00:00').toLocaleDateString('pt-BR') : 'Selecionar'}
                </span>
            </button>

            {isOpen && (
                <div
                    className={`absolute p-2.5 bg-white border border-gray-200/90 rounded-2xl shadow-xl shadow-black/10 z-[9999] w-[236px] max-w-[calc(100vw-2rem)] select-none animate-in fade-in duration-150 ${
                        openUpward ? 'bottom-full mb-1.5 slide-in-from-bottom-2' : 'top-full mt-1.5 slide-in-from-top-2'
                    } ${
                        horizontalAlign === 'right' ? 'right-0 left-auto' : 'left-0 right-auto max-sm:right-0 max-sm:left-auto'
                    }`}
                >
                    {/* Cabeçalho do mês */}
                    <div className="flex items-center justify-between mb-1.5 px-0.5">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors"
                        >
                            <ChevronLeftIcon className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-black uppercase tracking-wider text-gray-800 capitalize truncate">
                            {monthName}
                        </span>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors"
                        >
                            <ChevronRightIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Dias da semana */}
                    <div className="grid grid-cols-7 gap-1 text-center mb-1">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                            <span key={i} className="text-[10px] font-bold text-gray-400 py-0.5">{d}</span>
                        ))}
                    </div>

                    {/* Grade de dias */}
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((day, idx) => {
                            if (day === null) return <div key={`empty-${idx}`} className="h-7 w-7" />;
                            const dayDisabled = isDisabled(day);
                            const selected = isSelected(day);
                            const today = isToday(day);

                            return (
                                <button
                                    key={day}
                                    type="button"
                                    disabled={dayDisabled}
                                    onClick={() => {
                                        const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                                        onChange(toDateValue(d));
                                        setIsOpen(false);
                                    }}
                                    className={`
                                        h-7 w-7 text-xs font-semibold rounded-lg flex items-center justify-center transition-all
                                        ${dayDisabled
                                            ? 'text-gray-300 cursor-not-allowed'
                                            : selected
                                                ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30 scale-105'
                                                : today
                                                    ? 'bg-indigo-50 text-indigo-600 font-bold border border-indigo-200/80 hover:bg-indigo-100'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                        }
                                    `}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>

                    {/* Rodapé: Limpar e Hoje */}
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between gap-1.5">
                        <button
                            type="button"
                            onClick={() => {
                                onChange('');
                                setIsOpen(false);
                            }}
                            className="flex-1 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-center"
                        >
                            Limpar
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const today = new Date();
                                onChange(toDateValue(today));
                                setViewDate(today);
                                setIsOpen(false);
                            }}
                            className="flex-1 py-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors text-center"
                        >
                            Hoje
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomDatePicker;
