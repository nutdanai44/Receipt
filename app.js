const cfg=window.RECEIPT_CONFIG,$=s=>document.querySelector(s);let token='',data=[],expiry,sheetId=null,busy=false,editing=null,sortCol=null,sortDir=0,headers=[];
const fields=['รหัสใบเสร็จ','Purchased Date','ร้านค้า','Name','Weight','ราคาต่อกก.','Price','หมวดหมู่','สถานะ','Description','วันที่เพิ่มรายการ','Quantity','Unit','No.'];
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
{label:'จัดการ',className:'actions',cell:x=>'<button data-action="edit" data-row="'+x.row+'" aria-label="แก้ไข '+esc(x.v[3])+'" '+(busy?'disabled':'')+'>✎</button><button data-action="delete" data-row="'+x.row+'" class="danger" '+(busy?'disabled':'')+'>ลบ</button>'}
];
const editOrder=[13,3,9,4,12,11,6,1,7,8,2,0,5,10];
const numericFields=[4,5,6,11,13];
function editorFields(item){return editOrder.map(i=>{
const f=fields[i],value=item.v[i];
let control;
if(i===8)control='<select name="c8">'+['รอตรวจสอบ','ยืนยันแล้ว'].map(v=>'<option '+(value===v?'selected':'')+'>'+v+'</option>').join('')+'</select>';
else if(i===12){const units=[...new Set(['','กิโลกรัม','กรัม','ชิ้น','แพ็ก','ถุง','กล่อง','ขวด','ฟอง',String(value)])];control='<select name="c12">'+units.map(v=>'<option value="'+esc(v)+'" '+(value===v?'selected':'')+'>'+esc(v||'—')+'</option>').join('')+'</select>'}
else control='<input name="c'+i+'" value="'+esc(value)+'" '+(numericFields.includes(i)?'type="number" step="any" min="0"':'')+' '+(i===3?'required':'')+' '+([10,13].includes(i)?'readonly':'')+'>';
return '<label>'+f+control+'</label>';
}).join('')}

document.querySelector('thead tr').innerHTML=columns.map(c=>'<th>'+(c.key!==undefined?'<button type="button" data-sort="'+c.key+'" data-label="'+c.label+'">'+c.label+' ↕</button>':c.label)+'</th>').join('');
const sortValue=(r,col)=>col===11?quantity(r):col===12?unit(r):r[col];
function render(){let list=data.filter(x=>{const r=x.v;return(!$('#status').value||r[8]===$('#status').value)&&(!$('#start').value||r[1]>=$('#start').value)&&(!$('#end').value||r[1]&&r[1]<=$('#end').value)});const col=sortCol,dir=sortDir;if(sortCol!==null)list.sort((a,b)=>dir*(numericFields.includes(col)?Number(sortValue(a.v,col)||0)-Number(sortValue(b.v,col)||0):String(sortValue(a.v,col)||'').localeCompare(String(sortValue(b.v,col)||''),'th',{numeric:true})));$('#total').textContent=token?`${list.length} รายการ · ฿${list.reduce((n,x)=>n+Number(x.v[6]||0),0).toLocaleString('th-TH',{minimumFractionDigits:2})}`:'เข้าสู่ระบบเพื่ออ่านข้อมูลส่วนตัว';$('#rows').innerHTML=list.map(x=>'<tr>'+columns.map(c=>'<td'+(c.className?' class="'+c.className+'"':'')+'>'+c.cell(x)+'</td>').join('')+'</tr>').join('')}

