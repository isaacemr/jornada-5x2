/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base './' permite publicar em qualquer subpasta de hospedagem estática.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // exceljs, jspdf e docx são grandes, mas só carregam sob demanda (ao importar/exportar).
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
