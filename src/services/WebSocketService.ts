
import { Snapshot } from "@/types";

export class WebSocketService {
  private socket: WebSocket | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  // Validate incoming WebSocket data
  private isSnapshot(value: unknown): value is Snapshot {
    if (!value || typeof value !== "object") {
      return false;
    }

    const data = value as Record<string, unknown>;

    return (
      Array.isArray(data.nodes) &&
      Array.isArray(data.gateways) &&
      Array.isArray(data.links) &&
      Array.isArray(data.alerts) &&
      Array.isArray(data.logs) &&
      Array.isArray(data.history) &&
      typeof data.timestamp === "string"
    );
  }

  connect(
    endpoint: string,
    onData: (snapshot: Snapshot) => void,
    onStatus: (status: string) => void
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

      this.socket.onopen = () => {
        onStatus("Connected");
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          const value: unknown = JSON.parse(event.data);

          if (this.isSnapshot(value)) {
            onData(value);
          } else {
            onStatus("Invalid payload");
          }
        } catch {
          onStatus("Invalid payload");
        }
      };

      this.socket.onerror = () => {
        onStatus("Disconnected");
      };

      this.socket.onclose = () => {
        onStatus("Disconnected");

        if (!this.stopped) {
          this.retry = setTimeout(open, 5000);
        }
      };
    };

    open();
  }

  disconnect() {
    this.stopped = true;

    if (this.retry) {
      clearTimeout(this.retry);
      this.retry = null;
    }

    this.socket?.close();
    this.socket = null;
  }
}
