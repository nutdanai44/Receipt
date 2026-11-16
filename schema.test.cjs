const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const els={};const el=s=>els[s]??={value:'',innerHTML:'',textContent:'',addEventListener(){},close(){},showModal(){},removeAttribute(){},setAttribute(){}};
const c={window:{RECEIPT_CONFIG:{spreadsheetId:'test',sheetName:'test'}},document:{querySelector:el,querySelectorAll:()=>[]},sessionStorage:{getItem:()=>null,removeItem(){}},clearTimeout,setTimeout,console};
vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),c);
vm.runInContext(`
headers=['No.','Name','Description','Weight','Unit','Quantity','Price','Purchased Date','รหัสใบเสร็จ','ร้านค้า','ราคาต่อกก.','หมวดหมู่','สถานะ','วันที่เพิ่มรายการ','วันที่ใช้หมด','หมายเหตุ'];
const raw=[1,'Chicken','88 baht/kg',0.718,'กิโลกรัม',2,63.25,'2026-10-27','ID','Shop',88,'Food','รอตรวจสอบ','2026-10-28','','บันทึกเดิม'];
data=[{row:2,v:fields.map(f=>raw[headers.indexOf(f)]??'')},{row:3,v:['ID2','2026-10-27','Shop','Berry',250,'',179,'Fruit','ยืนยันแล้ว','','2026-10-28',1,'กรัม',2,'']}];render();
`,c);
assert.equal((el('#receiptTable thead tr').innerHTML.match(/<th>/g)||[]).length,11);
assert.equal((el('#rows').innerHTML.match(/<td/g)||[]).length,22);
assert(el('#rows').innerHTML.includes('<td>0.718</td><td>กิโลกรัม</td><td>2</td><td>63.25</td>'));
assert.deepEqual(Array.from(vm.runInContext('columns.slice(0,8).map(c=>c.label)',c)),['No.','Name','Description','Weight','Unit','Quantity','Price','Purchased Date']);
for(const key of [4,11,6,13,15]){
const click={target:{closest:()=>({dataset:{sort:String(key),label:'test'},closest:()=>el('th')})}};
for(const dir of [1,-1,0]){el('#receiptTable thead').onclick(click);assert.equal(vm.runInContext('sortDir',c),dir)}
assert.equal(vm.runInContext('sortCol',c),null);
}
const form=vm.runInContext('editorFields(data[0])',c);
for(let i=0;i<16;i++)assert(form.includes('name="c'+i+'"'));
assert(form.indexOf('name="c4"')<form.indexOf('name="c11"'));
vm.runInContext(`
const item=data[0];const physical=headers.map(h=>item.v[fields.indexOf(h)]??'');const mapped=fields.map(f=>physical[headers.indexOf(f)]??'');
if(JSON.stringify(mapped)!==JSON.stringify(item.v))throw Error('round trip failed');
`,c);
assert(el('#rows').innerHTML.includes('บันทึกเดิม'));
assert(form.includes('<textarea name="c15"'));
assert.equal(Array.from(vm.runInContext('columns.map(c=>c.label)',c)).at(-2),'หมายเหตุ');
console.log('PASS: sheet mapping, 10 data fields, 11 cells incl. actions, edit fields, distinct weight/quantity, 3-state sorting and round-trip writes');

