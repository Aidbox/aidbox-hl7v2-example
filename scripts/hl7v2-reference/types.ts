export interface XsdField {
  segment: string;
  position: number;
  item: string;        // zero-padded 5-digit, e.g. "00106"
  dataType: string;    // e.g. "CX", "ST", "SI"
  longName: string;
  maxLength: number | null; // null in v2.8.2 where most fields lack this attribute
  table: string | null;     // e.g. "0061" (stripped HL7 prefix), null if absent
}

export interface XsdSegmentField {
  field: string;       // e.g. "PID.3"
  position: number;
  minOccurs: number;
  maxOccurs: number | "unbounded";
}

export interface XsdSegment {
  name: string;        // e.g. "PID"
  fields: XsdSegmentField[];
}

export interface XsdDatatypeComponent {
  component: string;   // e.g. "CX.1"
  position: number;
  dataType: string;
  longName: string;
  maxLength: number | null;
}

export interface XsdDatatype {
  name: string;        // e.g. "CX"
  components: XsdDatatypeComponent[];
}

export interface XsdMessageElement {
  segment?: string;
  group?: string;
  minOccurs: number;
  maxOccurs: number | "unbounded";
  elements?: XsdMessageElement[];
}

export interface XsdMessage {
  name: string;        // e.g. "BAR_P01"
  elements: XsdMessageElement[];
}

export interface PdfFieldDescription {
  segment: string;
  position: number;
  item: string;
  dataType: string;
  longName: string;
  description: string;
}

export interface PdfSegmentDescription {
  name: string;
  longName: string;
  description: string;
}

export interface PdfTableValue {
  code: string;
  display: string;
}

export interface PdfTable {
  tableNumber: string;
  name: string;
  type: string;        // "HL7" or "User"
  values: PdfTableValue[];
}

export interface OutputField {
  segment: string;
  position: number;
  item: string;
  dataType: string;
  longName: string;
  maxLength: number | null;
  table: string | null;
  description: string | null;
}

export interface OutputSegmentField {
  field: string;
  position: number;
  minOccurs: number;
  maxOccurs: number | "unbounded";
}

export interface OutputSegment {
  longName: string | null;
  description: string | null;
  fields: OutputSegmentField[];
}

export interface OutputDatatypeComponent {
  component: string;
  position: number;
  dataType: string;
  longName: string;
  maxLength: number | null;
}

export interface OutputDatatype {
  components: OutputDatatypeComponent[];
}

export interface OutputTable {
  tableNumber: string;
  name: string;
  type: string;
  values: PdfTableValue[];
}
