import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext.tsx';
import { SpinnerIcon, EyeIcon, EyeSlashIcon } from '../components/icons.tsx';
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

    const inputClasses = "w-full px-4 py-2 border rounded-md bg-transparent border-border focus:ring-2 focus:ring-accent focus:border-transparent transition";

    return (
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
    );
};

export default Login;
