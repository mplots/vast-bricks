package com.vastbricks.jpa.repository;

import com.vastbricks.jpa.entity.OwlSet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Set;

public interface OwlSetRepository extends JpaRepository<OwlSet, Integer> {

    @Query(value = """
        SELECT ows.*
            FROM owl_set ows
            JOIN owl_web_set_inventory owsi on ows.boid = owsi.boid
        WHERE EXISTS (
            SELECT 1 FROM jsonb_array_elements(ows.contents->'ids') AS id
            WHERE id->>'type' = 'SET_NUMBER' AND split_part(id->>'id', '-', 1) IN (:setNumbers)
        );
  """,nativeQuery = true)
    List<OwlSet> findBySetNumberIn(@Param("setNumbers") List<String> setNumbers);


    @Query(value = "SELECT e.boid FROM owl_set e", nativeQuery = true)
    List<String> findAllBoids();

    @Query(value = """
        SELECT DISTINCT split_part(elem->>'id', '-', 1) AS set_number
        FROM owl_set, jsonb_array_elements(contents->'ids') AS elem
        WHERE elem->>'type' = 'SET_NUMBER';
    """,nativeQuery = true)
    List<String> findAllSetNumbers();
}
