import {auth,json,gh,b64decode,BRANCH} from "../_shared.js";

function imagePathFromUrl(value){
  if(typeof value!=="string" || !value.trim()) return null;
  try{const u=new URL(value,"https://privesy.pages.dev");const path=u.pathname.replace(/^\/+/,"");return path.startsWith("img/galeria/")?path:null;}catch{return null;}
}
function productImagePaths(p){
  const out=new Set();
  for(const key of ["imagen","imagenMiniatura"]){const x=imagePathFromUrl(p?.[key]);if(x)out.add(x);}
  for(const item of Array.isArray(p?.galeria)?p.galeria:[]){const x=imagePathFromUrl(item?.imagen);if(x)out.add(x);}
  return out;
}
function imageDirs(paths){const dirs=new Set();for(const path of paths){const i=path.lastIndexOf("/");if(i>0)dirs.add(path.slice(0,i));}return dirs;}
async function getAllProducts(env){
  const files=await gh("data/productos",env); const products=[];
  for(const f of files.filter(x=>x.type==="file"&&x.name.toLowerCase().endsWith(".json"))){
    try{const raw=await gh(`data/productos/${encodeURIComponent(f.name)}`,env);const p=JSON.parse(b64decode(raw.content));p.slug=f.name.replace(/\.json$/i,"");products.push(p);}catch{}
  }
  return products;
}
async function cleanupImageDirs(env,dirs,protectedPaths){
  for(const dir of dirs){let files=[];try{files=await gh(dir,env);}catch{continue;}
    for(const f of Array.isArray(files)?files:[]){
      if(f.type!=="file"||!f.path||protectedPaths.has(f.path))continue;
      try{await gh(f.path,env,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:`Odstraněn obrázek smazaného přívěsu ${f.path}`,sha:f.sha,branch:BRANCH})});}catch{}
    }
  }
}

export async function onRequestDelete({request,env,params}){
  const a=await auth(request,env);if(a)return a;
  try{
    const slug=decodeURIComponent(params.slug);const path=`data/productos/${slug}.json`;
    const f=await gh(path,env); const product=JSON.parse(b64decode(f.content));
    const imagePaths=productImagePaths(product);
    await gh(path,env,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:`Smazán přívěs ${slug}`,sha:f.sha,branch:BRANCH})});

    // Smaž jen fotografie v adresářích tohoto produktu, které už nepoužívá jiný produkt.
    try{
      const others=await getAllProducts(env); const protectedPaths=new Set();
      for(const other of others){for(const x of productImagePaths(other))protectedPaths.add(x);}
      await cleanupImageDirs(env,imageDirs(imagePaths),protectedPaths);
    }catch{}
    return json({ok:true});
  }catch(e){return json({error:e.message},500)}
}
