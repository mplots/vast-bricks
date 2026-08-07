package com.vastbricks.market.owl;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class BatchAPITest {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void executesFormEncodedBatch() throws Exception {
        var batchResponse = new BatchResponse();
        batchResponse.setRequestNumber(1);
        batchResponse.setCode(200);
        var restClient = new BatchRestClient(List.of(batchResponse));
        var api = new BatchAPI("https://api.example.com", "api-key", restClient);

        var result = api.execute(List.of(
                BatchRequest.get("order/view", Map.of("order_id", "3060526")),
                BatchRequest.get("order/view", Map.of("order_id", "4696896"))
        ));

        assertEquals(List.of(batchResponse), result);
        assertEquals("https://api.example.com/v1/bulk/batch", restClient.url);
        assertEquals("api-key", restClient.formData.getFirst("key"));
        assertEquals(
                MAPPER.readTree("""
                        {"requests":[
                          {"endpoint":"order/view","request_method":"GET","params":[{"order_id":"3060526"}]},
                          {"endpoint":"order/view","request_method":"GET","params":[{"order_id":"4696896"}]}
                        ]}
                        """),
                MAPPER.readTree(restClient.formData.getFirst("requests"))
        );
        assertEquals(
                "java.util.List<com.vastbricks.market.owl.BatchResponse>",
                restClient.responseType.getType().getTypeName()
        );
    }

    @Test
    void rejectsMoreThanFiftyRequests() {
        var api = new BatchAPI("https://api.example.com", "api-key", new BatchRestClient(List.of()));
        var requests = Collections.nCopies(51, BatchRequest.get("order/list", Map.of()));

        var error = assertThrows(IllegalArgumentException.class, () -> api.execute(requests));

        assertEquals("Batch cannot contain more than 50 requests", error.getMessage());
    }

    private static class BatchRestClient extends RestClient {
        private final List<BatchResponse> response;
        private String url;
        private ParameterizedTypeReference<?> responseType;
        private MultiValueMap<String, String> formData;

        private BatchRestClient(List<BatchResponse> response) {
            this.response = response;
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> ResponseEntity<T> postForm(
                String url,
                ParameterizedTypeReference<T> responseType,
                MultiValueMap<String, String> formData
        ) {
            this.url = url;
            this.responseType = responseType;
            this.formData = formData;
            return ResponseEntity.ok((T) response);
        }
    }
}
