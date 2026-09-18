package com.vastbricks.api.client.ecb;

import com.fasterxml.jackson.dataformat.xml.XmlFactory;
import com.fasterxml.jackson.dataformat.xml.XmlMapper;
import com.vastbricks.api.client.HttpExchangeCapture;
import java.util.List;
import javax.xml.stream.XMLInputFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * The European Central Bank's daily reference rates, as published at {@code www.ecb.europa.eu}.
 *
 * <p>Anonymous, like {@code LatvijasPastsClient}: there is no key and nothing to mask in a recorded exchange. One
 * call and no more. The response is XML rather than JSON, so it is read with a hardened {@link XmlMapper} of its
 * own - the way {@code BankStatementReader} reads camt - rather than left to whatever converter the classpath
 * happens to register for a plain {@code RestClient}.
 */
@Component
public class EcbClient {

    private static final String PROVIDER = "European Central Bank";
    private static final String DAILY_RATES_PATH = "/stats/eurofxref/eurofxref-daily.xml";

    private final EcbSettings settings;
    private final HttpExchangeCapture capture;
    private final RestClient restClient;
    private final XmlMapper xmlMapper = createXmlMapper();

    EcbClient(EcbSettings settings, HttpExchangeCapture capture) {
        this.settings = settings;
        this.capture = capture;
        this.restClient = RestClient.builder()
                .requestFactory(new SimpleClientHttpRequestFactory())
                .requestInterceptor(HttpExchangeCapture.interceptor())
                .build();
    }

    /** The most recent day the ECB has published rates for, and what it states for every currency it quotes. */
    public EcbDailyRates fetchDailyRates() {
        return capture.record(PROVIDER, List.of(), () -> {
            String body = get(DAILY_RATES_PATH);
            if (body == null || body.isBlank()) {
                throw new EcbClientException("ECB stated no rates");
            }
            return parse(body);
        });
    }

    private EcbDailyRates parse(String body) {
        try {
            return xmlMapper.readValue(body, EcbEnvelope.class).dailyRates();
        } catch (EcbClientException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new EcbClientException("ECB response is not readable XML: " + exception.getMessage(), exception);
        }
    }

    private String get(String path) {
        try {
            return restClient.get().uri(url(path)).retrieve().body(String.class);
        } catch (RestClientException exception) {
            throw new EcbClientException("ECB request failed", exception);
        }
    }

    private String url(String path) {
        String baseUrl = settings.getBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new EcbClientException("ECB base URL is not configured");
        }
        return baseUrl.replaceAll("/+$", "") + path;
    }

    /** Hardened as {@code BankStatementReader} hardens its own: no DTDs and no external entities. */
    private static XmlMapper createXmlMapper() {
        var inputFactory = XMLInputFactory.newFactory();
        inputFactory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        inputFactory.setProperty("javax.xml.stream.isSupportingExternalEntities", false);
        return new XmlMapper(new XmlFactory(inputFactory));
    }
}
