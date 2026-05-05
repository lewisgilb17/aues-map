import { defineConfig } from "vite";

const appBase = process.env.VITE_APP_BASE || "/aues-map/";

export default defineConfig({
  base: appBase,
});