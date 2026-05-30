import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Proxying means the browser only ever talks to one origin in dev, so the
    // session cookie behaves the same here as it does behind CloudFront.
    // Without this we would need CORS plus SameSite=None just for local work.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    // Vite content-hashes these, which is what makes them safe to cache hard
    // at the CloudFront /assets/* behaviour.
    assetsDir: "assets",
  },
});
