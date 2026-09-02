package com.vastbricks.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Getter
@Component
public class Env {
    @Value("#{environment.VASTBRICKS_API_KEY ?: 'change-me'}")
    private String apiKey;

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

    @Value("#{environment.MANS_PASTS_API_USER}")
    private String mansPastsApiUser;

    @Value("#{environment.MANS_PASTS_API_KEY}")
    private String mansPastsApiKey;

    @Value("#{environment.MANS_PASTS_API_BASE_URL ?: 'https://www.manspasts.lv'}")
    private String mansPastsApiBaseUrl;

    @Value("#{environment.EXPORTER_VAT_ID ?: ''}")
    private String exporterVatId;

    @Value("#{environment.BRICKLINK_CONSUMER_KEY}")
    private String brickLinkConsumerKey;

    @Value("#{environment.BRICKLINK_CONSUMER_SECRET}")
    private String brickLinkConsumerSecret;

    @Value("#{environment.BRICKLINK_TOKEN}")
    private String brickLinkToken;

    @Value("#{environment.BRICKLINK_TOKEN_SECRET}")
    private String brickLinkTokenSecret;

    @Value("#{environment.PAYPAL_CLIENT_ID}")
    private String paypalClientId;

    @Value("#{environment.PAYPAL_CLIENT_SECRET}")
    private String paypalClientSecret;

    @Value("#{environment.PAYPAL_ENVIRONMENT ?: 'SANDBOX'}")
    private String paypalEnvironment;

    @Value("#{environment.STRIPE_SECRET_KEY}")
    private String stripeSecretKey;

    @Value("#{environment.BRICKLINK_ORDER_ARCHIVE_DIR ?: '/tmp/vast-bricks/order-archive'}")
    private String brickLinkOrderArchiveDir;

    @Value("#{environment.BRICKSTORE_CLIENT_TOKEN}")
    private String brickStoreClientToken;

    @Value("#{environment.BSX_ORDER_DIR}")
    private String bsxOrderDir;

    @Value("#{environment.BSX_INVENTORY_FILE}")
    private String bsxInventoryFile;

    @Value("#{environment.CYPRESS_DOCKER_IMAGE ?: 'ghcr.io/mplots/vb-cypress-manspasts'}")
    private String cypressDockerImage;
}
