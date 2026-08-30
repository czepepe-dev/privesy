import {auth,json,gh,b64decode,b64encode,BRANCH} from "./_shared.js";

export async function onRequestGet({request,env}){
  const a=await auth(request,env); if(a)return a;
  try{
    const files=await gh("data/productos",env);
    const products=[];
    for(const f of files.filter(x=>x.type==="file"&&x.name.toLowerCase().endsWith(".json"))){
      try{
        const raw=await gh(`data/productos/${encodeURIComponent(f.name)}`,env);
        const p=JSON.parse(b64decode(raw.content));
        p.slug=f.name.replace(/\.json$/i,""); products.push(p);
      }catch{}
    }
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
    const path=`data/productos/${slug}.json`;
    let sha;
    try{sha=(await gh(path,env)).sha}catch{}
    await gh(path,env,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      message: original&&original!==slug?`Upraven přívěs ${p.nombre}`:`Přidán přívěs ${p.nombre}`,
      content:b64encode(JSON.stringify(p,null,2)+"\n"),branch:BRANCH,...(sha?{sha}:{})
    })});
    if(original&&original!==slug){
      const oldPath=`data/productos/${original}.json`;
      try{const old=await gh(oldPath,env);await gh(oldPath,env,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:`Přejmenován přívěs ${p.nombre}`,sha:old.sha,branch:BRANCH})})}catch{}
    }
    return json({ok:true,message:"Přívěs byl uložen."});
  }catch(e){return json({error:e.message},500)}
}
