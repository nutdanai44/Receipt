const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const els={};const el=s=>els[s]??={value:'',innerHTML:'',textContent:'',addEventListener(){},close(){},showModal(){},removeAttribute(){},setAttribute(){}};
const c={window:{RECEIPT_CONFIG:{spreadsheetId:'test',sheetName:'test'}},document:{querySelector:el,querySelectorAll:()=>[]},sessionStorage:{getItem:()=>null,removeItem(){}},clearTimeout,setTimeout,console};
vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),c);
vm.runInContext(`
headers=['No.','Name','Description','Weight','Unit','Quantity','Price','Purchased Date','รหัสใบเสร็จ','ร้านค้า','ราคาต่อกก.','หมวดหมู่','สถานะ','วันที่เพิ่มรายการ'];
const raw=[1,'Chicken','88 baht/kg',0.718,'กิโลกรัม',2,63.25,'2026-10-27','ID','Shop',88,'Food','รอตรวจสอบ','2026-10-28'];
data=[{row:2,v:fields.map(f=>raw[headers.indexOf(f)]??'')},{row:3,v:['ID2','2026-10-27','Shop','Berry',250,'',179,'Fruit','ยืนยันแล้ว','','2026-10-28',1,'กรัม',2]}];render();
`,c);
assert.equal((el('thead tr').innerHTML.match(/<th>/g)||[]).length,9);
assert.equal((el('#rows').innerHTML.match(/<td/g)||[]).length,18);
assert(el('#rows').innerHTML.includes('<td>0.718</td><td>กิโลกรัม</td><td>2</td><td>63.25</td>'));
assert.deepEqual(Array.from(vm.runInContext('columns.slice(0,8).map(c=>c.label)',c)),['No.','Name','Description','Weight','Unit','Quantity','Price','Purchased Date']);
for(const key of [4,11,6,13]){
const click={target:{closest:()=>({dataset:{sort:String(key),label:'test'},closest:()=>el('th')})}};
for(const dir of [1,-1,0]){el('thead').onclick(click);assert.equal(vm.runInContext('sortDir',c),dir)}
assert.equal(vm.runInContext('sortCol',c),null);
}
const form=vm.runInContext('editorFields(data[0])',c);
for(let i=0;i<14;i++)assert(form.includes('name="c'+i+'"'));
assert(form.indexOf('name="c4"')<form.indexOf('name="c11"'));
vm.runInContext(`
const item=data[0];const physical=headers.map(h=>item.v[fields.indexOf(h)]??'');const mapped=fields.map(f=>physical[headers.indexOf(f)]??'');
if(JSON.stringify(mapped)!==JSON.stringify(item.v))throw Error('round trip failed');
`,c);
console.log('PASS: sheet mapping, 8 requested fields, 9 cells incl. actions, edit fields, distinct weight/quantity, 3-state sorting and round-trip writes');
