const cfg=window.RECEIPT_CONFIG,$=s=>document.querySelector(s);let token='',data=[],expiry,sheetId=null,busy=false,editing=null,sortCol=null,sortDir=0,headers=[],lastColumn='O';
const fields=['รหัสใบเสร็จ','Purchased Date','ร้านค้า','Name','Weight','ราคาต่อกก.','Price','หมวดหมู่','สถานะ','Description','วันที่เพิ่มรายการ','Quantity','Unit','No.','วันที่ใช้หมด'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(cfg.spreadsheetId),tab="'"+cfg.sheetName.replaceAll("'","''")+"'";
function auth(){const on=!!token;$('#login').hidden=on;$('#logout').hidden=!on;$('#refresh').disabled=!on||busy}
function clear(){sessionStorage.removeItem('receipt.session');token='';data=[];clearTimeout(expiry);$('#editor').close();render();auth()}
async function api(path,options={}){if(!token)throw Error('กรุณาเข้าสู่ระบบใหม่');const r=await fetch(root+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error?.message||'Google Sheets ไม่ตอบรับ');return j}
const quantity=r=>r[11];
const unit=r=>r[12];
const plain=(r,i)=>esc(r[i]!==''?r[i]:'—');
const columns=[
{label:'No.',key:13,cell:x=>plain(x.v,13)},
{label:'Name',key:3,cell:x=>plain(x.v,3)},
{label:'Description',key:9,className:'note',cell:x=>plain(x.v,9)},
{label:'Weight',key:4,cell:x=>plain(x.v,4)},
{label:'Unit',key:12,cell:x=>plain(x.v,12)},
{label:'Quantity',key:11,cell:x=>plain(x.v,11)},
{label:'Price',key:6,cell:x=>Number(x.v[6]||0).toLocaleString('th-TH',{minimumFractionDigits:2})},
{label:'Purchased Date',key:1,cell:x=>plain(x.v,1)},
{label:'วันที่ใช้หมด',key:14,cell:x=>plain(x.v,14)},
{label:'จัดการ',className:'actions',cell:x=>'<button data-action="edit" data-row="'+x.row+'" aria-label="แก้ไข '+esc(x.v[3])+'" '+(busy?'disabled':'')+'>✎</button><button data-action="delete" data-row="'+x.row+'" class="danger" '+(busy?'disabled':'')+'>ลบ</button>'}
];
const editOrder=[13,3,9,4,12,11,6,1,14,7,8,2,0,5,10];
const numericFields=[4,5,6,11,13];
function editorFields(item){return editOrder.map(i=>{
const f=fields[i],value=item.v[i];
let control;
if(i===8)control='<select name="c8">'+['รอตรวจสอบ','ยืนยันแล้ว'].map(v=>'<option '+(value===v?'selected':'')+'>'+v+'</option>').join('')+'</select>';
else if(i===12){const units=[...new Set(['','กิโลกรัม','กรัม','ชิ้น','แพ็ก','ถุง','กล่อง','ขวด','ฟอง',String(value)])];control='<select name="c12">'+units.map(v=>'<option value="'+esc(v)+'" '+(value===v?'selected':'')+'>'+esc(v||'—')+'</option>').join('')+'</select>'}
else control='<input name="c'+i+'" value="'+esc(value)+'" '+(numericFields.includes(i)?'type="number" step="any" min="0"':[1,14].includes(i)?'type="date"':'')+' '+(i===3?'required':'')+' '+([10,13].includes(i)?'readonly':'')+'>';
return '<label>'+f+control+(i===14?'<small class="muted">เว้นว่างถ้ายังใช้ไม่หมด • ใช้ครบ Quantity ทั้งรายการแล้วจึงระบุวันที่</small>':'')+'</label>';
}).join('')}

document.querySelector('#receiptTable thead tr').innerHTML=columns.map(c=>'<th>'+(c.key!==undefined?'<button type="button" data-sort="'+c.key+'" data-label="'+c.label+'">'+c.label+' ↕</button>':c.label)+'</th>').join('');
const sortValue=(r,col)=>col===11?quantity(r):col===12?unit(r):r[col];
function render(){let list=data.filter(x=>{const r=x.v;return(!$('#status').value||r[8]===$('#status').value)&&(!$('#start').value||r[1]>=$('#start').value)&&(!$('#end').value||r[1]&&r[1]<=$('#end').value)});const col=sortCol,dir=sortDir;if(sortCol!==null)list.sort((a,b)=>dir*(numericFields.includes(col)?Number(sortValue(a.v,col)||0)-Number(sortValue(b.v,col)||0):String(sortValue(a.v,col)||'').localeCompare(String(sortValue(b.v,col)||''),'th',{numeric:true})));$('#total').textContent=token?`${list.length} รายการ · ฿${list.reduce((n,x)=>n+Number(x.v[6]||0),0).toLocaleString('th-TH',{minimumFractionDigits:2})}`:'เข้าสู่ระบบเพื่ออ่านข้อมูลส่วนตัว';$('#rows').innerHTML=list.map(x=>'<tr>'+columns.map(c=>'<td'+(c.className?' class="'+c.className+'"':'')+'>'+c.cell(x)+'</td>').join('')+'</tr>').join('');renderMonthly()}

async function load(){data=[];render();$('#error').textContent='';$('#info').textContent='กำลังอ่าน Google Sheet…';try{const meta=await api('?fields=sheets.properties');const sheet=meta.sheets.find(s=>s.properties.title===cfg.sheetName);if(!sheet)throw Error('ไม่พบแท็บรายการใบเสร็จ');sheetId=sheet.properties.sheetId;lastColumn=columnName(sheet.properties.gridProperties.columnCount);const result=await api('/values/'+encodeURIComponent(tab+'!A1:'+lastColumn+sheet.properties.gridProperties.rowCount)+'?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER');headers=result.values?.[0]||[];if(fields.some(h=>headers.filter(v=>v===h).length!==1))throw Error('โครงสร้าง Sheet เปลี่ยน กรุณาตรวจหัวคอลัมน์');data=(result.values||[]).slice(1).map((r,i)=>({row:i+2,v:mapRow(r)})).filter(x=>x.v[0]||x.v[3]);render();$('#info').textContent='ข้อมูลล่าสุดจาก Google Sheet · '+new Date().toLocaleTimeString('th-TH')}catch(e){$('#info').textContent='ไม่สามารถโหลดข้อมูลล่าสุด';$('#error').textContent=e.message}}
async function check(item){
const [head,row]=await Promise.all([api('/values/'+encodeURIComponent(tab+'!A1:'+lastColumn+'1')+'?valueRenderOption=UNFORMATTED_VALUE'),api('/values/'+encodeURIComponent(tab+'!A'+item.row+':'+lastColumn+item.row)+'?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER')]);
if(JSON.stringify(head.values?.[0]||[])!==JSON.stringify(headers))throw Error('หัวคอลัมน์เปลี่ยนแล้ว กรุณา Refresh ก่อนบันทึก');
const v=mapRow(row.values?.[0]||[]);if(JSON.stringify(v)!==JSON.stringify(item.v))throw Error('รายการถูกแก้ไขหรือย้ายแถวแล้ว กรุณา Refresh ก่อนลองใหม่');
}
function columnName(n){let name='';while(n>0){n--;name=String.fromCharCode(65+n%26)+name;n=Math.floor(n/26)}return name}
function normalizeDate(value){
if(value===''||value==null)return '';
if(typeof value==='number'&&Number.isFinite(value)){const d=new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000);if(!Number.isNaN(d.getTime()))return d.toISOString().slice(0,10)}
return String(value).trim();
}
function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s}

