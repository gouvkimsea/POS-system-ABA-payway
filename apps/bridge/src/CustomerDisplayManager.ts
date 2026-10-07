import { CustomerDisplayState } from '@pos/types';

export class CustomerDisplayManager {
  private static instance: CustomerDisplayManager;
  private currentState: CustomerDisplayState = {
    status: 'IDLE',
    timestamp: new Date().toISOString(),
  };

  private constructor() {}

  public static getInstance(): CustomerDisplayManager {
    if (!CustomerDisplayManager.instance) {
      CustomerDisplayManager.instance = new CustomerDisplayManager();
    }
    return CustomerDisplayManager.instance;
  }

  public getState(): CustomerDisplayState {
    return this.currentState;
  }

  public updateState(newState: Partial<CustomerDisplayState>): CustomerDisplayState {
    this.currentState = {
      ...this.currentState,
      ...newState,
      timestamp: new Date().toISOString(),
    };
    return this.currentState;
  }

  /**
   * Generates VFD 2x20 ESC/POS line display control sequence
   */
  public generateVfdCommand(line1: string, line2: string): Buffer {
    const l1 = line1.substring(0, 20).padEnd(20, ' ');
    const l2 = line2.substring(0, 20).padEnd(20, ' ');

    // 0x0C (Clear screen), 0x1B 0x5B 0x48 (Home cursor)
    const commands: number[] = [0x0c, 0x1b, 0x5b, 0x48];

    // Append Line 1
    const bytes1 = Buffer.from(l1, 'ascii');
    for (const b of bytes1) commands.push(b);

    // Line 2 (Move to line 2 cursor)
    commands.push(0x1f, 0x42); // Down to line 2
    const bytes2 = Buffer.from(l2, 'ascii');
    for (const b of bytes2) commands.push(b);

    return Buffer.from(commands);
  }
}
