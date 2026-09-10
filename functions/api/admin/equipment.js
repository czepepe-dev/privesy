import {auth,json,gh,b64decode,b64encode,BRANCH} from "./_shared.js";

const PATH = "data/vybava.json";
const DEFAULT_ITEMS = [
  "samostatná sedlovna",
  "krmný žlab",
  "podlaha ve 100% stavu",
  "brzdy ve 100% stavu",
  "celolitá pogumovaná podlaha",
  "zadní rampa",
  "plynové tlumiče na rampě",
  "protiskluzová guma na rampě",
  "gumové boční okopy",
  "plechové boční okopy",
  "nové pneumatiky",
  "nová podlaha",
  "rezervní kolo",
  "lité disky",
  "kryty kol",
  "odvětrací okna",
  "vnitřní osvětlení",
  "blatníky pozink",
  "blatníky plast",
  "boční rampa",
  "plynové tlumiče 4x",
  "samonavíjecí zadní roletka",
  "stupačka",
  "zadní nájezdová rampa",
  "hydraulika"
];

function cleanItems(items){
  const out=[];
  const seen=new Set();
  for(const raw of Array.isArray(items)?items:[]){
    const item=String(raw||"").trim().replace(/\s+/g," ");
    if(!item)continue;
    const key=item.toLocaleLowerCase("cs-CZ");
    if(seen.has(key))continue;
    seen.add(key); out.push(item);
  }
  return out;
}

async function readList(env){
  try{
    const file=await gh(PATH,env);
    const parsed=JSON.parse(b64decode(file.content));
    const items=cleanItems(parsed?.items);
    return {items:items.length?items:DEFAULT_ITEMS,sha:file.sha};
  }catch(e){
    // Pokud soubor ještě neexistuje, použijeme základní seznam.
    if(/404|Not Found/i.test(e.message||"")) return {items:DEFAULT_ITEMS.slice(),sha:null};
    throw e;
  }
}

export async function onRequestGet({request,env}){
  const a=await auth(request,env); if(a)return a;
  try{
    const {items}=await readList(env);
    return json({items});
  }catch(e){return json({error:e.message},500)}
}

export async function onRequestPost({request,env}){
  const a=await auth(request,env); if(a)return a;
  try{
    const body=await request.json();
    const item=String(body.item||"").trim().replace(/\s+/g," ");
    if(!item) throw new Error("Název výbavy nebo stavu je prázdný.");
    if(item.length>120) throw new Error("Název může mít maximálně 120 znaků.");

    const current=await readList(env);
    const exists=current.items.find(x=>x.toLocaleLowerCase("cs-CZ")===item.toLocaleLowerCase("cs-CZ"));
    if(exists) return json({ok:true,created:false,item:exists,items:current.items});

    const items=[...current.items,item];
    const bodyContent=JSON.stringify({items},null,2)+"\n";
    const payload={
      message:`Přidána výbava/stav: ${item}`,
      content:b64encode(bodyContent),
      branch:BRANCH,
      ...(current.sha?{sha:current.sha}:{})
    };
    await gh(PATH,env,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    return json({ok:true,created:true,item,items});
  }catch(e){return json({error:e.message},500)}
}
