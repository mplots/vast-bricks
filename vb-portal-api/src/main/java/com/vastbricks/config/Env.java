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

    @Value("#{environment.BRICK_OWL_COOKIE}")
    private String brickOwlCookie;

    @Value("#{environment.DISCORD_BOT_TOKEN}")
    private String discordBotToken;

    @Value("#{environment.DISCORD_CHANNEL_ID}")
    private String discordChannelId;

    @Value("#{environment.MANS_PASTS_USERNAME}")
    private String mansPastsUsername;

    @Value("#{environment.MANS_PASTS_PASSWORD}")
    private String mansPastsPassword;

    @Value("#{environment.BRICKLINK_CONSUMER_KEY}")
    private String brickLinkConsumerKey;

    @Value("#{environment.BRICKLINK_CONSUMER_SECRET}")
    private String brickLinkConsumerSecret;

    @Value("#{environment.BRICKLINK_TOKEN}")
    private String brickLinkToken;

    @Value("#{environment.BRICKLINK_TOKEN_SECRET}")
    private String brickLinkTokenSecret;
}
