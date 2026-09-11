package com.vastbricks.api.setup.datasource;

import com.vastbricks.api.setup.SetupEncryption;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creating, reading, updating, listing and deleting a data source - whatever its provider. This service never
 * inspects a provider's own fields: {@link DataSourceConfig} does its own encrypting and its own masking, so a new
 * provider only ever means a new {@link DataSourceConfig} implementation, never a change here.
 */
@Service
@RequiredArgsConstructor
class DataSourceService {

    private final DataSourceRepository dataSourceRepository;
    private final SetupEncryption settingsEncryption;

    List<DataSourceItem> listDataSources() {
        return dataSourceRepository.findAllByOrderByNameAsc().stream().map(this::toItem).toList();
    }

    DataSourceItem getDataSource(Long id) {
        return toItem(find(id));
    }

    @Transactional
    DataSourceItem createDataSource(DataSourceItem request) {
        if (dataSourceRepository.findByNameIgnoreCase(request.getName()).isPresent()) {
            throw new DataSourceException("A data source named '" + request.getName() + "' already exists.");
        }

        DataSourceConfig stored = request.getConfig().prepareForStorage(settingsEncryption, null);
        DataSource dataSource = new DataSource(request.getName(), stored.provider(), stored);
        dataSource.setEnabled(request.isEnabled());
        return toItem(dataSourceRepository.save(dataSource));
    }

    @Transactional
    DataSourceItem updateDataSource(Long id, DataSourceItem request) {
        DataSource dataSource = find(id);
        if (request.getConfig().provider() != dataSource.getProvider()) {
            throw new DataSourceException("Data source " + id + " is a " + dataSource.getProvider() + " data source.");
        }

        dataSource.setName(request.getName());
        dataSource.setEnabled(request.isEnabled());
        dataSource.setConfig(request.getConfig().prepareForStorage(settingsEncryption, dataSource.getConfig()));
        return toItem(dataSourceRepository.save(dataSource));
    }

    @Transactional
    void deleteDataSource(Long id) {
        dataSourceRepository.deleteById(id);
    }

    private DataSource find(Long id) {
        return dataSourceRepository.findById(id)
                .orElseThrow(() -> new DataSourceException("No data source with id " + id + "."));
    }

    private DataSourceItem toItem(DataSource dataSource) {
        DataSourceItem item = new DataSourceItem();
        item.setId(dataSource.getId());
        item.setName(dataSource.getName());
        item.setProvider(dataSource.getProvider());
        item.setEnabled(dataSource.isEnabled());
        item.setConfig(dataSource.getConfig().forView(settingsEncryption));
        return item;
    }
}
