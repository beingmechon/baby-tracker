import { useEffect, useId, useRef, type ReactNode } from 'react'
import { CloseIcon } from './icons'

interface SheetProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * A bottom sheet. Bottom-anchored rather than centred because the controls need
 * to be inside thumb reach on a phone held in one hand.
 *
 * Handles the dialog basics itself — Escape, backdrop dismissal, focus move and
 * restore, background scroll lock — rather than pulling in a modal library.
 */
export function Sheet({ title, onClose, children }: SheetProps) {
  const headingId = useId()
  const sheetRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<Element | null>(null)

  useEffect(() => {
    previouslyFocused.current = document.activeElement

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    // Stops the page behind the sheet from scrolling under the user's thumb.
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      // Return focus to whatever opened the sheet, so keyboard and screen-reader
      // users are not dropped back at the top of the document.
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus()
      }
    }
  }, [onClose])

  useEffect(() => {
    // Focus the sheet itself rather than its first control: announcing the title
    // gives more context than jumping straight into an input.
    sheetRef.current?.focus()
  }, [])

  return (
    <div
      className="sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
      >
        <div className="sheet-header">
          <h2 id={headingId}>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose}>
            <CloseIcon />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
