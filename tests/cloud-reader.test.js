import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudReader } from '../src/cloud-reader.js';

function fixture() {
  const calls=[], tables={presses:[],articles:[],production_records:[]};
  const markers={qos_public_access_ready:true,qos_departments_ready:true,qos_welding_ready:true};
  const state={calls,tables,markers,queryError:null,beforeResult:null};
  state.client={
    async rpc(name) { calls.push({rpc:name}); const data=markers[name]; return data instanceof Error ? {error:data} : data === undefined ? {error:{code:'PGRST202'}} : {data}; },
    from(table) {
      const filters={};
      return {
        select() { return this; }, eq(key,value) {filters[key]=value;return this;},
        gt(key,value) {filters.after=value;return this;}, order() {return this;},
        async limit(size) {
          calls.push({table,filters:{...filters},size});
          const data=tables[table].filter(row=>(!filters.department||row.department===filters.department)&&(!filters.after||row.id>filters.after)).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,size).map(row=>({...row}));
          if(state.beforeResult)await state.beforeResult(table);
          if(state.queryError){const error=state.queryError;state.queryError=null;return {error};}
          return {data};
        },
      };
    },
  };
  return state;
}

test('Les lectures simultanées partagent leurs requêtes et les vérifications réussies ne sont pas répétées',async()=>{
  const state=fixture(), reader=createCloudReader(state.client);
  const first=reader.load('welding'), second=reader.load('welding');
  assert.equal(first,second);
  const data=await first;
  assert.equal(data.department,'welding');assert.equal(state.calls.length,6);
  assert.equal(state.calls.filter(call=>call.rpc).length,3);
  await reader.load('welding');
  assert.equal(state.calls.length,9);
  assert.ok(state.calls.filter(call=>call.table).every(call=>call.filters.department==='welding'));
});

test('La pagination par identifiant charge plus de 1 000 lignes sans doublon et reste séparée par département',async()=>{
  const state=fixture(), reader=createCloudReader(state.client);
  state.tables.production_records=Array.from({length:2501},(_,index)=>({id:String(index).padStart(8,'0'),department:index%2?'welding':'injection'}));
  const data=await reader.load('injection');
  assert.equal(data.records.length,1251);assert.equal(new Set(data.records.map(row=>row.id)).size,1251);
  assert.ok(data.records.every(row=>row.department==='injection'));
  const pages=state.calls.filter(call=>call.table==='production_records');
  assert.equal(pages.length,2);assert.equal(pages[1].filters.after,data.records[999].id);
});

test('Les actualisations automatiques réutilisent une lecture récente ; une lecture manuelle et une écriture la renouvellent',async()=>{
  let time=1000;
  const state=fixture(), reader=createCloudReader(state.client,{now:()=>time});
  const initial=await reader.load('assembly');
  assert.equal(await reader.load('assembly',{maxAge:30000}),initial);
  assert.equal(state.calls.length,5);
  await reader.load('assembly');assert.equal(state.calls.length,8);
  time+=30001;await reader.load('assembly',{maxAge:30000});assert.equal(state.calls.length,11);
  reader.invalidate('assembly');await reader.load('assembly',{maxAge:30000});assert.equal(state.calls.length,14);
});

test('Une ancienne requête terminée après une écriture ne remplace pas la nouvelle lecture du cache',async()=>{
  const saved=[],state=fixture(), reader=createCloudReader(state.client,{onRead:data=>saved.push(data)});
  let release, started;
  const gate=new Promise(resolve=>{release=resolve;}), entered=new Promise(resolve=>{started=resolve;});
  state.tables.production_records=[{id:'1',department:'welding',notes:'ancien'}];
  state.beforeResult=async table=>{if(table==='production_records'){started();await gate;}};
  const old=reader.load('welding');await entered;
  reader.invalidate('welding');state.beforeResult=null;state.tables.production_records[0].notes='nouveau';
  const fresh=await reader.load('welding');release();await old;
  assert.equal((await reader.load('welding',{maxAge:30000})).records[0].notes,'nouveau');
  assert.equal(fresh.records[0].notes,'nouveau');
  assert.equal(saved.length,1);assert.equal(saved[0].records[0].notes,'nouveau');
});

test('Les erreurs réseau sont propagées et une nouvelle tentative effectue réellement la lecture',async()=>{
  const state=fixture(),reader=createCloudReader(state.client);
  state.queryError=new TypeError('Failed to fetch');
  await assert.rejects(reader.load('assembly'),/Failed to fetch/);
  const data=await reader.load('assembly');assert.deepEqual(data.records,[]);
});

test('Les migrations absentes peuvent être appliquées puis vérifiées de nouveau sans recharger le client',async()=>{
  const state=fixture(), reader=createCloudReader(state.client);
  delete state.markers.qos_welding_ready;
  await assert.rejects(reader.load('welding'),/08_welding/);
  assert.equal(state.calls.filter(call=>call.table).length,0);
  state.markers.qos_welding_ready=true;await reader.load('welding');
  assert.equal(state.calls.filter(call=>call.rpc==='qos_welding_ready').length,2);
});

test('Les anciennes bases restent accessibles uniquement en Injection et un accès non activé reste bloqué',async()=>{
  const state=fixture(), reader=createCloudReader(state.client);
  delete state.markers.qos_departments_ready;
  await reader.load('injection');
  assert.ok(state.calls.filter(call=>call.table).every(call=>!call.filters.department));
  await assert.rejects(reader.load('assembly'),/07_departments/);
  const blocked=fixture();blocked.markers.qos_public_access_ready=false;
  await assert.rejects(createCloudReader(blocked.client).load('injection'),/05_planning/);
  assert.equal(blocked.calls.filter(call=>call.table).length,0);
});
