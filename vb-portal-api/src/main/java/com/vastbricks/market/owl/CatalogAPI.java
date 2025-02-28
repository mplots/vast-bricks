package com.vastbricks.market.owl;

import lombok.AllArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;

import java.util.List;
import java.util.Map;

@AllArgsConstructor
public class CatalogAPI {

    private String baseUrl;
    private String key;

    private record Boids (List<String> boids) {}
    public List<String> idLookup(ItemType type, String id) {
        var restTemplate = new RestClient();
        var endpointUrl = baseUrl + "/v1/catalog/id_lookup?key={key}&type={type}&id={id}";

        return restTemplate.get(endpointUrl, Boids.class, Map.of(
            "key", key,
            "type", type.getName(),
            "id", id
        )).getBody().boids();
    }

    public Item lookup(String boid) {
        var restTemplate = new RestClient();
        var endpointUrl = baseUrl + "/v1/catalog/lookup?key={key}&boid={boid}";
        return restTemplate.get(endpointUrl, Item.class, Map.of(
            "key", key,
            "boid", boid
        )).getBody();
    }

    private record BulkItems (Map<String, Item> items) {}
    public List<Item> bulkLookup(List<String> boids) {
        var restTemplate = new RestClient();
        var endpointUrl = baseUrl + "/v1/catalog/bulk_lookup?key={key}&boids={boids}";

        return restTemplate.get(endpointUrl, BulkItems.class, Map.of(
                "key", key,
                "boids", String.join(",", boids)
        )).getBody().items().entrySet().stream().map(Map.Entry::getValue).toList();
    }

    public List<ListItem> list(ItemType type) {
        var restTemplate = new RestClient();
        var endpointUrl = baseUrl + "/v1/catalog/list?key={key}&type={type}";

        return restTemplate.get(endpointUrl, new ParameterizedTypeReference<List<ListItem>>() {
        }, Map.of(
            "key", key,
            "type", type.getName()
        )).getBody();
    }
}
