import { NextRequest, NextResponse } from "next/server";
import { getMcpResourceUrl } from "@/lib/mcp/oauth";
import { MCP_SCOPES } from "@/lib/mcp/scopes";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  return NextResponse.json({
    resource: getMcpResourceUrl(origin),
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: MCP_SCOPES,
    resource_documentation: `${origin}/admin/ai-access`,
  });
}
