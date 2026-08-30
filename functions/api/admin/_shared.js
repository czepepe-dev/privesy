const OWNER = "czepepe-dev";
const REPO = "privesy";
const BRANCH = "main";
const COOKIE = "privesy_admin";

function envv(env, key){ const v=env[key]; if(!v) throw new Error(`Chybí Cloudflare Secret: ${key}`); return v; }
function b64decode(s){ return decodeURIComponent(escape(atob(s.replace(/\n/g,"")))); }
function b64encode(s){ return btoa(unescape(encodeURIComponent(s))); }

async function sign(value, secret){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
async function makeSession(env){
  const exp=Date.now()+12*60*60*1000;
  const payload=String(exp);
  return payload+"."+await sign(payload,envv(env,"ADMIN_PASSWORD"));
}
async function validSession(request,env){
  const c=request.headers.get("Cookie")||"";
  const m=c.match(new RegExp(`${COOKIE}=([^;]+)`));
  if(!m)return false;
  const parts=m[1].split(".");
  if(parts.length!==2 || Number(parts[0])<Date.now())return false;
  const expected=await sign(parts[0],envv(env,"ADMIN_PASSWORD"));
  return parts[1]===expected;
}
function json(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8",...headers}});
}
async function auth(request,env){
  if(!(await validSession(request,env))) return json({error:"Nepřihlášen."},401);
  return null;
}
async function gh(path,env,options={}){
  const token=envv(env,"GITHUB_TOKEN");
  const r=await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,{
    ...options,headers:{
      "Accept":"application/vnd.github+json","Authorization":`Bearer ${token}`,
      "X-GitHub-Api-Version":"2022-11-28","User-Agent":"privesy-admin",
      ...(options.headers||{})
    }
  });
  const text=await r.text(); let data={}; try{data=JSON.parse(text)}catch{}
  if(!r.ok) throw new Error(data.message||`GitHub API chyba ${r.status}`);
  return data;
}
export {envv,b64decode,b64encode,makeSession,validSession,json,auth,gh,BRANCH,OWNER,REPO};
