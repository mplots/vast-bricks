package com.vastbricks.webstore;

import com.vastbricks.jpa.entity.WebStore;
import org.springframework.stereotype.Component;

import java.util.List;

//@Component
public class PiguScraper extends _220Scraper {

    @Override
    protected ScraperArgs scraperArgs() {
        var args =  super.scraperArgs();
        args.setUrls(List.of("https://pigu.lt/en/for-children-and-babies/toys-for-children-from-3-years/constructors-and-building-blocks/f/lego?page={page}"));
        return args;
    }

    @Override
    public WebStore getWebStore() {
        return WebStore.PIGU;
    }
}
