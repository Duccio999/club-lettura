"use client";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let browserClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configura NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
  }

  if (!browserClient) {
    browserClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
}
