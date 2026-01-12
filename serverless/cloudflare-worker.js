// Cloudflare Worker (optional): location-only footprints for your GitHub Pages.
// Stores aggregated counts in KV without saving IP.
// See README in this folder for setup with wrangler.
export default {
  async fetch(request, env){
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if(request.method === "OPTIONS") return new Response(null, { headers: cors });

    // GET /hit -> record
    if(url.pathname === "/hit"){
      const cf = request.cf || {};
      const city = cf.city || "";
      const region = cf.region || "";
      const country = cf.country || "";
      const loc = [city, region, country].filter(Boolean).join(", ") || (country || "Unknown");

      const key = "fp:counts";
      const raw = await env.VISITS.get(key);
      const obj = raw ? JSON.parse(raw) : { total: 0, by: {}, recent: [] };

      obj.total += 1;
      obj.by[loc] = (obj.by[loc] || 0) + 1;

      obj.recent.unshift({ loc, t: new Date().toISOString() });
      obj.recent = obj.recent.slice(0, 40);

      await env.VISITS.put(key, JSON.stringify(obj));

      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type":"application/json" }});
    }

    // GET /stats -> read
    if(url.pathname === "/stats"){
      const raw = await env.VISITS.get("fp:counts");
      const obj = raw ? JSON.parse(raw) : { total: 0, by: {}, recent: [] };
      return new Response(JSON.stringify(obj), { headers: { ...cors, "Content-Type":"application/json" }});
    }

    return new Response("Not found", { status: 404, headers: cors });
  }
};
