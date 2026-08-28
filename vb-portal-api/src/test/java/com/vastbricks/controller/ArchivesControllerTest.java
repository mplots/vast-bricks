package com.vastbricks.controller;

import org.junit.jupiter.api.Test;

import java.time.YearMonth;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ArchivesControllerTest {
    private final ArchivesController controller = new ArchivesController(null, null);

    @Test
    void defaultsToPreviousMonth() {
        assertEquals(YearMonth.now().minusMonths(1), controller.parseMonth(null));
        assertEquals(YearMonth.now().minusMonths(1), controller.parseMonth(" "));
    }

    @Test
    void parsesSelectedMonth() {
        assertEquals(YearMonth.of(2026, 8), controller.parseMonth("2026-08"));
    }
}
