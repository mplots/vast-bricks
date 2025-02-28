package com.vastbricks.market.owl;

import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

public class RestClient {

    private final RestTemplate restTemplate;

    public RestClient() {
        this.restTemplate = new RestTemplate();
        var objectMapper = new ObjectMapper();
        objectMapper.configure(MapperFeature.ACCEPT_CASE_INSENSITIVE_ENUMS, true);

        // Create a new JSON message converter with the custom ObjectMapper
        var jsonConverter = new MappingJackson2HttpMessageConverter();
        jsonConverter.setObjectMapper(objectMapper);

        // Replace default message converters
        var converters = restTemplate.getMessageConverters();
        converters.removeIf(c -> c instanceof MappingJackson2HttpMessageConverter);
        converters.add(jsonConverter);
    }


    public <T> ResponseEntity<T> get(String url, Class<T> responseType, Map<String, ?> uriVariables) {
        return restTemplate.getForEntity(url, responseType, uriVariables);
    }

    public <T> ResponseEntity<T> get(String url,ParameterizedTypeReference<T> responseType, Map<String, ?> uriVariables) {
         return restTemplate.exchange(url, HttpMethod.GET, null, responseType,uriVariables);
    }



}
