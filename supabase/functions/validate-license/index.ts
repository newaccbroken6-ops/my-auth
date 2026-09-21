import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 10;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const { license_key, hwid, app_id } = body;
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";

    if (!license_key || !app_id) {
      return new Response(
        JSON.stringify({ valid: false, message: "Missing license_key or app_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting by IP
    const windowStart = new Date(
      Math.floor(Date.now() / (RATE_LIMIT_WINDOW_SECONDS * 1000)) * RATE_LIMIT_WINDOW_SECONDS * 1000
    ).toISOString();

    const { data: rl } = await supabase
      .from("rate_limit_log")
      .select("id, request_count")
      .eq("identifier", ip)
      .eq("endpoint", "validate")
      .eq("window_start", windowStart)
      .maybeSingle();

    if (rl) {
      if (rl.request_count >= RATE_LIMIT_MAX_REQUESTS) {
        await supabase.from("activity_logs").insert({
          app_id,
          event_type: "rate_limited",
          ip_address: ip,
          hwid: hwid ?? null,
          metadata: { license_key },
        });
        return new Response(
          JSON.stringify({ valid: false, message: "Rate limit exceeded. Try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await supabase
        .from("rate_limit_log")
        .update({ request_count: rl.request_count + 1 })
        .eq("id", rl.id);
    } else {
      await supabase.from("rate_limit_log").insert({
        identifier: ip,
        endpoint: "validate",
        window_start: windowStart,
        request_count: 1,
      });
    }

    // Fetch license
    const { data: license } = await supabase
      .from("licenses")
      .select("id, status, license_type, expires_at, app_id")
      .eq("license_key", license_key)
      .eq("app_id", app_id)
      .maybeSingle();

    if (!license) {
      await supabase.from("activity_logs").insert({
        app_id,
        event_type: "invalid_key",
        ip_address: ip,
        hwid: hwid ?? null,
        metadata: { license_key },
      });
      return new Response(
        JSON.stringify({ valid: false, message: "Invalid license key" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (license.license_type !== "lifetime" && license.expires_at) {
      if (new Date(license.expires_at) < new Date()) {
        await supabase
          .from("licenses")
          .update({ status: "expired" })
          .eq("id", license.id);
        await supabase.from("activity_logs").insert({
          license_id: license.id,
          app_id,
          event_type: "expired",
          ip_address: ip,
          hwid: hwid ?? null,
          metadata: {},
        });
        return new Response(
          JSON.stringify({ valid: false, message: "License has expired" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (license.status !== "active") {
      await supabase.from("activity_logs").insert({
        license_id: license.id,
        app_id,
        event_type: `status_${license.status}`,
        ip_address: ip,
        hwid: hwid ?? null,
        metadata: {},
      });
      return new Response(
        JSON.stringify({ valid: false, message: `License is ${license.status}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // HWID binding
    if (hwid) {
      const { data: binding } = await supabase
        .from("hwid_bindings")
        .select("id, hwid")
        .eq("license_id", license.id)
        .maybeSingle();

      if (binding) {
        if (binding.hwid !== hwid) {
          await supabase.from("activity_logs").insert({
            license_id: license.id,
            app_id,
            event_type: "hwid_mismatch",
            ip_address: ip,
            hwid,
            metadata: { bound_hwid: binding.hwid },
          });
          return new Response(
            JSON.stringify({ valid: false, message: "HWID mismatch. License is bound to a different device." }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        await supabase.from("hwid_bindings").insert({
          license_id: license.id,
          hwid,
        });
      }
    }

    await supabase.from("activity_logs").insert({
      license_id: license.id,
      app_id,
      event_type: "validate_success",
      ip_address: ip,
      hwid: hwid ?? null,
      metadata: { license_type: license.license_type },
    });

    return new Response(
      JSON.stringify({
        valid: true,
        message: "License is valid",
        license_type: license.license_type,
        expires_at: license.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ valid: false, message: "Internal error", error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
