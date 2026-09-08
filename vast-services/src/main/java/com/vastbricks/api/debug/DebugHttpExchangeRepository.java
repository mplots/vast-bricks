package com.vastbricks.api.debug;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

interface DebugHttpExchangeRepository extends JpaRepository<DebugHttpExchange, Long> {

    /** This user's rows after a cursor, oldest first, so the panel appends what it has not seen. */
    List<DebugHttpExchange> findByUserIdAndIdGreaterThanOrderByIdAsc(Long userId, Long afterId, Limit limit);

    /** One row, but only if it is the caller's: a download reaches nobody else's traffic. */
    Optional<DebugHttpExchange> findByIdAndUserId(Long id, Long userId);

    @Transactional
    void deleteByUserId(Long userId);
}
