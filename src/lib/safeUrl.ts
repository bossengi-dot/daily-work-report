/** Allow only http(s) or same-origin blob previews. Reject javascript:/data:/etc. */
export function isSafeAttachmentUrl(url: string): boolean {
  const value = url.trim()
  if (!value) return false
  if (value.startsWith('blob:')) return true
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function sanitizeAttachmentUrl(url: string): string | null {
  const value = url.trim()
  return isSafeAttachmentUrl(value) ? value : null
}
