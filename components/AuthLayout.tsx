import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout: React.FC = () => {
    return (
        <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/login-bg.jpg')" }}>
            <div style={{ transform: 'translateY(-10vh)' }} className="w-full max-w-sm flex flex-col items-center">
                <div className="mb-8 flex flex-col items-center gap-3" style={{ transform: 'translateY(8vh)' }}>
                    <img src="/logo_login_new.png" alt="iStore" className="h-[357px] object-contain" />
                </div>
                <div className="w-full bg-white/80 backdrop-blur-lg p-8 rounded-2xl shadow-xl border border-white/50">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;
