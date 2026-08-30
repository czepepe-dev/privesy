import {auth,json,gh,BRANCH} from "../_shared.js";
export async function onRequestDelete({request,env,params}){
  const a=await auth(request,env);if(a)return a;
  try{
    const slug=decodeURIComponent(params.slug);const path=`data/productos/${slug}.json`;
    const f=await gh(path,env);
    await gh(path,env,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:`Smazán přívěs ${slug}`,sha:f.sha,branch:BRANCH})});
    return json({ok:true});
  }catch(e){return json({error:e.message},500)}
}
