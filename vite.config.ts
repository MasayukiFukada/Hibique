import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const rawPort = process.env.HIBIQUE_DEV_PORT ?? process.env.VITE_PORT;
const parsedPort = rawPort ? Number(rawPort) : Number.NaN;
const devPort =
  Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535
    ? parsedPort
    : 5173;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: devPort,
    strictPort: true,
  },
});
