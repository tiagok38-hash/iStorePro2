// Utilidades de data e hora para garantir sincronização com horário de Brasília (UTC-3)

const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

/**
 * Retorna a data/hora atual no fuso horário de Brasília
 */
export const getNow = (): Date => {
    return new Date();
};

/**
 * Retorna a data/hora atual como string ISO no fuso horário de Brasília
 * Formato: YYYY-MM-DDTHH:mm:ss.sssZ
 */
export const getNowISO = (): string => {
    return new Date().toISOString();
};

/**
 * Retorna a data de hoje (meia-noite) no fuso horário de Brasília
 */
export const getTodayStart = (): Date => {
    const now = new Date();
    const brazilTime = new Date(now.toLocaleString('en-US', { timeZone: BRAZIL_TIMEZONE }));
    brazilTime.setHours(0, 0, 0, 0);
    return brazilTime;
};

/**
 * Retorna a data de hoje no formato YYYY-MM-DD
 */
export const getTodayDateString = (): string => {
    const now = new Date();
    return now.toLocaleDateString('en-CA', { timeZone: BRAZIL_TIMEZONE }); // en-CA gives YYYY-MM-DD format
};

/**
 * Formata uma data para exibição no padrão brasileiro
 * @param date - Data a ser formatada (string ISO ou Date)
 * @param options - Opções de formatação
 */
export const formatDateBR = (
    date: string | Date,
    options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }
): string => {
    if (!date) return '';
    let d: Date;
    if (typeof date === 'string') {
        // Se for apenas data (YYYY-MM-DD), força 12:00 para evitar que o fuso horário mude o dia
        if (date.length === 10 && date.includes('-')) {
            d = new Date(`${date}T12:00:00`);
        } else {
            d = new Date(date);
        }
    } else {
        d = date;
    }

    // Se a data for inválida, retorna string vazia ou original
    if (isNaN(d.getTime())) return typeof date === 'string' ? date : '';

    return d.toLocaleDateString('pt-BR', { ...options, timeZone: BRAZIL_TIMEZONE });
};

/**
 * Formata uma hora para exibição no padrão brasileiro
 * @param date - Data/hora a ser formatada (string ISO ou Date)
 * @param showSeconds - Se deve mostrar segundos
 */
export const formatTimeBR = (
    date: string | Date,
    showSeconds: boolean = false
): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: BRAZIL_TIMEZONE
    };
    if (showSeconds) {
        options.second = '2-digit';
    }
    return d.toLocaleTimeString('pt-BR', options);
};

/**
 * Formata data e hora completa para exibição
 * @param date - Data/hora a ser formatada
 */
export const formatDateTimeBR = (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: BRAZIL_TIMEZONE
    });
};

/**
 * Formata data relativa (Hoje, Ontem, ou data completa)
 * @param date - Data a ser formatada
 */
export const formatRelativeDate = (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateStr = d.toLocaleDateString('pt-BR', { timeZone: BRAZIL_TIMEZONE });
    const todayStr = today.toLocaleDateString('pt-BR', { timeZone: BRAZIL_TIMEZONE });
    const yesterdayStr = yesterday.toLocaleDateString('pt-BR', { timeZone: BRAZIL_TIMEZONE });

    if (dateStr === todayStr) return 'Hoje';
    if (dateStr === yesterdayStr) return 'Ontem';

    return d.toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: BRAZIL_TIMEZONE
    });
};

/**
 * Converte uma data para o início do dia (00:00:00) no fuso local
 */
