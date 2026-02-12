import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';
import { ProductConditionParameter, StorageLocationParameter, WarrantyParameter, ReceiptTermParameter, PermissionSet } from '../../types';
import {
    getProductConditions, addProductCondition, updateProductCondition, deleteProductCondition,
    getStorageLocations, addStorageLocation, updateStorageLocation, deleteStorageLocation,
    getWarranties, addWarranty, updateWarranty, deleteWarranty,
    getReceiptTerms, addReceiptTerm, updateReceiptTerm, deleteReceiptTerm
} from '../../services/mockApi';
import Button from '../Button';
import { PlusIcon, EditIcon, TrashIcon } from '../icons';
import ReceiptTermModal from '../ReceiptTermModal';
import ConfirmationModal from '../ConfirmationModal';

// --- ParameterManager Component ---
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

    // Modal component
    const ItemModal: React.FC<{ item: Partial<T> | null, onSave: (data: Partial<T>) => void, onClose: () => void, isSaving: boolean }> = ({ item, onSave, onClose, isSaving }) => {
        const [formData, setFormData] = useState(item || {});

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const { name, value, type } = e.target;
            setFormData(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
        };

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            onSave(formData);
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
                <form onSubmit={handleSubmit} className="bg-surface rounded-xl shadow-xl p-6 w-full max-w-sm">
                    <h3 className="font-bold text-lg mb-4">{item?.id ? 'Editar' : 'Novo'} Item</h3>
                    {fields.map(field => (
                        <div key={String(field.name)} className="mb-4">
                            <label className="block text-sm font-medium mb-1">{field.label}</label>
                            <input
                                type={field.type}
                                name={String(field.name)}
                                value={(formData as any)[field.name] || (field.type === 'number' ? '' : '')}
                                onChange={handleChange}
                                className="w-full p-2 border rounded bg-transparent border-border"
                                required
                            />
                        </div>
                    ))}
                    <div className="flex justify-end gap-2 mt-4">
                        <Button type="button" onClick={onClose} variant="secondary">Cancelar</Button>
                        <Button type="submit" variant="success" loading={isSaving}>Salvar</Button>
                    </div>
                </form>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-100 p-4 rounded-t-2xl">
                <div>
                    <h4 className="text-lg font-semibold text-primary">{title}</h4>
                </div>
                {permissions?.canManageParameters && (
                    <button onClick={() => handleOpenModal()} className="p-2 bg-gray-300 rounded-full hover:bg-gray-400">
                        <PlusIcon className="h-5 w-5" />
                    </button>
                )}
            </div>
            <div className="border border-gray-200 rounded-b-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            {fields.map(field => (
                                <th key={String(field.name)} className="p-3 font-semibold text-left">{field.label}</th>
                            ))}
                            <th className="p-3 font-semibold text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map(item => (
                            <tr key={item.id} className="border-t">
                                {fields.map(field => (
                                    <td key={String(field.name)} className="p-3">{(item as any)[field.name]}</td>
                                ))}
                                <td className="p-3">
                                    <div className="flex justify-end items-center gap-2">
                                        {permissions?.canManageParameters && (
                                            <>
                                                <button onClick={() => handleOpenModal(item)}><EditIcon className="h-5 w-5 text-muted hover:text-primary" /></button>
                                                <button onClick={() => setDeletingItem(item)}><TrashIcon className="h-5 w-5 text-muted hover:text-danger" /></button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {modalOpen && <ItemModal item={editingItem} onSave={handleSave} onClose={() => { setModalOpen(false); setEditingItem(null); }} isSaving={saving} />}
            <ConfirmationModal isOpen={!!deletingItem} onClose={() => setDeletingItem(null)} onConfirm={handleDelete} title={`Excluir ${deletingItem?.name}`} message="Tem certeza que deseja excluir este item?" />
        </div>
    );
};

