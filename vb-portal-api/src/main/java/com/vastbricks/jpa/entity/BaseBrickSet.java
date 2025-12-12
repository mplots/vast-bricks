package com.vastbricks.jpa.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Type;

import java.util.Set;

@Getter
@Setter
@Table(name = "brick_set")
@Entity
public class BaseBrickSet {
    @Id
    private Long number;

    private String theme;

    private String name;

    private String boid;

    @Type(JsonType.class)
    private Set<String> upcIds;

    @Type(JsonType.class)
    private Set<String> eanIds;
}
