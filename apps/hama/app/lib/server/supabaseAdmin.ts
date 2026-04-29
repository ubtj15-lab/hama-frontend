import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdmin() {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serverUrl = process.env.SUPABASE_URL;
  if (publicUrl && serverUrl && publicUrl !== serverUrl) {
    throw new Error("Supabase URL mismatch");
  }

  const supabaseUrl = publicUrl;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getSupabaseAdmin() {
  try {
    return createSupabaseAdmin();
  } catch {
    return null;
  }
}
