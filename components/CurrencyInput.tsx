import React from 'react';

interface CurrencyInputProps {
    value: number | null | undefined;
    onChange: (value: number | null) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    showPrefix?: boolean;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onChange, placeholder = "0,00", className, disabled = false, showPrefix = true }) => {

    const format = (num: number | null | undefined): string => {
        if (num === null || num === undefined || isNaN(num)) return '';
        // Format to a string with 2 decimal places, but without currency symbols or thousands separators yet
        const fixedValue = num.toFixed(2);
        // Replace dot with comma for decimal separator
        const withComma = fixedValue.replace('.', ',');
        // Add thousands separators
        const parts = withComma.split(',');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return parts.join(',');
    };

    const parse = (str: string): number | null => {
        const digits = str.replace(/\D/g, '');
        if (digits === '') return null;
        const numberValue = parseInt(digits, 10);
        return numberValue / 100;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const numericValue = parse(e.target.value);
        onChange(numericValue);
    };

    const displayValue = format(value);

    return (
        <div className={`relative w-full flex items-center overflow-hidden ${className}`}>
            {showPrefix && (
                <span className={`pointer-events-none pl-3 text-sm font-bold whitespace-nowrap shrink-0 ${disabled ? 'text-gray-400' : 'text-muted'}`}>R$</span>
            )}
            <input
                type="text"
                value={displayValue}
                onChange={handleChange}
                placeholder={placeholder}
                className={`flex-1 w-full h-full bg-transparent border-none outline-none focus:ring-0 px-2 placeholder:text-gray-300 ${disabled ? 'cursor-not-allowed' : ''} text-inherit`}
                disabled={disabled}
                data-testid="unit-price-input"
            />
        </div>
    );
};

export default CurrencyInput;