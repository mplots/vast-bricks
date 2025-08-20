package com.vastbricks.market.link;

import com.vastbricks.config.LoggingInterceptor;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import oauth.signpost.commonshttp.CommonsHttpOAuthConsumer;
import oauth.signpost.exception.OAuthCommunicationException;
import oauth.signpost.exception.OAuthExpectationFailedException;
import oauth.signpost.exception.OAuthMessageSignerException;
import org.apache.http.client.methods.HttpGet;
import org.springframework.http.HttpRequest;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;

@Slf4j
@AllArgsConstructor
public class PrivateAPI {

    private static final String BASE_URL = "https://api.bricklink.com/api/store/v1";

    private String consumerKey;
    private String consumerSecret;
    private String token;
    private String tokenSecret;

    public Order getOrder(Long orderId) {
        var template = new RestTemplate();
        // Allow multiple reads of the response body
        template.setRequestFactory(new BufferingClientHttpRequestFactory(new SimpleClientHttpRequestFactory()));

        // Add logging interceptor
        template.setInterceptors(Collections.singletonList(new LoggingInterceptor()));

        template.getInterceptors().add(new OAuth1RequestInterceptor(consumerKey, consumerSecret, token, tokenSecret));

        return template.getForEntity("%s/orders/%s".formatted(BASE_URL, orderId), Order.class).getBody();
    }

    private static final class OAuth1RequestInterceptor implements ClientHttpRequestInterceptor {
        private final CommonsHttpOAuthConsumer consumer;

        private OAuth1RequestInterceptor(String consumerKey, String consumerSecret, String token, String tokenSecret) {
            this.consumer = new CommonsHttpOAuthConsumer(consumerKey, consumerSecret);
            this.consumer.setTokenWithSecret(token, tokenSecret);
        }

        @Override
        public ClientHttpResponse intercept(HttpRequest request, byte[] body, ClientHttpRequestExecution execution) throws IOException {
            try {
                // Convert to HttpRequestBase for signing
                var apacheRequest = new HttpGet(request.getURI());
                consumer.sign(apacheRequest);

                // Copy OAuth1 headers from Apache request into Spring HttpHeaders
                for (var header : apacheRequest.getAllHeaders()) {
                    request.getHeaders().add(header.getName(), header.getValue());
                }
            } catch (OAuthCommunicationException | OAuthMessageSignerException | OAuthExpectationFailedException e) {
                throw new IOException("Failed to sign request", e);
            }
            return execution.execute(request, body);
        }
    }
}
