package com.vastbricks.api.setup.provideraccount;

import jakarta.validation.Valid;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The tenant-facing provider accounts screen, whatever the provider. A provider adds its own {@link ProviderAccountConfig}
 * implementation, not its own controller. */
@RestController
@RequestMapping(value = "/api/private/provider-accounts", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class ProviderAccountController {

    private final ProviderAccountService providerAccountService;

    @GetMapping
    List<ProviderAccountItem> listProviderAccounts() {
        return providerAccountService.listProviderAccounts();
    }

    @GetMapping("/{id}")
    ProviderAccountItem getProviderAccount(@PathVariable("id") Long id) {
        return providerAccountService.getProviderAccount(id);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    ProviderAccountItem createProviderAccount(@Valid @RequestBody ProviderAccountItem request) {
        return providerAccountService.createProviderAccount(request);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    ProviderAccountItem updateProviderAccount(@PathVariable("id") Long id, @Valid @RequestBody ProviderAccountItem request) {
        return providerAccountService.updateProviderAccount(id, request);
    }

    /** Rearranges the whole list. A literal path, so it is matched ahead of {@code /{id}}. */
    @PutMapping(value = "/order", consumes = MediaType.APPLICATION_JSON_VALUE)
    void reorderProviderAccounts(@Valid @RequestBody ProviderAccountOrder request) {
        providerAccountService.reorderProviderAccounts(request.getIds());
    }

    @DeleteMapping("/{id}")
    void deleteProviderAccount(@PathVariable("id") Long id) {
        providerAccountService.deleteProviderAccount(id);
    }

    @ExceptionHandler(ProviderAccountException.class)
    ProblemDetail handleProviderAccountError(ProviderAccountException exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
        problem.setTitle("Invalid provider account");
        return problem;
    }
}
