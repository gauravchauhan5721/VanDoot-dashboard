"use client";
import { useSyncExternalStore } from "react";
const subscribe = (callback: () => void) => {
  const timer = setInterval(callback, 1000);
  return () => clearInterval(timer);
};
const snapshot = () => Math.floor(Date.now() / 1000) * 1000;
export function useClock() {
  return useSyncExternalStore(subscribe, snapshot, () => 0);
}
