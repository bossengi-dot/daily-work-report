/**
 * Copy text on both secure (HTTPS/localhost) and insecure (LAN HTTP) contexts.
 * Prefer Clipboard API when available; fall back to execCommand.
 * When a visible input/textarea is provided, select it so the user can still
 * Ctrl/Cmd+C manually if both APIs fail.
 */
export async function copyText(
  text: string,
  options?: { selectElement?: HTMLTextAreaElement | HTMLInputElement | null },
): Promise<boolean> {
  const selectEl = options?.selectElement ?? null

  if (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator !== 'undefined' &&
    navigator.clipboard?.writeText
  ) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to execCommand / visible select.
    }
  }

  if (selectEl) {
    try {
      selectEl.focus()
      selectEl.select()
      const ok = document.execCommand('copy')
      if (ok) return true
    } catch {
      // Leave selection for manual copy.
    }
    try {
      selectEl.focus()
      selectEl.select()
    } catch {
      // ignore
    }
    return false
  }

  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '0'
  ta.style.left = '0'
  ta.style.width = '1px'
  ta.style.height = '1px'
  ta.style.padding = '0'
  ta.style.border = 'none'
  ta.style.outline = 'none'
  ta.style.boxShadow = 'none'
  ta.style.background = 'transparent'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(ta)
  return ok
}
