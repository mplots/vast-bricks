const { defineConfig } = require("cypress");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

module.exports = defineConfig({
  e2e: {
    projectId: "xe81gt",
    baseUrl: "https://www.manspasts.lv",
    watchForFileChanges: false,
    env: {
      MANS_PASTS_EMAIL: process.env.MANS_PASTS_EMAIL,
      MANS_PASTS_PASSWORD: process.env.MANS_PASTS_PASSWORD,
      MODE: process.env.MODE,
      FULL_NAME: process.env.FULL_NAME,
      TELEPHONE: process.env.TELEPHONE,
      EMAIL: process.env.EMAIL,
      ADDRESS1: process.env.ADDRESS1,
      ADDRESS2: process.env.ADDRESS2,
      STATE: process.env.STATE,
      COUNTRY_CODE: process.env.COUNTRY_CODE,
      POSTCODE: process.env.POSTCODE,
      WEIGHT: process.env.WEIGHT,
      PACK_VALUE: process.env.PACK_VALUE,
      QUANTITY: process.env.QUANTITY,
      ETC1: process.env.ETC1,
      ETC2: process.env.ETC2,
      SHIPPING: process.env.SHIPPING,
    },
    setupNodeEvents(on, config) {
      on("task", {
        waitForDownload({ timeoutMs = 30000 } = {}) {
          const downloadsDir = config.downloadsFolder;
          const start = Date.now();

          return new Promise((resolve, reject) => {
            const check = () => {
              try {
                const files = fs
                  .readdirSync(downloadsDir)
                  .filter((file) => file.toLowerCase().endsWith(".pdf"));
                if (files.length > 0) {
                  return resolve(path.join(downloadsDir, files[0]));
                }
              } catch (err) {
                return reject(err);
              }

              if (Date.now() - start > timeoutMs) {
                return reject(new Error("PDF download not found"));
              }
              setTimeout(check, 500);
            };

            check();
          });
        },
        writeMeta(meta) {
          const metaPath = path.join(config.downloadsFolder, "meta.json");
          fs.writeFileSync(metaPath, JSON.stringify(meta), "utf8");
          return null;
        },
      });
      return config;
    },
  },
});
