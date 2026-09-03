package com.vastbricks.api.health;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Proves that a test-only controller from vast-acceptance-tests is component-scanned by the
 * inherited vast-api launcher. It sits in the same package as {@link VastHealthController} because
 * test controllers live beside the code they exercise, which keeps that code package-private.
 */
@RestController
@RequestMapping(path = "/api/test", produces = MediaType.APPLICATION_JSON_VALUE)
class VastHealthTestController {

    @GetMapping("/hello")
    Map<String, String> hello() {
        return Map.of("message", "Hello World");
    }
}
