import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generateLicenseKey(customName?: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  
  // If custom name is provided, use it exactly as specified (after sanitization)
  if (customName) {
    // Sanitize: uppercase, alphanumeric + hyphens only, replace spaces with hyphens
    return customName
      .toUpperCase()
      .replace(/[^A-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50); // Limit length to 50 characters
  }
  
  // Default format if no custom name: SUPER-NOVA-{RANDOM}
  const randomSegment = Array.from({ length: 8 }, () => 
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  
  return `SUPER-NOVA-${randomSegment}`;
}

function expiresAt(type: string): string | null {
  if (type === "lifetime") return null;
  const d = new Date();
  if (type === "daily") d.setDate(d.getDate() + 1);
  if (type === "monthly") d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = profile?.role === "admin";
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/admin-licenses/, "");

    // POST /generate — bulk generate licenses
    if (req.method === "POST" && path === "/generate") {
      const { app_id, license_type, count = 1, note, custom_name } = await req.json();

      // Verify ownership or admin and get app name
      const { data: app } = await supabase
        .from("applications")
        .select("id, owner_id, name")
        .eq("id", app_id)
        .maybeSingle();

      if (!app || (app.owner_id !== user.id && !isAdmin)) {
        return new Response(JSON.stringify({ error: "Not authorized" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sanitize app name for use in license key
      const appNameSegment = app.name
        .toUpperCase()
        .replace(/[^A-Z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .substring(0, 20);

      const toInsert = Array.from({ length: Math.min(count, 100) }, (_, i) => {
        let keyName: string;
        
        if (custom_name) {
          // Format: {APP-NAME}-{CUSTOM-NAME}
          const customSegment = custom_name
            .toUpperCase()
            .replace(/[^A-Z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .substring(0, 20);
          
          // For bulk generation, append number suffix
          if (count > 1) {
            keyName = `${appNameSegment}-${customSegment}-${i + 1}`;
          } else {
            keyName = `${appNameSegment}-${customSegment}`;
          }
        } else {
          // If no custom name, use default random format
          keyName = undefined as any;
        }
        
        return {
          app_id,
          license_key: generateLicenseKey(keyName),
          license_type,
          expires_at: expiresAt(license_type),
          note: note ?? null,
          status: "active",
        };
      });

      const { data: created, error } = await supabase
        .from("licenses")
        .insert(toInsert)
        .select("id, license_key, license_type, expires_at, status");

      if (error) throw error;

      await supabase.from("activity_logs").insert({
        app_id,
        user_id: user.id,
        event_type: "bulk_generate",
        metadata: { count: toInsert.length, license_type },
      });

      return new Response(JSON.stringify({ success: true, licenses: created }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PATCH /revoke — revoke a license
    if (req.method === "PATCH" && path === "/revoke") {
      const { license_id, status, reason } = await req.json();

      const { data: license } = await supabase
        .from("licenses")
        .select("id, app_id")
        .eq("id", license_id)
        .maybeSingle();

      if (!license) {
        return new Response(JSON.stringify({ error: "License not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: app } = await supabase
        .from("applications")
        .select("owner_id")
        .eq("id", license.app_id)
        .maybeSingle();

      if (!app || (app.owner_id !== user.id && !isAdmin)) {
        return new Response(JSON.stringify({ error: "Not authorized" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("licenses").update({ status }).eq("id", license_id);

      await supabase.from("activity_logs").insert({
        license_id,
        user_id: user.id,
        app_id: license.app_id,
        event_type: `license_${status}`,
        metadata: { reason: reason ?? null },
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /ban-user
    if (req.method === "POST" && path === "/ban-user") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { user_id, ban_reason, banned } = await req.json();
      await supabase
        .from("profiles")
        .update({ is_banned: banned ?? true, ban_reason: ban_reason ?? null })
        .eq("id", user_id);

      await supabase.from("activity_logs").insert({
        user_id: user.id,
        event_type: banned ? "user_banned" : "user_unbanned",
        metadata: { target_user_id: user_id, reason: ban_reason },
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
