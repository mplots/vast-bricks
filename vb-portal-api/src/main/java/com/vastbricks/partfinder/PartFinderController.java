package com.vastbricks.partfinder;

import com.vastbricks.partfinder.PartFinderRepository.PartColorRow;
import com.vastbricks.partfinder.PartFinderRepository.StoreOfferRow;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Finds a part in a color and the sets for sale that contain it, store by store. */
@RestController
@RequiredArgsConstructor
@RequestMapping(value = "/api/private/part-finder", produces = MediaType.APPLICATION_JSON_VALUE)
public class PartFinderController {
    private static final int MAX_LIMIT = 50;

    /** A size such as "1 x 1", "1x1" or "2 x 4 x 3", kept as one term so its numbers stay together and in order. */
    private static final Pattern TERM = Pattern.compile("\\d+(?:\\s*[xX]\\s*\\d+)+|\\S+");
    private static final Pattern REGEX_SPECIAL = Pattern.compile("[\\\\.^$|?*+()\\[\\]{}]");

    private final PartFinderRepository repository;

    /**
     * Part and color pairs matching every term of the query, in any order: "tile 1x1 dark bluish", "3070b gray".
     *
     * <p>A term matches at the start of a word, so it can be typed partially. A size matches whole, so "1 x 1" is not
     * also "1 x 10".
     */
    @GetMapping("/parts")
    public List<PartColorRow> searchParts(
        @RequestParam("q") String query,
        @RequestParam(value = "limit", defaultValue = "20") int limit
    ) {
        var patterns = toPatterns(query);
        if (patterns.isEmpty()) {
            return List.of();
        }
        return repository.searchPartColors(String.join(" ", patterns), Math.min(Math.max(limit, 1), MAX_LIMIT));
    }

    /** The sets for sale that contain the part in the color, the one cheapest anywhere first. */
    @GetMapping("/sets")
    public List<SetForSale> findSets(@RequestParam("partNum") String partNum, @RequestParam("colorId") int colorId) {
        var sets = new LinkedHashMap<Long, SetForSale>();
        for (StoreOfferRow row : repository.findStoreOffers(partNum, colorId)) {
            sets.computeIfAbsent(row.getSetNumber(), number -> new SetForSale(
                number, row.getSetName(), row.getTheme(), row.getPieces(), row.getPartQty(), row.getImage(), new ArrayList<>()
            )).getStores().add(new SetForSale.StoreOffer(row.getWebStore(), row.getPrice(), row.getLink(), row.getSeenAt()));
        }
        sets.values().forEach(set -> set.getStores().sort(Comparator.comparing(SetForSale.StoreOffer::getPrice)));
        return sets.values().stream()
            .sorted(Comparator.comparing(set -> set.getStores().get(0).getPrice()))
            .toList();
    }

    static List<String> toPatterns(String query) {
        return TERM.matcher(query).results()
            .map(match -> match.group())
            .map(term -> term.replaceAll("^\\W+|\\W+$", ""))
            .filter(term -> !term.isEmpty())
            .map(PartFinderController::toPattern)
            .collect(Collectors.toList());
    }

    /** A PostgreSQL word-start pattern for the term; spaces are written as {@code \s} so patterns join on a space. */
    private static String toPattern(String term) {
        if (Character.isDigit(term.charAt(0)) && term.matches("\\d+(?:\\s*[xX]\\s*\\d+)+")) {
            return "\\m" + String.join("\\s*x\\s*", term.split("\\s*[xX]\\s*")) + "\\M";
        }
        return "\\m" + REGEX_SPECIAL.matcher(term).replaceAll("\\\\$0");
    }
}
