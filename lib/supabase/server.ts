import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | null | undefined;
let readClient: SupabaseClient | null | undefined;

function getPublicSupabaseKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

export function isSupabaseProjectConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function isSupabaseReadConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && getPublicSupabaseKey());
}

export function isSupabaseServiceConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseServerReadClient() {
  if (!isSupabaseReadConfigured()) return null;
  if (readClient !== undefined) return readClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = getPublicSupabaseKey();

  if (!supabaseUrl || !publicKey) {
    readClient = null;
    return readClient;
  }

  readClient = createClient(supabaseUrl, publicKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return readClient;
}

export function getSupabaseServiceClient() {
  if (!isSupabaseServiceConfigured()) return null;
  if (serviceClient !== undefined) return serviceClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    serviceClient = null;
    return serviceClient;
  }

  serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return serviceClient;
}
