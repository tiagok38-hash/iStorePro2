import React, { useState } from 'react';
import { ChatMessage as ChatMessageType } from '../../contexts/ChatContext.tsx';
import { EditIcon, CheckIcon, CloseIcon } from '../icons.tsx';

interface ChatMessageProps {
    message: ChatMessageType;
    isOwnMessage: boolean;
    onEdit?: (messageId: string, newContent: string) => Promise<boolean>;
    canEdit?: boolean; // Dentro de 5 minutos
}

const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const isWithin5Minutes = (isoString: string): boolean => {
    const msgTime = new Date(isoString).getTime();
    const now = Date.now();
    return now - msgTime < 5 * 60 * 1000;
};

const getInitials = (name?: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getAvatarColor = (senderId: string): string => {
    const colors = [
        'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500',
        'bg-pink-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-rose-500',
    ];
    let hash = 0;
    for (let i = 0; i < senderId.length; i++) {
        hash = senderId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const ChatMessageComponent: React.FC<ChatMessageProps> = ({
    message,
    isOwnMessage,
    onEdit,
    canEdit,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(message.content);
    const [savingEdit, setSavingEdit] = useState(false);

    const showEdit = isOwnMessage && canEdit && onEdit && isWithin5Minutes(message.created_at);

    const handleSaveEdit = async () => {
        if (!editValue.trim() || editValue.trim() === message.content) {
            setIsEditing(false);
            return;
        }
        setSavingEdit(true);
        const ok = await onEdit!(message.id, editValue);
        setSavingEdit(false);
        if (ok) setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSaveEdit();
        }
        if (e.key === 'Escape') {
            setEditValue(message.content);
            setIsEditing(false);
        }
    };

    // Conteúdo do texto com quebra de linha respeitada
    const renderContent = (text: string) => {
        return text.split('\n').map((line, i, arr) => (
            <React.Fragment key={i}>
                {line}
                {i < arr.length - 1 && <br />}
            </React.Fragment>
        ));
    };

    if (isOwnMessage) {
        return (
            <div className="flex justify-end items-end gap-2 group px-4 py-0.5">
                <div className="max-w-[75%] sm:max-w-[65%]">
                    {isEditing ? (
                        <div className="flex flex-col gap-2">
                            <textarea
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                rows={2}
                                autoFocus
                                className="w-full px-3 py-2 rounded-xl bg-violet-100 border border-violet-300 text-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
                                style={{ minWidth: 200 }}
                            />
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => { setEditValue(message.content); setIsEditing(false); }}
                                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors"
                                >
                                    <CloseIcon className="w-3.5 h-3.5" />
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={savingEdit}
                                    className="flex items-center gap-1 text-xs text-violet-700 font-semibold hover:text-violet-900 transition-colors disabled:opacity-50"
                                >
                                    <CheckIcon className="w-3.5 h-3.5" />
                                    Salvar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="relative group/bubble">
                            <div className="rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-600 to-violet-700 text-white px-4 py-2.5 shadow-md">
                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                    {renderContent(message.content)}
                                </p>
                                <div className="flex items-center justify-end gap-1.5 mt-1">
                                    {message.is_edited && (
                                        <span className="text-[10px] text-violet-200 italic">editado</span>
                                    )}
                                    <span className="text-[11px] text-violet-200 font-medium">
                                        {formatTime(message.created_at)}
                                    </span>
                                </div>
                            </div>
                            {showEdit && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="absolute -left-7 top-1/2 -translate-y-1/2 opacity-0 group-hover/bubble:opacity-100 transition-opacity p-1 text-gray-400 hover:text-violet-600"
                                    title="Editar mensagem"
                                >
                                    <EditIcon className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Mensagem de outro usuário
    const avatarColor = getAvatarColor(message.sender_id);
    const initials = getInitials(message.sender_name);

    return (
        <div className="flex items-end gap-2 px-4 py-0.5">
            <div className={`flex-shrink-0 w-7 h-7 rounded-full ${avatarColor} flex items-center justify-center text-white text-[10px] font-bold shadow`}>
                {message.sender_avatar ? (
                    <img src={message.sender_avatar} alt={message.sender_name} className="w-full h-full rounded-full object-cover" />
                ) : (
                    initials
                )}
            </div>
            <div className="max-w-[75%] sm:max-w-[65%]">
                <p className="text-[11px] text-gray-400 font-semibold mb-0.5 ml-1">
                    {message.sender_name || 'Usuário'}
                </p>
                <div className="rounded-2xl rounded-bl-sm bg-white border border-gray-100 shadow-sm px-4 py-2.5">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                        {renderContent(message.content)}
                    </p>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                        {message.is_edited && (
                            <span className="text-[10px] text-gray-300 italic">editado</span>
                        )}
                        <span className="text-[11px] text-gray-300 font-medium">
                            {formatTime(message.created_at)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatMessageComponent;
