const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const els={};const el=s=>els[s]??={value:'',innerHTML:'',textContent:'',addEventListener(){},close(){},showModal(){},removeAttribute(){},setAttribute(){}};
const c={window:{RECEIPT_CONFIG:{spreadsheetId:'test',sheetName:'test'}},document:{querySelector:el,querySelectorAll:()=>[]},sessionStorage:{getItem:()=>null,removeItem(){}},clearTimeout,setTimeout,console};
vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),c);
vm.runInContext(`
headers=['No.','Name','Description','Weight','Unit','Quantity','Price','Purchased Date','รหัสใบเสร็จ','ร้านค้า','ราคาต่อกก.','หมวดหมู่','สถานะ','วันที่เพิ่มรายการ','วันที่ใช้หมด'];
const raw=[1,'Chicken','88 baht/kg',0.718,'กิโลกรัม',2,63.25,'2026-10-27','ID','Shop',88,'Food','รอตรวจสอบ','2026-10-28',''];
data=[{row:2,v:fields.map(f=>raw[headers.indexOf(f)]??'')},{row:3,v:['ID2','2026-10-27','Shop','Berry',250,'',179,'Fruit','ยืนยันแล้ว','','2026-10-28',1,'กรัม',2,'']}];render();
`,c);
assert.equal((el('#receiptTable thead tr').innerHTML.match(/<th>/g)||[]).length,10);
assert.equal((el('#rows').innerHTML.match(/<td/g)||[]).length,20);
assert(el('#rows').innerHTML.includes('<td>0.718</td><td>กิโลกรัม</td><td>2</td><td>63.25</td>'));
assert.deepEqual(Array.from(vm.runInContext('columns.slice(0,8).map(c=>c.label)',c)),['No.','Name','Description','Weight','Unit','Quantity','Price','Purchased Date']);
for(const key of [4,11,6,13]){
const click={target:{closest:()=>({dataset:{sort:String(key),label:'test'},closest:()=>el('th')})}};
for(const dir of [1,-1,0]){el('#receiptTable thead').onclick(click);assert.equal(vm.runInContext('sortDir',c),dir)}
assert.equal(vm.runInContext('sortCol',c),null);
}
const form=vm.runInContext('editorFields(data[0])',c);
for(let i=0;i<15;i++)assert(form.includes('name="c'+i+'"'));
assert(form.indexOf('name="c4"')<form.indexOf('name="c11"'));
vm.runInContext(`
const item=data[0];const physical=headers.map(h=>item.v[fields.indexOf(h)]??'');const mapped=fields.map(f=>physical[headers.indexOf(f)]??'');
if(JSON.stringify(mapped)!==JSON.stringify(item.v))throw Error('round trip failed');
`,c);
console.log('PASS: sheet mapping, 9 data fields, 10 cells incl. actions, edit fields, distinct weight/quantity, 3-state sorting and round-trip writes');

