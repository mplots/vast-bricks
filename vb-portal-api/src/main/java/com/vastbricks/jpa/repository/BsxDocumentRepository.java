package com.vastbricks.jpa.repository;

import com.vastbricks.jpa.entity.bsx.BsxDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.List;

public interface BsxDocumentRepository extends JpaRepository<BsxDocument, Long> {
    Optional<BsxDocument> findByFilename(String filename);

    @Query("SELECT b.filename FROM BsxDocument b")
    List<String> findAllFilenames();
}
