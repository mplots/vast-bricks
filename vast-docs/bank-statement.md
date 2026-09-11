# Bank statement feature requirements

The bank is the one party to an order the backend cannot read live: no provider exposes
the account, so a statement is uploaded instead. This is therefore the first stored
business data in the rewrite, and everything about the feature follows from that.

- Uploads are ISO 20022 **camt.052** account reports and **camt.053** statements. The two
  differ only in their wrapper — `BkToCstmrAcctRpt/Rpt` against `BkToCstmrStmt/Stmt` — and
  are the same shape from the account down, so one reader covers both. The flat CSV export
  the same banks offer is not accepted: it states a counterparty as one pipe-joined string
  and gives balance lines no reference at all, so there is nothing in it to upsert on.
- Only booked entries are stored. A report's balances and transaction summary belong to the
  moment it was pulled rather than to the entries, so re-importing a wider range would
  rewrite them for no gain.
- An entry is identified by its tenant, its account IBAN and the bank's own reference:
  `AcctSvcrRef`, falling back to `NtryRef`. A bank that states neither leaves nothing stable
  to key on, so the entry's own stated content is hashed instead, and repeats within one
  document are numbered by the order it listed them.
- **Importing is upserting.** The same document may be uploaded as often as it is exported,
  and an overlapping range refreshes the entries it restates rather than duplicating them.
  Nothing is ever deleted by an import: a range narrowing between exports is not the bank
  withdrawing what it already booked.
- `mapping` is the one column a person writes and the one an import never touches. It is
  the manual last resort for tying an entry to an order when every automatic match has
  failed, so an import that overwrote it would destroy the only thing on the row a human
  put there. Nothing else on an entry is editable.
- The document is posted as the request body under `application/xml`, not as a multipart
  part. A multipart upload would need Spring's default one-megabyte part cap raised in both
  launchers' configuration, and a busy month passes it; a raw body has no such cap. The
  parser has DTDs and external entities off, this being the only place the rewrite reads a
  file a person chose.
- `bank_statement_entries` is tenant-owned in the full sense: a `@TenantId` field, a
  `tenant_id` foreign key cascading from `tenants`, and a unique constraint carrying the
  tenant, since two banks' customers legitimately share an entry reference.
- The screen reads one **period** at a time, and the period is a month or a whole year: a
  month while mappings are being written against entries, a year while a year is being
  looked over. Both are asked for in one request parameter, `YYYY-MM` or `YYYY`, so which
  of the two is being read is readable from the period itself and nothing carries a second
  answer to the same question. A year lists its twelve months' entries flat, in the same
  table, rather than collapsing them into a row each.
- The neighbouring periods are arrows either side of the period, as they are on the
  reconciliation screen, because a statement is read a period at a time and the period
  before is the one asked for next more often than any other — too often to be worth
  opening anything for. The step forward stops at the period being lived through, nothing
  having happened yet in one that has not started.
- Which of the two kinds of period is being read is asked **beside the period, in the title
  bar**, not inside the picker: it is a question about how the table is read, not about
  which period is being read, so it does not belong inside the thing that picks one. It is
  a toggle of two buttons with the view already on screen disabled rather than merely
  unselected, there being nothing to ask for by pressing it, which is the pattern
  `vb-portal-full-version` uses wherever it offers a period of its own. Switching reads the
  same span in the other view rather than starting the reader somewhere they did not ask
  for: a month widens to its year, and a year narrows to its last month that has actually
  happened.
- The reconciliation screen's month and the bank statement and Stripe transaction screens'
  period are the title of their table, and wear one shared look for it, so a title bar
  never shows two differently sized titles of the same kind of thing.
