import React, { useState, useEffect } from 'react';
import { getCompanyInfo, updateCompanyInfo } from '../../services/mockApi.ts';
import { testTelegramConnection } from '../../services/telegramService.ts';
import { useToast } from '../../contexts/ToastContext.tsx';
import { useUser } from '../../contexts/UserContext.tsx';
import Button from '../../components/Button.tsx';
import { SpinnerIcon, CheckIcon } from '../../components/icons.tsx';

// ─── Icons ────────────────────────────────────────────────────────────────────

const TelegramIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z" />
    </svg>
);

const EyeIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
);

const EyeOffIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
);

const BotIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="8" width="18" height="12" rx="3" />
        <path strokeLinecap="round" d="M8 12h.01M12 12h.01M16 12h.01" />
        <path strokeLinecap="round" d="M12 8V5" />
        <circle cx="12" cy="4" r="1.5" />
    </svg>
);

const ShieldIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
);

// ─── Tutorial Step Component ───────────────────────────────────────────────────

interface TutorialStepProps {
    number: number;
    title: string;
    children: React.ReactNode;
    platform?: 'ios' | 'android' | 'both';
}

const TutorialStep: React.FC<TutorialStepProps> = ({ number, title, children, platform }) => {
    const platformBadge = platform === 'ios'
        ? <span className="text-[10px] font-bold uppercase tracking-widest bg-gray-800 text-white px-2 py-0.5 rounded-full">iPhone</span>
        : platform === 'android'
        ? <span className="text-[10px] font-bold uppercase tracking-widest bg-green-600 text-white px-2 py-0.5 rounded-full">Android</span>
        : null;

    return (
        <div className="flex gap-4 group">
            {/* Step number bubble */}
            <div className="flex-shrink-0 flex flex-col items-center">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-blue-200">
                    {number}
                </div>
                <div className="w-px flex-1 bg-gradient-to-b from-blue-200 to-transparent mt-2" />
            </div>
            {/* Content */}
            <div className="pb-6 flex-1">
                <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-800 text-sm">{title}</h4>
                    {platformBadge}
                </div>
                <div className="text-sm text-gray-600 leading-relaxed space-y-2">
                    {children}
                </div>
            </div>
        </div>
    );
};

// ─── Highlight inline code ─────────────────────────────────────────────────────

const Code: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <code className="bg-gray-100 border border-gray-200 text-sky-700 font-mono text-[13px] px-2 py-0.5 rounded-lg">
        {children}
    </code>
);

// ─── Main Component ────────────────────────────────────────────────────────────

