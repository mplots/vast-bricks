package com.vastbricks.api.client;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.function.UnaryOperator;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

/**
 * One side's body of a recorded round trip: the text a panel can show, or the file it can only hand over.
 *
 * <p>Not every provider answers in text — an export hands over a spreadsheet, a label a PDF — and such a body is two
 * different things to a reader. Decoded as text it is a screenful of replacement characters that says nothing, and one
 * carrying a NUL cannot be stored in a text column at all, which would fail the request that made the call rather
 * than only the recording of it. What it is worth is opening in the program that reads it. So a body that is not text
 * carries a note of its type and size as its text, and the bytes themselves beside it, for a panel to offer as a
 * download.
 */
@Getter
@AllArgsConstructor(access = lombok.AccessLevel.PRIVATE)
public class RawHttpBody {

    /** What the panel shows: the body itself, or a note about the file where it was not text. */
    private final String text;

    /** The body as it arrived, kept only where it is not text. {@code null} for a text body and for no body at all. */
    private final byte[] bytes;

    /** What the provider called it, kept beside the bytes so a download can be served as what it is. */
    private final String contentType;

    /** No body at all, as a listing request carries none. */
    public static RawHttpBody none() {
        return new RawHttpBody(null, null, null);
    }

    /** A body a client already holds as text, for the transports that never see the bytes. */
    public static RawHttpBody text(String text) {
        return text == null || text.isEmpty() ? none() : new RawHttpBody(text, null, null);
    }

    /**
     * A body as it went over the wire, read as text where it is text and kept as a file where it is not.
     *
     * <p>A provider that states no content type is taken at its word and decoded, most of them answering text; a NUL
     * in what comes out is what says it was not text after all.
     */
    public static RawHttpBody of(byte[] body, HttpHeaders headers) {
        if (body == null || body.length == 0) {
            return none();
        }

        var contentType = headers.getContentType();
        if (isText(contentType)) {
            var text = new String(body, charset(contentType));
            if (text.indexOf('\0') < 0) {
                return new RawHttpBody(text, null, null);
            }
        }
        return new RawHttpBody(note(body, contentType), body, typeName(contentType));
    }

    /** Whether this body was kept as a file, which is what a panel offers a download for. */
    public boolean isFile() {
        return bytes != null;
    }

    /** The same body with the recording client's secrets masked out of its text. A file's bytes are left as they are. */
    RawHttpBody masked(UnaryOperator<String> mask) {
        return new RawHttpBody(text == null ? null : mask.apply(text), bytes, contentType);
    }

    /** Whether a body of this type is worth keeping as text rather than as a file. */
    private static boolean isText(MediaType contentType) {
        if (contentType == null) {
            return true;
        }
        if ("text".equalsIgnoreCase(contentType.getType())) {
            return true;
        }
        var subtype = contentType.getSubtype().toLowerCase(Locale.ROOT);
        return subtype.equals("json")
                || subtype.equals("xml")
                || subtype.equals("javascript")
                || subtype.equals("x-www-form-urlencoded")
                || subtype.endsWith("+json")
                || subtype.endsWith("+xml");
    }

    private static String note(byte[] body, MediaType contentType) {
        return "[" + body.length + " bytes of "
                + (contentType == null ? "an unstated type" : typeName(contentType))
                + ", not text]";
    }

    /** The type without the parameters a provider hangs off it, which is what a download is served as. */
    private static String typeName(MediaType contentType) {
        return contentType == null ? null : new MediaType(contentType.getType(), contentType.getSubtype()).toString();
    }

    private static Charset charset(MediaType contentType) {
        var charset = contentType == null ? null : contentType.getCharset();
        return charset == null ? StandardCharsets.UTF_8 : charset;
    }
}
