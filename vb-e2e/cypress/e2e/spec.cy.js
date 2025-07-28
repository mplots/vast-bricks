import 'cypress-iframe';

describe('Scrape LEGO sets and send to API', () => {

  it('fetches offers, scrapes products, and posts them', () => {
    const delay = Cypress._.random(1000, 7000);

    cy.wait(delay).then(() => {
      cy.request('http://localhost:6161/api/offers').then((response) => {
        const offers = response.body;

        // Cypress._.each handles async better than forEach here
        Cypress._.each(offers, (offer) => {
          const searchUrl = `https://www.salidzini.lv/cena?q=lego+${offer.setNumber}`;

          cy.visit(searchUrl);

          // Wait for content to load if needed
          cy.get('div.item_box_main', {timeout: 10000}).should('exist');

          const products = [];

          cy.get('div.item_box_main').each(($el) => {
            const name = $el.find('h2.item_name').text().trim();
            const priceText = $el.find('div.item_price').text();
            const price = parseFloat(priceText.replace(',', '.').replace(/[^\d.]/g, ''));

            const href = $el.find('a.item_link').attr('href');
            const link = href ? `https://www.salidzini.lv/${href}` : null;
            const image = $el.find('div.item_image img').attr('src');
            const shop = $el.find('div.item_shop_name').text()

            let store = null
            if ("1a.lv" === shop) {
              store = '_1A'
            } else if ("iizii.eu" === shop) {
              store = 'IIZII'
            } else if ("rdveikals.lv" === shop) {
              store = 'RD_ELECTRONIC'
            } else if ("digimart.lv" === shop) {
              store = 'DIGIMART'
            } else if ("maxtrade.lv" === shop) {
              store = 'MAXTRADE'
            } else if ("babycity.lv" === shop) {
              store = 'BABY_CITY'
            } else if ('labsveikals.lv' === shop) {
              store = 'LABS_VEIKALS'
            } else if ('m79.lv' === shop) {
              store = 'M79'
            } else if ('xsrotallietas.lv' === shop) {
              store = 'XS'
            } else if ('ksenukai.lv' === shop) {
              store = 'KSENUKAI'
            } else if ('220.lv' === shop) {
              store = '_220'
            } else if ('oreol.eu' === shop) {
              store = 'OREOL'
            } else if ('toysplanet.lv' === shop) {
              store = 'TOYS_PLANET'
            } else if ('balticguru.eu' === shop) {
              store = 'BALTIC_GURU'
            }

            if (store != null) {
              products.push({
                number: offer.setNumber,
                name,
                price,
                link,
                image,
                store
              });
            }
          }).then(() => {
            if (products.length) {
              cy.request('POST', 'http://localhost:6161/api/web-sets', products);
            } else {
              cy.log(`No products found for ${offer.setNumber}`);
            }
          });
        });
      });
    });
  });

});
