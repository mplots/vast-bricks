package com.vastbricks.api.tenancy;

import com.vastbricks.api.tenancy.UserTenant.UserTenantId;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The tenancy feature's own implementation of {@link TenantAccess}. */
@Service
@RequiredArgsConstructor
class TenantAccessService implements TenantAccess, TenantProvisioning, TenantRoster {

    private final TenantRepository tenantRepository;
    private final UserTenantRepository userTenantRepository;

    @Override
    @Transactional(readOnly = true)
    public List<TenantView> tenantsOf(Long userId) {
        List<Long> tenantIds = userTenantRepository.findByIdUserId(userId).stream()
                .map(membership -> membership.getId().getTenantId())
                .toList();

        return tenantRepository.findAllById(tenantIds).stream()
                .filter(Tenant::isActive)
                .sorted(Comparator.comparing(Tenant::getId))
                .map(TenantAccessService::toView)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<TenantView> selectFor(Long userId, String tenantCode) {
        List<TenantView> tenants = tenantsOf(userId);
        if (tenantCode == null || tenantCode.isBlank()) {
            return tenants.stream().findFirst();
        }

        String normalized = tenantCode.trim().toLowerCase(Locale.ROOT);
        return tenants.stream().filter(tenant -> tenant.getCode().equals(normalized)).findFirst();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean canServe(Long userId, Long tenantId) {
        if (userId == null || tenantId == null) {
            return false;
        }
        return userTenantRepository.existsByIdUserIdAndIdTenantId(userId, tenantId)
                && tenantRepository.findById(tenantId).filter(Tenant::isActive).isPresent();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Long> tenantIdByCode(String code) {
        if (code == null || code.isBlank()) {
            return Optional.empty();
        }
        return tenantRepository.findByCode(code.trim().toLowerCase(Locale.ROOT))
                .filter(Tenant::isActive)
                .map(Tenant::getId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TenantView> active() {
        return tenantRepository.findByActiveTrueOrderByIdAsc().stream()
                .map(TenantAccessService::toView)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<TenantView> byId(Long tenantId) {
        if (tenantId == null) {
            return Optional.empty();
        }
        return tenantRepository.findById(tenantId).map(TenantAccessService::toView);
    }

    @Override
    @Transactional
    public TenantView create(String code, String name) {
        String normalized = code.trim().toLowerCase(Locale.ROOT);
        return tenantRepository.findByCode(normalized)
                .map(TenantAccessService::toView)
                .orElseGet(() -> {
                    Tenant tenant = new Tenant();
                    tenant.setCode(normalized);
                    tenant.setName(name == null || name.isBlank() ? normalized : name.trim());
                    tenant.setActive(true);
                    return toView(tenantRepository.save(tenant));
                });
    }

    @Override
    @Transactional
    public void addMember(Long userId, Long tenantId) {
        UserTenantId id = new UserTenantId(userId, tenantId);
        if (userTenantRepository.existsById(id)) {
            return;
        }
        UserTenant membership = new UserTenant();
        membership.setId(id);
        userTenantRepository.save(membership);
    }

    private static TenantView toView(Tenant tenant) {
        return new TenantView(tenant.getId(), tenant.getCode(), tenant.getName());
    }
}