// --- Main ParameterSettings Component ---
const ParameterSettings: React.FC = () => {
    const [activeSubTab, setActiveSubTab] = useState('condicao');
    const [conditions, setConditions] = useState<ProductConditionParameter[]>([]);
    const [locations, setLocations] = useState<StorageLocationParameter[]>([]);
    const [warranties, setWarranties] = useState<WarrantyParameter[]>([]);
    const [receiptTerms, setReceiptTerms] = useState<ReceiptTermParameter[]>([]);
    const [isTermModalOpen, setIsTermModalOpen] = useState(false);
    const [editingTerm, setEditingTerm] = useState<Partial<ReceiptTermParameter> | null>(null);
    const [deletingTerm, setDeletingTerm] = useState<ReceiptTermParameter | null>(null);
    const { showToast } = useToast();
    const { permissions, user } = useUser();

    const fetchData = useCallback(async () => {
        const [c, l, w, t] = await Promise.all([
            getProductConditions(),
            getStorageLocations(),
            getWarranties(),
            getReceiptTerms()
        ]);
        setConditions(c); setLocations(l); setWarranties(w); setReceiptTerms(t);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleOpenTermModal = (item: Partial<ReceiptTermParameter> | null = null) => {
        setEditingTerm(item || {});
        setIsTermModalOpen(true);
    }
    const [savingTerm, setSavingTerm] = useState(false);

    const handleSaveTerm = async (item: Partial<ReceiptTermParameter>) => {
        setSavingTerm(true);
        try {
            if (item.id) {
                await updateReceiptTerm(item as ReceiptTermParameter, user?.id, user?.name);
                showToast('Termo atualizado!', 'success');
            } else {
                await addReceiptTerm(item as Omit<ReceiptTermParameter, 'id'>, user?.id, user?.name);
                showToast('Termo adicionado!', 'success');
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
            await deleteReceiptTerm(deletingTerm.id, user?.id, user?.name);
            showToast('Termo excluído!', 'success');
            fetchData();
            setDeletingTerm(null);
        } catch (error: any) {
            showToast(error.message || 'Erro ao excluir.', 'error');
        }
    };

    const tabClasses = (tabName: string) => `px-5 py-2 rounded-xl text-[10.5px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${activeSubTab === tabName ? 'bg-primary text-white shadow-lg shadow-gray-900/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`;

    return (
        <div className="bg-surface rounded-3xl border border-border p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-sm flex-wrap">
                <button onClick={() => setActiveSubTab('condicao')} className={tabClasses('condicao')}>Condição</button>
                <button onClick={() => setActiveSubTab('local')} className={tabClasses('local')}>Local de estoque</button>
                <button onClick={() => setActiveSubTab('garantia')} className={tabClasses('garantia')}>Garantia</button>
                <button onClick={() => setActiveSubTab('termos')} className={tabClasses('termos')}>Termos de Garantia</button>
            </div>
            {activeSubTab === 'condicao' && <ParameterManager permissions={permissions} title="Condições de Produto" items={conditions} fields={[{ name: 'name', label: 'Nome', type: 'text' }]} api={{ add: addProductCondition, update: updateProductCondition, del: deleteProductCondition }} fetchData={fetchData} />}
            {activeSubTab === 'local' && <ParameterManager permissions={permissions} title="Locais de Estoque" items={locations} fields={[{ name: 'name', label: 'Nome', type: 'text' }]} api={{ add: addStorageLocation, update: updateStorageLocation, del: deleteStorageLocation }} fetchData={fetchData} />}
            {activeSubTab === 'garantia' && <ParameterManager permissions={permissions} title="Garantias" items={warranties} fields={[{ name: 'name', label: 'Nome', type: 'text' }, { name: 'days', label: 'Dias', type: 'number' }]} api={{ add: addWarranty, update: updateWarranty, del: deleteWarranty }} fetchData={fetchData} />}
            {activeSubTab === 'termos' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-gray-100 p-4 rounded-t-2xl">
                        <div>
                            <h4 className="text-lg font-semibold text-primary">Termos de Garantia</h4>
                            <p className="text-sm text-muted">Crie termos personalizados para cada tipo de situação. Ex: Termos para vendas de Apple, Xiaomi, etc.</p>
                        </div>
                        {permissions?.canManageParameters && <button onClick={() => handleOpenTermModal()} className="p-2 bg-gray-300 rounded-full hover:bg-gray-400"><PlusIcon className="h-5 w-5" /></button>}
                    </div>
                    <div className="border border-gray-200 rounded-b-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100"><tr><th className="p-3 font-semibold text-left">Nome</th><th className="p-3 font-semibold text-right">Ações</th></tr></thead>
                            <tbody>
                                {receiptTerms.map(term => (
                                    <tr key={term.id} className="border-t">
                                        <td className="p-3">{term.name}</td>
                                        <td className="p-3"><div className="flex justify-end items-center gap-2">
                                            {permissions?.canManageParameters && (
                                                <>
                                                    <button onClick={() => handleOpenTermModal(term)}><EditIcon className="h-5 w-5 text-muted hover:text-primary" /></button>
                                                    {term.name !== 'Padrão' && <button onClick={() => setDeletingTerm(term)}><TrashIcon className="h-5 w-5 text-muted hover:text-danger" /></button>}
                                                </>
                                            )}
                                        </div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isTermModalOpen && <ReceiptTermModal item={editingTerm} onClose={() => { setIsTermModalOpen(false); setEditingTerm(null); }} onSave={handleSaveTerm} isSaving={savingTerm} />}
            <ConfirmationModal isOpen={!!deletingTerm} onClose={() => setDeletingTerm(null)} onConfirm={handleDeleteTerm} title="Excluir Termo" message={`Deseja excluir o termo "${deletingTerm?.name}"?`} />
        </div>
    );
};

export default ParameterSettings;
