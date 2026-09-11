import {auth,json,gh,b64decode,b64encode,BRANCH} from "./_shared.js";
const ALLOWED = new Set(["prepravniky","nakladni-privesy","ostatni"]);

function imagePathFromUrl(value){
  if(typeof value!=="string" || !value.trim()) return null;
  try{
    const u=new URL(value,"https://privesy.pages.dev");
    const path=u.pathname.replace(/^\/+/,"");
    return path.startsWith("img/galeria/") ? path : null;
  }catch{return null;}
}
function productImagePaths(p){
  const out=new Set();
  for(const key of ["imagen","imagenMiniatura"]){const x=imagePathFromUrl(p?.[key]);if(x)out.add(x);}
  for(const item of Array.isArray(p?.galeria)?p.galeria:[]){const x=imagePathFromUrl(item?.imagen);if(x)out.add(x);}
  return out;
}
function imageDirs(paths){
  const dirs=new Set();
  for(const path of paths){const i=path.lastIndexOf("/");if(i>0)dirs.add(path.slice(0,i));}
  return dirs;
}
async function getAllProducts(env){
  const files=await gh("data/productos",env);
  const products=[];
  for(const f of files.filter(x=>x.type==="file"&&x.name.toLowerCase().endsWith(".json"))){
    try{
      const raw=await gh(`data/productos/${encodeURIComponent(f.name)}`,env);
      const p=JSON.parse(b64decode(raw.content));
      p.slug=f.name.replace(/\.json$/i,""); products.push(p);
    }catch{}
  }
  return products;
}
async function cleanupImageDirs(env,dirs,protectedPaths){
  for(const dir of dirs){
    let files=[];
    try{files=await gh(dir,env);}catch{continue;}
    for(const f of Array.isArray(files)?files:[]){
      if(f.type!=="file" || !f.path || protectedPaths.has(f.path)) continue;
      try{
        await gh(f.path,env,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          message:`Odstraněn nepoužívaný obrázek ${f.path}`,sha:f.sha,branch:BRANCH
        })});
      }catch{}
    }
  }
}

export async function onRequestGet({request,env}){
  const a=await auth(request,env); if(a)return a;
  try{
    const products=await getAllProducts(env);
    products.sort((a,b)=>new Date(b.datumPridani||0)-new Date(a.datumPridani||0));
    return json({products});
  }catch(e){return json({error:e.message},500)}
}

export async function onRequestPost({request,env}){
  const a=await auth(request,env); if(a)return a;
  try{
    const body=await request.json(); const p=body.product||{}; let slug=String(body.slug||"").trim();
    if(!slug) throw new Error("Chybí slug.");
    const original=String(body.originalSlug||"").trim();
    if(!p.datumPridani)p.datumPridani=new Date().toISOString();
    const oldPath=original?`data/productos/${original}.json`:null;
    let oldProduct=null;
    if(oldPath){try{const oldRaw=await gh(oldPath,env);oldProduct=JSON.parse(b64decode(oldRaw.content));oldProduct.slug=original;}catch{}}

    const path=`data/productos/${slug}.json`;
    let sha;
    try{sha=(await gh(path,env)).sha}catch{}
    await gh(path,env,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      message: original&&original!==slug?`Upraven přívěs ${p.nombre}`:`Přidán přívěs ${p.nombre}`,
      content:b64encode(JSON.stringify(p,null,2)+"\n"),branch:BRANCH,...(sha?{sha}:{})
    })});

    if(original&&original!==slug&&oldPath){
      try{const old=await gh(oldPath,env);await gh(oldPath,env,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:`Přejmenován přívěs ${p.nombre}`,sha:old.sha,branch:BRANCH})})}catch{}
    }

    // Po uložení odstraň ze starých adresářů jen obrázky, které už nepoužívá žádný produkt.
    if(oldProduct){
      try{
        const all=await getAllProducts(env);
        const protectedPaths=new Set();
        for(const other of all){for(const x of productImagePaths(other))protectedPaths.add(x);}
        await cleanupImageDirs(env,imageDirs(productImagePaths(oldProduct)),protectedPaths);
      }catch{}
    }
    return json({ok:true,message:"Přívěs byl uložen."});
  }catch(e){return json({error:e.message},500)}
}
