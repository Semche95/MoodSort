/** Ctrl, or Cmd on macOS, held during the event. */
export function isModKeyPressed(e: { ctrlKey: boolean, metaKey: boolean }): boolean {
    return e.ctrlKey || e.metaKey
}
