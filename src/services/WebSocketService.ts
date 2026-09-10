import { Snapshot } from "@/types";
import { isSnapshot } from "./LiveApiService";
export class WebSocketService {
  private socket: WebSocket | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  connect(
    endpoint: string,
    onData: (snapshot: Snapshot) => void,
    onStatus: (status: string) => void,
  ) {
    if (!endpoint) {
      onStatus("Not configured");
      return;
    }
    this.stopped = false;
    const open = () => {
      if (this.stopped) return;
      try {
        this.socket = new WebSocket(endpoint);
      } catch {
        onStatus("Invalid endpoint");
        return;
      }
      this.socket.onopen = () => onStatus("Connected");
      this.socket.onmessage = (event) => {
        try {
          const value: unknown = JSON.parse(event.data);
          if (isSnapshot(value)) onData(value);
          else onStatus("Invalid payload");
        } catch {
          onStatus("Invalid payload");
        }
      };
      this.socket.onerror = () => onStatus("Disconnected");
      this.socket.onclose = () => {
        onStatus("Disconnected");
        if (!this.stopped) this.retry = setTimeout(open, 5000);
      };
    };
    open();
  }
  disconnect() {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    this.socket?.close();
  }
}
