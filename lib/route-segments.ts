export function decodeRouteSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function addUniqueVariant(variants: string[], value: string): void {
  const normalized = value.trim();
  if (normalized && !variants.includes(normalized)) {
    variants.push(normalized);
  }
}

function normalizeWhitespaceForPath(segment: string): string {
  return segment.trim().replace(/\s+/g, "-");
}

function normalizeHyphensAsWhitespace(segment: string): string {
  return segment.trim().replace(/-+/g, " ").replace(/\s+/g, " ");
}

function normalizeHyphensAsEncodedSpaces(segment: string): string {
  return normalizeHyphensAsWhitespace(segment).replace(/\s+/g, "%20");
}

export function getRouteSegmentVariants(segment: string): string[] {
  const variants: string[] = [];
  const decoded = decodeRouteSegment(segment);

  for (const value of [segment, decoded]) {
    addUniqueVariant(variants, value);
    addUniqueVariant(variants, normalizeWhitespaceForPath(value));
    addUniqueVariant(variants, normalizeHyphensAsWhitespace(value));
    addUniqueVariant(variants, normalizeHyphensAsEncodedSpaces(value));
  }

  return variants;
}

export function encodeRouteSegment(segment: string): string {
  return encodeURIComponent(
    normalizeWhitespaceForPath(decodeRouteSegment(segment)),
  );
}

export function routeSegmentsEquivalent(a: string, b: string): boolean {
  return encodeRouteSegment(a) === encodeRouteSegment(b);
}

export function postPath(slug: string): string {
  return `/posts/${encodeRouteSegment(slug)}`;
}

export function tagPath(slug: string): string {
  return `/tags/${encodeRouteSegment(slug)}`;
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
