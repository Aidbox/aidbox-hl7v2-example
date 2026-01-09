import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import type { IncomingHL7v2Message } from "../../src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import type { Bundle } from "../../src/fhir/hl7-fhir-r4-core/Bundle";

// Sample HL7v2 messages
const sampleADT_A01 = `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215143000||ADT^A01^ADT_A01|MSG001|P|2.5.1|||AL|AL
EVN|A01|20231215143000|||OPERATOR
PID|1||P12345^^^HOSPITAL^MR||TESTPATIENT^ALPHA^A||20000101|M|||100 Test St^^Testcity^TS^00001^USA||^PRN^PH^^1^555^0000001|^WPN^PH^^1^555^0000002||M||P12345
PV1|1|I|WARD1^ROOM1^BED1||||PROV001^TEST^PROVIDER|||MED||||ADM|||||VN001|||||||||||||||||||||||||||20231215140000`;

const sampleADT_A08 = `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215143000||ADT^A08^ADT_A08|MSG002|P|2.5.1|||AL|AL
EVN|A08|20231215143000|||OPERATOR
PID|1||P67890^^^HOSPITAL^MR||TESTPATIENT^BETA^B||20000202|F|||200 Test Ave^^Testtown^TS^00002^USA||^PRN^PH^^1^555^0000003||S||P67890`;

describe("processor-service", () => {
  let submittedBundle: Bundle | null = null;
  let updatedMessage: IncomingHL7v2Message | null = null;

  // Mock aidbox module
  const mockAidbox = {
    aidboxFetch: mock((path: string, options?: any) => {
      // Mock pollReceivedMessage - return IncomingHL7v2Message
      if (path.includes("IncomingHL7v2Message?status=received")) {
        return Promise.resolve({
          entry: [
            {
              resource: {
                resourceType: "IncomingHL7v2Message",
                id: "test-msg-001",
                type: "ADT_A01",
                status: "received",
                message: sampleADT_A01,
              } as IncomingHL7v2Message,
            },
          ],
        });
      }

      // Mock submitBundle - capture submitted bundle
      if (path === "/fhir" && options?.method === "POST") {
        submittedBundle = JSON.parse(options.body);
        return Promise.resolve({});
      }

      return Promise.resolve({});
    }),
    putResource: mock((resourceType: string, id: string, resource: any) => {
      updatedMessage = resource;
      return Promise.resolve(resource);
    }),
  };

  beforeEach(() => {
    submittedBundle = null;
    updatedMessage = null;
    mockAidbox.aidboxFetch.mockClear();
    mockAidbox.putResource.mockClear();
  });

  test("processes ADT_A01 message and returns correct Bundle", async () => {
    // Mock the aidbox module
    mock.module("../../src/aidbox", () => mockAidbox);

    const { processNextMessage } = await import("../../src/v2-to-fhir/processor-service");

    // Process message
    const result = await processNextMessage();

    expect(result).toBe(true);

    // Compare entire Bundle using snapshot
    expect(submittedBundle).toMatchSnapshot();

    // Verify message status updated
    expect(updatedMessage).toMatchSnapshot();
  });

  test("processes ADT_A08 message and returns correct Bundle", async () => {
    // Mock different message for ADT_A08
    mockAidbox.aidboxFetch.mockImplementation((path: string, options?: any) => {
      if (path.includes("IncomingHL7v2Message?status=received")) {
        return Promise.resolve({
          entry: [
            {
              resource: {
                resourceType: "IncomingHL7v2Message",
                id: "test-msg-002",
                type: "ADT_A08",
                status: "received",
                message: sampleADT_A08,
              } as IncomingHL7v2Message,
            },
          ],
        });
      }

      if (path === "/fhir" && options?.method === "POST") {
        submittedBundle = JSON.parse(options.body);
        return Promise.resolve({});
      }

      return Promise.resolve({});
    });

    mock.module("../../src/aidbox", () => mockAidbox);

    const { processNextMessage } = await import("../../src/v2-to-fhir/processor-service");

    // Process message
    const result = await processNextMessage();

    expect(result).toBe(true);

    // Compare entire Bundle using snapshot
    expect(submittedBundle).toMatchSnapshot();

    // Verify message status updated
    expect(updatedMessage).toMatchSnapshot();
  });

  test("returns false when no messages to process", async () => {
    // Mock empty result
    mockAidbox.aidboxFetch.mockImplementation((path: string) => {
      if (path.includes("IncomingHL7v2Message?status=received")) {
        return Promise.resolve({ entry: [] });
      }
      return Promise.resolve({});
    });

    mock.module("../../src/aidbox", () => mockAidbox);

    const { processNextMessage } = await import("../../src/v2-to-fhir/processor-service");

    const result = await processNextMessage();

    expect(result).toBe(false);
    expect(submittedBundle).toMatchSnapshot();
    expect(updatedMessage).toMatchSnapshot();
  });

  test("handles conversion errors and updates status to error", async () => {
    // Mock invalid message
    mockAidbox.aidboxFetch.mockImplementation((path: string, options?: any) => {
      if (path.includes("IncomingHL7v2Message?status=received")) {
        return Promise.resolve({
          entry: [
            {
              resource: {
                resourceType: "IncomingHL7v2Message",
                id: "test-msg-003",
                type: "ADT_A01",
                status: "received",
                message: "INVALID|MESSAGE", // Invalid HL7v2
              } as IncomingHL7v2Message,
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    mock.module("../../src/aidbox", () => mockAidbox);

    const { processNextMessage } = await import("../../src/v2-to-fhir/processor-service");

    // Should throw error but still update status
    await expect(processNextMessage()).rejects.toThrow();

    // Verify entire updated message using snapshot
    expect(updatedMessage).toMatchSnapshot();
  });
});
