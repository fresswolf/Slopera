// electron.vite.config.ts
import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
var shared = resolve(import.meta.dirname, "src/shared");
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { "@shared": shared } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { "@shared": shared } },
    build: { rollupOptions: { output: { format: "cjs" } } }
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@shared": shared } }
  }
});
export {
  electron_vite_config_default as default
};
