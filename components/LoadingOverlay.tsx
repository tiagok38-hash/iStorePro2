import React, { useEffect, useState } from 'react';
import { SpinnerIcon } from './icons';

interface LoadingOverlayProps {
    isVisible: boolean;
    message: string;
    type?: 'backup' | 'restore' | 'default';
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, message, type = 'default' }) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (isVisible) {
            setProgress(0);
            const interval = setInterval(() => {
                setProgress(prev => {
                    // Fast at first, then slower as it reaches 90%
                    if (prev >= 90) return prev;
                    const increment = Math.max(1, (90 - prev) / 10);
                    return Math.min(90, prev + increment);
                });
            }, 100);
            return () => clearInterval(interval);
        } else {
            setProgress(100);
        }
    }, [isVisible]);

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center space-y-6 animate-in zoom-in-95 duration-200">
                {/* Icon Animation Container */}
                <div className="relative">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${type === 'restore' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'} mb-2`}>
                        {/* We use a spinner here but we could use a custom SVG animation too */}
                        <SpinnerIcon className="w-8 h-8 animate-spin" />
                    </div>
                </div>

                <div className="text-center space-y-2">
                    <h3 className="text-lg font-bold text-gray-900">{message}</h3>
                    <p className="text-sm text-gray-500">Por favor, aguarde enquanto processamos.</p>
                </div>

                {/* Progress Bar Container */}
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ease-out ${type === 'restore' ? 'bg-orange-500' : 'bg-blue-600'}`}
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};

export default LoadingOverlay;
