import {
  auth,
  json,
  gh,
  b64decode,
  b64encode,
  BRANCH
} from "../../_shared.js";


const PATH = "data/vybava.json";


const DEFAULT_ITEMS = [
  "samostatná sedlovna",
  "krmný žlab",
  "podlaha ve 100% stavu",
  "brzdy ve 100% stavu",
  "celolitá pogumovaná podlaha",
  "zadní rampa",
  "plynové tlumièe na rampì",
  "protiskluzová guma na rampì",
  "gumové boèní okopy",
  "plechové boèní okopy",
  "nové pneumatiky",
  "nová podlaha",
  "rezervní kolo",
  "lité disky",
  "kryty kol",
  "odvìtrací okna",
  "vnitøní osvìtlení",
  "blatníky pozink",
  "blatníky plast",
  "boèní rampa",
  "plynové tlumièe 4x",
  "samonavíjecí zadní roletka",
  "stupaèka",
  "zadní nájezdová rampa",
  "hydraulika"
];


/* =========================================================
   ÈIŠTÌNÍ POLOŽEK
   ========================================================= */

function cleanItems(items){

  const out = [];
  const seen = new Set();

  for(
    const raw of Array.isArray(items)
      ? items
      : []
  ){

    const item = String(raw || "")
      .trim()
      .replace(/\s+/g," ");

    if(!item){
      continue;
    }

    const key =
      item.toLocaleLowerCase("cs-CZ");

    if(seen.has(key)){
      continue;
    }

    seen.add(key);
    out.push(item);
  }

  return out;
}


/* =========================================================
   NAÈTENÍ SEZNAMU Z GITHUBU
   ========================================================= */

async function readList(env){

  try{

    const file =
      await gh(PATH,env);

    const parsed =
      JSON.parse(
        b64decode(file.content)
      );

    const items =
      cleanItems(parsed?.items);


    /*
      Pokud soubor existuje,
      ale obsahuje prázdný seznam,
      použijeme výchozí seznam.
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
      Soubor ještì neexistuje.
    */

    if(
      /404|Not Found/i.test(
        e.message || ""
      )
    ){

      return {
        items:DEFAULT_ITEMS.slice(),
        sha:null
      };
    }


    throw e;
  }
}


/* =========================================================
   ULOŽENÍ SEZNAMU NA GITHUB
   ========================================================= */

async function saveList(
  env,
  items,
  sha,
  message
){

  const clean =
    cleanItems(items);


  await gh(
    PATH,
    env,
    {
      method:"PUT",

      headers:{
        "Content-Type":
          "application/json"
      },

      body:JSON.stringify({

        message,

        content:b64encode(
          JSON.stringify(
            {
              items:clean
            },
            null,
            2
          ) + "\n"
        ),

        branch:BRANCH,

        ...(sha
          ? {sha}
          : {})
      })
    }
  );


  return clean;
}


/* =========================================================
   GET
   Naètení seznamu výbavy
   ========================================================= */

export async function onRequestGet({
  request,
  env
}){

  const a =
    await auth(
      request,
      env
    );

  if(a){
    return a;
  }


  try{

    const {
      items
    } =
      await readList(env);


    return json({
      items
    });

  }catch(e){

    return json(
      {
        error:e.message
      },
      500
    );
  }
}


/* =========================================================
   POST
   =========================================================
   
   Umí dvì vìci:

   1. { items:[...] }
      = uložit nové poøadí

   2. { item:"..." }
      = pøidat novou položku
   ========================================================= */

export async function onRequestPost({
  request,
  env
}){

  const a =
    await auth(
      request,
      env
    );

  if(a){
    return a;
  }


  try{

    const body =
      await request.json();


    /* =====================================================
       NOVÉ POØADÍ
       ===================================================== */

    if(
      Array.isArray(
        body.items
      )
    ){

      const current =
        await readList(env);


      const requested =
        cleanItems(
          body.items
        );


      /*
        Ochrana proti tomu,
        aby se omylem ztratila položka,
        kterou admin neposlal.
      */

      const requestedKeys =
        new Set(
          requested.map(
            x =>
              x.toLocaleLowerCase(
                "cs-CZ"
              )
          )
        );


      const missing =
        current.items.filter(
          x =>
            !requestedKeys.has(
              x.toLocaleLowerCase(
                "cs-CZ"
              )
            )
        );


      const items = [
        ...requested,
        ...missing
      ];


      const saved =
        await saveList(
          env,
          items,
          current.sha,
          "Zmìnìno poøadí výbavy a stavu"
        );


      return json({

        ok:true,

        reordered:true,

        items:saved

      });
    }


    /* =====================================================
       PØIDÁNÍ NOVÉ POLOŽKY
       ===================================================== */

    const item =
      String(
        body.item || ""
      )
      .trim()
      .replace(
        /\s+/g,
        " "
      );


    if(!item){

      throw new Error(
        "Název výbavy nebo stavu je prázdný."
      );
    }


    if(item.length > 120){

      throw new Error(
        "Název mùže mít maximálnì 120 znakù."
      );
    }


    const current =
      await readList(env);


    const exists =
      current.items.find(
        x =>
          x.toLocaleLowerCase(
            "cs-CZ"
          ) ===
          item.toLocaleLowerCase(
            "cs-CZ"
          )
      );


    /*
      Položka už existuje.
    */

    if(exists){

      return json({

        ok:true,

        created:false,

        item:exists,

        items:current.items

      });
    }


    /*
      Pøidáme položku na konec.
    */

    const items = [
      ...current.items,
      item
    ];


    const saved =
      await saveList(
        env,
        items,
        current.sha,
        "Pøidána výbava/stav: " + item
      );


    return json({

      ok:true,

      created:true,

      item,

      items:saved

    });

  }catch(e){

    return json(
      {
        error:e.message
      },
      500
    );
  }
}


/* =========================================================
   DELETE
   Smazání položky
   ========================================================= */

export async function onRequestDelete({
  request,
  env
}){

  const a =
    await auth(
      request,
      env
    );

  if(a){
    return a;
  }


  try{

    const body =
      await request.json();


    const item =
      String(
        body.item || ""
      )
      .trim()
      .replace(
        /\s+/g,
        " "
      );


    if(!item){

      throw new Error(
        "Chybí položka výbavy nebo stavu."
      );
    }


    const current =
      await readList(env);


    const index =
      current.items.findIndex(
        x =>
          x.toLocaleLowerCase(
            "cs-CZ"
          ) ===
          item.toLocaleLowerCase(
            "cs-CZ"
          )
      );


    /*
      Položka neexistuje.
    */

    if(index < 0){

      return json({

        ok:true,

        deleted:false,

        items:current.items

      });
    }


    const removed =
      current.items[index];


    const items =
      current.items.filter(
        (_,i) =>
          i !== index
      );


    const saved =
      await saveList(
        env,
        items,
        current.sha,
        "Odstranìna výbava/stav: " +
          removed
      );


    return json({

      ok:true,

      deleted:true,

      item:removed,

      items:saved

    });

  }catch(e){

    return json(
      {
        error:e.message
      },
      500
    );
  }
}