package com.vastbricks.webstore;


import java.util.List;
import java.util.regex.Pattern;

public interface Scraper {
    Pattern ID_PATTERN = Pattern.compile("\\b\\d{5}\\b");
    List<WebSet> scrape();
    String  getWebStore();
}
