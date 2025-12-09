// AUTO-GENERATED from hl7v2/schema - do not edit manually
// Message builders for: BAR_P01
// Run: bun src/hl7v2/codegen.ts BAR_P01 --messages

import type { HL7v2Segment, HL7v2Message } from "./types";
import {
  ACCBuilder,
  AL1Builder,
  DB1Builder,
  DG1Builder,
  DRGBuilder,
  EVNBuilder,
  GT1Builder,
  IN1Builder,
  IN2Builder,
  IN3Builder,
  MSHBuilder,
  NK1Builder,
  OBXBuilder,
  PD1Builder,
  PIDBuilder,
  PR1Builder,
  PV1Builder,
  PV2Builder,
  ROLBuilder,
  SFTBuilder,
  UB1Builder,
  UB2Builder
} from "./fields";

export interface BAR_P01_PROCEDURE {
  pr1: HL7v2Segment;
  rol?: HL7v2Segment[];
}

export class BAR_P01_PROCEDUREBuilder {
  private group: Partial<BAR_P01_PROCEDURE> = {};

  pr1(segment: HL7v2Segment | PR1Builder | ((builder: PR1Builder) => PR1Builder)): this {
    if (typeof segment === "function") this.group.pr1 = segment(new PR1Builder()).build();
    else if (segment instanceof PR1Builder) this.group.pr1 = segment.build();
    else this.group.pr1 = segment;
    return this;
  }

  addROL(segment: HL7v2Segment | ROLBuilder | ((builder: ROLBuilder) => ROLBuilder)): this {
    let seg: HL7v2Segment;
    if (typeof segment === "function") seg = segment(new ROLBuilder()).build();
    else if (segment instanceof ROLBuilder) seg = segment.build();
    else seg = segment;
    if (!this.group.rol) this.group.rol = [];
    this.group.rol.push(seg);
    return this;
  }

  build(): BAR_P01_PROCEDURE { return this.group as BAR_P01_PROCEDURE; }
}

export interface BAR_P01_INSURANCE {
  in1: HL7v2Segment;
  in2?: HL7v2Segment;
  in3?: HL7v2Segment[];
  rol?: HL7v2Segment[];
}

export class BAR_P01_INSURANCEBuilder {
  private group: Partial<BAR_P01_INSURANCE> = {};

  in1(segment: HL7v2Segment | IN1Builder | ((builder: IN1Builder) => IN1Builder)): this {
    if (typeof segment === "function") this.group.in1 = segment(new IN1Builder()).build();
    else if (segment instanceof IN1Builder) this.group.in1 = segment.build();
    else this.group.in1 = segment;
    return this;
  }

  in2(segment: HL7v2Segment | IN2Builder | ((builder: IN2Builder) => IN2Builder)): this {
    if (typeof segment === "function") this.group.in2 = segment(new IN2Builder()).build();
    else if (segment instanceof IN2Builder) this.group.in2 = segment.build();
    else this.group.in2 = segment;
    return this;
  }

  addIN3(segment: HL7v2Segment | IN3Builder | ((builder: IN3Builder) => IN3Builder)): this {
    let seg: HL7v2Segment;
    if (typeof segment === "function") seg = segment(new IN3Builder()).build();
    else if (segment instanceof IN3Builder) seg = segment.build();
    else seg = segment;
    if (!this.group.in3) this.group.in3 = [];
    this.group.in3.push(seg);
    return this;
  }

  addROL(segment: HL7v2Segment | ROLBuilder | ((builder: ROLBuilder) => ROLBuilder)): this {
    let seg: HL7v2Segment;
    if (typeof segment === "function") seg = segment(new ROLBuilder()).build();
    else if (segment instanceof ROLBuilder) seg = segment.build();
    else seg = segment;
    if (!this.group.rol) this.group.rol = [];
    this.group.rol.push(seg);
    return this;
  }

  build(): BAR_P01_INSURANCE { return this.group as BAR_P01_INSURANCE; }
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

  pv1(segment: HL7v2Segment | PV1Builder | ((builder: PV1Builder) => PV1Builder)): this {
    if (typeof segment === "function") this.group.pv1 = segment(new PV1Builder()).build();
    else if (segment instanceof PV1Builder) this.group.pv1 = segment.build();
    else this.group.pv1 = segment;
    return this;
  }

