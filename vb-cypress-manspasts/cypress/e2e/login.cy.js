describe("manspasts.lv login", () => {
  it("logs in with credentials from .env", () => {
    const email = Cypress.env("MANS_PASTS_EMAIL");
    const password = Cypress.env("MANS_PASTS_PASSWORD");

    expect(email, "email env var").to.be.a("string").and.not.be.empty;
    expect(password, "password env var").to.be.a("string").and.not.be.empty;

    cy.visit("/lv/login");

    const emailSelector =
      'input[type="email"], input[name*="mail" i], input[placeholder*="E-pasts" i]';
    cy.get(emailSelector).first().should("be.visible");
    cy.get(emailSelector).first().should("not.be.disabled");
    cy.get(emailSelector).first().clear({ force: true }).type(email, { force: true });

    const passwordSelector =
      'input[type="password"], input[name*="pass" i], input[placeholder*="Parole" i]';
    cy.get(passwordSelector).first().should("be.visible");
    cy.get(passwordSelector).first().should("not.be.disabled");
    cy.get(passwordSelector)
      .first()
      .clear({ force: true })
      .type(password, { log: false, force: true });

    cy.contains("button, input[type=submit]", "Pieslēgties").click();

    cy.url().should("not.include", "/lv/login");

    cy.visit("/lv/order/new-order");
    cy.url().should("include", "/lv/order/new-order");

    const mode = Cypress.env("MODE");
    expect(mode, "MODE env var").to.be.a("string").and.not.be.empty;

    const shipmentTypeValue = mode === "TRACEABLE" ? "T" : "V";
    const countryCode = Cypress.env("COUNTRY_CODE");
    const address1 = Cypress.env("ADDRESS1");
    const address2 = Cypress.env("ADDRESS2");
    const postcode = Cypress.env("POSTCODE");
    const fullName = Cypress.env("FULL_NAME");
    const telephone = Cypress.env("TELEPHONE");
    const contactEmail = Cypress.env("EMAIL");
    const weightGrams = Cypress.env("WEIGHT");
    const quantity = Cypress.env("QUANTITY");
    const packValue = Cypress.env("PACK_VALUE");
    const etc1 = Cypress.env("ETC1");
    const etc2 = Cypress.env("ETC2");
    const shippingCost = Cypress.env("SHIPPING");

    expect(countryCode, "COUNTRY_CODE env var")
        .to.be.a("string")
        .and.not.be.empty;
    expect(address1, "ADDRESS1 env var").to.be.a("string").and.not.be.empty;
    expect(address2, "ADDRESS2 env var").to.be.a("string").and.not.be.empty;
    expect(postcode, "POSTCODE env var").to.be.a("string").and.not.be.empty;
    expect(fullName, "FULL_NAME env var").to.be.a("string").and.not.be.empty;
    expect(telephone, "TELEPHONE env var").to.be.a("string");
    expect(contactEmail, "EMAIL env var").to.be.a("string");
    expect(weightGrams, "WEIGHT env var").to.be.a("string").and.not.be.empty;
    expect(quantity, "QUANTITY env var").to.be.a("string").and.not.be.empty;
    expect(packValue, "PACK_VALUE env var").to.be.a("string").and.not.be.empty;
    expect(etc1, "ETC1 env var").to.be.a("string");
    expect(etc2, "ETC2 env var").to.be.a("string");
    expect(shippingCost, "SHIPPING env var").to.be.a("string");

    const capturePricingMeta = () => {
      cy.get(".pricingField", { timeout: 15000 })
        .first()
        .should("be.visible")
        .invoke("text")
        .then((priceText) => {
          const price = String(priceText || "").trim();
          if (!price) {
            cy.wait(1000);
            return capturePricingMeta();
          }
          cy.get("#delivery_days_0", { timeout: 15000 })
            .should("be.visible")
            .invoke("text")
            .then((daysText) => {
              const deliveryDays = String(daysText || "").trim();
              cy.task("writeMeta", { price, deliveryDays });
            });
        });
    };

    cy.get("select#order_type_form_shipmentName")
        .should("be.visible")
        .select("KP");

    cy.get("select#order_type_form_shipmentType")
        .should("be.visible")
        .select(shipmentTypeValue, { force: true })
        .should("have.value", shipmentTypeValue);

    cy.get('input[type="submit"][value="N\u0101kamais solis"]')
        .should("be.visible")
        .click();

    cy.get('label[for="order_registered_recipient_form_newAddress_type_1"]')
        .should("be.visible")
        .click();

    cy.get("#order_registered_recipient_form_newAddress_type_1").should(
        "be.checked"
    );

    cy.get("#order_registered_recipient_form_userInfo_fullName", {
      timeout: 15000,
    }).should("be.visible");
    cy.get("#order_registered_recipient_form_userInfo_fullName").clear({
      force: true,
    });
    cy.get("#order_registered_recipient_form_userInfo_fullName").type(fullName, {
      force: true,
    });


    if (telephone) {
      cy.get("#order_registered_recipient_form_userInfo_telephone", {
        timeout: 15000,
      }).should("be.visible");
      cy.get("#order_registered_recipient_form_userInfo_telephone").clear({
        force: true,
      });
      cy.get("#order_registered_recipient_form_userInfo_telephone").type(
        telephone,
        { force: true }
      );
    }


    if (contactEmail) {
      cy.get("#order_registered_recipient_form_userInfo_email", {
        timeout: 15000,
      }).should("be.visible");
      cy.get("#order_registered_recipient_form_userInfo_email").clear({
        force: true,
      });
      cy.get("#order_registered_recipient_form_userInfo_email").type(
        contactEmail,
        { force: true }
      );
    }


    const countrySelect =
        "select#order_registered_recipient_form_newAddress_simpleAddress_country";

    cy.get(countrySelect, { timeout: 15000 })
        .should("be.visible")
        .then(($select) => {
          cy.wrap($select)
              .select(countryCode, { force: true })
              .should("have.value", countryCode);
        });

    cy.get(
        "#order_registered_recipient_form_newAddress_simpleAddress_address1"
    )
        .should("be.visible")
        .clear()
        .type(address1);

    cy.get(
        "#order_registered_recipient_form_newAddress_simpleAddress_address2"
    )
        .should("be.visible")
        .clear()
        .type(address2);

    cy.get(
        "#order_registered_recipient_form_newAddress_simpleAddress_postcode"
    )
        .should("be.visible")
        .clear()
        .type(postcode);

    cy.contains('button[type="submit"]', "Pievienot adresi")
      .should("be.visible")
      .click();

    const packageTypeSelector = "#order_packages_orderRecipients_0_packageType";
    const fillPackageDetails = () => {
      const weightKg = (Number(weightGrams) / 1000).toFixed(3).replace(",", ".");
      cy.wrap(true).as("hasPackageType");

      cy.get(packageTypeSelector)
        .should("be.visible")
        .select("31");

      cy.get("#order_packages_orderRecipients_0_packages_0_contentName")
        .should("be.visible")
        .should("not.be.disabled")
        .clear()
        .type("Lego Set");

      cy.get("#order_packages_orderRecipients_0_packages_0_quantity")
        .should("be.visible")
        .should("not.be.disabled")
        .clear()
        .type("1");

      cy.get('input[name="order_packages[orderRecipients][0][packages][0][weight]"]')
        .should("be.visible")
        .should("not.be.disabled")
        .clear()
        .type(weightKg);

      cy.get('input[name="order_packages[orderRecipients][0][packages][0][hsCodeText]"]')
        .should("be.visible")
        .should("not.be.disabled")
        .clear()
        .type("950300");

      cy.get("#order_packages_orderRecipients_0_packages_0_packValue")
        .should("be.visible")
        .should("not.be.disabled")
        .clear()
        .type(packValue);

      cy.get('select[name="order_packages[orderRecipients][0][packages][0][countryCode]"]')
        .should("be.visible")
        .select("DK");

      const postagePaid = (
        Number(shippingCost || 0) +
        Number(etc1 || 0) +
        Number(etc2 || 0)
      )
        .toFixed(2)
        .replace(",", ".");

      cy.get("#order_packages_orderRecipients_0_postagePaid")
        .should("be.visible")
        .should("not.be.disabled")
        .clear()
        .type(postagePaid);
    };

    cy.get("#step3_next", { timeout: 15000 })
      .should("be.visible")
      .click();

    const waitForPackageType = (retries = 10) => {
      cy.get("body").then(($body) => {
      if ($body.find(packageTypeSelector).length) {
        fillPackageDetails();
        capturePricingMeta();
        return;
      }
      if (retries <= 0) {
        cy.wrap(false).as("hasPackageType");
        return;
      }
        cy.wait(1000);
        waitForPackageType(retries - 1);
      });
    };

    waitForPackageType();

    const weightKg = (Number(weightGrams) / 1000).toFixed(3).replace(",", ".");

    cy.get("@hasPackageType").then((hasPackageType) => {
      if (!hasPackageType) {
        cy.get("#order_packages_orderRecipients_0_userPackageWeight", {
          timeout: 15000,
        })
          .should("be.visible")
          .clear({ force: true })
          .type(weightKg, { force: true })
          .blur();
        capturePricingMeta();
      }
    });

    cy.get("#Prepare_documents_orginal", { timeout: 15000 })
      .should("be.visible")
      .click();

    cy.get("button.step-5-btn", { timeout: 20000 })
      .contains("IZDRUKĀT VEIDLAPAS")
      .should("be.visible")
      .click();

    cy.task("waitForDownload", { timeoutMs: 30000 });
  });
});
