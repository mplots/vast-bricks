package com.vastbricks.jpa.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.Entity;

import jakarta.persistence.Id;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Type;

import java.util.List;
import java.util.Set;


@Getter
@Setter
@Entity
public class BrickSet {
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
