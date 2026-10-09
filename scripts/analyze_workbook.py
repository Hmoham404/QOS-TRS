import json, zipfile, xml.etree.ElementTree as ET
from pathlib import Path

root = Path(__file__).resolve().parent.parent
path = next(root.glob('*.xlsx'))
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(path) as z:
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        shared = [''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml'))]
    styles = ET.fromstring(z.read('xl/styles.xml'))
    fills = [ET.tostring(n, encoding='unicode') for n in styles.find('m:fills', ns)]
    cellstyles = [dict(n.attrib) for n in styles.find('m:cellXfs', ns)]
    rels = {n.attrib['Id']: n.attrib['Target'] for n in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    result = {'file':path.name, 'fills': fills, 'styles':cellstyles, 'sheets':[]}
    for sheet in ET.fromstring(z.read('xl/workbook.xml')).find('m:sheets', ns):
        target = rels[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
        target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        doc = ET.fromstring(z.read(target))
        cells=[]
        for c in doc.findall('.//m:sheetData/m:row/m:c', ns):
            v=c.find('m:v', ns); f=c.find('m:f', ns)
            value=v.text if v is not None else None
            if c.attrib.get('t')=='s' and value is not None: value=shared[int(value)]
            if c.attrib.get('t')=='inlineStr': value=''.join(c.find('m:is', ns).itertext())
            cells.append({'cell':c.attrib['r'], 'value':value, 'formula':f.text if f is not None else None,'formula_attrs':dict(f.attrib) if f is not None else None,'style':int(c.attrib.get('s',0))})
        result['sheets'].append({'name':sheet.attrib['name'], 'cells':cells, 'merges':[n.attrib['ref'] for n in doc.findall('m:mergeCells/m:mergeCell',ns)]})
    (root/'docs').mkdir(exist_ok=True)
    (root/'docs/workbook-analysis.json').write_text(json.dumps(result, ensure_ascii=False,indent=2),encoding='utf8')
    for s in result['sheets']:
        print('\nSHEET',s['name'],'cells',len(s['cells']))
        for c in s['cells']:
            if c['value'] is not None or c['formula']:
                print(c)
