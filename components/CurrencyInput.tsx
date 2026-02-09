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

    // Strip ALL styling classes that should be controlled by the CurrencyInput container only.
    // This prevents "Inception" effect (boxes inside boxes).
    const cleanClassName = className?.split(/\s+/).filter(cls =>
        !cls.startsWith('p-') &&
        !cls.startsWith('px-') &&
        !cls.startsWith('py-') &&
        !cls.startsWith('pl-') &&
        !cls.startsWith('pr-') &&
        !cls.startsWith('pt-') &&
        !cls.startsWith('pb-') &&
        !cls.startsWith('border') &&
        !cls.startsWith('rounded') &&
        !cls.startsWith('bg-') &&
        !cls.startsWith('ring') &&
        !cls.startsWith('h-') &&
        !cls.startsWith('shadow')
    ).join(' ') || '';

    return (
        <div className={`
            flex items-center w-full h-11 bg-white border border-gray-200 rounded-lg transition-all overflow-hidden
            focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary
            ${disabled ? 'bg-gray-50 opacity-60' : ''}
            ${cleanClassName}
        `}>
            {showPrefix && (
                <span className="pl-3 pr-1 text-sm font-bold text-gray-500 select-none shrink-0 pointer-events-none">
                    R$
                </span>
            )}
            <input
                type="text"
                value={displayValue}
                onChange={handleChange}
                placeholder={placeholder}
                className={`
                    flex-1 !border-0 !outline-none !shadow-none !bg-transparent !p-0 h-full text-sm font-bold text-gray-800 appearance-none
                    ${showPrefix ? 'ml-1' : 'ml-3'} mr-3
                    ${disabled ? 'cursor-not-allowed' : ''}
                `}
                style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
                disabled={disabled}
                data-testid="unit-price-input"
            />
        </div>
    );
};

export default CurrencyInput;