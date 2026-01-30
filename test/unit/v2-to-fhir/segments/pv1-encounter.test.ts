import { describe, test, expect } from "bun:test";
import {
  buildEncounterFromPV1,
  mapPatientClassToFHIRWithResult,
  extractPatientClass,
} from "../../../../src/v2-to-fhir/segments/pv1-encounter";
import type { PV1 } from "../../../../src/hl7v2/generated/fields";
import type { Coding, Encounter } from "../../../../src/fhir/hl7-fhir-r4-core";

// Helper to build encounter with class resolved via mapPatientClassToFHIRWithResult
function buildEncounterWithClassResolution(pv1: PV1): Encounter {
  const classCode = extractPatientClass(pv1);
  const hasDischarge = !!(pv1.$45_discharge?.[0]);
  const classResult = mapPatientClassToFHIRWithResult(classCode, hasDischarge);

  if (classResult.error) {
    throw new Error(`Unexpected class mapping error for ${classCode}`);
  }

  return buildEncounterFromPV1(pv1, classResult.class, classResult.status);
}

// Standard FHIR class for tests that don't care about class
const DEFAULT_CLASS: Coding = {
  system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
  code: "IMP",
  display: "inpatient encounter",
};

describe("buildEncounterFromPV1", () => {
  describe("basic structure", () => {
    test("creates Encounter with provided class and status", () => {
      const pv1: PV1 = { $2_class: "I" };
      const encounterClass: Coding = {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "EMER",
        display: "emergency",
      };

      const encounter = buildEncounterFromPV1(pv1, encounterClass, "in-progress");

      expect(encounter.resourceType).toBe("Encounter");
      expect(encounter.class.code).toBe("EMER");
      expect(encounter.class.display).toBe("emergency");
      expect(encounter.status).toBe("in-progress");
    });

    test("accepts any valid status", () => {
      const pv1: PV1 = { $2_class: "I" };

      const finished = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "finished");
      const planned = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "planned");
      const unknown = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "unknown");

      expect(finished.status).toBe("finished");
      expect(planned.status).toBe("planned");
      expect(unknown.status).toBe("unknown");
    });
  });

  describe("class and status via mapPatientClassToFHIRWithResult", () => {
    test("converts PV1-2 Patient Class E to EMER", () => {
      const pv1: PV1 = { $2_class: "E" };

      const encounter = buildEncounterWithClassResolution(pv1);

      expect(encounter.class.code).toBe("EMER");
      expect(encounter.class.display).toBe("emergency");
      expect(encounter.class.system).toBe("http://terminology.hl7.org/CodeSystem/v3-ActCode");
    });

    test("converts PV1-2 Patient Class I to IMP", () => {
      const pv1: PV1 = { $2_class: "I" };

      const encounter = buildEncounterWithClassResolution(pv1);

      expect(encounter.class.code).toBe("IMP");
      expect(encounter.class.display).toBe("inpatient encounter");
    });

    test("converts PV1-2 Patient Class O to AMB", () => {
      const pv1: PV1 = { $2_class: "O" };

      const encounter = buildEncounterWithClassResolution(pv1);

      expect(encounter.class.code).toBe("AMB");
      expect(encounter.class.display).toBe("ambulatory");
    });

    test("converts PV1-2 Patient Class P to PRENC with planned status", () => {
      const pv1: PV1 = { $2_class: "P" };

      const encounter = buildEncounterWithClassResolution(pv1);

      expect(encounter.class.code).toBe("PRENC");
      expect(encounter.class.display).toBe("pre-admission");
      expect(encounter.status).toBe("planned");
    });

    test("sets status to finished when PV1-45 is valued", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $45_discharge: ["202312151430"],
      };

      const encounter = buildEncounterWithClassResolution(pv1);

      expect(encounter.status).toBe("finished");
    });

    test("derives status from class when PV1-45 not valued", () => {
      const pv1: PV1 = { $2_class: "I" };

      const encounter = buildEncounterWithClassResolution(pv1);

      expect(encounter.status).toBe("in-progress");
    });
  });

  describe("identifiers", () => {
    test("converts PV1-19 Visit Number with type VN", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $19_visitNumber: {
          $1_value: "V12345",
          $4_system: { $1_namespace: "HOSPITAL" },
        },
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.identifier).toHaveLength(1);
      expect(encounter.identifier![0]!.value).toBe("V12345");
      expect(encounter.identifier![0]!.type?.coding?.[0]?.code).toBe("VN");
      expect(encounter.identifier![0]!.type?.text).toBe("visit number");
    });

    test("converts PV1-50 Alternate Visit ID", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $50_alternateVisitId: {
          $1_value: "ALT123",
        },
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.identifier).toHaveLength(1);
      expect(encounter.identifier![0]!.value).toBe("ALT123");
    });
  });

  describe("type and service", () => {
    test("converts PV1-4 Admission Type", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $4_admissionType: "E",
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.type).toHaveLength(1);
      expect(encounter.type![0]!.coding?.[0]?.code).toBe("E");
    });

    test("converts PV1-10 Hospital Service", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $10_hospitalService: "MED",
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.serviceType?.coding?.[0]?.code).toBe("MED");
    });
  });

  describe("period", () => {
    test("converts PV1-44 Admit Date/Time to period.start", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $44_admission: "202312011000",
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.period?.start).toBe("2023-12-01T10:00:00Z");
    });

    test("converts PV1-45 Discharge Date/Time to period.end", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $44_admission: "202312011000",
        $45_discharge: ["202312051430"],
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "finished");

      expect(encounter.period?.start).toBe("2023-12-01T10:00:00Z");
      expect(encounter.period?.end).toBe("2023-12-05T14:30:00Z");
    });
  });

  describe("participants", () => {
    test("converts PV1-7 Attending Doctor with type ATND", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $7_attendingDoctor: [
          {
            $1_value: "DOC001",
            $2_family: { $1_family: "Smith" },
            $3_given: "John",
          },
        ],
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.participant).toHaveLength(1);
      expect(encounter.participant![0]!.type![0]?.coding?.[0]?.code).toBe("ATND");
      expect(encounter.participant![0]!.type![0]?.coding?.[0]?.display).toBe("attender");
      expect(encounter.participant![0]!.individual?.display).toBe("John Smith");
    });

    test("converts PV1-8 Referring Doctor with type REF", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $8_referringDoctor: [
          {
            $1_value: "DOC002",
            $2_family: { $1_family: "Jones" },
            $3_given: "Mary",
          },
        ],
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.participant).toHaveLength(1);
      expect(encounter.participant![0]!.type![0]?.coding?.[0]?.code).toBe("REF");
      expect(encounter.participant![0]!.type![0]?.text).toBe("referrer");
    });

    test("converts PV1-9 Consulting Doctor with type CON", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $9_consultingDoctor: [
          {
            $1_value: "DOC003",
            $2_family: { $1_family: "Brown" },
          },
        ],
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.participant).toHaveLength(1);
      expect(encounter.participant![0]!.type![0]?.coding?.[0]?.code).toBe("CON");
      expect(encounter.participant![0]!.type![0]?.text).toBe("consultant");
    });

    test("converts PV1-17 Admitting Doctor with type ADM", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $17_admittingDoctor: [
          {
            $1_value: "DOC004",
            $2_family: { $1_family: "Wilson" },
          },
        ],
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.participant).toHaveLength(1);
      expect(encounter.participant![0]!.type![0]?.coding?.[0]?.code).toBe("ADM");
      expect(encounter.participant![0]!.type![0]?.text).toBe("admitter");
    });

    test("includes multiple participants from different roles", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $7_attendingDoctor: [{ $1_value: "DOC001", $2_family: { $1_family: "Attending" } }],
        $8_referringDoctor: [{ $1_value: "DOC002", $2_family: { $1_family: "Referring" } }],
        $17_admittingDoctor: [{ $1_value: "DOC003", $2_family: { $1_family: "Admitting" } }],
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.participant).toHaveLength(3);
    });
  });

  describe("locations", () => {
    test("converts PV1-3 Assigned Patient Location with status active for non-PRENC class", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $3_assignedPatientLocation: {
          $1_careSite: "ICU",
          $2_room: "101",
          $3_bed: "A",
        },
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.location).toHaveLength(1);
      expect(encounter.location![0]!.status).toBe("active");
      expect(encounter.location![0]!.location.display).toContain("A");
    });

    test("converts PV1-3 with PRENC class to location status planned", () => {
      const pv1: PV1 = {
        $2_class: "P",
        $3_assignedPatientLocation: {
          $1_careSite: "PreAdmit",
        },
      };
      const prencClass: Coding = {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "PRENC",
        display: "pre-admission",
      };

      const encounter = buildEncounterFromPV1(pv1, prencClass, "planned");

      expect(encounter.location![0]!.status).toBe("planned");
    });

    test("converts PV1-6 Prior Patient Location with status completed", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $6_priorPatientLocation: {
          $1_careSite: "ER",
          $2_room: "200",
        },
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.location).toHaveLength(1);
      expect(encounter.location![0]!.status).toBe("completed");
    });

    test("converts PV1-11 Temporary Location with status active and extension", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $11_temporaryLocation: {
          $1_careSite: "OR",
          $2_room: "OR1",
        },
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.location).toHaveLength(1);
      expect(encounter.location![0]!.status).toBe("active");
      const ext = (encounter.location![0] as unknown as { extension: { url: string }[] }).extension;
      expect(ext?.[0]?.url).toBe("http://hl7.org/fhir/StructureDefinition/subject-locationClassification");
    });

    test("converts PV1-42 Pending Location with status reserved", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $42_pendingLocation: {
          $1_careSite: "Ward3",
          $2_room: "301",
        },
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.location).toHaveLength(1);
      expect(encounter.location![0]!.status).toBe("reserved");
    });

    test("includes multiple locations", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $3_assignedPatientLocation: { $1_careSite: "Current" },
        $6_priorPatientLocation: { $1_careSite: "Prior" },
        $42_pendingLocation: { $1_careSite: "Pending" },
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.location).toHaveLength(3);
    });
  });

  describe("hospitalization", () => {
    test("converts PV1-5 Preadmit Number to preAdmissionIdentifier", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $5_preadmitNumber: {
          $1_value: "PRE123",
        },
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.hospitalization?.preAdmissionIdentifier?.value).toBe("PRE123");
    });

    test("converts PV1-13 Re-admission Indicator", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $13_reAdmissionIndicator: "R",
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.hospitalization?.reAdmission?.coding?.[0]?.code).toBe("R");
    });

    test("converts PV1-14 Admit Source", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $14_admitSource: "7",
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.hospitalization?.admitSource?.coding?.[0]?.code).toBe("7");
    });

    test("converts PV1-15 Ambulatory Status to specialArrangement", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $15_ambulatoryStatus: ["A01", "A02"],
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.hospitalization?.specialArrangement).toHaveLength(2);
    });

    test("converts PV1-16 VIP Indicator to specialCourtesy", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $16_vip: "VIP",
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.hospitalization?.specialCourtesy?.[0]?.coding?.[0]?.code).toBe("VIP");
    });

    test("converts PV1-36 Discharge Disposition", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $36_dischargeDisposition: "01",
        $45_discharge: ["202312051430"],
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "finished");

      expect(encounter.hospitalization?.dischargeDisposition?.coding?.[0]?.code).toBe("01");
    });

    test("converts PV1-37 Discharged to Location", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $37_dischargedToLocation: {
          $1_location: "HOME",
        },
        $45_discharge: ["202312051430"],
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "finished");

      expect(encounter.hospitalization?.destination?.display).toBe("HOME");
    });

    test("converts PV1-38 Diet Type to dietPreference", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $38_dietType: {
          $1_code: "DAB",
          $2_text: "Diabetic",
        },
      };

      const encounter = buildEncounterFromPV1(pv1, DEFAULT_CLASS, "in-progress");

      expect(encounter.hospitalization?.dietPreference?.[0]?.coding?.[0]?.code).toBe("DAB");
    });
  });

  describe("comprehensive conversion", () => {
    test("converts a complete PV1 segment", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $3_assignedPatientLocation: {
          $1_careSite: "MED",
          $2_room: "101",
          $3_bed: "A",
        },
        $4_admissionType: "E",
        $5_preadmitNumber: { $1_value: "PRE001" },
        $7_attendingDoctor: [
          {
            $1_value: "DOC001",
            $2_family: { $1_family: "Smith" },
            $3_given: "John",
          },
        ],
        $10_hospitalService: "MED",
        $14_admitSource: "1",
        $19_visitNumber: { $1_value: "V12345" },
        $44_admission: "202312011000",
        $45_discharge: ["202312051430"],
      };

      const encounter = buildEncounterWithClassResolution(pv1);

      expect(encounter.resourceType).toBe("Encounter");
      expect(encounter.class.code).toBe("IMP");
      expect(encounter.status).toBe("finished");
      expect(encounter.identifier).toHaveLength(1);
      expect(encounter.type).toHaveLength(1);
      expect(encounter.serviceType?.coding?.[0]?.code).toBe("MED");
      expect(encounter.period?.start).toBe("2023-12-01T10:00:00Z");
      expect(encounter.period?.end).toBe("2023-12-05T14:30:00Z");
      expect(encounter.participant).toHaveLength(1);
      expect(encounter.location).toHaveLength(1);
      expect(encounter.hospitalization?.preAdmissionIdentifier?.value).toBe("PRE001");
      expect(encounter.hospitalization?.admitSource?.coding?.[0]?.code).toBe("1");
    });
  });
});

