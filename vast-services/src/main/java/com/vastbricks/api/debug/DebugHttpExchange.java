package com.vastbricks.api.debug;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One recorded round trip between the Vast backend and a provider, belonging to the user whose request caused it. */
@Entity
@Table(name = "debug_http_exchanges", schema = "vast")
@Getter
@Setter
@NoArgsConstructor
class DebugHttpExchange {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @Column(nullable = false, length = 100)
    private String provider;

    @Column(nullable = false, length = 10)
    private String method;

    @Column(nullable = false)
    private String url;

    @Column(name = "request_body")
    private String requestBody;

    @Column(name = "status_code", nullable = false)
    private int statusCode;

    @Column(name = "response_body")
    private String responseBody;

    @Column(name = "duration_millis", nullable = false)
    private long durationMillis;

    /** Whether a body was longer than the stored cap and was cut short. */
    @Column(nullable = false)
    private boolean truncated;
}
