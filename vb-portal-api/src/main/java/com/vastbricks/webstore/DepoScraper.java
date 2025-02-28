package com.vastbricks.webstore;

import com.vastbricks.jpa.entity.WebStore;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Slf4j
@Component
public class DepoScraper implements Scraper {


    @Data
    private static final class Request {
        private String operationName = "products";
        private Variables variables = new Variables();
        private String query =  "query products($searchString: String, $order: [ProductSortModelInput], $facets: [FacetFilterInput], $categoryId: Int, $rows: Int, $start: Int) {  products(    searchString: $searchString    categoryId: $categoryId    order_by: $order    facets: $facets    rows: $rows    start: $start  ) {    facetsInfo {      ...Facets      __typename    }    stats {      yellowPriceWithVat {        min        max        __typename      }      __typename    }    pageInfo {      endCursor      startCursor      hasPreviousPage      hasNextPage      totalCount      __typename    }    edges {      node {        ...ListProduct        __typename      }      __typename    }    __typename  }}fragment Facets on FacetsInfo {  facets {    name    values {      count      selected      value      __typename    }    minValue    maxValue    __typename  }  __typename}fragment ListProduct on ProductModel {  id  name  ...Prices  thumbnailPictureUrl  cardThumbnailPictureUrl  ...Unit  ...StockItems  ...Energy  __typename}fragment Prices on ProductModel {  ...AbstractPrices  __typename}fragment AbstractPrices on ProductModel {  prices {    id    normCoef    priceType    taxPercent    orangePricePercent    yellowPricePercent    yellow {      ...Price      __typename    }    orange {      ...Price      __typename    }    __typename  }  __typename}fragment Price on ProductPriceModel {  price  priceWithVat  priceQuantity  normPrice  normPriceWithVat  unit  normUnit  __typename}fragment Unit on ProductModel {  unitConversion {    factor    fromUnit    toUnit    __typename  }  __typename}fragment StockItems on ProductModel {  stockItems {    ...StockItemsFields    __typename  }  __typename}fragment StockItemsFields on StockItemModel {  ...AbstractStockItemsFields  __typename}fragment AbstractStockItemsFields on StockItemModel {  locationId  locationAddress  quantity  __typename}fragment Energy on ProductModel {  energyEfficiency  energyEfficiencyDocumentUrl  energyEfficiencyImageUrl  __typename}";
    }

    @Data
    private static final class Variables {
        private Integer start;
        private Integer rows;
        private Integer categoryId = 9692;
        private String [] facets = new String[]{};

    }

    @Data
    private static final class Root {
        private DData data;
    }

    @Data
    private static final class DData {
        private Products products;
    }

    @Data
    private static final class PageInfo {
        private Long totalCount;
    }

    @Data
    private static final class Products {
        private PageInfo pageInfo;
        private List<Edge> edges;
    }

    @Data
    private static final class Edge {
        private Node node;
    }

    @Data
    private static final class Node {
        private Long id;
        private String name;
        private Prices prices;
        private String cardThumbnailPictureUrl;
        private List<StockItem> stockItems;
    }

    @Data
    private static final class StockItem {
        private String locationAddress;
        private Long locationId;
        private BigDecimal quantity;
    }

    @Data
    private static final class Prices {
        private Price yellow;
        private Price orange;
    }

    @Data
    private static final class Price {
        private BigDecimal priceWithVat;
    }

    @Override
    public List<WebSet> scrape() {
       var restTemplate = new RestTemplate();
        var url = "https://online.depo.lv/graphql";
        var page = 1;
        var start = 1;
        var step = 20;
        var result = new ArrayList<WebSet>();
        Root root;
        do {
            log.info("Scrapping %s Page: %s".formatted(getWebStore(), (page)));
            var request = new Request();
            request.variables.start = start;
            request.variables.rows = start + step;

            root = restTemplate.postForObject(url, request, Root.class);

            result.addAll(root.getData().getProducts().getEdges().stream().map(i->{
                        var matcher = ID_PATTERN.matcher(i.node.name);
                        return i.node.stockItems.size() == 0 || !i.node.name.toLowerCase().contains("lego") || !matcher.find() ? null :
                                WebSet.builder()
                                        .store(getWebStore())
                                        .price(i.node.prices.orange.priceWithVat.compareTo(BigDecimal.ZERO) > 0 ? i.node.prices.orange.priceWithVat :  i.node.prices.yellow.priceWithVat)
                                        .image(i.node.cardThumbnailPictureUrl)
                                        .name(i.node.name)
                                        .number(Long.valueOf(matcher.group()))
                                        .link("https://online.depo.lv/product/%s".formatted(i.node.id))
                                        .build();
                    }
            ).filter(Objects::nonNull).toList());
            start = start + step;
            page++;
        } while (start <= root.data.products.pageInfo.totalCount);

        return result;
    }

    @Override
    public WebStore getWebStore() {
        return WebStore.DEPO;
    }
}