function mapRow(raw){return fields.map((f,i)=>[1,10,14].includes(i)?normalizeDate(raw[headers.indexOf(f)]??''):raw[headers.indexOf(f)]??'')}
function validateDates(v){for(const i of [1,14])if(v[i]&&!validDate(v[i]))throw Error('กรุณาระบุ '+fields[i]+' เป็นวันที่ที่ถูกต้อง');if(v[14]&&v[1]&&v[14]<v[1])throw Error('วันที่ใช้หมดต้องไม่ก่อนวันที่ซื้อ')}
function changesFor(item,v){return fields.flatMap((f,i)=>v[i]===item.v[i]?[]:[{range:tab+'!'+columnName(headers.indexOf(f)+1)+item.row,values:[[v[i]]]}])}

function lock(value){busy=value;auth();render();$('#save').disabled=value;$('#cancel').disabled=value}
$('#rows').onclick=async e=>{const b=e.target.closest('button[data-action]');if(!b||busy)return;const item=data.find(x=>x.row===Number(b.dataset.row));if(!item)return;if(b.dataset.action==='edit'){editing=item;$('#formFields').innerHTML=editorFields(item);$('#dialogError').textContent='';$('#editor').showModal();return}if(!confirm('ยืนยันลบ “'+item.v[3]+'” ออกจาก Google Sheet? การลบนี้มีผลกับทุกคน'))return;lock(true);try{await check(item);await api(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{deleteDimension:{range:{sheetId,dimension:'ROWS',startIndex:item.row-1,endIndex:item.row}}}]})});await load()}catch(err){$('#error').textContent=err.message}finally{lock(false)}};
$('#editForm').onsubmit=async e=>{e.preventDefault();if(busy||!editing)return;const f=new FormData(e.target),v=fields.map((_,i)=>{const value=f.get('c'+i)??editing.v[i];return numericFields.includes(i)&&value!==''?Number(value):value});lock(true);try{validateDates(v);await check(editing);const changes=changesFor(editing,v);if(changes.length)await api('/values:batchUpdate',{method:'POST',body:JSON.stringify({valueInputOption:'RAW',data:changes})});$('#editor').close();await load()}catch(err){$('#dialogError').textContent=err.message}finally{lock(false)}};
$('#cancel').onclick=()=>$('#editor').close();$('#editor').addEventListener('cancel',e=>{if(busy)e.preventDefault()});
function currentBangkokMonth(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit'}).formatToParts(new Date());return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value}
function monthRange(month){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return null;const [y,m]=month.split('-').map(Number);return {start:month+'-01',end:new Date(Date.UTC(y,m,0)).toISOString().slice(0,10)}}
function shiftMonth(month,offset){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+offset,1)).toISOString().slice(0,7)}
function numberOrMissing(value){if(value===''||value==null)return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null}
const fmt=n=>Number(n).toLocaleString('th-TH',{maximumFractionDigits:3});
const money=n=>Number(n).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const average=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
function summarizeMonth(items,month){
const range=monthRange(month);if(!range)return null;
const groups=new Map(),totals={bought:0,finished:0,open:0,amount:0,missingQuantity:0,invalidDates:0,days:[]};
for(const item of items){
const r=item.v,purchased=validDate(r[1])?r[1]:'',finished=validDate(r[14])?r[14]:'';
const invalid=!!((r[1]&&!purchased)||(r[14]&&!finished)||(purchased&&finished&&finished<purchased));
if(invalid)totals.invalidDates++;
const usableFinished=!invalid?finished:'';
const bought=!!purchased&&purchased>=range.start&&purchased<=range.end;
const done=!!usableFinished&&usableFinished>=range.start&&usableFinished<=range.end;
const open=!!purchased&&purchased<=range.end&&(!usableFinished||usableFinished>range.end);
if(!bought&&!done&&!open)continue;
const name=String(r[3]||'ไม่ระบุชื่อ').trim().replace(/\s+/g,' '),weight=r[4]??'',unit=String(r[12]||'').trim();
const key=JSON.stringify([name.toLocaleLowerCase('th-TH'),String(weight),unit]);
if(!groups.has(key))groups.set(key,{name,weight,unit,bought:0,finished:0,open:0,boughtQuantity:0,finishedQuantity:0,missingBought:0,missingFinished:0,amount:0,days:[]});
const g=groups.get(key),qty=numberOrMissing(r[11]);
if(bought){totals.bought++;totals.amount+=numberOrMissing(r[6])??0;g.bought++;g.amount+=numberOrMissing(r[6])??0;if(qty===null){g.missingBought++;totals.missingQuantity++}else g.boughtQuantity+=qty}
if(done){totals.finished++;g.finished++;if(qty===null){g.missingFinished++;if(!bought)totals.missingQuantity++}else g.finishedQuantity+=qty;if(purchased){const days=(Date.parse(usableFinished+'T00:00:00Z')-Date.parse(purchased+'T00:00:00Z'))/86400000;g.days.push(days);totals.days.push(days)}}
if(open){totals.open++;g.open++}
}
return {month,range,totals,groups:[...groups.values()].sort((a,b)=>b.finished-a.finished||b.bought-a.bought||a.name.localeCompare(b.name,'th',{numeric:true}))};
}
function quantityCell(g,prefix){const count=g[prefix],missing=g[prefix==='bought'?'missingBought':'missingFinished'];const known=g[prefix+'Quantity'];return (count>0&&missing===count?'—':fmt(known))+(missing?'<small>ไม่ระบุ Quantity '+fmt(missing)+' รายการ</small>':'')}
function renderMonthly(){
const month=$('#summaryMonth').value,range=monthRange(month);
if(!token||!range){$('#monthlyMessage').textContent=!token?'เข้าสู่ระบบเพื่อดูสรุปข้อมูลส่วนตัว':'กรุณาเลือกเดือนที่ต้องการดู';$('#monthlyCards').innerHTML='';$('#monthlyRows').innerHTML='<tr><td colspan="7" class="empty">'+(!token?'ยังไม่ได้เข้าสู่ระบบ':'ยังไม่ได้เลือกเดือน')+'</td></tr>';$('#monthlyHistory').innerHTML='';return}
const status=$('#summaryStatus').value,search=$('#monthlySearch').value.trim().toLocaleLowerCase('th-TH');
const items=data.filter(x=>(!status||x.v[8]===status)&&(!search||String(x.v[3]).toLocaleLowerCase('th-TH').includes(search)));
const model=summarizeMonth(items,month),t=model.totals;
const statusLabel=status||'ทั้งหมด (รวมรอตรวจสอบ)';
$('#monthlyMessage').textContent='เดือน '+month+' · สถานะ: '+statusLabel+' · '+(search?'ค้นหา: '+$('#monthlySearch').value+' · ':'')+'ไม่รวมตัวกรองวันที่ของแท็บรายการใบเสร็จ'+(t.missingQuantity?' · ยังไม่ระบุ Quantity '+t.missingQuantity+' รายการ':'')+(t.invalidDates?' · วันที่ไม่ถูกต้อง '+t.invalidDates+' รายการ ไม่นับเป็นการใช้หมด':'');
$('#monthlyCards').innerHTML=[['ยอดซื้อในเดือน','฿'+money(t.amount)],['ซื้อในเดือน (รายการ)',fmt(t.bought)],['ใช้หมดในเดือน (รายการ)',fmt(t.finished)],['ยังไม่ใช้หมด ณ สิ้นเดือน (รายการ)',fmt(t.open)]].map(([label,value])=>'<div class="summary-card"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>').join('');
$('#monthlyRows').innerHTML=model.groups.length?model.groups.map(g=>'<tr><td>'+esc(g.name)+'</td><td>'+esc(g.weight!==''?fmt(g.weight)+(g.unit?' '+g.unit:' (ไม่ระบุหน่วย)'):(g.unit||'—'))+'</td><td class="numeric">'+quantityCell(g,'bought')+'</td><td class="numeric">'+quantityCell(g,'finished')+'</td><td class="numeric">'+money(g.amount)+'</td><td class="numeric">'+(g.days.length?fmt(average(g.days)):'—')+'</td><td class="numeric">'+fmt(g.open)+'</td></tr>').join(''):'<tr><td colspan="7" class="empty">ไม่มีรายการซื้อ ใช้หมด หรือค้างใช้ตามตัวกรองนี้</td></tr>';
$('#monthlyHistory').innerHTML=Array.from({length:6},(_,i)=>{const m=shiftMonth(month,i-5),x=summarizeMonth(items,m).totals;return '<tr><td>'+esc(m)+'</td><td class="numeric">'+fmt(x.bought)+'</td><td class="numeric">'+fmt(x.finished)+'</td><td class="numeric">'+money(x.amount)+'</td><td class="numeric">'+(x.days.length?fmt(average(x.days)):'—')+'</td></tr>'}).join('');
}
function selectTab(name){const monthly=name==='monthly';$('#receiptsPanel').hidden=monthly;$('#monthlyPanel').hidden=!monthly;for(const id of ['receipts','monthly']){const active=id===name;$('#'+id+'Tab').setAttribute('aria-selected',String(active));$('#'+id+'Tab').tabIndex=active?0:-1}if(monthly)renderMonthly()}
$('#summaryMonth').value=currentBangkokMonth();
$('#receiptsTab').onclick=()=>selectTab('receipts');$('#monthlyTab').onclick=()=>selectTab('monthly');
for(const id of ['receipts','monthly'])$('#'+id+'Tab').onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const target=e.key==='Home'?'receipts':e.key==='End'?'monthly':id==='receipts'?'monthly':'receipts';selectTab(target);$('#'+target+'Tab').focus()}};
['#summaryMonth','#summaryStatus'].forEach(s=>$(s).onchange=renderMonthly);$('#monthlySearch').oninput=renderMonthly;

