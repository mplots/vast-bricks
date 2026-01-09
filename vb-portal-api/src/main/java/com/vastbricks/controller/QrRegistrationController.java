package com.vastbricks.controller;

import com.vastbricks.jpa.entity.Marketplace;
import com.vastbricks.jpa.entity.OrderQrRegistration;
import com.vastbricks.jpa.repository.OrderQrRegistrationRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/qr")
@RequiredArgsConstructor
public class QrRegistrationController {

    private final OrderQrRegistrationRepository orderQrRegistrationRepository;

    @CrossOrigin(origins = {"https://www.bricklink.com", "https://www.brickowl.com"})
    @PostMapping("/register")
    @Transactional
    public QrRegistrationResponse register(@Valid @RequestBody QrRegistrationRequest request) {
        var orderId = request.orderId();
        var source = request.source();
        var requested = request.qrids();

        if (requested.isEmpty()) {
            orderQrRegistrationRepository.deleteByOrderIdAndSource(orderId, source);
            return new QrRegistrationResponse(orderId, source.name(), List.of(), List.of());
        }

        orderQrRegistrationRepository.deleteByOrderIdAndSourceAndQridNotIn(orderId, source, requested);

        var existing = orderQrRegistrationRepository.findAllByQridIn(requested).stream()
            .map(OrderQrRegistration::getQrid)
            .collect(Collectors.toSet());

        var newQrids = requested.stream()
            .filter(qrid -> !existing.contains(qrid))
            .toList();

        var registrations = newQrids.stream().map(qrid -> {
            var registration = new OrderQrRegistration();
            registration.setQrid(qrid);
            registration.setOrderId(orderId);
            registration.setSource(source);
            return registration;
        }).toList();

        if (!registrations.isEmpty()) {
            orderQrRegistrationRepository.saveAll(registrations);
        }

        return new QrRegistrationResponse(
            orderId,
            source.name(),
            newQrids,
            requested.stream().filter(existing::contains).toList()
        );
    }

    @GetMapping("/list")
    @CrossOrigin(origins = {"https://www.bricklink.com", "https://www.brickowl.com"})
    public QrListResponse list(@RequestParam("orderId") String orderId, @RequestParam("source") String source) {
        var marketplace = Marketplace.from(source);
        var qrids = orderQrRegistrationRepository.findAllByOrderIdAndSource(orderId, marketplace).stream()
            .map(OrderQrRegistration::getQrid)
            .toList();
        return new QrListResponse(orderId, marketplace.name(), qrids);
    }

    public record QrRegistrationRequest(
        @NotBlank String orderId,
        @NotNull Marketplace source,
        @NotNull List<@NotBlank String> qrids
    ) { }

    public record QrRegistrationResponse(
        String orderId,
        String source,
        List<String> registeredQrids,
        List<String> existingQrids
    ) { }

    public record QrListResponse(
        String orderId,
        String source,
        List<String> qrids
    ) { }
}
