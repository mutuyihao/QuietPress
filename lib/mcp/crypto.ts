import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

function base64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

export function createOpaqueToken(byteLength = 32): string {
  return base64Url(randomBytes(byteLength))
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function hashToken(token: string): string {
  return sha256(token)
}

export function hashCodeVerifier(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest())
}

export function verifyPkceS256(verifier: string, challenge: string): boolean {
  const actual = hashCodeVerifier(verifier)
  const actualBuffer = Buffer.from(actual)
  const challengeBuffer = Buffer.from(challenge)

  if (actualBuffer.byteLength !== challengeBuffer.byteLength) {
    return false
  }

  return timingSafeEqual(actualBuffer, challengeBuffer)
}

export function safeTokenPreview(token: string): string {
  if (token.length <= 12) return token
  return `${token.slice(0, 6)}...${token.slice(-6)}`
}
