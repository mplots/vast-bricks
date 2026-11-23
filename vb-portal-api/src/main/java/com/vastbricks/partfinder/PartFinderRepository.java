package com.vastbricks.partfinder;

import com.vastbricks.jpa.entity.BrickSet;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

/**
 * Parts as they appear in sets that are for sale right now.
 *
 * <p>"For sale" is what {@code cheapest_offer_per_set} means by it: an active listing with an active offer seen in the
 * last three hours, which is the scraper's hourly run with room for a missed one. Unlike that view it does not need
 * a part-out price, and it keeps every store rather than only the cheapest. A set number with several Rebrickable
 * variants is read from its first variant's latest inventory, so a set is counted once.
 */
public interface PartFinderRepository extends Repository<BrickSet, Long> {

    String SET_INVENTORIES_FOR_SALE = """
        offers_for_sale AS (
            SELECT p.id AS product_id, p.brick_set_number, p.web_store, p.link, p.image, bso.price, bso.timestamp
            FROM product p
            JOIN brick_set_offer bso ON bso.product_id = p.id
            WHERE p.active AND bso.active AND bso.timestamp >= NOW() - INTERVAL '3 hours'
        ),
        latest_inventory AS (
            SELECT DISTINCT ON (i.set_num) i.id, i.set_num
            FROM rebrickable.inventories i
            ORDER BY i.set_num, i.version DESC
        ),
        set_inventory AS (
            SELECT DISTINCT ON (split_part(li.set_num, '-', 1)) li.id, split_part(li.set_num, '-', 1) AS set_number
            FROM latest_inventory li
            WHERE split_part(li.set_num, '-', 1) IN (SELECT brick_set_number::text FROM offers_for_sale)
            ORDER BY split_part(li.set_num, '-', 1), li.set_num
        )
        """;

    /**
     * The part and color pairs whose part number, part name and color name together match every pattern, each with
     * the number of sets for sale that contain it.
     */
    @Query(value = "WITH " + SET_INVENTORIES_FOR_SALE + """
        SELECT ip.part_num AS partNum,
               pt.name AS partName,
               c.id AS colorId,
               c.name AS colorName,
               c.rgb AS colorRgb,
               MAX(ip.img_url) AS image,
               COUNT(DISTINCT si.set_number) AS setCount
        FROM set_inventory si
        JOIN rebrickable.inventory_parts ip ON ip.inventory_id = si.id AND NOT ip.is_spare
        JOIN rebrickable.parts pt ON pt.part_num = ip.part_num
        JOIN rebrickable.colors c ON c.id = ip.color_id
        WHERE (ip.part_num || ' ' || pt.name || ' ' || c.name) ~* ALL (string_to_array(:patterns, ' '))
        GROUP BY ip.part_num, pt.name, c.id, c.name, c.rgb
        ORDER BY setCount DESC, pt.name, c.name
        LIMIT :limit
        """, nativeQuery = true)
    List<PartColorRow> searchPartColors(@Param("patterns") String patterns, @Param("limit") int limit);

    /** Every store's cheapest current offer for each set for sale that contains the part in the color. */
    @Query(value = "WITH " + SET_INVENTORIES_FOR_SALE + """
        , matches AS (
            SELECT si.set_number, SUM(ip.quantity) AS part_qty
            FROM set_inventory si
            JOIN rebrickable.inventory_parts ip ON ip.inventory_id = si.id
            WHERE NOT ip.is_spare AND ip.part_num = :partNum AND ip.color_id = :colorId
            GROUP BY si.set_number
        ),
        latest_offer AS (
            SELECT DISTINCT ON (o.product_id) o.*
            FROM offers_for_sale o
            JOIN matches m ON m.set_number = o.brick_set_number::text
            ORDER BY o.product_id, o.timestamp DESC
        )
        SELECT DISTINCT ON (bs.number, lo.web_store)
               bs.number AS setNumber,
               bs.name AS setName,
               bs.theme AS theme,
               bs.pieces AS pieces,
               m.part_qty AS partQty,
               lo.web_store AS webStore,
               lo.price AS price,
               lo.link AS link,
               lo.image AS image,
               TO_CHAR(lo.timestamp, 'YYYY-MM-DD HH24:MI') AS seenAt
        FROM latest_offer lo
        JOIN brick_set bs ON bs.number = lo.brick_set_number
        JOIN matches m ON m.set_number = bs.number::text
        ORDER BY bs.number, lo.web_store, lo.price
        """, nativeQuery = true)
    List<StoreOfferRow> findStoreOffers(@Param("partNum") String partNum, @Param("colorId") int colorId);

    interface PartColorRow {
        String getPartNum();
        String getPartName();
        Integer getColorId();
        String getColorName();
        String getColorRgb();
        String getImage();
        Long getSetCount();
    }

    interface StoreOfferRow {
        Long getSetNumber();
        String getSetName();
        String getTheme();
        Integer getPieces();
        Integer getPartQty();
        String getWebStore();
        BigDecimal getPrice();
        String getLink();
        String getImage();
        String getSeenAt();
    }
}
