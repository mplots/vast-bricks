package com.vastbricks.jpa.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Table(schema = "raw", name = "raw_owl_web_inventory")
@Entity
@Getter
@Setter
public class RawOwlWebInventory {
    @Id
    private Integer boid;
    private String html;
}
