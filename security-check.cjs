const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const rules=[
 ['OAuth client secret',/GOCSPX-[A-Za-z0-9_-]{16,}/],
 ['GitHub token',/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
 ['Google API key',/AIza[A-Za-z0-9_-]{30,}/],
 ['private key',/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
 ['service account credentials',/["']type["']\s*:\s*["']service_account["']/],
 ['literal credential',/(?:client_secret|api[_-]?key|refresh[_-]?token|access[_-]?token)["']?\s*[:=]\s*["'][A-Za-z0-9_./+=-]{20,}["']/i]
];
function findingsFor(name,content){
 const findings=[];
 if(/(^|\/)(?:\.env(?:\..+)?|client_secret[^/]*\.json|credentials[^/]*\.json|service-account[^/]*\.json|[^/]*-service-account\.json)$/.test(name)&&!name.endsWith('.env.example'))findings.push('credential file');
 if(/\.(?:pem|key|p12|pfx)$/.test(name)||/^(?:private|exports|receipts)\//.test(name))findings.push('private file');
 for(const [label,pattern] of rules)if(pattern.test(content))findings.push(label);
 return findings;
}
function walk(root,dir=''){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(entry=>{
 const name=dir?dir+'/'+entry.name:entry.name;
 if(['.git','node_modules','public'].includes(entry.name))return [];
 return entry.isDirectory()?walk(root,name):[name];
})}
function scan(root=__dirname){
 let files;
 try{files=cp.execFileSync('git',['ls-files','-z'],{cwd:root,stdio:['ignore','pipe','ignore']}).toString().split('\0').filter(Boolean)}catch{files=walk(root)}
 let failures=0;
 for(const name of files){const full=path.join(root,name);if(!fs.existsSync(full)||!fs.statSync(full).isFile())continue;
  const findings=findingsFor(name,fs.readFileSync(full,'utf8'));
  if(findings.length){failures++;console.error(name+': '+findings.join(', '))}
 }
 if(failures)throw Error('Potential credentials found in '+failures+' file(s). Do not publish; remove and rotate any real exposed credentials. Matched values are never printed.');
 console.log('PASS: scanned '+files.length+' current source files for known credential formats and private-file paths (not a complete history audit)');
}
module.exports={findingsFor,scan};
if(require.main===module){try{scan()}catch(e){console.error(e.message);process.exitCode=1}}
