const cfg=window.RECEIPT_CONFIG,$=s=>document.querySelector(s);let token='',data=[],expiry;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function clear(){token='';data=[];$('#rows').innerHTML='';$('#total').textContent='เข้าสู่ระบบเพื่ออ่านข้อมูล';$('#refresh').disabled=true;clearTimeout(expiry)}
function render(){const list=data.filter(r=>(!$('#status').value||r[8]===$('#status').value)&&(!$('#start').value||r[1]>=$('#start').value)&&(!$('#end').value||r[1]&&r[1]<=$('#end').value));$('#total').textContent=`${list.length} รายการ · ฿${list.reduce((n,r)=>n+Number(r[6]||0),0).toLocaleString('th-TH',{minimumFractionDigits:2})}`;$('#rows').innerHTML=list.map(r=>`<tr><td>${esc(r[1]||'ไม่ระบุ')}</td><td>${esc(r[3])}</td><td>${esc(r[6])}</td><td>${["รอตรวจสอบ","ยืนยันแล้ว"].includes(r[8])?`<select class="row-status" data-row="${r.sheetRow}">${["รอตรวจสอบ","ยืนยันแล้ว"].map(v=>`<option${v===r[8]?" selected":""}>${v}</option>`).join("")}</select>`:esc(r[8])}</td><td>${esc(r[10])}</td></tr>`).join('')}
async function load(){data=[];$('#rows').innerHTML='';$('#total').textContent='กำลังอ่าน Google Sheet…';$('#error').textContent='';try{if(!token)throw Error('กรุณาเข้าสู่ระบบ');const range="'"+cfg.sheetName.replaceAll("'","''")+"'!A1:K10000";const response=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cfg.spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`,{headers:{Authorization:'Bearer '+token},cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(result.error?.message||'อ่านข้อมูลไม่สำเร็จ');data=(result.values||[]).slice(1).map((r,i)=>Object.assign(r,{sheetRow:i+2})).filter(r=>r[0]||r[3]);render()}catch(e){$('#total').textContent='ไม่มีข้อมูลล่าสุด';$('#error').textContent=e.message}}
$('#login').onclick=()=>{if(!cfg.clientId){$('#error').textContent='ยังไม่ได้ตั้ง Google OAuth Client ID';return}if(!window.google?.accounts?.oauth2){$('#error').textContent='ระบบ Google ยังไม่พร้อม กรุณาลองใหม่';return}google.accounts.oauth2.initTokenClient({client_id:cfg.clientId,scope:'https://www.googleapis.com/auth/spreadsheets',callback:r=>{if(r.error){$('#error').textContent=r.error;return}token=r.access_token;$('#refresh').disabled=false;expiry=setTimeout(clear,Number(r.expires_in||3600)*1000);load()}}).requestAccessToken()};$('#refresh').onclick=load;$('#logout').onclick=()=>{if(token&&window.google)google.accounts.oauth2.revoke(token,()=>{});clear()};['#status','#start','#end'].forEach(s=>$(s).onchange=render);

let saving=false;
$('#rows').onchange=async e=>{
 const el=e.target;if(!el.matches('.row-status'))return;
 const item=data.find(r=>r.sheetRow===Number(el.dataset.row));if(!item)return;
 const old=item[8],next=el.value;if(saving){el.value=old;return}
 saving=true;document.querySelectorAll('.row-status').forEach(x=>x.disabled=true);$('#error').textContent='';
 try{
  if(!token)throw Error('กรุณาเข้าสู่ระบบใหม่');
  const base='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(cfg.spreadsheetId)+'/values/';
  const name="'"+cfg.sheetName.replaceAll("'","''")+"'";
  const check=await fetch(base+encodeURIComponent(name+'!A'+item.sheetRow+':K'+item.sheetRow)+'?valueRenderOption=FORMATTED_VALUE',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  const current=await check.json();if(!check.ok)throw Error(current.error?.message||'ตรวจสอบรายการไม่สำเร็จ');
  if(JSON.stringify(current.values?.[0]||[])!==JSON.stringify(Array.from(item)))throw Error('ข้อมูลเปลี่ยนแล้ว กรุณากด Refresh ก่อนแก้สถานะ');
  const response=await fetch(base+encodeURIComponent(name+'!I'+item.sheetRow)+'?valueInputOption=RAW',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({values:[[next]]})});
  const result=await response.json();if(!response.ok)throw Error(result.error?.message||'บันทึกไม่สำเร็จ');
  await load();
 }catch(err){el.value=old;$('#error').textContent=err.message}
 finally{saving=false;document.querySelectorAll('.row-status').forEach(x=>x.disabled=false)}
};
