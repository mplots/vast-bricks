package com.vastbricks.bricksync;

import lombok.Getter;
import lombok.Setter;

/** A BrickSync command that reads a BrickStore file, with the file's content pasted in place of a path. */
@Getter
@Setter
public class BrickSyncFileCommandRequest {
    /** add, merge or loadprices. */
    private String command;
    /** The whole .bsx file, as BrickStore saves it. */
    private String bsx;
}
