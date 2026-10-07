import express, { Request, Response } from 'express';
import cors from 'cors';
import os from 'os';
import { PrintJob, CashDrawerConfig, CustomerDisplayState } from '@pos/types';
import { PrinterManager } from './PrinterManager.js';
import { DrawerManager } from './DrawerManager.js';
import { CustomerDisplayManager } from './CustomerDisplayManager.js';

const app = express();
const PORT = process.env.BRIDGE_PORT ? parseInt(process.env.BRIDGE_PORT, 10) : 9123;
const startTime = Date.now();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Bridge Health & Status
app.get('/health', async (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Enterprise POS Local Hardware Bridge',
    version: '1.0.0',
    platform: os.platform(),
    hostname: os.hostname(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

app.get('/status', async (_req: Request, res: Response) => {
  const printerManager = PrinterManager.getInstance();
  const printers = await printerManager.getAvailablePrinters();

  res.json({
    connected: true,
    version: '1.0.0',
    platform: os.platform(),
    hostname: os.hostname(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    discoveredPrinters: printers,
    discoveredPorts: os.platform() === 'win32' ? ['COM1', 'COM2', 'COM3'] : ['/dev/ttyUSB0', '/dev/ttyS0'],
    latencyMs: 1,
    lastCheckedAt: new Date().toISOString(),
  });
});

// List Printers
app.get('/printers', async (_req: Request, res: Response) => {
  try {
    const printers = await PrinterManager.getInstance().getAvailablePrinters();
    res.json({ success: true, printers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Execute Print Job
app.post('/print', async (req: Request, res: Response) => {
  try {
    const job: PrintJob = req.body;
    if (!job || !job.printer) {
      res.status(400).json({
        success: false,
        message: 'Invalid print job payload: printer configuration is required.',
      });
      return;
    }

    const result = await PrinterManager.getInstance().processPrintJob(job);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: `Print operation failed: ${err.message}`,
    });
  }
});

// Cash Drawer Trigger
app.post('/cash-drawer/open', async (req: Request, res: Response) => {
  try {
    const { config, printerName } = req.body as {
      config?: CashDrawerConfig;
      printerName?: string;
    };

    const effectiveConfig: CashDrawerConfig = config || {
      driver: 'PRINTER_KICK',
      kickPin: 2,
      pulseOnMs: 50,
      autoOpenOnCashPayment: true,
      soundChirp: true,
    };

    const result = await DrawerManager.getInstance().openCashDrawer(effectiveConfig, printerName);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: `Failed to trigger cash drawer: ${err.message}`,
    });
  }
});

// Customer Display Status & Sync
app.get('/customer-display/state', (_req: Request, res: Response) => {
  const state = CustomerDisplayManager.getInstance().getState();
  res.json({ success: true, state });
});

app.post('/customer-display/state', (req: Request, res: Response) => {
  try {
    const patch: Partial<CustomerDisplayState> = req.body;
    const updated = CustomerDisplayManager.getInstance().updateState(patch);
    res.json({ success: true, state: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export function startBridge(port: number = PORT) {
  return app.listen(port, () => {
    console.log(`[Local Device Bridge] Service listening on http://127.0.0.1:${port}`);
  });
}

// Auto-run if executed directly
if (process.argv[1]?.includes('src/index') || process.argv[1]?.includes('dist/index')) {
  startBridge(PORT);
}

export { app };
