import { test, expect, describe } from "bun:test";
import { convertToFHIR } from "./converter";

const ADT_A08_MESSAGE = `MSH|^~\\&|ST01|F|PCM|F|20251109032904||ADT^A08|150466177|P|2.2|150466177||AL
EVN|A08|20251109032904|||sb69385^BUNGARD^STACEY
PID|1|11467314^^^OCCAM^PE|F336974^^^CERNER^MR|00556588^^^CERNER^PI|CZEGXD^ZCEZC^N|VIDXVK,DMLL|94891053|M||1|207 BFYDE ETQH^MT EYJ 69^HYNOYYZT^PA^77139^US^P^WES^WPG||(521)665-9273^PRN^PH^^^151^3942567|^WPN^PH|E^ENGLISH^HL70296^E^ENGLISH^99CLAN|S|14|4934860403^^^ST01F|877-73-6705|||2|||||N|1^AMERICAN^99NAT||N
PV1|1|E||1|||13036^FURLANI^NICHOLAS^^^^MD^HL70010^1558789602|82950^GERA^JEROME^ESF^^^MD^HL70010||ETU|||N|1|||13036^FURLANI^NICHOLAS^^^^MD^HL70010^1558789602|FER||UH||N|||||||||||||||||F||0|||202511090305
PV2|||||||||||||||||||||!|||||||||||||||N
AL1|1|DA|^#At Qtjth Zjwcjxwuh|||20150204
DG1|1|FF||SHMWAPYFA DXFU||A|||||||||0
DG1|2|FF||SHMWAPYFA DXFU||W|||||||||1
IN1|1|0182|95|COMMERCIAL INSURANCE|P O BOX 740800^^ATLANTA^GA^303740800||(401)414-7523|671593|||||||C|CZEGXD^ITODJ^WDJL|S|57817839|207 BFYDE ETQH^MT EYJ 69^HYNOYYZT^PA^77139^US^P^WES^WES|||1||||||||||||||094094615|0.00|||||3^NOT EMPLOYED^HL70066^3^NOT EMPLOYED^99ESC|M
IN2||952-32-4746|||L|||||||||||||||N|||||||||||||||||||||||||||||||||||||||||||(521)665-9273^PRN^PH^^^151^3942567|^WPN^PH||||||||3`;

