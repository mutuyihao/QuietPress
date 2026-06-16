import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { withApiRoute } from "@/lib/api-response";

function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//"))
    return "/admin";
  return value;
}

export const GET = withApiRoute(
  "auth.callback.GET",
  async (request: NextRequest) => {
    const { searchParams, origin } = request.nextUrl;
    const code = searchParams.get("code");
    const next = safeRedirectPath(searchParams.get("next"));

    if (code) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }

    return NextResponse.redirect(`${origin}/auth/error`);
  },
);