$('#login').onclick=()=>{if(!window.google?.accounts?.oauth2){$('#error').textContent='Google ยังไม่พร้อม กรุณาลองใหม่';return}google.accounts.oauth2.initTokenClient({client_id:cfg.clientId,scope:'https://www.googleapis.com/auth/spreadsheets',callback:r=>{if(r.error){$('#error').textContent=r.error;return}clearTimeout(expiry);token=r.access_token;sessionStorage.setItem('receipt.session',JSON.stringify({token,expiresAt:Date.now()+Number(r.expires_in||3600)*1000}));expiry=setTimeout(clear,Number(r.expires_in||3600)*1000);auth();load()}}).requestAccessToken()};$('#logout').onclick=()=>{if(token&&window.google)google.accounts.oauth2.revoke(token,()=>{});clear()};$('#refresh').onclick=load;['#status','#start','#end'].forEach(s=>$(s).onchange=render);auth();render();

document.querySelector('#receiptTable thead').onclick=e=>{const b=e.target.closest('[data-sort]');if(!b)return;const col=Number(b.dataset.sort);if(sortCol!==col){sortCol=col;sortDir=1}else if(sortDir===1){sortDir=-1}else{sortCol=null;sortDir=0}document.querySelectorAll('#receiptTable th').forEach(th=>th.removeAttribute('aria-sort'));if(sortCol!==null)b.closest('th').setAttribute('aria-sort',sortDir===1?'ascending':'descending');document.querySelectorAll('#receiptTable [data-sort]').forEach(x=>{x.textContent=x.dataset.label+(Number(x.dataset.sort)===sortCol?(sortDir===1?' ↑':' ↓'):' ↕')});render()};

try{const saved=JSON.parse(sessionStorage.getItem('receipt.session')||'null');if(saved?.token&&saved.expiresAt>Date.now()){token=saved.token;expiry=setTimeout(clear,saved.expiresAt-Date.now());auth();load()}else{sessionStorage.removeItem('receipt.session')}}catch{sessionStorage.removeItem('receipt.session')}
