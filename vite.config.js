import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { pwaBuild } from './scripts/pwa-build.js';
import rhPointageHandler from './api/rh-pointage.js';
const rhPointageApi = () => ({
  name: 'rh-pointage-api',
  configureServer(server) { server.middlewares.use('/api/rh-pointage', rhPointageHandler); },
  configurePreviewServer(server) { server.middlewares.use('/api/rh-pointage', rhPointageHandler); },
});
export default defineConfig(({mode}) => {
  const env=loadEnv(mode,process.cwd(),'VITE_');
  const cloud=Boolean(env.VITE_SUPABASE_URL || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY);
  return {
    plugins:[react(),tailwindcss(),pwaBuild(),rhPointageApi()],
    resolve:{alias:{'@seed':fileURLToPath(new URL(cloud?'./src/empty-seed.json':'./src/seed.json',import.meta.url))}},
    server:{port:5173,strictPort:true},
    build:{rollupOptions:{output:{
      onlyExplicitManualChunks:true,
      manualChunks(id) {
        const path=id.replaceAll('\\','/');
        if (/\/node_modules\/(react|react-dom|scheduler)\//.test(path)) return 'react';
        if (path.includes('/node_modules/recharts/')) return 'charts';
        if (path.includes('/node_modules/@supabase/')) return 'supabase';
      },
    }}},
  };
});
