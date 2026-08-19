import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const localApiOrigin = process.env.LGS_API_ORIGIN ?? 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/v1': localApiOrigin, '/health': localApiOrigin } },
});