vm.runInContext(`
function fixture(name,qty,bought,finished,weight=500,unit='กรัม',status='ยืนยันแล้ว'){return {row:2,v:['ID',bought,'Shop',name,weight,'',10,'Food',status,'','2026-10-29',qty,unit,1,finished]}}
const usage=[fixture('Rice',2,'2026-10-25','2026-11-01'),fixture('Rice',3,'2026-11-10','2026-11-30'),fixture('Rice','','2026-11-01','',1000),fixture('Egg',30,'2026-10-01','2026-10-01','','ฟอง'),fixture('Bad',4,'2026-11-15','2026-11-01')];
const oct=summarizeMonth(usage,'2026-10'),nov=summarizeMonth(usage,'2026-11');
if(oct.totals.bought!==2||oct.totals.finished!==1)throw Error('October event allocation');
const rice=nov.groups.find(g=>g.name==='Rice'&&g.weight===500);
if(rice.boughtQuantity!==3||rice.finishedQuantity!==5||average(rice.days)!==13.5)throw Error('Cross-month usage / duration');
const missing=nov.groups.find(g=>g.name==='Rice'&&g.weight===1000);
if(missing.missingBought!==1||missing.boughtQuantity!==0||!quantityCell(missing,'bought').includes('—'))throw Error('Missing quantities must not become weight or zero usage');
if(nov.totals.invalidDates!==1||nov.totals.finished!==2)throw Error('Invalid completion must be excluded');
if(summarizeMonth([fixture('Same day',1,'2026-10-01','2026-10-01')],'2026-10').totals.days[0]!==0)throw Error('Same day duration');
if(shiftMonth('2026-01',-1)!=='2025-12'||monthRange('2024-02').end!=='2024-02-29')throw Error('Month boundaries');
if(summarizeMonth(usage,'2026-13')!==null)throw Error('Invalid month');
if(validDate('2026-02-30'))throw Error('Invalid calendar date');
if(normalizeDate(46324)!=='2026-10-29')throw Error('Native Sheets date serial');
let invalidRejected=false;try{validateDates(fixture('X',1,'2026-11-15','2026-11-01').v)}catch{invalidRejected=true}
if(!invalidRejected)throw Error('Date order must be validated');
const original=data[0],next=original.v.slice();next[14]='2026-11-01';
const changes=changesFor(original,next);
if(changes.length!==1||!changes[0].range.endsWith('!O2')||changes[0].values[0][0]!=='2026-11-01')throw Error('Write only date cell');
headers=[headers[14],...headers.slice(0,14)];
if(!changesFor(original,next)[0].range.endsWith('!A2'))throw Error('Reordered header write');
token='test';data=usage;$('#summaryMonth').value='2026-11';renderMonthly();
if(!$('#monthlyHistory').innerHTML.includes('2026-06'))throw Error('Six month history');
$('#summaryStatus').value='รอตรวจสอบ';renderMonthly();
if(!$('#monthlyRows').innerHTML.includes('ไม่มีรายการ'))throw Error('Status filter');
selectTab('monthly');if(!$('#receiptsPanel').hidden||$('#monthlyPanel').hidden)throw Error('Tabs');
clear();if($('#monthlyCards').innerHTML!=='')throw Error('Clear private summary on logout');
`,c);
console.log('PASS: cross-month totals, missing quantity, unit/size grouping, invalid dates, same-day/leap-year boundaries, sparse writes, reordered headers, filters, tabs and logout');
(async()=>{
const elements={};const get=s=>elements[s]??={value:'',innerHTML:'',textContent:'',addEventListener(){},close(){},showModal(){},removeAttribute(){},setAttribute(){}};
let cells=[['No.','Name','Description','Weight','Unit','Quantity','Price','Purchased Date','รหัสใบเสร็จ','ร้านค้า','ราคาต่อกก.','หมวดหมู่','สถานะ','วันที่เพิ่มรายการ','วันที่ใช้หมด','External formula'],[1,'Rice','500 g',500,'กรัม',2,50,'2026-10-27','id','shop','','food','ยืนยันแล้ว','2026-10-28','','=KEEP()']];
let requests=[],overrides={'c14':'2026-11-02'};
const ctx={window:{RECEIPT_CONFIG:{spreadsheetId:'test',sheetName:'test'}},document:{querySelector:get,querySelectorAll:()=>[]},sessionStorage:{getItem:()=>null,removeItem(){}},clearTimeout,setTimeout,console,FormData:class{get(k){return overrides[k]??null}},fetch:async(url,opts={})=>{
const path=decodeURIComponent(url.split('/spreadsheets/test')[1]);requests.push({path,opts});
if(path.startsWith('?'))return {ok:true,json:async()=>({sheets:[{properties:{title:'test',sheetId:0,gridProperties:{columnCount:27,rowCount:938}}}]})};
if(path==='/values:batchUpdate'){const body=JSON.parse(opts.body);assert.equal(body.valueInputOption,'RAW');for(const update of body.data){assert.equal(update.range,"'test'!O2");cells[1][14]=update.values[0][0]}return {ok:true,json:async()=>({})}}
return {ok:true,json:async()=>({values:path.includes('!A1:AA1?')?[cells[0]]:path.includes('!A2:AA2?')?[cells[1]]:cells})}
}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),ctx);
await vm.runInContext("token='test';load()",ctx);
assert.equal((get('#rows').innerHTML.match(/<td/g)||[]).length,10);
await get('#rows').onclick({target:{closest:()=>({dataset:{action:'edit',row:'2'}})}});
assert(get('#formFields').innerHTML.includes('name="c14"'));
await get('#editForm').onsubmit({preventDefault(){}});
assert.equal(cells[1][14],'2026-11-02');assert.equal(cells[1][15],'=KEEP()');
assert.equal(get('#dialogError').textContent,'');
get('#summaryMonth').value='2026-11';get('#monthlyTab').onclick();
assert(get('#monthlyRows').innerHTML.includes('Rice'));
assert(get('#monthlyRows').innerHTML.includes('>2</td>'));
await get('#rows').onclick({target:{closest:()=>({dataset:{action:'edit',row:'2'}})}});
cells[1][1]='Changed elsewhere';overrides.c14='2026-11-03';
const countBefore=requests.filter(r=>r.path==='/values:batchUpdate').length;
await get('#editForm').onsubmit({preventDefault(){}});
assert(get('#dialogError').textContent.includes('Refresh'));
assert.equal(requests.filter(r=>r.path==='/values:batchUpdate').length,countBefore);
const html=fs.readFileSync(__dirname+'/index.html','utf8');
for(const selector of Object.keys(elements).filter(k=>/^#[\w]+$/.test(k)))assert(html.includes('id="'+selector.slice(1)+'"'),'Missing DOM '+selector);
console.log('PASS: load → edit popup → sparse date save → reload → monthly summary; preserve external column; prevent stale-row write; DOM IDs');
})().catch(e=>{console.error(e);process.exitCode=1});
