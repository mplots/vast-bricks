package com.vastbricks.api.client.brickstore;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping(value = "/api/private/brickstore", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class BrickStoreController {

    private final BrickStoreClient brickStoreClient;
    private final BrickStoreTokenService tokenService;

    @PostMapping("/token")
    public TokenStoreResponse storeToken(@RequestBody TokenStoreRequest request) {
        if (request == null || request.getToken() == null || request.getToken().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Token is required");
        }
        tokenService.storeToken(request.getToken());
        return new TokenStoreResponse("ok");
    }

    @PostMapping(value = "/order-export", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<byte[]> exportOrders() {
        return ResponseEntity.ok(brickStoreClient.exportOrders(BrickStoreOrderExportRequest.all(BrickStoreOrderType.RECEIVED)));
    }

    @ExceptionHandler(BrickStoreClientException.class)
    @ResponseStatus(HttpStatus.BAD_GATEWAY)
    public String handleBrickStoreClientException(BrickStoreClientException ex) {
        return ex.getMessage();
    }

    @Data
    @NoArgsConstructor
    public static class TokenStoreRequest {
        private String token;
    }

    @Data
    @AllArgsConstructor
    public static class TokenStoreResponse {
        private String status;
    }
}
