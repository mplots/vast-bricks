package com.vastbricks.api.setup.provideraccount;

import com.vastbricks.api.setup.SetupEncryption;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creating, reading, updating, listing and deleting a provider account - whatever its provider. This service never
 * inspects a provider's own fields: {@link ProviderAccountConfig} does its own encrypting and its own masking, so a new
 * provider only ever means a new {@link ProviderAccountConfig} implementation, never a change here.
 */
@Service
@RequiredArgsConstructor
class ProviderAccountService {

    private final ProviderAccountRepository providerAccountRepository;
    private final SetupEncryption settingsEncryption;

    List<ProviderAccountItem> listProviderAccounts() {
        return providerAccountRepository.findAllByOrderBySortOrderAscNameAsc().stream().map(this::toItem).toList();
    }

    ProviderAccountItem getProviderAccount(Long id) {
        return toItem(find(id));
    }

    @Transactional
    ProviderAccountItem createProviderAccount(ProviderAccountItem request) {
        if (providerAccountRepository.findByNameIgnoreCase(request.getName()).isPresent()) {
            throw new ProviderAccountException("A provider account named '" + request.getName() + "' already exists.");
        }

        ProviderAccountConfig stored = request.getConfig().prepareForStorage(settingsEncryption, null);
        ProviderAccount providerAccount = new ProviderAccount(request.getName(), stored.provider(), stored);
        providerAccount.setEnabled(request.isEnabled());
        providerAccount.setOperatingPeriods(OperatingPeriod.normalized(request.getOperatingPeriods()));
        providerAccount.setSortOrder(nextSortOrder());
        return toItem(providerAccountRepository.save(providerAccount));
    }

    @Transactional
    ProviderAccountItem updateProviderAccount(Long id, ProviderAccountItem request) {
        ProviderAccount providerAccount = find(id);
        if (request.getConfig().provider() != providerAccount.getProvider()) {
            throw new ProviderAccountException(
                    "Provider account " + id + " is a " + providerAccount.getProvider() + " account.");
        }

        providerAccount.setName(request.getName());
        providerAccount.setEnabled(request.isEnabled());
        providerAccount.setOperatingPeriods(OperatingPeriod.normalized(request.getOperatingPeriods()));
        providerAccount.setConfig(request.getConfig().prepareForStorage(settingsEncryption, providerAccount.getConfig()));
        return toItem(providerAccountRepository.save(providerAccount));
    }

    @Transactional
    void deleteProviderAccount(Long id) {
        providerAccountRepository.deleteById(id);
    }

    /**
     * Rearranges the tenant's accounts into the order its ids are given in.
     *
     * <p>The whole arrangement is restated rather than one account moved, because that is what a rearranged screen
     * knows. Anything else is refused: {@code findAllById} returns only this tenant's rows, so an id belonging to
     * another tenant simply does not come back and the count no longer matches, which is the same answer a
     * duplicate or a missing account gets.
     */
    @Transactional
    void reorderProviderAccounts(List<Long> ids) {
        List<ProviderAccount> accounts = providerAccountRepository.findAllById(ids);
        if (accounts.size() != ids.size() || accounts.size() != providerAccountRepository.count()) {
            throw new ProviderAccountException("The new order must list every provider account exactly once.");
        }

        Map<Long, ProviderAccount> byId =
                accounts.stream().collect(Collectors.toMap(ProviderAccount::getId, Function.identity()));
        for (int position = 0; position < ids.size(); position++) {
            byId.get(ids.get(position)).setSortOrder(position);
        }
        providerAccountRepository.saveAll(accounts);
    }

    /** Where a new account goes: after the last one, so creating never disturbs an arrangement already made. */
    private int nextSortOrder() {
        return providerAccountRepository.findFirstByOrderBySortOrderDesc()
                .map(last -> last.getSortOrder() + 1)
                .orElse(0);
    }

    private ProviderAccount find(Long id) {
        return providerAccountRepository.findById(id)
                .orElseThrow(() -> new ProviderAccountException("No provider account with id " + id + "."));
    }

    private ProviderAccountItem toItem(ProviderAccount providerAccount) {
        ProviderAccountItem item = new ProviderAccountItem();
        item.setId(providerAccount.getId());
        item.setName(providerAccount.getName());
        item.setProvider(providerAccount.getProvider());
        item.setEnabled(providerAccount.isEnabled());
        item.setOperatingPeriods(List.copyOf(providerAccount.getOperatingPeriods()));
        item.setConfig(providerAccount.getConfig().forView(settingsEncryption));
        return item;
    }
}
