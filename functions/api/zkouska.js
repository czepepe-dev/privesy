export function onRequestGet() {
  return new Response("FUNKCE FUNGUJE", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}