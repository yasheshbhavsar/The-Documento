import net from "node:net";
import { spawn } from "node:child_process";

function isPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 500);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

async function main() {
  const isWin = process.platform === "win32";
  const children = [];
  const backendAlreadyRunning = await isPortOpen(8000);

  if (backendAlreadyRunning) {
    console.log("[Documento] FastAPI OCR backend already listening on http://127.0.0.1:8000 — attaching frontend...");
  } else {
    console.log("[Documento] Starting FastAPI OCR backend (http://localhost:8000) & Next.js frontend (http://localhost:3000)...");
    const backendCmd = isWin ? "powershell.exe" : "npm";
    const backendArgs = isWin
      ? ["-ExecutionPolicy", "Bypass", "-File", "./run_backend.ps1"]
      : ["run", "dev:backend"];
    const be = spawn(backendCmd, backendArgs, {
      stdio: "inherit",
      windowsHide: false,
    });
    be.on("exit", (code) => {
      if (code && code !== 0) {
        console.warn(`[Documento] Backend process exited with code ${code}. Frontend remains active; run 'npm run dev:backend' to inspect backend logs.`);
      }
    });
    children.push(be);
  }

  const feCmd = isWin ? "npm.cmd" : "npm";
  const fe = spawn(feCmd, ["--prefix", "apps/web", "run", "dev"], {
    stdio: "inherit",
    shell: isWin,
  });
  children.push(fe);

  const shutdown = (signal) => {
    for (const child of children) {
      if (!child.killed) {
        try {
          child.kill(signal);
        } catch {
          // ignore cleanup errors
        }
      }
    }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  fe.on("exit", (code) => {
    shutdown("SIGTERM");
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error("[Documento] Failed to start dev environment:", err);
  process.exit(1);
});
