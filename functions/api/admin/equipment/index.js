```javascript
import {auth,json,gh,b64decode,b64encode,BRANCH} from "../_shared.js";

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
  const out = [];
  const seen = new Set();

  for(const raw of Array.isArray(items) ? items : []){
    const item = String(raw || "")
      .trim()
      .replace(/\s+/g," ");

    if(!item) continue;

    const key = item.toLocaleLowerCase("cs-CZ");

    if(seen.has(key)) continue;

    seen.add(key);
    out.push(item);
  }

  return out;
}


/* =========================================================
   NAČTENÍ SEZNAMU
   ========================================================= */

async function readList(env){

  try{

    const file = await gh(PATH,env);

    const parsed = JSON.parse(
      b64decode(file.content)
    );

    const items = cleanItems(parsed?.items);

    /*
      Pokud soubor existuje, ale obsahuje prázdný seznam,
      obnovíme výchozí seznam výbavy.
    */

    if(items.length === 0){

      return {
        items:DEFAULT_ITEMS.slice(),
        sha:file.sha
      };

    }

    return {
      items,
      sha:file.sha
    };

  }catch(e){

    /*
      Pokud data/vybava.json ještě neexistuje,
      použijeme výchozí seznam.
    */

    if(/404|Not Found/i.test(e.message || "")){

      return {
        items:DEFAULT_ITEMS.slice(),
        sha:null
      };

    }

    throw e;
  }
}


async function saveList(env,items,sha,message){

  const clean = cleanItems(items);

  await gh(PATH,env,{
    method:"PUT",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      message,
      content:b64encode(
        JSON.stringify(
          {items:clean},
          null,
          2
        ) + "\n"
      ),
      branch:BRANCH,
      ...(sha ? {sha} : {})
    })
  });

  return clean;
}


/* =========================================================
   NAČTENÍ SEZNAMU
   ========================================================= */

export async function onRequestGet({request,env}){

  const a = await auth(request,env);

  if(a) return a;

  try{

    const {items} = await readList(env);

    return json({
      items
    });

  }catch(e){

    return json({
      error:e.message
    },500);

  }
}


/* =========================================================
   PŘIDÁNÍ POLOŽKY NEBO ULOŽENÍ NOVÉHO POŘADÍ
   ========================================================= */

export async function onRequestPost({request,env}){

  const a = await auth(request,env);

  if(a) return a;

  try{

    const body = await request.json();


    /*
      Pokud admin pošle celé pole "items",
      jedná se o nové pořadí položek po přetažení.
    */

    if(Array.isArray(body.items)){

      const current = await readList(env);

      const requested = cleanItems(body.items);

      /*
        Zachováme i položky,
        které by admin omylem neposlal.
      */

      const requestedKeys = new Set(
        requested.map(
          x => x.toLocaleLowerCase("cs-CZ")
        )
      );

      const missing = current.items.filter(
        x =>
          !requestedKeys.has(
            x.toLocaleLowerCase("cs-CZ")
          )
      );

      const items = [
        ...requested,
        ...missing
      ];

      const saved = await saveList(
        env,
        items,
        current.sha,
        "Změněno pořadí výbavy a stavu"
      );

      return json({
        ok:true,
        reordered:true,
        items:saved
      });
    }


    /*
      Původní funkce:
      přidání nové položky.
    */

    const item = String(body.item || "")
      .trim()
      .replace(/\s+/g," ");

    if(!item){
      throw new Error(
        "Název výbavy nebo stavu je prázdný."
      );
    }

    if(item.length > 120){
      throw new Error(
        "Název může mít maximálně 120 znaků."
      );
    }

    const current = await readList(env);

    const exists = current.items.find(
      x =>
        x.toLocaleLowerCase("cs-CZ") ===
        item.toLocaleLowerCase("cs-CZ")
    );

    if(exists){

      return json({
        ok:true,
        created:false,
        item:exists,
        items:current.items
      });
    }

    const items = [
      ...current.items,
      item
    ];

    const saved = await saveList(
      env,
      items,
      current.sha,
      "Přidána výbava/stav: " + item
    );

    return json({
      ok:true,
      created:true,
      item,
      items:saved
    });

  }catch(e){

    return json({
      error:e.message
    },500);

  }
}


/* =========================================================
   SMAZÁNÍ POLOŽKY
   ========================================================= */

export async function onRequestDelete({request,env}){

  const a = await auth(request,env);

  if(a) return a;

  try{

    const body = await request.json();

    const item = String(body.item || "")
      .trim()
      .replace(/\s+/g," ");

    if(!item){
      throw new Error(
        "Chybí položka výbavy nebo stavu."
      );
    }

    const current = await readList(env);

    const index = current.items.findIndex(
      x =>
        x.toLocaleLowerCase("cs-CZ") ===
        item.toLocaleLowerCase("cs-CZ")
    );

    if(index < 0){

      return json({
        ok:true,
        deleted:false,
        items:current.items
      });
    }

    const removed = current.items[index];

    const items = current.items.filter(
      (_,i) => i !== index
    );

    const saved = await saveList(
      env,
      items,
      current.sha,
      "Odstraněna výbava/stav: " + removed
    );

    return json({
      ok:true,
      deleted:true,
      item:removed,
      items:saved
    });

  }catch(e){

    return json({
      error:e.message
    },500);

  }
}
```
   /*
      test funkci
    */