import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const srcPath = decodeURIComponent(new URL("./src", import.meta.url).pathname);

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { "@": srcPath },
  },
});
