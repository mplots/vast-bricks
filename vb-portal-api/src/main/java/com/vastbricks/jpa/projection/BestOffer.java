package com.vastbricks.jpa.projection;

import java.math.BigDecimal;
import java.util.List;

public interface BestOffer {
    Long getProductId();
    Long getLowestOfferId();
    String getSetName();
    Long getSetNumber();
    String getTheme();
    String getWebStore();
    BigDecimal getPrice();
    BigDecimal getLowestPrice();
    BigDecimal getPartOutPrice();
    BigDecimal getPartOutRatio();
    BigDecimal getPricePeerPeace();
    String getImage();
    String getPurchaseLink();
    String getPartOutLink();
    List<String> getEanIds();
    String getPriceTimestamp();
    Integer getPieces();
    Integer getLots();
}
