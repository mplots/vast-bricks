package com.vastbricks.api.client.manspasts;

import com.vastbricks.api.client.HttpExchangeCapture;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.HttpCookie;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.function.Supplier;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.dhatim.fastexcel.reader.ReadableWorkbook;
import org.dhatim.fastexcel.reader.Row;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Mans Pasts transport, for the half of the provider that is reached as a signed-in person rather than through the
 * shipping API: the shipment register a store sees under its own account.
 *
 * <p>Latvijas Pasts publishes no API for that register, so it is read the way the account itself offers it — the
 * profile's own xlsx export, asked for a page at a time. The login is a form post that answers with a session cookie,
 * and the export is a post carrying that cookie back, which is why this client signs in at all: nothing else here
 * needs a session.
 *
 * <p>Redirects are deliberately not followed. Both requests answer with one — the login redirects to the profile it
 * signed into, or back to the login form when it did not — and a followed redirect would leave the session cookie
 * behind on a response nobody sees again, along with the only account of whether the credentials were accepted.
 *
 * <p>A session is bought per operation rather than kept. Credentials are settings, and settings are the serving
 * tenant's, so a cached session would have to be keyed by the account it was opened for; one form post per screen
 * opened is cheaper than being sure of that.
 */
@Component
public class MansPastsClient {

    private static final String PROVIDER = "Mans Pasts";
    private static final String LOGIN_PATH = "/lv/login";
    private static final String SHIPMENT_EXPORT_PATH = "/lv/profile/orders/export";
    private static final String SESSION_COOKIE = "PHPSESSID";

    /** How the export writes an instant: {@code 08.09.2026 19:11:13}, in the account's own zone. */
    private static final DateTimeFormatter EXPORT_TIMESTAMP = DateTimeFormatter.ofPattern("dd.MM.uuuu HH:mm:ss");

    /**
     * Which column of the export is which field, keyed by the heading the export writes over it.
     *
     * <p>Read by heading rather than by position, because a column Mans Pasts inserts would otherwise shift every
     * field after it onto the wrong one silently. A heading this does not know is a column that has been added, and
     * is passed over rather than treated as a change to answer for.
     */
    private static final Map<String, BiConsumer<MansPastsShipment, String>> COLUMNS = columns();

    private final MansPastsSettings settings;
    private final HttpExchangeCapture capture;
    private final RestClient restClient;

    MansPastsClient(MansPastsSettings settings, HttpExchangeCapture capture) {
        this.settings = settings;
        this.capture = capture;
        this.restClient = RestClient.builder()
                .requestFactory(new JdkClientHttpRequestFactory(
                        HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build()
                ))
                .requestInterceptor(HttpExchangeCapture.interceptor())
                .build();
    }

    /**
     * One page of the shipment register, as the export's rows. One recorded operation covers the sign-in and the
     * export it was needed for.
     */
    public List<MansPastsShipment> listShipments(int page) {
        return recorded(() -> parseExport(downloadExport(page)));
    }

    /** The export itself, as the xlsx Mans Pasts answered with. */
    public byte[] exportShipments(int page) {
        return recorded(() -> downloadExport(page));
    }

    private <T> T recorded(Supplier<T> call) {
        // The password is what this client knows it sent; the session it buys is masked as it is issued.
        return capture.record(PROVIDER, List.of(configuredPassword()), call);
    }

    private byte[] downloadExport(int page) {
        if (page < 1) {
            throw new IllegalArgumentException("page must be 1 or more");
        }

        var session = login();
        var response = exchange(
                () -> restClient.post()
                        .uri(resolve(SHIPMENT_EXPORT_PATH + "?page=" + page))
                        .header(HttpHeaders.COOKIE, session)
                        .accept(MediaType.ALL)
                        .exchange((request, rawResponse) -> new MansPastsResponse(
                                rawResponse.getStatusCode().value(),
                                rawResponse.getHeaders(),
                                rawResponse.getBody().readAllBytes()
                        )),
                "Mans Pasts shipment export request failed"
        );

        if (response.statusCode == 302 || response.statusCode == 401 || response.statusCode == 403) {
            throw new MansPastsClientException(
                    "Mans Pasts did not accept the session for the shipment export"
                            + redirectSuffix(response)
            );
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new MansPastsClientException(
                    "Mans Pasts shipment export failed with HTTP " + response.statusCode + redirectSuffix(response)
            );
        }
        return response.body == null ? new byte[0] : response.body;
    }

    /**
     * Signs the configured account in and returns the session cookie to send back, as a {@code Cookie} header value.
     *
     * <p>Mans Pasts answers a login either way with a redirect, so which one it is is what says whether the
     * credentials were accepted: the profile it signed into, or the login form it came from.
     */
    private String login() {
        var username = configuredUsername();
        var password = configuredPassword();

        var form = new LinkedMultiValueMap<String, String>();
        form.add("_username", username);
        form.add("_password", password);

        var response = exchange(
                () -> restClient.post()
                        .uri(resolve(LOGIN_PATH))
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .accept(MediaType.ALL)
                        .body(form)
                        .exchange((request, rawResponse) -> new MansPastsResponse(
                                rawResponse.getStatusCode().value(),
                                rawResponse.getHeaders(),
                                rawResponse.getBody().readAllBytes()
                        )),
                "Mans Pasts login request failed"
        );

        if (rejectedLogin(response)) {
            throw new MansPastsClientException("Mans Pasts rejected the configured username and password");
        }

        var session = sessionCookie(response);
        // The session stands in for the password for as long as it lives, so a recorded exchange never carries one.
        HttpExchangeCapture.mask(session);
        return SESSION_COOKIE + "=" + session;
    }

