import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';
import { ProductConditionParameter, StorageLocationParameter, WarrantyParameter, ReceiptTermParameter, ChecklistItemParameter, PermissionSet } from '../../types';
import {
    getOsProductConditions, addOsProductCondition, updateOsProductCondition, deleteOsProductCondition,
    getOsStorageLocations, addOsStorageLocation, updateOsStorageLocation, deleteOsStorageLocation,
    getOsWarranties, addOsWarranty, updateOsWarranty, deleteOsWarranty,
    getOsReceiptTerms, addOsReceiptTerm, updateOsReceiptTerm, deleteOsReceiptTerm,
    getChecklistItems, addChecklistItem, updateChecklistItem, deleteChecklistItem
} from '../../services/mockApi';
import {
    getOsTypes, addOsType, updateOsType, deleteOsType
} from '../../services/parametersService';
import Button from '../Button';
import { PlusIcon, EditIcon, TrashIcon } from '../icons';
import ReceiptTermModal from '../ReceiptTermModal';
import ConfirmationModal from '../ConfirmationModal';


// --- Types ---
interface ParameterManagerProps<T extends { id: string; name: string;[key: string]: any }> {
    permissions: PermissionSet | null;
    title: string;
    items: T[];
    fields: { name: keyof T; label: string; type: 'text' | 'number' }[];
    api: {
        add: (data: Omit<T, 'id'>, userId?: string, userName?: string) => Promise<T>;
        update: (data: T, userId?: string, userName?: string) => Promise<T>;
        del: (id: string, userId?: string, userName?: string) => Promise<void>;
    };
    fetchData: () => void;
}

// --- ItemModal Component (Defined outside to prevent state loss) ---
const ItemModal = <T extends { id: string; name: string;[key: string]: any }>({
    item,
    fields,
    onSave,
    onClose,
    isSaving
}: {
    item: Partial<T> | null,
    fields: { name: keyof T; label: string; type: 'text' | 'number' }[],
    onSave: (data: Partial<T>) => void,
    onClose: () => void,
    isSaving: boolean
}) => {
    const [formData, setFormData] = useState(item || {});

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-md border border-gray-100 animate-in fade-in zoom-in duration-200">
                <h3 className="font-black text-2xl mb-6 text-gray-900 tracking-tight">
                    {item?.id ? 'Editar' : 'Novo'} Item
                </h3>
                <div className="space-y-5">
                    {fields.map(field => (
                        <div key={String(field.name)}>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">
                                {field.label}
                            </label>
                            <input
                                type={field.type}
                                name={String(field.name)}
                                value={(formData as any)[field.name] ?? ''}
                                onChange={handleChange}
                                className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all outline-none text-gray-900 font-medium placeholder:text-gray-300"
                                required
                                autoFocus
                            />
                        </div>
                    ))}
                </div>
                <div className="flex gap-3 mt-8">
                    <Button type="button" onClick={onClose} variant="secondary" className="flex-1 h-14 rounded-2xl font-black text-sm uppercase tracking-widest">
                        Cancelar
                    </Button>
                    <Button type="submit" variant="success" loading={isSaving} className="flex-1 h-14 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-green-500/20">
                        Salvar
                    </Button>
                </div>
            </form>
        </div>
    );
};

