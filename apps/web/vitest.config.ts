import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@testing-library/react": path.resolve(__dirname, "node_modules/@testing-library/react"),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "lucide-react": path.resolve(__dirname, "node_modules/lucide-react"),
      motion: path.resolve(__dirname, "node_modules/motion"),
    },
  },
  server: {
    fs: {
      allow: ["..", "../.."],
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 30000,
    fileParallelism: false,
    isolate: true,
    include: [
      "tests/**/*.test.{ts,tsx}",
      "lib/**/*.test.{ts,tsx}",
      "../../tests/e2e/**/*.test.{ts,tsx}",
    ],
  },
});
