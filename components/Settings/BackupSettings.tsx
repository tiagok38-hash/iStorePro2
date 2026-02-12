import React, { useState, useRef } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import { getFullBackup, restoreFullBackup } from '../../services/mockApi';
import LoadingOverlay from '../LoadingOverlay';
import { ArchiveBoxIcon, SpinnerIcon, DocumentArrowUpIcon, ErrorIcon, InfoIcon } from '../icons';

const BackupSettings: React.FC = () => {
    const { showToast } = useToast();
    const { user, permissions } = useUser();
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleBackup = async () => {
        setIsBackingUp(true);
        try {
            const data = await getFullBackup();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const now = new Date();
            const formattedDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
            const fileName = `Backup_dados_sistema_${formattedDate}.json`;

            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Backup realizado com sucesso!', 'success');
        } catch (error) {
            console.error(error);
            showToast('Erro ao realizar backup.', 'error');
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleRestoreClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const confirmRestore = window.confirm(
            'ATENÇÃO: Restaurar um backup irá SUBSTITUIR todos os dados atuais do sistema. Esta ação não pode ser desfeita. Deseja continuar?'
        );

        if (!confirmRestore) {
            event.target.value = '';
            return;
        }

        setIsRestoring(true);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const backupData = JSON.parse(e.target?.result as string);
                    await restoreFullBackup(backupData, user?.id || 'system', user?.name || 'Sistema');
                    showToast('Dados restaurados com sucesso! A página será recarregada.', 'success');
                    setTimeout(() => window.location.reload(), 2000);
                } catch (error: any) {
                    console.error(error);
                    showToast(error.message || 'Erro ao processar arquivo de backup.', 'error');
                    setIsRestoring(false);
                }
            };
            reader.readAsText(file);
        } catch (error) {
            console.error(error);
            showToast('Erro ao ler arquivo.', 'error');
            setIsRestoring(false);
        }
    };

    return (
        <div className="bg-surface rounded-3xl border border-border p-8 space-y-8 shadow-sm">
            <LoadingOverlay isVisible={isBackingUp} message="Gerando Backup do Sistema..." type="backup" />
            <LoadingOverlay isVisible={isRestoring} message="Restaurando Dados do Sistema..." type="restore" />
            <div className="max-w-2xl">
                <h3 className="text-xl font-bold text-primary mb-2">Backup e Restauração</h3>
                <p className="text-muted text-sm mb-6">
                    Gerencie a segurança dos seus dados. Você pode exportar todas as informações do sistema para um arquivo em seu computador ou restaurar o sistema a partir de um backup anterior.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Backup Section */}
                    <div className="p-6 border border-border rounded-xl bg-gray-50 space-y-4">
                        <div className="flex items-center gap-3 text-primary mb-2">
                            <ArchiveBoxIcon className="h-6 w-6" />
                            <h4 className="font-bold">Realizar Backup</h4>
                        </div>
                        <p className="text-xs text-muted leading-relaxed">
                            Gera um arquivo .json contendo todos os produtos, vendas, clientes, fornecedores e configurações. Recomendado fazer diariamente.
                        </p>
                        <button
                            onClick={handleBackup}
                            disabled={isBackingUp || isRestoring || !permissions?.canManageBackups}
                            className={`w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-opacity-90 disabled:opacity-50 transition-all ${!permissions?.canManageBackups ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                            {isBackingUp ? <SpinnerIcon className="h-5 w-5" /> : <><ArchiveBoxIcon className="h-5 w-5" /> Baixar Backup</>}
                        </button>
                    </div>

                    {/* Restore Section */}
                    <div className="p-6 border border-border rounded-xl bg-orange-50 border-orange-100 space-y-4">
                        <div className="flex items-center gap-3 text-orange-700 mb-2">
                            <DocumentArrowUpIcon className="h-6 w-6" />
                            <h4 className="font-bold">Restaurar Dados</h4>
                        </div>
                        <p className="text-xs text-orange-600 leading-relaxed font-medium">
                            <span className="flex items-center gap-1 text-orange-800 font-bold mb-1">
                                <ErrorIcon className="h-4 w-4" /> AVISO CRÍTICO
                            </span>
                            Isso apagará todos os dados atuais e os substituirá pelas informações do arquivo de backup.
                        </p>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".json"
                            className="hidden"
                        />
                        <button
                            onClick={handleRestoreClick}
                            disabled={isBackingUp || isRestoring || !permissions?.canManageBackups}
                            className={`w-full flex items-center justify-center gap-2 py-3 bg-orange-600 text-white font-semibold rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-all shadow-sm ${!permissions?.canManageBackups ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                            {isRestoring ? <SpinnerIcon className="h-5 w-5" /> : <><DocumentArrowUpIcon className="h-5 w-5" /> Importar e Restaurar</>}
                        </button>
                    </div>
                </div>

                <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                    <InfoIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-xs text-blue-800 space-y-1">
                        <p className="font-bold">Informações Importantes:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>O arquivo de backup é criptografado apenas se o seu sistema de arquivos o for.</li>
                            <li>Não altere o nome das tabelas dentro do arquivo JSON.</li>
                            <li>A restauração pode levar alguns segundos dependendo do volume de dados.</li>
                            <li>Após a restauração, o sistema será reiniciado automaticamente.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BackupSettings;
