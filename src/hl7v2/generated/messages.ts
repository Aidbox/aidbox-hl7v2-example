// AUTO-GENERATED - HL7v2 Message Builders
// Generated for: BAR_P01

import type { HL7v2Segment, HL7v2Message } from "./types";
import {
  toSegment,
  type ACC,
  type AL1,
  type DB1,
  type DG1,
  type DRG,
  type EVN,
  type GT1,
  type IN1,
  type IN2,
  type IN3,
  type MSH,
  type NK1,
  type OBX,
  type PD1,
  type PID,
  type PR1,
  type PV1,
  type PV2,
  type ROL,
  type SFT,
  type UB1,
  type UB2,
} from "./fields";

export interface BAR_P01_PROCEDURE {
  pr1: HL7v2Segment;
  rol?: HL7v2Segment[];
}

export class BAR_P01_PROCEDUREBuilder {
  private group: Partial<BAR_P01_PROCEDURE> = {};

  pr1(segment: PR1): this {
    this.group.pr1 = toSegment("PR1", segment);
    return this;
  }

  addROL(segment: ROL): this {
    if (!this.group.rol) this.group.rol = [];
    this.group.rol.push(toSegment("ROL", segment));
    return this;
  }

  build(): BAR_P01_PROCEDURE {
    return this.group as BAR_P01_PROCEDURE;
  }
}

export interface BAR_P01_INSURANCE {
  in1: HL7v2Segment;
  in2?: HL7v2Segment;
  in3?: HL7v2Segment[];
  rol?: HL7v2Segment[];
}

export class BAR_P01_INSURANCEBuilder {
  private group: Partial<BAR_P01_INSURANCE> = {};

  in1(segment: IN1): this {
    this.group.in1 = toSegment("IN1", segment);
    return this;
  }

  in2(segment: IN2): this {
    this.group.in2 = toSegment("IN2", segment);
    return this;
  }

  addIN3(segment: IN3): this {
    if (!this.group.in3) this.group.in3 = [];
    this.group.in3.push(toSegment("IN3", segment));
    return this;
  }

  addROL(segment: ROL): this {
    if (!this.group.rol) this.group.rol = [];
    this.group.rol.push(toSegment("ROL", segment));
    return this;
  }

  build(): BAR_P01_INSURANCE {
    return this.group as BAR_P01_INSURANCE;
  }
}

export interface BAR_P01_VISIT {
  pv1?: HL7v2Segment;
  pv2?: HL7v2Segment;
  rol?: HL7v2Segment[];
  db1?: HL7v2Segment[];
  obx?: HL7v2Segment[];
  al1?: HL7v2Segment[];
  dg1?: HL7v2Segment[];
  drg?: HL7v2Segment;
  procedure?: BAR_P01_PROCEDURE[];
  gt1?: HL7v2Segment[];
  nk1?: HL7v2Segment[];
  insurance?: BAR_P01_INSURANCE[];
  acc?: HL7v2Segment;
  ub1?: HL7v2Segment;
  ub2?: HL7v2Segment;
}

export class BAR_P01_VISITBuilder {
  private group: Partial<BAR_P01_VISIT> = {};

  pv1(segment: PV1): this {
    this.group.pv1 = toSegment("PV1", segment);
    return this;
  }

  pv2(segment: PV2): this {
    this.group.pv2 = toSegment("PV2", segment);
    return this;
  }

  addROL(segment: ROL): this {
    if (!this.group.rol) this.group.rol = [];
    this.group.rol.push(toSegment("ROL", segment));
    return this;
  }

  addDB1(segment: DB1): this {
    if (!this.group.db1) this.group.db1 = [];
    this.group.db1.push(toSegment("DB1", segment));
    return this;
  }

  addOBX(segment: OBX): this {
    if (!this.group.obx) this.group.obx = [];
    this.group.obx.push(toSegment("OBX", segment));
    return this;
  }

  addAL1(segment: AL1): this {
    if (!this.group.al1) this.group.al1 = [];
    this.group.al1.push(toSegment("AL1", segment));
    return this;
  }

  addDG1(segment: DG1): this {
    if (!this.group.dg1) this.group.dg1 = [];
    this.group.dg1.push(toSegment("DG1", segment));
    return this;
  }

  drg(segment: DRG): this {
    this.group.drg = toSegment("DRG", segment);
    return this;
  }

  addPROCEDURE(group: BAR_P01_PROCEDURE | ((builder: BAR_P01_PROCEDUREBuilder) => BAR_P01_PROCEDUREBuilder)): this {
    let g: BAR_P01_PROCEDURE;
    if (typeof group === "function") g = group(new BAR_P01_PROCEDUREBuilder()).build();
    else g = group;
    if (!this.group.procedure) this.group.procedure = [];
    this.group.procedure.push(g);
    return this;
  }

