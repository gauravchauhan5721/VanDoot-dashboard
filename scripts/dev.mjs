import { spawn } from "node:child_process";
const args = process.argv
  .slice(2)
  .filter((a) => a !== "--strictPort")
  .map((a) => (a === "--host" ? "--hostname" : a));
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", ...args],
  { stdio: "inherit", env: process.env },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
