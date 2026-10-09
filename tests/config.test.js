import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSupabaseConfig as config} from '../src/supabase-config.js';
test('Configuration Vercel : compatibilité anon et URL REST, sans modifier les clés',()=>{
 const c=config({VITE_SUPABASE_URL:' https://example.supabase.co/rest/v1/ ',VITE_SUPABASE_ANON_KEY:' public-example '});assert.equal(c.url,'https://example.supabase.co');assert.equal(c.key,'public-example');assert.equal(c.configured,true);
 assert.equal(config({VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'preferred',VITE_SUPABASE_ANON_KEY:'fallback'}).key,'preferred');
});
test('Le déploiement échoue explicitement si une variable manque ; le mode local reste disponible',()=>{
 assert.equal(config({}).error,null);assert.match(config({},true).error,/VITE_SUPABASE_URL/);
 assert.match(config({VITE_SUPABASE_URL:'https://example.supabase.co'},true).error,/VITE_SUPABASE_PUBLISHABLE_KEY/);
 assert.match(config({VITE_SUPABASE_URL:'https://example.supabase.co/other',VITE_SUPABASE_ANON_KEY:'public'}).error,/sans chemin/);
});
test('Les clés privées Supabase ne peuvent pas être envoyées au navigateur',()=>{
 const base={VITE_SUPABASE_URL:'https://example.supabase.co'};
 assert.match(config({...base,VITE_SUPABASE_ANON_KEY:'sb_secret_test'}).error,/jamais/);
 const jwt=role=>'eyJ.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
 assert.match(config({...base,VITE_SUPABASE_ANON_KEY:jwt('service_role')}).error,/service_role/);
 assert.equal(config({...base,VITE_SUPABASE_ANON_KEY:jwt('anon')}).configured,true);
});