vm.runInContext(`
function fixture(name,qty,bought,finished,weight=500,unit='กรัม',status='ยืนยันแล้ว'){return {row:2,v:['ID',bought,'Shop',name,weight,'',10,'Food',status,'','2026-10-29',qty,unit,1,finished]}}
const usage=[fixture('Rice',2,'2026-10-25','2026-11-01'),fixture('Rice',3,'2026-11-10','2026-11-30'),fixture('Rice','','2026-11-01','',1000),fixture('Egg',30,'2026-10-01','2026-10-01','','ฟอง'),fixture('Bad',4,'2026-11-15','2026-11-01')];
const oct=summarizeMonth(usage,'2026-10'),nov=summarizeMonth(usage,'2026-11');
const octRice=oct.groups.find(g=>g.name==='Rice');if(average(octRice.days)!==7)throw Error('Purchase-month duration must include later completion');
if(oct.totals.boughtFinished!==2||nov.totals.boughtFinished!==1)throw Error('Top card must count completed purchases of selected month, including later completion');
if(summarizeMonth([fixture('Old purchase',1,'2026-09-01','2026-11-01')],'2026-11').totals.boughtFinished!==0)throw Error('Exclude older purchases completed in selected month');
if(oct.totals.bought!==2||oct.totals.finished!==1)throw Error('October event allocation');
const rice=nov.groups.find(g=>g.name==='Rice'&&g.weight===500);
if(rice.boughtQuantity!==3||rice.finishedQuantity!==5||average(rice.days)!==20)throw Error('Cross-month usage / duration');
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
const noteOriginal=data[0],noteNext=noteOriginal.v.slice();noteNext[15]='เพิ่มเติม <ทดสอบ>';
const noteChanges=changesFor(noteOriginal,noteNext);if(noteChanges.length!==1||!noteChanges[0].range.endsWith('!P2')||noteChanges[0].values[0][0]!==noteNext[15])throw Error('Sparse note write');
headers=[headers[15],...headers.slice(0,15)];if(!changesFor(noteOriginal,noteNext)[0].range.endsWith('!A2'))throw Error('Reordered note header write');headers=[...headers.slice(1),headers[0]];
const original=data[0],next=original.v.slice();next[14]='2026-11-01';
const changes=changesFor(original,next);
if(changes.length!==1||!changes[0].range.endsWith('!O2')||changes[0].values[0][0]!=='2026-11-01')throw Error('Write only date cell');
headers=[headers[14],...headers.slice(0,14)];
if(!changesFor(original,next)[0].range.endsWith('!A2'))throw Error('Reordered header write');
token='test';data=usage;$('#summaryMonth').value='2026-11';renderMonthly();
if(!$('#monthlyCards').innerHTML.includes('ใช้หมดแล้วจากที่ซื้อในเดือน (รายการ)</span><strong>1</strong>'))throw Error('Purchase cohort card value');
if(!$('#monthlyHistory').innerHTML.includes('2026-06'))throw Error('Six month history');
$('#summaryStatus').value='รอตรวจสอบ';renderMonthly();
if(!$('#monthlyRows').innerHTML.includes('ไม่มีรายการ'))throw Error('Status filter');
selectTab('monthly');if(!$('#receiptsPanel').hidden||$('#monthlyPanel').hidden)throw Error('Tabs');
clear();if($('#monthlyCards').innerHTML!=='')throw Error('Clear private summary on logout');
`,c);
console.log('PASS: cross-month totals, missing quantity, unit/size grouping, invalid dates, same-day/leap-year boundaries, sparse writes, reordered headers, filters, tabs and logout');
(async()=>{
const elements={};const get=s=>elements[s]??={value:'',innerHTML:'',textContent:'',addEventListener(){},close(){},showModal(){},removeAttribute(){},setAttribute(){}};
let cells=[['No.','Name','Description','Weight','Unit','Quantity','Price','Purchased Date','รหัสใบเสร็จ','ร้านค้า','ราคาต่อกก.','หมวดหมู่','สถานะ','วันที่เพิ่มรายการ','วันที่ใช้หมด','หมายเหตุ','External formula'],[1,'Rice','500 g',500,'กรัม',2,50,'2026-10-27','id','shop','','food','ยืนยันแล้ว','2026-10-28','','หมายเหตุเดิม','=KEEP()']];
let requests=[],overrides={'c14':'2026-11-02'};
const ctx={window:{RECEIPT_CONFIG:{spreadsheetId:'test',sheetName:'test'}},document:{querySelector:get,querySelectorAll:()=>[]},sessionStorage:{getItem:()=>null,removeItem(){}},clearTimeout,setTimeout,console,FormData:class{get(k){return overrides[k]??null}},fetch:async(url,opts={})=>{
const path=decodeURIComponent(url.split('/spreadsheets/test')[1]);requests.push({path,opts});
if(path.startsWith('?'))return {ok:true,json:async()=>({sheets:[{properties:{title:'test',sheetId:0,gridProperties:{columnCount:27,rowCount:938}}}]})};
if(path==='/values:batchUpdate'){const body=JSON.parse(opts.body);assert.equal(body.valueInputOption,'RAW');for(const update of body.data){assert(["'test'!O2","'test'!P2"].includes(update.range));cells[1][update.range.endsWith('!O2')?14:15]=update.values[0][0]}return {ok:true,json:async()=>({})}}
return {ok:true,json:async()=>({values:path.includes('!A1:AA1?')?[cells[0]]:path.includes('!A2:AA2?')?[cells[1]]:cells})}
}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),ctx);
await vm.runInContext("token='test';load()",ctx);
assert.equal((get('#rows').innerHTML.match(/<td/g)||[]).length,11);
await get('#rows').onclick({target:{closest:()=>({dataset:{action:'edit',row:'2'}})}});
assert(get('#formFields').innerHTML.includes('name="c14"'));
await get('#editForm').onsubmit({preventDefault(){}});
assert.equal(cells[1][14],'2026-11-02');assert.equal(cells[1][15],'หมายเหตุเดิม');assert.equal(cells[1][16],'=KEEP()');
assert.equal(get('#dialogError').textContent,'');
get('#summaryMonth').value='2026-11';get('#monthlyTab').onclick();
assert(get('#monthlyRows').innerHTML.includes('ไม่มีรายการซื้อ'));
get('#summaryMonth').value='2026-10';get('#monthlyTab').onclick();
assert(get('#monthlyRows').innerHTML.includes('Rice'));
assert(get('#monthlyRows').innerHTML.includes('>6</td>'));
assert.equal((get('#monthlyRows').innerHTML.match(/<td/g)||[]).length,6);
await get('#rows').onclick({target:{closest:()=>({dataset:{action:'edit',row:'2'}})}});
overrides={c15:'ใหม่ <ทดสอบ>'};await get('#editForm').onsubmit({preventDefault(){}});
assert.equal(cells[1][15],'ใหม่ <ทดสอบ>');assert.equal(cells[1][14],'2026-11-02');assert.equal(cells[1][16],'=KEEP()');
assert(get('#rows').innerHTML.includes('ใหม่ &lt;ทดสอบ&gt;'));
const noteWrite=JSON.parse(requests.filter(r=>r.path==='/values:batchUpdate').at(-1).opts.body);assert.equal(noteWrite.data.length,1);assert.equal(noteWrite.data[0].range,"'test'!P2");

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

assert.equal(vm.runInContext('monthlyColumns.length',c),6);
assert(!el('#monthlyHeaders').innerHTML.includes('ใช้หมด (Quantity)'));
vm.runInContext("token='test';data=usage;$('#summaryStatus').value='';$('#summaryMonth').value='2026-11';renderMonthly()",c);
assert(!el('#monthlyCards').innerHTML.includes('ยังไม่ใช้หมด ณ สิ้นเดือน'));
const summaryRows=el('#monthlyRows').innerHTML.match(/<tr>.*?<\/tr>/g)||[];
for(const row of summaryRows)assert.equal((row.match(/<td/g)||[]).length,6);
const security=require('./security-check.cjs');
assert.equal(security.findingsFor('config.js',fs.readFileSync(__dirname+'/config.js','utf8')).length,0);
assert(security.findingsFor('.env','EXAMPLE=1').length);
assert(security.findingsFor('test.js','const credential="'+('GOC'+'SPX-')+'a'.repeat(24)+'"').length);
assert(security.findingsFor('key.txt','-----BEGIN '+('PRIVATE'+' KEY')+'-----').length);
console.log('PASS: six summary headers / cells, removed metrics, public config allowed, secret guards reject sensitive files and credential formats');

vm.runInContext(`
headers=['No.','Name','Description','Weight','Unit','Quantity','Price','Purchased Date','รหัสใบเสร็จ','ร้านค้า','ราคาต่อกก.','หมวดหมู่','สถานะ','วันที่เพิ่มรายการ','วันที่ใช้หมด','หมายเหตุ'];
const liveExamples=[
[1,'CP กุ้งขาวถุงตาข่าย','26-30 ตัว 500 กรัม',500,'กรัม',1,209,'2026-10-27','id','shop','','อาหารสด','ยืนยันแล้ว','2026-10-28','2026-11-02',''],
[55,'ข้าวญี่ปุ่น','',2,'กิโลกรัม',1,159,46341,'id','shop','','อาหารแห้ง','ยืนยันแล้ว',46342,46342,''],
[61,'TAKOYAKI','',null,'แพ็ก',1,109,46341,'id','shop','','อาหารสด','ยืนยันแล้ว','2026-11-16',46341,'']
].map((r,i)=>({row:i+2,v:mapRow(r)}));
if(liveExamples[0].v[1]!=='2026-10-27'||liveExamples[0].v[14]!=='2026-11-02')throw Error('Live header mapping');
const liveOct=summarizeMonth(liveExamples,'2026-10'),liveNov=summarizeMonth(liveExamples,'2026-11');
if(average(liveOct.groups.find(g=>g.name==='CP กุ้งขาวถุงตาข่าย').days)!==6)throw Error('Live shrimp example should show six days in October');
if(average(liveNov.groups.find(g=>g.name==='ข้าวญี่ปุ่น').days)!==1)throw Error('Serial dates must produce one day');
const takoyaki=liveNov.groups.find(g=>g.name==='TAKOYAKI');if(monthlyColumns.at(-1).cell(takoyaki)!=='0')throw Error('Same-day average must display zero');
const mixed=summarizeMonth([fixture('Mixed',1,'2026-10-01','2026-11-01'),fixture('Mixed',1,'2026-10-02',''),fixture('Mixed',1,'2026-10-03','invalid')],'2026-10');
if(average(mixed.groups[0].days)!==31)throw Error('Exclude unfinished and invalid records from average denominator');
token='test';data=liveExamples;$('#summaryStatus').value='';$('#summaryMonth').value='2026-10';renderMonthly();
if(!$('#monthlyRows').innerHTML.includes('>6</td>')||$('#monthlyRows').innerHTML.includes('TAKOYAKI'))throw Error('Render purchase cohort only');
`,c);
console.log('PASS: live header mapping, cross-month duration, mixed serial/text dates, zero-day display and unfinished denominator');

vm.runInContext(`
const noteItems=[fixture('Notes',1,'2026-10-01','2026-11-01'),fixture('Notes',1,'2026-10-02',''),fixture('Notes',1,'2026-09-01','2026-10-01')];
noteItems[0].v[15]='เก็บเย็น <ทดสอบ>';noteItems[1].v[15]='เปิดแล้ว';noteItems[2].v[15]='หมายเหตุเดือนก่อน';
const noteModel=summarizeMonth(noteItems,'2026-10'),noteGroup=noteModel.groups.find(g=>g.name==='Notes');
if(noteGroup.notes.join('|')!=='เก็บเย็น <ทดสอบ>|เปิดแล้ว')throw Error('Aggregate notes from purchases in selected month only');
const noteCell=monthlyColumns.find(c=>c.label==='หมายเหตุ').cell(noteGroup);
if(!noteCell.includes('&lt;ทดสอบ&gt;')||noteCell.includes('หมายเหตุเดือนก่อน'))throw Error('Escape notes and exclude other purchase month');
`,c);
console.log('PASS: monthly purchase notes aggregation and safe rendering');
