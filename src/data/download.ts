import { localDateKey } from '@/domain/time'

/**
 * Hands a generated file to the user. Browser-only, kept apart from the pure
 * serialisers in `csv.ts` so those stay testable in Node.
 */
export function downloadTextFile(
  filename: string,
  contents: string,
  mimeType: string,
): void {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoking immediately can cancel the download in some browsers; one turn of
  // the event loop is enough for the navigation to have been queued.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function exportFilename(extension: 'json' | 'csv', now = Date.now()): string {
  return `baby-tracker-${localDateKey(now)}.${extension}`
}

/** Reads a user-picked file as text. */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read that file'))
    reader.readAsText(file)
  })
}