describe("convertToFHIR", () => {
  test("converts ADT^A08 to FHIR Bundle", () => {
    const bundle = convertToFHIR(ADT_A08_MESSAGE);

    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("transaction");
    expect(bundle.entry).toHaveLength(1);
  });

  test("creates PUT request with correct URL", () => {
    const bundle = convertToFHIR(ADT_A08_MESSAGE);
    const entry = bundle.entry[0];

    expect(entry.request.method).toBe("PUT");
    expect(entry.request.url).toBe("/Patient/11467314");
  });

  test("extracts Patient.id from PID-2", () => {
    const bundle = convertToFHIR(ADT_A08_MESSAGE);
    const patient = bundle.entry[0].resource;

    expect(patient.id).toBe("11467314");
  });

  test("extracts Patient.gender from PID-8", () => {
    const bundle = convertToFHIR(ADT_A08_MESSAGE);
    const patient = bundle.entry[0].resource;

    expect(patient.gender).toBe("male");
  });

  test("extracts Patient.name from PID-5", () => {
    const bundle = convertToFHIR(ADT_A08_MESSAGE);
    const patient = bundle.entry[0].resource;

    expect(patient.name).toBeDefined();
    expect(patient.name![0].family).toBe("Czegxd");
    expect(patient.name![0].given).toContain("Zcezc");
    expect(patient.name![0].given).toContain("N");
  });

  test("extracts Patient.address from PID-11", () => {
    const bundle = convertToFHIR(ADT_A08_MESSAGE);
    const patient = bundle.entry[0].resource;

    expect(patient.address).toBeDefined();
    expect(patient.address![0].line).toContain("207 BFYDE ETQH");
    expect(patient.address![0].city).toBe("HYNOYYZT");
    expect(patient.address![0].state).toBe("PA");
    expect(patient.address![0].postalCode).toBe("77139");
    expect(patient.address![0].country).toBe("US");
  });

  test("extracts Patient.telecom from PID-13", () => {
    const bundle = convertToFHIR(ADT_A08_MESSAGE);
    const patient = bundle.entry[0].resource;

    expect(patient.telecom).toBeDefined();
    expect(patient.telecom![0].value).toBe("(521)665-9273");
    expect(patient.telecom![0].system).toBe("phone");
    expect(patient.telecom![0].use).toBe("home");
  });

  test("extracts Patient.communication from PID-15", () => {
    const bundle = convertToFHIR(ADT_A08_MESSAGE);
    const patient = bundle.entry[0].resource;

    expect(patient.communication).toBeDefined();
    expect(patient.communication![0].language.coding![0].code).toBe("E");
    expect(patient.communication![0].preferred).toBe(true);
  });

  test("extracts Patient.maritalStatus from PID-16", () => {
    const bundle = convertToFHIR(ADT_A08_MESSAGE);
    const patient = bundle.entry[0].resource;

    expect(patient.maritalStatus).toBeDefined();
    expect(patient.maritalStatus!.coding![0].code).toBe("S");
    expect(patient.maritalStatus!.coding![0].system).toBe(
      "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus"
    );
  });

  test("extracts identifiers from PID-3, PID-2, and PID-19", () => {
    const bundle = convertToFHIR(ADT_A08_MESSAGE);
    const patient = bundle.entry[0].resource;

    expect(patient.identifier).toBeDefined();

    // MR identifier from PID-3
    const mrId = patient.identifier!.find(
      (id) => id.type?.coding?.[0]?.code === "MR"
    );
    expect(mrId).toBeDefined();
    expect(mrId!.value).toBe("F336974");

    // SSN identifier from PID-19
    const ssnId = patient.identifier!.find(
      (id) => id.type?.coding?.[0]?.code === "SS"
    );
    expect(ssnId).toBeDefined();
    expect(ssnId!.value).toBe("877-73-6705");

    // PE identifier from PID-2
    const peId = patient.identifier!.find(
      (id) => id.type?.coding?.[0]?.code === "PE"
    );
    expect(peId).toBeDefined();
    expect(peId!.value).toBe("11467314");
  });

  test("extracts meta.tag with message-id and message-type", () => {
    const bundle = convertToFHIR(ADT_A08_MESSAGE);
    const patient = bundle.entry[0].resource;

    expect(patient.meta?.tag).toBeDefined();

    const messageIdTag = patient.meta!.tag!.find(
      (t) => t.system === "urn:aidbox:hl7v2:message-id"
    );
    expect(messageIdTag).toBeDefined();
    expect(messageIdTag!.code).toBe("150466177");

    const messageTypeTag = patient.meta!.tag!.find(
      (t) => t.system === "urn:aidbox:hl7v2:message-type"
    );
    expect(messageTypeTag).toBeDefined();
    expect(messageTypeTag!.code).toBe("ADT_A08");
  });

  test("extracts sender tag from MR assigning authority", () => {
    const bundle = convertToFHIR(ADT_A08_MESSAGE);
    const patient = bundle.entry[0].resource;

    const senderTag = patient.meta!.tag!.find(
      (t) => t.system === "urn:aidbox:hl7v2:sender"
    );
    expect(senderTag).toBeDefined();
    expect(senderTag!.code).toBe("cerner");
  });

  test("throws error when MSH segment is missing", () => {
    const invalidMessage = `PID|1|12345^^^OCCAM^PE|67890^^^CERNER^MR`;
    expect(() => convertToFHIR(invalidMessage)).toThrow();
  });

  test("throws error when PID segment is missing", () => {
    const invalidMessage = `MSH|^~\\&|APP|FAC|||20251109||ADT^A08|123|P|2.5.1`;
    expect(() => convertToFHIR(invalidMessage)).toThrow("PID segment not found");
  });
});