describe("extractPatientClass", () => {
  test("extracts uppercase patient class", () => {
    expect(extractPatientClass({ $2_class: "I" })).toBe("I");
  });

  test("normalizes lowercase to uppercase", () => {
    expect(extractPatientClass({ $2_class: "e" })).toBe("E");
  });

  test("returns U for undefined class", () => {
    expect(extractPatientClass({} as PV1)).toBe("U");
  });

  test("returns U for null class", () => {
    expect(extractPatientClass({ $2_class: null as unknown as string })).toBe("U");
  });
});

describe("mapPatientClassToFHIRWithResult", () => {
  describe("valid patient classes", () => {
    test.each([
      ["E", "EMER", "emergency", "in-progress"],
      ["I", "IMP", "inpatient encounter", "in-progress"],
      ["O", "AMB", "ambulatory", "in-progress"],
      ["P", "PRENC", "pre-admission", "planned"],
      ["R", "IMP", "inpatient encounter", "in-progress"],
      ["B", "IMP", "inpatient encounter", "in-progress"],
      ["C", "IMP", "inpatient encounter", "in-progress"],
      ["N", "IMP", "inpatient encounter", "unknown"],
      ["U", "AMB", "ambulatory", "unknown"],
    ] as const)("maps %s to %s with status %s", (input, expectedCode, expectedDisplay, expectedStatus) => {
      const result = mapPatientClassToFHIRWithResult(input);

      expect(result.class).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.class?.code).toBe(expectedCode);
      expect(result.class?.display).toBe(expectedDisplay);
      expect(result.class?.system).toBe("http://terminology.hl7.org/CodeSystem/v3-ActCode");
      expect(result.status).toBe(expectedStatus);
    });

    test("accepts lowercase patient class", () => {
      const result = mapPatientClassToFHIRWithResult("e");

      expect(result.class).toBeDefined();
      expect(result.class?.code).toBe("EMER");
    });

    test("returns finished status when discharge datetime is present", () => {
      const result = mapPatientClassToFHIRWithResult("I", true);

      expect(result.class).toBeDefined();
      expect(result.status).toBe("finished");
    });
  });

  describe("invalid patient classes", () => {
    test("returns error for invalid class 1", () => {
      const result = mapPatientClassToFHIRWithResult("1");

      expect(result.class).toBeUndefined();
      expect(result.status).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.mappingType).toBe("patient-class");
      expect(result.error?.localCode).toBe("1");
      expect(result.error?.localSystem).toBe("http://terminology.hl7.org/CodeSystem/v2-0004");
    });

    test("returns error for invalid class X", () => {
      const result = mapPatientClassToFHIRWithResult("X");

      expect(result.error).toBeDefined();
      expect(result.error?.localCode).toBe("X");
    });

    test("returns error for invalid class 99", () => {
      const result = mapPatientClassToFHIRWithResult("99");

      expect(result.error).toBeDefined();
      expect(result.error?.localCode).toBe("99");
    });

    test("error includes descriptive local display", () => {
      const result = mapPatientClassToFHIRWithResult("CUSTOM");

      expect(result.error?.localDisplay).toContain("PV1-2");
      expect(result.error?.localDisplay).toContain("CUSTOM");
    });

    test("handles undefined patient class", () => {
      const result = mapPatientClassToFHIRWithResult(undefined);

      // undefined normalizes to "U" which is valid
      expect(result.class).toBeDefined();
      expect(result.class?.code).toBe("AMB");
    });
  });
});
