import React, { useState, useEffect } from 'react';

interface MoneyInputProps {
    label: string;
    value: number | undefined;
    onChange: (val: number) => void;
    placeholder?: string;
    className?: string;
    labelClasses?: string;
    inputClasses?: string;
    widthClass?: string;
    prefixClasses?: string;
}

const MoneyInput: React.FC<MoneyInputProps> = ({
    label,
    value,
    onChange,
    placeholder = "0,00",
    labelClasses,
    inputClasses,
    className = "",
    widthClass = "flex-1",
    prefixClasses = "text-gray-400 group-focus-within:text-success"
}) => {

    const formatValue = (num: number | string) => {
        if (!num && num !== 0) return '';
        const numericValue = typeof num === 'string'
            ? parseInt(num.replace(/\D/g, ''), 10) / 100
            : num;

        if (isNaN(numericValue)) return '';
        if (numericValue === 0) return '';

        return numericValue.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const [displayValue, setDisplayValue] = useState('');

    useEffect(() => {
        if (value !== undefined) {
            setDisplayValue(formatValue(value));
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        if (!rawValue) {
            setDisplayValue('');
            onChange(0);
            return;
        }

        const numericValue = parseInt(rawValue, 10) / 100;
        setDisplayValue(formatValue(rawValue));
        onChange(numericValue);
    };

    // Default classes if not provided
    const defaultLabelClasses = "block text-[10px] font-bold mb-1 text-primary uppercase tracking-wider";
    const defaultInputClasses = "w-full p-2 pl-10 border rounded-xl bg-surface border-border focus:ring-1 focus:ring-success text-sm font-bold h-10";

    return (
        <div className={`${widthClass} ${className}`}>
            <label className={labelClasses || defaultLabelClasses}>{label}</label>
            <div className="relative group">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold pointer-events-none transition-colors ${prefixClasses}`}>R$</span>
                <input
                    type="text"
                    value={displayValue}
                    onChange={handleChange}
                    placeholder={placeholder}
                    className={`${inputClasses || defaultInputClasses} pl-10`}
                />
            </div>
        </div>
    );
};

export default MoneyInput;