// --- ParameterManager Component ---
const ParameterManager = <T extends { id: string; name: string;[key: string]: any }>({
    permissions,
    title,
    items,
    fields,
    api,
    fetchData,
}: ParameterManagerProps<T>) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<T> | null>(null);
    const [deletingItem, setDeletingItem] = useState<T | null>(null);
    const { showToast } = useToast();
    const { user } = useUser();

    const handleOpenModal = (item: Partial<T> | null = null) => {
        setEditingItem(item || {});
        setModalOpen(true);
    };

    const [saving, setSaving] = useState(false);

    const handleSave = async (itemData: Partial<T>) => {
        setSaving(true);
        try {
            if ('id' in itemData && itemData.id) {
                await api.update(itemData as T, user?.id, user?.name);
                showToast('Item atualizado com sucesso!', 'success');
            } else {
                await api.add(itemData as Omit<T, 'id'>, user?.id, user?.name);
                showToast('Item adicionado com sucesso!', 'success');
            }
            fetchData();
            setModalOpen(false);
            setEditingItem(null);
        } catch (error) {
            showToast('Erro ao salvar item.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingItem) return;
        try {
            await api.del(deletingItem.id, user?.id, user?.name);
            showToast('Item excluído com sucesso!', 'success');
            fetchData();
            setDeletingItem(null);
        } catch (error) {
            showToast('Erro ao excluir item.', 'error');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
                <div>
                    <h4 className="text-xl font-black text-gray-900 tracking-tight">{title}</h4>
                    <p className="text-sm text-gray-500 font-medium">Gerencie as opções disponíveis no sistema</p>
                </div>
                {permissions?.canManageParameters && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="w-12 h-12 flex items-center justify-center bg-primary text-white rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
                    >
                        <PlusIcon className="h-6 w-6" />
                    </button>
                )}
            </div>

            <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50/50">
                                {fields.map(field => (
                                    <th key={String(field.name)} className="px-5 py-3 font-black uppercase tracking-widest text-[10px] text-gray-400 text-left">{field.label}</th>
                                ))}
                                <th className="px-5 py-3 font-black uppercase tracking-widest text-[10px] text-gray-400 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {items.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50/30 transition-colors">
                                    {fields.map(field => (
                                        <td key={String(field.name)} className="px-5 py-2 font-semibold text-gray-700 text-sm">{(item as any)[field.name]}</td>
                                    ))}
                                    <td className="px-5 py-2 text-right">
                                        <div className="flex justify-end items-center gap-1">
                                            {permissions?.canManageParameters && (
                                                <>
                                                    <button
                                                        onClick={() => handleOpenModal(item)}
                                                        className="p-1.5 hover:bg-primary/10 rounded-lg transition-all group"
                                                    >
                                                        <EditIcon className="h-4 w-4 text-gray-400 group-hover:text-primary" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeletingItem(item)}
                                                        className="p-1.5 hover:bg-red-50 rounded-lg transition-all group"
                                                    >
                                                        <TrashIcon className="h-4 w-4 text-gray-400 group-hover:text-red-500" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {items.length === 0 && (
                                <tr>
                                    <td colSpan={fields.length + 1} className="px-5 py-10 text-center text-gray-400 font-medium text-sm">
                                        Nenhum item cadastrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {modalOpen && <ItemModal item={editingItem} fields={fields} onSave={handleSave} onClose={() => { setModalOpen(false); setEditingItem(null); }} isSaving={saving} />}
            <ConfirmationModal isOpen={!!deletingItem} onClose={() => setDeletingItem(null)} onConfirm={handleDelete} title={`Excluir ${deletingItem?.name}`} message="Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita." />
        </div>
    );
};

// --- Main ParameterSettings Component ---
const ParameterSettings: React.FC = () => {
    const [activeSubTab, setActiveSubTab] = useState('tipos_os');
    const [conditions, setConditions] = useState<ProductConditionParameter[]>([]);
    const [locations, setLocations] = useState<StorageLocationParameter[]>([]);
    const [warranties, setWarranties] = useState<WarrantyParameter[]>([]);
    const [receiptTerms, setReceiptTerms] = useState<ReceiptTermParameter[]>([]);
    const [checklistItems, setChecklistItems] = useState<ChecklistItemParameter[]>([]);
    const [osTypes, setOsTypes] = useState<{id: string, name: string}[]>([]);
    const [isTermModalOpen, setIsTermModalOpen] = useState(false);
    const [editingTerm, setEditingTerm] = useState<Partial<ReceiptTermParameter> | null>(null);
    const [deletingTerm, setDeletingTerm] = useState<ReceiptTermParameter | null>(null);
    const { showToast } = useToast();
    const { permissions, user } = useUser();

    const fetchData = useCallback(async () => {
        try {
            const [c, l, w, t, ch, ot] = await Promise.all([
                getOsProductConditions(),
                getOsStorageLocations(),
                getOsWarranties(),
                getOsReceiptTerms(),
                getChecklistItems(),
                getOsTypes()
            ]);
            setConditions(c); setLocations(l); setWarranties(w); setReceiptTerms(t); setChecklistItems(ch); setOsTypes(ot);
        } catch (error) {
            console.error('Failed to fetch parameter settings:', error);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleOpenTermModal = (item: Partial<ReceiptTermParameter> | null = null) => {
        setEditingTerm(item || {});
        setIsTermModalOpen(true);
    };

    const [savingTerm, setSavingTerm] = useState(false);

    const handleSaveTerm = async (item: Partial<ReceiptTermParameter>) => {
        setSavingTerm(true);
        try {
            if (item.id) {
                await updateOsReceiptTerm(item as ReceiptTermParameter, user?.id, user?.name);
                showToast('Termo atualizado com sucesso!', 'success');
            } else {
                await addOsReceiptTerm(item as Omit<ReceiptTermParameter, 'id'>, user?.id, user?.name);
                showToast('Termo adicionado com sucesso!', 'success');
            }
            fetchData();
            setIsTermModalOpen(false);
            setEditingTerm(null);
        } catch (error) {
            showToast('Erro ao salvar termo.', 'error');
        } finally {
            setSavingTerm(false);
        }
    };

    const handleDeleteTerm = async () => {
        if (!deletingTerm) return;
        try {
            await deleteOsReceiptTerm(deletingTerm.id, user?.id, user?.name);
            showToast('Termo excluído com sucesso!', 'success');
            fetchData();
            setDeletingTerm(null);
        } catch (error: any) {
            showToast(error.message || 'Erro ao excluir.', 'error');
        }
    };

    const tabClasses = (tabName: string) => `px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${activeSubTab === tabName ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-gray-500 hover:text-gray-900 hover:bg-white border border-transparent shadow-none'}`;

    return (
        <div className="bg-surface rounded-[2.5rem] border border-gray-100 p-8 space-y-8 shadow-sm max-w-[886px]">
            <div className="flex flex-wrap items-center gap-2 bg-gray-100/50 p-2 rounded-[1.5rem] border border-gray-100 shadow-inner">
                <button onClick={() => setActiveSubTab('tipos_os')} className={tabClasses('tipos_os')}>Tipos de OS</button>
                <button onClick={() => setActiveSubTab('condicao')} className={tabClasses('condicao')}>Condição</button>
                <button onClick={() => setActiveSubTab('local')} className={tabClasses('local')}>Local de estoque</button>
                <button onClick={() => setActiveSubTab('garantia')} className={tabClasses('garantia')}>Garantia</button>
                <button onClick={() => setActiveSubTab('termos')} className={tabClasses('termos')}>Termos de Garantia</button>
                <button onClick={() => setActiveSubTab('checklist')} className={tabClasses('checklist')}>Checklist Físico</button>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                {activeSubTab === 'condicao' && <ParameterManager permissions={permissions} title="Condições de Produto (OS)" items={conditions} fields={[{ name: 'name', label: 'Nome', type: 'text' }]} api={{ add: addOsProductCondition, update: updateOsProductCondition, del: deleteOsProductCondition }} fetchData={fetchData} />}
                {activeSubTab === 'local' && <ParameterManager permissions={permissions} title="Locais de Estoque (OS)" items={locations} fields={[{ name: 'name', label: 'Nome', type: 'text' }]} api={{ add: addOsStorageLocation, update: updateOsStorageLocation, del: deleteOsStorageLocation }} fetchData={fetchData} />}
                {activeSubTab === 'garantia' && <ParameterManager permissions={permissions} title="Garantias (OS)" items={warranties} fields={[{ name: 'name', label: 'Nome', type: 'text' }, { name: 'days', label: 'Qtd. Dias', type: 'number' }]} api={{ add: addOsWarranty as any, update: updateOsWarranty as any, del: deleteOsWarranty as any }} fetchData={fetchData} />}
                {activeSubTab === 'checklist' && <ParameterManager permissions={permissions} title="Itens de Checklist (OS)" items={checklistItems} fields={[{ name: 'name', label: 'Nome', type: 'text' }]} api={{ add: addChecklistItem, update: updateChecklistItem, del: deleteChecklistItem }} fetchData={fetchData} />}
                {activeSubTab === 'tipos_os' && <ParameterManager permissions={permissions} title="Tipos de OS" items={osTypes} fields={[{ name: 'name', label: 'Nome', type: 'text' }]} api={{ add: addOsType, update: updateOsType, del: deleteOsType }} fetchData={fetchData} />}
                {activeSubTab === 'termos' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
                            <div>
                                <h4 className="text-xl font-black text-gray-900 tracking-tight">Termos de Garantia</h4>
                                <p className="text-sm text-gray-500 font-medium">Crie termos personalizados para cada tipo de situação.</p>
                            </div>
                            {permissions?.canManageParameters && (
                                <button
                                    onClick={() => handleOpenTermModal()}
                                    className="w-12 h-12 flex items-center justify-center bg-primary text-white rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
                                >
                                    <PlusIcon className="h-6 w-6" />
                                </button>
                            )}
                        </div>
                        <div className="border border-gray-100 rounded-[2.5rem] overflow-hidden shadow-sm bg-white">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50/50">
                                        <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-gray-400 text-left">Nome</th>
                                        <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-gray-400 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {receiptTerms.map(term => (
                                        <tr key={term.id} className="hover:bg-gray-50/30 transition-colors">
                                            <td className="px-8 py-5 font-bold text-gray-700">{term.name}</td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex justify-end items-center gap-2">
                                                    {permissions?.canManageParameters && (
                                                        <>
                                                            <button
                                                                onClick={() => handleOpenTermModal(term)}
                                                                className="p-2.5 hover:bg-primary/10 rounded-xl transition-all group"
                                                            >
                                                                <EditIcon className="h-5 w-5 text-gray-400 group-hover:text-primary" />
                                                            </button>
                                                            {term.name !== 'Padrão' && (
                                                                <button
                                                                    onClick={() => setDeletingTerm(term)}
                                                                    className="p-2.5 hover:bg-red-50 rounded-xl transition-all group"
                                                                >
                                                                    <TrashIcon className="h-5 w-5 text-gray-400 group-hover:text-red-500" />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {isTermModalOpen && <ReceiptTermModal item={editingTerm} onClose={() => { setIsTermModalOpen(false); setEditingTerm(null); }} onSave={handleSaveTerm} isSaving={savingTerm} />}
            <ConfirmationModal isOpen={!!deletingTerm} onClose={() => setDeletingTerm(null)} onConfirm={handleDeleteTerm} title="Excluir Termo" message={`Deseja excluir o termo "${deletingTerm?.name}"? Esta ação não pode ser desfeita.`} />
        </div>
    );
};

export default ParameterSettings;
