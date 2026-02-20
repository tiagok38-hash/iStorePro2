import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient.ts';

export interface ChatMessage {
    id: string;
    sender_id: string;
    content: string;
    created_at: string;
    is_edited: boolean;
    edited_at: string | null;
    read_by: string[];
    conversation_id: string | null;
    sender_name?: string;
    sender_avatar?: string;
}

interface ChatContextData {
    isChatOpen: boolean;
    openChat: () => void;
    closeChat: () => void;
    toggleChat: () => void;
    messages: ChatMessage[];
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    unreadCount: number;
    loadMore: () => Promise<void>;
    refetchMessages: () => Promise<void>;
    setCurrentUserId: (id: string | null) => void;
    typingUsers: string[];
    sendTypingEvent: (userName: string) => void;
}

const ChatContext = createContext<ChatContextData | undefined>(undefined);

const PAGE_SIZE = 30;

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const oldestCreatedAtRef = useRef<string | null>(null);
    const lastOpenedRef = useRef<string | null>(null);
    const currentUserIdRef = useRef<string | null>(null);

    // Typing logic
    const [typingUsers, setTypingUsers] = useState<{ id: string, name: string }[]>([]);
    const typingTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});
    const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    // Init: recupera o último timestamp de abertura do chat
    useEffect(() => {
        lastOpenedRef.current = sessionStorage.getItem('chat_last_opened') || null;
    }, []);

    const setCurrentUserId = useCallback((id: string | null) => {
        currentUserIdRef.current = id;
    }, []);

    const openChat = useCallback(() => {
        setIsChatOpen(true);
        const now = new Date().toISOString();
        lastOpenedRef.current = now;
        sessionStorage.setItem('chat_last_opened', now);
        setUnreadCount(0);
    }, []);

    const closeChat = useCallback(() => {
        setIsChatOpen(false);
    }, []);

    const toggleChat = useCallback(() => {
        setIsChatOpen(prev => {
            if (!prev) {
                const now = new Date().toISOString();
                lastOpenedRef.current = now;
                sessionStorage.setItem('chat_last_opened', now);
                setUnreadCount(0);
            }
            return !prev;
        });
    }, []);

    // Recalcula unreadCount sempre que chegam novas mensagens
    const recalcUnread = useCallback((msgs: ChatMessage[]) => {
        if (isChatOpen) {
            setUnreadCount(0);
            return;
        }
        const lastOpened = lastOpenedRef.current;
        const currentUserId = currentUserIdRef.current;
        const count = msgs.filter(m => {
            if (m.sender_id === currentUserId) return false;
            if (!lastOpened) return true;
            return m.created_at > lastOpened;
        }).length;
        setUnreadCount(count);
    }, [isChatOpen]);

    // Fetch paginado
    const fetchMessages = useCallback(async (before?: string): Promise<ChatMessage[]> => {
        try {
            let query = supabase
                .from('chat_messages')
                .select('*')
                .is('conversation_id', null)
                .order('created_at', { ascending: false })
                .limit(PAGE_SIZE);

            if (before) {
                query = query.lt('created_at', before);
            }

            const { data, error } = await query;
            if (error) throw error;
            if (!data || data.length === 0) {
                setHasMore(false);
                return [];
            }

            const sorted = [...data].reverse() as ChatMessage[];
            if (sorted.length < PAGE_SIZE) setHasMore(false);
            return sorted;
        } catch (err) {
            console.error('ChatContext: Erro ao buscar mensagens:', err);
            return [];
        }
    }, []);

    // Carregamento inicial
    useEffect(() => {
        let mounted = true;
        fetchMessages().then(initialMessages => {
            if (!mounted) return;
            setMessages(initialMessages);
            if (initialMessages.length > 0) {
                oldestCreatedAtRef.current = initialMessages[0].created_at;
            }
            setLoading(false);
            recalcUnread(initialMessages);
        });
        return () => { mounted = false; };
    }, [fetchMessages]);

    // Recalcula quando o chat abre/fecha
    useEffect(() => {
        recalcUnread(messages);
    }, [isChatOpen, recalcUnread, messages]);

    // Setup de Broadcast (Typing Indicator)
    useEffect(() => {
        const channel = supabase.channel('chat_broadcast', {
            config: { broadcast: { self: false } }
        });

        channel.on('broadcast', { event: 'typing' }, (payload) => {
            const { user_id, user_name } = payload.payload;
            if (!user_id || !user_name || user_id === currentUserIdRef.current) return;

            setTypingUsers(prev => {
                if (!prev.some(u => u.id === user_id)) {
                    return [...prev, { id: user_id, name: user_name }];
                }
                return prev;
            });

            if (typingTimeouts.current[user_id]) {
                clearTimeout(typingTimeouts.current[user_id]);
            }

            typingTimeouts.current[user_id] = setTimeout(() => {
                setTypingUsers(prev => prev.filter(u => u.id !== user_id));
                delete typingTimeouts.current[user_id];
            }, 3000);
        }).subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                broadcastChannelRef.current = channel;
            }
        });

        return () => {
            channel.unsubscribe();
            Object.values(typingTimeouts.current).forEach(clearTimeout);
            broadcastChannelRef.current = null;
        };
    }, []);

    const sendTypingEvent = useCallback((userName: string) => {
        if (!broadcastChannelRef.current || !currentUserIdRef.current) return;
        broadcastChannelRef.current.send({
            type: 'broadcast',
            event: 'typing',
            payload: { user_id: currentUserIdRef.current, user_name: userName }
        });
    }, []);

    // Subscription Realtime — ÚNICO listener global para toda a app
    // NOTA: filtro 'conversation_id=is.null' NÃO é suportado pelo Supabase Realtime
    // Por isso escutamos todos os eventos da tabela e filtramos no cliente
    useEffect(() => {
        if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
        }

        const channel = supabase
            .channel('chat_global_ctx_v2')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
            }, (payload) => {
                const newMsg = payload.new as ChatMessage;
                // Filtrar no cliente: apenas mensagens do chat global (conversation_id === null)
                if (newMsg.conversation_id !== null) return;
                setMessages(prev => {
                    if (prev.some(m => m.id === newMsg.id)) return prev;
                    const updated = [...prev, newMsg];
                    recalcUnread(updated);
                    return updated;
                });
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'chat_messages',
            }, (payload) => {
                const updatedMsg = payload.new as ChatMessage;
                if (updatedMsg.conversation_id !== null) return;
                setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
            })
            .subscribe();

        subscriptionRef.current = channel;

        return () => {
            channel.unsubscribe();
            subscriptionRef.current = null;
        };
    }, [recalcUnread]);

    const refetchMessages = useCallback(async () => {
        const fresh = await fetchMessages();
        setMessages(fresh);
        if (fresh.length > 0) {
            oldestCreatedAtRef.current = fresh[0].created_at;
        }
        setHasMore(fresh.length >= PAGE_SIZE);
        recalcUnread(fresh);
    }, [fetchMessages, recalcUnread]);

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore || !oldestCreatedAtRef.current) return;
        setLoadingMore(true);
        const older = await fetchMessages(oldestCreatedAtRef.current);
        if (older.length > 0) {
            oldestCreatedAtRef.current = older[0].created_at;
            setMessages(prev => [...older, ...prev]);
        }
        setLoadingMore(false);
    }, [loadingMore, hasMore, fetchMessages]);

    return (
        <ChatContext.Provider value={{
            isChatOpen,
            openChat,
            closeChat,
            toggleChat,
            messages,
            loading,
            loadingMore,
            hasMore,
            unreadCount,
            loadMore,
            refetchMessages,
            setCurrentUserId,
            typingUsers: typingUsers.map(u => u.name),
            sendTypingEvent,
        }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => {
    const ctx = useContext(ChatContext);
    if (!ctx) throw new Error('useChat must be used within a ChatProvider');
    return ctx;
};

// ─── Hook auxiliar para envio de mensagens ─────────────────────────────────
export const useSendMessage = (senderId: string | null) => {
    const [sending, setSending] = useState(false);

    const sendMessage = useCallback(async (content: string): Promise<boolean> => {
        if (!senderId || !content.trim()) return false;
        setSending(true);
        try {
            const { error } = await supabase
                .from('chat_messages')
                .insert({ sender_id: senderId, content: content.trim(), conversation_id: null });
            if (error) throw error;
            return true;
        } catch (err: any) {
            console.error('Erro ao enviar:', err.message);
            return false;
        } finally {
            setSending(false);
        }
    }, [senderId]);

    const editMessage = useCallback(async (messageId: string, newContent: string): Promise<boolean> => {
        if (!senderId || !newContent.trim()) return false;
        setSending(true);
        try {
            const { error } = await supabase
                .from('chat_messages')
                .update({
                    content: newContent.trim(),
                    is_edited: true,
                    edited_at: new Date().toISOString(),
                })
                .eq('id', messageId)
                .eq('sender_id', senderId);
            if (error) throw error;
            return true;
        } catch (err: any) {
            console.error('Erro ao editar:', err.message);
            return false;
        } finally {
            setSending(false);
        }
    }, [senderId]);

    return { sending, sendMessage, editMessage };
};
