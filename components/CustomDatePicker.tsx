import React, { useState, useEffect, useRef } from 'react';
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import { toDateValue } from '../utils/dateUtils';

interface CustomDatePickerProps {
    value: string;
    onChange: (date: string) => void;
    max?: string;
    label?: string;
    className?: string;
    title?: string;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ value, onChange, max, label, className, title }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(() => {
        if (value) {
            const parsed = new Date(value + 'T12:00:00');
            if (!isNaN(parsed.getTime())) return parsed;
        }
        return new Date();
    });
    const containerRef = useRef<HTMLDivElement>(null);

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
        if (!max) return false;
        const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        return d > new Date(max + 'T23:59:59');
    };

    const monthName = viewDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    return (
        <div className={`relative ${className || ''}`} ref={containerRef}>
            {label && <label className="text-[10px] font-black uppercase tracking-wider text-muted mb-1 block pl-1">{label}</label>}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 border rounded-xl bg-white border-gray-200 text-sm font-medium text-gray-700 hover:border-primary/50 transition-colors w-full h-10 shadow-sm ${className || ''}`}
                title={title}
            >
                <CalendarDaysIcon className="w-4 h-4 text-gray-400" />
                <span className="truncate">
                    {value ? new Date(value + 'T12:00:00').toLocaleDateString('pt-BR') : 'Selecionar'}
                </span>
            </button>

            {isOpen && (
                <div
                    className="absolute top-full left-0 mt-2 p-4 bg-white border border-gray-100 rounded-xl shadow-2xl z-50 w-64 animate-in fade-in slide-in-from-top-2 duration-200"
                >
                    <div className="flex items-center justify-between mb-4">
                        <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-xl transition-colors">
                            <ChevronLeftIcon className="w-4 h-4 text-gray-600" />
                        </button>
                        <span className="text-xs font-black uppercase text-gray-800">{monthName}</span>
                        <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-xl transition-colors">
                            <ChevronRightIcon className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center mb-1">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                            <span key={i} className="text-[10px] font-black text-gray-400">{d}</span>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {days.map((day, idx) => {
                            if (day === null) return <div key={`empty-${idx}`} />;
                            const disabled = isDisabled(day);
                            const selected = isSelected(day);
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => {
                                        const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                                        onChange(toDateValue(d));
                                        setIsOpen(false);
                                    }}
                                    className={`
                                        h-8 w-8 text-[11px] font-bold rounded-xl transition-all
                                        ${disabled ? 'text-gray-200 cursor-not-allowed' :
                                            selected ? 'bg-primary text-white shadow-lg shadow-primary/30' :
                                                isToday(day) ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-50'}
                                    `}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                onChange('');
                                setIsOpen(false);
                            }}
                            className="flex-1 px-2 py-1.5 text-[10px] font-black uppercase text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
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
                            className="flex-1 px-2 py-1.5 text-[10px] font-black uppercase bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-colors"
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
