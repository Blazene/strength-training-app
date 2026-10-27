import { defineConfig } from "vite";
import type { ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import { offlinePlugin } from "./pwa/offlinePlugin.ts";

const apiProxy: ProxyOptions = {
  target: process.env.BACKEND_URL ?? "http://127.0.0.1:4001",
  changeOrigin: false,
  configure(proxy) {
    proxy.on("proxyReq", (request) => {
      request.setHeader("x-forwarded-proto", "http");
      request.removeHeader("x-forwarded-host");
      request.removeHeader("forwarded");
    });
  }
};
export default defineConfig({
  plugins: [react(), offlinePlugin()],
  preview: { proxy: { "/api": apiProxy } },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": apiProxy
    }
  }
});