  pv2(segment: HL7v2Segment | PV2Builder | ((builder: PV2Builder) => PV2Builder)): this {
    if (typeof segment === "function") this.group.pv2 = segment(new PV2Builder()).build();
    else if (segment instanceof PV2Builder) this.group.pv2 = segment.build();
    else this.group.pv2 = segment;
    return this;
  }

  addROL(segment: HL7v2Segment | ROLBuilder | ((builder: ROLBuilder) => ROLBuilder)): this {
    let seg: HL7v2Segment;
    if (typeof segment === "function") seg = segment(new ROLBuilder()).build();
    else if (segment instanceof ROLBuilder) seg = segment.build();
    else seg = segment;
    if (!this.group.rol) this.group.rol = [];
    this.group.rol.push(seg);
    return this;
  }

  addDB1(segment: HL7v2Segment | DB1Builder | ((builder: DB1Builder) => DB1Builder)): this {
    let seg: HL7v2Segment;
    if (typeof segment === "function") seg = segment(new DB1Builder()).build();
    else if (segment instanceof DB1Builder) seg = segment.build();
    else seg = segment;
    if (!this.group.db1) this.group.db1 = [];
    this.group.db1.push(seg);
    return this;
  }

  addOBX(segment: HL7v2Segment | OBXBuilder | ((builder: OBXBuilder) => OBXBuilder)): this {
    let seg: HL7v2Segment;
    if (typeof segment === "function") seg = segment(new OBXBuilder()).build();
    else if (segment instanceof OBXBuilder) seg = segment.build();
    else seg = segment;
    if (!this.group.obx) this.group.obx = [];
    this.group.obx.push(seg);
    return this;
  }

  addAL1(segment: HL7v2Segment | AL1Builder | ((builder: AL1Builder) => AL1Builder)): this {
    let seg: HL7v2Segment;
    if (typeof segment === "function") seg = segment(new AL1Builder()).build();
    else if (segment instanceof AL1Builder) seg = segment.build();
    else seg = segment;
    if (!this.group.al1) this.group.al1 = [];
    this.group.al1.push(seg);
    return this;
  }

  addDG1(segment: HL7v2Segment | DG1Builder | ((builder: DG1Builder) => DG1Builder)): this {
    let seg: HL7v2Segment;
    if (typeof segment === "function") seg = segment(new DG1Builder()).build();
    else if (segment instanceof DG1Builder) seg = segment.build();
    else seg = segment;
    if (!this.group.dg1) this.group.dg1 = [];
    this.group.dg1.push(seg);
    return this;
  }

  drg(segment: HL7v2Segment | DRGBuilder | ((builder: DRGBuilder) => DRGBuilder)): this {
    if (typeof segment === "function") this.group.drg = segment(new DRGBuilder()).build();
    else if (segment instanceof DRGBuilder) this.group.drg = segment.build();
    else this.group.drg = segment;
    return this;
  }

  addPROCEDURE(group: BAR_P01_PROCEDURE | BAR_P01_PROCEDUREBuilder | ((builder: BAR_P01_PROCEDUREBuilder) => BAR_P01_PROCEDUREBuilder)): this {
    let g: BAR_P01_PROCEDURE;
    if (typeof group === "function") g = group(new BAR_P01_PROCEDUREBuilder()).build();
    else if (group instanceof BAR_P01_PROCEDUREBuilder) g = group.build();
    else g = group;
    if (!this.group.procedure) this.group.procedure = [];
    this.group.procedure.push(g);
    return this;
  }

  addGT1(segment: HL7v2Segment | GT1Builder | ((builder: GT1Builder) => GT1Builder)): this {
    let seg: HL7v2Segment;
    if (typeof segment === "function") seg = segment(new GT1Builder()).build();
    else if (segment instanceof GT1Builder) seg = segment.build();
    else seg = segment;
    if (!this.group.gt1) this.group.gt1 = [];
    this.group.gt1.push(seg);
    return this;
  }

  addNK1(segment: HL7v2Segment | NK1Builder | ((builder: NK1Builder) => NK1Builder)): this {
    let seg: HL7v2Segment;
    if (typeof segment === "function") seg = segment(new NK1Builder()).build();
    else if (segment instanceof NK1Builder) seg = segment.build();
    else seg = segment;
    if (!this.group.nk1) this.group.nk1 = [];
    this.group.nk1.push(seg);
    return this;
  }

