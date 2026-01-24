import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CameraIcon, CheckIcon, ArrowPathRoundedSquareIcon, Cog6ToothIcon } from './icons.tsx';
import { SpinnerIcon } from './icons.tsx';

interface CameraModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (imageData: string) => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [showSettings, setShowSettings] = useState(false);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
            });
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    const fetchDevices = useCallback(async () => {
        try {
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
            setDevices(videoDevices);

            // If we have a stream, we can try to guess which device is active or just rely on what we have.
            // But we mainly need this list to populate the selector.
        } catch (e) {
            console.warn("Failed to enumerate devices", e);
        }
    }, []);

    const startCamera = useCallback(async (deviceId?: string) => {
        stopCamera();
        setLoading(true);
        setError(null);
        setCapturedImage(null);

        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                // Ensure we wait a tick to allow previous tracks to fully stop
                await new Promise(resolve => setTimeout(resolve, 100));

                const mobileConstraints: MediaTrackConstraints = {
                    facingMode: { ideal: 'environment' }
                };

                const desktopConstraints: MediaTrackConstraints = deviceId
                    ? { deviceId: { exact: deviceId } }
                    : { facingMode: 'user' }; // fallback for desktop initial if no ID

                // If deviceId is provided, use it. 
                // If not, and we are on mobile (heuristic), prefer environment.
                // If not mobile/unknown, try environment first anyway as requested "Mobile -> Rear", "Desktop -> Selectable (default whatever)"

                // Better approach:
                // If explicit deviceId, use it.
                // If no deviceId, try 'environment' (rear) preference.
                const constraints = {
                    video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }
                };

                console.log('Requesting camera with constraints:', constraints);
                const streamData = await navigator.mediaDevices.getUserMedia(constraints);

                streamRef.current = streamData;

                // Get the active track settings to update selectedDeviceId if it wasn't explicit
                const track = streamData.getVideoTracks()[0];
                const settings = track.getSettings();
                if (settings.deviceId && !deviceId) {
                    setSelectedDeviceId(settings.deviceId);
                }

                if (videoRef.current) {
                    videoRef.current.srcObject = streamData;
                }

                // Once permission is granted and stream started, we can enumerate arrays with labels
                fetchDevices();

            } else {
                setError('A câmera não é suportada neste navegador.');
            }
        } catch (err: any) {
            console.error('Erro ao acessar camera:', err);
            // Handle specific errors
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setError('Permissão da câmera negada. Habilite nas configurações do navegador.');
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setError('Nenhuma câmera encontrada.');
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                setError('A câmera está sendo usada por outro aplicativo.');
            } else {
                setError('Erro ao acessar a câmera. Tente recarregar a página.');
            }
        } finally {
            setLoading(false);
        }
    }, [stopCamera, fetchDevices]);

    useEffect(() => {
        if (isOpen) {
            startCamera(selectedDeviceId);
        } else {
            stopCamera();
        }

        return () => {
            stopCamera();
        };
    }, [isOpen]);
    // Dependencies note: we intentionally don't include startCamera here to avoid loops. 
    // But if selectedDeviceId changes, we might want to restart? 
    // A separate effect handles device change.

    const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newId = e.target.value;
        setSelectedDeviceId(newId);
        startCamera(newId);
    };

    // Ensure video is attached if ref becomes available later (rare but possible)
    useEffect(() => {
        if (isOpen && !loading && !capturedImage && videoRef.current && streamRef.current && !videoRef.current.srcObject) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [isOpen, loading, capturedImage]);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;

            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                // Limit max dimension to 1200px (better quality)
                const MAX_DIMENSION = 1200;
                let width = video.videoWidth;
                let height = video.videoHeight;

                if (width > height) {
                    if (width > MAX_DIMENSION) {
                        height *= MAX_DIMENSION / width;
                        width = MAX_DIMENSION;
                    }
                } else {
                    if (height > MAX_DIMENSION) {
                        width *= MAX_DIMENSION / height;
                        height = MAX_DIMENSION;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const context = canvas.getContext('2d');
                if (context) {
                    // Flip if using front camera (user facing) usually mirrored, but for ID photos maybe we don't want mirror?
                    // Standard camera apps don't usually mirror the final output of rear camera.
                    context.drawImage(video, 0, 0, width, height);

                    // Use JPEG with 0.8 quality
                    const imageData = canvas.toDataURL('image/jpeg', 0.8);
                    setCapturedImage(imageData);
                    stopCamera(); // Stop stream to save resources/battery
                }
            }
        }
    };

    const handleRetake = () => {
        startCamera(selectedDeviceId);
    };

    const handleUsePhoto = () => {
        if (capturedImage) {
            onCapture(capturedImage);
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[80] p-4" onClick={onClose}>
            <div className="bg-surface rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-surface rounded-t-2xl">
                    <h3 className="text-lg font-bold text-primary">Tirar foto</h3>
                    {devices.length > 1 && (
                        <select
                            value={selectedDeviceId}
                            onChange={handleDeviceChange}
                            className="text-xs max-w-[150px] p-1 border rounded bg-white text-black"
                        >
                            {devices.map((device, idx) => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Câmera ${idx + 1}`}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center min-h-[300px] sm:min-h-[400px]">
                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 p-6">
                            <div className="text-center text-white p-4 bg-red-500/20 border border-red-500 rounded-xl backdrop-blur-sm">
                                <p className="font-bold">{error}</p>
                            </div>
                        </div>
                    )}

                    {loading && !error && (
                        <div className="absolute inset-0 flex items-center justify-center z-20">
                            <SpinnerIcon className="w-10 h-10 text-white animate-spin" />
                        </div>
                    )}

                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${capturedImage ? 'hidden' : 'block'}`}
                    ></video>

                    <canvas ref={canvasRef} className="hidden"></canvas>

                    {capturedImage && (
                        <img src={capturedImage} alt="Captured" className="w-full h-full object-contain bg-black" />
                    )}
                </div>

                <div className="p-4 flex justify-center items-center gap-4 bg-surface rounded-b-2xl border-t">
                    {!capturedImage ? (
                        <button
                            onClick={handleCapture}
                            disabled={loading || !!error}
                            className="p-5 bg-primary text-white rounded-full disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-primary-dark hover:scale-105 transition-all shadow-xl ring-4 ring-primary/20"
                            aria-label="Tirar foto"
                        >
                            <CameraIcon className="h-8 w-8" />
                        </button>
                    ) : (
                        <div className="flex gap-3 w-full">
                            <button onClick={handleRetake} className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                                <ArrowPathRoundedSquareIcon className="h-5 w-5" /> Tentar Novamente
                            </button>
                            <button onClick={handleUsePhoto} className="flex-1 py-3 px-4 bg-success text-white font-bold rounded-xl hover:bg-success-dark transition-colors flex items-center justify-center gap-2 shadow-lg shadow-success/20">
                                <CheckIcon className="h-5 w-5" /> Usar Foto
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CameraModal;