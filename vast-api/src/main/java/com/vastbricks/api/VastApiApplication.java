package com.vastbricks.api;

import com.vastbricks.api.config.ApiConfiguration;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;

@SpringBootApplication
@Import(ApiConfiguration.class)
public class VastApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(VastApiApplication.class, args);
    }
}
