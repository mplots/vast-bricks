package com.vastbricks.jpa.repository;

import com.vastbricks.jpa.entity.Marketplace;
import com.vastbricks.jpa.entity.OrderQrRegistration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OrderQrRegistrationRepository extends JpaRepository<OrderQrRegistration, Long> {
    List<OrderQrRegistration> findAllByQridIn(Collection<String> qrids);
    Optional<OrderQrRegistration> findByQrid(String qrid);
    List<OrderQrRegistration> findAllByOrderIdAndSource(String orderId, Marketplace source);
    void deleteByOrderIdAndSourceAndQridNotIn(String orderId, Marketplace source, Collection<String> qrids);
    void deleteByOrderIdAndSource(String orderId, Marketplace source);
}
