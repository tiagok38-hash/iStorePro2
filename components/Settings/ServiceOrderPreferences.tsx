import React, { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { Cog6ToothIcon, DocumentTextIcon, PrinterIcon, CheckIcon } from '../icons';
import { User, ReceiptTermParameter } from '../../types';
import { getUsers, getPermissionProfiles as getProfiles } from '../../services/mockApi';
import { getOsReceiptTerms } from '../../services/parametersService';

export const ServiceOrderPreferences: React.FC = () => {
    const { showToast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [warranties, setWarranties] = useState<any[]>([]);
    
    const [defTech, setDefTech] = useState(localStorage.getItem('os_default_technician_id') || '');
    const [defWar, setDefWar] = useState(localStorage.getItem('os_default_warranty_term') || '');
    const [defFmt, setDefFmt] = useState<'A4' | 'thermal' | null>((localStorage.getItem('os_default_receipt_format') as 'A4' | 'thermal') || null);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [u, p, w] = await Promise.all([
                    getUsers(),
                    getProfiles(),
                    getOsReceiptTerms()
                ]);
                setUsers(u);
                setProfiles(p);
                setWarranties(w);
            } catch (err) {
                console.error("Erro ao carregar dados.", err);
            }
        };
        loadInitialData();
    }, []);

    const handleSave = () => {
        if (defTech) localStorage.setItem('os_default_technician_id', defTech);
        else localStorage.removeItem('os_default_technician_id');

        if (defWar) localStorage.setItem('os_default_warranty_term', defWar);
        else localStorage.removeItem('os_default_warranty_term');

        if (defFmt) {
            localStorage.setItem('os_default_receipt_format', defFmt);
        } else {
            localStorage.removeItem('os_default_receipt_format');
        }

        showToast('Configurações salvas com sucesso!', 'success');
    };

    const techUsers = users.filter(u => {
        const profile = profiles.find(p => p.id === u.permissionProfileId);
        return (u.active !== false && profile?.permissions?.isTechnicianProfile) || u.id === defTech;
    });

    return (
        <div className="max-w-2xl mx-auto space-y-4 md:space-y-6 animate-fade-in py-2">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight border-b pb-2 md:pb-4 mb-2 md:mb-4">Preferências de OS</h2>

            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 space-y-4 md:space-y-6">
                <div className="flex items-center gap-2 md:gap-3 pb-3 md:pb-4 border-b border-gray-100">
                    <div className="p-1.5 bg-primary/10 rounded-lg shrink-0">
                        <Cog6ToothIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm md:text-base font-bold text-gray-800">Comportamento Padrão</h3>
                        <p className="text-[10px] md:text-xs text-muted">Personalize o preenchimento automático das novas Ordens de Serviço</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">Técnico Padrão</label>
                        <select
                            className="w-full px-4 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold text-sm text-gray-700 h-11 appearance-none shadow-sm"
                            value={defTech}
                            onChange={(e) => setDefTech(e.target.value)}
                        >
                            <option value="">-- Selecione o Técnico --</option>
                            {techUsers.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-muted font-medium">Responsável pré-selecionado ao abrir nova OS.</p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">Garantia Padrão</label>
                        <select
                            className="w-full px-4 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold text-sm text-gray-700 h-11 appearance-none shadow-sm"
                            value={defWar}
                            onChange={(e) => setDefWar(e.target.value)}
                        >
                            <option value="">-- Sem Termo Padrão --</option>
                            {warranties.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-muted font-medium">Termo aplicado automaticamente na via de saída.</p>
                    </div>

                    <div className="md:col-span-2 space-y-3 pt-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">Impressão Padrão</label>
                            <p className="text-[10px] text-muted font-medium mb-3">Formato automático ou perguntar a cada OS.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 relative overflow-hidden group ${defFmt === 'A4' ? 'border-primary bg-primary/5 text-primary shadow-md ring-1 ring-primary/20' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600'}`}
                                onClick={() => setDefFmt(defFmt === 'A4' ? null : 'A4')}
                            >
                                {defFmt === 'A4' && <div className="absolute top-2 right-2 text-primary"><CheckIcon className="w-4 h-4" /></div>}
                                <DocumentTextIcon className={`h-8 w-8 transition-transform group-hover:scale-110 ${defFmt === 'A4' ? 'text-primary' : 'text-gray-400'}`} />
                                <span className="text-xs font-bold uppercase tracking-wider">Folha A4</span>
                            </button>
                            <button
                                className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 relative overflow-hidden group ${defFmt === 'thermal' ? 'border-primary bg-primary/5 text-primary shadow-md ring-1 ring-primary/20' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600'}`}
                                onClick={() => setDefFmt(defFmt === 'thermal' ? null : 'thermal')}
                            >
                                {defFmt === 'thermal' && <div className="absolute top-2 right-2 text-primary"><CheckIcon className="w-4 h-4" /></div>}
                                <PrinterIcon className={`h-8 w-8 transition-transform group-hover:scale-110 ${defFmt === 'thermal' ? 'text-primary' : 'text-gray-400'}`} />
                                <span className="text-xs font-bold uppercase tracking-wider">Térmica 80mm</span>
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

export default ServiceOrderPreferences;
