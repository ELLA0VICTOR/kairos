import {execFileSync} from 'node:child_process';
const files=execFileSync('git',['diff','--cached','--name-only','--diff-filter=ACMR','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const blocked=[];
for(const file of files){
 if(/(^|\/)(\.env(?:\..*)?|\.vercel|node_modules|raw)(\/|$)/.test(file)&&file!=='.env.example'){blocked.push(file);continue;}
 const content=execFileSync('git',['show',':'+file],{maxBuffer:20_000_000});
 if(/(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(content.toString('utf8')))blocked.push(file);
}
if(blocked.length){console.error('Review staged files (values withheld): '+blocked.join(', '));process.exitCode=1;}
else console.log('PASS staged filename and common credential-pattern check: '+files.length+' files. Secret values were not printed.');
