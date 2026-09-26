import {auth,json,gh,b64decode,b64encode,BRANCH} from "./_shared.js";

export function onRequestGet({request,env}) {
  return new Response("EQUIPMENT IMPORT FUNGUJE", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}