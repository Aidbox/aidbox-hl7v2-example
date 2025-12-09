import { putResource } from "./aidbox";

const outgoingBarMessageSD = {
  resourceType: "StructureDefinition",
  id: "OutgoingBarMessage",
  url: "http://example.org/StructureDefinition/OutgoingBarMessage",
  name: "OutgoingBarMessage",
  type: "OutgoingBarMessage",
  status: "active",
  kind: "resource",
  abstract: false,
  baseDefinition: "http://hl7.org/fhir/StructureDefinition/DomainResource",
  derivation: "specialization",
  differential: {
    element: [
      {
        id: "OutgoingBarMessage",
        path: "OutgoingBarMessage",
        min: 0,
        max: "*",
      },
      {
        id: "OutgoingBarMessage.patient",
        path: "OutgoingBarMessage.patient",
        min: 1,
        max: "1",
        type: [
          {
            code: "Reference",
            targetProfile: ["http://hl7.org/fhir/StructureDefinition/Patient"],
          },
        ],
      },
      {
        id: "OutgoingBarMessage.invoice",
        path: "OutgoingBarMessage.invoice",
        min: 1,
        max: "1",
        type: [
          {
            code: "Reference",
            targetProfile: ["http://hl7.org/fhir/StructureDefinition/Invoice"],
          },
        ],
      },
      {
        id: "OutgoingBarMessage.status",
        path: "OutgoingBarMessage.status",
        min: 1,
        max: "1",
        type: [{ code: "string" }],
      },
      {
        id: "OutgoingBarMessage.hl7v2",
        path: "OutgoingBarMessage.hl7v2",
        min: 0,
        max: "1",
        type: [{ code: "string" }],
      },
    ],
  },
};

const incomingHL7v2MessageSD = {
  resourceType: "StructureDefinition",
  id: "IncomingHL7v2Message",
  url: "http://example.org/StructureDefinition/IncomingHL7v2Message",
  name: "IncomingHL7v2Message",
  type: "IncomingHL7v2Message",
  status: "active",
  kind: "resource",
  abstract: false,
  baseDefinition: "http://hl7.org/fhir/StructureDefinition/DomainResource",
  derivation: "specialization",
  differential: {
    element: [
      {
        id: "IncomingHL7v2Message",
        path: "IncomingHL7v2Message",
        min: 0,
        max: "*",
      },
      {
        id: "IncomingHL7v2Message.type",
        path: "IncomingHL7v2Message.type",
        min: 1,
        max: "1",
        type: [{ code: "string" }],
      },
      {
        id: "IncomingHL7v2Message.date",
        path: "IncomingHL7v2Message.date",
        min: 0,
        max: "1",
        type: [{ code: "dateTime" }],
      },
      {
        id: "IncomingHL7v2Message.patient",
        path: "IncomingHL7v2Message.patient",
        min: 0,
        max: "1",
        type: [
          {
            code: "Reference",
            targetProfile: ["http://hl7.org/fhir/StructureDefinition/Patient"],
          },
        ],
      },
      {
        id: "IncomingHL7v2Message.message",
        path: "IncomingHL7v2Message.message",
        min: 1,
        max: "1",
        type: [{ code: "string" }],
      },
    ],
  },
};

async function migrate() {
  console.log("Creating OutgoingBarMessage StructureDefinition...");
  await putResource("StructureDefinition", "OutgoingBarMessage", outgoingBarMessageSD);
  console.log("  Done.");

  console.log("Creating IncomingHL7v2Message StructureDefinition...");
  await putResource("StructureDefinition", "IncomingHL7v2Message", incomingHL7v2MessageSD);
  console.log("  Done.");

  console.log("\nMigration complete.");
}

migrate().catch(console.error);
