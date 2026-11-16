/**
 * Receipt AI backend — Google Apps Script Web App.
 * Deploy: Execute as Me; access Anyone. Each request independently verifies
 * the existing Google OAuth access token and an explicit email allowlist.
 * All runtime settings are read from the Settings tab of the private spreadsheet.\n * IMPORTANT: Anyone with read access to that spreadsheet can see OPENAI_API_KEY.
 */
const RECEIPT_SCHEMA = {"type":"object","additionalProperties":false,"required":["type","store","date","total","items","notes"],"properties":{"type":{"type":"string","enum":["groceries","dining"]},"store":{"type":"string"},"date":{"type":"string"},"total":{"type":"number"},"notes":{"type":"string"},"items":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["name","description","quantity","unit","weight","price","category"],"properties":{"name":{"type":"string"},"description":{"type":"string"},"quantity":{"type":"number"},"unit":{"type":"string"},"weight":{"type":"number"},"price":{"type":"number"},"category":{"type":"string"}}}}}};
function respond_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
function doPost(e){
  try {
    const body=JSON.parse(e.postData.contents);
    const rows=SpreadsheetApp.openById('1SIdh88ALERIOyhjJou4sCzCFd8g5KbKv08xAEBt_Two').getSheetByName('Settings').getRange('A2:B30').getDisplayValues();
    const settings=Object.fromEntries(rows.filter(row=>row[0]).map(row=>[row[0].trim(),row[1]]));
    const expectedClientId='93673745680-2hlgqrre36sgd4gmtu22inkdqhl0472n.apps.googleusercontent.com';
    if(!body.accessToken)throw Error('Google login required');
    const infoRes=UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token='+encodeURIComponent(body.accessToken),{muteHttpExceptions:true});
    if(infoRes.getResponseCode()!==200)throw Error('Invalid Google OAuth token');
    const info=JSON.parse(infoRes.getContentText());
    if(info.aud!==expectedClientId)throw Error('OAuth client mismatch');
    const scopes=(info.scope||'').split(' ');
    if(!scopes.includes('https://www.googleapis.com/auth/userinfo.email'))throw Error('Email scope missing; please sign in again');
    const userRes=UrlFetchApp.fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+body.accessToken},muteHttpExceptions:true});
    if(userRes.getResponseCode()!==200)throw Error('Unable to verify Google account');
    const email=String(JSON.parse(userRes.getContentText()).email||'').toLowerCase();
    const allowed=(settings.ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
    if(!email||!allowed.includes(email))throw Error('This Google account is not authorized');
    if(body.action!=='analyze')throw Error('Unknown action');
    const images=body.images;
    if(!Array.isArray(images)||images.length<1||images.length>5||images.some(x=>typeof x!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(x)||x.length>5000000))throw Error('Invalid images (max 5, 3.7 MB each)');
    const apiKey=settings.OPENAI_API_KEY;
    if(!apiKey)throw Error('OPENAI_API_KEY missing in Settings sheet');
    const prompt=String(settings.AI_PREPROMPT||'').slice(0,3000);
    const model=settings.AI_MODEL||'gpt-4o-mini';
    const request={model,temperature:0,messages:[{role:'system',content:'Extract Thai and English receipts faithfully. Do not invent items or prices. Distinguish groceries from dining. Preserve genuine repeated purchases; avoid duplicate rows caused by overlapping images. Date YYYY-MM-DD or empty. Mark uncertainty in notes. Never use a phone status bar date.'},{role:'user',content:[{type:'text',text:'Extract receipt. Additional user instructions: '+prompt},...images.map(url=>({type:'image_url',image_url:{url}}))]}],response_format:{type:'json_schema',json_schema:{name:'receipt',strict:true,schema:RECEIPT_SCHEMA}}};
    const res=UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+apiKey},payload:JSON.stringify(request),muteHttpExceptions:true});
    const result=JSON.parse(res.getContentText());
    if(res.getResponseCode()!==200)throw Error(result.error?.message||'OpenAI request failed');
    return respond_({ok:true,result:JSON.parse(result.choices[0].message.content)});
  }catch(err){return respond_({ok:false,error:String(err.message||err)})}
}
