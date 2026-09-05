/**
 * Layout choices a route makes for itself, declared as the route's `handle` and read once by the dashboard layout.
 * A page states what it needs rather than reaching out of the layout it is rendered in.
 */
export interface PageLayout {
  /** Fill the width available instead of the centred container. A wide table wants the room. */
  fullWidth?: boolean;
  /** Whether the breadcrumb block repeats the page's name as a heading under the trail. */
  heading?: boolean;
}
