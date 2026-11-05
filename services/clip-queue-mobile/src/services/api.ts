import { DriveFolder, ClipQueueItem, IngestPayload, WorkerHeartbeatStatus } from '../types';

export class ApiService {
  private static cleanUrl(serverUrl: string): string {
    return serverUrl.trim().replace(/\/+$/, '');
  }

  public static async fetchFolders(serverUrl: string): Promise<DriveFolder[]> {
    const base = this.cleanUrl(serverUrl);
    const res = await fetch(`${base}/api/folders`, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.folders)) {
      return data.folders;
    }
    throw new Error(data.error || 'Failed to fetch folders');
  }

  public static async submitClip(
    serverUrl: string,
    payload: IngestPayload
  ): Promise<{ success: boolean; item?: ClipQueueItem; message?: string; alreadyQueued?: boolean }> {
    const base = this.cleanUrl(serverUrl);
    const res = await fetch(`${base}/api/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok && !data.success) {
      throw new Error(data.error || 'Failed to submit clip');
    }
    return data;
  }

  public static async submitBatchClips(
    serverUrl: string,
    items: IngestPayload[]
  ): Promise<{ success: boolean; addedCount: number; skippedCount: number }> {
    const base = this.cleanUrl(serverUrl);
    const res = await fetch(`${base}/api/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ items }),
    });
    const data = await res.json();
    if (!res.ok && !data.success) {
      throw new Error(data.error || 'Failed to submit batch clips');
    }
    return data;
  }

  public static async fetchWorkerHeartbeat(serverUrl: string): Promise<WorkerHeartbeatStatus> {
    try {
      const base = this.cleanUrl(serverUrl);
      const res = await fetch(`${base}/api/worker/heartbeat`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return { isOnline: false };
      const data = await res.json();
      return {
        isOnline: Boolean(data.isOnline),
        isRunning: data.isRunning,
        activeIngests: data.activeIngests || 0,
        lastPingAt: data.lastPingAt,
        secondsAgo: data.secondsAgo,
      };
    } catch {
      return { isOnline: false };
    }
  }

  public static async fetchQueue(serverUrl: string): Promise<ClipQueueItem[]> {
    const base = this.cleanUrl(serverUrl);
    const res = await fetch(`${base}/api/queue?limit=40`, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.items)) {
      return data.items;
    }
    return [];
  }
}