const TelegramTab: React.FC = () => {
    const { showToast } = useToast();
    const { user, permissions } = useUser();

    const [botToken, setBotToken] = useState('');
    const [chatId, setChatId] = useState('');
    const [showToken, setShowToken] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    const canEdit = permissions?.canManageCompanyData;

    // Load current settings
    useEffect(() => {
        getCompanyInfo().then(info => {
            if (info) {
                setBotToken(info.telegramBotToken || '');
                setChatId(info.telegramChatId || '');
            }
        }).finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        if (!botToken.trim() || !chatId.trim()) {
            showToast('Preencha o Token do Bot e o Chat ID antes de salvar.', 'warning');
            return;
        }
        setSaving(true);
        try {
            const current = await getCompanyInfo();
            if (!current) throw new Error('Empresa não encontrada.');
            await updateCompanyInfo(
                { ...current, telegramBotToken: botToken.trim(), telegramChatId: chatId.trim() },
                user?.id || 'system',
                user?.name || 'Sistema',
            );
            showToast('Configurações do Telegram salvas com sucesso! 🎉', 'success');
        } catch (err: any) {
            console.error(err);
            showToast('Erro ao salvar. Tente novamente.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!botToken.trim() || !chatId.trim()) {
            showToast('Preencha o Token e o Chat ID antes de testar.', 'warning');
            return;
        }
        setTesting(true);
        try {
            const result = await testTelegramConnection(botToken.trim(), chatId.trim());
            if (result.ok) {
                showToast('✅ Mensagem de teste enviada! Verifique o seu Telegram.', 'success');
            } else {
                showToast(`❌ Falha no teste: ${result.error}`, 'error');
            }
        } finally {
            setTesting(false);
        }
    };

    const handleClear = async () => {
        if (!canEdit) return;
        setSaving(true);
        try {
            const current = await getCompanyInfo();
            if (!current) throw new Error();
            await updateCompanyInfo(
                { ...current, telegramBotToken: '', telegramChatId: '' },
                user?.id || 'system',
                user?.name || 'Sistema',
            );
            setBotToken('');
            setChatId('');
            showToast('Integração do Telegram removida.', 'info');
        } catch {
            showToast('Erro ao remover integração.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const isConfigured = botToken.trim().length > 0 && chatId.trim().length > 0;

    if (loading) {
        return (
            <div className="flex justify-center items-center p-16">
                <SpinnerIcon />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl">

            {/* ── Header card ─────────────────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-sky-500 to-blue-700 rounded-3xl p-6 text-white shadow-lg shadow-blue-200/50 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <TelegramIcon className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold">Bot de Notificações no Telegram</h2>
                    <p className="text-blue-100 text-sm mt-1 leading-relaxed">
                        Receba um aviso no Telegram cada vez que uma venda ou compra for registrada no sistema.
                        Configure abaixo e pronto — funciona somente para a sua empresa.
                    </p>
                </div>
                {isConfigured && (
                    <div className="flex-shrink-0 flex items-center gap-2 bg-white/20 rounded-2xl px-4 py-2 text-sm font-semibold">
                        <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
                        Ativo
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ── Form card ─────────────────────────────────────────────────── */}
                <div className="bg-surface rounded-3xl border border-border p-6 shadow-sm space-y-5">
                    <div className="flex items-center gap-3 pb-4 border-b border-border">
                        <BotIcon className="w-5 h-5 text-sky-500" />
                        <h3 className="font-semibold text-primary">Credenciais do Bot</h3>
                    </div>

                    {/* Token */}
                    <div>
                        <label className="block text-sm font-medium text-primary mb-1.5">
                            Token do Bot <span className="text-danger">*</span>
                        </label>
                        <p className="text-xs text-muted mb-2">
                            Código longo fornecido pelo <strong>@BotFather</strong> após criar o robô.
                        </p>
                        <div className="relative">
                            <input
                                type={showToken ? 'text' : 'password'}
                                value={botToken}
                                onChange={e => setBotToken(e.target.value)}
                                disabled={!canEdit}
                                placeholder="1234567890:AABBccDDeeFFggHH..."
                                className="w-full px-3 py-2.5 pr-11 border rounded-xl bg-transparent border-border focus:ring-sky-500 focus:border-sky-500 text-sm font-mono disabled:bg-gray-50 disabled:cursor-not-allowed"
                            />
                            <button
                                type="button"
                                onClick={() => setShowToken(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
                                tabIndex={-1}
                            >
                                {showToken ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Chat ID */}
                    <div>
                        <label className="block text-sm font-medium text-primary mb-1.5">
                            Chat ID <span className="text-danger">*</span>
                        </label>
                        <p className="text-xs text-muted mb-2">
                            Número de identificação obtido pelo <strong>@userinfobot</strong>.
                        </p>
                        <input
                            type="text"
                            value={chatId}
                            onChange={e => setChatId(e.target.value)}
                            disabled={!canEdit}
                            placeholder="123456789"
                            className="w-full px-3 py-2.5 border rounded-xl bg-transparent border-border focus:ring-sky-500 focus:border-sky-500 text-sm font-mono disabled:bg-gray-50 disabled:cursor-not-allowed"
                        />
                    </div>

                    {/* Privacy notice */}
                    <div className="flex items-start gap-2.5 bg-sky-50 border border-sky-100 rounded-2xl p-3.5 text-xs text-sky-700">
                        <ShieldIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>
                            Suas credenciais ficam armazenadas de forma segura e isolada somente na sua empresa—
                            nenhuma outra empresa do sistema tem acesso a elas.
                        </span>
                    </div>

                    {/* Actions */}
                    {canEdit && (
                        <div className="flex flex-col sm:flex-row gap-2 pt-2">
                            <Button
                                onClick={handleSave}
                                variant="success"
                                loading={saving}
                                icon={<CheckIcon className="h-4 w-4" />}
                                className="flex-1"
                            >
                                Salvar Configurações
                            </Button>
                            <button
                                onClick={handleTest}
                                disabled={testing || !isConfigured}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-sky-300 bg-sky-50 text-sky-700 text-sm font-semibold hover:bg-sky-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                {testing ? <SpinnerIcon /> : <TelegramIcon className="w-4 h-4" />}
                                {testing ? 'Enviando...' : 'Testar Conexão'}
                            </button>
                        </div>
                    )}

                    {/* Remove link */}
                    {canEdit && isConfigured && (
                        <div className="text-center pt-1">
                            <button
                                onClick={handleClear}
                                className="text-xs text-danger hover:underline"
                            >
                                Remover integração do Telegram
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Tutorial card ──────────────────────────────────────────────── */}
                <div className="bg-surface rounded-3xl border border-border p-6 shadow-sm">
                    <div className="flex items-center gap-3 pb-4 mb-5 border-b border-border">
                        <span className="text-xl">📖</span>
                        <div>
                            <h3 className="font-semibold text-primary">Como configurar — passo a passo</h3>
                            <p className="text-xs text-muted mt-0.5">Simples como fazer uma ligação!</p>
                        </div>
                    </div>

                    <div className="overflow-y-auto max-h-[480px] pr-1 scrollbar-thin">
                        <TutorialStep number={1} title="Abra o Telegram no celular">
                            <p>
                                Pegue o seu celular — <strong>iPhone ou Android</strong> — e abra o aplicativo do <strong>Telegram</strong> (aquele com o desenho de um avião de papel azul).
                            </p>
                        </TutorialStep>

                        <TutorialStep number={2} title={'Procure pelo \u201cPai dos Rob\u00f4s\u201d'}>
                            <p>
                                Toque na <strong>Lupa de pesquisa</strong>:
                            </p>
                            <ul className="list-disc list-inside space-y-1 mt-1">
                                <li><strong>iPhone:</strong> arraste a tela de conversas para baixo — a lupa aparece no topo.</li>
                                <li><strong>Android:</strong> a lupa fica no canto superior direito da tela.</li>
                            </ul>
                            <p className="mt-2">
                                Na barra de busca, escreva exatamente: <Code>@BotFather</Code>
                            </p>
                            <p className="mt-1">
                                Toque no nome que tiver um <strong>selinho azul de verificado</strong> ao lado e depois aperte o botão <strong>"Começar"</strong> (ou <em>Start</em>).
                            </p>
                        </TutorialStep>

                        <TutorialStep number={3} title="Crie o seu robô">
                            <p>Como se fosse mandar uma mensagem normal, escreva:</p>
                            <p className="mt-1"><Code>/newbot</Code> e envie.</p>
                            <p className="mt-2">Ele vai pedir um <strong>nome bonito</strong> para o robô. Escreva algo como:</p>
                            <p className="mt-1 italic text-gray-500">"Avisos da Minha Loja"</p>
                            <p className="mt-2">
                                Depois, ele pede um <strong>nome de usuário</strong> (como o @ do Instagram).
                                Atenção: <strong>precisa terminar com a palavra bot.</strong>
                            </p>
                            <p className="mt-1 italic text-gray-500">Exemplo: <Code>minhaloja_avisos_bot</Code></p>
                        </TutorialStep>

                        <TutorialStep number={4} title="Copie o Token do Bot">
                            <p>
                                Se o BotFather aceitou o nome, ele envia uma mensagem grande. Não se assuste!
                                Procure por um código comprido de números e letras logo após a frase:
                            </p>
                            <p className="mt-1 text-gray-500 italic">"Use this token to access the HTTP API"</p>
                            <p className="mt-2">
                                <strong>Segure o dedo sobre esse código</strong>, copie e cole no campo <strong>"Token do Bot"</strong> aqui acima.
                            </p>
                        </TutorialStep>

                        <TutorialStep number={5} title="Descubra o seu Chat ID">
                            <p>Volte na lupa de pesquisa e escreva:</p>
                            <p className="mt-1"><Code>@userinfobot</Code></p>
                            <p className="mt-2">Entre na conversa e aperte <strong>"Começar"</strong>. Ele vai te responder com um número (ex: <Code>123456789</Code>). Copie esse número e cole no campo <strong>"Chat ID"</strong> aqui acima.</p>
                        </TutorialStep>

                        <TutorialStep number={6} title="Ative o robô (muito importante!)">
                            <p>
                                Antes de terminar, você precisa "acordar" o robô. Procure pelo nome do robô que você criou (ex: <Code>@minhaloja_avisos_bot</Code>), entre na conversa e toque em <strong>"Começar"</strong>.
                            </p>
                            <p className="mt-2 font-medium text-gray-700">
                                Sem este passo, o robô não consegue te enviar mensagens!
                            </p>
                        </TutorialStep>

                        {/* Final step - no connector line */}
                        <div className="flex gap-4">
                            <div className="flex-shrink-0">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-green-200">
                                    ✓
                                </div>
                            </div>
                            <div className="pb-2 flex-1">
                                <h4 className="font-semibold text-gray-800 text-sm mb-2">Tudo certo! Agora teste</h4>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    Salve as informações e clique em <strong>"Testar Conexão"</strong>. Se aparecer um aviso no seu Telegram, está funcionando! 🎉
                                </p>
                                <div className="mt-3 bg-amber-50 border border-amber-100 rounded-2xl p-3 text-xs text-amber-700">
                                    <strong>💡 Dica:</strong> Se der erro, verifique se o Token foi copiado completo (sem espaços extras) e se você "começou" a conversa com o seu robô.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TelegramTab;