  addINSURANCE(group: BAR_P01_INSURANCE | BAR_P01_INSURANCEBuilder | ((builder: BAR_P01_INSURANCEBuilder) => BAR_P01_INSURANCEBuilder)): this {
    let g: BAR_P01_INSURANCE;
    if (typeof group === "function") g = group(new BAR_P01_INSURANCEBuilder()).build();
    else if (group instanceof BAR_P01_INSURANCEBuilder) g = group.build();
    else g = group;
    if (!this.group.insurance) this.group.insurance = [];
    this.group.insurance.push(g);
    return this;
  }

  acc(segment: HL7v2Segment | ACCBuilder | ((builder: ACCBuilder) => ACCBuilder)): this {
    if (typeof segment === "function") this.group.acc = segment(new ACCBuilder()).build();
    else if (segment instanceof ACCBuilder) this.group.acc = segment.build();
    else this.group.acc = segment;
    return this;
  }

  ub1(segment: HL7v2Segment | UB1Builder | ((builder: UB1Builder) => UB1Builder)): this {
    if (typeof segment === "function") this.group.ub1 = segment(new UB1Builder()).build();
    else if (segment instanceof UB1Builder) this.group.ub1 = segment.build();
    else this.group.ub1 = segment;
    return this;
  }

  ub2(segment: HL7v2Segment | UB2Builder | ((builder: UB2Builder) => UB2Builder)): this {
    if (typeof segment === "function") this.group.ub2 = segment(new UB2Builder()).build();
    else if (segment instanceof UB2Builder) this.group.ub2 = segment.build();
    else this.group.ub2 = segment;
    return this;
  }

  build(): BAR_P01_VISIT { return this.group as BAR_P01_VISIT; }
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

export class BAR_P01Builder {
  private msg: Partial<BAR_P01_Message> = {};

  msh(segment: HL7v2Segment | MSHBuilder | ((builder: MSHBuilder) => MSHBuilder)): this {
    if (typeof segment === "function") this.msg.msh = segment(new MSHBuilder()).build();
    else if (segment instanceof MSHBuilder) this.msg.msh = segment.build();
    else this.msg.msh = segment;
    return this;
  }

  addSFT(segment: HL7v2Segment | SFTBuilder | ((builder: SFTBuilder) => SFTBuilder)): this {
    let seg: HL7v2Segment;
    if (typeof segment === "function") seg = segment(new SFTBuilder()).build();
    else if (segment instanceof SFTBuilder) seg = segment.build();
    else seg = segment;
    if (!this.msg.sft) this.msg.sft = [];
    this.msg.sft.push(seg);
    return this;
  }

  evn(segment: HL7v2Segment | EVNBuilder | ((builder: EVNBuilder) => EVNBuilder)): this {
    if (typeof segment === "function") this.msg.evn = segment(new EVNBuilder()).build();
    else if (segment instanceof EVNBuilder) this.msg.evn = segment.build();
    else this.msg.evn = segment;
    return this;
  }

  pid(segment: HL7v2Segment | PIDBuilder | ((builder: PIDBuilder) => PIDBuilder)): this {
    if (typeof segment === "function") this.msg.pid = segment(new PIDBuilder()).build();
    else if (segment instanceof PIDBuilder) this.msg.pid = segment.build();
    else this.msg.pid = segment;
    return this;
  }

  pd1(segment: HL7v2Segment | PD1Builder | ((builder: PD1Builder) => PD1Builder)): this {
    if (typeof segment === "function") this.msg.pd1 = segment(new PD1Builder()).build();
    else if (segment instanceof PD1Builder) this.msg.pd1 = segment.build();
    else this.msg.pd1 = segment;
    return this;
  }

  addROL(segment: HL7v2Segment | ROLBuilder | ((builder: ROLBuilder) => ROLBuilder)): this {
    let seg: HL7v2Segment;
    if (typeof segment === "function") seg = segment(new ROLBuilder()).build();
    else if (segment instanceof ROLBuilder) seg = segment.build();
    else seg = segment;
    if (!this.msg.rol) this.msg.rol = [];
    this.msg.rol.push(seg);
    return this;
  }

  addVISIT(group: BAR_P01_VISIT | BAR_P01_VISITBuilder | ((builder: BAR_P01_VISITBuilder) => BAR_P01_VISITBuilder)): this {
    let g: BAR_P01_VISIT;
    if (typeof group === "function") g = group(new BAR_P01_VISITBuilder()).build();
    else if (group instanceof BAR_P01_VISITBuilder) g = group.build();
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

