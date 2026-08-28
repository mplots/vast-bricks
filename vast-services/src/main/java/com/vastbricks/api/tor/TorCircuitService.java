package com.vastbricks.api.tor;

import lombok.RequiredArgsConstructor;
import lombok.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.Socket;
import java.time.Duration;
import java.time.Instant;

@Service
@RequiredArgsConstructor
class TorCircuitService {

    private static final Logger log = LoggerFactory.getLogger(TorCircuitService.class);

    private final TorSettings settings;
    private final TorIpAddressService torIpAddressService;

    public synchronized TorCircuitChange requestNewCircuit(boolean waitForNewIp) {
        var startedAt = Instant.now();
        var previousIpAddress = torIpAddressService.currentIpAddress();
        sendNewCircuitSignal();

        if (!waitForNewIp) {
            var currentIpAddress = torIpAddressService.currentIpAddress();
            return new TorCircuitChange(previousIpAddress, currentIpAddress, elapsedMillis(startedAt), 1);
        }

        var waitResult = waitForChangedIp(previousIpAddress);
        var currentIpAddress = waitResult.getIpAddress();
        log.info("New Tor IP assigned: {}", currentIpAddress);
        return new TorCircuitChange(previousIpAddress, currentIpAddress, elapsedMillis(startedAt), waitResult.getAttempts());
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

    private WaitResult waitForChangedIp(String previousIpAddress) {
        var deadline = Instant.now().plus(settings.getNewIpTimeout());
        var pollInterval = settings.getNewIpInitialPollInterval();
        var attempts = 0;
        while (Instant.now().isBefore(deadline)) {
            attempts++;
            var currentIpAddress = torIpAddressService.currentIpAddress();
            if (!previousIpAddress.equals(currentIpAddress)) {
                return new WaitResult(currentIpAddress, attempts);
            }

            sleep(pollInterval);
            pollInterval = nextPollInterval(pollInterval);
        }

        throw new TorCircuitException("Timed out waiting for Tor to assign a new IP address.");
    }

    private Duration nextPollInterval(Duration current) {
        var next = current.multipliedBy(2);
        return next.compareTo(settings.getNewIpMaxPollInterval()) > 0
                ? settings.getNewIpMaxPollInterval()
                : next;
    }

    private long elapsedMillis(Instant startedAt) {
        return Duration.between(startedAt, Instant.now()).toMillis();
    }

    private void sleep(Duration duration) {
        try {
            Thread.sleep(duration.toMillis());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new TorCircuitException("Interrupted while waiting for a new Tor IP address.", ex);
        }
    }

    @Value
    private static class WaitResult {
        String ipAddress;
        int attempts;
    }
}
