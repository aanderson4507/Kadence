import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward API calls to the Express server started with `npm run dev:api` (API_PORT in .env).
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
