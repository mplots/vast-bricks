package com.vastbricks.jpa.entity.bsx;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "bsx_item")
public class BsxItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "document_id")
    private BsxDocument document;

    @Column(name = "item_id")
    private String itemId;

    @Column(name = "item_type_id")
    private String itemTypeId;

    @Column(name = "color_id")
    private Integer colorId;

    @Column(name = "item_name")
    private String itemName;

    @Column(name = "item_type_name")
    private String itemTypeName;

    @Column(name = "color_name")
    private String colorName;

    private String status;

    private Integer qty;

    @Column(name = "orig_qty")
    private Integer origQty;

    private BigDecimal price;

    @Column(name = "sale_price")
    private BigDecimal salePrice;

    private String condition;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(name = "lot_id")
    private String lotId;
}
