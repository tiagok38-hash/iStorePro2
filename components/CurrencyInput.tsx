import React from 'react';

interface CurrencyInputProps {
    value: number | null | undefined;
    onChange: (value: number | null) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    showPrefix?: boolean;
    size?: 'normal' | 'compact';
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({
    value,
    onChange,
    placeholder = "0,00",
    className,
    disabled = false,
    showPrefix = true,
    size = 'normal'
}) => {

    const format = (num: number | null | undefined): string => {
        if (num === null || num === undefined || isNaN(num)) return '';
        const fixedValue = num.toFixed(2);
        const withComma = fixedValue.replace('.', ',');
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

    // Filter out styles that might conflict or duplicate
    // We intentionally keep text colors if passed
    const cleanClassName = className?.split(/\s+/).filter(cls =>
        cls.startsWith('!') || // Keep forced overrides
        (!cls.startsWith('p-') &&
            !cls.startsWith('px-') &&
            !cls.startsWith('py-') &&
            !cls.startsWith('pl-') &&
            !cls.startsWith('pr-') &&
            !cls.startsWith('pt-') &&
            !cls.startsWith('pb-') &&
            !cls.startsWith('rounded') &&
            !cls.startsWith('bg-') &&
            !cls.startsWith('h-') &&
            !cls.startsWith('shadow') &&
            // We do NOT filter out text- classes here, so they can apply to the parent
            !cls.startsWith('w-'))
    ).join(' ') || '';

    // Extract text color explicitly to apply to inner elements if needed
    // But normally inheritance handles it.
    // Specially handling text-orange-600 passed from parent
    const isTextOrange = className?.includes('text-orange-600') || className?.includes('text-[#ea580c]');
    // Check for other text colors if needed, but let's rely on inheritance for now or explicit classes

    const isCompact = size === 'compact';

    return (
        <div className={`
            flex items-center justify-between w-full relative
            ${isCompact ? 'h-9 px-2' : 'h-11 px-3'} 
            bg-white border border-gray-300 rounded-md transition-all overflow-hidden
            focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary
            ${disabled ? 'bg-gray-50 opacity-60' : ''}
            ${cleanClassName}
        `}>
            {showPrefix && (
                <span className={`
                    ${isCompact ? 'text-[11px]' : 'text-sm'} 
                    font-medium select-none shrink-0 pointer-events-none mr-1
                    ${isTextOrange ? 'text-[#ea580c] font-bold' : 'text-gray-500'}
                `}>
                    R$
                </span>
            )}
            <input
                type="text"
                value={displayValue}
                onChange={handleChange}
                placeholder={placeholder}
                className={`
                    flex-1 min-w-0 !border-none !outline-none !shadow-none !bg-transparent !p-0 h-full 
                    ${isCompact ? 'text-[12px]' : 'text-sm'} 
                    font-medium appearance-none text-right
                    focus:!ring-0 focus:!border-none focus:!outline-none
                    ${disabled ? 'cursor-not-allowed' : ''}
                    ${isTextOrange ? '!text-[#ea580c] placeholder:text-orange-300 font-bold' : 'text-gray-800'}
                `}
                style={{ border: 'none', outline: 'none', boxShadow: 'none', padding: 0 }}
                disabled={disabled}
                data-testid="unit-price-input"
            />
        </div>
    );
};

export default CurrencyInput;