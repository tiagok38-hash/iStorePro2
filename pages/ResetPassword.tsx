import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SpinnerIcon, LockClosedIcon, EyeIcon, EyeSlashIcon } from '../components/icons.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import { updatePassword } from '../services/mockApi.ts';
import { supabase } from '../supabaseClient.ts';

const ResetPassword: React.FC = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(true);
    const navigate = useNavigate();
    const { showToast } = useToast();

    useEffect(() => {
        // Verificar se existe uma sessão ativa (o Supabase cria a sessão automaticamente ao clicar no link de reset)
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                showToast('Link de recuperação inválido ou expirado.', 'error');
                navigate('/login');
            }
            setVerifying(false);
        };
        checkSession();
    }, [navigate, showToast]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            showToast('As senhas não coincidem.', 'error');
            return;
        }

        if (password.length < 6) {
            showToast('A senha deve ter pelo menos 6 caracteres.', 'error');
            return;
        }

        setLoading(true);
        try {
            await updatePassword(password);
            showToast('Senha atualizada com sucesso! Faça login com a nova senha.', 'success');
            // Como a senha foi atualizada, fazemos logout para garantir que o usuário faça login novamente
            await supabase.auth.signOut();
            navigate('/login');
        } catch (error: any) {
            console.error("Update password error:", error);
            showToast(error.message || 'Erro ao atualizar senha.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "w-full px-4 py-2 border rounded-xl bg-white/50 border-white/30 focus:ring-2 focus:ring-accent focus:border-transparent transition placeholder-gray-400 text-primary shadow-sm backdrop-blur-sm";

    if (verifying) {
        return (
            <div className="flex flex-col items-center justify-center p-8 animate-pulse">
                <SpinnerIcon className="h-10 w-10 text-accent mb-4" />
                <p className="text-muted text-sm">Validando link de acesso...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="text-center">
                <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                        <LockClosedIcon className="h-6 w-6 text-accent" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-primary">Nova Senha</h2>
                <p className="text-muted text-sm mt-2">
                    Crie uma senha forte para proteger sua conta.
                </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="new-password" className="block text-sm font-medium text-primary mb-1">Nova Senha</label>
                    <div className="relative">
                        <input
                            id="new-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={inputClasses}
                            required
                            placeholder="••••••••"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors pr-1"
                        >
                            {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
                <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-primary mb-1">Confirmar Nova Senha</label>
                    <input
                        id="confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={inputClasses}
                        required
                        placeholder="••••••••"
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-xl font-semibold hover:bg-opacity-90 transition disabled:bg-muted flex items-center justify-center"
                >
                    {loading ? <SpinnerIcon className="h-5 w-5" /> : 'Redefinir Senha'}
                </button>
            </form>
        </div>
    );
};

export default ResetPassword;
