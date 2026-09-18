/** @type {import('@rtk-query/codegen-openapi').ConfigFile} */
module.exports = {
  schemaFile: "./openapi.json",
  apiFile: "./src/store/emptyApi.ts",
  apiImport: "emptySplitApi",
  outputFile: "./src/store/generatedApi.ts",
  exportName: "generatedProxyApi",
  hooks: true,
  tag: true,
};
