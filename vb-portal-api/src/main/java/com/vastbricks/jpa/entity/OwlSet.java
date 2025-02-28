package com.vastbricks.jpa.entity;

import com.vastbricks.market.owl.IdType;
import com.vastbricks.market.owl.Item;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Type;

@Entity
@Getter
@Setter
public class OwlSet {

    @Id
    private String boid;

    @Type(JsonType.class)
    private Item contents;

    public Long getSetNumber() {
        var oSetNumber = contents.getIds()
                .stream()
                .filter(e->e.getType().equals(IdType.SET_NUMBER))
                .map(i->i.getId())
                .findFirst();

        if (oSetNumber.isPresent()) {
            var setNumber = oSetNumber.get().split("-")[0];
            if (setNumber.matches("-?\\d+")) {
                return Long.valueOf(setNumber);
            }
        }
        return null;
    }
}
