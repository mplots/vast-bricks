package com.vastbricks.jpa.entity.bsx;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "bsx_order")
public class BsxOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(optional = false)
    @JoinColumn(name = "document_id")
    private BsxDocument document;

    private String service;

    @Column(name = "order_id")
    private String orderId;

    @Column(name = "order_date")
    private Long orderDate;

    private String customer;

    @Column(name = "sub_total")
    private BigDecimal subTotal;

    @Column(name = "grand_total")
    private BigDecimal grandTotal;

    private BigDecimal payment;

    private String currency;
}
