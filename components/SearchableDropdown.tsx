
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SearchIcon, XCircleIcon } from './icons.tsx';

interface SearchableDropdownProps {
    options: { value: string; label: string }[];
    value: string | null;
    onChange: (value: string | null) => void;
    placeholder?: string;
    className?: string;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({ options, value, onChange, placeholder = "Buscar...", className = "" }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [openUpwards, setOpenUpwards] = useState(false);
    const [dropdownStyles, setDropdownStyles] = useState<React.CSSProperties>({});
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = useMemo(() => options.find(opt => opt.value === value), [options, value]);

    // Show dropdown when focused
    const showDropdown = isFocused;

    const filteredOptions = useMemo(() => {
        const term = searchTerm.trim();
        if (term.length < 2) {
            return [];
        }
        return options.filter(option =>
            (option.label || '').toLowerCase().includes(term.toLowerCase())
        );
    }, [options, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const isInsideWrapper = wrapperRef.current && wrapperRef.current.contains(event.target as Node);
            const isInsideDropdown = dropdownRef.current && dropdownRef.current.contains(event.target as Node);

            if (!isInsideWrapper && !isInsideDropdown) {
                setIsFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (showDropdown && wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const dropdownHeight = 220; // Increased slightly for comfort

            let upwards = false;
            // Default to downwards unless there's clearly no space and space above
            if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
                upwards = true;
            }
            setOpenUpwards(upwards);

            const styles: React.CSSProperties = {
                position: 'fixed',
                width: rect.width,
                left: rect.left,
                zIndex: 999999,
            };

            if (upwards) {
                styles.bottom = window.innerHeight - rect.top + 4;
            } else {
                styles.top = rect.bottom + 4;
            }

            setDropdownStyles(styles);
        }
    }, [showDropdown]);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setSearchTerm('');
        setIsFocused(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
        setSearchTerm('');
        inputRef.current?.focus();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const handleFocus = () => {
        setIsFocused(true);
    };

    return (
        <div className="relative w-full h-full" ref={wrapperRef}>
            <div className="relative group h-full">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-muted pointer-events-none group-focus-within:text-accent transition-colors">
                    <SearchIcon className="w-4 h-4" />
                </span>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={selectedOption ? selectedOption.label : placeholder}
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    className={`w-full p-2.5 pl-10 pr-10 border rounded-xl bg-white border-gray-300 focus:ring-2 focus:ring-success/20 focus:border-success text-sm h-full transition-all outline-none font-bold text-gray-800 shadow-sm ${selectedOption && !searchTerm ? 'placeholder:text-gray-800' : 'placeholder:text-gray-400'} ${className}`}
                />
                {(value || searchTerm) && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 group-hover:opacity-100 transition-opacity"
                    >
                        <XCircleIcon className="h-5 w-5 text-muted hover:text-danger" />
                    </button>
                )}
            </div>

            {showDropdown && createPortal(
                <div
                    ref={dropdownRef}
                    className="bg-white border border-border rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] max-h-64 overflow-y-auto custom-scrollbar animate-scale-in"
                    style={{ ...dropdownStyles, zIndex: 9999999 }}
                >
                    <ul className="py-1.5">
                        {searchTerm.trim().length < 2 ? (
                            <li className="px-4 py-4 text-sm text-center text-muted italic">Digite 2 ou mais letras para buscar...</li>
                        ) : filteredOptions.length > 0 ? (
                            filteredOptions.map(option => (
                                <li
                                    key={option.value}
                                    className={`px-4 py-3 text-sm cursor-pointer transition-all flex items-center justify-between group/item ${value === option.value ? 'bg-accent text-white font-bold shadow-md' : 'text-gray-900 hover:bg-accent/5 hover:text-accent'}`}
                                    onClick={() => handleSelect(option.value)}
                                >
                                    <span className="flex-1 truncate pr-4">{option.label || 'Sem Nome'}</span>
                                    {value === option.value ? (
                                        <div className="w-2 h-2 rounded-full bg-white shadow-sm" />
                                    ) : (
                                        <div className="w-1.5 h-1.5 rounded-full bg-accent opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                    )}
                                </li>
                            ))
                        ) : (
                            <li className="px-4 py-4 text-sm text-center text-muted italic">Nenhum resultado encontrado.</li>
                        )}
                    </ul>
                </div>,
                document.body
            )}
        </div>
    );
};

export default SearchableDropdown;