- The period's entries are narrowed by a panel down the left of the table: the same panel
  the reconciliation screen puts beside its orders, persistent where there is room for it
  and a temporary overlay where there is not, opened by a button in the title bar beside
  the period. The shell, the facet list and the narrowing itself are shared rather than
  copied for this one, with the reconciliation screen and with the Stripe transaction
  screen, which reads a ledger the same way; see "Stripe transactions feature
  requirements". The panel holds `Filters` and nothing else, there being nothing on this
  screen that decides how the entries read, and the title bar states how many of the
  period's entries the narrowing left on screen.
- Searching is the other way the entries are narrowed, and it is not in the panel. A switch
  in the title bar beside the panel's own opens a second row in the table's head, holding
  one search field per column that can be searched, each under the column it searches: the
  text a reader is matching against is in that column, so that is where the field for it
  belongs. The row is asked for rather than always there, most reading of a statement being
  reading it, and it rests under the heading row so both stay over the entries while a long
  period scrolls. The heading row's height is measured rather than assumed, a heading
  wrapping onto a second line on a narrow screen.
- The search row carries the card's own ground rather than the head's tint. The tint is what
  says a row is headings, so fields to type in sitting on it read as headings that happen to
  be editable; and the two grounds are what tell a reader where the head's naming stops and
  its asking starts, which saves the row a rule of its own.
- There is one field style on this screen, wherever it is typed in: the mapping written
  against an entry and the search asked of a column are the same field, declared once. A
  reader meets both in the same table and a second look would read as a second kind of
  control. It is a line under the text and no box around it: a box in every searchable
  column reads heavier than the headings it is asking about. The line answers a hand in
  three steps, each one louder than the last. At rest it is drawn under the divider's own
  weight but plainly there, saying a field is here to a reader pointing at nothing; a hand
  anywhere on the row brings it up to the divider's weight; and pointing at the field itself
  sweeps a line in over it, in the accent colour, the way the focused field's own line
  arrives — one pixel to the focused line's two, so a hovered field stays quieter than the
  one being typed in. At full weight under every row of a period the resting line would be
  another rung of the ladder this table was rid of, and it is faded by the line's own opacity
  rather than by a paler colour so one number covers both themes, the divider being a
  transparent colour already.
- The sweep is what marks a hovered field, so the resting line can afford to be read: the
  two states are no longer told apart by how invisible one of them is. It is therefore the
  colour that has to arrive and not the weight. A sweep in the divider's own colour was an
  animation nobody could see, landing on a resting line of the same weight and colour, and a
  hovered field that answered by thickening its line instead read heavier than the rule under
  the table's head — a hand resting on a field is not a change in the table.
- The placeholder still names what goes in the field rather than repeating the heading over
  it. The line is held off the text and the mark above it by padding under the field as a
  whole rather than under the text: the mark is the input's sibling, so room made on the text
  alone would leave the mark on the line.
- A mark before the text is the one thing the two are allowed to differ in: a search field
  carries a magnifier, the mapping carries nothing, an icon standing in every row of a
  period being noise rather than a cue. It is set quieter than the text it stands before,
  and the field's label says the same thing in words, so nothing rests on the mark alone.
- The columns are laid out to stated shares of the table rather than to what is in the
  cells. A column measured from its own content moves whenever the content does — the
  search row opening under the headings, a period stepped to whose amounts are a digit
  longer, a month widened to its year — and a reader who has just found the entry they were
  looking for should not have the table shift under them to say so. They are shares rather
  than pixels so the columns grow with the width the table is given, and text that cannot
  be broken at a space is broken anyway rather than allowed to spill into the column
  beside it.
- Putting the row away empties it. A row put away with words still in it would go on
  narrowing the table from somewhere the reader cannot see, which is the one thing a screen
  that states how much of a period it is showing must not do.
- A column searches what it shows, so the counterparty field searches the account beside
  the name: both are in that cell, and a reader pasting an IBAN is searching what is in
  front of them. The fields are currently the counterparty, the details and the reference.
  The mapping has none: it is a text input in every row, and an input cannot carry the mark
  that says which part of it was found.
