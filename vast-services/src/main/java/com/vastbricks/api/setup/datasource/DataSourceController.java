package com.vastbricks.api.setup.datasource;

import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The tenant-facing data sources screen, whatever the provider. A provider adds its own {@link DataSourceConfig}
 * implementation, not its own controller. */
@RestController
@RequestMapping(value = "/api/private/data-sources", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class DataSourceController {

    private final DataSourceService dataSourceService;

    @GetMapping
    List<DataSourceItem> listDataSources() {
        return dataSourceService.listDataSources();
    }

    @GetMapping("/{id}")
    DataSourceItem getDataSource(@PathVariable("id") Long id) {
        return dataSourceService.getDataSource(id);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    DataSourceItem createDataSource(@Valid @RequestBody DataSourceItem request) {
        return dataSourceService.createDataSource(request);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    DataSourceItem updateDataSource(@PathVariable("id") Long id, @Valid @RequestBody DataSourceItem request) {
        return dataSourceService.updateDataSource(id, request);
    }

    @DeleteMapping("/{id}")
    void deleteDataSource(@PathVariable("id") Long id) {
        dataSourceService.deleteDataSource(id);
    }

    @ExceptionHandler(DataSourceException.class)
    ProblemDetail handleDataSourceError(DataSourceException exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
        problem.setTitle("Invalid data source");
        return problem;
    }
}
