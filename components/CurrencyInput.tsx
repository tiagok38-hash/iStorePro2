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

    // Separa classes: as que vão só no wrapper vs. as que vão no input também
    const classes = className?.split(/\s+/) ?? [];

    // Classes de texto/fonte que devem ser aplicadas no input interno
    const inputTextClasses = classes.filter(cls =>
        cls.startsWith('text-') ||
        cls.startsWith('font-') ||
        cls.startsWith('tracking-') ||
        cls.startsWith('leading-')
    ).join(' ');

    // Classes de container (excluindo padding/bg/w que conflitam)
    const wrapperExtraClasses = classes.filter(cls =>
        !cls.startsWith('p-') &&
        !cls.startsWith('px-') &&
        !cls.startsWith('py-') &&
        !cls.startsWith('pl-') &&
        !cls.startsWith('pr-') &&
        !cls.startsWith('pt-') &&
        !cls.startsWith('pb-') &&
        !cls.startsWith('bg-') &&
        !cls.startsWith('w-')
    ).join(' ');

    // Detecta cor especial de texto para prefixo R$ e valor
    const isTextOrange = className?.includes('text-orange') || className?.includes('text-[#ea580c]');
    const isTextSuccess = className?.includes('text-success') || className?.includes('text-green') || className?.includes('text-emerald');
    const isTextBlue = className?.includes('text-blue');

    // Cor do prefixo R$
    const prefixColor = isTextOrange
        ? 'text-orange-500'
        : isTextSuccess
            ? 'text-green-500'
            : isTextBlue
                ? 'text-blue-400'
                : 'text-gray-400';

    // Cor inline do valor (garante aplicação mesmo com Tailwind purge)
    const valueColor = isTextOrange
        ? '#ea580c'
        : isTextSuccess
            ? '#16a34a'
            : isTextBlue
                ? '#2563eb'
                : undefined;

    const isCompact = size === 'compact';

    return (
        <div className={[
            'flex items-center gap-2 border rounded-xl bg-white border-gray-200 transition-colors w-full shadow-sm',
            isCompact ? 'h-9 px-2' : 'h-[48px] px-3',
            'hover:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary',
            disabled ? 'bg-gray-50 opacity-60 cursor-not-allowed' : '',
            wrapperExtraClasses,
        ].join(' ')}>
            {showPrefix && (
                <span className={`shrink-0 pointer-events-none select-none font-black ${prefixColor} ${isCompact ? 'text-xs' : 'text-sm'}`}>
                    R$
                </span>
            )}
            <input
                type="text"
                value={displayValue}
                onChange={handleChange}
                placeholder={placeholder}
                className={[
                    'flex-1 w-full h-full bg-transparent p-0 truncate appearance-none text-left',
                    '!border-none !outline-none !shadow-none !ring-0 !bg-transparent',
                    'focus:!ring-0 focus:!border-none focus:!outline-none',
                    isCompact ? 'text-xs' : '',
                    disabled ? 'cursor-not-allowed' : '',
                    inputTextClasses || 'font-medium text-gray-700',
                    !inputTextClasses ? 'placeholder-gray-400' : 'placeholder:opacity-40',
                ].join(' ')}
                style={{
                    border: 'none',
                    outline: 'none',
                    boxShadow: 'none',
                    ...(valueColor ? { color: valueColor } : {}),
                }}
                disabled={disabled}
                data-testid="unit-price-input"
            />
        </div>
    );
};

export default CurrencyInput;