async function load(){data=[];render();$('#error').textContent='';$('#info').textContent='กำลังอ่าน Google Sheet…';try{const meta=await api('?fields=sheets.properties');const sheet=meta.sheets.find(s=>s.properties.title===cfg.sheetName);if(!sheet)throw Error('ไม่พบแท็บรายการใบเสร็จ');sheetId=sheet.properties.sheetId;const result=await api('/values/'+encodeURIComponent(tab+'!A1:N10000')+'?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING');headers=result.values?.[0]||[];if(fields.some(h=>headers.filter(v=>v===h).length!==1))throw Error('โครงสร้าง Sheet เปลี่ยน กรุณาตรวจหัวคอลัมน์');data=(result.values||[]).slice(1).map((r,i)=>({row:i+2,v:fields.map(f=>r[headers.indexOf(f)]??'')})).filter(x=>x.v[0]||x.v[3]);render();$('#info').textContent='ข้อมูลล่าสุดจาก Google Sheet · '+new Date().toLocaleTimeString('th-TH')}catch(e){$('#info').textContent='ไม่สามารถโหลดข้อมูลล่าสุด';$('#error').textContent=e.message}}
async function check(item){const r=await api('/values/'+encodeURIComponent(tab+'!A'+item.row+':N'+item.row)+'?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING');const v=fields.map(f=>r.values?.[0]?.[headers.indexOf(f)]??'');if(JSON.stringify(v)!==JSON.stringify(item.v))throw Error('รายการถูกแก้ไขหรือย้ายแถวแล้ว กรุณา Refresh ก่อนลองใหม่')}
function lock(value){busy=value;auth();render();$('#save').disabled=value;$('#cancel').disabled=value}
$('#rows').onclick=async e=>{const b=e.target.closest('button[data-action]');if(!b||busy)return;const item=data.find(x=>x.row===Number(b.dataset.row));if(!item)return;if(b.dataset.action==='edit'){editing=item;$('#formFields').innerHTML=editorFields(item);$('#dialogError').textContent='';$('#editor').showModal();return}if(!confirm('ยืนยันลบ “'+item.v[3]+'” ออกจาก Google Sheet? การลบนี้มีผลกับทุกคน'))return;lock(true);try{await check(item);await api(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{deleteDimension:{range:{sheetId,dimension:'ROWS',startIndex:item.row-1,endIndex:item.row}}}]})});await load()}catch(err){$('#error').textContent=err.message}finally{lock(false)}};
$('#editForm').onsubmit=async e=>{e.preventDefault();if(busy||!editing)return;const f=new FormData(e.target),v=fields.map((_,i)=>{const value=f.get('c'+i)??editing.v[i];return numericFields.includes(i)&&value!==''?Number(value):value});lock(true);try{await check(editing);await api('/values/'+encodeURIComponent(tab+'!A'+editing.row+':N'+editing.row)+'?valueInputOption=RAW',{method:'PUT',body:JSON.stringify({values:[headers.map(h=>v[fields.indexOf(h)]??'')]})});$('#editor').close();await load()}catch(err){$('#dialogError').textContent=err.message}finally{lock(false)}};
$('#cancel').onclick=()=>$('#editor').close();$('#editor').addEventListener('cancel',e=>{if(busy)e.preventDefault()});
$('#login').onclick=()=>{if(!window.google?.accounts?.oauth2){$('#error').textContent='Google ยังไม่พร้อม กรุณาลองใหม่';return}google.accounts.oauth2.initTokenClient({client_id:cfg.clientId,scope:'https://www.googleapis.com/auth/spreadsheets',callback:r=>{if(r.error){$('#error').textContent=r.error;return}clearTimeout(expiry);token=r.access_token;sessionStorage.setItem('receipt.session',JSON.stringify({token,expiresAt:Date.now()+Number(r.expires_in||3600)*1000}));expiry=setTimeout(clear,Number(r.expires_in||3600)*1000);auth();load()}}).requestAccessToken()};$('#logout').onclick=()=>{if(token&&window.google)google.accounts.oauth2.revoke(token,()=>{});clear()};$('#refresh').onclick=load;['#status','#start','#end'].forEach(s=>$(s).onchange=render);auth();render();

document.querySelector('thead').onclick=e=>{const b=e.target.closest('[data-sort]');if(!b)return;const col=Number(b.dataset.sort);if(sortCol!==col){sortCol=col;sortDir=1}else if(sortDir===1){sortDir=-1}else{sortCol=null;sortDir=0}document.querySelectorAll('th').forEach(th=>th.removeAttribute('aria-sort'));if(sortCol!==null)b.closest('th').setAttribute('aria-sort',sortDir===1?'ascending':'descending');document.querySelectorAll('[data-sort]').forEach(x=>{x.textContent=x.dataset.label+(Number(x.dataset.sort)===sortCol?(sortDir===1?' ↑':' ↓'):' ↕')});render()};

try{const saved=JSON.parse(sessionStorage.getItem('receipt.session')||'null');if(saved?.token&&saved.expiresAt>Date.now()){token=saved.token;expiry=setTimeout(clear,saved.expiresAt-Date.now());auth();load()}else{sessionStorage.removeItem('receipt.session')}}catch{sessionStorage.removeItem('receipt.session')}
