import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true }, // must match the API's CORS allowed origins
  test: {
    environment: 'jsdom', // a fake browser DOM, so components can render in tests
    setupFiles: ['./src/tests/setup.js'],
    css: { modules: { classNameStrategy: 'non-scoped' } }, // readable class names in tests
  },
})
