export function looksLikeHtml(body?: string | null, contentType?: string | null): boolean {
  if (!body?.trim()) {
    return false
  }

  const media = (contentType ?? '').split(';')[0].trim().toLowerCase()
  if (media === 'text/html' || media === 'application/xhtml+xml') {
    return true
  }

  const start = body.trimStart()
  return /^<!DOCTYPE\s+html\b/i.test(start) || /^<html[\s>]/i.test(start)
}
