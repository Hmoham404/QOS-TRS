import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig(({mode}) => {
  const env=loadEnv(mode,process.cwd(),'VITE_');
  const cloud=Boolean(env.VITE_SUPABASE_URL || env.VITE_SUPABASE_PUBLISHABLE_KEY);
  return {plugins:[react(),tailwindcss()],resolve:{alias:{'@seed':fileURLToPath(new URL(cloud?'./src/empty-seed.json':'./src/seed.json',import.meta.url))}},server:{port:5173,strictPort:true},build:{rollupOptions:{output:{manualChunks:{charts:['recharts'],supabase:['@supabase/supabase-js']}}}}};
});
