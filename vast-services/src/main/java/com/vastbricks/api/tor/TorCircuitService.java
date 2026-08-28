package com.vastbricks.api.tor;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.Socket;
import java.time.Instant;

@Service
@RequiredArgsConstructor
class TorCircuitService {

    private static final Logger log = LoggerFactory.getLogger(TorCircuitService.class);

    private final TorSettings settings;
    private final TorIpAddressService torIpAddressService;

    public synchronized TorCircuitChange requestNewCircuit(boolean waitForNewIp) {
        var previousIpAddress = torIpAddressService.currentIpAddress();
        sendNewCircuitSignal();

        if (!waitForNewIp) {
            return new TorCircuitChange(previousIpAddress, torIpAddressService.currentIpAddress());
        }

        var currentIpAddress = waitForChangedIp(previousIpAddress);
        log.info("New Tor IP assigned: {}", currentIpAddress);
        return new TorCircuitChange(previousIpAddress, currentIpAddress);
    }

    private void sendNewCircuitSignal() {
        try (var socket = new Socket(settings.getControlHost(), settings.getControlPort());
             var out = new PrintWriter(socket.getOutputStream(), true);
             var in = new BufferedReader(new InputStreamReader(socket.getInputStream()))) {

            sendCommand(out, in, "AUTHENTICATE \"%s\"".formatted(settings.getControlPassword()));
            sendCommand(out, in, "SIGNAL NEWNYM");
            log.info("New Tor circuit requested successfully.");
        } catch (IOException ex) {
            throw new TorCircuitException("Failed to request a new Tor circuit.", ex);
        }
    }

    private void sendCommand(PrintWriter out, BufferedReader in, String command) throws IOException {
        out.println(command);
        out.flush();

        var response = in.readLine();
        if (response == null || !response.startsWith("250")) {
            throw new TorCircuitException("Tor control command failed: " + response);
        }
    }

    private String waitForChangedIp(String previousIpAddress) {
        var deadline = Instant.now().plus(settings.getNewIpTimeout());
        while (Instant.now().isBefore(deadline)) {
            var currentIpAddress = torIpAddressService.currentIpAddress();
            if (!previousIpAddress.equals(currentIpAddress)) {
                return currentIpAddress;
            }

            sleepOneSecond();
        }

        throw new TorCircuitException("Timed out waiting for Tor to assign a new IP address.");
    }

    private void sleepOneSecond() {
        try {
            Thread.sleep(1000);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new TorCircuitException("Interrupted while waiting for a new Tor IP address.", ex);
        }
    }
}
