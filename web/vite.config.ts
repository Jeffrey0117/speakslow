import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 專案站台路徑為 /speakslow/，需設 base 否則資源 404
// https://vite.dev/config/
export default defineConfig({
  base: '/SpeakSlow/',
  plugins: [react()],
})
