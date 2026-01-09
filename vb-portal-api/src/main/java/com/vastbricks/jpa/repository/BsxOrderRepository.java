package com.vastbricks.jpa.repository;

import com.vastbricks.jpa.entity.bsx.BsxOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BsxOrderRepository extends JpaRepository<BsxOrder, Long> {
    Optional<BsxOrder> findByOrderId(String orderId);
}
