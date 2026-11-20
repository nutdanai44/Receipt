const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const els={},controls={};const el=s=>els[s]??={value:'',innerHTML:'',textContent:'',hidden:false,disabled:false,replaceChildren(){this.innerHTML=''},addEventListener(){},close(){},showModal(){},removeAttribute(){},setAttribute(){},focus(){},querySelectorAll(){return []},reset(){for(const v of Object.values(controls))v.value=''},elements:{namedItem(k){return controls[k]??={value:'',focus(){}}}}};
// Deliberately reordered physical headers and an unrelated formula column.
let dining=[['หมายเหตุ','ร้านอาหาร','รหัสใบเสร็จ','วันที่','ยอดรวม','จำนวนคน','สถานะ','ลิงก์ใบเสร็จ','วันที่เพิ่มรายการ','External'],['เดิม','Beta','d1','2026-11-14',100,2,'ยืนยันแล้ว','https://example.com/slip','stamp','=KEEP()'],['','Alpha','d2',46341,200,'','รอตรวจสอบ','','stamp','']];
let requests=[];const groceryHeaders=['รหัสใบเสร็จ','Purchased Date','ร้านค้า','Name','Weight','ราคาต่อกก.','Price','หมวดหมู่','สถานะ','Description','วันที่เพิ่มรายการ','Quantity','Unit','No.','วันที่ใช้หมด','หมายเหตุ'];
const c={console,window:{RECEIPT_CONFIG:{spreadsheetId:'test',sheetName:'รายการใบเสร็จ'}},document:{querySelector:el,querySelectorAll:()=>[]},sessionStorage:{getItem:()=>null,removeItem(){}},clearTimeout,setTimeout,URL,crypto:{randomUUID:()=> 'new-id'},confirm:()=>true,FormData:class{get(k){return el('#diningForm').elements.namedItem(k).value}},fetch:async(url,opts={})=>{
const path=decodeURIComponent(url.split('/spreadsheets/test')[1]);requests.push({path,opts});let json={};
if(path.startsWith('?'))json={sheets:[{properties:{title:'ค่าอาหารนอกบ้าน',sheetId:777,gridProperties:{columnCount:12,rowCount:100}}},{properties:{title:'รายการใบเสร็จ',sheetId:0,gridProperties:{columnCount:20,rowCount:100}}}]};
else if(path.startsWith('/values:batchUpdate')){const body=JSON.parse(opts.body);assert.equal(body.valueInputOption,'RAW');for(const change of body.data){assert(change.range.startsWith("'ค่าอาหารนอกบ้าน'!"));const match=change.range.match(/!([A-Z]+)(\d+)$/);let col=0;for(const ch of match[1])col=col*26+ch.charCodeAt(0)-64;dining[Number(match[2])-1][col-1]=change.values[0][0]}}
else if(path===':batchUpdate'){const range=JSON.parse(opts.body).requests[0].deleteDimension.range;assert.equal(range.sheetId,777);dining.splice(range.startIndex,range.endIndex-range.startIndex)}
else if(path.includes(':append?')){assert(path.includes("'ค่าอาหารนอกบ้าน'!"));assert(path.includes('valueInputOption=RAW'));dining.push(JSON.parse(opts.body).values[0])}
else if(path.includes("'รายการใบเสร็จ'!"))json={values:[groceryHeaders]};
else if(path.includes("'ค่าอาหารนอกบ้าน'!A1:L1?"))json={values:[dining[0]]};
else if(path.match(/!A(\d+):L\1\?/)){const row=Number(path.match(/!A(\d+)/)[1]);json={values:[dining[row-1]]}}
else if(path.includes("'ค่าอาหารนอกบ้าน'!"))json={values:dining};else throw Error('Unexpected path '+path);
return {ok:true,json:async()=>json}
}};
vm.createContext(c);for(const f of ['app.js','dining.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+f,'utf8'),c);
const run=s=>vm.runInContext(s,c);const form=v=>{for(const [k,value]of Object.entries(v))el('#diningForm').elements.namedItem(k).value=value};const clickSort=()=>el('#diningHeaders').onclick({target:{closest:()=>({dataset:{diningSort:'2'}})}});
(async()=>{
await run("token='test';load()");assert.equal(run('data.length'),0);assert.equal(run('diningData.length'),2);assert.equal(run('diningData[1].v[1]'),'2026-11-15');assert(el('#diningCards').innerHTML.includes('300.00'));
assert.equal((el('#diningHeaders').innerHTML.match(/<th/g)||[]).length,8);assert.equal((el('#diningRows').innerHTML.match(/<td/g)||[]).length,16);
clickSort();assert(el('#diningRows').innerHTML.indexOf('Alpha')<el('#diningRows').innerHTML.indexOf('Beta'));clickSort();assert(el('#diningRows').innerHTML.indexOf('Beta')<el('#diningRows').innerHTML.indexOf('Alpha'));clickSort();assert.equal(run('diningSort'),null);assert(el('#diningRows').innerHTML.indexOf('Beta')<el('#diningRows').innerHTML.indexOf('Alpha'));
el('#diningStatus').value='ยืนยันแล้ว';el('#diningStatus').onchange();assert(el('#diningCards').innerHTML.includes('100.00'));el('#diningStatus').value='';
el('#diningMonth').value='2026-10';el('#diningMonth').onchange();assert(el('#diningRows').innerHTML.includes('ยังไม่มีใบเสร็จ'));el('#diningAllMonths').onclick();assert.equal(el('#diningMonth').value,'');
run('diningOpen(diningData[0])');form({note:'ใหม่ <ทดสอบ>\nบรรทัดสอง'});await el('#diningForm').onsubmit({preventDefault(){}});assert.equal(dining[1][0],'ใหม่ <ทดสอบ>\nบรรทัดสอง');assert.equal(dining[1][9],'=KEEP()');assert.equal(dining[1][8],'stamp');assert(el('#diningRows').innerHTML.includes('&lt;ทดสอบ&gt;'));const write=JSON.parse(requests.find(r=>r.path==='/values:batchUpdate').opts.body);assert.equal(write.data.length,1);assert.equal(write.data[0].range,"'ค่าอาหารนอกบ้าน'!A2");
run('diningOpen()');form({date:'2026-11-16',restaurant:'New Restaurant',amount:'350',people:'3',status:'ยืนยันแล้ว',note:'เพิ่ม',receiptUrl:'https://example.com/new'});await el('#diningForm').onsubmit({preventDefault(){}});assert.equal(dining.length,4);assert.equal(dining[3][0],'เพิ่ม');assert.equal(dining[3][2],'DINING-new-id');assert.equal(dining[3][4],350);assert.equal(dining[3][9],'');
run('diningOpen(diningData[0])');dining[1][1]='Changed elsewhere';form({note:'must not write'});const before=requests.filter(r=>r.path==='/values:batchUpdate').length;await el('#diningForm').onsubmit({preventDefault(){}});assert(el('#diningFormMessage').textContent.includes('Refresh'));assert.equal(requests.filter(r=>r.path==='/values:batchUpdate').length,before);await run('loadDining()');
assert.equal(run("diningLink('javascript:alert(1)')"),'');run('diningOpen()');form({date:'2026-11-16',restaurant:'X',amount:'-1',status:'ยืนยันแล้ว'});await el('#diningForm').onsubmit({preventDefault(){}});assert(el('#diningFormMessage').textContent.includes('ยอดรวม'));
await el('#diningRows').onclick({target:{closest:()=>({dataset:{diningAction:'delete',row:'2'}})}});assert.equal(dining.length,3);assert.equal(run('data.length'),0);
run("selectTab('dining')");assert.equal(el('#diningPanel').hidden,false);assert.equal(el('#monthlyPanel').hidden,true);assert.equal(el('#receiptsPanel').hidden,true);
run('clear()');assert.equal(run('diningData.length'),0);assert.equal(el('#diningCards').innerHTML,'');assert(!el('#diningRows').innerHTML.includes('New Restaurant'));assert.equal(el('#diningForm').hidden,true);
const html=fs.readFileSync(__dirname+'/index.html','utf8');for(const key of Object.keys(els).filter(s=>/^#[\w]+$/.test(s)))assert(html.includes('id="'+key.slice(1)+'"'),'Missing DOM '+key);
console.log('PASS: independent dining load/CRUD, name-based header mapping, native dates, sparse writes, external-column preservation, stale edits, 3-state sorting, filters, tabs, validation, safe links, logout and DOM IDs');
})().catch(e=>{console.error(e);process.exitCode=1});
