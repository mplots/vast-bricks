package com.vastbricks.bsx;

import com.fasterxml.jackson.dataformat.xml.XmlFactory;
import com.fasterxml.jackson.dataformat.xml.XmlMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.xml.stream.XMLInputFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

@Component
@Slf4j
public class BsxParser {

    private final XmlMapper xmlMapper;

    public BsxParser() {
        XMLInputFactory inputFactory = XMLInputFactory.newFactory();
        inputFactory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        inputFactory.setProperty("javax.xml.stream.isSupportingExternalEntities", false);
        XmlFactory factory = new XmlFactory(inputFactory);
        this.xmlMapper = new XmlMapper(factory);
    }

    public Optional<BrickStoreXml> parse(Path path) {
        try (var input = Files.newInputStream(path)) {
            return Optional.of(xmlMapper.readValue(input, BrickStoreXml.class));
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            return Optional.empty();
        }
    }
}
