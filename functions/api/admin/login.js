import {envv,makeSession,json} from "./_shared.js";
export async function onRequestPost({request,env}){
  try{
    const body=await request.json();
    if(!body.password || body.password!==envv(env,"ADMIN_PASSWORD")) return json({error:"Nesprávné heslo."},401);
    const session=await makeSession(env);
    return json({ok:true},200,{"Set-Cookie":`privesy_admin=${session}; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Strict`})
  }catch(e){return json({error:e.message},500)}
}
