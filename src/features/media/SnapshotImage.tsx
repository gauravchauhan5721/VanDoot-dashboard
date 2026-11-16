"use client";
import { useState } from "react";
export function SnapshotImage({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <div className="snapshot-source">
      {failed ? (
        <p role="status">Image unavailable. Check its URL or retry.</p>
      ) : (
        /* The camera may be private/LAN; preserve the exact source without a server image proxy. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={attempt}
          src={url}
          alt="Latest configured node image; capture time not reported"
          onError={() => setFailed(true)}
        />
      )}
      <p>
        Latest configured image. Capture time and matching detection are
        unknown; no boxes are overlaid. Open an event for captured evidence.
      </p>
      <button
        className="button"
        onClick={() => {
          setFailed(false);
          setAttempt((v) => v + 1);
        }}
      >
        Reload image
      </button>
    </div>
  );
}
