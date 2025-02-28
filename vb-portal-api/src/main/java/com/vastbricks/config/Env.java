package com.vastbricks.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Getter
@Component
public class Env {
    @Value("#{environment.FLYWAY_CLEN_ON_STARTUP ?: 'false'}")
    private Boolean flywayClenOnStartup;

    @Value("#{environment.BRICK_OWL_API_KEY}")
    private String brickOwlApiKey;

    @Value("#{environment.DISCORD_BOT_TOKEN}")
    private String discordBotToken;

    @Value("#{environment.DISCORD_CHANNEL_ID}")
    private String discordChannelId;
}
