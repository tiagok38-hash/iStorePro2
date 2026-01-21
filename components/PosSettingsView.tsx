
import React, { useState } from 'react';
import { Customer, ReceiptTermParameter } from '../types';
import { useToast } from '../contexts/ToastContext';
import { Cog6ToothIcon, DocumentTextIcon, PrinterIcon, CheckIcon } from '../components/icons';
import SearchableDropdown from './SearchableDropdown';

interface PosSettingsViewProps {
    customers: Customer[];
    receiptTerms: ReceiptTermParameter[];
    onUpdateReceiptFormat: (fmt: 'A4' | 'thermal') => void;
}

export const PosSettingsView: React.FC<PosSettingsViewProps> = ({ customers, receiptTerms, onUpdateReceiptFormat }) => {
    const { showToast } = useToast();
    const [defCust, setDefCust] = useState(localStorage.getItem('pos_default_customer_id') || '');
    const [defWar, setDefWar] = useState(localStorage.getItem('pos_default_warranty_term') || '');
    const [defFmt, setDefFmt] = useState<'A4' | 'thermal' | null>((localStorage.getItem('pos_default_receipt_format') as 'A4' | 'thermal') || null);

    const handleSave = () => {
        if (defCust) localStorage.setItem('pos_default_customer_id', defCust);
        else localStorage.removeItem('pos_default_customer_id');

        if (defWar) localStorage.setItem('pos_default_warranty_term', defWar);
        else localStorage.removeItem('pos_default_warranty_term');

        if (defFmt) {
            localStorage.setItem('pos_default_receipt_format', defFmt);
            onUpdateReceiptFormat(defFmt);
        } else {
            localStorage.removeItem('pos_default_receipt_format');
        }

        showToast('Configurações salvas com sucesso!', 'success');
    };

    return (
        <div className="max-w-2xl mx-auto space-y-4 md:space-y-6 animate-fade-in p-2 md:p-4">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight border-b pb-2 md:pb-4 mb-2 md:mb-4">Configurações do PDV</h2>

            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 space-y-4 md:space-y-6">
                <div className="flex items-center gap-2 md:gap-3 pb-3 md:pb-4 border-b border-gray-100">
                    <div className="p-1.5 bg-primary/10 rounded-lg shrink-0">
                        <Cog6ToothIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm md:text-base font-bold text-gray-800">Preferências de Venda</h3>
                        <p className="text-[10px] md:text-xs text-muted">Personalize o comportamento padrão do seu caixa</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-1">
                        <label className="block text-[10px] md:text-[11px] font-black text-gray-600 uppercase tracking-wider ml-1">Cliente Padrão</label>
                        <SearchableDropdown
                            options={customers.map(c => ({ value: c.id, label: c.name }))}
                            value={defCust}
                            onChange={(val) => setDefCust(val)}
                            placeholder="Buscar cliente..."
                        />
                        <p className="text-[9px] text-muted italic ml-1">Cliente pré-selecionado ao iniciar venda.</p>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-[10px] md:text-[11px] font-black text-gray-600 uppercase tracking-wider ml-1">Garantia Padrão</label>
                        <select
                            className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold text-xs text-gray-700 h-9"
                            value={defWar}
                            onChange={(e) => setDefWar(e.target.value)}
                        >
                            <option value="">-- Padrão do Sistema --</option>
                            {receiptTerms.map(t => (
                                <option key={t.id} value={t.name}>{t.name}</option>
                            ))}
                        </select>
                        <p className="text-[9px] text-muted italic ml-1">Termo aplicado automaticamente.</p>
                    </div>

                    <div className="md:col-span-2 space-y-2">
                        <label className="block text-[10px] md:text-[11px] font-black text-gray-600 uppercase tracking-wider ml-1">Impressão Padrão</label>
                        <p className="text-[9px] md:text-[10px] text-muted italic ml-1">Formato automático ou perguntar a cada venda.</p>
                        <div className="grid grid-cols-2 gap-2 md:gap-4">
                            <button
                                className={`p-2.5 md:p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 md:gap-3 ${defFmt === 'A4' ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-gray-200 hover:bg-gray-50 text-gray-500'}`}
                                onClick={() => setDefFmt(defFmt === 'A4' ? null : 'A4')}
                            >
                                <DocumentTextIcon className="h-5 w-5 md:h-8 md:w-8" />
                                <span className="text-[10px] md:text-xs font-black uppercase tracking-tight">Folha A4</span>
                            </button>
                            <button
                                className={`p-2.5 md:p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 md:gap-3 ${defFmt === 'thermal' ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-gray-200 hover:bg-gray-50 text-gray-500'}`}
                                onClick={() => setDefFmt(defFmt === 'thermal' ? null : 'thermal')}
                            >
                                <PrinterIcon className="h-5 w-5 md:h-8 md:w-8" />
                                <span className="text-[10px] md:text-xs font-black uppercase tracking-tight">Térmica 80mm</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="w-full md:w-auto px-6 h-10 bg-success text-white rounded-lg font-black text-xs shadow-lg shadow-success/20 hover:bg-success/90 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                    >
                        <CheckIcon className="h-4 w-4" />
                        Salvar Configurações
                    </button>
                </div>
            </div>
        </div>
    );
};
