package com.vastbricks.api.job;

import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** What started a run. The two differ in reach: a schedule fires for every tenant, a person for their own. */
@Getter
@RequiredArgsConstructor
enum JobTrigger {

    SCHEDULE("schedule"),

    MANUAL("manual");

    @JsonValue
    private final String code;
}
