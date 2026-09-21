import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const url = new URL(req.url);
    // app_id can be passed as query param or in JSON body
    let app_id = url.searchParams.get("app_id");

    if (!app_id && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      app_id = body.app_id ?? null;
    }

    if (!app_id) {
      return new Response(
        JSON.stringify({ error: "Missing app_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: version, error } = await supabase
      .from("app_versions")
      .select("version, download_url, changelog, force_update, created_at")
      .eq("app_id", app_id)
      .eq("is_latest", true)
      .maybeSingle();

    if (error) throw error;

    if (!version) {
      return new Response(
        JSON.stringify({ error: "No version found for this app" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Response shape your C++ client reads:
    // { "version": "V1.9", "download_url": "...", "changelog": "...", "force_update": false }
    return new Response(
      JSON.stringify({
        version: version.version,
        download_url: version.download_url,
        changelog: version.changelog ?? "",
        force_update: version.force_update,
        released_at: version.created_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
