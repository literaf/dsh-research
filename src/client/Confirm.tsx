/**
 * The confirmation a mutation goes through before it runs.
 *
 * Installing rewrites the profile's manifest and reinstalls its dependencies;
 * a bad one can stop dsh from booting. Restarting ends the process this page
 * is served from. Neither should happen on a single click with no statement of
 * what is about to change — the market provider contract asks for exactly
 * this, and names the two facts it must show: what is being acted on, and
 * which profile.
 */

import type { ReactNode } from 'react'
import { cls } from './styles.js'

/** What the dialog asks and what answering it does. */
export interface ConfirmProps {
  /** Question heading, already localized. */
  title: string
  /** The body: what will happen, in the reader's language. */
  children: ReactNode
  /** The exact command that will run, shown verbatim so nothing is hidden. */
  command?: string | undefined
  /** Label of the affirmative button. */
  confirmLabel: string
  /** Label of the dismissing button. */
  cancelLabel: string
  /** Accessible label for the corner close control. */
  closeLabel: string
  /** Run the action. */
  onConfirm: () => void
  /** Dismiss without acting. */
  onCancel: () => void
}

/**
 * Render the dialog.
 * @param props - the question, the command, and the two answers.
 * @returns the modal overlay.
 */
export function Confirm(props: ConfirmProps): JSX.Element {
  return (
    <div
      className={cls.overlay}
      role="presentation"
      // Clicking the backdrop dismisses; clicking the card must not.
      onClick={(event) => { if (event.target === event.currentTarget) props.onCancel() }}
    >
      <div className={cls.dialog} role="dialog" aria-modal="true" aria-label={props.title}>
        <div className={cls.dialogHead}>
          <h3 className={cls.dialogTitle}>{props.title}</h3>
          <button type="button" className={cls.dialogClose} aria-label={props.closeLabel} onClick={() => props.onCancel()}>
            ✕
          </button>
        </div>
        <div className={cls.dialogBody}>{props.children}</div>
        {props.command !== undefined && <pre className={cls.dialogCmd}>{props.command}</pre>}
        <div className={cls.dialogFoot}>
          <button type="button" className={cls.ghost} onClick={() => props.onCancel()}>{props.cancelLabel}</button>
          <button type="button" className={cls.primary} onClick={() => props.onConfirm()}>{props.confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