    /** A login sent back to the form it came from is a login that was refused; anywhere else, it was accepted. */
    private boolean rejectedLogin(MansPastsResponse response) {
        var location = response.headers.getFirst(HttpHeaders.LOCATION);
        return location != null && location.contains(LOGIN_PATH);
    }

    private String sessionCookie(MansPastsResponse response) {
        var setCookies = response.headers.get(HttpHeaders.SET_COOKIE);
        if (setCookies != null) {
            for (var setCookie : setCookies) {
                for (var cookie : HttpCookie.parse(setCookie)) {
                    if (SESSION_COOKIE.equals(cookie.getName()) && !cookie.getValue().isBlank()) {
                        return cookie.getValue();
                    }
                }
            }
        }
        throw new MansPastsClientException("Mans Pasts login returned no " + SESSION_COOKIE + " session cookie");
    }

    /**
     * The export's rows, one shipment each.
     *
     * <p>The first row is the headings, which is what says where each field is. A sheet stating none of the headings
     * this knows is not an export at all — a login page answered with HTTP 200, most likely — and is reported rather
     * than returned as a page of nothing.
     */
    private List<MansPastsShipment> parseExport(byte[] xlsx) {
        if (xlsx.length == 0) {
            return List.of();
        }

        try (var workbook = new ReadableWorkbook(new ByteArrayInputStream(xlsx))) {
            var rows = workbook.getFirstSheet().read();
            if (rows.isEmpty()) {
                return List.of();
            }

            var fields = fieldsOf(rows.get(0));
            if (fields.isEmpty()) {
                throw new MansPastsClientException("The Mans Pasts export states none of the columns it is read by");
            }

            var shipments = new ArrayList<MansPastsShipment>();
            for (var row : rows.subList(1, rows.size())) {
                var shipment = shipment(row, fields);
                if (shipment != null) {
                    shipments.add(shipment);
                }
            }
            return List.copyOf(shipments);
        } catch (IOException exception) {
            throw new MansPastsClientException("Could not read the Mans Pasts shipment export", exception);
        }
    }

    /** Which field each column of this export carries, by the heading over it. */
    private static Map<Integer, BiConsumer<MansPastsShipment, String>> fieldsOf(Row headings) {
        var fields = new LinkedHashMap<Integer, BiConsumer<MansPastsShipment, String>>();
        for (var column = 0; column < headings.getCellCount(); column++) {
            var field = COLUMNS.get(heading(cellText(headings, column)));
            if (field != null) {
                fields.put(column, field);
            }
        }
        return fields;
    }

    private static MansPastsShipment shipment(Row row, Map<Integer, BiConsumer<MansPastsShipment, String>> fields) {
        var shipment = new MansPastsShipment();
        var stated = false;
        for (var field : fields.entrySet()) {
            var value = text(cellText(row, field.getKey()));
            if (value == null) {
                continue;
            }
            field.getValue().accept(shipment, value);
            stated = true;
        }
        // A sheet commonly ends in rows that exist without holding anything; a row stating nothing is not a shipment.
        return stated ? shipment : null;
    }

