import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SpinnerIcon, EnvelopeIcon } from '../components/icons.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import { sendPasswordResetEmail } from '../services/mockApi.ts';

const ForgotPassword: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const { showToast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;

        setLoading(true);
        try {
            await sendPasswordResetEmail(email.trim());
            setSent(true);
            showToast('E-mail de recuperação enviado com sucesso!', 'success');
        } catch (error: any) {
            console.error("Reset password error:", error);
            showToast(error.message || 'Erro ao enviar e-mail de recuperação.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "w-full px-4 py-2 border rounded-xl bg-white/50 border-white/30 focus:ring-2 focus:ring-accent focus:border-transparent transition placeholder-gray-400 text-primary shadow-sm backdrop-blur-sm";

    if (sent) {
        return (
            <div className="space-y-6 text-center animate-fade-in">
                <div className="flex justify-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                        <EnvelopeIcon className="h-8 w-8 text-emerald-600" />
                    </div>
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-primary">Verifique seu e-mail</h2>
                    <p className="text-muted text-sm px-4">
                        Enviamos um link de recuperação para <strong>{email}</strong>.
                        Acesse sua caixa de entrada para redefinir sua senha.
                    </p>
                </div>
                <div className="pt-4">
                    <Link to="/login" className="text-accent hover:underline font-semibold">
                        Voltar para o Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-primary">Recuperar Senha</h2>
                <p className="text-muted text-sm mt-2">
                    Insira seu e-mail e enviaremos um link para você criar uma nova senha.
                </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-primary mb-1">Email</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClasses}
                        required
                        placeholder="seu@email.com"
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-xl font-semibold hover:bg-opacity-90 transition disabled:bg-muted flex items-center justify-center"
                >
                    {loading ? <SpinnerIcon className="h-5 w-5" /> : 'Enviar link de recuperação'}
                </button>
                <div className="text-center mt-4">
                    <Link to="/login" className="text-sm text-accent hover:underline font-medium">
                        Lembrou a senha? Voltar para o Login
                    </Link>
                </div>
            </form>
        </div>
    );
};

export default ForgotPassword;
