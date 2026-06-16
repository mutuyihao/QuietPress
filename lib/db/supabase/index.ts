import type { SupabaseClient } from "@supabase/supabase-js";
import type { Repositories } from "../types";
import { SupabasePostRepository } from "./posts";
import { SupabaseTagRepository } from "./tags";
import { SupabaseSettingsRepository } from "./settings";

export function createRepositories(supabase: SupabaseClient): Repositories {
  return {
    posts: new SupabasePostRepository(supabase),
    tags: new SupabaseTagRepository(supabase),
    settings: new SupabaseSettingsRepository(supabase),
  };
}

export { SupabasePostRepository } from "./posts";
export { SupabaseTagRepository } from "./tags";
export { SupabaseSettingsRepository } from "./settings";
