
import React from 'react';

interface PatternGridProps {
    patternLock: number[];
    setPatternLock: (pattern: number[] | ((prev: number[]) => number[])) => void;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

const PatternGrid: React.FC<PatternGridProps> = ({ 
    patternLock, 
    setPatternLock, 
    disabled = false,
    size = 'md'
}) => {
    // Configurações baseadas no tamanho para manter a flexibilidade
    const config = {
        sm: { gridW: 'w-36', gap: 'gap-3', dotSize: 'w-9 h-9', fontSize: 'text-xs' },
        md: { gridW: 'w-44', gap: 'gap-4', dotSize: 'w-10 h-10', fontSize: 'text-sm' },
        lg: { gridW: 'w-52', gap: 'gap-6', dotSize: 'w-12 h-12', fontSize: 'text-base' },
    }[size];

    return (
        <div className={`grid grid-cols-3 ${config.gap} ${config.gridW} mx-auto select-none transition-all`}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(dot => {
                const indexInPattern = patternLock.indexOf(dot);
                const isSelected = indexInPattern !== -1;
                
                return (
                    <button
                        key={dot}
                        type="button"
                        onClick={() => {
                            if (disabled) return;
                            if (isSelected) {
                                setPatternLock(prev => (prev as number[]).filter(p => p !== dot));
                            } else {
                                setPatternLock(prev => [...(prev as number[]), dot]);
                            }
                        }}
                        disabled={disabled}
                        className={`${config.dotSize} rounded-full border-[3px] transition-all flex items-center justify-center font-black ${config.fontSize} ${
                            disabled ? (isSelected ? 'bg-gray-400 border-gray-400 text-white scale-110 shadow-sm opacity-60' : 'bg-gray-100 border-gray-200 text-transparent opacity-60') :
                            isSelected ? 'bg-accent border-accent text-white scale-110 shadow-md' : 'bg-white border-gray-300 hover:border-accent/50 text-transparent shadow-inner'
                        }`}
                    >
                        {isSelected ? indexInPattern + 1 : ''}
                    </button>
                )
            })}
        </div>
    );
};

export default PatternGrid;
