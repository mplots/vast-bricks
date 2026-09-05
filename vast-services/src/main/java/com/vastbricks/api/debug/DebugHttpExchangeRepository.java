package com.vastbricks.api.debug;

import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

interface DebugHttpExchangeRepository extends JpaRepository<DebugHttpExchange, Long> {

    /** This user's rows after a cursor, oldest first, so the panel appends what it has not seen. */
    List<DebugHttpExchange> findByUserIdAndIdGreaterThanOrderByIdAsc(Long userId, Long afterId, Limit limit);

    @Transactional
    void deleteByUserId(Long userId);
}
