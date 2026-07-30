// Substring → friendly message, matched against the exceptions
// verify_scanned_employee and its callers raise (see Function_Snippets.csv).
// Both EmployeeScanInput's manual path and QrCameraScanner's camera path
// route their caught error through this, so the copy is identical no
// matter which one the person used. Falls back to the raw message for
// anything unmapped, so a new server-side exception still surfaces
// instead of being silently swallowed.
const KNOWN_ERRORS: Array<[substring: string, friendly: string]> = [
  ['Scanned employee ID not recognized', "That badge isn't recognized. Ask the employee to try again or enter the ID manually."],
  ["does not match this ticket's requester", "This badge doesn't match the person who opened the ticket."],
  ['Not authorized to confirm this ticket', "You're not assigned to this ticket, so you can't confirm it."],
  ['Not authorized to close this ticket', "You're not assigned to this ticket, so you can't close it."],
  ['is not awaiting confirmation', 'This ticket has already been confirmed or is no longer awaiting confirmation.'],
  ['Not signed in', 'Your session expired. Sign in again and retry.'],
]

export function toFriendlyMessage(rawMessage: string | undefined): string | undefined {
  if (!rawMessage) return undefined
  const match = KNOWN_ERRORS.find(([substring]) => rawMessage.includes(substring))
  return match ? match[1] : rawMessage
}