import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { validateSameOriginRequest } from "@/lib/csrf";
import { withApiRoute } from "@/lib/api-response";

export const POST = withApiRoute(
  "auth.signout.POST",
  async (request: NextRequest) => {
    const csrfError = validateSameOriginRequest(request);
    if (csrfError) return csrfError;

    const supabase = await createClient();
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/auth/login", request.nextUrl.origin),
    );
  },
);