export const startOfDay = (date: Date | string): Date => {
    if (typeof date === 'string' && date.includes('-') && date.length === 10) {
        const [y, m, d] = date.split('-').map(Number);
        return new Date(y, m - 1, d, 0, 0, 0, 0);
    }
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

/**
 * Converte uma data para o final do dia (23:59:59) no fuso local
 */
export const endOfDay = (date: Date | string): Date => {
    if (typeof date === 'string' && date.includes('-') && date.length === 10) {
        const [y, m, d] = date.split('-').map(Number);
        return new Date(y, m - 1, d, 23, 59, 59, 999);
    }
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};

/**
 * Verifica se uma data está dentro de um período
 */
export const isDateInRange = (date: Date | string, start: Date, end: Date): boolean => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d >= start && d <= end;
};

/**
 * Retorna a data/hora formatada para input datetime-local
 */
export const toDateTimeLocalValue = (date?: Date | string): string => {
    const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
    if (isNaN(d.getTime())) return '';
    
    // Force Brasilia timezone parts to bypass incorrect machine local time
    const formatter = new Intl.DateTimeFormat('en-CA', { // en-CA gives YYYY-MM-DD
        timeZone: BRAZIL_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    
    // Format is like "2026-03-14, 15:30" depending on locale, safer to use formatToParts
    const parts = formatter.formatToParts(d);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
    
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour') === '24' ? '00' : getPart('hour')}:${getPart('minute')}`;
};

/**
 * Retorna a data formatada para input date (YYYY-MM-DD) no timezone especificado
 */
export const toLocalDateString = (date?: Date | string | null, timeZone: string = BRAZIL_TIMEZONE): string => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-CA', { timeZone });
};

/**
 * Retorna a data formatada para input date (compatibilidade retroativa)
 */
export const toDateValue = (date?: Date | string, timeZone: string = BRAZIL_TIMEZONE): string => {
    if (!date) {
        return new Date().toLocaleDateString('en-CA', { timeZone });
    }
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-CA', { timeZone });
};

/**
 * Converte data local (YYYY-MM-DD) e hora local (HH:mm:ss) no timezone especificado
 * para string ISO UTC exata (YYYY-MM-DDTHH:mm:ss.sssZ).
 * Garante que a conversão independa das configurações de fuso da máquina do cliente.
 */
export const parseLocalDateToUTC = (
    dateStr: string,
    timeStr: string = '12:00:00',
    timeZone: string = BRAZIL_TIMEZONE
): string => {
    if (!dateStr) return new Date().toISOString();
    const [y, m, d] = dateStr.split('-').map(Number);
    const [h, min, s] = (timeStr || '12:00:00').split(':').map(Number);

    const utcGuess = new Date(Date.UTC(y, m - 1, d, h || 0, min || 0, s || 0));

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
    });

    const parts = formatter.formatToParts(utcGuess);
    const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);

    const tzYear = getPart('year');
    const tzMonth = getPart('month');
    const tzDay = getPart('day');
    let tzHour = getPart('hour');
    if (tzHour === 24) tzHour = 0;
    const tzMin = getPart('minute');
    const tzSec = getPart('second');

    const tzAsUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMin, tzSec);
    const offsetMs = tzAsUtc - utcGuess.getTime();

    const correctUtcMs = utcGuess.getTime() - offsetMs;
    return new Date(correctUtcMs).toISOString();
};

/**
 * Constrói o timestamp ideal para salvar a venda em padrão SaaS Premium:
 * - Edição de venda existente:
 *   Se a data não foi modificada pelo usuário, mantém estritamente o timestamp original da venda.
 *   Se o usuário alterou a data no seletor, preserva o horário da venda original no novo dia selecionado.
 * - Nova venda hoje:
 *   Retorna o instante atual em tempo real (ISO UTC).
 * - Nova venda retroativa:
 *   Combina a data escolhida com o horário local atual no timezone oficial.
 */
