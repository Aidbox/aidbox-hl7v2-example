/**
 * Load test data into Aidbox
 * Creates 5 patients with related encounters, conditions, procedures, coverages, and accounts
 *
 * Run: bun scripts/load-test-data.ts
 */

import { putResource } from "../src/aidbox";
import type { Practitioner } from "../src/fhir/hl7-fhir-r4-core";

const testPatients = [
  {
    id: "patient-1",
    family: "Smith",
    given: ["John", "Robert"],
    gender: "male",
    birthDate: "1985-03-15",
    address: { line: ["123 Main Street"], city: "Anytown", state: "CA", postalCode: "90210" },
    phone: "555-123-4567",
    mrn: "MRN001",
  },
  {
    id: "patient-2",
    family: "Johnson",
    given: ["Emily", "Grace"],
    gender: "female",
    birthDate: "1990-07-22",
    address: { line: ["456 Oak Avenue"], city: "Springfield", state: "IL", postalCode: "62701" },
    phone: "555-234-5678",
    mrn: "MRN002",
  },
  {
    id: "patient-3",
    family: "Williams",
    given: ["Michael"],
    gender: "male",
    birthDate: "1978-11-08",
    address: { line: ["789 Pine Road"], city: "Austin", state: "TX", postalCode: "78701" },
    phone: "555-345-6789",
    mrn: "MRN003",
  },
  {
    id: "patient-4",
    family: "Brown",
    given: ["Sarah", "Anne"],
    gender: "female",
    birthDate: "1995-01-30",
    address: { line: ["321 Elm Street"], city: "Seattle", state: "WA", postalCode: "98101" },
    phone: "555-456-7890",
    mrn: "MRN004",
  },
  {
    id: "patient-5",
    family: "Davis",
    given: ["James", "William"],
    gender: "male",
    birthDate: "1962-09-12",
    address: { line: ["654 Maple Drive"], city: "Denver", state: "CO", postalCode: "80201" },
    phone: "555-567-8901",
    mrn: "MRN005",
  },
];

const conditions = [
  { code: "J18.9", display: "Pneumonia, unspecified organism", system: "http://hl7.org/fhir/sid/icd-10-cm" },
  { code: "I10", display: "Essential (primary) hypertension", system: "http://hl7.org/fhir/sid/icd-10-cm" },
  { code: "E11.9", display: "Type 2 diabetes mellitus without complications", system: "http://hl7.org/fhir/sid/icd-10-cm" },
  { code: "M54.5", display: "Low back pain", system: "http://hl7.org/fhir/sid/icd-10-cm" },
  { code: "J06.9", display: "Acute upper respiratory infection, unspecified", system: "http://hl7.org/fhir/sid/icd-10-cm" },
];

const procedures = [
  { code: "99213", display: "Office or other outpatient visit", system: "http://www.ama-assn.org/go/cpt" },
  { code: "36415", display: "Routine venipuncture", system: "http://www.ama-assn.org/go/cpt" },
  { code: "71046", display: "Chest X-ray, 2 views", system: "http://www.ama-assn.org/go/cpt" },
  { code: "80053", display: "Comprehensive metabolic panel", system: "http://www.ama-assn.org/go/cpt" },
  { code: "93000", display: "Electrocardiogram, routine", system: "http://www.ama-assn.org/go/cpt" },
];

const insurers = [
  { id: "org-bcbs", name: "Blue Cross Blue Shield", planCode: "BCBS" },
  { id: "org-aetna", name: "Aetna Health Insurance", planCode: "AETNA" },
  { id: "org-united", name: "UnitedHealthcare", planCode: "UHC" },
];

const practitioners = [
  { id: "practitioner-1", names: [{ family: "Chen", given: ["David", "Wei"]}], npi: "1234567890", specialty: "Internal Medicine"},
  { id: "practitioner-2", names: [{ family: "Patel", given: ["Priya"]}], npi: "2345678901", specialty: "Family Medicine"},
  { id: "practitioner-3", names: [{ family: "Rodriguez", given: ["Maria", "Elena"]}], npi: "3456789012", specialty: "Emergency Medicine"},
];

function formatDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split("T")[0] ?? "";
}

function formatDateTime(daysAgo: number, hour: number = 9): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

