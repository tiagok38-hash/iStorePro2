/**
 * Utilitários de formatação reutilizáveis.
 * Centralizados aqui para evitar dependência circular com serviços pesados.
 */

/** Formata valor numérico para moeda BRL (R$) */
export const formatCurrency = (value: number | null | undefined, fallback: string = 'R$ 0,00'): string => {
    if (typeof value !== 'number' || isNaN(value)) {
        return fallback;
    }
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

/** Formata string de telefone brasileiro com máscara (XX) XXXXX-XXXX */
export const formatPhone = (value: string): string => {
    if (!value) return "";
    let v = value.replace(/\D/g, "");
    v = v.substring(0, 11);
    if (v.length <= 2) return `(${v}`;
    if (v.length <= 6) return `(${v.substring(0, 2)}) ${v.substring(2)}`;
    if (v.length <= 10) return `(${v.substring(0, 2)}) ${v.substring(2, 6)}-${v.substring(6)}`;
    return `(${v.substring(0, 2)}) ${v.substring(2, 7)}-${v.substring(7)}`;
};

/** Formata valor de armazenamento (GB para TB quando apropriado) */
export const formatStorageUnit = (storage: number | string | null | undefined): string => {
    if (storage === null || storage === undefined || storage === '') return '';
    const num = typeof storage === 'string' ? parseFloat(storage) : storage;
    if (isNaN(num)) return String(storage);
    if (num === 1000 || num === 1024) return '1TB';
    if (num === 2000 || num === 2048) return '2TB';
    return `${num}GB`;
};

/** Desduplica e ordena garantias por nome e duração */
export const deduplicateWarranties = (warranties: any[]): any[] => {
    if (!warranties || !Array.isArray(warranties)) return [];
    
    const unique = warranties.reduce((acc: any[], current) => {
        const normalizedCurrent = current.name?.trim().toLowerCase() || "";
        const currentDays = Number(current.days) || 0;
        
        const duplicateIndex = acc.findIndex(item => {
            const normalizedItem = item.name?.trim().toLowerCase() || "";
            const itemDays = Number(item.days) || 0;
            return normalizedItem === normalizedCurrent || (currentDays > 0 && itemDays === currentDays);
        });

        if (duplicateIndex === -1) {
            acc.push(current);
        } else if (current.name?.length > acc[duplicateIndex].name?.length) {
            acc[duplicateIndex] = current;
        }
        return acc;
    }, []);

    return unique.sort((a, b) => (Number(a.days) || 0) - (Number(b.days) || 0));
};

/** Remove UUIDs de uma string (comum em nomes de peças/insumos com erro de lookup) */
export const cleanUUIDs = (text: string | null | undefined): string => {
    if (!text) return "";
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    
    // Se a string for EXATAMENTE uma UUID, mantemos (provavelmente um ID sem resolução)
    // Caso contrário, limpamos apenas os UUIDs que "vazaram" no meio do texto
    const trimmed = text.trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
        return trimmed;
    }

    return text.replace(uuidRegex, '').trim().replace(/\s+/g, ' ');
};

/** Remove marcas duplicadas ou prefixos indesejados da descrição do aparelho */
export const cleanDeviceDescription = (text: string | null | undefined): string => {
    if (!text) return "";
    return text.replace(/^Apple\s+/i, '').trim();
};

/** Calcula o lucro de uma Ordem de Serviço */
export const calculateOSProfit = (os: any) => {
    if (!os) return 0;
    const items = os.items || [];
    const totalCost = items.reduce((acc: number, item: any) => {
        const cost = typeof item.cost === 'string' ? parseFloat(item.cost) : (item.cost || 0);
        return acc + (cost * (item.quantity || 1));
    }, 0);
    return (os.total || 0) - totalCost;
};
