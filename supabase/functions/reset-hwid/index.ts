import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESET_COOLDOWN_DAYS = 30;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { license_id } = await req.json();
    if (!license_id) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing license_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check license ownership
    const { data: license } = await supabase
      .from("licenses")
      .select("id, owner_id, app_id")
      .eq("id", license_id)
      .maybeSingle();

    if (!license) {
      return new Response(
        JSON.stringify({ success: false, message: "License not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is owner or admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = profile?.role === "admin";
    if (license.owner_id !== user.id && !isAdmin) {
      return new Response(
        JSON.stringify({ success: false, message: "Not authorized for this license" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get HWID binding
    const { data: binding } = await supabase
      .from("hwid_bindings")
      .select("id, last_reset_at, reset_count")
      .eq("license_id", license_id)
      .maybeSingle();

    if (!binding) {
      return new Response(
        JSON.stringify({ success: false, message: "No HWID binding found for this license" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cooldown (skip for admins)
    if (!isAdmin && binding.last_reset_at) {
      const lastReset = new Date(binding.last_reset_at);
      const cooldownEnd = new Date(lastReset.getTime() + RESET_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
      if (new Date() < cooldownEnd) {
        const daysLeft = Math.ceil((cooldownEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        return new Response(
          JSON.stringify({
            success: false,
            message: `HWID reset cooldown active. ${daysLeft} day(s) remaining.`,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    await supabase
      .from("hwid_bindings")
      .update({
        hwid: null,
        last_reset_at: new Date().toISOString(),
        reset_count: binding.reset_count + 1,
      })
      .eq("id", binding.id);

    await supabase.from("activity_logs").insert({
      license_id,
      user_id: user.id,
      app_id: license.app_id,
      event_type: "hwid_reset",
      metadata: { reset_count: binding.reset_count + 1, admin: isAdmin },
    });

    return new Response(
      JSON.stringify({ success: true, message: "HWID has been reset successfully." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, message: "Internal error", error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
