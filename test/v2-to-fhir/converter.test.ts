import { test, expect, describe } from "bun:test";
import { convertToFHIR } from "../../src/v2-to-fhir/converter";

const ADT_A01_MESSAGE = `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215143000||ADT^A01^ADT_A01|MSG001|P|2.5.1|||AL|AL
EVN|A01|20231215143000|||OPERATOR
PID|1||TEST-001^^^HOSPITAL^MR||TESTPATIENT^ONE^A||20000101|M|||100 Test St^^Testcity^TS^00001^USA||^PRN^PH^^1^555^0000001|^WPN^PH^^1^555^0000002||M||TEST-001
PV1|1|I|WARD1^ROOM1^BED1||||PROV001^TEST^PROVIDER|||MED||||ADM|||||VN001|||||||||||||||||||||||||||20231215140000`;

const ADT_A08_MESSAGE = `MSH|^~\\&|ST01|F|PCM|F|20251109032904||ADT^A08|150466177|P|2.2|150466177||AL
EVN|A08|20251109032904|||OP001^TESTOPERATOR^ALPHA
PID|1|11467314^^^OCCAM^PE|F336974^^^CERNER^MR|00556588^^^CERNER^PI|CZEGXD^ZCEZC^N|VIDXVK,DMLL|94891053|M||1|207 BFYDE ETQH^MT EYJ 69^HYNOYYZT^PA^77139^US^P^WES^WPG||(521)665-9273^PRN^PH^^^151^3942567|^WPN^PH|E^ENGLISH^HL70296^E^ENGLISH^99CLAN|S|14|4934860403^^^ST01F|000-00-0000|||2|||||N|1^AMERICAN^99NAT||N
PV1|1|E||1|||PROV002^TESTDOCTOR^ALPHA^^^^MD^HL70010^0000000001|PROV003^TESTDOCTOR^BETA^E^^^MD^HL70010||ETU|||N|1|||PROV002^TESTDOCTOR^ALPHA^^^^MD^HL70010^0000000001|FER||UH||N|||||||||||||||||F||0|||202511090305
PV2|||||||||||||||||||||!|||||||||||||||N
AL1|1|DA|^#At Qtjth Zjwcjxwuh|||20150204
DG1|1|FF||SHMWAPYFA DXFU||A|||||||||0
DG1|2|FF||SHMWAPYFA DXFU||W|||||||||1
IN1|1|0182|95|COMMERCIAL INSURANCE|P O BOX 740800^^ATLANTA^GA^303740800||(401)414-7523|671593|||||||C|CZEGXD^ITODJ^WDJL|S|57817839|207 BFYDE ETQH^MT EYJ 69^HYNOYYZT^PA^77139^US^P^WES^WES|||1||||||||||||||094094615|0.00|||||3^NOT EMPLOYED^HL70066^3^NOT EMPLOYED^99ESC|M
IN2||000-00-0000|||L|||||||||||||||N|||||||||||||||||||||||||||||||||||||||||||(521)665-9273^PRN^PH^^^151^3942567|^WPN^PH||||||||3`;

describe("convertToFHIR", () => {
  test("converts ADT^A01 message to FHIR Bundle", () => {
    const bundle = convertToFHIR(ADT_A01_MESSAGE);
    expect(bundle).toMatchSnapshot();
  });

  test("converts ADT^A08 message to FHIR Bundle", () => {
    const bundle = convertToFHIR(ADT_A08_MESSAGE);
    expect(bundle).toMatchSnapshot();
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