  addGT1(segment: GT1): this {
    if (!this.group.gt1) this.group.gt1 = [];
    this.group.gt1.push(toSegment("GT1", segment));
    return this;
  }

  addNK1(segment: NK1): this {
    if (!this.group.nk1) this.group.nk1 = [];
    this.group.nk1.push(toSegment("NK1", segment));
    return this;
  }

  addINSURANCE(group: BAR_P01_INSURANCE | ((builder: BAR_P01_INSURANCEBuilder) => BAR_P01_INSURANCEBuilder)): this {
    let g: BAR_P01_INSURANCE;
    if (typeof group === "function") g = group(new BAR_P01_INSURANCEBuilder()).build();
    else g = group;
    if (!this.group.insurance) this.group.insurance = [];
    this.group.insurance.push(g);
    return this;
  }

  acc(segment: ACC): this {
    this.group.acc = toSegment("ACC", segment);
    return this;
  }

  ub1(segment: UB1): this {
    this.group.ub1 = toSegment("UB1", segment);
    return this;
  }

  ub2(segment: UB2): this {
    this.group.ub2 = toSegment("UB2", segment);
    return this;
  }

  build(): BAR_P01_VISIT {
    return this.group as BAR_P01_VISIT;
  }
}

/**
 * BAR_P01 Message Structure
 */
export interface BAR_P01_Message {
  msh: HL7v2Segment;
  sft?: HL7v2Segment[];
  evn: HL7v2Segment;
  pid: HL7v2Segment;
  pd1?: HL7v2Segment;
  rol?: HL7v2Segment[];
  visit: BAR_P01_VISIT[];
}

/**
 * Builder for BAR_P01 messages
 */
export class BAR_P01Builder {
  private msg: Partial<BAR_P01_Message> = {};

  msh(segment: MSH): this {
    this.msg.msh = toSegment("MSH", segment);
    return this;
  }

  addSFT(segment: SFT): this {
    if (!this.msg.sft) this.msg.sft = [];
    this.msg.sft.push(toSegment("SFT", segment));
    return this;
  }

  evn(segment: EVN): this {
    this.msg.evn = toSegment("EVN", segment);
    return this;
  }

  pid(segment: PID): this {
    this.msg.pid = toSegment("PID", segment);
    return this;
  }

  pd1(segment: PD1): this {
    this.msg.pd1 = toSegment("PD1", segment);
    return this;
  }

  addROL(segment: ROL): this {
    if (!this.msg.rol) this.msg.rol = [];
    this.msg.rol.push(toSegment("ROL", segment));
    return this;
  }

  addVISIT(group: BAR_P01_VISIT | ((builder: BAR_P01_VISITBuilder) => BAR_P01_VISITBuilder)): this {
    let g: BAR_P01_VISIT;
    if (typeof group === "function") g = group(new BAR_P01_VISITBuilder()).build();
    else g = group;
    if (!this.msg.visit) this.msg.visit = [];
    this.msg.visit.push(g);
    return this;
  }

  build(): HL7v2Message {
    if (!this.msg.msh) throw new Error("BAR_P01: msh is required");
    if (!this.msg.evn) throw new Error("BAR_P01: evn is required");
    if (!this.msg.pid) throw new Error("BAR_P01: pid is required");
    if (!this.msg.visit) throw new Error("BAR_P01: visit is required");
    const segments: HL7v2Message = [];
    if (this.msg.msh) segments.push(this.msg.msh);
    if (this.msg.sft) for (const seg of this.msg.sft) segments.push(seg);
    if (this.msg.evn) segments.push(this.msg.evn);
    if (this.msg.pid) segments.push(this.msg.pid);
    if (this.msg.pd1) segments.push(this.msg.pd1);
    if (this.msg.rol) for (const seg of this.msg.rol) segments.push(seg);
    if (this.msg.visit) for (const group of this.msg.visit) {
      if (group.pv1) segments.push(group.pv1);
      if (group.pv2) segments.push(group.pv2);
      if (group.rol) for (const seg of group.rol) segments.push(seg);
      if (group.db1) for (const seg of group.db1) segments.push(seg);
      if (group.obx) for (const seg of group.obx) segments.push(seg);
      if (group.al1) for (const seg of group.al1) segments.push(seg);
      if (group.dg1) for (const seg of group.dg1) segments.push(seg);
      if (group.drg) segments.push(group.drg);
      if (group.procedure) for (const subgroup of group.procedure) {
        if (subgroup.pr1) segments.push(subgroup.pr1);
        if (subgroup.rol) for (const seg of subgroup.rol) segments.push(seg);
      }
      if (group.gt1) for (const seg of group.gt1) segments.push(seg);
      if (group.nk1) for (const seg of group.nk1) segments.push(seg);
      if (group.insurance) for (const subgroup of group.insurance) {
        if (subgroup.in1) segments.push(subgroup.in1);
        if (subgroup.in2) segments.push(subgroup.in2);
        if (subgroup.in3) for (const seg of subgroup.in3) segments.push(seg);
        if (subgroup.rol) for (const seg of subgroup.rol) segments.push(seg);
      }
      if (group.acc) segments.push(group.acc);
      if (group.ub1) segments.push(group.ub1);
      if (group.ub2) segments.push(group.ub2);
    }
    return segments;
  }
}

