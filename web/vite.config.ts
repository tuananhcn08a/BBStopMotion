/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // T-W06: exclude @ffmpeg/ffmpeg + @ffmpeg/util khỏi Vite pre-bundling.
  // Lõi @ffmpeg/core@0.12.6 đơn luồng → KHÔNG cần COOP/COEP (không SharedArrayBuffer).
  // Lý do: @ffmpeg/ffmpeg tự resolve worker URL theo đường dẫn relative bên trong package.
  // Nếu Vite bundle lại → worker URL bị đổi → fetch worker CORS fail (ERR_BLOCKED_BY_RESPONSE).
  // Giải pháp chính thức: optimizeDeps.exclude để Vite giữ nguyên cấu trúc module gốc.
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
})