- Within one field the text is split on whitespace and every word has to be found, anywhere
  within a word and with case ignored, so half a name or a fragment of an order number is
  worth typing and a counterparty the bank spelled surname first is still found by typing
  the name out. Across fields they narrow: a name under the counterparty and a number under
  the details asks for the entries answering both. No closer approximation is attempted: a
  search that guessed at spelling would hide the entry a mapping is being written for.
- What was found is marked in the cell, in the palette's warm shade and as a `mark`
  element, so it says the same thing to a reader who cannot see the colour. Marking it is
  what makes a search worth running against a column of long remittance lines: the reader
  is looking for an order number inside a sentence a payer wrote, and a row that merely
  matched somewhere leaves them to find it again by eye. The mark keeps the cell's own text
  colour, the amount column being coloured by direction. Every word the field asked for is
  marked wherever it appears in that column.
- A year of entries is filtered again at every keystroke, so the fields answer the key at
  once and the table catches up a render later. Typing never waits on the period being
  read, however long it is. The marks are drawn from the same narrowing the entries were
  filtered by, so a cell never marks a word that is not why its row is there.
- Narrowing is otherwise a facet, as it is on the reconciliation screen: a facet states how
  an entry answers it and how that answer reads, and the options, their counts and the
  narrowing follow. A group's counts are of the entries the rest of the narrowing already
  lets through — the search as much as the other groups — so a count states what ticking it
  would leave, and every value the period holds keeps its box for as long as that period is
  on screen. A facet the whole period answers the same way narrows nothing and is not
  offered. Adding a filter is adding a facet to the screen's list.
- The current facet is the direction, credit first: which way the account moved is the
  coarsest question there is about a statement, and money in is what a mapping is normally
  written against. A booked entry answers every facet there is so far — it moved one way,
  in one currency — so no option stands for having answered nothing; a facet over a field
  an entry may leave empty is when to bring that option over from the reconciliation
  screen, which has one.
- Narrowing decides which entries are on screen and never what the period came to. The
  foot stays the bank's account of the period: both turnovers are stated whichever way the
  entries were narrowed, and the closing balance is derived over every stored entry up to
  the end of the period, so it could not follow a filter at all.
- Which entries are shown is this screen's own state rather than something the address
  carries, as the period is. The reconciliation screen keeps its narrowing in the address
  because a month of orders is worth handing to someone as a link; a statement is read a
  period at a time in front of the entries a mapping is being written against.
- A period whose narrowing lets nothing through says so in the table rather than in place
  of it: the search row is in that table's own head, and a message drawn instead of the
  table would take away the fields the reader has to reach to get their entries back. A
  period nothing was imported for has no table at all and says that instead.
- The panel's clear button empties the search row and the facets together, being the one
  control over the whole narrowing; Escape empties one field from inside it.
- The foot of the table states what the period came to, laid out the way a bank lays out
  the foot of a statement: the figure in the amount column, what it is beside it. Three
  lines — debit turnover, credit turnover, net movement, closing balance — per currency the
  period moved in, and a whole group per currency rather than one set of totals, an account
  moving in two currencies having two accounts of itself. The net movement is ruled off from
  the turnovers it sums, the way it would be on paper.
- **Every ledger screen states both the net movement and the closing balance**, because they
  answer two different questions and a reader holding the bank statement against the two
  provider ledgers needs both from each: the movement is what the period did, and the
  balance is where the account stood when it ended, which holds everything before the
  period as well. The balance is weighted like a total but is not ruled off, because
  nothing above it adds up to it.
- The summary keeps the table's own background rather than the tinted one a footer wears by
  default, and drops the small upper case a footer is otherwise set in: these are three
  sentences about money, not column headings. That tint is close enough to the page behind
  the card that the figures sat in a band reading as neither table nor page; the rule above
  the footer already says where the entries stop.
