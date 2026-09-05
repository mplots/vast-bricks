/**
 * Whether the user has text selected right now.
 *
 * <p>A row that opens something on click also fires that click when a drag-select of its text ends on it, so copying
 * a value out of a table opens a detail view nobody asked for. A plain click collapses any existing selection on
 * mousedown, so by the time the click runs there is a selection only when the click was the end of one.
 */
export default function hasTextSelection(): boolean {
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim().length > 0);
}
