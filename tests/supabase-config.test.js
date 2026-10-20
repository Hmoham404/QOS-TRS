import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveSupabaseConfig} from '../src/supabase-config.js';
const jwt=role=>'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
test('uses the existing Vercel anon key and normalizes REST URLs',()=>{
  const result=resolveSupabaseConfig({VITE_SUPABASE_URL:'https://actual-project.supabase.co/rest/v1/',VITE_SUPABASE_ANON_KEY:jwt('anon')});
  assert.equal(result.url,'https://actual-project.supabase.co');assert.equal(result.error,null);assert.equal(result.key,jwt('anon'));
});
test('rejects placeholders, incomplete config and privileged keys',()=>{
  for(const env of [
    {VITE_SUPABASE_URL:'https://votre-projet.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_votre_cle_publique'},
    {VITE_SUPABASE_URL:'https://actual-project.supabase.co'},
    {VITE_SUPABASE_URL:'https://actual-project.supabase.co',VITE_SUPABASE_ANON_KEY:jwt('service_role')},
    {VITE_SUPABASE_URL:'https://actual-project.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_test'},
  ])assert.ok(resolveSupabaseConfig(env).error);
  assert.equal(resolveSupabaseConfig({}).error,null);
});
