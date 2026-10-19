import { spawn } from "node:child_process";

const mode = process.argv[2] ?? "development";
const isProduction = mode === "production";
const commandArgs = isProduction
  ? ["dist/index.js"]
  : ["node_modules/tsx/dist/cli.mjs", "watch", "server/_core/index.ts"];

const child = spawn(process.execPath, commandArgs, {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: mode },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
