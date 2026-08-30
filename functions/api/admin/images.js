import {auth,json,gh,b64encode,BRANCH} from "./_shared.js";
export async function onRequestPost({request,env}){
  const a=await auth(request,env);if(a)return a;
  try{
    const b=await request.json(); const slug=String(b.slug||"").trim(); const filename=String(b.filename||"").replace(/[^a-zA-Z0-9._-]/g,"-");
    if(!slug||!filename||!b.content)throw new Error("Chybí obrázek.");
    const path=`img/galeria/${slug}/${filename}`;
    await gh(path,env,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:`Nahrán obrázek ${filename}`,content:b.content,branch:BRANCH})});
    return json({ok:true,url:`/img/galeria/${slug}/${filename}`});
  }catch(e){return json({error:e.message},500)}
}