- **The period, the head and the summary all stay in view while the entries scroll.** The
  bar says what period is being read, the head names the columns and the foot totals them,
  and a period long enough to scroll is exactly the period where all three are wanted while
  the middle is being read — a total cannot be arrived at by looking, and a picker that has
  scrolled away is a period that cannot be stepped from the foot of a long one. The head
  rests under the bar at the height the bar came out at, measured rather than assumed: the
  period, the view toggle and the buttons wrap onto a second line in a narrow window, and in
  the pane of the matching split, which is half a screen.
- **Where those things rest is a value the container sets**, not the app header's height
  baked in. The page is normally what scrolls, so they stop under the app header; in the
  matching split the pane scrolls instead, and the same things stop at the pane's own top.
  It is one custom property, read by this screen, by the reconciliation screen, by the
  ledger table look they share and by the side panel — so a screen keeps one rule for where
  its head rests and none of them needs to know it is in a pane.
- **The gap a screen leaves above its own card is a second such value**, and needed for the
  same reason. On the page it is the room between the breadcrumb and the card; in a pane it
  is room the bar would jump over the moment a reader scrolled, the bar coming to rest at
  the pane's top while the card stood twenty pixels below it. A pane sets the gap to nothing,
  so the bar is where it will stay from the first row onward.
  Giving the entries a window of their own would have given both something nearer to hold
  on to, but it puts a second scrollbar beside the page's, and a reader scrolling a table
  should not have to notice which of two bars they are pushing. So nothing between the
  table and the page may clip, the card included.
- **A line is spent only where the table changes.** A statement is dozens of rows long, and a rule under every entry,
  a divider between every heading, a line under each summary line and an underline under every mapping field all read
  at one weight — a grid, in which the two rules that actually say something are lost. So the entries are separated by
  a banded ground rather than by a line each, the head hangs no column dividers, the summary carries no line under
  each of its three, and the mapping field draws its underline only when its row is pointed at or the field is being
  written in. What is left is the heavy rule under the head, the heavy rule above the summary, and the light one the
  closing balance is ruled off by. The band is the theme's own hover colour, so the row under the pointer answers in
  another one rather than in the one half the rows already wear.
- The foot is grounded and rounded **on its cells, never on the foot itself**. The theme grounds and edges a footer as
  a whole, and both are squares the full width of the table: they fill in and rule across the corners the last line
  rounds to meet the card, which the card cannot round for itself because it may not clip. So the foot is stripped of
  the theme's ground and edges, its cells carry the ground, and the first line draws the rule above it.
- The head is stuck cell by cell, the way MUI's own `stickyHeader` does it. **The foot is
  stuck as one element**, and this is not a matter of taste. The theme gives a table cell
  `position: relative` to hang a column divider off, under a selector that beats a plain
  `sx`, and exempts the last cell of a row — so a foot stuck cell by cell comes apart down
  the middle, the name of a line resting while the figure beside it scrolls on. Out-
  specifying the theme is possible, and the head does exactly that, but a foot has a second
  reason not to: a cell resting against the bottom is placed by its own bottom edge where
  the head is placed by its top, and cells of one line share a top edge but not necessarily
  a bottom one. A screen adding a stuck row to a table should know which of the two it is
  adding.
- The turnovers are the period's own entries. The **closing balance is derived**, not the
  bank's own figure: it is every stored entry up to the end of the period, credits less
  debits, so it is the bank's closing balance only for an account imported from its opening
  balance onward and states the movement it holds otherwise. Balances are still not read
  from a camt document, for the reason above, so there is nothing to reconcile it against;
  if that is ever wanted, the `Bal` elements are what to import.
- The feature exposes two public types and nothing else: `BankTransfer`, one booked entry
  as another feature reads it, and `BankTransfers`, which answers the entries of a span of
  days. That is the whole of what leaves the package — importing, upserting, the summary
  and the mapping a person writes are internals, and what another feature needs is what the
  bank booked. Reconciliation matches bank-transfer orders through it; see "Reconciliation
  feature requirements".
