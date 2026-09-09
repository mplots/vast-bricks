import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useSWRConfig } from 'swr';

import { updateBankStatementMapping } from 'api/bankStatements';
import { openSnackbar } from 'api/snackbar';
import type { BankStatementEntry } from 'types/bankStatement';
import type { ReconciliationOrder } from 'types/reconciliation';
import type { SnackbarProps } from 'types/snackbar';

/**
 * What the two screens of the matching split hold in common: which order and which entry are picked, and the one act
 * that ties them together.
 *
 * <p>It is a context rather than props threaded through either screen because neither owns the other. The orders and
 * the entries are two whole screens, each with its own period, its own narrowing and its own table, and what the
 * split adds is a single sentence spanning them — this order was paid by that transfer. Only that sentence is shared.
 *
 * <p>Outside the split there is no provider, so both screens read `active: false` and behave exactly as they did:
 * a reconciliation row opens its detail, and an entry's mapping is a field to type in.
 */

/** A bank entry is tied to an order by the order id written in its mapping, which is what reconciliation reads. */
export type BankMatching = {
  /** Whether the screens are being read side by side to link one to the other. */
  active: boolean;
  order: ReconciliationOrder | null;
  entry: BankStatementEntry | null;
  selectOrder(order: ReconciliationOrder | null): void;
  selectEntry(entry: BankStatementEntry | null): void;
  /** Writes the picked order's id into the picked entry's mapping, and reads both screens again. */
  link(): Promise<void>;
  /**
   * Clears one entry's mapping, which is what unties it from whatever it named. By id because a link is untied from
   * the line drawn for it, which knows the entry it runs to and nothing else about it.
   */
  unlink(entryId: number): Promise<void>;
  linking: boolean;
  /**
   * Whether either screen has a panel out. The split draws no lines across one: a filter or column panel slides
   * over the very rows the lines run between. Each screen says so for itself, neither knowing the other is there.
   */
  panelOut: boolean;
  notePanel(side: 'orders' | 'entries', open: boolean): void;
};

const inactive: BankMatching = {
  active: false,
  order: null,
  entry: null,
  selectOrder: () => {},
  selectEntry: () => {},
  link: async () => {},
  unlink: async () => {},
  linking: false,
  panelOut: false,
  notePanel: () => {}
};

const BankMatchingContext = createContext<BankMatching>(inactive);

/** What a screen inside the split reads. Outside one it is inactive, which is what keeps both screens unchanged. */
export function useBankMatching() {
  return use(BankMatchingContext);
}

/**
 * Whether this entry is one of the ones that settled this order, which is what makes the two rows the ends of one
 * link.
 *
 * <p>Asked of the order rather than worked out from the text a person wrote on the entry: reconciliation matches a
 * transfer by the mapping *or* by what the payer wrote on it, and only the first of those is written on the entry.
 * Reading the mapping alone would draw the links somebody typed and none of the ones the backend found itself.
 */
export function settledBy(order: ReconciliationOrder, entry: BankStatementEntry) {
  return (order.gateway.entryReferences ?? []).includes(entry.entryReference);
}

/** Only an order the marketplace says was paid by bank transfer can be linked: the bank settled no other kind. */
export function isBankTransferOrder(order: ReconciliationOrder) {
  return order.order.paymentMethod === 'Bank Transfer';
}

export function BankMatchingProvider({ active, children }: { active: boolean; children: ReactNode }) {
  const { mutate } = useSWRConfig();
  const [order, setOrder] = useState<ReconciliationOrder | null>(null);
  const [entry, setEntry] = useState<BankStatementEntry | null>(null);
  const [linking, setLinking] = useState(false);
  const [panels, setPanels] = useState<{ orders: boolean; entries: boolean }>({ orders: false, entries: false });

  const notePanel = useCallback((side: 'orders' | 'entries', open: boolean) => {
    setPanels((current) => (current[side] === open ? current : { ...current, [side]: open }));
  }, []);

  // What was picked is forgotten when the split closes: the rows are marked as ends of a link, and a screen that is
  // no longer being read beside anything has no links on it to be an end of.
  useEffect(() => {
    if (!active) {
      setOrder(null);
      setEntry(null);
    }
  }, [active]);

  /**
   * Reads both screens again from wherever they are.
   *
   * <p>By the key each screen asked under rather than through a reload handed up from it: a screen in the split is
   * the same screen as outside it, and one that had to pass its own reload out would not be.
   *
   * <p>The orders are re-collected in full, which queries every provider again. That is the price of the answer
   * being live: the order turns green because the bank now names it, and nothing short of collecting it again can
   * say so.
   */
  const rereadBoth = useCallback(
    () =>
      mutate(
        (key) =>
          typeof key === 'string' &&
          (key.startsWith('/api/private/reconciliation/orders') || key.startsWith('/api/private/bank-statements/entries'))
      ),
    [mutate]
  );

  /**
   * Writes a mapping and reads both screens back.
   *
   * <p>A failure is said in the app's own snackbar rather than drawn between the two panes: the split is two tables
   * and the line between them, and a message laid into that would push one of them down — which is the one thing a
   * screen a reader is picking rows in must not do. It is where the invoice this screen generates says how it went,
   * and for the same reason.
   */
  const write = useCallback(
    async (entryId: number, mapping: string) => {
      setLinking(true);
      try {
        await updateBankStatementMapping(entryId, mapping);
        await rereadBoth();
        return true;
      } catch (failure) {
        openSnackbar({
          open: true,
          message: failure instanceof Error ? failure.message : String(failure),
          variant: 'alert',
          alert: { color: 'error' }
        } as SnackbarProps);
        return false;
      } finally {
        setLinking(false);
      }
    },
    [rereadBoth]
  );

  const value = useMemo<BankMatching>(
    () => ({
      // The provider wraps the orders whether the split is open or not, so that the orders stay one mounted screen
      // across the toggle. What tells the screens they are in a split is this, not the provider being there at all.
      active,
      order,
      entry,
      selectOrder: setOrder,
      selectEntry: setEntry,
      link: async () => {
        if (!order || !entry) return;
        // The order id alone, which is the whole of what reconciliation reads out of a mapping: it scans the text
        // for the ids of the orders it collected, so anything written around the id would only be text to scan past.
        //
        // Both rows stay picked afterwards. What was a link about to be made is now one that exists, and a reader
        // who has just made it is looking straight at it: dropping the picks would take the line and the marks off
        // the two rows at the very moment they became true.
        await write(entry.id, order.order.orderId);
      },
      unlink: async (entryId) => {
        if (await write(entryId, '')) {
          setEntry(null);
        }
      },
      linking,
      panelOut: panels.orders || panels.entries,
      notePanel
    }),
    [active, order, entry, linking, write, panels, notePanel]
  );

  return <BankMatchingContext value={value}>{children}</BankMatchingContext>;
}