async function loadTestData() {
  console.log("Loading test data into Aidbox...\n");

  // Create Organizations (insurers)
  for (const insurer of insurers) {
    await putResource("Organization", insurer.id, {
      resourceType: "Organization",
      id: insurer.id,
      identifier: [{ system: "http://hospital.org/payer", value: insurer.planCode }],
      name: insurer.name,
      type: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/organization-type", code: "pay", display: "Payer" }] }],
    });
    console.log(`  Created Organization: ${insurer.name}`);
  }

  // Create Practitioners
  for (const pr of practitioners) {
    const displayName = `${pr.names[0]?.given?.[0] ?? ""} ${pr.names[0]?.family ?? ""}`.trim();
    await putResource("Practitioner", pr.id, {
      resourceType: "Practitioner",
      id: pr.id,
      identifier: [{ system: "http://hl7.org/fhir/sid/us-npi", value: pr.npi }],
      name: pr.names,
      qualification: [
        {
          code: {
            coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0360", code: "MD", display: "Doctor of Medicine" }],
            text: pr.specialty,
          },
        },
      ],
    } satisfies Practitioner);
    console.log(`  Created Practitioner: ${displayName} (${pr.specialty})`);
  }

  // Create Patients with related resources
  for (let i = 0; i < testPatients.length; i++) {
    const p = testPatients[i]!;
    const insurer = insurers[i % insurers.length]!;
    const condition = conditions[i]!;
    const procedure = procedures[i]!;
    const daysAgo = (i + 1) * 7; // Each patient visited 7, 14, 21, 28, 35 days ago

    // Patient
    await putResource("Patient", p.id, {
      resourceType: "Patient",
      id: p.id,
      identifier: [{ system: "http://hospital.org/mrn", value: p.mrn }],
      name: [{ family: p.family, given: p.given }],
      gender: p.gender,
      birthDate: p.birthDate,
      address: [{ ...p.address, country: "USA" }],
      telecom: [{ system: "phone", value: p.phone, use: "home" }],
    });
    console.log(`\nCreated Patient: ${p.given[0]} ${p.family} (${p.id})`);

    // Account
    const accountId = `account-${p.id}`;
    await putResource("Account", accountId, {
      resourceType: "Account",
      id: accountId,
      identifier: [{ system: "http://hospital.org/account", value: `ACC${String(i + 1).padStart(5, "0")}` }],
      status: "active",
      type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "PBILLACCT", display: "Patient Billing Account" }] },
      subject: [{ reference: `Patient/${p.id}` }],
      servicePeriod: {
        start: formatDate(daysAgo),
        end: formatDate(daysAgo - 1),
      },
      guarantor: [{ party: { reference: `Patient/${p.id}` } }],
    });
    console.log(`  Created Account: ${accountId}`);

    // Encounter
    const encounterId = `encounter-${p.id}`;
    await putResource("Encounter", encounterId, {
      resourceType: "Encounter",
      id: encounterId,
      identifier: [{ system: "http://hospital.org/encounter", value: `ENC${String(i + 1).padStart(5, "0")}` }],
      status: "finished",
      class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "ambulatory" },
      type: [{ coding: [{ system: "http://snomed.info/sct", code: "308335008", display: "Patient encounter procedure" }] }],
      subject: { reference: `Patient/${p.id}` },
      period: {
        start: formatDateTime(daysAgo, 9),
        end: formatDateTime(daysAgo, 10),
      },
      account: [{ reference: `Account/${accountId}` }],
      location: [{ location: { display: "Outpatient Clinic" } }],
    });
    console.log(`  Created Encounter: ${encounterId}`);

    // Condition
    const conditionId = `condition-${p.id}`;
    await putResource("Condition", conditionId, {
      resourceType: "Condition",
      id: conditionId,
      clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
      verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed" }] },
      category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-category", code: "encounter-diagnosis" }] }],
      code: { coding: [{ system: condition.system, code: condition.code, display: condition.display }] },
      subject: { reference: `Patient/${p.id}` },
      encounter: { reference: `Encounter/${encounterId}` },
      recordedDate: formatDate(daysAgo),
    });
    console.log(`  Created Condition: ${condition.display}`);

    // Procedure
    const procedureId = `procedure-${p.id}`;
    await putResource("Procedure", procedureId, {
      resourceType: "Procedure",
      id: procedureId,
      status: "completed",
      code: { coding: [{ system: procedure.system, code: procedure.code, display: procedure.display }] },
      subject: { reference: `Patient/${p.id}` },
      encounter: { reference: `Encounter/${encounterId}` },
      performedDateTime: formatDateTime(daysAgo, 9),
    });
    console.log(`  Created Procedure: ${procedure.display}`);

    // Coverage
    const coverageId = `coverage-${p.id}`;
    await putResource("Coverage", coverageId, {
      resourceType: "Coverage",
      id: coverageId,
      identifier: [{ system: "http://hospital.org/coverage", value: `COV${String(i + 1).padStart(5, "0")}` }],
      status: "active",
      type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "HIP", display: "Health Insurance Plan Policy" }] },
      subscriber: { reference: `Patient/${p.id}` },
      subscriberId: `SUB${String(i + 1).padStart(6, "0")}`,
      beneficiary: { reference: `Patient/${p.id}` },
      relationship: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/subscriber-relationship", code: "self" }] },
      period: {
        start: formatDate(365),
        end: formatDate(-365),
      },
      payor: [{ reference: `Organization/${insurer.id}`, display: insurer.name }],
      class: [
        {
          type: { coding: [{ code: "group" }] },
          value: `GRP${String(i + 1).padStart(3, "0")}`,
          name: "Corporate Group Plan",
        },
      ],
      order: 1,
    });
    console.log(`  Created Coverage: ${insurer.name}`);
  }

  console.log("\n✓ Test data loaded successfully!");
  console.log(`  - ${insurers.length} Organizations (insurers)`);
  console.log(`  - ${practitioners.length} Practitioners`);
  console.log(`  - ${testPatients.length} Patients`);
  console.log(`  - ${testPatients.length} Accounts`);
  console.log(`  - ${testPatients.length} Encounters`);
  console.log(`  - ${testPatients.length} Conditions`);
  console.log(`  - ${testPatients.length} Procedures`);
  console.log(`  - ${testPatients.length} Coverages`);
}

loadTestData().catch((err) => {
  console.error("Error loading test data:", err);
  process.exit(1);
});
