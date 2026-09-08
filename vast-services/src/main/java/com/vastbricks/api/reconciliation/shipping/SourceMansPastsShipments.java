package com.vastbricks.api.reconciliation.shipping;

import com.vastbricks.api.client.manspasts.MansPastsClient;
import com.vastbricks.api.client.manspasts.MansPastsShipment;
import com.vastbricks.api.reconciliation.Source;
import java.time.YearMonth;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Reads the shipments a month's orders may have been sent as, out of the Mans Pasts register.
 *
 * <p>The register is not asked for by month, and it is not paged through either: Latvijas Pasts publishes no API for
 * it, so it is read as the account itself offers it — the profile's xlsx export — and the export's first page holds
 * every shipment the account has. So the month decides nothing here and one request is the whole register.
 *
 * <p>The page number is the provider's own protocol and stays on the client, which asks for the page it is given. A
 * register that ever outgrew its first page would be a walk added here rather than a change to that client.
 *
 * <p>Everything the export stated is passed on, shipments of other months included. A source decides nothing: a
 * shipment naming no collected order is dropped by the mapper, which is where what a shipment means is decided.
 *
 * <p>It declares {@link MansPastsShipment} rather than a carrier of its own, as the payment sources declare their
 * providers' own models: it assembles nothing, and a carrier would only be needed if a second source returned the
 * same class.
 */
@Component
@RequiredArgsConstructor
class SourceMansPastsShipments implements Source<MansPastsShipment> {

    /** The register's first page, which is all of it. */
    private static final int REGISTER_PAGE = 1;

    private final MansPastsClient mansPastsClient;

    @Override
    public Class<MansPastsShipment> type() {
        return MansPastsShipment.class;
    }

    @Override
    public List<MansPastsShipment> fetch(YearMonth month) {
        return mansPastsClient.listShipments(REGISTER_PAGE);
    }
}
