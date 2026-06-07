import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  callMcpTool,
  getMcpPrompt,
  listMcpResources,
  listMcpTools,
  MCP_PROMPTS,
  McpScopeError,
  readMcpResource,
} from '@/lib/mcp/tools'
import { getMcpEnabled, insertMcpAuditLog, validateMcpAccessToken, type McpAccessContext } from '@/lib/mcp/store'
import { getMcpResourceUrl } from '@/lib/mcp/oauth'
import { MCP_SCOPES } from '@/lib/mcp/scopes'
import { createServiceClient } from '@/lib/supabase/service'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { sha256 } from '@/lib/mcp/crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MCP_PROTOCOL_VERSION = '2025-06-18'

type JsonRpcId = string | number | null

interface JsonRpcRequest {
  jsonrpc?: string
  id?: JsonRpcId
  method?: string
  params?: unknown
}

function getResourceUrl(request: NextRequest): string {
  return getMcpResourceUrl(request.nextUrl.origin)
}

function unauthorized(request: NextRequest, message = 'Unauthorized') {
  const origin = request.nextUrl.origin
  return NextResponse.json(
    { error: message },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="${MCP_SCOPES.join(' ')}"`,
      },
    },
  )
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 })
}

function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function ok(id: JsonRpcId | undefined, result: unknown) {
  return { jsonrpc: '2.0', id: id ?? null, result }
}

function rpcError(id: JsonRpcId | undefined, code: number, message: string, data?: unknown) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  }
}

function summarize(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {}

  const source = value as Record<string, unknown>
  const summary: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(source)) {
    if (key === 'package') {
      summary.package = '[quietpress-export-package]'
    } else if (typeof item === 'string') {
      summary[key] = item.length > 180 ? `${item.slice(0, 180)}...` : item
    } else if (Array.isArray(item)) {
      summary[key] = `[array:${item.length}]`
    } else if (item && typeof item === 'object') {
      summary[key] = '[object]'
    } else {
      summary[key] = item
    }
  }

  return summary
}

function resultSummary(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return { type: 'array', count: value.length }
  if (!value || typeof value !== 'object') return { type: typeof value }

  const object = value as Record<string, unknown>
  if ('id' in object) return { type: 'object', id: object.id }
  if ('success' in object) return { success: object.success }
  return { type: 'object', keys: Object.keys(object).slice(0, 20) }
}

function getCallParams(params: unknown): { name: string; args: unknown } {
  if (!params || typeof params !== 'object') {
    throw new Error('tools/call params must be an object')
  }

  const data = params as { name?: unknown; arguments?: unknown }
  if (typeof data.name !== 'string' || !data.name) {
    throw new Error('tools/call requires a tool name')
  }

  return { name: data.name, args: data.arguments ?? {} }
}

function getResourceUri(params: unknown): string {
  if (!params || typeof params !== 'object') throw new Error('resources/read params must be an object')
  const uri = (params as { uri?: unknown }).uri
  if (typeof uri !== 'string' || !uri) throw new Error('resources/read requires uri')
  return uri
}

function getPromptParams(params: unknown): { name: string; args: Record<string, unknown> } {
  if (!params || typeof params !== 'object') throw new Error('prompts/get params must be an object')
  const data = params as { name?: unknown; arguments?: unknown }
  if (typeof data.name !== 'string' || !data.name) throw new Error('prompts/get requires name')
  return {
    name: data.name,
    args: data.arguments && typeof data.arguments === 'object'
      ? data.arguments as Record<string, unknown>
      : {},
  }
}

async function authenticate(request: NextRequest): Promise<
  | { response: NextResponse; access?: never }
  | { response?: never; access: McpAccessContext }
> {
  if (request.nextUrl.searchParams.has('access_token') || request.nextUrl.searchParams.has('token')) {
    return { response: NextResponse.json({ error: 'Bearer tokens must be sent in the Authorization header.' }, { status: 400 }) }
  }

  const ip = getClientIp(request)
  const anonymousLimit = checkRateLimit(ip, {
    scope: 'mcp-auth',
    windowMs: 60_000,
    maxRequests: 60,
  })
  if (!anonymousLimit.allowed) {
    return {
      response: NextResponse.json(
        { error: 'Too many MCP requests.' },
        {
          status: 429,
          headers: { 'Retry-After': String(anonymousLimit.retryAfter) },
        },
      ),
    }
  }

  const token = extractBearerToken(request)
  if (!token) return { response: unauthorized(request) }

  const service = createServiceClient()
  const enabled = await getMcpEnabled(service)
  if (!enabled) return { response: forbidden('Remote MCP is disabled.') }

  const access = await validateMcpAccessToken(service, token, getResourceUrl(request))
  if (!access) return { response: unauthorized(request, 'Invalid or expired token') }

  const clientLimit = checkRateLimit(`${access.clientId}:${access.userId}`, {
    scope: 'mcp-client',
    windowMs: 60_000,
    maxRequests: 120,
  })
  if (!clientLimit.allowed) {
    return {
      response: NextResponse.json(
        { error: 'Too many MCP requests for this client.' },
        {
          status: 429,
          headers: { 'Retry-After': String(clientLimit.retryAfter) },
        },
      ),
    }
  }

  return { access }
}

async function handleRpc(
  request: NextRequest,
  message: JsonRpcRequest,
  access: McpAccessContext,
) {
  const service = createServiceClient()
  const context = {
    access,
    blog: {
      supabase: service,
      userId: access.userId,
    },
  }

  try {
    if (!message.method) {
      return rpcError(message.id, -32600, 'Invalid JSON-RPC request')
    }

    if (message.method === 'initialize') {
      return ok(message.id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
          prompts: { listChanged: false },
        },
        serverInfo: {
          name: 'quietpress',
          version: '1.0.0',
        },
      })
    }

    if (message.method === 'ping') {
      return ok(message.id, {})
    }

    if (message.method === 'notifications/initialized') {
      return null
    }

    if (message.method === 'tools/list') {
      return ok(message.id, { tools: listMcpTools(access) })
    }

    if (message.method === 'tools/call') {
      const { name, args } = getCallParams(message.params)
      const requestId = request.headers.get('x-request-id') || randomUUID()
      const ip = getClientIp(request)
      const userAgent = request.headers.get('user-agent') || ''

      try {
        const result = await callMcpTool(context, name, args)
        await insertMcpAuditLog(service, {
          userId: access.userId,
          clientId: access.clientId,
          scopes: access.scopes,
          toolName: name,
          inputSummary: summarize(args),
          resultSummary: resultSummary(result),
          requestId,
          ipHash: sha256(ip),
          userAgentHash: userAgent ? sha256(userAgent) : null,
          status: 'success',
        })

        return ok(message.id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        })
      } catch (error) {
        await insertMcpAuditLog(service, {
          userId: access.userId,
          clientId: access.clientId,
          scopes: access.scopes,
          toolName: name,
          inputSummary: summarize(args),
          resultSummary: {},
          requestId,
          ipHash: sha256(ip),
          userAgentHash: userAgent ? sha256(userAgent) : null,
          status: 'error',
          error: error instanceof Error ? error.message : 'Tool failed',
        })
        throw error
      }
    }

    if (message.method === 'resources/list') {
      return ok(message.id, { resources: listMcpResources(access) })
    }

    if (message.method === 'resources/read') {
      return ok(message.id, await readMcpResource(context, getResourceUri(message.params)))
    }

    if (message.method === 'prompts/list') {
      return ok(message.id, { prompts: MCP_PROMPTS })
    }

    if (message.method === 'prompts/get') {
      const prompt = getPromptParams(message.params)
      return ok(message.id, getMcpPrompt(prompt.name, prompt.args))
    }

    return rpcError(message.id, -32601, `Method not found: ${message.method}`)
  } catch (error) {
    if (error instanceof McpScopeError) {
      return rpcError(message.id, -32003, error.message, { requiredScopes: error.requiredScopes })
    }

    return rpcError(
      message.id,
      -32000,
      error instanceof Error ? error.message : 'MCP request failed',
    )
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request)
  if (auth.response) return auth.response

  return NextResponse.json({
    name: 'quietpress',
    protocolVersion: MCP_PROTOCOL_VERSION,
    resource: getResourceUrl(request),
    capabilities: ['tools', 'resources', 'prompts'],
    tools: listMcpTools(auth.access).length,
  })
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request)
  if (auth.response) return auth.response

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(rpcError(null, -32700, 'Parse error'), { status: 400 })
  }

  const messages = Array.isArray(payload) ? payload : [payload]
  const responses: unknown[] = []

  for (const message of messages) {
    if (!message || typeof message !== 'object') {
      responses.push(rpcError(null, -32600, 'Invalid JSON-RPC request'))
      continue
    }

    const response = await handleRpc(request, message as JsonRpcRequest, auth.access)
    if (response) responses.push(response)
  }

  if (responses.length === 0) {
    return new NextResponse(null, { status: 202 })
  }

  return NextResponse.json(Array.isArray(payload) ? responses : responses[0])
}
