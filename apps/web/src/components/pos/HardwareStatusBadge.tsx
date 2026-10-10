'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Printer,
  Barcode,
  Tv,
  Settings,
  ChevronDown,
  Monitor,
  Volume2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { hardwareManager, HardwareStatusReport } from '../../lib/hardware/HardwareManager';
import { printerService } from '../../lib/hardware/PrinterService';
import { cashDrawerService } from '../../lib/hardware/CashDrawerService';
import { customerDisplayService } from '../../lib/hardware/CustomerDisplayService';

export const HardwareStatusBadge: React.FC = () => {
  const [report, setReport] = useState<HardwareStatusReport>(hardwareManager.getStatusReport());
  const [isOpen, setIsOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const unsubscribe = hardwareManager.subscribe((next) => {
      setReport(next);
    });
    return () => unsubscribe();
  }, []);

  const profile = hardwareManager.getProfile();
  const isBridgeLive = report.bridgeStatus === 'CONNECTED';

  const handleTestPrint = async () => {
    setIsTesting(true);
    setTestStatus('Printing test slip...');
    try {
      const res = await printerService.printTestSlip();
      setTestStatus(res.success ? '✓ Test print successful' : `Error: ${res.message}`);
    } catch (e: any) {
      setTestStatus(`Failed: ${e.message}`);
    } finally {
      setIsTesting(false);
      setTimeout(() => setTestStatus(''), 4000);
    }
  };

  const handleKickDrawer = async () => {
    setIsTesting(true);
    setTestStatus('Testing cash drawer...');
    try {
      const res = await cashDrawerService.openDrawer('Manual diagnostic test');
      setTestStatus(res.success ? '✓ Cash drawer opened' : `Error: ${res.message}`);
    } catch (e: any) {
      setTestStatus(`Failed: ${e.message}`);
    } finally {
      setIsTesting(false);
      setTimeout(() => setTestStatus(''), 4000);
    }
  };

  const handleLaunchCustomerDisplay = () => {
    customerDisplayService.openCustomerWindow();
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Status Pill in Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
          isBridgeLive
            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80 hover:bg-emerald-900/60'
            : 'bg-amber-950/60 text-amber-300 border-amber-800/80 hover:bg-amber-900/60'
        }`}
        title="Hardware status"
      >
        <span
          className={`w-2 h-2 rounded-full ${
            isBridgeLive ? 'bg-emerald-400' : 'bg-amber-400'
          }`}
        />
        <Printer className="w-3.5 h-3.5" />
        <span className="hidden lg:inline text-[11px] font-semibold">
          {isBridgeLive ? 'Hardware Bridge' : 'Browser Mode'}
        </span>
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>

      {/* Popover Diagnostic Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-slate-900 text-slate-200 rounded-lg shadow-lg border border-slate-700/80 p-3.5 z-50 text-xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <span className="font-bold text-slate-100 text-xs flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-emerald-400" />
                POS Hardware Status
              </span>
              <button
                onClick={() => hardwareManager.checkBridgeHealth()}
                className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1"
                title="Refresh hardware status"
              >
                <RefreshCw className="w-3 h-3" />
                Check
              </button>
            </div>

            {/* Quick Status Rows */}
            <div className="py-2.5 space-y-2">
              {/* Bridge Service */}
              <div className="flex items-center justify-between bg-slate-800/60 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="font-semibold text-slate-200">Device Bridge</div>
                    <div className="text-[10px] text-slate-400">
                      {profile.bridge.enabled ? profile.bridge.bridgeUrl : 'Disabled'}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isBridgeLive
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}
                >
                  {isBridgeLive ? 'Online (9123)' : 'Standalone Fallback'}
                </span>
              </div>

              {/* Receipt Printer */}
              <div className="flex items-center justify-between bg-slate-800/60 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="font-semibold text-slate-200 truncate max-w-[140px]">
                      {profile.printer.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {profile.printer.paperSize} • {profile.printer.driver}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-300 bg-slate-700/60 px-2 py-0.5 rounded">
                  {profile.printer.paperSize}
                </span>
              </div>

              {/* Barcode Scanner */}
              <div className="flex items-center justify-between bg-slate-800/60 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="font-semibold text-slate-200">Barcode Scanner</div>
                    <div className="text-[10px] text-slate-400">
                      {profile.scanner.mode === 'KEYBOARD_WEDGE'
                        ? 'USB / BT Keyboard Wedge'
                        : profile.scanner.mode}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded">
                  Listening
                </span>
              </div>

              {/* Customer Display */}
              <div className="flex items-center justify-between bg-slate-800/60 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <Tv className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="font-semibold text-slate-200">Customer Display</div>
                    <div className="text-[10px] text-slate-400">
                      {profile.customerDisplay.driver}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLaunchCustomerDisplay}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5"
                >
                  Launch <ExternalLink className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            {testStatus && (
              <div className="mb-2 p-2 bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-[11px] rounded-lg text-center">
                {testStatus}
              </div>
            )}

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800">
              <button
                onClick={handleTestPrint}
                disabled={isTesting}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <Printer className="w-3 h-3 text-emerald-400" />
                Test Print
              </button>
              <button
                onClick={handleKickDrawer}
                disabled={isTesting}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <Volume2 className="w-3 h-3 text-amber-400" />
                Test Drawer
              </button>
            </div>

            {/* Navigation link to full settings */}
            <div className="mt-2.5 pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Fallback active</span>
              <Link
                href="/settings/hardware"
                onClick={() => setIsOpen(false)}
                className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
              >
                Configure <Settings className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
