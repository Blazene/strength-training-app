import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { offlinePlugin } from "./pwa/offlinePlugin.ts";

export default defineConfig({
  plugins: [react(), offlinePlugin()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:4001"
    }
  }
});
