package com.vastbricks.api.setup.datasource;

/** Every specific provider a data source can configure. Each has its own {@link DataSourceConfig} implementation. */
public enum DataSourceProvider {
    PAYPAL,
    STRIPE
}
