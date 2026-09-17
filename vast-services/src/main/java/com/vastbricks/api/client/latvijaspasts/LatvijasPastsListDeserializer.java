package com.vastbricks.api.client.latvijaspasts;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.BeanProperty;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.deser.ContextualDeserializer;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Reads a list the provider sometimes writes as an object.
 *
 * <p>For twelve of its destinations, the weight costs arrive not as a JSON array but as an object keyed by position:
 * {@code {"30": {...}, "31": {...}}}. That is the shape PHP's own encoder produces for an array whose keys stopped
 * being consecutive - the insured prices were filtered out server-side and the remaining ones kept the indices they
 * had - and the provider evidently does not notice which of the two it is sending.
 *
 * <p>Both shapes hold the same thing in the same order, so both are read as the same list. The keys themselves are
 * not meaningful and are not kept: they number the entries of an array the sweep never sees, and what a price
 * belongs to is worked out from where it sorts, not from where it arrived.
 */
class LatvijasPastsListDeserializer extends JsonDeserializer<List<?>> implements ContextualDeserializer {

    private final JavaType elementType;

    LatvijasPastsListDeserializer() {
        this(null);
    }

    private LatvijasPastsListDeserializer(JavaType elementType) {
        this.elementType = elementType;
    }

    @Override
    public JsonDeserializer<?> createContextual(DeserializationContext context, BeanProperty property) {
        // Which element type to read is the annotated field's own, so one deserializer serves every such list.
        return new LatvijasPastsListDeserializer(property.getType().getContentType());
    }

    @Override
    public List<?> deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        JsonNode node = parser.readValueAsTree();
        List<Object> values = new ArrayList<>();
        // An object's values are iterated in the order it wrote them, which is the order the array had.
        for (JsonNode element : node) {
            values.add(context.readTreeAsValue(element, elementType));
        }
        return List.copyOf(values);
    }
}
