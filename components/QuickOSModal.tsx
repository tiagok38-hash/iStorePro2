
import React, { useState } from 'react';
import { Zap, X } from 'lucide-react';
import { addServiceOrder, addCustomer } from '../services/mockApi';
import { useToast } from '../contexts/ToastContext';
import { useUser } from '../contexts/UserContext';

interface QuickOSModalProps {
    onClose: () => void;
    onSaved: () => void;
}

const QuickOSModal: React.FC<QuickOSModalProps> = ({ onClose, onSaved }) => {
    const { showToast } = useToast();
    const { user } = useUser();
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState({
        customerName: '',
        phone: '',
        deviceModel: '',
        passcode: '',
        observations: '',
    });
    const [isOrcamentoOnly, setIsOrcamentoOnly] = useState(false);
    const [patternLock, setPatternLock] = useState<number[]>([]);
    const [passType, setPassType] = useState<'alpha' | 'pattern'>('alpha');

    const handleSave = async () => {
        if (!form.customerName.trim()) { showToast('Informe o nome do cliente.', 'error'); return; }
        if (!form.deviceModel.trim()) { showToast('Informe o modelo do aparelho.', 'error'); return; }
        setIsSaving(true);
        try {
            const newCustomer = await addCustomer({
                name: form.customerName.trim(),
                phone: form.phone.trim(),
                customTag: 'OS Rápida'
            }, 'system', 'Sistema');

            await addServiceOrder({
                customerId: newCustomer.id,
                customerName: form.customerName.trim(),
                deviceModel: form.deviceModel.trim(),
                passcode: passType === 'alpha' ? form.passcode : '',
                patternLock: passType === 'pattern' ? patternLock : [],
                observations: form.observations,
                defectDescription: '',
                attendantObservations: '',
                technicalReport: '',
                status: 'Orçamento' as any,
                isOrcamentoOnly: isOrcamentoOnly,
                isQuick: true,
                items: [],
                subtotal: 0,
                discount: 0,
                total: 0,
                responsibleId: user?.id || '',
                responsibleName: user?.name || 'Sistema',
                attendantId: user?.id || '',
                attendantName: user?.name || 'Sistema',
                photos: [],
                checklist: {} as any,
                entryDate: new Date().toISOString(),
                phone: form.phone,
            } as any);
            showToast('OS Rápida criada com sucesso!', 'success');
            onSaved();
        } catch (e) {
            showToast('Erro ao criar OS Rápida.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const PatternGrid = () => (
        <div className="grid grid-cols-3 gap-3 w-36 mx-auto select-none mt-2">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(dot => {
                const idx = patternLock.indexOf(dot);
                const selected = idx !== -1;
                return (
                    <button
                        key={dot}
                        type="button"
                        onClick={() => setPatternLock(prev => selected ? prev.filter(p => p !== dot) : [...prev, dot])}
                        className={`w-9 h-9 rounded-full border-[3px] flex items-center justify-center font-bold text-xs transition-all ${selected ? 'bg-accent border-accent text-white scale-110 shadow-md' : 'bg-white border-gray-300 hover:border-accent/50 text-transparent'
                            }`}
                    >
                        {selected ? idx + 1 : ''}
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md animate-fade-in-up">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                            <Zap size={18} className="text-amber-500 fill-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-gray-900">OS Rápida</h2>
                            <p className="text-xs text-gray-400">Entrada express de aparelho</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-400">
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Cliente*</label>
                            <input
                                autoFocus
                                type="text"
                                placeholder="Ex: João Silva"
                                value={form.customerName}
                                onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">WhatsApp</label>
                            <input
                                type="tel"
                                placeholder="(11) 9 9999-9999"
                                value={form.phone}
                                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Modelo do Aparelho*</label>
                        <input
                            type="text"
                            placeholder="Ex: iPhone 13, Samsung A54..."
                            value={form.deviceModel}
                            onChange={e => setForm(f => ({ ...f, deviceModel: e.target.value }))}
                            className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                        />
                    </div>

                    {/* Password field */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Senha / Padrão</label>
                            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-[10px] font-bold">
                                <button type="button" onClick={() => setPassType('alpha')} className={`px-2.5 py-1 rounded-md transition-all ${passType === 'alpha' ? 'bg-white text-accent shadow-sm' : 'text-gray-400'}`}>Alfanum.</button>
                                <button type="button" onClick={() => setPassType('pattern')} className={`px-2.5 py-1 rounded-md transition-all ${passType === 'pattern' ? 'bg-white text-accent shadow-sm' : 'text-gray-400'}`}>Desenho</button>
                            </div>
                        </div>
                        {passType === 'alpha' ? (
                            <input
                                type="text"
                                placeholder="Senha alfanumérica..."
                                value={form.passcode}
                                onChange={e => setForm(f => ({ ...f, passcode: e.target.value }))}
                                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                            />
                        ) : (
                            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                                <PatternGrid />
                                {patternLock.length > 0 && (
                                    <div className="flex items-center justify-center gap-1 mt-3">
                                        <p className="text-xs text-gray-500 font-medium">
                                            Sequência: {patternLock.map(d => d + 1).join(' → ')}
                                        </p>
                                        <button type="button" onClick={() => setPatternLock([])} className="text-[10px] text-red-400 hover:text-red-600 ml-2">Limpar</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Observações</label>
                        <textarea
                            rows={3}
                            placeholder="Defeito relatado, detalhes importantes..."
                            value={form.observations}
                            onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all resize-none"
                        />
                    </div>

                    {/* Toggle Orçamento */}
                    <div className={`h-10 flex items-center justify-between px-3 rounded-xl border transition-all ${isOrcamentoOnly ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
                        <span className={`text-xs font-bold ${isOrcamentoOnly ? 'text-amber-600' : 'text-gray-500'}`}>Obrigatório fazer Orçamento?</span>
                        <button
                            type="button"
                            onClick={() => setIsOrcamentoOnly(!isOrcamentoOnly)}
                            className={`relative w-10 h-5 rounded-full transition-all duration-300 flex-shrink-0 ${isOrcamentoOnly ? 'bg-amber-500 shadow-sm' : 'bg-gray-300'}`}
                        >
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${isOrcamentoOnly ? 'left-[22px]' : 'left-0.5'}`} />
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-5 pt-0">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-50"
                    >
                        <Zap size={15} className="fill-white" />
                        {isSaving ? 'Salvando...' : 'Salvar OS Rápida'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuickOSModal;
