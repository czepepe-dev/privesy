```javascript
import {auth,json,gh,b64decode,b64encode,BRANCH} from "./_shared.js";

const ALLOWED = new Set([
  "prepravniky",
  "nakladni-privesy",
  "ostatni"
]);


/* =========================================================
   OBRÁZKY
   ========================================================= */

function imagePathFromUrl(value){
  if(typeof value!=="string" || !value.trim()) return null;

  try{
    const u=new URL(
      value,
      "https://privesy.pages.dev"
    );

    const path=u.pathname.replace(/^\/+/,"");

    return path.startsWith("img/galeria/")
      ? path
      : null;

  }catch{
    return null;
  }
}


function productImagePaths(p){
  const out=new Set();

  for(const key of [
    "imagen",
    "imagenMiniatura"
  ]){
    const x=imagePathFromUrl(p?.[key]);
    if(x)out.add(x);
  }

  for(
    const item of Array.isArray(p?.galeria)
      ? p.galeria
      : []
  ){
    const x=imagePathFromUrl(item?.imagen);
    if(x)out.add(x);
  }

  return out;
}


function imageDirs(paths){
  const dirs=new Set();

  for(const path of paths){
    const i=path.lastIndexOf("/");

    if(i>0){
      dirs.add(path.slice(0,i));
    }
  }

  return dirs;
}


async function cleanupImageDirs(
  env,
  dirs,
  protectedPaths
){
  for(const dir of dirs){

    let files=[];

    try{
      files=await gh(dir,env);
    }catch{
      continue;
    }

    for(
      const f of Array.isArray(files)
        ? files
        : []
    ){

      if(
        f.type!=="file" ||
        !f.path ||
        protectedPaths.has(f.path)
      ){
        continue;
      }

      try{
        await gh(
          f.path,
          env,
          {
            method:"DELETE",
            headers:{
              "Content-Type":
                "application/json"
            },
            body:JSON.stringify({
              message:
                `Odstraněn nepoužívaný obrázek ${f.path}`,
              sha:f.sha,
              branch:BRANCH
            })
          }
        );
      }catch{}
    }
  }
}


/* =========================================================
   NAČTENÍ PRODUKTŮ
   ========================================================= */

async function getAllProducts(env){

  const files=await gh(
    "data/productos",
    env
  );

  const products=[];

  for(
    const f of files.filter(
      x =>
        x.type==="file" &&
        x.name.toLowerCase().endsWith(".json")
    )
  ){

    try{

      const raw=await gh(
        `data/productos/${encodeURIComponent(f.name)}`,
        env
      );

      const p=JSON.parse(
        b64decode(raw.content)
      );

      p.slug=f.name.replace(
        /\.json$/i,
        ""
      );

      products.push(p);

    }catch{}
  }

  return products;
}


/* =========================================================
   ŘAZENÍ PRODUKTŮ
   ========================================================= */

function sortProducts(products){

  products.sort((a,b)=>{

    const aHasOrder =
      Number.isFinite(Number(a?.poradi));

    const bHasOrder =
      Number.isFinite(Number(b?.poradi));


    /*
      Produkty s ručním pořadím
      mají přednost.
    */

    if(aHasOrder && bHasOrder){

      const diff =
        Number(a.poradi) -
        Number(b.poradi);

      if(diff!==0){
        return diff;
      }
    }

    /*
      Pokud má ruční pořadí pouze jeden
      produkt, jde před produkt bez pořadí.
    */

    if(aHasOrder && !bHasOrder){
      return -1;
    }

    if(!aHasOrder && bHasOrder){
      return 1;
    }


    /*
      Původní automatické řazení podle
      data přidání zůstává zachováno.
    */

    const ta =
      new Date(
        a.datumPridani || 0
      ).getTime();

    const tb =
      new Date(
        b.datumPridani || 0
      ).getTime();

    return tb-ta;
  });

  return products;
}


/* =========================================================
   NAČTENÍ PRODUKTŮ
   ========================================================= */

export async function onRequestGet({
  request,
  env
}){

  const a=await auth(
    request,
    env
  );

  if(a)return a;

  try{

    const products=
      await getAllProducts(env);

    sortProducts(products);

    return json({
      products
    });

  }catch(e){

    return json({
      error:e.message
    },500);
  }
}


/* =========================================================
   TRVALÉ ULOŽENÍ POŘADÍ PŘÍVĚSŮ
   ========================================================= */

async function saveProductOrder(
  env,
  order
){

  if(!Array.isArray(order)){
    throw new Error(
      "Chybné pořadí přívěsů."
    );
  }


  /*
    Normalizace slugů.
  */

  const requested=
    order
      .map(
        x=>String(x||"").trim()
      )
      .filter(Boolean);


  const products=
    await getAllProducts(env);


  const bySlug=new Map();

  for(const p of products){

    bySlug.set(
      String(p.slug||""),
      p
    );
  }


  const used=new Set();

  let position=0;


  /*
    Pořadí přesně podle administrace.
  */

  for(const slug of requested){

    const product=bySlug.get(slug);

    if(!product){
      continue;
    }

    if(used.has(slug)){
      continue;
    }

    product.poradi=position++;

    used.add(slug);
  }


  /*
    Pokud některý produkt v seznamu z adminu
    chybí, přidáme ho na konec.
  */

  for(const product of products){

    const slug=
      String(product.slug||"");

    if(used.has(slug)){
      continue;
    }

    product.poradi=position++;

    used.add(slug);
  }


  /*
    Uložení každého produktu.
  */

  for(const product of products){

    const slug=
      String(product.slug||"").trim();

    if(!slug){
      continue;
    }

    const path=
      `data/productos/${encodeURIComponent(slug)}.json`;

    let sha;

    try{
      sha=
        (await gh(path,env)).sha;
    }catch{}


    await gh(
      path,
      env,
      {
        method:"PUT",
        headers:{
          "Content-Type":
            "application/json"
        },
        body:JSON.stringify({

          message:
            `Změněno pořadí přívěsu ${product.nombre||slug}`,

          content:b64encode(
            JSON.stringify(
              product,
              null,
              2
            )+"\n"
          ),

          branch:BRANCH,

          ...(sha ? {sha} : {})
        })
      }
    );
  }


  return sortProducts(products);
}


/* =========================================================
   ULOŽENÍ / ÚPRAVA PRODUKTU
   ========================================================= */

export async function onRequestPost({
  request,
  env
}){

  const a=await auth(
    request,
    env
  );

  if(a)return a;

  try{

    const body=
      await request.json();


    /*
      Pokud admin pošle:
        { order: [...] }

      uloží se nové pořadí.
    */

    if(Array.isArray(body.order)){

      const products=
        await saveProductOrder(
          env,
          body.order
        );

      return json({
        ok:true,
        reordered:true,
        products
      });
    }


    /*
      Původní ukládání produktu.
    */

    const p=
      body.product||{};

    let slug=
      String(
        body.slug||""
      ).trim();

    if(!slug){
      throw new Error(
        "Chybí slug."
      );
    }


    const original=
      String(
        body.originalSlug||""
      ).trim();


    if(!p.datumPridani){
      p.datumPridani=
        new Date().toISOString();
    }


    const oldPath=
      original
        ? `data/productos/${original}.json`
        : null;


    let oldProduct=null;


    if(oldPath){

      try{

        const oldRaw=
          await gh(
            oldPath,
            env
          );

        oldProduct=
          JSON.parse(
            b64decode(
              oldRaw.content
            )
          );

        oldProduct.slug=
          original;

      }catch{}
    }


    /*
      Při úpravě existujícího produktu
      zachováme jeho ruční pořadí.
    */

    if(
      oldProduct &&
      Number.isFinite(
        Number(oldProduct.poradi)
      ) &&
      p.poradi===undefined
    ){

      p.poradi=
        oldProduct.poradi;
    }


    const path=
      `data/productos/${slug}.json`;

    let sha;

    try{
      sha=
        (await gh(path,env)).sha;
    }catch{}


    await gh(
      path,
      env,
      {
        method:"PUT",
        headers:{
          "Content-Type":
            "application/json"
        },
        body:JSON.stringify({

          message:
            original &&
            original!==slug
              ? `Upraven přívěs ${p.nombre}`
              : `Přidán přívěs ${p.nombre}`,

          content:b64encode(
            JSON.stringify(
              p,
              null,
              2
            )+"\n"
          ),

          branch:BRANCH,

          ...(sha ? {sha} : {})
        })
      }
    );


    /*
      Pokud se změnil slug,
      smažeme původní soubor.
    */

    if(
      original &&
      original!==slug &&
      oldPath
    ){

      try{

        const old=
          await gh(
            oldPath,
            env
          );

        await gh(
          oldPath,
          env,
          {
            method:"DELETE",
            headers:{
              "Content-Type":
                "application/json"
            },
            body:JSON.stringify({
              message:
                `Přejmenován přívěs ${p.nombre}`,
              sha:old.sha,
              branch:BRANCH
            })
          }
        );

      }catch{}
    }


    /*
      Po uložení odstraň ze starých adresářů
      jen obrázky, které už nepoužívá žádný produkt.
    */

    if(oldProduct){

      try{

        const all=
          await getAllProducts(env);

        const protectedPaths=
          new Set();

        for(const other of all){

          for(
            const x of productImagePaths(other)
          ){

            protectedPaths.add(x);

          }
        }

        await cleanupImageDirs(
          env,
          imageDirs(
            productImagePaths(
              oldProduct
            )
          ),
          protectedPaths
        );

      }catch{}
    }


    return json({
      ok:true,
      message:
        "Přívěs byl uložen."
    });

  }catch(e){

    return json({
      error:e.message
    },500);
  }
}
```
