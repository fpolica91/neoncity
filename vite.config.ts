import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
      "@client": path.resolve(__dirname, "src/client"),
      "@bridge": path.resolve(__dirname, "src/bridge"),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: "esnext",
  },
});
