// /lib/logEvent.ts
import { supabase } from "./supabaseClient";

export async function logEvent(type: string, data: Record<string, any> = {}) {
  try {
    await supabase.from("log_Events").insert([
      {
        type,
        data,
        ts: Date.now(),
      },
    ]);
  } catch (e) {
    console.warn("logEvent failed", e);
  }
}