- The balance is summed in the database rather than by loading the rows it covers, that
  range growing with every import while what is wanted out of it stays two numbers per
  currency. It is the feature's one JPQL query, so it is also the one place where
  `@TenantId` reaching an aggregate rather than an entity load is worth an acceptance test
  of its own.

### Matching a bank transfer by hand

A bank transfer is matched to an order by the order id it names, and a payer who named
none leaves an order the bank paid reading as unpaid. The mapping is the manual last
resort for exactly that, and this is how a person writes one without typing an id.

- It is a **mode of the reconciliation screen**, opened from the bar over the month and
  carried in the address like everything else that screen reads, so the split survives a
  reload and can be handed to someone as the link it is.
- The split shows **the two screens themselves**, side by side: the reconciliation orders
  as they are read anywhere, with their own filters, failures and columns, and the bank
  statement with its own period, search and narrowing. Neither is a list written again for
  this. What the split adds is one sentence spanning them — this order was paid by that
  transfer — and the bar across the foot that states it.
- The orders stay on the left, being what the split is opened from. The statement opens on
  the month the orders are of; where it goes from there is the reader's, because a transfer
  is paid when a buyer gets around to it and the entry is as often in the month after.
- Picking is a click on a row on either side, and only the two screens' own rows: a
  bank-transfer order on one side, an entry on the other. An order the marketplace settled
  another way still opens its detail on a click, the bank having settled no other kind, so
  a row that could never be linked does not sit there answering nothing.
- Linking writes the order's id into the entry's `mapping` and nothing else. That is the
  whole of what reconciliation reads out of one: it scans the text for the ids of the
  orders it collected, so anything written around the id would only be text to scan past.
- Both screens are read again afterwards, which re-collects the month from every provider.
  That is the price of the answer being live: the order goes green because the bank now
  names it, and nothing short of collecting it again can say so.
- Untying is offered on the entry, because the mapping is the entry's own field: an order
  is linked by whatever names it, and clearing that is clearing the entry that does.
- Every entry of the period is shown, an entry that already names an order marked as
  linked, so a reader picking one can see which are spoken for without reading the mapping
  of every row. An entry matched by the payer's own words rather than by a mapping is not
  marked, the entries knowing nothing of what the remittance text matched; the order side
  says it instead, by having a paid amount.
- In the split the orders open on the columns matching is about — who the order is, what it
  came to, and whether a payment has been found. A pane is half a screen, and the month's
  own columns in half a screen are wrapped headings with no room under them. The address
  still wins, so a reader who asks for more keeps them. Both panels start shut for the same
  reason.
- **Each pane scrolls on its own.** One side is walked down while the other stays where it
  was, which is the whole of reading two lists against each other: a page that scrolled both
  would move the order out of sight exactly as the entry that pays it came into view. It is
  the one place the ledger screens' own rule — the page is the only thing that scrolls —
  does not hold, and it holds again the moment the panes stack on a narrow screen.
- A pane is therefore what its screens stick against, which is what the sticky origin above
  is for: the bar, the table head, the summary foot and the panel all come to rest at the
  pane's own top rather than under an app header that is no longer above them.
- Dragging the divider moves a custom property on the split and nothing else: as a style it
  would be a class generated and injected for every pixel dragged, as state it would re-render
  both screens, and either way the transition that carries the split open would be easing the
  columns after the pointer rather than following it. What was dragged to becomes state once,
  when the pointer is let go — which is also the only moment it is written to this browser.
  A pointer taken away rather than lifted ends the drag as well, a split left dragging being
  one that follows a pointer nobody is holding.
- **The divider between the panes is dragged**, and the share it was left at is remembered
  in that browser: a reader who widens the entries to read a payer's own words expects them
  still wide the next time they come to match a month. Neither pane is dragged away to
  nothing. It answers the arrow keys as well as the pointer, a split that could only be set
  with a mouse being one not everyone can set.
