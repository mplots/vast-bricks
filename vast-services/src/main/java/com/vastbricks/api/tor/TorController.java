package com.vastbricks.api.tor;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value = "/api/private/tor", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class TorController {

    private final TorCircuitService torCircuitService;

    @PostMapping("/circuit")
    public TorCircuitResponse requestNewCircuit() {
        return new TorCircuitResponse(torCircuitService.requestNewCircuit(true));
    }
}
