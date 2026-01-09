package com.vastbricks.jpa.entity.rebrickable;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(schema = "rebrickable", name = "inventories")
public class RebrickableInventory {

    @Id
    @Column(name = "id")
    private Integer id;

    @Column(name = "set_num")
    private String setNum;

    @Column(name = "version")
    private Integer version;
}
