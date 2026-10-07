'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, RefreshCw } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { playBeep } from '../lib/hardware';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcode: string) => void;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
      return;
    }

    const startScanner = async () => {
      try {
        setError(null);
        setScanning(true);
        const scanner = new Html5Qrcode('camera-reader-element');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' }, // Prioritize back camera for barcode scanning
          {
            fps: 15,
            qrbox: { width: 280, height: 160 },
          },
          (decodedText) => {
            playBeep('scan');
            onScanSuccess(decodedText);
            scanner.stop().then(() => onClose()).catch(() => onClose());
          },
          () => {
            // scan failure per frame - normal while looking for barcode
          }
        );
      } catch (err: any) {
        setError(err?.message || 'Failed to access camera device');
        setScanning(false);
      }
    };

    const timer = setTimeout(startScanner, 200);
    return () => {
      clearTimeout(timer);
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in duration-150">
        <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm">Camera Barcode Scanner</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-slate-950 flex flex-col items-center justify-center min-h-[320px]">
          {error ? (
            <div className="text-center p-4">
              <p className="text-red-400 text-xs font-semibold mb-2">{error}</p>
              <p className="text-slate-400 text-xs">
                Make sure camera permissions are enabled in your browser settings.
              </p>
            </div>
          ) : (
            <div className="w-full relative">
              <div id="camera-reader-element" className="w-full rounded-xl overflow-hidden"></div>
              <div className="text-center mt-3 text-xs text-slate-400 flex items-center justify-center space-x-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                <span>Align barcode or QR code in frame...</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
