```javascript
import {auth,json,gh,b64decode,b64encode,BRANCH} from "./_shared.js";

export async function onRequestGet({request,env}) {

  const a = await auth(request,env);

  if(a) return a;

  return new Response("AUTH FUNGUJE", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
```
