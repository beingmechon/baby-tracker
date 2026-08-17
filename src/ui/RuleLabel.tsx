import type { ReactNode } from 'react'

interface RuleLabelProps {
  children: ReactNode
  /** Optional controls, pushed to the far end of the rule (see `order` in CSS). */
  actions?: ReactNode
}

/**
 * The design's signature move: a section label sitting *in* its own hairline rule,
 * like a legend on a map frame.
 *
 * This is the only ornament in the design, and it is deliberately the only one —
 * one move applied consistently beats five gimmicks. See docs/DESIGN.md.
 */
export function RuleLabel({ children, actions }: RuleLabelProps) {
  return (
    <div className="rule-label">
      <span>{children}</span>
      {actions !== undefined && <span className="rule-label-actions">{actions}</span>}
    </div>
  )
}
