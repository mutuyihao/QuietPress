'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase/service'
import {
  createMcpClient,
  revokeMcpToken,
  setMcpClientEnabled,
  setMcpEnabled,
} from '@/lib/mcp/store'
import { MCP_SCOPES, normalizeScopes } from '@/lib/mcp/scopes'

function parseRedirectUris(value: FormDataEntryValue | null): string[] {
  const raw = String(value || '')
  const uris = Array.from(new Set(
    raw
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean),
  ))

  if (uris.length === 0) {
    throw new Error('At least one redirect URI is required.')
  }

  for (const uri of uris) {
    const parsed = new URL(uri)
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
    if (parsed.protocol !== 'https:' && !(isLocalhost && parsed.protocol === 'http:')) {
      throw new Error(`Redirect URI must be HTTPS or localhost HTTP: ${uri}`)
    }
  }

  return uris
}

function getSelectedScopes(formData: FormData): string[] {
  const scopes = formData.getAll('scopes').map(String)
  return normalizeScopes(scopes.length > 0 ? scopes : [...MCP_SCOPES])
}

export async function setMcpEnabledAction(formData: FormData) {
  await requireAdmin()
  const enabled = formData.get('enabled') === 'true'
  const service = createServiceClient()

  await setMcpEnabled(service, enabled)
  revalidatePath('/admin/ai-access')
}

export async function createMcpClientAction(formData: FormData) {
  const { user } = await requireAdmin()
  const service = createServiceClient()
  const name = String(formData.get('name') || '').trim()
  if (!name) {
    throw new Error('Client name is required.')
  }

  await createMcpClient(service, {
    name,
    redirectUris: parseRedirectUris(formData.get('redirect_uris')),
    scopes: getSelectedScopes(formData),
    createdBy: user.id,
  })

  revalidatePath('/admin/ai-access')
  redirect('/admin/ai-access')
}

export async function setMcpClientEnabledAction(formData: FormData) {
  await requireAdmin()
  const clientId = String(formData.get('client_id') || '')
  const enabled = formData.get('enabled') === 'true'
  if (!clientId) throw new Error('client_id is required.')

  const service = createServiceClient()
  await setMcpClientEnabled(service, clientId, enabled)
  revalidatePath('/admin/ai-access')
}

export async function revokeMcpTokenAction(formData: FormData) {
  await requireAdmin()
  const tokenId = String(formData.get('token_id') || '')
  if (!tokenId) throw new Error('token_id is required.')

  const service = createServiceClient()
  await revokeMcpToken(service, tokenId)
  revalidatePath('/admin/ai-access')
}
