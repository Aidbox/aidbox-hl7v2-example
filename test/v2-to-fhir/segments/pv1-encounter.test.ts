import { describe, test, expect } from "bun:test";
import { convertPV1ToEncounter } from "../../../src/v2-to-fhir/segments/pv1-encounter";
import type { PV1 } from "../../../src/hl7v2/generated/fields";

describe("convertPV1ToEncounter", () => {
  describe("class and status", () => {
    test("converts PV1-2 Patient Class E to EMER", () => {
      const pv1: PV1 = {
        $2_class: "E",
      };

      const encounter = convertPV1ToEncounter(pv1);

      expect(encounter.class.code).toBe("EMER");
      expect(encounter.class.display).toBe("emergency");
      expect(encounter.class.system).toBe("http://terminology.hl7.org/CodeSystem/v3-ActCode");
    });

    test("converts PV1-2 Patient Class I to IMP", () => {
      const pv1: PV1 = {
        $2_class: "I",
      };

      const encounter = convertPV1ToEncounter(pv1);

      expect(encounter.class.code).toBe("IMP");
      expect(encounter.class.display).toBe("inpatient encounter");
    });

    test("converts PV1-2 Patient Class O to AMB", () => {
      const pv1: PV1 = {
        $2_class: "O",
      };

      const encounter = convertPV1ToEncounter(pv1);

      expect(encounter.class.code).toBe("AMB");
      expect(encounter.class.display).toBe("ambulatory");
    });

    test("converts PV1-2 Patient Class P to PRENC with planned status", () => {
      const pv1: PV1 = {
        $2_class: "P",
      };

      const encounter = convertPV1ToEncounter(pv1);

      expect(encounter.class.code).toBe("PRENC");
      expect(encounter.class.display).toBe("pre-admission");
      expect(encounter.status).toBe("planned");
    });

    test("sets status to finished when PV1-45 is valued", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $45_discharge: ["202312151430"],
      };

      const encounter = convertPV1ToEncounter(pv1);

      expect(encounter.status).toBe("finished");
    });

    test("derives status from class when PV1-45 not valued", () => {
      const pv1: PV1 = {
        $2_class: "I",
      };

      const encounter = convertPV1ToEncounter(pv1);

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

      const encounter = convertPV1ToEncounter(pv1);

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

      const encounter = convertPV1ToEncounter(pv1);

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

      const encounter = convertPV1ToEncounter(pv1);

      expect(encounter.type).toHaveLength(1);
      expect(encounter.type![0]!.coding?.[0]?.code).toBe("E");
    });

    test("converts PV1-10 Hospital Service", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $10_hospitalService: "MED",
      };

      const encounter = convertPV1ToEncounter(pv1);

      expect(encounter.serviceType?.coding?.[0]?.code).toBe("MED");
    });
  });

  describe("period", () => {
    test("converts PV1-44 Admit Date/Time to period.start", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $44_admission: "202312011000",
      };

      const encounter = convertPV1ToEncounter(pv1);

      expect(encounter.period?.start).toBe("2023-12-01T10:00:00");
    });

    test("converts PV1-45 Discharge Date/Time to period.end", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $44_admission: "202312011000",
        $45_discharge: ["202312051430"],
      };

      const encounter = convertPV1ToEncounter(pv1);

      expect(encounter.period?.start).toBe("2023-12-01T10:00:00");
      expect(encounter.period?.end).toBe("2023-12-05T14:30:00");
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

      const encounter = convertPV1ToEncounter(pv1);

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

      const encounter = convertPV1ToEncounter(pv1);

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

      const encounter = convertPV1ToEncounter(pv1);

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

      const encounter = convertPV1ToEncounter(pv1);

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

      const encounter = convertPV1ToEncounter(pv1);

      expect(encounter.participant).toHaveLength(3);
    });
  });

  describe("locations", () => {
    test("converts PV1-3 Assigned Patient Location with status active", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $3_assignedPatientLocation: {
          $1_careSite: "ICU",
          $2_room: "101",
          $3_bed: "A",
        },
      };

      const encounter = convertPV1ToEncounter(pv1);

      expect(encounter.location).toHaveLength(1);
      expect(encounter.location![0]!.status).toBe("active");
      expect(encounter.location![0]!.location.display).toContain("A");
    });

    test("converts PV1-3 with class P to location status planned", () => {
      const pv1: PV1 = {
        $2_class: "P",
        $3_assignedPatientLocation: {
          $1_careSite: "PreAdmit",
        },
      };

      const encounter = convertPV1ToEncounter(pv1);

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

      const encounter = convertPV1ToEncounter(pv1);

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

      const encounter = convertPV1ToEncounter(pv1);

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

      const encounter = convertPV1ToEncounter(pv1);

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

      const encounter = convertPV1ToEncounter(pv1);

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

      const encounter = convertPV1ToEncounter(pv1);

      expect(encounter.hospitalization?.preAdmissionIdentifier?.value).toBe("PRE123");
    });

    test("converts PV1-13 Re-admission Indicator", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $13_reAdmissionIndicator: "R",
      };

      const encounter = convertPV1ToEncounter(pv1);

      expect(encounter.hospitalization?.reAdmission?.coding?.[0]?.code).toBe("R");
    });

    test("converts PV1-14 Admit Source", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $14_admitSource: "7",
      };

      const encounter = convertPV1ToEncounter(pv1);

      expect(encounter.hospitalization?.admitSource?.coding?.[0]?.code).toBe("7");
    });

    test("converts PV1-15 Ambulatory Status to specialArrangement", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $15_ambulatoryStatus: ["A01", "A02"],
      };

      const encounter = convertPV1ToEncounter(pv1);

      expect(encounter.hospitalization?.specialArrangement).toHaveLength(2);
    });

    test("converts PV1-16 VIP Indicator to specialCourtesy", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $16_vip: "VIP",
      };

      const encounter = convertPV1ToEncounter(pv1);

      expect(encounter.hospitalization?.specialCourtesy?.[0]?.coding?.[0]?.code).toBe("VIP");
    });

    test("converts PV1-36 Discharge Disposition", () => {
      const pv1: PV1 = {
        $2_class: "I",
        $36_dischargeDisposition: "01",
        $45_discharge: ["202312051430"],
      };

      const encounter = convertPV1ToEncounter(pv1);

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

      const encounter = convertPV1ToEncounter(pv1);

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

      const encounter = convertPV1ToEncounter(pv1);

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

      const encounter = convertPV1ToEncounter(pv1);

      expect(encounter.resourceType).toBe("Encounter");
      expect(encounter.class.code).toBe("IMP");
      expect(encounter.status).toBe("finished");
      expect(encounter.identifier).toHaveLength(1);
      expect(encounter.type).toHaveLength(1);
      expect(encounter.serviceType?.coding?.[0]?.code).toBe("MED");
      expect(encounter.period?.start).toBe("2023-12-01T10:00:00");
      expect(encounter.period?.end).toBe("2023-12-05T14:30:00");
      expect(encounter.participant).toHaveLength(1);
      expect(encounter.location).toHaveLength(1);
      expect(encounter.hospitalization?.preAdmissionIdentifier?.value).toBe("PRE001");
      expect(encounter.hospitalization?.admitSource?.coding?.[0]?.code).toBe("1");
    });
  });
});
