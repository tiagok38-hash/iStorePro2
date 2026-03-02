import React, { useState, useEffect } from 'react';
import {
    getBancoHorasFuncionarios, saveBancoHorasFuncionario, deleteBancoHorasFuncionario
} from '../services/mockApi.ts';
import { BancoHorasFuncionario } from '../types.ts';
import { formatDateBR } from '../utils/dateUtils.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import {
    PlusIcon, EditIcon, TrashIcon, SpinnerIcon, UserPlusIcon,
    XCircleIcon, CheckIcon, MapPinIcon
} from '../components/icons.tsx';
import Button from '../components/Button.tsx';
import ConfirmationModal from '../components/ConfirmationModal.tsx';
import MoneyInput from '../components/MoneyInput.tsx';



// --- Funcionario Modal (Standalone) ---
const FuncionarioModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    funcionario: BancoHorasFuncionario | null;
    onSave: (f: Partial<BancoHorasFuncionario>) => void;
}> = ({ isOpen, onClose, funcionario, onSave }) => {
    const [name, setName] = useState('');
    const [funcao, setFuncao] = useState('');
    const [dataNascimento, setDataNascimento] = useState('');
    const [cpf, setCpf] = useState('');
    const [rg, setRg] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [cep, setCep] = useState('');
    const [endereco, setEndereco] = useState('');
    const [numero, setNumero] = useState('');
    const [bairro, setBairro] = useState('');
    const [cidade, setCidade] = useState('');
    const [estado, setEstado] = useState('PE');
    const [valorSalario, setValorSalario] = useState(0);
    const [bonusSalarial, setBonusSalarial] = useState(0);
    const [dataAdmissao, setDataAdmissao] = useState('');
    const [valorHora, setValorHora] = useState(0);
    const [active, setActive] = useState(true);
    const [loadingCep, setLoadingCep] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        if (funcionario) {
            setName(funcionario.name || '');
            setFuncao(funcionario.funcao || '');
            setDataNascimento(funcionario.data_nascimento || '');
            setCpf(funcionario.cpf || '');
            setRg(funcionario.rg || '');
            setWhatsapp(funcionario.whatsapp || '');
            setCep(funcionario.cep || '');
            setEndereco(funcionario.endereco || '');
            setNumero(funcionario.numero || '');
            setBairro(funcionario.bairro || '');
            setCidade(funcionario.cidade || '');
            setEstado(funcionario.estado || 'PE');
            setValorSalario(funcionario.valor_salario || 0);
            setBonusSalarial(funcionario.bonus_salarial || 0);
            setDataAdmissao(funcionario.data_admissao || '');
            setValorHora(funcionario.valor_hora || 0);
            setActive(funcionario.active !== false);
        } else {
            setName('');
            setFuncao('');
            setDataNascimento('');
            setCpf('');
            setRg('');
            setWhatsapp('');
            setCep('');
            setEndereco('');
            setNumero('');
            setBairro('');
            setCidade('');
            setEstado('PE');
            setValorSalario(0);
            setBonusSalarial(0);
            setDataAdmissao('');
            setValorHora(0);
            setActive(true);
        }
    }, [funcionario, isOpen]);

    const handleCepBlur = async () => {
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length === 8) {
            setLoadingCep(true);
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
                const data = await response.json();
                if (!data.erro) {
                    setEndereco(data.logradouro || '');
                    setBairro(data.bairro || '');
                    setCidade(data.localidade || '');
                    setEstado(data.uf || 'PE');
                    showToast('Endereço preenchido automaticamente!', 'success');
                } else {
                    showToast('CEP não encontrado.', 'warning');
                }
            } catch (error) {
                showToast('Erro ao buscar CEP.', 'error');
            } finally {
                setLoadingCep(false);
            }
        }
    };

    const handleSave = () => {
        if (!name) return alert('Nome é obrigatório');
        onSave({
            id: funcionario?.id,
            name,
            funcao,
            data_nascimento: dataNascimento || null,
            cpf,
            rg,
            whatsapp,
            cep,
            endereco,
            numero,
            bairro,
            cidade,
            estado,
            valor_salario: valorSalario,
            bonus_salarial: bonusSalarial,
            data_admissao: dataAdmissao || null,
            valor_hora: valorHora,
            active
        });
    };

    if (!isOpen) return null;

    const inputClasses = "w-full p-2 border rounded-xl bg-surface border-border focus:ring-1 focus:ring-success text-sm h-10";
    const labelClasses = "block text-[10px] font-bold mb-1 text-primary uppercase tracking-wider";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex justify-center items-center p-4 backdrop-blur-sm">
            <div className="bg-surface p-6 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto border border-border">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-primary flex items-center gap-2">
                        {funcionario ? <EditIcon className="w-6 h-6 text-blue-500" /> : <UserPlusIcon className="w-6 h-6 text-success" />}
                        {funcionario ? 'Editar Funcionário' : 'Cadastrar Novo Funcionário'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><XCircleIcon className="w-6 h-6 text-muted" /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Dados Pessoais */}
                    <div className="md:col-span-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 space-y-4">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b pb-2">Informações Básicas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-2">
                                <label className={labelClasses}>Nome Completo *</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClasses} placeholder="Ex: João Silva" />
                            </div>
                            <div>
                                <label className={labelClasses}>Função / Cargo</label>
                                <input type="text" value={funcao} onChange={e => setFuncao(e.target.value)} className={inputClasses} placeholder="Ex: Vendedor" />
                            </div>
                            <div>
                                <label className={labelClasses}>Data Nascimento</label>
                                <input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className={inputClasses} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className={labelClasses}>CPF</label>
                                <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} className={inputClasses} placeholder="000.000.000-00" />
                            </div>
                            <div>
                                <label className={labelClasses}>RG</label>
                                <input type="text" value={rg} onChange={e => setRg(e.target.value)} className={inputClasses} placeholder="0.000.000" />
                            </div>
                            <div>
                                <label className={labelClasses}>WhatsApp</label>
                                <input type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className={inputClasses} placeholder="(00) 00000-0000" />
                            </div>
                            <div>
                                <label className={labelClasses}>Data Admissão</label>
                                <input type="date" value={dataAdmissao} onChange={e => setDataAdmissao(e.target.value)} className={inputClasses} />
                            </div>
                        </div>
                    </div>

                    {/* Endereço */}
                    <div className="md:col-span-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 space-y-4">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b pb-2">Endereço</h3>
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                            <div className="relative">
                                <label className={labelClasses}>CEP</label>
                                <div className="relative">
                                    <input type="text" value={cep} onChange={e => setCep(e.target.value)} onBlur={handleCepBlur} className={inputClasses} placeholder="00000-000" />
                                    {loadingCep && <div className="absolute right-2 top-2.5"><SpinnerIcon className="w-4 h-4 animate-spin text-success" /></div>}
                                </div>
                            </div>
                            <div className="md:col-span-3">
                                <label className={labelClasses}>Logradouro</label>
                                <input type="text" value={endereco} onChange={e => setEndereco(e.target.value)} className={inputClasses} placeholder="Ex: Rua das Flores" />
                            </div>
                            <div>
                                <label className={labelClasses}>Número</label>
                                <input type="text" value={numero} onChange={e => setNumero(e.target.value)} className={inputClasses} />
                            </div>
                            <div>
                                <label className={labelClasses}>Bairro</label>
                                <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} className={inputClasses} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className={labelClasses}>Cidade</label>
                                <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} className={inputClasses} />
                            </div>
                            <div>
                                <label className={labelClasses}>Estado (UF)</label>
                                <select value={estado} onChange={e => setEstado(e.target.value)} className={inputClasses}>
                                    <option value="PE">Pernambuco</option>
                                    <option value="AL">Alagoas</option>
                                    <option value="PB">Paraíba</option>
                                    <option value="SP">São Paulo</option>
                                    <option value="RJ">Rio de Janeiro</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Financeiro */}
                    <div className="md:col-span-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 space-y-4">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b pb-2">Valores e Pagamento</h3>
                        <div className="flex flex-col md:flex-row gap-6 items-end">
                            <MoneyInput
                                label="Salário Base"
                                value={valorSalario}
                                onChange={setValorSalario}
                                labelClasses={labelClasses}
                                inputClasses={`${inputClasses} font-bold text-gray-900`}
                            />
                            <MoneyInput
                                label="Bônus Salarial"
                                value={bonusSalarial}
                                onChange={setBonusSalarial}
                                labelClasses={labelClasses}
                                inputClasses={`${inputClasses} font-bold text-blue-600`}
                            />
                            <div className="flex-none w-32">
                                <MoneyInput
                                    label="Valor da Hora"
                                    value={valorHora}
                                    onChange={setValorHora}
                                    labelClasses={labelClasses}
                                    inputClasses={`${inputClasses} text-xs font-bold text-green-600`}
                                />
                            </div>
                            <div className="flex-none min-w-[120px]">
                                <label className={`${labelClasses} text-center`}>Status</label>
                                <label className="flex items-center justify-between gap-3 cursor-pointer group h-10 px-4 bg-white border border-border rounded-xl hover:border-blue-200 transition-all">
                                    <span className={`text-sm font-bold transition-colors ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                                        {active ? 'Ativo' : 'Inativo'}
                                    </span>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={active}
                                            onChange={e => setActive(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className={`w-10 h-5 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 shadow-inner`}></div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
                    <Button onClick={onClose} variant="secondary">Cancelar</Button>
                    <Button onClick={handleSave} variant="success" icon={<CheckIcon className="w-5 h-5" />}>Salvar Funcionário</Button>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
const GerenciarFuncionariosTab: React.FC = () => {
    const [funcionarios, setFuncionarios] = useState<BancoHorasFuncionario[]>([]);
    const [loading, setLoading] = useState(true);
    const [funcModalOpen, setFuncModalOpen] = useState(false);
    const [editingFunc, setEditingFunc] = useState<BancoHorasFuncionario | null>(null);
    const [deletingFunc, setDeletingFunc] = useState<BancoHorasFuncionario | null>(null);
    const { user } = useUser();
    const { showToast } = useToast();

    const fetchFuncionarios = async () => {
        setLoading(true);
        try {
            const data = await getBancoHorasFuncionarios();
            setFuncionarios(data);
        } catch (error) {
            showToast('Erro ao buscar funcionários.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFuncionarios();
    }, []);

    const handleSaveFuncionario = async (f: Partial<BancoHorasFuncionario>) => {
        try {
            await saveBancoHorasFuncionario(f as BancoHorasFuncionario);
            showToast('Funcionário salvo com sucesso!', 'success');
            setFuncModalOpen(false);
            setEditingFunc(null);
            fetchFuncionarios();
        } catch (error) {
            showToast('Erro ao salvar funcionário.', 'error');
        }
    };

    const handleDeleteFunc = async () => {
        if (!deletingFunc) return;
        try {
            await deleteBancoHorasFuncionario(deletingFunc.id);
            showToast('Funcionário excluído!', 'success');
            setDeletingFunc(null);
            fetchFuncionarios();
        } catch (error) {
            showToast('Erro ao excluir funcionário.', 'error');
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <div className="space-y-6">
            <div className="bg-surface p-6 rounded-3xl shadow-sm border border-border">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-black flex items-center gap-2 text-primary">
                            <UserPlusIcon className="w-6 h-6 text-success" /> Administração de Funcionários
                        </h2>
                        <p className="text-xs text-muted">Gerencie o cadastro, cargos e salários dos colaboradores.</p>
                    </div>
                    <Button onClick={() => setFuncModalOpen(true)} variant="success" icon={<PlusIcon className="w-5 h-5" />} className="w-full md:w-auto">
                        Cadastrar Novo Funcionário
                    </Button>
                </div>

                <div className="overflow-x-auto border border-border rounded-2xl bg-white">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-bold tracking-widest border-b border-border">
                            <tr>
                                <th className="p-4">Nome</th>
                                <th className="p-4">Função</th>
                                <th className="p-4">Admissão</th>
                                <th className="p-4">Salário</th>
                                <th className="p-4">Bônus</th>
                                <th className="p-4 text-center">R$ / Hora</th>
                                <th className="p-4 text-center">Status</th>
                                <th className="p-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading && (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center">
                                        <SpinnerIcon className="w-8 h-8 animate-spin mx-auto opacity-20" />
                                    </td>
                                </tr>
                            )}
                            {!loading && funcionarios.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-muted italic">
                                        Nenhum funcionário cadastrado.
                                    </td>
                                </tr>
                            )}
                            {!loading && funcionarios.map(f => (
                                <tr key={f.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="p-4 pr-10">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-primary group-hover:text-success transition-colors">{f.name}</span>
                                            {f.whatsapp && <span className="text-[10px] text-muted">{f.whatsapp}</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 text-gray-600">{f.funcao || <span className="text-gray-300">---</span>}</td>
                                    <td className="p-4 text-gray-500 font-medium">{f.data_admissao ? formatDateBR(f.data_admissao) : <span className="text-gray-300">---</span>}</td>
                                    <td className="p-4 font-bold text-gray-900">{formatCurrency(f.valor_salario || 0)}</td>
                                    <td className="p-4 font-bold text-blue-600">{formatCurrency(f.bonus_salarial || 0)}</td>
                                    <td className="p-4 text-center">
                                        <div className="inline-flex flex-col items-center">
                                            <span className="font-bold text-green-600">{formatCurrency(f.valor_hora || 0)}</span>
                                            <span className="text-[10px] text-gray-400 font-medium">valor/hora</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-3 py-1 text-[9px] font-black rounded-full uppercase tracking-widest ${f.active ? 'bg-green-100 text-green-700 shadow-sm' : 'bg-red-100 text-red-700 opacity-60'}`}>
                                            {f.active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => { setEditingFunc(f); setFuncModalOpen(true); }}
                                                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                                title="Editar Informações"
                                            >
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setDeletingFunc(f)}
                                                className="p-2 text-gray-400 hover:text-danger hover:bg-red-50 rounded-xl transition-all"
                                                title="Remover Funcionário"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <FuncionarioModal
                isOpen={funcModalOpen}
                onClose={() => { setFuncModalOpen(false); setEditingFunc(null); }}
                funcionario={editingFunc}
                onSave={handleSaveFuncionario}
            />

            <ConfirmationModal
                isOpen={!!deletingFunc}
                onClose={() => setDeletingFunc(null)}
                onConfirm={handleDeleteFunc}
                title="Excluir Funcionário"
                message={`Tem certeza que deseja excluir o funcionário "${deletingFunc?.name}"? Esta ação removerá o registro e os históricos vinculados.`}
                confirmText="Excluir Permanentemente"
                confirmVariant="danger"
            />
        </div>
    );
};

export default GerenciarFuncionariosTab;
