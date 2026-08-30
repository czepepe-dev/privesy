import {validSession,json} from "./_shared.js";
export async function onRequestGet({request,env}){return validSession(request,env)?json({ok:true}):json({error:"Nepřihlášen."},401)}
