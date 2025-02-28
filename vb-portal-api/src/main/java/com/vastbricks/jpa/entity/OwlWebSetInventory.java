package com.vastbricks.jpa.entity;

import com.vastbricks.jpa.repository.OwlSetRepository;
import com.vastbricks.market.owl.WebSetInventory;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Type;

@Entity
@Getter
@Setter
public class OwlWebSetInventory {
    @Id
    private String boid;

    @ManyToOne
    private OwlSet owlSet;

    @Type(JsonType.class)
    private WebSetInventory contents;
}
