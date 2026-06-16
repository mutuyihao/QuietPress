import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimitForRequest } from "@/lib/rate-limit";
import { validateSameOriginRequest } from "@/lib/csrf";
import { withApiRoute } from "@/lib/api-response";
import { logger } from "@/lib/logger";

function loginRedirect(request: NextRequest, error: string) {
  const url = new URL("/auth/login", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, { status: 303 });
}

function loginInternalError(
  request: NextRequest,
  code: string,
  err: unknown,
  requestId: string,
  message = "登录服务暂时不可用，请稍后再试。",
) {
  logger.error("login internal error", { code, requestId, err });
  return loginRedirect(request, `${message} (ref: ${requestId})`);
}

function loginSuccessRedirect(request: NextRequest) {
  const url = new URL("/auth/login", request.url);
  url.searchParams.set("login", "success");
  return NextResponse.redirect(url, { status: 303 });
}

function safeRedirectPath(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value : "";
  if (!text || !text.startsWith("/") || text.startsWith("//")) return null;
  return text;
}

function nextRedirect(request: NextRequest, path: string | null) {
  if (!path) return loginSuccessRedirect(request);
  return NextResponse.redirect(new URL(path, request.url), { status: 303 });
}

function getAuthErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("invalid login credentials")) {
    return "账号或密码不正确，请检查后重试。";
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "邮箱尚未完成验证，请先完成邮箱验证。";
  }

  return "登录失败，请稍后再试。";
}

export const POST = withApiRoute(
  "auth.login.POST",
  async (request: NextRequest, _ctx, { requestId }) => {
    const csrfError = validateSameOriginRequest(request);
    if (csrfError) return csrfError;

    const { allowed } = await checkRateLimitForRequest(request, {
      scope: "login",
    });

    if (!allowed) {
      return loginRedirect(request, "登录尝试过于频繁，请稍后再试。");
    }

    const formData = await request.formData();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const next = safeRedirectPath(formData.get("next"));

    if (!email && !password) {
      return loginRedirect(request, "请输入邮箱和密码。");
    }

    if (!email) {
      return loginRedirect(request, "请输入邮箱。");
    }

    if (!password) {
      return loginRedirect(request, "请输入密码。");
    }

    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return loginRedirect(request, getAuthErrorMessage(authError.message));
    }

    const user = data.user;
    if (!user) {
      return loginInternalError(
        request,
        "LOGIN_MISSING_USER",
        new Error("Supabase did not return a user session."),
        requestId,
      );
    }

    const { data: existingAdminProfile, error: adminLookupError } =
      await supabase
        .from("admin_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (adminLookupError) {
      await supabase.auth.signOut();
      return loginInternalError(
        request,
        "ADMIN_LOOKUP_FAILED",
        adminLookupError,
        requestId,
      );
    }

    let adminProfile = existingAdminProfile;

    if (!adminProfile) {
      const { data: claimedAdmin, error: claimError } = await supabase.rpc(
        "claim_first_admin",
        { admin_email: user.email || email },
      );

      if (claimError) {
        await supabase.auth.signOut();
        return loginInternalError(
          request,
          "ADMIN_CLAIM_FAILED",
          claimError,
          requestId,
        );
      }

      if (!claimedAdmin) {
        await supabase.auth.signOut();
        return loginRedirect(
          request,
          "您没有管理员权限。如果这是 Vercel 一键部署，请检查 bootstrap 日志；如果是手动部署，请确认 admin_profiles 为空且初始 migration 已执行。",
        );
      }

      const { data: refreshedAdminProfile, error: refreshError } =
        await supabase
          .from("admin_profiles")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

      if (refreshError) {
        await supabase.auth.signOut();
        return loginInternalError(
          request,
          "ADMIN_REFRESH_FAILED",
          refreshError,
          requestId,
        );
      }

      adminProfile = refreshedAdminProfile;
    }

    if (!adminProfile) {
      await supabase.auth.signOut();
      return loginRedirect(request, "您没有管理员权限。");
    }

    return nextRedirect(request, next);
  },
);
