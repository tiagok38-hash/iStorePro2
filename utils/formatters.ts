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
