package com.vastbricks.api.setup.provideraccount;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One provider account: a list row, a single read, or a create/update request/response - the same shape serves all four,
 * config and all, because a provider account is a handful of fields either way. {@code id} and {@code provider} are
 * server-assigned and ignored on a request. A provider's own fields live inside {@code config}, not here - see
 * {@link ProviderAccountConfig} and its implementations.
 */
@Getter
@Setter
@NoArgsConstructor
class ProviderAccountItem {

    private Long id;

    @NotBlank
    private String name;

    private Provider provider;

    private boolean enabled;

    @NotNull
    @Valid
    private ProviderAccountConfig config;
}
