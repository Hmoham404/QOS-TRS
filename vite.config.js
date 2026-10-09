import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { resolveSupabaseConfig } from './src/supabase-config.js';
export default defineConfig(({mode,command}) => {
  const env=loadEnv(mode,process.cwd(),'VITE_');
  const hosted=process.env.VERCEL==='1';
  const config=resolveSupabaseConfig(env,hosted);
  if((hosted||command==='build') && config.error)throw new Error(config.error);
  const cloud=hosted||Boolean(config.url||config.key);
  return {plugins:[react(),tailwindcss()],define:{'import.meta.env.VITE_REQUIRE_SUPABASE':JSON.stringify(hosted?'true':'false')},resolve:{alias:{'@seed':fileURLToPath(new URL(cloud?'./src/empty-seed.json':'./src/seed.json',import.meta.url))}},server:{port:5173,strictPort:true},build:{rollupOptions:{output:{manualChunks:{charts:['recharts'],supabase:['@supabase/supabase-js']}}}}};
});
