const fs = require("fs");
const yaml = require("js-yaml");
const Ajv2020 = require("ajv/dist/2020"); // <-- Ajv with 2020-12 support
const addFormats = require("ajv-formats");

const schema = JSON.parse(fs.readFileSync("assistants/schema.json", "utf8"));
const manifest = yaml.load(fs.readFileSync("assistants/manifest.yaml", "utf8"));

const ajv = new Ajv2020({ allErrors: true }); // no need to add meta-schema manually
addFormats(ajv);

const validate = ajv.compile(schema);

if (!validate(manifest)) {
  console.error("Manifest validation failed:\n", validate.errors);
  process.exit(1);
}
console.log("Manifest OK");
