export function serialize(rows, {format='json'}={}) {
 if(format==='json') return JSON.stringify(rows);
 if(format!=='csv') throw new Error('Unsupported format');
 const cell=v => '"'+String(v).replaceAll('"','""')+'"';
 return ['name,count', ...rows.map(r=>[r.name,r.count].map(cell).join(','))].join('\n');
}
