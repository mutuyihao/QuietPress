import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

function isAdminPageRoute(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isAdminApiRoute(pathname: string): boolean {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

function nextResponse(request: NextRequest, requestHeaders?: Headers) {
  return requestHeaders
    ? NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
    : NextResponse.next({
        request,
      });
}

function unauthorizedAdminApi() {
  return NextResponse.json(
    { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
    { status: 401 },
  );
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/auth/login";
  url.search = "";
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export async function updateSession(
  request: NextRequest,
  requestHeaders?: Headers,
) {
  let supabaseResponse = nextResponse(request, requestHeaders);

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        requestHeaders?.set("cookie", request.cookies.toString());
        supabaseResponse = nextResponse(request, requestHeaders);
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const isAdminPage = isAdminPageRoute(request.nextUrl.pathname);
  const isAdminApi = isAdminApiRoute(request.nextUrl.pathname);

  if (!isAdminPage && !isAdminApi) {
    return supabaseResponse;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return isAdminApi ? unauthorizedAdminApi() : redirectToLogin(request);
  }

  const { data: adminProfile, error: adminError } = await supabase
    .from("admin_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !adminProfile) {
    return isAdminApi ? unauthorizedAdminApi() : redirectToLogin(request);
  }

  return supabaseResponse;
}
