import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const configuredBase = process.env.VITE_BASE_PATH ?? "/";
const base = configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`;

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: false
  },
  preview: {
    port: 4173,
    strictPort: false
  }
});
