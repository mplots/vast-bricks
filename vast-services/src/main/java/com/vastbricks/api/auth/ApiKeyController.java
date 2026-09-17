package com.vastbricks.api.auth;

import com.vastbricks.api.auth.ApiKeyPayload.ApiKeyItem;
import com.vastbricks.api.auth.ApiKeyPayload.CreateApiKeyRequest;
import com.vastbricks.api.auth.ApiKeyPayload.GeneratedApiKey;
import com.vastbricks.api.tenancy.TenantContext;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The caller's own keys for the store they are serving: what an external program is given so it can call the API
 * without a login of its own.
 *
 * <p>A key belongs to the user who generated it and to the tenant that was being served at the time, so this screen
 * shows a different list after a tenant switch - which is the same list the program itself would reach.
 */
@RestController
@RequestMapping(value = "/api/private/account/api-keys", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class ApiKeyController {

    private final ApiKeyService apiKeyService;

    @GetMapping
    List<ApiKeyItem> listApiKeys(@RequestAttribute(AuthenticationInterceptor.AUTHENTICATED_USER_ATTRIBUTE) User user) {
        return apiKeyService.listApiKeys(user.getId(), tenantId());
    }

    /** Returns the secret, once. Nothing stores it, so a key not copied here has to be replaced rather than read. */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    GeneratedApiKey createApiKey(
            @RequestAttribute(AuthenticationInterceptor.AUTHENTICATED_USER_ATTRIBUTE) User user,
            @RequestBody CreateApiKeyRequest request) {
        return apiKeyService.createApiKey(user.getId(), tenantId(), request);
    }

    @DeleteMapping("/{id}")
    void deleteApiKey(
            @RequestAttribute(AuthenticationInterceptor.AUTHENTICATED_USER_ATTRIBUTE) User user,
            @PathVariable("id") Long id) {
        apiKeyService.deleteApiKey(user.getId(), tenantId(), id);
    }

    private static Long tenantId() {
        return TenantContext.currentTenantIdOrNone();
    }

    @ExceptionHandler(ApiKeyNotFoundException.class)
    ProblemDetail handleUnknownApiKey(ApiKeyNotFoundException exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
        problem.setTitle("Unknown API key");
        return problem;
    }

    @ExceptionHandler(ApiKeyException.class)
    ProblemDetail handleApiKeyError(ApiKeyException exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
        problem.setTitle("Invalid API key request");
        return problem;
    }
}
