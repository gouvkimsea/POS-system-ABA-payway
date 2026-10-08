'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Printer,
  Barcode,
  Tv,
  Coins,
  Cpu,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Save,
  RotateCcw,
  ExternalLink,
  Volume2,
  Eye,
  Zap,
  X,
} from 'lucide-react';
import { hardwareManager, HardwareStatusReport } from '../../../lib/hardware/HardwareManager';
import { printerService } from '../../../lib/hardware/PrinterService';
import { scannerService } from '../../../lib/hardware/ScannerService';
import { cashDrawerService } from '../../../lib/hardware/CashDrawerService';
import { customerDisplayService } from '../../../lib/hardware/CustomerDisplayService';
import { HardwareSettingsProfile } from '@pos/types';

export default function HardwareSettingsPage() {
  const [profile, setProfile] = useState<HardwareSettingsProfile>(hardwareManager.getProfile());
  const [report, setReport] = useState<HardwareStatusReport>(hardwareManager.getStatusReport());
  const [activeTab, setActiveTab] = useState<
    'bridge' | 'printer' | 'scanner' | 'drawer' | 'display'
  >('printer');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [testLog, setTestLog] = useState<string>('');
  const [scannedTestHistory, setScannedTestHistory] = useState<
    Array<{ code: string; time: string }>
  >([]);
  const [isTesting, setIsTesting] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    const unsub = hardwareManager.subscribe((next) => {
      setReport(next);
    });
    return () => unsub();
  }, []);

  // Subscribe to barcode scanner test listener
  useEffect(() => {
    const unsub = scannerService.onBarcode((code) => {
      setScannedTestHistory((prev) => [
        { code, time: new Date().toLocaleTimeString() },
        ...prev.slice(0, 9),
      ]);
      setTestLog(`Scanned barcode: ${code} (${code.length} chars)`);
    });
    return () => unsub();
  }, []);

  const isBridgeConnected = report.bridgeStatus === 'CONNECTED';

  const handleSave = async () => {
    setIsSaving(true);
    try {
      hardwareManager.updateProfile(profile);

      // Attempt to sync to backend device API
      try {
        const token = localStorage.getItem('pos_token');
        if (token) {
          await fetch(`/api/devices/${profile.terminalId}/hardware-config`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ hardwareConfig: profile }),
          });
        }
      } catch {
        // Local persistence takes priority
      }

      setSaveMessage('Hardware configuration saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset hardware configuration to factory defaults?')) {
      const reset = hardwareManager.resetToDefaults();
      setProfile(reset);
      setSaveMessage('Reset to factory defaults.');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    setTestLog('Dispatching test slip...');
    try {
      const res = await printerService.printTestSlip();
      setTestLog(res.success ? `✓ Test Print OK: ${res.message}` : `✗ Print Error: ${res.message}`);
    } catch (e: any) {
      setTestLog(`Print Failed: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleKickDrawer = async () => {
    setIsTesting(true);
    setTestLog('Triggering drawer kick...');
    try {
      const res = await cashDrawerService.openDrawer('Settings page test');
      setTestLog(
        res.success ? `✓ Cash Drawer OK: ${res.message}` : `✗ Drawer Error: ${res.message}`,
      );
    } catch (e: any) {
      setTestLog(`Drawer Failed: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleLaunchCustomerDisplay = () => {
    customerDisplayService.openCustomerWindow();
    customerDisplayService.updateCart(2, 5.5, 0.55, 6.05, 24805, {
      name: 'Sample Product Test',
      quantity: 1,
      priceUSD: 5.5,
      totalUSD: 5.5,
    });
    setTestLog('✓ Customer Display window opened with test cart payload.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none">
      {/* Top Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 sm:px-8 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <Link
            href="/pos"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Return to POS"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-400" />
              Hardware Integration & Device Settings
            </h1>
            <p className="text-xs text-slate-400">
              Configure POS peripherals, thermal printers, scanners & bridge
            </p>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </header>

      {/* Save Notification Toast */}
      {saveMessage && (
        <div className="bg-emerald-600 text-white text-xs font-bold py-2 px-4 text-center animate-in slide-in-from-top flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {saveMessage}
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 pb-24 lg:pb-8 flex flex-col lg:flex-row gap-6">
        {/* Left Navigation Tabs */}
        <div className="lg:w-64 shrink-0 space-y-1.5">
          <button
            onClick={() => setActiveTab('printer')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'printer'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900/60 text-slate-300 hover:bg-slate-850 hover:text-white border border-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Printer className="w-4 h-4" />
              <span>Receipt Printer</span>
            </div>
            <span className="text-[10px] font-mono opacity-80">{profile.printer.paperSize}</span>
          </button>

          <button
            onClick={() => setActiveTab('scanner')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'scanner'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900/60 text-slate-300 hover:bg-slate-850 hover:text-white border border-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Barcode className="w-4 h-4" />
              <span>Barcode Scanner</span>
            </div>
            <span className="text-[10px] font-mono opacity-80">HID / Camera</span>
          </button>

          <button
            onClick={() => setActiveTab('drawer')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'drawer'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900/60 text-slate-300 hover:bg-slate-850 hover:text-white border border-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Coins className="w-4 h-4" />
              <span>Cash Drawer</span>
            </div>
            <span className="text-[10px] font-mono opacity-80">
              Pin {profile.cashDrawer.kickPin}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('display')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'display'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900/60 text-slate-300 hover:bg-slate-850 hover:text-white border border-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Tv className="w-4 h-4" />
              <span>Customer Display</span>
            </div>
            <span className="text-[10px] font-mono opacity-80">Dual Screen</span>
          </button>

          <button
            onClick={() => setActiveTab('bridge')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'bridge'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900/60 text-slate-300 hover:bg-slate-850 hover:text-white border border-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Cpu className="w-4 h-4" />
              <span>Device Bridge</span>
            </div>
            <span
              className={`w-2 h-2 rounded-full ${
                isBridgeConnected ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          </button>

          {/* Quick Hardware Diagnostic Card */}
          <div className="mt-6 p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2.5">
            <div className="font-bold text-slate-300 flex items-center justify-between">
              <span>Bridge Status</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isBridgeConnected
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}
              >
                {isBridgeConnected ? 'Connected' : 'Fallback Active'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              If the local companion service is offline, the POS safely falls back to browser
              printing, keyboard wedge scanning, and chime alerts without disruption.
            </p>
          </div>
        </div>

        {/* Right Active Tab Content */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
          <div>
            {/* TAB 1: RECEIPT PRINTER */}
            {activeTab === 'printer' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Printer className="w-5 h-5 text-indigo-400" />
                      Thermal Receipt Printer Configuration
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Support for ESC/POS USB, Serial, Network TCP (Port 9100), and Browser Print
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPreviewModal(true)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>
                    <button
                      onClick={handleTestPrint}
                      disabled={isTesting}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      {isTesting ? 'Testing...' : 'Test Print'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Driver Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Printer Driver Architecture
                    </label>
                    <select
                      value={profile.printer.driver}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          printer: { ...profile.printer, driver: e.target.value as any },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="LOCAL_BRIDGE">
                        Local Device Bridge (Recommended ESC/POS)
                      </option>
                      <option value="NETWORK_TCP">
                        Network Thermal Printer (Raw TCP Port 9100)
                      </option>
                      <option value="BROWSER_FALLBACK">
                        Browser Print Fallback (HTML5 Dialog)
                      </option>
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {profile.printer.driver === 'BROWSER_FALLBACK'
                        ? 'Uses the browser print dialog with custom thermal layout.'
                        : 'Transmits binary ESC/POS commands directly to thermal roll printer.'}
                    </p>
                  </div>

                  {/* Paper Size Configuration (58mm vs 80mm) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Roll Paper Width
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setProfile({
                            ...profile,
                            printer: { ...profile.printer, paperSize: '58mm' },
                          })
                        }
                        className={`p-3 rounded-xl border text-center transition-all ${
                          profile.printer.paperSize === '58mm'
                            ? 'bg-indigo-600/20 border-indigo-500 text-white font-bold'
                            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-sm font-bold">58 mm</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          32 Characters / Line
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setProfile({
                            ...profile,
                            printer: { ...profile.printer, paperSize: '80mm' },
                          })
                        }
                        className={`p-3 rounded-xl border text-center transition-all ${
                          profile.printer.paperSize === '80mm'
                            ? 'bg-indigo-600/20 border-indigo-500 text-white font-bold'
                            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-sm font-bold">80 mm</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          48 Characters / Line
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Printer Target / Spooler Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Printer Spooler / Device Name
                    </label>
                    <input
                      type="text"
                      value={profile.printer.name}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          printer: { ...profile.printer, name: e.target.value },
                        })
                      }
                      placeholder="e.g. POS-80C Thermal Printer"
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>

                  {/* Network TCP Host & Port */}
                  {profile.printer.driver === 'NETWORK_TCP' && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Network Printer IP
                        </label>
                        <input
                          type="text"
                          value={profile.printer.networkIp || '192.168.1.200'}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              printer: { ...profile.printer, networkIp: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Port
                        </label>
                        <input
                          type="number"
                          value={profile.printer.networkPort || 9100}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              printer: {
                                ...profile.printer,
                                networkPort: parseInt(e.target.value, 10) || 9100,
                              },
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* Options: Auto-Cut & Auto-Drawer */}
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-300">
                      Automation Settings
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profile.printer.autoCut}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            printer: { ...profile.printer, autoCut: e.target.checked },
                          })
                        }
                        className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-300">
                        Auto-cut paper at end of receipt
                      </span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profile.printer.autoOpenDrawer}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            printer: { ...profile.printer, autoOpenDrawer: e.target.checked },
                          })
                        }
                        className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-300">
                        Trigger cash drawer pulse on Cash checkout
                      </span>
                    </label>
                  </div>

                  {/* Receipt Header & Footer Custom Text */}
                  <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Receipt Header Banner
                      </label>
                      <input
                        type="text"
                        value={profile.printer.headerText || ''}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            printer: { ...profile.printer, headerText: e.target.value },
                          })
                        }
                        placeholder="Store name & branch"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Receipt Footer Message
                      </label>
                      <input
                        type="text"
                        value={profile.printer.footerText || ''}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            printer: { ...profile.printer, footerText: e.target.value },
                          })
                        }
                        placeholder="e.g. Thank you for your visit!"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: BARCODE SCANNER */}
            {activeTab === 'scanner' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="pb-4 border-b border-slate-800">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Barcode className="w-5 h-5 text-indigo-400" />
                    Barcode Scanner Integration
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Supports USB Barcode Scanners, Bluetooth Handhelds, and Camera Scanner
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Scanner Operating Mode
                    </label>
                    <select
                      value={profile.scanner.mode}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          scanner: { ...profile.scanner, mode: e.target.value as any },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="KEYBOARD_WEDGE">
                        USB / Bluetooth HID Keyboard Wedge (Zero-Driver)
                      </option>
                      <option value="CAMERA">Built-in Camera Scanner (Webcam/Mobile)</option>
                      <option value="LOCAL_BRIDGE">Local Device Bridge Serial/COM Port</option>
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Standard handheld barcode scanners output keystrokes automatically without
                      special drivers.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Keystroke Burst Velocity Threshold (ms)
                    </label>
                    <input
                      type="number"
                      min={20}
                      max={150}
                      value={profile.scanner.interKeyTimeoutMs}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          scanner: {
                            ...profile.scanner,
                            interKeyTimeoutMs: parseInt(e.target.value, 10) || 50,
                          },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Distinguishes automated laser scanner bursts (&lt; 50ms) from manual human
                      typing.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-300">
                      Feedback Alerts
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profile.scanner.soundBeepOnScan}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            scanner: { ...profile.scanner, soundBeepOnScan: e.target.checked },
                          })
                        }
                        className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-300">
                        Play audio beep sound upon scan
                      </span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profile.scanner.vibrateOnScan}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            scanner: { ...profile.scanner, vibrateOnScan: e.target.checked },
                          })
                        }
                        className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-300">
                        Haptic vibration (mobile & tablets)
                      </span>
                    </label>
                  </div>

                  {/* Interactive Live Scanner Debugger */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        Live Scanner Input Test
                      </span>
                      <button
                        onClick={() => scannerService.playBeepSound()}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                      >
                        <Volume2 className="w-3 h-3" /> Test Beep
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 mb-3">
                      Pull your USB or Bluetooth barcode scanner trigger now to verify instant
                      detection:
                    </p>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto font-mono text-[11px]">
                      {scannedTestHistory.length === 0 ? (
                        <div className="text-slate-600 italic py-3 text-center">
                          Awaiting scanner input...
                        </div>
                      ) : (
                        scannedTestHistory.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 flex justify-between items-center text-emerald-400"
                          >
                            <span>✓ {item.code}</span>
                            <span className="text-slate-500 text-[10px]">{item.time}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CASH DRAWER */}
            {activeTab === 'drawer' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Coins className="w-5 h-5 text-indigo-400" />
                      Cash Drawer Configuration
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Standard RJ11/RJ12 drawer pulse kick via thermal printer or direct relay
                    </p>
                  </div>

                  <button
                    onClick={handleKickDrawer}
                    disabled={isTesting}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    {isTesting ? 'Kicking...' : 'Test Kick Drawer'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Drawer Trigger Mechanism
                    </label>
                    <select
                      value={profile.cashDrawer.driver}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          cashDrawer: { ...profile.cashDrawer, driver: e.target.value as any },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="PRINTER_KICK">
                        Printer RJ11 Kick (Standard Thermal Drawer Port)
                      </option>
                      <option value="LOCAL_BRIDGE_DIRECT">Local Bridge Direct Relay Pulse</option>
                      <option value="MANUAL_FALLBACK">Manual Drawer (No Hardware Connected)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Drawer Kick Pulse Pin
                    </label>
                    <select
                      value={profile.cashDrawer.kickPin}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          cashDrawer: {
                            ...profile.cashDrawer,
                            kickPin: parseInt(e.target.value, 10) as 2 | 5,
                          },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    >
                      <option value="2">Pin 2 (Standard Epson ESC/POS Compatible)</option>
                      <option value="5">Pin 5 (Star / Citizen / Citizen Alternative)</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-300">
                      Drawer Behavior
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profile.cashDrawer.autoOpenOnCashPayment}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            cashDrawer: {
                              ...profile.cashDrawer,
                              autoOpenOnCashPayment: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-300">
                        Automatically pop drawer on Cash checkout completion
                      </span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profile.cashDrawer.soundChirp}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            cashDrawer: { ...profile.cashDrawer, soundChirp: e.target.checked },
                          })
                        }
                        className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-300">
                        Play mechanical cash register bell chime
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CUSTOMER DISPLAY */}
            {activeTab === 'display' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Tv className="w-5 h-5 text-indigo-400" />
                      Customer Facing Display Configuration
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Dual-screen customer display, secondary monitor, or VFD 2x20 pole display
                    </p>
                  </div>

                  <button
                    onClick={handleLaunchCustomerDisplay}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Launch Customer Screen
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Display Output Mode
                    </label>
                    <select
                      value={profile.customerDisplay.driver}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          customerDisplay: {
                            ...profile.customerDisplay,
                            driver: e.target.value as any,
                          },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="SECONDARY_WINDOW">
                        Secondary Screen / Dual-Monitor Window (BroadcastChannel)
                      </option>
                      <option value="LOCAL_BRIDGE_VFD">Physical VFD 2x20 Line Pole Display</option>
                      <option value="DISABLED">Disabled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Idle Welcome Greeting (Line 1)
                    </label>
                    <input
                      type="text"
                      value={profile.customerDisplay.idleLine1}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          customerDisplay: {
                            ...profile.customerDisplay,
                            idleLine1: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: DEVICE BRIDGE */}
            {activeTab === 'bridge' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-indigo-400" />
                      Local Device Bridge (Companion Service)
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Cross-platform service allowing browsers to control raw USB, Serial, and TCP
                      printers
                    </p>
                  </div>

                  <button
                    onClick={() => hardwareManager.checkBridgeHealth()}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Ping Bridge
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Local Bridge Companion URL
                    </label>
                    <input
                      type="text"
                      value={profile.bridge.bridgeUrl}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          bridge: { ...profile.bridge, bridgeUrl: e.target.value },
                        })
                      }
                      placeholder="http://127.0.0.1:9123"
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Status & Latency
                    </label>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isBridgeConnected ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                        />
                        <span className="text-xs font-bold text-white">
                          {isBridgeConnected
                            ? 'Companion Bridge Active'
                            : 'Bridge Offline (Fallback Active)'}
                        </span>
                      </div>
                      {report.bridgeDetails?.latencyMs !== undefined && (
                        <span className="text-[11px] font-mono text-emerald-400 font-bold">
                          {report.bridgeDetails.latencyMs}ms
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Discovered Printers list from bridge */}
                {report.bridgeDetails?.discoveredPrinters && (
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <h4 className="text-xs font-bold text-slate-300 mb-2">
                      Detected Operating System Printers (
                      {report.bridgeDetails.discoveredPrinters.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      {report.bridgeDetails.discoveredPrinters.map((p, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between"
                        >
                          <div className="truncate mr-2">
                            <div className="font-semibold text-white truncate">{p.name}</div>
                            <div className="text-[10px] text-slate-500">{p.type}</div>
                          </div>
                          {p.isDefault && (
                            <span className="text-[9px] font-bold bg-indigo-950 text-indigo-400 px-1.5 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test Log Status Bar */}
          {testLog && (
            <div className="mt-6 p-3 bg-slate-950 rounded-xl border border-indigo-900/60 text-xs font-mono text-indigo-300 flex items-center justify-between">
              <span>{testLog}</span>
              <button
                onClick={() => setTestLog('')}
                className="text-slate-500 hover:text-white transition-colors"
                aria-label="Clear test log"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 58mm vs 80mm Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 text-slate-800 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm">Receipt Preview ({profile.printer.paperSize})</h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`font-mono text-[10px] p-3 bg-slate-50 border rounded-lg overflow-x-auto ${
                profile.printer.paperSize === '58mm' ? 'max-w-[240px] mx-auto' : 'w-full'
              }`}
            >
              <div className="text-center font-bold">ANGKOR FRESH MART</div>
              <div className="text-center text-[9px] text-slate-500">Monivong Central Branch</div>
              <div className="border-b border-dashed my-2" />
              <div className="flex justify-between">
                <span>Coca-Cola 330ml</span>
                <span>$0.75</span>
              </div>
              <div className="flex justify-between">
                <span>Angkor Beer Can</span>
                <span>$1.10</span>
              </div>
              <div className="border-b border-dashed my-2" />
              <div className="flex justify-between font-bold">
                <span>TOTAL USD:</span>
                <span>$1.85</span>
              </div>
              <div className="flex justify-between text-amber-600 font-bold">
                <span>TOTAL KHR:</span>
                <span>7,600 Riel</span>
              </div>
            </div>

            <button
              onClick={() => setShowPreviewModal(false)}
              className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
