package com.vastbricks.bsx;

import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GuiState {

    @JacksonXmlProperty(isAttribute = true, localName = "Application")
    private String application;

    @JacksonXmlProperty(isAttribute = true, localName = "Version")
    private String version;

    @JacksonXmlProperty(localName = "ItemView")
    private ItemView itemView;
}
