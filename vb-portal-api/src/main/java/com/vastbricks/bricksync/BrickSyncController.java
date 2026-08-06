package com.vastbricks.bricksync;

import com.vastbricks.config.Env;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/bricksync")
@CrossOrigin(origins = "*")
public class BrickSyncController {
    private static final String API_KEY_HEADER = "X-Api-Key";

    private final Env env;
    private final BrickSyncProperties properties;
    private final BrickSyncService service;

    public BrickSyncController(Env env, BrickSyncProperties properties, BrickSyncService service) {
        this.env = env;
        this.properties = properties;
        this.service = service;
    }

    @PostMapping("/commands")
    public ResponseEntity<BrickSyncCommandResponse> sendCommand(
            @RequestHeader(value = API_KEY_HEADER, required = false) String apiKey,
            @RequestBody BrickSyncCommandRequest request) {
        requireApiKey(apiKey);
        service.sendCommand(request.getCommand());
        return ResponseEntity.accepted().body(new BrickSyncCommandResponse(true, request.getCommand().trim()));
    }

    @GetMapping("/logs")
    public BrickSyncLogsResponse getLogs(
            @RequestHeader(value = API_KEY_HEADER, required = false) String apiKey,
            @RequestParam(value = "tail", required = false) Integer tail) {
        requireApiKey(apiKey);
        return service.getLogs(tail);
    }

    @ExceptionHandler(BrickSyncException.class)
    public ResponseEntity<Map<String, String>> handleBrickSyncException(BrickSyncException ex) {
        return ResponseEntity.status(ex.getStatus()).body(Map.of("error", ex.getMessage()));
    }

    private void requireApiKey(String providedKey) {
        String expectedKey = env.getApiKey();
        if (expectedKey == null || expectedKey.isBlank()) {
            return;
        }
        if (!expectedKey.equals(providedKey)) {
            throw new BrickSyncException(HttpStatus.UNAUTHORIZED, "Invalid API key");
        }
    }
}
