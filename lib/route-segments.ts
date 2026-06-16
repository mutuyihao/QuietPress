export function decodeRouteSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function getRouteSegmentVariants(segment: string): string[] {
  return Array.from(new Set([segment, decodeRouteSegment(segment)]));
}

export function postPath(slug: string): string {
  return `/posts/${encodeURIComponent(slug)}`;
}

export function tagPath(slug: string): string {
  return `/tags/${encodeURIComponent(slug)}`;
}

export function absolutePath(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function postUrl(baseUrl: string, slug: string): string {
  return absolutePath(baseUrl, postPath(slug));
}

export function tagUrl(baseUrl: string, slug: string): string {
  return absolutePath(baseUrl, tagPath(slug));
}