    private static Map<String, BiConsumer<MansPastsShipment, String>> columns() {
        Map<String, BiConsumer<MansPastsShipment, String>> columns = new LinkedHashMap<>();
        columns.put(heading("Svītrkods"), MansPastsShipment::setBarcode);
        columns.put(heading("Sūtījuma tips"), MansPastsShipment::setShipmentType);
        columns.put(heading("Sūtījuma veids"), MansPastsShipment::setServiceType);
        columns.put(heading("Statuss"), MansPastsShipment::setStatus);
        columns.put(heading("Saraksta nr."), MansPastsShipment::setListNumber);
        columns.put(heading("Vārds, uzvārds"), MansPastsShipment::setRecipientName);
        columns.put(heading("Uzņēmums"), MansPastsShipment::setCompany);
        columns.put(heading("Valsts"), MansPastsShipment::setCountry);
        columns.put(heading("Adrese"), MansPastsShipment::setAddress);
        columns.put(heading("Pasta indekss"), MansPastsShipment::setPostalCode);
        columns.put(heading("Piezīmes"), MansPastsShipment::setNotes);
        columns.put(heading("Grupas"), MansPastsShipment::setGroups);
        columns.put(heading("E-pasts"), MansPastsShipment::setEmail);
        columns.put(heading("Tālruņa numurs"), MansPastsShipment::setPhone);
        columns.put(heading("Saturs"), MansPastsShipment::setContentName);
        columns.put(heading("Skaits"), (shipment, value) -> shipment.setQuantity(integer(value, "Skaits")));
        columns.put(heading("Svars (kg)"), (shipment, value) -> shipment.setWeightKg(decimal(value, "Svars (kg)")));
        columns.put(heading("Vērtība (€)"), (shipment, value) -> shipment.setValue(decimal(value, "Vērtība (€)")));
        columns.put(heading("HS kods"), MansPastsShipment::setHsCode);
        columns.put(heading("Izcelsmes valsts"), MansPastsShipment::setOriginCountry);
        columns.put(heading("Papildpakalpojumi"), MansPastsShipment::setAdditionalServices);
        columns.put(
                heading("Papildpakalpojumu cena"),
                (shipment, value) -> shipment.setAdditionalServicesPrice(decimal(value, "Papildpakalpojumu cena"))
        );
        columns.put(
                heading("Apdrošināšana (€)"),
                (shipment, value) -> shipment.setInsuredAmount(decimal(value, "Apdrošināšana (€)"))
        );
        columns.put(
                heading("Apdrošināšanas maksa"),
                (shipment, value) -> shipment.setInsuranceFee(decimal(value, "Apdrošināšanas maksa"))
        );
        columns.put(heading("Nodots LP"), (shipment, value) -> shipment.setSubmittedAt(timestamp(value, "Nodots LP")));
        columns.put(
                heading("Apstrādāts LP"),
                (shipment, value) -> shipment.setProcessedAt(timestamp(value, "Apstrādāts LP"))
        );
        columns.put(
                heading("Svērtais svars (kg)"),
                (shipment, value) -> shipment.setWeighedWeightKg(decimal(value, "Svērtais svars (kg)"))
        );
        columns.put(
                heading("Nosūtīšanas maksa"),
                (shipment, value) -> shipment.setPostageFee(decimal(value, "Nosūtīšanas maksa"))
        );
        columns.put(
                heading("Kopā summa"),
                (shipment, value) -> shipment.setTotalAmount(decimal(value, "Kopā summa"))
        );
        columns.put(heading("Sūtītājs"), MansPastsShipment::setSender);
        columns.put(heading("Izveidots"), (shipment, value) -> shipment.setCreatedAt(timestamp(value, "Izveidots")));
        columns.put(heading("Izsūtīts e-pasts"), MansPastsShipment::setEmailNotice);
        return Map.copyOf(columns);
    }

    /**
     * One cell as the text it holds, or nothing where the row does not reach that far. A sheet omits the trailing
     * cells a row left empty, so a row is commonly shorter than the headings over it.
     */
    private static String cellText(Row row, int column) {
        return row.hasCell(column) ? row.getCellText(column) : null;
    }

    /** A heading as it is matched: the export's own wording, spaced and cased however it happened to write it. */
    private static String heading(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private static String text(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static BigDecimal decimal(String value, String column) {
        try {
            // A comma reads as the decimal mark it is in Latvian, the export writing amounts either way.
            return new BigDecimal(value.replace(",", ".").replace(" ", ""));
        } catch (NumberFormatException exception) {
            throw new MansPastsClientException(
                    "The Mans Pasts export states '" + value + "' as the " + column + " amount", exception
            );
        }
    }

    private static Integer integer(String value, String column) {
        try {
            return Integer.valueOf(value);
        } catch (NumberFormatException exception) {
            throw new MansPastsClientException(
                    "The Mans Pasts export states '" + value + "' as the " + column + " count", exception
            );
        }
    }

    private static LocalDateTime timestamp(String value, String column) {
        try {
            return LocalDateTime.parse(value, EXPORT_TIMESTAMP);
        } catch (DateTimeParseException exception) {
            throw new MansPastsClientException(
                    "The Mans Pasts export states '" + value + "' as the " + column + " time", exception
            );
        }
    }

    private MansPastsResponse exchange(MansPastsExchange request, String failureMessage) {
        try {
            return request.execute();
        } catch (RestClientException | IOException exception) {
            throw new MansPastsClientException(failureMessage, exception);
        }
    }

    private URI resolve(String path) {
        return URI.create(required("Mans Pasts base URL", settings.getBaseUrl())).resolve(path);
    }

    private String configuredUsername() {
        return required("Mans Pasts username", settings.getUsername());
    }

    private String configuredPassword() {
        return required("Mans Pasts password", settings.getPassword());
    }

    private String required(String name, String value) {
        if (value == null || value.isBlank()) {
            throw new MansPastsClientException(name + " is not configured");
        }
        return value.trim();
    }

    private static String redirectSuffix(MansPastsResponse response) {
        var location = response.headers.getFirst(HttpHeaders.LOCATION);
        return location == null ? "" : ", redirecting to " + location;
    }

    @FunctionalInterface
    private interface MansPastsExchange {
        MansPastsResponse execute() throws IOException;
    }

    @Getter
    @AllArgsConstructor
    private static final class MansPastsResponse {
        private final int statusCode;
        private final HttpHeaders headers;
        private final byte[] body;
    }
}
