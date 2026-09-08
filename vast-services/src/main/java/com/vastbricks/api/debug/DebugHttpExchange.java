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

    /**
     * The request body as it arrived, kept only where it was not text: the body column holds a note about it instead,
     * and the panel offers this to download. {@code null} for a text body, for no body, and for one over the cap.
     */
    @Column(name = "request_body_file")
    private byte[] requestBodyFile;

    @Column(name = "request_body_content_type", length = 255)
    private String requestBodyContentType;

    @Column(name = "status_code", nullable = false)
    private int statusCode;

    @Column(name = "response_body")
    private String responseBody;

    /** The response body as it arrived, kept on the same terms as the request's. */
    @Column(name = "response_body_file")
    private byte[] responseBodyFile;

    @Column(name = "response_body_content_type", length = 255)
    private String responseBodyContentType;

    @Column(name = "duration_millis", nullable = false)
    private long durationMillis;

    /**
     * Whether a body was longer than the stored cap. A text body is cut short at it; a file is not kept at all,
     * a truncated spreadsheet being a corrupt file rather than a shorter one.
     */
    @Column(nullable = false)
    private boolean truncated;
}
