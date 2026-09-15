package com.vastbricks.api.reconciliation;

import java.util.regex.Pattern;

/**
 * Normalizes collected free text once, before the report, its filters and its rules read it.
 *
 * <p>A marketplace export pads what it writes. A name arrives with a trailing space out of an XML element that was
 * laid out to be readable, with two spaces between the parts of a name somebody typed, or with a non-breaking space
 * a web page put there; none of those is anything about the buyer. Left in, they reach three places that each
 * mishandle them differently: the screen shows a name that looks right and is not, a CSV carries the padding into
 * whatever opens it, and a rule holding two accounts of one order against each other reports a disagreement between
 * two spellings of one name — which is the failure this exists to stop.
 *
 * <p>It normalizes rather than merely trims because the inner runs are the same noise as the outer ones: a reader
 * told that {@code Ana Correia} disagrees with {@code Ana Correia} is being shown two values they cannot tell apart,
 * which is worse than not being told at all. What it does not do is change the name — the case and the characters
 * are the marketplace's own, and only the spacing between them is normalized.
 *
 * <p>The sibling of {@link ReconciliationAmount} for text, and used the same way: at the mapping, so nothing past it
 * has to wonder which spelling it is holding.
 */
public final class ReconciliationText {

    /**
     * Every run of spacing, whatever it is made of. {@code \s} alone would miss the non-breaking space, which is
     * neither whitespace to {@link String#strip()} nor blank to {@link String#isBlank()} and is exactly what a page
     * scraped for a name leaves behind.
     */
    private static final Pattern SPACING = Pattern.compile("[\\s\\p{Z}]+");

    private ReconciliationText() {
    }

    /** The text as everything downstream reads it, or {@code null} when it says nothing. */
    public static String normalize(String text) {
        if (text == null) {
            return null;
        }
        var normalized = SPACING.matcher(text).replaceAll(" ").trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
