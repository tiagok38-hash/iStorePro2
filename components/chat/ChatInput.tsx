import React, { useRef, useEffect, useState } from 'react';

interface ChatInputProps {
    onSend: (content: string) => Promise<boolean>;
    disabled?: boolean;
    sending?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled, sending }) => {
    const [value, setValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize do textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }, [value]);

    const handleSend = async () => {
        const trimmed = value.trim();
        if (!trimmed || sending || disabled) return;
        const ok = await onSend(trimmed);
        if (ok) {
            setValue('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.focus();
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const canSend = value.trim().length > 0 && !sending && !disabled;

    return (
        <div className="flex-shrink-0 px-3 py-3 border-t border-gray-100 bg-white">
            <div className="flex items-end gap-2">
                {/* Campo de texto — padrão do sistema */}
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite uma mensagem..."
                    disabled={disabled || sending}
                    rows={1}
                    className="
                        flex-1 resize-none rounded-xl
                        border border-border
                        bg-surface
                        px-3 py-2.5
                        text-sm text-primary
                        placeholder:text-muted/60
                        leading-relaxed
                        max-h-[120px]
                        outline-none
                        focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-all duration-150
                    "
                    style={{ minHeight: 40 }}
                />

                {/* Botão enviar */}
                <button
                    onClick={handleSend}
                    disabled={!canSend}
                    title="Enviar (Enter)"
                    className="
                        flex-shrink-0 w-10 h-10 rounded-xl
                        flex items-center justify-center
                        bg-violet-600 hover:bg-violet-700
                        text-white shadow-sm
                        active:scale-95
                        transition-all duration-150
                        disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none
                    "
                >
                    {sending ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Dica de atalho */}
            <p className="text-[10px] text-muted/50 text-center mt-1.5 select-none">
                Enter para enviar · Shift+Enter para nova linha
            </p>
        </div>
    );
};

export default ChatInput;