export const buildSaleDateTimestamp = (params: {
    selectedDate: string;
    originalDate?: string | null;
    isEdit?: boolean;
    timeZone?: string;
}): string => {
    const { selectedDate, originalDate, isEdit = false, timeZone = BRAZIL_TIMEZONE } = params;
    const todayStr = getTodayDateString();

    if (isEdit && originalDate) {
        const originalLocalDate = toLocalDateString(originalDate, timeZone);
        // Se a data selecionada for idêntica à data local original da venda, preserva o timestamp original
        if (selectedDate === originalLocalDate) {
            return originalDate;
        }
        // Se o usuário mudou a data, transfere o horário original da venda para o novo dia
        const origDateObj = new Date(originalDate);
        const timeParts = origDateObj.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone,
            hour12: false
        });
        return parseLocalDateToUTC(selectedDate, timeParts, timeZone);
    }

    // Se nova venda realizada na data de hoje
    if (selectedDate === todayStr) {
        return new Date().toISOString();
    }

    // Se nova venda retroativa
    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone,
        hour12: false
    });
    return parseLocalDateToUTC(selectedDate, currentTimeStr, timeZone);
};

export const calculateWarrantyExpiry = (startDate: string | Date, warranty: string): Date | null => {
    if (!startDate || !warranty) return null;
    let date: Date;

    // Tratamento uniforme para string de data curta (YYYY-MM-DD)
    if (typeof startDate === 'string') {
        if (startDate.length === 10 && startDate.includes('-')) {
            // Força UTC para não pular dia caso o timezone local seja GMT-3 e bata 21h
            const [y, m, d] = startDate.split('-').map(Number);
            date = new Date(y, m - 1, d, 12, 0, 0); // safe mid-day
        } else {
            date = new Date(startDate);
        }
    } else {
        date = new Date(startDate.getTime());
    }

    if (isNaN(date.getTime())) return null;

    // Tenta encontrar o primeiro par [número] [unidade]
    const exactMatch = warranty.match(/(\d+)\s*(ano|mês|mes|dia)/i);
    
    let value: number;
    let unit: string;

    if (exactMatch) {
       value = parseInt(exactMatch[1], 10);
       unit = exactMatch[2].toLowerCase();
    } else {
        // Fallback: busca apenas o primeiro número e tenta adivinhar a unidade pela string toda
        const numMatch = warranty.match(/\d+/);
        if (!numMatch) return null;
        value = parseInt(numMatch[0], 10);
        unit = warranty.toLowerCase();
    }

    const originalDay = date.getDate();

    if (unit.includes('ano')) {
        date.setFullYear(date.getFullYear() + value);
        // Corrige overflow (ex: 29 de Fev + 1 ano -> 1 de Mar => volta pra 28 de Fev)
        if (date.getDate() !== originalDay) {
            date.setDate(0); 
        }
    } else if (unit.includes('mês') || unit.includes('mes')) {
        date.setMonth(date.getMonth() + value);
        // Corrige overflow de mês (ex: 31 de Jan + 1 mês -> Março 3 => volta pra Fev 28/29)
        if (date.getDate() !== originalDay) {
            date.setDate(0);
        }
    } else {
        // Padrão: dias
        date.setDate(date.getDate() + value);
    }
    
    return date;
};

export const getRemainingDays = (expiryDate: Date | string): number => {
    const now = new Date();
    const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : new Date(expiryDate.getTime());
    
    // Set expiry to end of day (23:59:59.999) in local time
    expiry.setHours(23, 59, 59, 999);
    
    const diffTime = expiry.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export type WarrantyStatus = 'active' | 'expiring_soon' | 'expired';

export const getWarrantyStatus = (expiryDate: Date | string): WarrantyStatus => {
  const now = new Date();

  const expiryEndOfDay = typeof expiryDate === 'string' ? new Date(expiryDate) : new Date(expiryDate.getTime());
  expiryEndOfDay.setHours(23, 59, 59, 999);

  if (now > expiryEndOfDay) return 'expired';

  const daysUntilExpiry = Math.ceil(
    (expiryEndOfDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiry <= 30) return 'expiring_soon';
  return 'active';
};
export const TIMEZONE = BRAZIL_TIMEZONE;
