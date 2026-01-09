package com.vastbricks.service;

import lombok.AllArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.Array;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.util.List;

@Service
@AllArgsConstructor
public class PartUsageService {

    private final JdbcTemplate jdbcTemplate;

    public PartUsagePage fetchUsage(List<PartKey> parts, int limit, int offset, String sort, String dir) {
        if (parts == null || parts.isEmpty()) {
            return new PartUsagePage(0, offset, limit, List.of(), sort, dir);
        }
        var partNums = parts.stream().map(PartKey::partNum).toArray(String[]::new);
        var colorIds = parts.stream().map(PartKey::colorId).toArray(Integer[]::new);
        var partCount = parts.size();

        var total = jdbcTemplate.query(buildCountSql(), ps -> {
            setArrays(ps, partNums, colorIds);
            ps.setInt(3, partCount);
        }, rs -> rs.next() ? rs.getLong(1) : 0L);

        var rows = jdbcTemplate.query(buildDataSql(), ps -> {
            setArrays(ps, partNums, colorIds);
            ps.setInt(3, partCount);
            var nextIndex = setOrderParams(ps, 4, sort, dir);
            ps.setInt(nextIndex, limit);
            ps.setInt(nextIndex + 1, offset);
        }, (rs, rowNum) -> new PartUsageRow(
                rs.getLong("setNumber"),
                rs.getString("setName"),
                rs.getInt("totalQty"),
                (BigDecimal) rs.getObject("partOutPrice"),
                (BigDecimal) rs.getObject("partOutRatio"),
                rs.getString("partOutLink"),
                (BigDecimal) rs.getObject("setPrice"),
                rs.getString("webStore"),
                rs.getString("image")
        ));

        return new PartUsagePage(total == null ? 0 : total, offset, limit, rows, sort, dir);
    }

    private void setArrays(PreparedStatement ps, String[] partNums, Integer[] colorIds) throws java.sql.SQLException {
        Connection connection = ps.getConnection();
        Array partNumArray = connection.createArrayOf("text", partNums);
        Array colorIdArray = connection.createArrayOf("int4", colorIds);
        ps.setArray(1, partNumArray);
        ps.setArray(2, colorIdArray);
    }

    private int setOrderParams(PreparedStatement ps, int startIndex, String sort, String dir) throws java.sql.SQLException {
        var index = startIndex;
        for (int i = 0; i < 8; i++) {
            ps.setString(index++, sort);
            ps.setString(index++, dir);
        }
        return index;
    }

    private String buildDataSql() {
        return """
            WITH input_parts AS (
                SELECT * FROM unnest(?::text[], ?::int[]) WITH ORDINALITY AS t(part_num, color_id, ord)
            ),
            latest_inventory AS (
                SELECT DISTINCT ON (i.set_num) i.id, i.set_num
                FROM rebrickable.inventories i
                ORDER BY i.set_num, i.version DESC
            ),
            matches AS (
                SELECT li.set_num,
                       ip.quantity AS part_qty,
                       t.ord
                FROM input_parts t
                JOIN rebrickable_color_map m ON m.bricklink_color_id = t.color_id
                JOIN rebrickable.inventory_parts ip ON ip.part_num = t.part_num AND ip.color_id = m.rebrickable_color_id
                JOIN latest_inventory li ON li.id = ip.inventory_id
                WHERE ip.is_spare = false
            ),
            set_totals AS (
                SELECT set_num,
                       SUM(part_qty) AS total_qty,
                       COUNT(DISTINCT ord) AS matched_parts
                FROM matches
                GROUP BY set_num
                HAVING COUNT(DISTINCT ord) = ?
            )
            SELECT bs.number AS setNumber,
                   bs.name AS setName,
                   st.total_qty AS totalQty,
                   co.part_out_price AS partOutPrice,
                   co.part_out_ratio AS partOutRatio,
                   co.part_out_link AS partOutLink,
                   co.price AS setPrice,
                   co.web_store AS webStore,
                   co.image AS image
            FROM set_totals st
            JOIN brick_set bs ON bs.number::text = split_part(st.set_num, '-', 1)
            JOIN cheapest_offer_per_set co ON co.set_number = bs.number
            ORDER BY
                CASE WHEN ? = 'ratio' AND ? = 'desc' THEN co.part_out_ratio END DESC NULLS LAST,
                CASE WHEN ? = 'ratio' AND ? = 'asc' THEN co.part_out_ratio END ASC NULLS LAST,
                CASE WHEN ? = 'qty' AND ? = 'desc' THEN st.total_qty END DESC NULLS LAST,
                CASE WHEN ? = 'qty' AND ? = 'asc' THEN st.total_qty END ASC NULLS LAST,
                CASE WHEN ? = 'price' AND ? = 'desc' THEN co.price END DESC NULLS LAST,
                CASE WHEN ? = 'price' AND ? = 'asc' THEN co.price END ASC NULLS LAST,
                CASE WHEN ? = 'partout' AND ? = 'desc' THEN co.part_out_price END DESC NULLS LAST,
                CASE WHEN ? = 'partout' AND ? = 'asc' THEN co.part_out_price END ASC NULLS LAST,
                co.part_out_ratio DESC NULLS LAST,
                st.total_qty DESC,
                bs.number ASC
            LIMIT ? OFFSET ?
            """;
    }

    private String buildCountSql() {
        return """
            WITH input_parts AS (
                SELECT * FROM unnest(?::text[], ?::int[]) WITH ORDINALITY AS t(part_num, color_id, ord)
            ),
            latest_inventory AS (
                SELECT DISTINCT ON (i.set_num) i.id, i.set_num
                FROM rebrickable.inventories i
                ORDER BY i.set_num, i.version DESC
            ),
            matches AS (
                SELECT li.set_num,
                       t.ord
                FROM input_parts t
                JOIN rebrickable_color_map m ON m.bricklink_color_id = t.color_id
                JOIN rebrickable.inventory_parts ip ON ip.part_num = t.part_num AND ip.color_id = m.rebrickable_color_id
                JOIN latest_inventory li ON li.id = ip.inventory_id
                WHERE ip.is_spare = false
            ),
            set_totals AS (
                SELECT set_num,
                       COUNT(DISTINCT ord) AS matched_parts
                FROM matches
                GROUP BY set_num
                HAVING COUNT(DISTINCT ord) = ?
            )
            SELECT COUNT(*)
            FROM set_totals st
            JOIN brick_set bs ON bs.number::text = split_part(st.set_num, '-', 1)
            JOIN cheapest_offer_per_set co ON co.set_number = bs.number
            """;
    }

    public record PartKey(String partNum, Integer colorId) { }

    public record PartUsageRow(Long setNumber,
                               String setName,
                               Integer totalQty,
                               BigDecimal partOutPrice,
                               BigDecimal partOutRatio,
                               String partOutLink,
                               BigDecimal setPrice,
                               String webStore,
                               String image) { }

    public record PartUsagePage(long total,
                                int offset,
                                int limit,
                                List<PartUsageRow> items,
                                String sort,
                                String dir) { }
}
