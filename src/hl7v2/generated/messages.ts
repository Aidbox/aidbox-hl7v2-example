// AUTO-GENERATED - HL7v2 Message Builders
// Generated for: BAR_P01, ORU_R01, VXU_V04

import type { HL7v2Segment, HL7v2Message } from "./types";
import {
  toSegment,
  type ACC,
  type AL1,
  type CTD,
  type CTI,
  type DB1,
  type DG1,
  type DRG,
  type DSC,
  type EVN,
  type FT1,
  type GT1,
  type IN1,
  type IN2,
  type IN3,
  type MSH,
  type NK1,
  type NTE,
  type OBR,
  type OBX,
  type ORC,
  type PD1,
  type PID,
  type PR1,
  type PV1,
  type PV2,
  type ROL,
  type RXA,
  type RXR,
  type SFT,
  type SPM,
  type TQ1,
  type TQ2,
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

export interface ORU_R01_VISIT {
  pv1: HL7v2Segment;
  pv2?: HL7v2Segment;
}

export class ORU_R01_VISITBuilder {
  private group: Partial<ORU_R01_VISIT> = {};

  pv1(segment: PV1): this {
    this.group.pv1 = toSegment("PV1", segment);
    return this;
  }

  pv2(segment: PV2): this {
    this.group.pv2 = toSegment("PV2", segment);
    return this;
  }

  build(): ORU_R01_VISIT {
    return this.group as ORU_R01_VISIT;
  }
}

export interface ORU_R01_PATIENT {
  pid: HL7v2Segment;
  pd1?: HL7v2Segment;
  nte?: HL7v2Segment[];
  nk1?: HL7v2Segment[];
  visit?: ORU_R01_VISIT;
}

export class ORU_R01_PATIENTBuilder {
  private group: Partial<ORU_R01_PATIENT> = {};

  pid(segment: PID): this {
    this.group.pid = toSegment("PID", segment);
    return this;
  }

  pd1(segment: PD1): this {
    this.group.pd1 = toSegment("PD1", segment);
    return this;
  }

  addNTE(segment: NTE): this {
    if (!this.group.nte) this.group.nte = [];
    this.group.nte.push(toSegment("NTE", segment));
    return this;
  }

  addNK1(segment: NK1): this {
    if (!this.group.nk1) this.group.nk1 = [];
    this.group.nk1.push(toSegment("NK1", segment));
    return this;
  }

  visit(group: ORU_R01_VISIT | ((builder: ORU_R01_VISITBuilder) => ORU_R01_VISITBuilder)): this {
    if (typeof group === "function") this.group.visit = group(new ORU_R01_VISITBuilder()).build();
    else this.group.visit = group;
    return this;
  }

  build(): ORU_R01_PATIENT {
    return this.group as ORU_R01_PATIENT;
  }
}

export interface ORU_R01_TIMING_QTY {
  tq1: HL7v2Segment;
  tq2?: HL7v2Segment[];
}

export class ORU_R01_TIMING_QTYBuilder {
  private group: Partial<ORU_R01_TIMING_QTY> = {};

  tq1(segment: TQ1): this {
    this.group.tq1 = toSegment("TQ1", segment);
    return this;
  }

  addTQ2(segment: TQ2): this {
    if (!this.group.tq2) this.group.tq2 = [];
    this.group.tq2.push(toSegment("TQ2", segment));
    return this;
  }

  build(): ORU_R01_TIMING_QTY {
    return this.group as ORU_R01_TIMING_QTY;
  }
}

export interface ORU_R01_OBSERVATION {
  obx: HL7v2Segment;
  nte?: HL7v2Segment[];
}

export class ORU_R01_OBSERVATIONBuilder {
  private group: Partial<ORU_R01_OBSERVATION> = {};

  obx(segment: OBX): this {
    this.group.obx = toSegment("OBX", segment);
    return this;
  }

  addNTE(segment: NTE): this {
    if (!this.group.nte) this.group.nte = [];
    this.group.nte.push(toSegment("NTE", segment));
    return this;
  }

  build(): ORU_R01_OBSERVATION {
    return this.group as ORU_R01_OBSERVATION;
  }
}

export interface ORU_R01_SPECIMEN {
  spm: HL7v2Segment;
  obx?: HL7v2Segment[];
}

export class ORU_R01_SPECIMENBuilder {
  private group: Partial<ORU_R01_SPECIMEN> = {};

  spm(segment: SPM): this {
    this.group.spm = toSegment("SPM", segment);
    return this;
  }

  addOBX(segment: OBX): this {
    if (!this.group.obx) this.group.obx = [];
    this.group.obx.push(toSegment("OBX", segment));
    return this;
  }

  build(): ORU_R01_SPECIMEN {
    return this.group as ORU_R01_SPECIMEN;
  }
}

export interface ORU_R01_ORDER_OBSERVATION {
  orc?: HL7v2Segment;
  obr: HL7v2Segment;
  nte?: HL7v2Segment[];
  timing_qty?: ORU_R01_TIMING_QTY[];
  ctd?: HL7v2Segment;
  observation?: ORU_R01_OBSERVATION[];
  ft1?: HL7v2Segment[];
  cti?: HL7v2Segment[];
  specimen?: ORU_R01_SPECIMEN[];
}

export class ORU_R01_ORDER_OBSERVATIONBuilder {
  private group: Partial<ORU_R01_ORDER_OBSERVATION> = {};

  orc(segment: ORC): this {
    this.group.orc = toSegment("ORC", segment);
    return this;
  }

  obr(segment: OBR): this {
    this.group.obr = toSegment("OBR", segment);
    return this;
  }

  addNTE(segment: NTE): this {
    if (!this.group.nte) this.group.nte = [];
    this.group.nte.push(toSegment("NTE", segment));
    return this;
  }

  addTIMING_QTY(group: ORU_R01_TIMING_QTY | ((builder: ORU_R01_TIMING_QTYBuilder) => ORU_R01_TIMING_QTYBuilder)): this {
    let g: ORU_R01_TIMING_QTY;
    if (typeof group === "function") g = group(new ORU_R01_TIMING_QTYBuilder()).build();
    else g = group;
    if (!this.group.timing_qty) this.group.timing_qty = [];
    this.group.timing_qty.push(g);
    return this;
  }

  ctd(segment: CTD): this {
    this.group.ctd = toSegment("CTD", segment);
    return this;
  }

  addOBSERVATION(group: ORU_R01_OBSERVATION | ((builder: ORU_R01_OBSERVATIONBuilder) => ORU_R01_OBSERVATIONBuilder)): this {
    let g: ORU_R01_OBSERVATION;
    if (typeof group === "function") g = group(new ORU_R01_OBSERVATIONBuilder()).build();
    else g = group;
    if (!this.group.observation) this.group.observation = [];
    this.group.observation.push(g);
    return this;
  }

  addFT1(segment: FT1): this {
    if (!this.group.ft1) this.group.ft1 = [];
    this.group.ft1.push(toSegment("FT1", segment));
    return this;
  }

  addCTI(segment: CTI): this {
    if (!this.group.cti) this.group.cti = [];
    this.group.cti.push(toSegment("CTI", segment));
    return this;
  }

  addSPECIMEN(group: ORU_R01_SPECIMEN | ((builder: ORU_R01_SPECIMENBuilder) => ORU_R01_SPECIMENBuilder)): this {
    let g: ORU_R01_SPECIMEN;
    if (typeof group === "function") g = group(new ORU_R01_SPECIMENBuilder()).build();
    else g = group;
    if (!this.group.specimen) this.group.specimen = [];
    this.group.specimen.push(g);
    return this;
  }

  build(): ORU_R01_ORDER_OBSERVATION {
    return this.group as ORU_R01_ORDER_OBSERVATION;
  }
}

export interface ORU_R01_PATIENT_RESULT {
  patient?: ORU_R01_PATIENT;
  order_observation: ORU_R01_ORDER_OBSERVATION[];
}

export class ORU_R01_PATIENT_RESULTBuilder {
  private group: Partial<ORU_R01_PATIENT_RESULT> = {};

  patient(group: ORU_R01_PATIENT | ((builder: ORU_R01_PATIENTBuilder) => ORU_R01_PATIENTBuilder)): this {
    if (typeof group === "function") this.group.patient = group(new ORU_R01_PATIENTBuilder()).build();
    else this.group.patient = group;
    return this;
  }

  addORDER_OBSERVATION(group: ORU_R01_ORDER_OBSERVATION | ((builder: ORU_R01_ORDER_OBSERVATIONBuilder) => ORU_R01_ORDER_OBSERVATIONBuilder)): this {
    let g: ORU_R01_ORDER_OBSERVATION;
    if (typeof group === "function") g = group(new ORU_R01_ORDER_OBSERVATIONBuilder()).build();
    else g = group;
    if (!this.group.order_observation) this.group.order_observation = [];
    this.group.order_observation.push(g);
    return this;
  }

  build(): ORU_R01_PATIENT_RESULT {
    return this.group as ORU_R01_PATIENT_RESULT;
  }
}

/**
 * ORU_R01 Message Structure
 */
export interface ORU_R01_Message {
  msh: HL7v2Segment;
  sft?: HL7v2Segment[];
  patient_result: ORU_R01_PATIENT_RESULT[];
  dsc?: HL7v2Segment;
}

/**
 * Builder for ORU_R01 messages
 */
export class ORU_R01Builder {
  private msg: Partial<ORU_R01_Message> = {};

  msh(segment: MSH): this {
    this.msg.msh = toSegment("MSH", segment);
    return this;
  }

  addSFT(segment: SFT): this {
    if (!this.msg.sft) this.msg.sft = [];
    this.msg.sft.push(toSegment("SFT", segment));
    return this;
  }

  addPATIENT_RESULT(group: ORU_R01_PATIENT_RESULT | ((builder: ORU_R01_PATIENT_RESULTBuilder) => ORU_R01_PATIENT_RESULTBuilder)): this {
    let g: ORU_R01_PATIENT_RESULT;
    if (typeof group === "function") g = group(new ORU_R01_PATIENT_RESULTBuilder()).build();
    else g = group;
    if (!this.msg.patient_result) this.msg.patient_result = [];
    this.msg.patient_result.push(g);
    return this;
  }

  dsc(segment: DSC): this {
    this.msg.dsc = toSegment("DSC", segment);
    return this;
  }

  build(): HL7v2Message {
    if (!this.msg.msh) throw new Error("ORU_R01: msh is required");
    if (!this.msg.patient_result) throw new Error("ORU_R01: patient_result is required");
    const segments: HL7v2Message = [];
    if (this.msg.msh) segments.push(this.msg.msh);
    if (this.msg.sft) for (const seg of this.msg.sft) segments.push(seg);
    if (this.msg.patient_result) for (const group of this.msg.patient_result) {
      if (group.patient) {
        const subgroup = group.patient;
        if (subgroup.pid) segments.push(subgroup.pid);
        if (subgroup.pd1) segments.push(subgroup.pd1);
        if (subgroup.nte) for (const seg of subgroup.nte) segments.push(seg);
        if (subgroup.nk1) for (const seg of subgroup.nk1) segments.push(seg);
        if (subgroup.visit) {
          const subgroup = subgroup.visit;
          if (subgroup.pv1) segments.push(subgroup.pv1);
          if (subgroup.pv2) segments.push(subgroup.pv2);
        }
      }
      if (group.order_observation) for (const subgroup of group.order_observation) {
        if (subgroup.orc) segments.push(subgroup.orc);
        if (subgroup.obr) segments.push(subgroup.obr);
        if (subgroup.nte) for (const seg of subgroup.nte) segments.push(seg);
        if (subgroup.timing_qty) for (const subgroup of subgroup.timing_qty) {
          if (subgroup.tq1) segments.push(subgroup.tq1);
          if (subgroup.tq2) for (const seg of subgroup.tq2) segments.push(seg);
        }
        if (subgroup.ctd) segments.push(subgroup.ctd);
        if (subgroup.observation) for (const subgroup of subgroup.observation) {
          if (subgroup.obx) segments.push(subgroup.obx);
          if (subgroup.nte) for (const seg of subgroup.nte) segments.push(seg);
        }
        if (subgroup.ft1) for (const seg of subgroup.ft1) segments.push(seg);
        if (subgroup.cti) for (const seg of subgroup.cti) segments.push(seg);
        if (subgroup.specimen) for (const subgroup of subgroup.specimen) {
          if (subgroup.spm) segments.push(subgroup.spm);
          if (subgroup.obx) for (const seg of subgroup.obx) segments.push(seg);
        }
      }
    }
    if (this.msg.dsc) segments.push(this.msg.dsc);
    return segments;
  }
}

export interface VXU_V04_PATIENT {
  pv1: HL7v2Segment;
  pv2?: HL7v2Segment;
}

export class VXU_V04_PATIENTBuilder {
  private group: Partial<VXU_V04_PATIENT> = {};

  pv1(segment: PV1): this {
    this.group.pv1 = toSegment("PV1", segment);
    return this;
  }

  pv2(segment: PV2): this {
    this.group.pv2 = toSegment("PV2", segment);
    return this;
  }

  build(): VXU_V04_PATIENT {
    return this.group as VXU_V04_PATIENT;
  }
}

export interface VXU_V04_INSURANCE {
  in1: HL7v2Segment;
  in2?: HL7v2Segment;
  in3?: HL7v2Segment;
}

export class VXU_V04_INSURANCEBuilder {
  private group: Partial<VXU_V04_INSURANCE> = {};

  in1(segment: IN1): this {
    this.group.in1 = toSegment("IN1", segment);
    return this;
  }

  in2(segment: IN2): this {
    this.group.in2 = toSegment("IN2", segment);
    return this;
  }

  in3(segment: IN3): this {
    this.group.in3 = toSegment("IN3", segment);
    return this;
  }

  build(): VXU_V04_INSURANCE {
    return this.group as VXU_V04_INSURANCE;
  }
}

export interface VXU_V04_TIMING {
  tq1: HL7v2Segment;
  tq2?: HL7v2Segment[];
}

export class VXU_V04_TIMINGBuilder {
  private group: Partial<VXU_V04_TIMING> = {};

  tq1(segment: TQ1): this {
    this.group.tq1 = toSegment("TQ1", segment);
    return this;
  }

  addTQ2(segment: TQ2): this {
    if (!this.group.tq2) this.group.tq2 = [];
    this.group.tq2.push(toSegment("TQ2", segment));
    return this;
  }

  build(): VXU_V04_TIMING {
    return this.group as VXU_V04_TIMING;
  }
}

export interface VXU_V04_OBSERVATION {
  obx: HL7v2Segment;
  nte?: HL7v2Segment[];
}

export class VXU_V04_OBSERVATIONBuilder {
  private group: Partial<VXU_V04_OBSERVATION> = {};

  obx(segment: OBX): this {
    this.group.obx = toSegment("OBX", segment);
    return this;
  }

  addNTE(segment: NTE): this {
    if (!this.group.nte) this.group.nte = [];
    this.group.nte.push(toSegment("NTE", segment));
    return this;
  }

  build(): VXU_V04_OBSERVATION {
    return this.group as VXU_V04_OBSERVATION;
  }
}

export interface VXU_V04_ORDER {
  orc: HL7v2Segment;
  timing?: VXU_V04_TIMING[];
  rxa: HL7v2Segment;
  rxr?: HL7v2Segment;
  observation?: VXU_V04_OBSERVATION[];
}

export class VXU_V04_ORDERBuilder {
  private group: Partial<VXU_V04_ORDER> = {};

  orc(segment: ORC): this {
    this.group.orc = toSegment("ORC", segment);
    return this;
  }

  addTIMING(group: VXU_V04_TIMING | ((builder: VXU_V04_TIMINGBuilder) => VXU_V04_TIMINGBuilder)): this {
    let g: VXU_V04_TIMING;
    if (typeof group === "function") g = group(new VXU_V04_TIMINGBuilder()).build();
    else g = group;
    if (!this.group.timing) this.group.timing = [];
    this.group.timing.push(g);
    return this;
  }

  rxa(segment: RXA): this {
    this.group.rxa = toSegment("RXA", segment);
    return this;
  }

  rxr(segment: RXR): this {
    this.group.rxr = toSegment("RXR", segment);
    return this;
  }

  addOBSERVATION(group: VXU_V04_OBSERVATION | ((builder: VXU_V04_OBSERVATIONBuilder) => VXU_V04_OBSERVATIONBuilder)): this {
    let g: VXU_V04_OBSERVATION;
    if (typeof group === "function") g = group(new VXU_V04_OBSERVATIONBuilder()).build();
    else g = group;
    if (!this.group.observation) this.group.observation = [];
    this.group.observation.push(g);
    return this;
  }

  build(): VXU_V04_ORDER {
    return this.group as VXU_V04_ORDER;
  }
}

/**
 * VXU_V04 Message Structure
 */
export interface VXU_V04_Message {
  msh: HL7v2Segment;
  sft?: HL7v2Segment[];
  pid: HL7v2Segment;
  pd1?: HL7v2Segment;
  nk1?: HL7v2Segment[];
  patient?: VXU_V04_PATIENT;
  gt1?: HL7v2Segment[];
  insurance?: VXU_V04_INSURANCE[];
  order?: VXU_V04_ORDER[];
}

/**
 * Builder for VXU_V04 messages
 */
export class VXU_V04Builder {
  private msg: Partial<VXU_V04_Message> = {};

  msh(segment: MSH): this {
    this.msg.msh = toSegment("MSH", segment);
    return this;
  }

  addSFT(segment: SFT): this {
    if (!this.msg.sft) this.msg.sft = [];
    this.msg.sft.push(toSegment("SFT", segment));
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

  addNK1(segment: NK1): this {
    if (!this.msg.nk1) this.msg.nk1 = [];
    this.msg.nk1.push(toSegment("NK1", segment));
    return this;
  }

  patient(group: VXU_V04_PATIENT | ((builder: VXU_V04_PATIENTBuilder) => VXU_V04_PATIENTBuilder)): this {
    if (typeof group === "function") this.msg.patient = group(new VXU_V04_PATIENTBuilder()).build();
    else this.msg.patient = group;
    return this;
  }

  addGT1(segment: GT1): this {
    if (!this.msg.gt1) this.msg.gt1 = [];
    this.msg.gt1.push(toSegment("GT1", segment));
    return this;
  }

  addINSURANCE(group: VXU_V04_INSURANCE | ((builder: VXU_V04_INSURANCEBuilder) => VXU_V04_INSURANCEBuilder)): this {
    let g: VXU_V04_INSURANCE;
    if (typeof group === "function") g = group(new VXU_V04_INSURANCEBuilder()).build();
    else g = group;
    if (!this.msg.insurance) this.msg.insurance = [];
    this.msg.insurance.push(g);
    return this;
  }

  addORDER(group: VXU_V04_ORDER | ((builder: VXU_V04_ORDERBuilder) => VXU_V04_ORDERBuilder)): this {
    let g: VXU_V04_ORDER;
    if (typeof group === "function") g = group(new VXU_V04_ORDERBuilder()).build();
    else g = group;
    if (!this.msg.order) this.msg.order = [];
    this.msg.order.push(g);
    return this;
  }

  build(): HL7v2Message {
    if (!this.msg.msh) throw new Error("VXU_V04: msh is required");
    if (!this.msg.pid) throw new Error("VXU_V04: pid is required");
    const segments: HL7v2Message = [];
    if (this.msg.msh) segments.push(this.msg.msh);
    if (this.msg.sft) for (const seg of this.msg.sft) segments.push(seg);
    if (this.msg.pid) segments.push(this.msg.pid);
    if (this.msg.pd1) segments.push(this.msg.pd1);
    if (this.msg.nk1) for (const seg of this.msg.nk1) segments.push(seg);
    if (this.msg.patient) {
      const group = this.msg.patient;
      if (group.pv1) segments.push(group.pv1);
      if (group.pv2) segments.push(group.pv2);
    }
    if (this.msg.gt1) for (const seg of this.msg.gt1) segments.push(seg);
    if (this.msg.insurance) for (const group of this.msg.insurance) {
      if (group.in1) segments.push(group.in1);
      if (group.in2) segments.push(group.in2);
      if (group.in3) segments.push(group.in3);
    }
    if (this.msg.order) for (const group of this.msg.order) {
      if (group.orc) segments.push(group.orc);
      if (group.timing) for (const subgroup of group.timing) {
        if (subgroup.tq1) segments.push(subgroup.tq1);
        if (subgroup.tq2) for (const seg of subgroup.tq2) segments.push(seg);
      }
      if (group.rxa) segments.push(group.rxa);
      if (group.rxr) segments.push(group.rxr);
      if (group.observation) for (const subgroup of group.observation) {
        if (subgroup.obx) segments.push(subgroup.obx);
        if (subgroup.nte) for (const seg of subgroup.nte) segments.push(seg);
      }
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

export interface ORU_R01_VISIT_Input {
  PV1: PV1;
  PV2?: PV2;
}

export interface ORU_R01_PATIENT_Input {
  PID: PID;
  PD1?: PD1;
  NTE?: NTE[];
  NK1?: NK1[];
  VISIT?: ORU_R01_VISIT_Input;
}

export interface ORU_R01_TIMING_QTY_Input {
  TQ1: TQ1;
  TQ2?: TQ2[];
}

export interface ORU_R01_OBSERVATION_Input {
  OBX: OBX;
  NTE?: NTE[];
}

export interface ORU_R01_SPECIMEN_Input {
  SPM: SPM;
  OBX?: OBX[];
}

export interface ORU_R01_ORDER_OBSERVATION_Input {
  ORC?: ORC;
  OBR: OBR;
  NTE?: NTE[];
  TIMING_QTY?: ORU_R01_TIMING_QTY_Input[];
  CTD?: CTD;
  OBSERVATION?: ORU_R01_OBSERVATION_Input[];
  FT1?: FT1[];
  CTI?: CTI[];
  SPECIMEN?: ORU_R01_SPECIMEN_Input[];
}

export interface ORU_R01_PATIENT_RESULT_Input {
  PATIENT?: ORU_R01_PATIENT_Input;
  ORDER_OBSERVATION: ORU_R01_ORDER_OBSERVATION_Input[];
}

/**
 * ORU_R01 Input - typed segment data
 */
export interface ORU_R01_Input {
  type: "ORU_R01";
  MSH: MSH;
  SFT?: SFT[];
  PATIENT_RESULT: ORU_R01_PATIENT_RESULT_Input[];
  DSC?: DSC;
}

/**
 * Convert ORU_R01_Input to HL7v2Message
 */
export function toORU_R01(input: ORU_R01_Input): HL7v2Message {
  const segments: HL7v2Message = [];
  if (input.MSH) segments.push(toSegment("MSH", input.MSH));
  if (input.SFT) for (const seg of input.SFT) segments.push(toSegment("SFT", seg));
  if (input.PATIENT_RESULT) for (const group of input.PATIENT_RESULT) {
    if (group.PATIENT) {
      const group = group.PATIENT;
      if (group.PID) segments.push(toSegment("PID", group.PID));
      if (group.PD1) segments.push(toSegment("PD1", group.PD1));
      if (group.NTE) for (const seg of group.NTE) segments.push(toSegment("NTE", seg));
      if (group.NK1) for (const seg of group.NK1) segments.push(toSegment("NK1", seg));
      if (group.VISIT) {
        const group = group.VISIT;
        if (group.PV1) segments.push(toSegment("PV1", group.PV1));
        if (group.PV2) segments.push(toSegment("PV2", group.PV2));
      }
    }
    if (group.ORDER_OBSERVATION) for (const group of group.ORDER_OBSERVATION) {
      if (group.ORC) segments.push(toSegment("ORC", group.ORC));
      if (group.OBR) segments.push(toSegment("OBR", group.OBR));
      if (group.NTE) for (const seg of group.NTE) segments.push(toSegment("NTE", seg));
      if (group.TIMING_QTY) for (const group of group.TIMING_QTY) {
        if (group.TQ1) segments.push(toSegment("TQ1", group.TQ1));
        if (group.TQ2) for (const seg of group.TQ2) segments.push(toSegment("TQ2", seg));
      }
      if (group.CTD) segments.push(toSegment("CTD", group.CTD));
      if (group.OBSERVATION) for (const group of group.OBSERVATION) {
        if (group.OBX) segments.push(toSegment("OBX", group.OBX));
        if (group.NTE) for (const seg of group.NTE) segments.push(toSegment("NTE", seg));
      }
      if (group.FT1) for (const seg of group.FT1) segments.push(toSegment("FT1", seg));
      if (group.CTI) for (const seg of group.CTI) segments.push(toSegment("CTI", seg));
      if (group.SPECIMEN) for (const group of group.SPECIMEN) {
        if (group.SPM) segments.push(toSegment("SPM", group.SPM));
        if (group.OBX) for (const seg of group.OBX) segments.push(toSegment("OBX", seg));
      }
    }
  }
  if (input.DSC) segments.push(toSegment("DSC", input.DSC));
  return segments;
}

export interface VXU_V04_PATIENT_Input {
  PV1: PV1;
  PV2?: PV2;
}

export interface VXU_V04_INSURANCE_Input {
  IN1: IN1;
  IN2?: IN2;
  IN3?: IN3;
}

export interface VXU_V04_TIMING_Input {
  TQ1: TQ1;
  TQ2?: TQ2[];
}

export interface VXU_V04_OBSERVATION_Input {
  OBX: OBX;
  NTE?: NTE[];
}

export interface VXU_V04_ORDER_Input {
  ORC: ORC;
  TIMING?: VXU_V04_TIMING_Input[];
  RXA: RXA;
  RXR?: RXR;
  OBSERVATION?: VXU_V04_OBSERVATION_Input[];
}

/**
 * VXU_V04 Input - typed segment data
 */
export interface VXU_V04_Input {
  type: "VXU_V04";
  MSH: MSH;
  SFT?: SFT[];
  PID: PID;
  PD1?: PD1;
  NK1?: NK1[];
  PATIENT?: VXU_V04_PATIENT_Input;
  GT1?: GT1[];
  INSURANCE?: VXU_V04_INSURANCE_Input[];
  ORDER?: VXU_V04_ORDER_Input[];
}

/**
 * Convert VXU_V04_Input to HL7v2Message
 */
export function toVXU_V04(input: VXU_V04_Input): HL7v2Message {
  const segments: HL7v2Message = [];
  if (input.MSH) segments.push(toSegment("MSH", input.MSH));
  if (input.SFT) for (const seg of input.SFT) segments.push(toSegment("SFT", seg));
  if (input.PID) segments.push(toSegment("PID", input.PID));
  if (input.PD1) segments.push(toSegment("PD1", input.PD1));
  if (input.NK1) for (const seg of input.NK1) segments.push(toSegment("NK1", seg));
  if (input.PATIENT) {
    const group = input.PATIENT;
    if (group.PV1) segments.push(toSegment("PV1", group.PV1));
    if (group.PV2) segments.push(toSegment("PV2", group.PV2));
  }
  if (input.GT1) for (const seg of input.GT1) segments.push(toSegment("GT1", seg));
  if (input.INSURANCE) for (const group of input.INSURANCE) {
    if (group.IN1) segments.push(toSegment("IN1", group.IN1));
    if (group.IN2) segments.push(toSegment("IN2", group.IN2));
    if (group.IN3) segments.push(toSegment("IN3", group.IN3));
  }
  if (input.ORDER) for (const group of input.ORDER) {
    if (group.ORC) segments.push(toSegment("ORC", group.ORC));
    if (group.TIMING) for (const group of group.TIMING) {
      if (group.TQ1) segments.push(toSegment("TQ1", group.TQ1));
      if (group.TQ2) for (const seg of group.TQ2) segments.push(toSegment("TQ2", seg));
    }
    if (group.RXA) segments.push(toSegment("RXA", group.RXA));
    if (group.RXR) segments.push(toSegment("RXR", group.RXR));
    if (group.OBSERVATION) for (const group of group.OBSERVATION) {
      if (group.OBX) segments.push(toSegment("OBX", group.OBX));
      if (group.NTE) for (const seg of group.NTE) segments.push(toSegment("NTE", seg));
    }
  }
  return segments;
}
