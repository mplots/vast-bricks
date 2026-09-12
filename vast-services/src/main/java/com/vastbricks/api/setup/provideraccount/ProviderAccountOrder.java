package com.vastbricks.api.setup.provideraccount;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A tenant's whole arrangement, as the ids of its accounts in the order they should sit. The whole list is stated
 * rather than one account's new place, because a rearranged screen knows the order it ended up in and nothing else.
 */
@Getter
@Setter
@NoArgsConstructor
class ProviderAccountOrder {

    @NotEmpty
    private List<Long> ids;
}
