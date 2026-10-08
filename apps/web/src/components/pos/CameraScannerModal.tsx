'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  Flashlight,
  RefreshCw,
  Barcode as BarcodeIcon,
  AlertCircle,
} from 'lucide-react';
import { scannerService } from '../../lib/hardware/ScannerService';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeDetected: (barcode: string) => void;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onBarcodeDetected,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setErrorMessage('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage('Camera access is not supported by your browser or environment.');
        setHasCameraPermission(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setHasCameraPermission(true);

      // Check for torch capability
      const track = stream.getVideoTracks()[0];
      const capabilities: any = track?.getCapabilities ? track.getCapabilities() : {};
      if (capabilities && 'torch' in capabilities) {
        setHasTorch(true);
      }

      startDetectionLoop();
    } catch (err: any) {
      console.warn('[CameraScanner] Camera error:', err);
      setHasCameraPermission(false);
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access in your browser settings.'
          : `Unable to access camera: ${err.message || 'Device in use or not found'}`,
      );
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: next }],
      });
      setIsTorchOn(next);
    } catch (e) {
      console.warn('[CameraScanner] Failed to toggle torch', e);
    }
  };

  const startDetectionLoop = () => {
    const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

    // Detection interval
    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      if (hasBarcodeDetector) {
        try {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
          });
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            handleFound(code);
            return;
          }
        } catch {
          // Ignore detection frames
        }
      }
    }, 250);
  };

  const handleFound = (code: string) => {
    scannerService.handleBarcode(code);
    onBarcodeDetected(code);
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleFound(manualInput.trim());
      setManualInput('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Camera Barcode Scanner</h3>
              <p className="text-[11px] text-slate-400">Aim camera at product barcode</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="relative bg-black flex-1 min-h-[300px] flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover max-h-[360px]"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Aiming Reticle Overlay */}
          {hasCameraPermission && !errorMessage && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
              <div className="relative w-64 h-40 rounded-xl border-2 border-indigo-500/80 shadow-[0_0_20px_rgba(99,102,241,0.3)] flex items-center justify-center">
                {/* Corner indicators */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-indigo-400 rounded-tl" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-indigo-400 rounded-tr" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-indigo-400 rounded-bl" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-indigo-400 rounded-br" />

                {/* Animated Scanning Laser Line */}
                <div className="w-full h-0.5 bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-pulse" />
              </div>
            </div>
          )}

          {/* Flashlight toggle */}
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`absolute top-3 right-3 p-2.5 rounded-full backdrop-blur-md transition-colors ${
                isTorchOn
                  ? 'bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/30'
                  : 'bg-slate-900/70 text-white hover:bg-slate-800'
              }`}
              title="Toggle Flashlight"
            >
              <Flashlight className="w-4 h-4" />
            </button>
          )}

          {/* Camera Permission / Error Fallback */}
          {errorMessage && (
            <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center text-slate-300">
              <AlertCircle className="w-10 h-10 text-amber-400 mb-3" />
              <h4 className="font-bold text-white text-sm mb-1">Camera Unavailable</h4>
              <p className="text-xs text-slate-400 max-w-xs mb-4">{errorMessage}</p>
              <button
                onClick={startCamera}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Camera
              </button>
            </div>
          )}
        </div>

        {/* Footer with Manual Input fallback */}
        <div className="p-3.5 bg-slate-900 border-t border-slate-800">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <BarcodeIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Or type/paste barcode here..."
                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Add
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
