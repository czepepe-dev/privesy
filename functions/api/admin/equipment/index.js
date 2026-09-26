export function onRequestGet() {
  return new Response("EQUIPMENT FUNGUJE", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}