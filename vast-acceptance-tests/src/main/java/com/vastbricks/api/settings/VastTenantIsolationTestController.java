package com.vastbricks.api.settings;

import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Reaches a tenant-owned entity by primary key, which no public endpoint does.
 *
 * <p>Exists to prove that Hibernate's {@code @TenantId} filters loading by id and not only derived queries. That is
 * the load-bearing assumption behind every writable tenant-owned table: a reader holding a row's id must still be
 * unable to reach it across tenants.
 */
@RestController
@RequestMapping(path = "/api/test/tenant-isolation", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class VastTenantIsolationTestController {

    private final SettingsOverrideRepository repository;

    @PostMapping
    Map<String, Object> create(@RequestParam("key") String key, @RequestParam("value") String value) {
        SettingsOverride created = repository.save(new SettingsOverride(key, value));
        return Map.of("id", created.getId(), "tenantId", created.getTenantId());
    }

    @GetMapping("/{id}")
    Map<String, Object> findById(@PathVariable("id") Long id) {
        Optional<SettingsOverride> found = repository.findById(id);
        return Map.of(
                "found", found.isPresent(),
                "value", found.map(SettingsOverride::getSettingValue).orElse(""),
                "tenantId", found.map(SettingsOverride::getTenantId).map(String::valueOf).orElse("")
        );
    }

    @GetMapping("/count")
    Map<String, Object> count() {
        return Map.of("count", repository.count());
    }

    @PutMapping("/{id}")
    Map<String, Object> update(@PathVariable("id") Long id, @RequestParam("value") String value) {
        Optional<SettingsOverride> found = repository.findById(id);
        found.ifPresent(override -> {
            override.setSettingValue(value);
            repository.save(override);
        });
        return Map.of("updated", found.isPresent());
    }
}
