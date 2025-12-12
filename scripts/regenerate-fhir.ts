#!/usr/bin/env bun
// Regenerate FHIR R4 type definitions from @atomic-ehr/codegen

import { APIBuilder } from "@atomic-ehr/codegen";

console.log("📦 Generating FHIR R4 Core Types...");

const builder = new APIBuilder()
  .throwException()
  .fromPackage("hl7.fhir.r4.core", "4.0.1")
  .typescript({
    withDebugComment: false,
    generateProfile: false,
    openResourceTypeSet: false,
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
