import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export interface ApiErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export interface ApiSuccessBody<T> {
  ok: true;
  data: T;
}

export type ApiBody<T> = ApiSuccessBody<T> | ApiErrorBody;

export interface ApiRouteRuntimeContext {
  requestId: string;
  routeName: string;
  startedAt: number;
}

export type ApiRouteHandler<
  TRequest extends Request = Request,
  TRouteContext = unknown,
> = (
  request: TRequest,
  routeContext: TRouteContext,
  runtimeContext: ApiRouteRuntimeContext,
) => Response | Promise<Response>;

const DEFAULT_INTERNAL_ERROR_MESSAGE = "服务器内部错误，请稍后重试。";

function newApiRequestId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

function errorCodeFromRoute(routeName: string): string {
  return `${routeName
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()}_FAILED`;
}

function attachRequestId(response: Response, requestId: string): Response {
  if (response.headers.has("x-request-id")) return response;

  try {
    response.headers.set("x-request-id", requestId);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    headers.set("x-request-id", requestId);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

export function apiOk<T>(
  data: T,
  init?: ResponseInit,
): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  init?: ResponseInit,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    {
      ...init,
      status,
      headers: init?.headers,
    },
  );
}

export function apiInternalError(
  code: string,
  err: unknown,
  message = DEFAULT_INTERNAL_ERROR_MESSAGE,
  requestId = newApiRequestId(),
): NextResponse<ApiErrorBody> {
  logger.error("api internal error", { code, requestId, err });

  return apiError(code, `${message} (ref: ${requestId})`, 500, {
    headers: {
      "x-request-id": requestId,
    },
  });
}

export function withApiRoute<
  TRequest extends Request = Request,
  TRouteContext = unknown,
>(routeName: string, handler: ApiRouteHandler<TRequest, TRouteContext>) {
  return async function wrappedApiRoute(
    request: TRequest,
    routeContext: TRouteContext,
  ): Promise<Response> {
    const startedAt = Date.now();
    const requestId = request.headers.get("x-request-id") || newApiRequestId();

    try {
      const response = attachRequestId(
        await handler(request, routeContext, {
          requestId,
          routeName,
          startedAt,
        }),
        requestId,
      );
      const finalRequestId = response.headers.get("x-request-id") || requestId;
      const durationMs = Date.now() - startedAt;

      if (response.status >= 500) {
        logger.error("api route completed with server error", {
          route: routeName,
          status: response.status,
          requestId: finalRequestId,
          durationMs,
        });
      } else if (response.status >= 400) {
        logger.warn("api route completed with client error", {
          route: routeName,
          status: response.status,
          requestId: finalRequestId,
          durationMs,
        });
      }

      return response;
    } catch (err) {
      return apiInternalError(
        errorCodeFromRoute(routeName),
        err,
        DEFAULT_INTERNAL_ERROR_MESSAGE,
        requestId,
      );
    }
  };
}
