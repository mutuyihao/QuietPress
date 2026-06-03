export function decodeRouteSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export function getRouteSegmentVariants(segment: string): string[] {
  return Array.from(new Set([segment, decodeRouteSegment(segment)]))
}

export function postPath(slug: string): string {
  return `/posts/${encodeURIComponent(slug)}`
}
