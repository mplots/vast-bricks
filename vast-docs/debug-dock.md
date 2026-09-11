# Debug dock requirements

The debug dock is the portal's network tab for the backend: what the Vast backend sent to
a provider and what came back. It is a feature of its own, not part of reconciliation, and
covers every provider call the backend makes rather than one screen's.

- Nothing is captured until a user presses Record. An ordinary request costs a
  thread-local check and stores nothing.
- Recording is armed per user and expires on its own, so a session left armed stops
  writing provider payloads by itself. It is held in memory, so a restart stops every
  recording, which is the safe direction to fail in.
- Closing the dock stops recording too: nothing is written while nobody is watching.
  Whether it was running is remembered, so reopening resumes it rather than asking for the
  same click again, and stopping it by hand before closing means it stays stopped.
- Recorded rows belong to the user whose request caused the call, and a read or a clear
  only ever touches that user's own rows. A call made with no user on the thread belongs
  to nobody and is dropped rather than stored unattributed.
- Rows hold whatever the provider sent, so they can contain buyer names, addresses and
  emails. The panel's Clear button deletes the caller's rows and is the retention control;
  a scheduled retention window is the obvious follow-up if the table grows.
- Bodies are stored up to a cap and the row is marked truncated beyond it, so one
  pathological response cannot bloat a row or the panel.
- A body that is not text is kept as a file rather than decoded: an export hands
  over a spreadsheet and a label a PDF, which read as a screenful of replacement
  characters and, carrying NUL bytes, cannot be stored in a text column at all —
  so recording one as text would have failed the request that made the call
  rather than only the recording of it. A provider that states no content type is
  taken at its word and decoded; a NUL in what comes out is what says it was not
  text after all.
- Such a body is stored as it arrived, with the type the provider called it, and
  the body column carries a note of its type and size in its place. The panel
  offers it as a download beside that note rather than as the copy button a text
  body gets: what a spreadsheet is worth is opening in the program that reads
  it. A download is fetched through the panel's own client and handed to the
  browser, not linked to, because a link would arrive without the caller's token.
- A file has a cap of its own and is not stored at all beyond it, a truncated
  spreadsheet being a corrupt file rather than a shorter one; the note still says
  what it was and the row is marked truncated. A file's bytes are stored
  unmasked, there being no sensible way to mask inside a zip — a client's secrets
  are masked in the text and the URL as before.
- The client layer records; the debug feature decides what is kept. A client wraps the
  operation it wants recorded in `HttpExchangeCapture.record`, naming itself as the
  provider, and knows nothing about who wants the traffic. `HttpExchangeSink` is the
  boundary: the client package never depends on the debug feature.
- A client method keeps its own signature. Nothing returns raw traffic to a caller, so a
  feature that calls a provider does not change shape to be observable.
- How a client records follows how it reaches its provider. The ones on `RestClient`
  install `HttpExchangeCapture.interceptor()`, the generated Manakabata invoker included,
  since it takes a `RestClient` of its own. Stripe is reached through its own SDK and has
  no interceptor to hang the capture on, so its SDK transport is decorated instead and
  reports each round trip through `HttpExchangeCapture.add`. That is the seam for any
  future SDK-based provider.
- A client masks the secrets it sent. Masking happens once a recorded operation finishes
  rather than as each request is recorded, so a credential the client only learns along
  the way is masked in the response that issued it as well as in the requests that go on
  to use it: `BrickStoreClient` registers its session token and `PayPalClient` its access
  token through `HttpExchangeCapture.mask` for exactly that reason.
- One recorded operation is one client method, however many requests it takes. A BrickLink
  export records its session creation and its export, PayPal its token request and one
  search per page of each segment its window is searched in, Stripe one request per page
  of its cursor paging.
- Whose request a call belongs to travels on `DebugContext`, bound by an interceptor that
  runs after authentication has resolved the user. `ParallelTasks` propagates it alongside
  the settings profile, because a batch fetched on a virtual thread would otherwise record
  under no user.
- The dock is app-wide, docks left, right or bottom, and displaces the page rather than
  covering it: the main content is sized by flex, the fixed header takes the dock's width
  out of its own, and a bottom dock takes its height out of the page's minimum. It opens
  from a button where the template's Buy Now button used to sit, and never restores open,
  because it is a tool you reach for rather than one that greets you.
- The dock grows by adding a panel to `debugPanels`; the shell, its state and its toolbar
  do not change. Network is its first panel, not its only one. Chrome that belongs to the
  dock — the tabs, the dock side, close — lives in the shell; controls that belong to one
  panel, as Record and Clear belong to Network, live in that panel.
- The Network panel reads two ways. By time is the default and lists every call, each row
  naming its provider, which is the only way to see one provider's call land between
  another's. By provider gathers them under the provider that answered, one row per
  provider with its call count, total size and a failure count when a call was not 2xx,
  drilling into that provider's calls. Either way the newest call is at the top: the call
  you just made is the one you opened the panel for. Both reach the same detail: one
  call's request and response bodies, laid out and syntax coloured.
- A body carries no find of its own. The whole body is in the page, so the browser's own
  search reaches it, which is what people use anyway, and an in-panel find had to fight
  the highlighter for its own tokens to mark a match.
- Reload re-reads everything stored for this user, for rows recorded while the panel was
  not open, and the toolbar states how many are stored and what they weigh, so Clear says
  what it would delete.

