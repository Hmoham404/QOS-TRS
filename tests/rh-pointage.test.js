import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { decodeRhSnapshot, summarizeRhPointage, loadRhPointage } from '../server/rh-pointage.js';
import handler from '../api/rh-pointage.js';

const date='2026-11-26';
const person=(id,extra={})=>({id,zk:id,record_id:id,kind:'MOD',department:'PRODUCTION',status:'Actif',...extra});
const row=(id,minutes=480,status='POINTAGE')=>({id,employeeKey:id,days:[{isoDate:date,status,workedMinutes:minutes}]});
const snapshot=(rows)=>({weeklySheets:[{dayColumns:[{isoDate:date}],rows}]});
const summary=(data,from=date,to=date)=>summarizeRhPointage(data,from,to);

test('RH : seulement MOD Production actifs, identités normalisées et aucune double addition',()=>{
  const employees=[person('001'),person('2',{kind:'MOI'}),person('3',{department:'ADMINISTRATION'}),person('4',{status:'STC'})];
  const data=snapshot([row('1',456),row('2'),row('3'),row('4')]);
  data.weeklySheets.push(structuredClone(data.weeklySheets[0]));
  const result=summary({snapshot:data,employees});
  assert.equal(result.status,'ready');assert.equal(result.hours,7.6);assert.equal(result.employeeDays,1);
  assert.ok(!JSON.stringify(result).includes('employeeKey'));
});

test('RH : corrections chronologiques, pause déduite une seule fois, absence et jours manquants',()=>{
  const data=snapshot([row('1',480)]);
  const corrections=[{employeeKey:'1',isoDate:date,correctedAt:'2026-11-26T12:00:00Z',after:{entry:'08:00',exit:'16:00',breakMinutes:20}}, {employeeKey:'1',isoDate:date,correctedAt:'2026-11-26T10:00:00Z',after:{status:'ABS'}}];
  const result=summary({snapshot:data,employees:[person('1')],corrections});
  assert.equal(result.totalMinutes,460);assert.equal(result.hours,460/60);
  const partial=summary({snapshot:data,employees:[person('1')]},'2026-11-23','2026-11-29');
  assert.equal(partial.status,'partial');assert.equal(partial.missingDates.length,6);
  assert.equal(summary({snapshot:snapshot([row('1',0,'ABS')]),employees:[person('1')]}).hours,0);
});

test('RH : pointages à vérifier, valeurs invalides et journées absentes ne deviennent pas des heures validées',()=>{
  for(const cell of [row('1',480,'AVR'),row('1',null),row('1',-1)]){
    const result=summary({snapshot:snapshot([cell]),employees:[person('1')]});
    assert.equal(result.status,'partial');assert.equal(result.hours,null);assert.equal(result.reviewCount,1);
  }
  const mixed=summary({snapshot:snapshot([row('1',120),row('2',450,'AVR')]),employees:[person('1'),person('2')]});
  assert.equal(mixed.hours,2);assert.equal(mixed.status,'partial');
  assert.equal(summary({snapshot:null,employees:[]}).hours,null);
  assert.equal(summary({snapshot:snapshot([row('1')]),employees:[person('1')]},'2026-11-25','2026-11-25').status,'empty');
  const calendar=snapshot([row('1')]);
  calendar.weeklySheets[0].dayColumns.push({isoDate:'2026-11-27'});
  calendar.weeklySheets[0].rows[0].days.push({isoDate:'2026-11-27',status:'EMPTY',workedMinutes:0});
  const missing=summary({snapshot:calendar,employees:[person('1')]},date,'2026-11-27');
  assert.equal(missing.status,'partial');assert.deepEqual(missing.missingDates,['2026-11-27']);
});

test('RH : stockage gzip et référence au parent restaurés sans dépendance au navigateur',()=>{
  const fields={weeklySheets:[{rows:[]}],dayRows:[]};
  const encoded={rawRows:[],currentFilePointage:null,currentFilePointageParentFields:['weeklySheets'],pointageStorageGzipV1:gzipSync(JSON.stringify({fields,metadata:[]})).toString('base64')};
  const result=decodeRhSnapshot(encoded);
  assert.deepEqual(result.weeklySheets,fields.weeklySheets);
  assert.deepEqual(result.currentFilePointage.weeklySheets,fields.weeklySheets);
  assert.equal(decodeRhSnapshot({cleared:true}),null);
});

test('RH : lecture seule paginée, corrections inter-mois et annuaire actif appliqués',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,options});const parsed=new URL(url);const query=parsed.searchParams;
    let result=[];
    if(parsed.pathname.endsWith('hr_staff_directory')) result=[person('1'),person('2')];
    else if(query.get('id')==='eq.rh-pointage-analysis') result=[{payload:snapshot([row('1'),row('2')]),updated_at:'2026-11-26T10:00:00Z'}];
    else if(query.get('id')==='eq.rh-staff-directory-active-records') result=[{payload:{recordIds:['1']}}];
    return {ok:true,json:async()=>result};
  };
  const result=await loadRhPointage('2026-11-26','2026-12-01',{fetchImpl});
  assert.equal(result.hours,8);assert.equal(result.employeeDays,1);
  assert.ok(calls.some(call=>decodeURIComponent(call.url).includes('rh-pointage-correction-2026-12')));
  assert.ok(calls.every(call=>!call.options.method||call.options.method==='GET'));
  assert.ok(!calls.some(call=>call.url.includes('full_name')));
});

test('API RH : périodes invalides et méthodes autres que GET refusées avant toute lecture',async()=>{
  for(const request of [{method:'POST',url:'/'},{method:'GET',url:'/?from=2026-02-30&to=2026-02-30'},{method:'GET',url:'/?from=2026-11-26&to=2025-11-26'}]){
    const response={headers:{},setHeader(key,value){this.headers[key]=value},end(body){this.body=body}};
    await handler(request,response);assert.ok([400,405].includes(response.statusCode));
    assert.equal(response.headers['Cache-Control'],'no-store');
  }
});
