const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const Handlebars = require("handlebars");
const manifest = yaml.load(fs.readFileSync("assistants/manifest.yaml", "utf8"));
Handlebars.registerPartial(
  "shared",
  fs.readFileSync("assistants/templates/shared.md.hbs", "utf8"),
);
function render(tplPath, ctx) {
  const tpl = Handlebars.compile(fs.readFileSync(tplPath, "utf8"), {
    noEscape: true,
  });
  return tpl(ctx).trim() + "\n";
}
const base = { project: manifest.project };
for (const assist of manifest.assistants) {
  const tpl =
    assist.vendor === "anthropic"
      ? "assistants/templates/claude.md.hbs"
      : "assistants/templates/agents.md.hbs";
  const out = render(tpl, { ...base, assist });
  const outPath = assist.output_file;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, out, "utf8");
  console.log("Wrote", outPath);
}
