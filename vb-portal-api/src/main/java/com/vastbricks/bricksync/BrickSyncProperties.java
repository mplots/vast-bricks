package com.vastbricks.bricksync;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Getter
@Component
public class BrickSyncProperties {
    @Value("#{environment.BRICKSYNC_COMMAND_PIPE ?: '/tmp/vb-bricksync-test/control/commands.fifo'}")
    private String commandPipe;

    @Value("#{environment.BRICKSYNC_CONTAINER_COMMAND_PIPE ?: '/opt/bricksync/control/commands.fifo'}")
    private String containerCommandPipe;

    @Value("#{environment.BRICKSYNC_CONTAINER_NAME ?: 'vb-bricksync-test'}")
    private String containerName;

    @Value("#{environment.BRICKSYNC_COMMAND_TIMEOUT_SECONDS ?: 3}")
    private int commandTimeoutSeconds;

    @Value("#{environment.BRICKSYNC_MAX_COMMAND_LENGTH ?: 500}")
    private int maxCommandLength;

    @Value("#{environment.BRICKSYNC_DEFAULT_LOG_TAIL ?: 200}")
    private int defaultLogTail;

    @Value("#{environment.BRICKSYNC_MAX_LOG_TAIL ?: 1000}")
    private int maxLogTail;
}
