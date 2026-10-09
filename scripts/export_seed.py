import json, re, datetime, uuid
from pathlib import Path
root=Path(__file__).resolve().parent.parent
d=json.loads((root/'docs/workbook-analysis.json').read_text(encoding='utf8'))
def rows(sheet):
    out={}
    for c in sheet['cells']:
        col,row=re.match(r'([A-Z]+)(\d+)',c['cell']).groups()
        out.setdefault(int(row),{})[col]=c['value']
    return out
def uid(s): return str(uuid.uuid5(uuid.NAMESPACE_URL,'qos-injection/'+s))
ref=rows(d['sheets'][0]); molds=rows(d['sheets'][3])
presses=[{'id':uid(r['A']),'name':r['A'],'active':True} for i,r in ref.items() if i>1 and r.get('A')]
articles=[]
for i,r in ref.items():
    if i>1 and r.get('C'):
        mold=next(m for m in molds.values() if m.get('A')==r['C'])
        articles.append({'id':uid(r['C']),'code':r['C'],'name':r['D'],'cavities':int(mold['C']),'mold_cycle_seconds':float(mold['D']),'standard_seconds':float(r['E']),'active':True})
records=[]
mapping={'F':'opening_min','G':'planned_min','I':'breakdown_min','J':'startup_min','K':'changeover_min','N':'good_qty','O':'startup_rejects','P':'production_rejects','W':'labor_hours'}
for i,r in rows(d['sheets'][1]).items():
    if i<=3 or not r.get('A'): continue
    a=next(a for a in articles if a['code']==r['D'])
    rec={'id':uid('row/'+str(i)),'date':(datetime.datetime(1899,12,30)+datetime.timedelta(days=float(r['A']))).date().isoformat(),'shift':r['B'],'press_id':uid(r['C']),'article_id':a['id'],'cycle_seconds':a['mold_cycle_seconds']/a['cavities'],'standard_seconds':a['standard_seconds'],'notes':'','source':'excel','source_row':i}
    for col,key in mapping.items(): rec[key]=float(r.get(col) or 0)
    records.append(rec)
seed={'presses':presses,'articles':articles,'records':records}
(root/'src').mkdir(exist_ok=True)
(root/'src/seed.json').write_text(json.dumps(seed,ensure_ascii=False,indent=2),encoding='utf8')
def sqlval(v):
    if isinstance(v,bool): return str(v).lower()
    if isinstance(v,(int,float)): return str(v)
    if v is None: return 'NULL'
    return "'"+str(v).replace("'","''")+"'"
sql=['-- Données originales du classeur. Import idempotent, sans écrasement.','begin;']
for table,items in [('presses',presses),('articles',articles),('production_records',records)]:
    keys=list(items[0]); sql.append('insert into public.'+table+' ('+', '.join(keys)+') values\n'+',\n'.join('('+', '.join(sqlval(r[k]) for k in keys)+')' for r in items)+'\non conflict do nothing;')
sql.append('commit;')
(root/'supabase').mkdir(exist_ok=True)
(root/'supabase/02_import_excel.sql').write_text('\n\n'.join(sql),encoding='utf8')
print(f'Export: {len(presses)} presses, {len(articles)} articles, {len(records)} relevés.')