// ====== Typed Input Interfaces ======

export interface BAR_P01_PROCEDURE_Input {
  PR1: PR1;
  ROL?: ROL[];
}

export interface BAR_P01_INSURANCE_Input {
  IN1: IN1;
  IN2?: IN2;
  IN3?: IN3[];
  ROL?: ROL[];
}

export interface BAR_P01_VISIT_Input {
  PV1?: PV1;
  PV2?: PV2;
  ROL?: ROL[];
  DB1?: DB1[];
  OBX?: OBX[];
  AL1?: AL1[];
  DG1?: DG1[];
  DRG?: DRG;
  PROCEDURE?: BAR_P01_PROCEDURE_Input[];
  GT1?: GT1[];
  NK1?: NK1[];
  INSURANCE?: BAR_P01_INSURANCE_Input[];
  ACC?: ACC;
  UB1?: UB1;
  UB2?: UB2;
}

/**
 * BAR_P01 Input - typed segment data
 */
export interface BAR_P01_Input {
  type: "BAR_P01";
  MSH: MSH;
  SFT?: SFT[];
  EVN: EVN;
  PID: PID;
  PD1?: PD1;
  ROL?: ROL[];
  VISIT: BAR_P01_VISIT_Input[];
}

/**
 * Convert BAR_P01_Input to HL7v2Message
 */
export function toBAR_P01(input: BAR_P01_Input): HL7v2Message {
  const segments: HL7v2Message = [];
  if (input.MSH) segments.push(toSegment("MSH", input.MSH));
  if (input.SFT) for (const seg of input.SFT) segments.push(toSegment("SFT", seg));
  if (input.EVN) segments.push(toSegment("EVN", input.EVN));
  if (input.PID) segments.push(toSegment("PID", input.PID));
  if (input.PD1) segments.push(toSegment("PD1", input.PD1));
  if (input.ROL) for (const seg of input.ROL) segments.push(toSegment("ROL", seg));
  if (input.VISIT) for (const group of input.VISIT) {
    if (group.PV1) segments.push(toSegment("PV1", group.PV1));
    if (group.PV2) segments.push(toSegment("PV2", group.PV2));
    if (group.ROL) for (const seg of group.ROL) segments.push(toSegment("ROL", seg));
    if (group.DB1) for (const seg of group.DB1) segments.push(toSegment("DB1", seg));
    if (group.OBX) for (const seg of group.OBX) segments.push(toSegment("OBX", seg));
    if (group.AL1) for (const seg of group.AL1) segments.push(toSegment("AL1", seg));
    if (group.DG1) for (const seg of group.DG1) segments.push(toSegment("DG1", seg));
    if (group.DRG) segments.push(toSegment("DRG", group.DRG));
    if (group.PROCEDURE) for (const group of group.PROCEDURE) {
      if (group.PR1) segments.push(toSegment("PR1", group.PR1));
      if (group.ROL) for (const seg of group.ROL) segments.push(toSegment("ROL", seg));
    }
    if (group.GT1) for (const seg of group.GT1) segments.push(toSegment("GT1", seg));
    if (group.NK1) for (const seg of group.NK1) segments.push(toSegment("NK1", seg));
    if (group.INSURANCE) for (const group of group.INSURANCE) {
      if (group.IN1) segments.push(toSegment("IN1", group.IN1));
      if (group.IN2) segments.push(toSegment("IN2", group.IN2));
      if (group.IN3) for (const seg of group.IN3) segments.push(toSegment("IN3", seg));
      if (group.ROL) for (const seg of group.ROL) segments.push(toSegment("ROL", seg));
    }
    if (group.ACC) segments.push(toSegment("ACC", group.ACC));
    if (group.UB1) segments.push(toSegment("UB1", group.UB1));
    if (group.UB2) segments.push(toSegment("UB2", group.UB2));
  }
  return segments;
}
