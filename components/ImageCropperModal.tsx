import React, { useState, useRef, useEffect, TouchEvent, MouseEvent } from 'react';
import ReactDOM from 'react-dom';
import Button from './Button.tsx';
import { CheckIcon, CloseIcon, SearchIcon } from './icons.tsx';

// If Button.js doesn't exist, I'll fallback to HTML button
// I saw Button.tsx in previous tool outputs

interface ImageCropperModalProps {
    isOpen: boolean;
    imageUrl: string | null;
    aspectRatio?: number; // width / height, default 1
    onClose: () => void;
    onCrop: (croppedBase64: string) => void;
}

const ImageCropperModal: React.FC<ImageCropperModalProps> = ({ isOpen, imageUrl, aspectRatio = 1, onClose, onCrop }) => {
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    // Crop box size in visual pixels
    const cropSize = 280;
    const cropWidth = cropSize * aspectRatio;
    const cropHeight = cropSize;

    useEffect(() => {
        if (isOpen) {
            setZoom(1);
            setOffset({ x: 0, y: 0 });
        }
    }, [isOpen, imageUrl]);

    if (!isOpen || !imageUrl) return null;

    const handleMouseDown = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        setDragging(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as any).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as any).clientY;
        setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
    };

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
        if (!dragging) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as any).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as any).clientY;
        setOffset({ x: clientX - dragStart.x, y: clientY - dragStart.y });
    };

    const handleMouseUp = () => {
        setDragging(false);
    };

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        setImgSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight });
    };

    const handleCrop = () => {
        const canvas = document.createElement('canvas');
        // Render to target 400px width (lightweight)
        const targetWidth = 400;
        const scale = targetWidth / cropWidth;

        canvas.width = targetWidth;
        canvas.height = cropHeight * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Math:
        // Visible Center = Container Center
        // Image rendered at: Center + Offset
        // Crop Box is at Center.
        // We need source rect from image.

        // Image displayed pos (top-left) relative to center:
        // x = offset.x - (imgWidth * zoom) / 2
        // y = offset.y - (imgHeight * zoom) / 2

        // Crop box pos (top-left) relative to center:
        // x = -cropWidth / 2
        // y = -cropHeight / 2

        // Delta (Vector from Image TopLeft to Crop TopLeft) in visual pixels:
        // dx = (-cropWidth/2) - (offset.x - (imgWidth * zoom)/2)
        //    = (imgWidth * zoom / 2) - cropWidth/2 - offset.x

        // Map delta to source image pixels (divide by zoom):
        // sourceX = dx / zoom

        if (imgSize.width === 0) return;

        const sourceX = (imgSize.width / 2) - (cropWidth / (2 * zoom)) - (offset.x / zoom);
        const sourceY = (imgSize.height / 2) - (cropHeight / (2 * zoom)) - (offset.y / zoom);

        const sourceW = cropWidth / zoom;
        const sourceH = cropHeight / zoom;

        // Draw
        ctx.drawImage(
            imgRef.current!,
            sourceX, sourceY, sourceW, sourceH,
            0, 0, canvas.width, canvas.height
        );

        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        onCrop(base64);
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">Ajustar Imagem</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-600">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="relative w-full h-[400px] bg-gray-900 overflow-hidden cursor-move touch-none flex items-center justify-center"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleMouseDown}
                    onTouchMove={handleMouseMove}
                    onTouchEnd={handleMouseUp}
                >
                    {/* Helper text */}
                    <div className="absolute top-4 left-0 right-0 text-center pointer-events-none z-10">
                        <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full backdrop-blur-md shadow-sm">
                            Arraste e Zoom para ajustar
                        </span>
                    </div>

                    <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
                        <img
                            ref={imgRef}
                            src={imageUrl}
                            alt="Crop target"
                            onLoad={onImageLoad}
                            style={{
                                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                                transition: dragging ? 'none' : 'transform 0.1s ease-out'
                            }}
                            className="max-w-none select-none pointer-events-auto"
                            draggable={false}
                        />
                    </div>

                    {/* Overlay - Darken everything outside crop box */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0 bg-black/60 opacity-50"></div>
                        {/* Crop Hole */}
                        <div
                            style={{
                                width: cropWidth,
                                height: cropHeight,
                                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                                borderRadius: aspectRatio === 1 ? '50%' : '8px' // Circle for logos
                            }}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-white/80 z-10"
                        ></div>
                        {/* Grid Lines (Optional) */}
                        <div
                            style={{ width: cropWidth, height: cropHeight }}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 opacity-30"
                        >
                            <div className="w-full h-1/3 border-b border-white absolute top-0"></div>
                            <div className="w-full h-1/3 border-b border-white absolute top-1/3"></div>
                            <div className="h-full w-1/3 border-r border-white absolute left-0"></div>
                            <div className="h-full w-1/3 border-r border-white absolute left-1/3"></div>
                        </div>
                    </div>
                </div>

                <div className="p-4 space-y-4 bg-white">
                    <div className="flex items-center gap-4">
                        <SearchIcon className="w-5 h-5 text-gray-400" />
                        <input
                            type="range"
                            min="0.1"
                            max="3"
                            step="0.01"
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <span className="text-xs font-mono w-12 text-right">{(zoom * 100).toFixed(0)}%</span>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleCrop}
                            className="flex-1 py-2.5 px-4 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-lg flex items-center justify-center gap-2"
                        >
                            <CheckIcon className="w-5 h-5" />
                            Salvar Foto
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ImageCropperModal;