- **The line between the panes is also where the two sides are tied together**: once a row
  is picked on either side, a circle stands on it carrying the link. On the line because that
  is where the two sides meet and where a reader's eye already is, having just picked a row on
  either side of it — and **at the height the link itself runs at**, halfway along its own
  curve, not halfway down the window. A reader who has just picked two rows near the top of a
  long month is looking at those two rows; a circle pinned to the middle of the pane is a
  circle nowhere near the pair it would tie, and reads as a control belonging to nothing. The
  button that unties a link stands on that link the same way and always did. Nothing picked is
  nothing to do, and the line is left a line.
- There is no bar across the foot. One said the same thing and spent a strip of every screen
  saying it, most of the time with nothing picked and nothing to say. What it also carried
  is elsewhere: closing the split is the same button in the month bar that opened it, and a
  failure is said in the app's own snackbar — a message drawn between two panes would push
  one of them down, which is the one thing a screen a reader is picking rows in must not do.
- **Neither pane is read sideways.** Two tables in half a screen each would scroll sideways
  to reach their last column, which on the entries is the mapping — the column the split is
  open for. So the entries hold no width open in a pane and drop the bank's own code and
  reference, whose width is the mapping's, and the orders open on the columns matching is
  about. Both are only where the split opens: the address still carries the orders' columns,
  and the entries' own screen is untouched.
- **The scrollbars are thin and drawn only while a pane is under the pointer**, which is the
  pane being scrolled. Two panes side by side are two permanent bars framing every table in
  grey, and a split is already two of everything. The gutter is held either way, so nothing
  shifts sideways when a thumb arrives — and on both edges of a pane rather than one, since
  on one it is reserved at the pane's right, which for the left pane is the side the line is
  on, and the two cards then stand at different distances from it.
- **The page itself does not scroll while the split is open.** The panes fill the window
  under the breadcrumb and the document is held still: a page scrolling behind them would
  carry both lists out of the window at once, which is the one thing two lists read against
  each other must not do. The line therefore runs the whole height of the window.
- **The line says it can be moved rather than leaving a reader to find out.** A grip stands
  in the middle of it, which is where a hand reaches for a divider, and it stays there while a
  link is being offered: the circle that ties one now stands where that link runs rather than
  in the middle, so the two no longer share a spot for one of them to give up. What the grip
  says — this line moves — is true whether or not a pair is picked.
- **The entries come in from the side they stand on and leave the same way**, so the split
  reads as the orders being joined by them rather than as one screen replaced by another. It
  is the panel this screen already opens beside its orders in shape — the same easing, a step
  slower, half a screen being more to take in than a panel — and the split outlives the
  address by the length of its own closing, an unmounted pane not being something anyone can
  watch leave.
- A pane carries the rounded bottom the card would have rounded for itself. The card is
  taller than the pane and the pane is what clips it, so without it the entries end in a
  square cut across the foot of the window.
- **Picking one end of a link lights up both ends**, and every end is marked the same way —
  dotted, on whichever side it is and whichever end was picked. It is stated once, by the
  split, because it is a fact about the two tables together rather than about either of them:
  a row marked one way on one side and another on the other reads as two different things.
  It is the theme's own quiet colour — this table already spends colour on how an
  order reconciled and on which marketplace it came from, and a third loud one would be read
  as a third fact.
- Which rows those are is the order's own account of what settled it rather than the text on
  the entry, so a link the matching found for itself is drawn exactly as one a person wrote.
- **The other end is brought level with the picked row**, in its own pane and nothing else's:
  the two ends read as a link when the line between them goes across, and as two coincidences
  when it runs the height of a table. It is moved outright rather than glided — this is where
  a row is rather than something happening to it, and a glide stops progressing in a tab
  nobody is looking at.
