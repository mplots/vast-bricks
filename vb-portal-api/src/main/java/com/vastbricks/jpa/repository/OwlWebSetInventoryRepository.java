package com.vastbricks.jpa.repository;

import com.vastbricks.jpa.entity.OwlWebSetInventory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OwlWebSetInventoryRepository extends JpaRepository<OwlWebSetInventory, Integer> {
//    SELECT *FROM owl_web_set_inventory WHERE (contents->>'number')::BIGINT = 7138;
}
