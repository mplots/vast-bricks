package com.vastbricks.bricksync;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** BrickSync's current inventory, as the BSX file its backup command wrote. */
@Getter
@AllArgsConstructor
public class BrickSyncBackupResponse {
    private final String fileName;
    private final String bsx;
}
