import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout: React.FC = () => {
    return (
        <div className="min-h-screen relative flex flex-col justify-center items-center p-4 overflow-hidden bg-[#7B61FF]">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#9c89ff] via-[#8A7BD9] to-[#7B61FF]" />

            {/* Premium Decorative Blobs with GPU Acceleration */}
            <div
                className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-[#B6A9FF] rounded-full blur-[120px] opacity-40 animate-pulse"
                style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
            />
            <div
                className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-[#5B4B8A] rounded-full blur-[120px] opacity-30 animate-pulse"
                style={{ animationDelay: '2s', willChange: 'transform, opacity', transform: 'translateZ(0)' }}
            />
            <div
                className="absolute top-1/4 left-1/3 w-[30%] h-[30%] bg-white/10 rounded-full blur-[80px] opacity-20"
                style={{ transform: 'translateZ(0)' }}
            />

            <div style={{ transform: 'translateY(-10vh)' }} className="w-full max-w-sm flex flex-col items-center relative z-10">
                <div className="mb-8 flex flex-col items-center gap-3" style={{ transform: 'translateY(8vh)' }}>
                    <img src="/logo_login_new.png" alt="iStore" className="h-[357px] object-contain" />
                </div>
                <div className="w-full glass-card p-8 rounded-2xl shadow-2xl border border-white/20 backdrop-blur-xl">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;