- **A link is drawn for the row a reader is looking at**: one they have picked, one the
  pointer is over, one they have taken hold of, or one they are about to make. Not all of
  them at once — a month of transfers is a month of lines across the middle of the screen,
  and a drawing that never changes is one nobody reads. Each is a curve across the gap from
  one row to the other; two outlines leave them to be paired up by eye, and the line says
  which two.
- The pointer is noted on the split rather than on every row of two tables: one listener for
  a screenful of rows, and neither screen has to know that a pointer over one of its rows
  means anything. A click on the ground around the tables puts both picks down: pointing
  at two rows is how a reader picks them, so pointing at nothing at all is how they stop. A
  control is not that ground — closing a panel, or pressing anything either screen carries,
  is a reader working with what they picked rather than pointing away from it.
- **No lines while a panel is out.** A filter or column panel slides over the very rows the
  lines run between, and a curve laid across it reads as a line through the panel. The screens
  say when they have one out, the way their rows say what they are; the split reads it. Nor
  are they drawn while the divider is being dragged, being measured then against panes that
  are still changing width.
- The lines are read off the rows themselves — an order states the entries that settled it,
  an entry states its own reference — so the split pairs up what the two tables are showing
  without holding a list of its own. They are re-measured whenever a pane scrolls and
  whenever a pane changes shape, the panes opening by animating their own width.
- A link with an end scrolled out of its pane is drawn against that pane's edge and faded,
  so it reads as pointing off the screen rather than as joining the row it happens to touch.
  A link nobody can see is a link nobody knows is there.
- **A link about to be made is drawn too, dotted**: two rows picked on either side are a link
  a reader is proposing, and the dots are what tell it from the ones that exist. The circle
  at the divider offers to tie it, and offers it only while it is still a proposal: once the
  link exists there is nothing left to tie, so what stands there is the button that breaks
  it and nothing beside it. Two circles, one offering to make what the other has just made,
  would leave a reader to work out which of them already happened.
- Both rows stay picked once a link is made, and its line stays drawn. What was a link about
  to be made is now one that exists, and a reader who has just made it is looking straight at
  it: dropping the picks would take the line and the marks off the two rows at the very
  moment they became true.
- A linked entry wears no ground of its own. The dotted marks and the line say it is an end
  of a link, and this table already colours an amount by its direction — a row tinted for
  being spoken for would be a second colour saying a second thing.
- The line between the panes answers a hand on the line. A hand on the button standing on it
  is reaching for the button, not for the divider, so the line stays as it was.
- **Untying belongs to the link being untied.** Taking hold of a line, or picking either of
  the rows it runs between, brings up the button that breaks it — and only where a person
  wrote the mapping that tied it. An automatic match is what the payer's own words say and
  has nothing on the entry to clear, so it is drawn like any other link and offers no break.
- Neither pane shows a scrollbar. Two panes side by side are two more bars than a screen
  should carry, and they frame every table in grey down the very edges the lines are drawn
  across. The panes still scroll, by wheel, by touch, and by being asked to bring a row into
  view.
- Each pane keeps its own stacking to itself. A screen's sticky bar and table head sit above
  their own rows by number, and without that containment they are numbered against the line
  between the panes as well. Nor does the line clip what stands on it: the circle is wider
  than the line, and a clipped one reads as a pill wedged between the tables.
- **The orders are one mounted screen whether the split is open or not**, the split wrapping
  them either way. Swapped in and out instead, they come back with their panel already open,
  having never had a shut state to open from, and with the month scrolled back to the top.
  The panel follows the split rather than being settled at the first render, which is also
  what animates it: a drawer that was already there slides where one just put there cannot.
- What was picked is forgotten when the split closes, along with the lines and the buttons: a
  screen no longer read beside anything has no links on it to be an end of.
- The orders show how an order was paid in the split as well, that being the column which says
  whether the statement beside them could have paid it at all.
- In a pane the summary's own names stand on the wide side of the figure rather than after
  it. The columns after the amount are the narrow ones there, and a name broken over two
  lines makes four lines of a foot read as eight.

