import { NextRequest, NextResponse } from "next/server";
import { revokeMcpTokenByRawToken } from "@/lib/mcp/store";
import { createServiceClient } from "@/lib/supabase/service";
import { withApiRoute } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export const POST = withApiRoute(
  "oauth.revoke.POST",
  async (request: NextRequest) => {
    try {
      const formData = await request.formData();
      const token = String(formData.get("token") || "");
      if (token) {
        const service = createServiceClient();
        await revokeMcpTokenByRawToken(service, token);
      }

      return new NextResponse(null, { status: 204 });
    } catch (error) {
      logger.warn("oauth token revocation failed", { err: error });
      return new NextResponse(null, { status: 204 });
    }
  },
);
