import React, { useState, useEffect } from 'react';
import { XCircleIcon, CheckIcon, Settings as SettingsIcon } from 'lucide-react';
import { CreditSettings } from '../../types.ts';
import { getCreditSettings, updateCreditSettings } from '../../services/mockApi.ts';

interface CreditSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreditSettingsModal: React.FC<CreditSettingsModalProps> = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState<CreditSettings>({
        id: '',
        defaultInterestRate: 0,
        lateFeePercentage: 0
    });

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const data = await getCreditSettings();
            setSettings(data);
        } catch (error) {
            console.error('Error loading credit settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await updateCreditSettings(settings);
            onClose();
        } catch (error) {
            console.error('Error saving credit settings:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden border border-white/20 animate-scale-up">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-100 text-violet-600 rounded-lg">
                            <SettingsIcon size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900 leading-tight">Configurações de Crediário</h3>
                            <p className="text-xs text-muted font-bold uppercase tracking-wider mt-1">Defina taxas padrão</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                        <XCircleIcon size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {loading && <div className="text-center py-4 text-violet-600 font-bold">Carregando...</div>}

                    {!loading && (
                        <>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Taxa de Juros Mensal (%)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={settings.defaultInterestRate}
                                        onChange={(e) => setSettings({ ...settings, defaultInterestRate: parseFloat(e.target.value) || 0 })}
                                        className="w-full h-12 pl-4 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-lg font-bold text-gray-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Aplicado mensalmente sobre o saldo devedor.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Multa por Atraso (%)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={settings.lateFeePercentage}
                                        onChange={(e) => setSettings({ ...settings, lateFeePercentage: parseFloat(e.target.value) || 0 })}
                                        className="w-full h-12 pl-4 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-lg font-bold text-gray-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Cobrada única vez sobre o valor da parcela em atraso.</p>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-violet-200 hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <CheckIcon size={18} />
                        {loading ? 'Salvando...' : 'Salvar Configurações'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default CreditSettingsModal;
