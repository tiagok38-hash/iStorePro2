import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useChat, useSendMessage, ChatMessage } from '../../contexts/ChatContext.tsx';
import { useUser } from '../../contexts/UserContext.tsx';
import { supabase } from '../../supabaseClient.ts';
import ChatMessageComponent from './ChatMessage.tsx';
import ChatInput from './ChatInput.tsx';
import { CloseIcon, SpinnerIcon } from '../icons.tsx';

interface UserProfile {
    id: string;
    name: string;
    avatar?: string;
}

interface ChatLayoutProps {
    isOpen: boolean;
    onClose: () => void;
}

const formatDateDivider = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    return date.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
};

const shouldShowDateDivider = (current: ChatMessage, previous?: ChatMessage): string | null => {
    if (!previous) return formatDateDivider(current.created_at);
    const curr = new Date(current.created_at);
    const prev = new Date(previous.created_at);
    if (
        curr.getFullYear() !== prev.getFullYear() ||
        curr.getMonth() !== prev.getMonth() ||
        curr.getDate() !== prev.getDate()
    ) {
        return formatDateDivider(current.created_at);
    }
    return null;
};

const ChatLayout: React.FC<ChatLayoutProps> = ({ isOpen, onClose }) => {
    const { user } = useUser();
    const { messages, loading, loadingMore, hasMore, loadMore, refetchMessages, typingUsers, sendTypingEvent, openChat } = useChat();
    const { sending, sendMessage, editMessage } = useSendMessage(user?.id ?? null);

    const [unreadInChat, setUnreadInChat] = useState(0);

    // Notification Preview State
    const [showPreview, setShowPreview] = useState(false);
    const [previewContent, setPreviewContent] = useState<{ name: string, text: string, avatar: string | undefined } | null>(null);
    const lastMessageCountRef = useRef(messages.length);
    const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Wrapper de envio: tenta Realtime, mas garante refetch como fallback
    const handleSend = useCallback(async (content: string): Promise<boolean> => {
        const ok = await sendMessage(content);
        if (ok) {
            // Pequeno delay para dar chance ao Realtime de entregar
            // Se não entregar, o refetch garante que a mensagem apareça
            setTimeout(() => refetchMessages(), 800);
        }
        return ok;
    }, [sendMessage, refetchMessages]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const prevScrollHeightRef = useRef<number>(0);
    const isInitialScrollRef = useRef(true);

    // Cache de perfis de usuários para evitar re-fetches
    const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(new Map());

    // Busca nomes dos usuários únicos nas mensagens
    useEffect(() => {
        const uniqueSenderIds = [...new Set(messages.map(m => m.sender_id))].filter(
            id => !userProfiles.has(id)
        );

        if (uniqueSenderIds.length === 0) return;

        supabase
            .from('users')
            .select('id, name, "avatarUrl"')
            .in('id', uniqueSenderIds)
            .then(({ data }) => {
                if (!data) return;
                setUserProfiles(prev => {
                    const next = new Map(prev);
                    data.forEach((u: any) => {
                        next.set(u.id, { id: u.id, name: u.name, avatar: u.avatarUrl });
                    });
                    return next;
                });
            });
    }, [messages]);

    // Scroll automático para o fim quando chegam mensagens novas
    const scrollToBottom = useCallback((smooth = true) => {
        const container = messagesContainerRef.current;
        if (container) {
            // Usamos scrollTo diretamente no container para maior controle
            container.scrollTo({
                top: container.scrollHeight,
                behavior: smooth ? 'smooth' : 'auto'
            });
            setUnreadInChat(0); // Limpa novas mensagens ao scrollar pro fim
        }
    }, []);

    useEffect(() => {
        if (!isOpen || loading) return;

        // Scroll inicial ao abrir o chat
        if (isInitialScrollRef.current && messages.length > 0) {
            // Usamos um pequeno timeout para garantir que o DOM renderizou completamente
            const timer = setTimeout(() => {
                scrollToBottom(false);
                isInitialScrollRef.current = false;
            }, 100);
            return () => clearTimeout(timer);
        }

        // Lógica de scroll para novas mensagens
        const lastMsg = messages[messages.length - 1];
        if (!lastMsg) return;

        const isOwnMessage = lastMsg.sender_id === user?.id;

        // Se for mensagem do próprio usuário, sempre scrolla para o fim
        if (isOwnMessage) {
            scrollToBottom(true);
        } else {
            // Se for de outro usuário, scrolla apenas se o usuário já estiver "perto" do fundo
            // Isso evita "quebrar" a leitura se o usuário estiver vendo mensagens antigas
            const container = messagesContainerRef.current;
            if (container) {
                const threshold = 150; // pixels de margem
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
                if (isNearBottom) {
                    scrollToBottom(true);
                } else if (!isInitialScrollRef.current) {
                    // Incrementa não lidas se o usuário ativamente rolou pra cima e uma nova mensagem chegou
                    setUnreadInChat(prev => prev + 1);
                }
            }
        }
    }, [messages, loading, scrollToBottom, user?.id, isOpen]);

    // Quando o chat abre, scroll para o fim imediatamente e oculta preview
    useEffect(() => {
        if (isOpen && !loading) {
            scrollToBottom(false);
            setShowPreview(false);
        }
    }, [isOpen, loading, scrollToBottom]);

    // Cleanup preview timer and detect new messages for preview
    useEffect(() => {
        if (messages.length > lastMessageCountRef.current) {
            const newMsg = messages[messages.length - 1];
            // Se chat fechado e mensagem não é nossa
            if (!isOpen && newMsg.sender_id !== user?.id) {
                const sName = userProfiles.get(newMsg.sender_id)?.name || newMsg.sender_name || 'Novo usuário';
                const sAvatar = userProfiles.get(newMsg.sender_id)?.avatar || newMsg.sender_avatar;

                setPreviewContent({ name: sName, text: newMsg.content, avatar: sAvatar });
                setShowPreview(true);

                if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
                previewTimeoutRef.current = setTimeout(() => {
                    setShowPreview(false);
                }, 4000);
            }
        }
        lastMessageCountRef.current = messages.length;
    }, [messages, isOpen, user?.id, userProfiles]);

    useEffect(() => {
        return () => {
            if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
        };
    }, []);

    // Preserva posição do scroll ao carregar mensagens antigas
    const handleLoadMore = useCallback(async () => {
        const container = messagesContainerRef.current;
        if (!container) return;
        prevScrollHeightRef.current = container.scrollHeight;
        await loadMore();
        // Restore scroll position after prepending older messages
        requestAnimationFrame(() => {
            if (container) {
                const newScrollHeight = container.scrollHeight;
                container.scrollTop = newScrollHeight - prevScrollHeightRef.current;
            }
        });
    }, [loadMore]);

    // Scroll listener para detectar aproximação do topo (carregar mais) e fim (limpar não lidas)
    const handleScroll = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        if (container.scrollTop < 100 && hasMore && !loadingMore) {
            handleLoadMore();
        }

        // Verifica se chegou ao fim para resetar contador de novas mensagens
        const threshold = 50;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
        if (isNearBottom && unreadInChat > 0) {
            setUnreadInChat(0);
        }
    }, [hasMore, loadingMore, handleLoadMore, unreadInChat]);

    // Enriquecer mensagens com nomes
    const enrichedMessages = messages.map(m => ({
        ...m,
        sender_name: userProfiles.get(m.sender_id)?.name ?? m.sender_name,
        sender_avatar: userProfiles.get(m.sender_id)?.avatar ?? m.sender_avatar,
    }));

    if (!isOpen) {
        return (
            <>
                {showPreview && previewContent && (
                    <div
                        onClick={() => {
                            setShowPreview(false);
                            openChat();
                        }}
                        className="fixed top-4 left-4 right-4 sm:top-20 sm:left-auto sm:right-4 z-[99999] sm:w-[320px] bg-white rounded-2xl shadow-2xl border border-violet-100 p-4 flex items-start gap-3 cursor-pointer animate-fade-in-down sm:animate-fade-in-right hover:scale-[1.02] transition-transform"
                        style={{ boxShadow: '0 20px 60px rgba(123, 97, 255, 0.2), 0 8px 20px rgba(0,0,0,0.1)' }}
                    >
                        {previewContent.avatar ? (
                            <img src={previewContent.avatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover shrink-0 border border-violet-100 bg-gray-50" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                                <span className="text-violet-600 font-bold text-sm">
                                    {previewContent.name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                        <div className="flex-1 min-w-0 pr-2">
                            <h4 className="text-sm font-bold text-gray-800 line-clamp-1">{previewContent.name}</h4>
                            <p className="text-xs text-gray-500 line-clamp-2 mt-0.5 break-words">
                                {previewContent.text}
                            </p>
                            <span className="text-[10px] text-violet-500 font-medium mt-1 md:mt-1.5 inline-flex items-center gap-1 bg-violet-50 px-2 py-0.5 rounded-full">
                                Toque para abrir o chat
                            </span>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowPreview(false);
                            }}
                            className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <CloseIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
                <style>{`
                    @keyframes fade-in-right {
                        from { opacity: 0; transform: translateX(20px) scale(0.95); }
                        to { opacity: 1; transform: translateX(0) scale(1); }
                    }
                    @keyframes fade-in-down {
                        from { opacity: 0; transform: translateY(-20px) scale(0.95); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    .animate-fade-in-right {
                        animation: fade-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }
                    .animate-fade-in-down {
                        animation: fade-in-down 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }
                    @media (min-width: 640px) {
                        .sm\\:animate-fade-in-right {
                            animation: fade-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                        }
                    }
                `}</style>
            </>
        );
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[200] bg-black/20 backdrop-blur-[2px] lg:bg-transparent lg:backdrop-blur-none lg:pointer-events-none"
                onClick={onClose}
            />

            {/* Painel do Chat */}
            <div
                className={`
          fixed z-[201] flex flex-col
          bottom-0 left-0 right-0 h-[85dvh]
          lg:bottom-6 lg:right-6 lg:left-auto lg:top-auto lg:w-[400px] lg:h-[600px]
          bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl
          border border-gray-100
          animate-chat-slide-up
        `}
                style={{
                    boxShadow: '0 25px 80px rgba(123, 97, 255, 0.15), 0 8px 32px rgba(0,0,0,0.12)'
                }}
            >
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-gradient-to-r from-violet-600 to-violet-700 rounded-t-3xl lg:rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-white font-bold text-sm leading-tight">Chat Interno</h2>
                            <p className="text-violet-200 text-[11px] leading-tight">
                                {messages.length > 0
                                    ? `${messages.length} mensagem${messages.length !== 1 ? 's' : ''}`
                                    : 'Grupo global'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/20 transition-colors"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Área de mensagens */}
                <div
                    ref={messagesContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto py-3 space-y-0.5 scroll-smooth"
                    style={{ overscrollBehavior: 'contain' }}
                >
                    {/* Carregando mais antigas */}
                    {loadingMore && (
                        <div className="flex justify-center py-3">
                            <span className="text-xs text-gray-400 bg-gray-50 rounded-full px-3 py-1">
                                Carregando mensagens anteriores...
                            </span>
                        </div>
                    )}

                    {/* Botão "Ver mais" quando tem mais e não está carregando */}
                    {hasMore && !loadingMore && !loading && messages.length > 0 && (
                        <div className="flex justify-center py-2">
                            <button
                                onClick={handleLoadMore}
                                className="text-xs text-violet-600 hover:text-violet-800 font-medium bg-violet-50 hover:bg-violet-100 rounded-full px-4 py-1.5 transition-colors"
                            >
                                Ver mensagens anteriores
                            </button>
                        </div>
                    )}

                    {/* Estado de loading inicial */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center h-full gap-3">
                            <SpinnerIcon size={32} className="text-violet-500" />
                            <p className="text-sm text-gray-400">Carregando chat...</p>
                        </div>
                    )}

                    {/* Estado vazio */}
                    {!loading && messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center">
                                <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-gray-600 font-semibold text-sm">Sem mensagens ainda</p>
                                <p className="text-gray-400 text-xs mt-1">Seja o primeiro a enviar uma mensagem!</p>
                            </div>
                        </div>
                    )}

                    {/* Mensagens */}
                    {!loading && enrichedMessages.map((message, index) => {
                        const isOwn = message.sender_id === user?.id;
                        const previous = index > 0 ? enrichedMessages[index - 1] : undefined;
                        const dateDivider = shouldShowDateDivider(message, previous);

                        return (
                            <React.Fragment key={message.id}>
                                {dateDivider && (
                                    <div className="flex items-center gap-3 px-4 py-2">
                                        <div className="flex-1 h-px bg-gray-100" />
                                        <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap bg-gray-50 px-3 py-0.5 rounded-full">
                                            {dateDivider}
                                        </span>
                                        <div className="flex-1 h-px bg-gray-100" />
                                    </div>
                                )}
                                <ChatMessageComponent
                                    message={message}
                                    isOwnMessage={isOwn}
                                    onEdit={editMessage}
                                    canEdit={isOwn}
                                />
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Status de Digitanto e Botão de Scroll (Flutuantes sobre o Input) */}
                <div className="absolute bottom-[72px] left-0 right-0 px-4 pointer-events-none flex flex-col items-center justify-end">
                    {/* Botão de Novas Mensagens */}
                    {unreadInChat > 0 && (
                        <button
                            onClick={() => scrollToBottom(true)}
                            className="pointer-events-auto mb-2 px-4 py-1.5 bg-violet-600 text-white text-[11px] font-semibold rounded-full shadow-lg shadow-violet-600/30 flex items-center gap-2 hover:-translate-y-0.5 transition-transform animate-fade-in-up"
                        >
                            <span>{unreadInChat} nova{unreadInChat > 1 ? 's' : ''} mensagem{unreadInChat > 1 ? 'ns' : ''}</span>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </button>
                    )}

                    {/* Indicador de Digitanto */}
                    {typingUsers.length > 0 && (
                        <div className="w-full flex justify-start mb-1 animate-fade-in">
                            <div className="bg-white/80 backdrop-blur-sm border border-gray-100 rounded-2xl rounded-bl-sm px-3 py-1.5 shadow-sm inline-flex items-center gap-1.5">
                                <span className="text-[10px] text-gray-500 italic">
                                    {typingUsers.length === 1
                                        ? `${typingUsers[0]} está digitando...`
                                        : `${typingUsers.join(', ')} estão digitando...`}
                                </span>
                                <div className="flex gap-0.5 items-center mt-0.5">
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <ChatInput
                    onSend={handleSend}
                    sending={sending}
                    disabled={!user}
                    onTyping={() => {
                        if (user?.name) sendTypingEvent(user.name);
                    }}
                />
            </div>
        </>
    );
};

export default ChatLayout;
