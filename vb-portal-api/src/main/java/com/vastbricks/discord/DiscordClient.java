package com.vastbricks.discord;

import com.vastbricks.config.Env;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.JDABuilder;
import net.dv8tion.jda.api.requests.GatewayIntent;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DiscordClient {
    private final Env env;
    private JDA jda;

    @PostConstruct
    public void onInit() throws InterruptedException {
        if (env.getDiscordBotToken() != null) {
            jda = JDABuilder.createDefault(env.getDiscordBotToken())
                    .enableIntents(GatewayIntent.GUILD_MESSAGES, GatewayIntent.MESSAGE_CONTENT)
                    .build()
                    .awaitReady();
        } else {
            log.warn("DISCORD_BOT_TOKEN is empty. Skipping login.");
        }
    }

    public void publishMessage(String text) {
        if (env.getDiscordChannelId()!=null) {
            try {
                var channel = jda.getTextChannelById(env.getDiscordChannelId());
                if (channel != null) {
                    channel.sendMessage(text).queue();
                } else {
                    log.error("Channel with id %s not found.".formatted(env.getDiscordChannelId()));
                }

            } catch (Exception e) {
                log.error(e.getMessage());
            }
        } else {
            log.warn("DISCORD_CHANNEL_ID is empty. Skipping message publishing.");
        }
    }

    @PreDestroy
    public void onDestroy() throws InterruptedException {
        if (jda != null) {
            jda.awaitShutdown();
        }
    }
}

