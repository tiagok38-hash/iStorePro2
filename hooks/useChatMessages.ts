import { useState, useEffect, useCallback, useRef } from 'react';
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
  // Dados do remetente (join no frontend via cache)
  sender_name?: string;
  sender_avatar?: string;
}

const PAGE_SIZE = 30;

export const useChatMessages = (currentUserId: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const oldestCreatedAtRef = useRef<string | null>(null);

  // Busca mensagens paginadas (últimas 30 ou página anterior)
  const fetchMessages = useCallback(async (before?: string) => {
    try {
      let query = supabase
        .from('chat_messages')
        .select('*')
        .is('conversation_id', null) // Chat global - Fase 1
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        setHasMore(false);
        return [];
      }

      // Inverte para mostrar as mais antigas primeiro (ASC)
      const sorted = [...data].reverse() as ChatMessage[];

      if (sorted.length < PAGE_SIZE) {
        setHasMore(false);
      }

      return sorted;
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar mensagens');
      return [];
    }
  }, []);

  // Carregamento inicial
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setLoading(true);
      const initialMessages = await fetchMessages();
      if (!isMounted) return;

      setMessages(initialMessages);
      if (initialMessages.length > 0) {
        oldestCreatedAtRef.current = initialMessages[0].created_at;
      }
      setLoading(false);
    };

    init();

    return () => { isMounted = false; };
  }, [fetchMessages]);

  // Subscription Realtime (único listener)
  useEffect(() => {
    // Previne subscription duplicada
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    const channel = supabase
      .channel('chat_global_v1')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: 'conversation_id=is.null',
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages(prev => {
            // Evita duplicatas
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const updatedMsg = payload.new as ChatMessage;
          setMessages(prev =>
            prev.map(m => m.id === updatedMsg.id ? updatedMsg : m)
          );
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      channel.unsubscribe();
      subscriptionRef.current = null;
    };
  }, []);

  // Carregar mais mensagens (scroll para cima)
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

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
  };
};

// ── Hook: Enviar mensagem ──────────────────────────────────────
export const useSendMessage = (senderId: string | null) => {
  const [sending, setSending] = useState(false);

  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!senderId || !content.trim()) return false;

    setSending(true);
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          sender_id: senderId,
          content: content.trim(),
          conversation_id: null, // Chat global - Fase 1
        });

      if (error) throw error;
      return true;
    } catch (err: any) {
      console.error('Erro ao enviar mensagem:', err.message);
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
        .eq('sender_id', senderId); // RLS + frontend check

      if (error) throw error;
      return true;
    } catch (err: any) {
      console.error('Erro ao editar mensagem:', err.message);
      return false;
    } finally {
      setSending(false);
    }
  }, [senderId]);

  return { sending, sendMessage, editMessage };
};

// ── Hook: Contador de não lidas ────────────────────────────────
export const useUnreadCounter = (
  messages: ChatMessage[],
  currentUserId: string | null,
  isChatOpen: boolean
) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const lastOpenedRef = useRef<string | null>(
    () => sessionStorage.getItem('chat_last_opened') || null
  );

  useEffect(() => {
    if (isChatOpen) {
      const now = new Date().toISOString();
      lastOpenedRef.current = now;
      sessionStorage.setItem('chat_last_opened', now);
      setUnreadCount(0);
      return;
    }

    const lastOpened = lastOpenedRef.current;

    const count = messages.filter(m => {
      if (m.sender_id === currentUserId) return false; // Próprias mensagens não contam
      if (!lastOpened) return true; // Nunca abriu
      return m.created_at > lastOpened;
    }).length;

    setUnreadCount(count);
  }, [messages, currentUserId, isChatOpen]);

  return { unreadCount };
};
