package com.vastbricks.api.invoice;

import com.vastbricks.api.settings.DatabaseBackedSettings;
import com.vastbricks.api.settings.VastSetting;
import lombok.Getter;
import org.springframework.stereotype.Component;

/**
 * Which Manakabata number series and bank account generated invoices are issued under. This is a decision about the
 * invoices this feature writes rather than about reaching the API, so it is owned here and not by the client.
 */
@Component
@Getter
class InvoiceSettings extends DatabaseBackedSettings {

    @VastSetting(env = "VAST_MANAKABATA_INVOICE_NUMERATOR_UUID", databaseOverride = true)
    private String invoiceNumeratorUuid = "9e6394be-33e6-4736-88bc-0de2cc550fad";

    @VastSetting(env = "VAST_MANAKABATA_TEAM_BANK_ACCOUNT_UUID", databaseOverride = true)
    private String teamBankAccountUuid = "b96e3a87-7839-4bbe-82de-c19474a76d8e";
}
