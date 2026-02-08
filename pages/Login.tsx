import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext.tsx';
import { SpinnerIcon, EyeIcon, EyeSlashIcon, UserCircleIcon } from '../components/icons.tsx';
import { useToast } from '../contexts/ToastContext.tsx';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const { login, isAuthenticated } = useUser();
    const navigate = useNavigate();
    const { showToast } = useToast();

    React.useEffect(() => {
        if (isAuthenticated) {
            navigate('/');
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading || isExiting) return;

        setLoading(true);

        try {
            await Promise.race([
                login(email, password),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Tempo limite excedido. Verifique sua conexão.')), 15000))
            ]);

            setIsExiting(true);

        } catch (error: any) {
            setLoading(false);
            console.error("Login failed:", error);
            showToast(error.message || 'Falha no login. Verifique suas credenciais.', 'error');
        }
    };

    const inputClasses = "w-full px-4 py-2 border rounded-md bg-white/50 border-white/30 focus:ring-2 focus:ring-accent focus:border-transparent transition placeholder-gray-400 text-primary shadow-sm backdrop-blur-sm";

    return (
        <React.Fragment>
            <div className={`space-y-6 transition-all duration-500 ease-in-out transform ${isExiting ? 'opacity-0 scale-95 translate-y-4' : 'opacity-100 scale-100 translate-y-0'}`}>
                <div>
                    <h2 className="text-2xl font-bold text-center text-primary">Acessar sua conta</h2>
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
                    <div>
                        <label htmlFor="password-login" className="block text-sm font-medium text-primary mb-1">Senha</label>
                        <div className="relative">
                            <input
                                id="password-login"
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
                    <button
                        type="submit"
                        disabled={loading || isExiting}
                        className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-md font-semibold hover:bg-opacity-90 transition disabled:bg-muted flex items-center justify-center"
                    >
                        {(loading || isExiting) ? <SpinnerIcon className="h-5 w-5" /> : 'Entrar'}
                    </button>
                </form>
            </div>

            {(loading || isExiting) && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/5 backdrop-blur-md animate-fade-in pointer-events-auto">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 max-w-[300px] w-full text-center animate-scale-in border border-emerald-100">
                        <div className="relative">
                            <div className="w-16 h-16 border-[3px] border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <UserCircleIcon className="h-8 w-8 text-emerald-600 animate-pulse" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <h3 className="text-xl font-black text-emerald-700 uppercase tracking-tighter">Autenticando</h3>
                            <p className="text-[11px] text-emerald-600 font-bold tracking-wide uppercase px-4">
                                Validando credenciais e preparando o iStore...
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </React.Fragment>
    );
};

export default Login;
