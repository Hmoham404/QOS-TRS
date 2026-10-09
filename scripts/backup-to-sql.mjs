import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {validateRecord} from '../src/domain.js';
const [input,output]=process.argv.slice(2);
if(!input||!output){console.error('Usage: node scripts/backup-to-sql.mjs sauvegarde.json reprise.sql');process.exit(1);}
if(existsSync(output)){console.error('Le fichier de sortie existe déjà. Choisissez un nouveau nom.');process.exit(1);}
const data=JSON.parse(readFileSync(input,'utf8'));
if(data.version!==1||!['presses','articles','records'].every(k=>Array.isArray(data[k])))throw new Error('Format de sauvegarde invalide.');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
for(const group of ['presses','articles','records'])for(const item of data[group])if(!uuid.test(item.id))throw new Error('Identifiant invalide.');
for(const r of data.records){const errors=validateRecord(r);if(errors.length)throw new Error(`${r.id}: ${errors.join(' ')}`);if(!data.presses.some(p=>p.id===r.press_id)||!data.articles.some(a=>a.id===r.article_id))throw new Error('Référence absente.');}
for(const a of data.articles)if(!a.code?.trim()||!a.name?.trim()||!Number.isInteger(a.cavities)||a.cavities<1||!(a.mold_cycle_seconds>0)||!(a.standard_seconds>0))throw new Error('Article invalide.');
for(const p of data.presses)if(!p.name?.trim())throw new Error('Presse invalide.');
const quote=v=>v==null?'NULL':typeof v==='boolean'?String(v):typeof v==='number'?(Number.isFinite(v)?String(v):(()=>{throw new Error('Nombre invalide');})()):"'"+(typeof v==='object'?JSON.stringify(v):String(v)).replaceAll("'","''")+"'";
const definitions=[['presses',data.presses,['id','name','active']],['articles',data.articles,['id','code','name','cavities','mold_cycle_seconds','standard_seconds','active']],['production_records',data.records,['id','date','shift','press_id','article_id','opening_min','planned_min','breakdown_min','startup_min','changeover_min','good_qty','startup_rejects','production_rejects','labor_hours','cycle_seconds','standard_seconds','notes','source','source_row']]];
definitions[2][1]=data.records.map(r=>({...r,shift_start:r.shift_start??null,timeline_complete:!!r.timeline_complete,stop_events:r.stop_events||[]}));
definitions[2][2].push('shift_start','timeline_complete','stop_events');
const lines=['-- Reprise à exécuter en tant que propriétaire dans SQL Editor, après 01_schema.sql et 03_stop_journal.sql.','-- Les lignes déjà présentes sont conservées. Préférer une base neuve pour une reprise exacte.','-- Le trigger est suspendu uniquement dans cette transaction pour conserver les instantanés historiques et les références archivées.','begin;','alter table public.production_records disable trigger prepare_production_record;'];
for(const [table,items,keys] of definitions){if(items.length)lines.push(`insert into public.${table} (${keys.join(',')}) values\n${items.map(item=>'('+keys.map(k=>quote(item[k])).join(',')+')').join(',\n')}\non conflict do nothing;`);}
lines.push('alter table public.production_records enable trigger prepare_production_record;','commit;');
writeFileSync(output,lines.join('\n\n'),'utf8');console.log(`Reprise créée : ${data.records.length} relevés → ${output}`);
