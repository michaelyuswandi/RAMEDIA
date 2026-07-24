// Abstract interface for sync providers
export interface SyncProvider {
  broadcast(channel: string, data: any): void;
  subscribe(channel: string, callback: (data: any) => void): () => void;
}

// Browser Implementation (BroadcastChannel)
export class WebSync implements SyncProvider {
  private channels: Map<string, BroadcastChannel> = new Map();

  broadcast(channel: string, data: any): void {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new BroadcastChannel(channel));
    }
    this.channels.get(channel)?.postMessage(data);
  }

  subscribe(channel: string, callback: (data: any) => void): () => void {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new BroadcastChannel(channel));
    }
    
    const bc = this.channels.get(channel)!;
    const handler = (ev: MessageEvent) => callback(ev.data);
    
    bc.addEventListener('message', handler);
    
    // Return cleanup function
    return () => bc.removeEventListener('message', handler);
  }
}

// Electron implementation via the preload bridge.
export class ElectronSync implements SyncProvider {
  broadcast(channel: string, data: any): void {
    window.api?.sync.broadcast(channel, data);
  }

  subscribe(channel: string, callback: (data: any) => void): () => void {
    return window.api?.sync.subscribe((event) => {
      if (event.channel === channel) {
        callback(event.data);
      }
    }) ?? (() => {});
  }
}

// Factory
// Detect the bridge itself instead of relying on Electron's user-agent string.
// Packaged builds and custom user-agent settings do not always expose "Electron".
const isElectron = typeof window !== 'undefined' && Boolean(window.api?.sync);

export const sync = isElectron ? new ElectronSync() : new WebSync();
