module.exports = {

  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
      chromeWebSecurity: false
      defaultCommandTimeout: 15000
    },
  },
};
