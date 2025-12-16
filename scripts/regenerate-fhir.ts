#!/usr/bin/env bun
// Regenerate FHIR R4 type definitions from @atomic-ehr/codegen

import { APIBuilder } from "@atomic-ehr/codegen";

console.log("📦 Generating FHIR R4 Core Types...");

const builder = new APIBuilder()
  .throwException()
  .fromPackage("hl7.fhir.r4.core", "4.0.1")
  .localStructureDefinitions({
    package: { name: "aidbox.hl7v2.custom", version: "0.0.1" },
    path: "./fhir",
    dependencies: [{ name: "hl7.fhir.r4.core", version: "4.0.1" }],
  })
  .typescript({
    withDebugComment: false,
    generateProfile: false,
    primitiveTypeExtension: false,
    openResourceTypeSet: false,
  })
  .treeShake({
    "hl7.fhir.r4.core": {
      "http://hl7.org/fhir/StructureDefinition/Account": {},
      "http://hl7.org/fhir/StructureDefinition/ChargeItem": {},
      "http://hl7.org/fhir/StructureDefinition/Condition": {},
      "http://hl7.org/fhir/StructureDefinition/Coverage": {},
      "http://hl7.org/fhir/StructureDefinition/Encounter": {},
      "http://hl7.org/fhir/StructureDefinition/Invoice": {},
      "http://hl7.org/fhir/StructureDefinition/Organization": {},
      "http://hl7.org/fhir/StructureDefinition/Patient": {},
      "http://hl7.org/fhir/StructureDefinition/Practitioner": {},
      "http://hl7.org/fhir/StructureDefinition/Procedure": {},
      "http://hl7.org/fhir/StructureDefinition/RelatedPerson": {},
    },
    "aidbox.hl7v2.custom": {
      "http://example.org/StructureDefinition/IncomingHL7v2Message": {},
      "http://example.org/StructureDefinition/OutgoingBarMessage": {},
    },
  })
  .outputTo("./src/fhir")
  .cleanOutput(true);

const report = await builder.generate();

console.log(report);

if (report.success) {
  console.log("✅ FHIR R4 types generated successfully!");
} else {
  console.error("❌ FHIR R4 types generation failed.");
  process.exit(1);
}
