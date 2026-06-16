import { createClient } from "@/lib/supabase/server";

export async function getAdminSession() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: adminProfile, error: adminError } = await supabase
    .from("admin_profiles")
    .select("user_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !adminProfile) {
    return null;
  }

  return { supabase, user, adminProfile };
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
