package com.vastbricks.bsx;

import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ItemView {

    @JacksonXmlProperty(localName = "ColumnOrder")
    private String columnOrder;

    @JacksonXmlProperty(localName = "ColumnWidths")
    private String columnWidths;

    @JacksonXmlProperty(localName = "ColumnWidthsHidden")
    private String columnWidthsHidden;

    @JacksonXmlProperty(localName = "SortColumn")
    private Integer sortColumn;

    @JacksonXmlProperty(localName = "SortDirection")
    private String sortDirection;
}
