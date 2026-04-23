// Simulate Sender — 3 variations

// ── V1: Refined current layout (editor + samples sidebar + ACK)
const SimulateV1 = () => (
  <Screen nav="simulate" title="Simulate Sender" subtitle="Send HL7v2 messages via MLLP protocol"
    right={<span className="wf-chip wf-chip-ghost"><Ico name="link" size={11}/> mllp://localhost:2575</span>}>
    <Row style={{gap:14, height:'100%'}}>
      <Col style={{flex:1.4, gap:12}}>
        {/* Editor */}
        <Col style={{flex:1, gap:6}}>
          <Row style={{justifyContent:'space-between', alignItems:'center'}}>
            <Row style={{gap:8, alignItems:'center'}}>
              <div className="wf-label" style={{margin:0}}>HL7v2 message</div>
              <span className="wf-chip wf-chip-ghost" style={{fontSize:11}}><Ico name="link" size={10}/> localhost:2575 <span style={{opacity:.6}}>· edit</span></span>
            </Row>
            <Row style={{gap:12}}>
              <span className="wf-tab wf-tab-on" style={{padding:'2px 0', fontSize:13}}>Edit</span>
              <span className="wf-tab" style={{padding:'2px 0', fontSize:13}}>Preview</span>
              <span className="wf-tab" style={{padding:'2px 0', fontSize:13}}>Structured</span>
            </Row>
          </Row>
          <div className="wf-box" style={{flex:1, padding:'8px 10px', background:WF.paper, overflow:'auto'}}>
            <Col style={{gap:2}} className="wf-mono">
              {['MSH|^~\\&|ACME_LAB|ACME_HOSP|EMR|DEST|20260422101845|ORU^R01|MSG177…|P|2.5.1',
                'PID|1||TEST-0003^^^HOSPITAL^MR||TESTPATIENT^GAMMA||19901225|M',
                'PV1|1|O|LAB||||||||||||||||||VN125726',
                'ORC|RE|ORD003|FIL003',
                'OBR|1|ORD003|FIL003|CHEM7^CHEMISTRY PANEL^LOCAL|||20260422101854||||||||||||PROV008^LAB^DOCTOR',
                'OBX|1|NM|UNKNOWN_TEST^Unknown Lab Test^LOCAL||123|units|0-200|||F|…'].map((l,i) => (
                  <Row key={i} style={{gap:8}}>
                    <span className="wf-mono wf-tiny" style={{width:20, textAlign:'right', color:WF.ink3}}>{i+1}</span>
                    <span style={{fontSize:11, whiteSpace:'pre'}}>
                      <span style={{color:WF.accent, fontWeight:600}}>{l.slice(0,3)}</span>{l.slice(3)}
                    </span>
                  </Row>
              ))}
            </Col>
          </div>
          <div className="wf-tiny">Use \r for segment separators or paste multi-line message</div>
        </Col>

        <Row style={{gap:8, alignItems:'center'}}>
          <button className="wf-btn wf-btn-accent"><Ico name="bolt" size={12} color="white"/> Send via MLLP</button>
          <button className="wf-btn">Clear</button>
          <div style={{flex:1}}/>
          <span className="wf-tiny">⌘↵ to send</span>
        </Row>

        {/* ACK banner — shows AFTER send, so it sits below the editor */}
        <div className="wf-box" style={{padding:'10px 14px', background:'#e3f3e8', borderColor:'#7fbf9a'}}>
          <Row style={{gap:8, alignItems:'center'}}>
            <Ico name="check" size={14} color="#1f6a3a"/>
            <span className="wf-hand" style={{fontSize:16, fontWeight:600, color:'#1f6a3a'}}>Message sent — ACK received</span>
            <span className="wf-tiny" style={{marginLeft:'auto'}}>120 ms roundtrip</span>
          </Row>
          <Col className="wf-mono" style={{fontSize:11, marginTop:6, color:WF.ink2, background:WF.paper, padding:'6px 8px', borderRadius:4}}>
            <div>MSH|^~\&|DEST|ACME_LAB|ACME_HOSP|20260422101854|ACK|…|P|2.4</div>
            <div>MSA|AA|MSG1776853125726</div>
          </Col>
        </div>
      </Col>

      {/* Samples sidebar */}
      <Col style={{width:280, gap:10}}>
        <div className="wf-box" style={{padding:'10px 12px', background:WF.paper}}>
          <div className="wf-h3" style={{marginBottom:6}}>Sample messages</div>
          <Col style={{gap:2}}>
            {[
              ['ADT (Admit/Discharge/Transfer)', ['A01 · Admit · Simple', 'A01 · Admit · Full', 'A08 · Update']],
              ['BAR (Billing)', []],
              ['ORM (Orders)', ['O01 · New order']],
              ['ORU (Observation)', ['R01 · Inline LOINC', 'R01 · Known LOINC', 'R01 · Unknown LOINC']],
              ['VXU (Vaccination)', []],
            ].map(([g,items],gi) => (
              <Col key={gi}>
                <Row style={{padding:'4px 2px', justifyContent:'space-between', cursor:'pointer'}}>
                  <Row style={{gap:5}}><Ico name={items.length?'chevD':'chev'} size={11}/><span className="wf-body" style={{fontWeight:500}}>{g}</span></Row>
                </Row>
                {items.map((it,i) => (
                  <Row key={i} style={{padding:'3px 0 3px 20px'}}>
                    <span className={'wf-body ' + (it.includes('Unknown')?'wf-accent-ink':'')} style={{fontWeight: it.includes('Unknown')?600:400}}>{it}</span>
                  </Row>
                ))}
              </Col>
            ))}
          </Col>
        </div>

        <div className="wf-box" style={{padding:'10px 12px', background:'#edf2fb', borderColor:'#8aa7cc'}}>
          <div className="wf-h3" style={{color:'#2a4a7a'}}>MLLP protocol</div>
          <Col className="wf-mono" style={{fontSize:11, marginTop:4, gap:2, color:'#2a4a7a'}}>
            <div>Start block: VT (0x0B)</div>
            <div>End block: FS + CR (0x1C 0x0D)</div>
            <div>Default port: 2575</div>
          </Col>
        </div>

        <div className="wf-box" style={{padding:'10px 12px', background:'#fef8d6', borderColor:'#e0b85a'}}>
          <div className="wf-h3" style={{color:'#7a5a0a'}}>Start MLLP server</div>
          <div className="wf-mono" style={{fontSize:11, marginTop:4, color:'#7a5a0a'}}>bun run mllp</div>
        </div>
      </Col>
    </Row>
  </Screen>
);

// ── V1-Preview: same editor layout, Preview tab active (rendered / highlighted)
const SimulateV1Preview = () => (
  <Screen nav="simulate" title="Simulate Sender" subtitle="Preview tab — see the message as it'll be sent, rendered"
    right={<span className="wf-chip wf-chip-ghost"><Ico name="link" size={11}/> mllp://localhost:2575</span>}>
    <Row style={{gap:14, height:'100%'}}>
      <Col style={{flex:1.4, gap:12}}>
        <Col style={{flex:1, gap:6}}>
          <Row style={{justifyContent:'space-between', alignItems:'center'}}>
            <Row style={{gap:8, alignItems:'center'}}>
              <div className="wf-label" style={{margin:0}}>HL7v2 message</div>
              <span className="wf-chip wf-chip-ghost" style={{fontSize:11}}><Ico name="link" size={10}/> localhost:2575 <span style={{opacity:.6}}>· edit</span></span>
            </Row>
            <Row style={{gap:12}}>
              <span className="wf-tab" style={{padding:'2px 0', fontSize:13}}>Edit</span>
              <span className="wf-tab wf-tab-on" style={{padding:'2px 0', fontSize:13}}>Preview</span>
              <span className="wf-tab" style={{padding:'2px 0', fontSize:13}}>Structured</span>
            </Row>
          </Row>
          <div className="wf-box" style={{flex:1, padding:'12px 14px', background:WF.paper, overflow:'auto'}}>
            <div className="wf-tiny" style={{marginBottom:8}}>read-only · MLLP-framed · 0x0B … 0x1C 0x0D</div>
            <Col style={{gap:4}} className="wf-mono">
              {[
                {seg:'MSH', fields:[['|^~\\&','encoding'],['ACME_LAB','sender app'],['ACME_HOSP','sender fac'],['EMR','receiver app'],['DEST','receiver fac'],['20260422101845','timestamp'],['','security'],['ORU^R01','message type'],['MSG17768…','control id'],['P','processing id'],['2.5.1','version']]},
                {seg:'PID', fields:[['1','set id'],['','patient id'],['TEST-0003^^^HOSPITAL^MR','MRN'],['','alt id'],['TESTPATIENT^GAMMA','name'],['','mother'],['19901225','DOB'],['M','sex']]},
                {seg:'PV1', fields:[['1','set id'],['O','class · outpatient'],['LAB','assigned loc']]},
                {seg:'ORC', fields:[['RE','order ctrl'],['ORD003','placer'],['FIL003','filler']]},
                {seg:'OBR', fields:[['1','set id'],['ORD003',''],['FIL003',''],['CHEM7^CHEMISTRY PANEL^LOCAL','panel']]},
                {seg:'OBX', fields:[['1','set id'],['NM','value type'],['UNKNOWN_TEST^Unknown Lab Test^LOCAL','code'],['','sub-id'],['123','value'],['units','unit'],['0-200','ref range']], warn:true},
              ].map((s,i) => (
                <Col key={i} style={{borderLeft:`3px solid ${s.warn? '#e0b85a' : WF.accent}`, paddingLeft:10, paddingBottom:4}}>
                  <Row style={{gap:8, alignItems:'baseline'}}>
                    <span style={{color:WF.accent, fontWeight:700, fontSize:12}}>{s.seg}</span>
                    {s.warn && <span className="wf-chip" style={{fontSize:10, background:'#fef3d6', borderColor:'#e0b85a', color:'#7a5a0a', padding:'0 6px'}}>no LOINC</span>}
                  </Row>
                  <Row className="wf-hscroll" style={{gap:4, marginTop:2, overflowX:'scroll', overflowY:'hidden', flexWrap:'nowrap', paddingBottom:6}}>
                    {s.fields.map((f,fi) => (
                      <Row key={fi} style={{gap:0, alignItems:'center', flex:'0 0 auto'}}>
                        {fi>0 && <span style={{color:WF.ink3, padding:'0 2px'}}>|</span>}
                        <Col style={{gap:0, flex:'0 0 auto'}}>
                          <span className="wf-tiny" style={{fontFamily:WF.sans, color:WF.ink3, fontSize:9, whiteSpace:'nowrap'}}>{f[1]}</span>
                          <span style={{fontSize:11, color: f[0]? WF.ink : WF.ink3, whiteSpace:'nowrap'}}>{f[0] || '—'}</span>
                        </Col>
                      </Row>
                    ))}
                  </Row>
                </Col>
              ))}
            </Col>
          </div>
          <div className="wf-tiny">hover a field in Edit tab to see its label here · this view is not editable</div>
        </Col>

        <Row style={{gap:8}}>
          <button className="wf-btn wf-btn-accent"><Ico name="bolt" size={12} color="white"/> Send via MLLP</button>
          <button className="wf-btn">Back to Edit</button>
          <div style={{flex:1}}/>
          <span className="wf-tiny">⌘↵ to send</span>
        </Row>
      </Col>

      <Col style={{width:280, gap:10}}>
        <div className="wf-box" style={{padding:'10px 12px', background:WF.paper}}>
          <div className="wf-h3" style={{marginBottom:6}}>Validation</div>
          <Col style={{gap:6}}>
            {[
              ['MSH complete', true],
              ['PID has MRN + name + DOB', true],
              ['Observation codes resolved', false, 'UNKNOWN_TEST has no LOINC mapping'],
              ['MLLP framing ok', true],
            ].map(([l,ok,sub],i) => (
              <Col key={i} style={{gap:2}}>
                <Row style={{gap:6}}>
                  <Ico name={ok?'check':'warn'} size={11} color={ok?'#3fb56b':'#b88a1a'}/>
                  <span className="wf-body">{l}</span>
                </Row>
                {sub && <span className="wf-tiny" style={{paddingLeft:17, color:'#7a5a0a'}}>{sub}</span>}
              </Col>
            ))}
          </Col>
        </div>
        <div className="wf-box" style={{padding:'10px 12px', background:WF.mutedBg}}>
          <div className="wf-h3" style={{marginBottom:4}}>Wire size</div>
          <Row style={{gap:6, alignItems:'baseline'}}>
            <span className="wf-hand" style={{fontSize:22, fontWeight:600}}>487</span>
            <span className="wf-tiny">bytes · 6 segments · 34 fields populated</span>
          </Row>
        </div>
      </Col>
    </Row>
  </Screen>
);

// ── V1-Structured: same editor layout, Structured tab active (segment tree)
const SimulateV1Structured = () => (
  <Screen nav="simulate" title="Simulate Sender" subtitle="Structured tab — edit segments as a tree, not a string"
    right={<span className="wf-chip wf-chip-ghost"><Ico name="link" size={11}/> mllp://localhost:2575</span>}>
    <Row style={{gap:14, height:'100%'}}>
      <Col style={{flex:1.4, gap:12}}>
        <Col style={{flex:1, gap:6}}>
          <Row style={{justifyContent:'space-between', alignItems:'center'}}>
            <Row style={{gap:8, alignItems:'center'}}>
              <div className="wf-label" style={{margin:0}}>HL7v2 message</div>
              <span className="wf-chip wf-chip-ghost" style={{fontSize:11}}><Ico name="link" size={10}/> localhost:2575 <span style={{opacity:.6}}>· edit</span></span>
            </Row>
            <Row style={{gap:12}}>
              <span className="wf-tab" style={{padding:'2px 0', fontSize:13}}>Edit</span>
              <span className="wf-tab" style={{padding:'2px 0', fontSize:13}}>Preview</span>
              <span className="wf-tab wf-tab-on" style={{padding:'2px 0', fontSize:13}}>Structured</span>
            </Row>
          </Row>
          <div className="wf-box" style={{flex:1, padding:'6px 0', background:WF.paper, overflow:'auto'}}>
            {[
              {seg:'MSH', desc:'Message header', fields:[
                ['MSH-3','Sending application','ACME_LAB'],
                ['MSH-5','Receiving application','EMR'],
                ['MSH-7','Timestamp','20260422101845'],
                ['MSH-9','Message type','ORU^R01'],
                ['MSH-12','Version','2.5.1'],
              ], open:true},
              {seg:'PID', desc:'Patient identification', fields:[
                ['PID-3','Patient ID','TEST-0003'],
                ['PID-5','Patient name','TESTPATIENT^GAMMA'],
                ['PID-7','Date of birth','19901225'],
                ['PID-8','Sex','M'],
              ], open:true},
              {seg:'PV1', desc:'Patient visit', fields:[], open:false},
              {seg:'ORC', desc:'Common order', fields:[], open:false},
              {seg:'OBR', desc:'Observation request', fields:[
                ['OBR-4','Universal service ID','CHEM7^CHEMISTRY PANEL^LOCAL'],
              ], open:true},
              {seg:'OBX', desc:'Observation/result', fields:[
                ['OBX-2','Value type','NM'],
                ['OBX-3','Observation ID','UNKNOWN_TEST^Unknown Lab Test^LOCAL', true],
                ['OBX-5','Value','123'],
                ['OBX-6','Units','units'],
              ], open:true, warn:true},
            ].map((s,i) => (
              <Col key={i} style={{borderBottom:`1px dashed ${WF.lineLight}`}}>
                <Row style={{padding:'7px 12px', gap:10, background: s.warn? '#fef8d6' : 'transparent', alignItems:'center'}}>
                  <Ico name={s.open? 'chevD':'chev'} size={11}/>
                  <span className="wf-mono" style={{width:42, color:WF.accent, fontWeight:700, fontSize:12}}>{s.seg}</span>
                  <span className="wf-body" style={{flex:1, color:WF.ink2}}>{s.desc}</span>
                  {s.warn && <span className="wf-chip" style={{fontSize:10, background:'#fef3d6', borderColor:'#e0b85a', color:'#7a5a0a'}}>1 warning</span>}
                  <span className="wf-tiny">{s.fields.length || '—'} fields</span>
                  <Ico name="dots" size={11}/>
                </Row>
                {s.open && s.fields.map((f,fi) => (
                  <Row key={fi} style={{padding:'4px 12px 4px 44px', gap:10, alignItems:'center'}}>
                    <span className="wf-mono wf-tiny" style={{width:70, color:WF.ink3}}>{f[0]}</span>
                    <span className="wf-label" style={{width:170}}>{f[1]}</span>
                    <div className="wf-box" style={{flex:1, padding:'3px 8px', background: f[3]? '#fef8d6' : WF.paper, borderColor: f[3]? '#e0b85a':WF.lineLight}}>
                      <span className="wf-mono" style={{fontSize:12}}>{f[2]}</span>
                    </div>
                    {f[3] && <span className="wf-tiny" style={{color:'#7a5a0a'}}>no mapping</span>}
                  </Row>
                ))}
                {s.open && s.fields.length===0 && <Row style={{padding:'4px 12px 6px 44px'}}><span className="wf-tiny">empty — <u>add field</u></span></Row>}
              </Col>
            ))}
          </div>
          <div className="wf-tiny">tree view · click a field to edit · changes sync to Edit/Preview</div>
        </Col>

        <Row style={{gap:8}}>
          <button className="wf-btn wf-btn-accent"><Ico name="bolt" size={12} color="white"/> Send via MLLP</button>
          <button className="wf-btn">Add segment</button>
          <button className="wf-btn">Validate</button>
          <div style={{flex:1}}/>
          <span className="wf-tiny">1 warning · 0 errors</span>
        </Row>
      </Col>

      <Col style={{width:280, gap:10}}>
        <div className="wf-box" style={{padding:'10px 12px', background:WF.paper}}>
          <div className="wf-h3" style={{marginBottom:6}}>Add segment</div>
          <Col style={{gap:2}}>
            {['NK1 · Next of kin','AL1 · Allergy','DG1 · Diagnosis','IN1 · Insurance','NTE · Notes','SPM · Specimen'].map((t,i) => (
              <Row key={i} style={{padding:'3px 0', gap:6}}>
                <Ico name="plus" size={10}/>
                <span className="wf-body">{t}</span>
              </Row>
            ))}
          </Col>
        </div>
        <div className="wf-box" style={{padding:'10px 12px', background:WF.accentSoft, borderColor:WF.accent}}>
          <div className="wf-h3" style={{color:WF.accent, marginBottom:4}}>Why structured?</div>
          <div className="wf-note" style={{color:WF.ink}}>Non-technical users can build messages without touching pipes, carets, or tildes. Under the hood it's the same HL7v2.</div>
        </div>
      </Col>
    </Row>
  </Screen>
);

// ── V2: Form-builder mode — non-technical friendly, build a message from fields
const SimulateV2 = () => (
  <Screen nav="simulate" title="Simulate Sender" subtitle="Build a message from fields — we'll handle the pipes">
    <Col style={{gap:12, height:'100%'}}>
      <Row style={{gap:10}}>
        <span className="wf-tab" style={{padding:'4px 0'}}>Raw paste</span>
        <span className="wf-tab wf-tab-on" style={{padding:'4px 0'}}>Builder</span>
        <span className="wf-tab" style={{padding:'4px 0'}}>From sample</span>
        <div style={{flex:1}}/>
        <span className="wf-chip"><Ico name="link" size={11}/> localhost:2575</span>
      </Row>

      <Row style={{gap:14, flex:1, overflow:'hidden'}}>
        <Col style={{flex:1.2, gap:12, overflow:'auto'}}>
          {/* Scenario picker */}
          <Col style={{gap:6}}>
            <div className="wf-label">Scenario</div>
            <Row style={{gap:6}}>
              {['Admit patient','Lab result','Vaccination','Discharge','Order','Custom'].map((t,i) => (
                <span key={i} className={'wf-chip ' + (i===1?'wf-chip-accent':'')}>{t}</span>
              ))}
            </Row>
          </Col>
          <div className="wf-divider"/>

          {/* Builder sections */}
          <BuilderSection title="Message header · MSH" segs="MSH" accent>
            <BuilderRow label="Sender" v="ACME_LAB"/>
            <BuilderRow label="Receiver" v="ACME_HOSP"/>
            <BuilderRow label="Type" v="ORU^R01 · Observation Result"/>
            <BuilderRow label="HL7 version" v="2.5.1"/>
          </BuilderSection>

          <BuilderSection title="Patient · PID" segs="PID">
            <BuilderRow label="MRN" v="TEST-0003"/>
            <BuilderRow label="Name" v="TESTPATIENT · GAMMA"/>
            <BuilderRow label="Birth" v="1990-12-25 · M"/>
          </BuilderSection>

          <BuilderSection title="Order · ORC / OBR" segs="ORC · OBR">
            <BuilderRow label="Panel" v="CHEM7 · Chemistry Panel"/>
            <BuilderRow label="Provider" v="PROV008 · Dr. Lab"/>
          </BuilderSection>

          <BuilderSection title="Observations · OBX" segs="OBX × 1" warning>
            <Row style={{padding:'6px 10px', gap:10}}>
              <span className="wf-chip wf-chip-accent" style={{padding:'1px 8px'}}>1</span>
              <span className="wf-mono" style={{fontSize:11, flex:1}}>UNKNOWN_TEST · Unknown Lab Test</span>
              <span className="wf-mono wf-tiny">123 units</span>
              <span className="wf-chip" style={{fontSize:11, background:'#fef3d6', borderColor:'#e0b85a', color:'#7a5a0a'}}>no LOINC mapping</span>
            </Row>
            <Row style={{padding:'4px 10px 8px'}}><span className="wf-chip wf-chip-ghost"><Ico name="plus" size={10}/> add observation</span></Row>
          </BuilderSection>

          <Row style={{gap:8}}>
            <button className="wf-btn wf-btn-accent"><Ico name="bolt" size={12} color="white"/> Send via MLLP</button>
            <button className="wf-btn">Clear fields</button>
            <button className="wf-btn">Copy as raw</button>
          </Row>
        </Col>

        {/* Live preview */}
        <Col style={{flex:1, gap:8}}>
          <Row style={{justifyContent:'space-between'}}>
            <div className="wf-label">Live preview</div>
            <span className="wf-tiny">updates as you type</span>
          </Row>
          <div className="wf-box" style={{flex:1, padding:'10px 12px', background:WF.paper, overflow:'auto'}}>
            <Col className="wf-mono" style={{fontSize:11, gap:3}}>
              {['MSH|^~\\&|ACME_LAB|ACME_HOSP|EMR|DEST|20260422|ORU^R01|MSG…|P|2.5.1',
                'PID|1||TEST-0003^^^HOSPITAL^MR||TESTPATIENT^GAMMA||19901225|M',
                'ORC|RE|ORD003|FIL003',
                'OBR|1|ORD003|FIL003|CHEM7^CHEMISTRY PANEL^LOCAL|…|PROV008',
                'OBX|1|NM|UNKNOWN_TEST^Unknown Lab Test^LOCAL||123|units|…'].map((s,i) => (
                  <Row key={i} style={{gap:8, alignItems:'center'}}>
                    <span style={{width:20, color:WF.ink3}}>{i+1}</span>
                    <span style={{whiteSpace:'pre'}}>
                      <span style={{color:WF.accent, fontWeight:600}}>{s.slice(0,3)}</span>{s.slice(3)}
                    </span>
                  </Row>
                ))}
            </Col>
          </div>
          <div className="wf-box" style={{padding:'8px 10px', background:WF.mutedBg}}>
            <Row style={{gap:8}}>
              <Ico name="info" size={12} color={WF.accent}/>
              <span className="wf-body">This message will trigger the <b>Unmapped Codes</b> queue because <span className="wf-mono">UNKNOWN_TEST</span> is not in the Terminology Map.</span>
            </Row>
          </div>
        </Col>
      </Row>
    </Col>
  </Screen>
);

const BuilderSection = ({title, segs, children, accent, warning}) => (
  <div className="wf-box" style={{background:WF.paper, borderColor: warning? '#e0b85a' : (accent? WF.accent : WF.lineMid)}}>
    <Row style={{padding:'8px 12px', justifyContent:'space-between', borderBottom:`1px dashed ${WF.lineLight}`}}>
      <Row style={{gap:6}}><Ico name="chevD" size={11}/><span className="wf-h3">{title}</span></Row>
      <span className="wf-mono wf-tiny">{segs}</span>
    </Row>
    <Col style={{padding:'4px 0'}}>{children}</Col>
  </div>
);

const BuilderRow = ({label, v}) => (
  <Row style={{padding:'5px 12px', gap:10}}>
    <span className="wf-label" style={{width:110}}>{label}</span>
    <span className="wf-mono" style={{fontSize:12, flex:1}}>{v}</span>
  </Row>
);

// ── V3: "Replay a recording" — pick a scenario, watch it play
const SimulateV3 = () => (
  <Screen nav="simulate" title="Replay scenarios" subtitle="Curated demo sequences · hit play to stream them through MLLP">
    <Col style={{gap:14, height:'100%'}}>
      <Row style={{gap:12}}>
        {[
          {name:'New patient admit', t:'4 messages', d:'ADT^A01 · ORU^R01 × 2 · ADT^A03', st:'ready'},
          {name:'Unknown lab code', t:'1 message', d:'ORU with UNKNOWN_TEST — demonstrates triage', st:'ready', accent:true},
          {name:'Billing round-trip', t:'3 messages', d:'BAR_P01 → account → outbound', st:'ready'},
          {name:'Full happy-path demo', t:'8 messages', d:'Everything green · 2s spacing', st:'last'},
        ].map((s,i) => (
          <div key={i} className="wf-box" style={{flex:1, padding:'12px 14px', background: s.accent? WF.accentSoft : WF.paper, borderColor: s.accent? WF.accent : WF.line}}>
            <Row style={{justifyContent:'space-between'}}>
              <div className="wf-h3">{s.name}</div>
              <span className="wf-tiny">{s.t}</span>
            </Row>
            <div className="wf-note" style={{marginTop:4, minHeight:28}}>{s.d}</div>
            <Row style={{gap:6, marginTop:8}}>
              <button className="wf-btn" style={{padding:'3px 10px', fontSize:13}}><Ico name="play" size={10}/> Run</button>
              {s.st==='last' && <span className="wf-tiny">last: 4m ago ✓</span>}
            </Row>
          </div>
        ))}
      </Row>

      <div className="wf-box" style={{flex:1, padding:'14px 18px', background:WF.paper, display:'flex', flexDirection:'column', gap:10}}>
        <Row style={{justifyContent:'space-between'}}>
          <Col style={{gap:2}}>
            <div className="wf-h2">Unknown lab code · 1 message</div>
            <div className="wf-note">Sends 1 ORU^R01 with a LOINC-less OBX so you can walk the unmapped-code triage workflow.</div>
          </Col>
          <Row style={{gap:8}}>
            <button className="wf-btn"><Ico name="pause" size={11}/> Pause</button>
            <button className="wf-btn wf-btn-accent"><Ico name="play" size={11} color="white"/> Run</button>
          </Row>
        </Row>

        {/* Playback track */}
        <div className="wf-box-dashed" style={{padding:'18px 20px', position:'relative'}}>
          <div style={{position:'absolute', top:'50%', left:20, right:20, height:2, background:WF.lineLight}}/>
          <Row style={{justifyContent:'space-between', position:'relative'}}>
            {[
              {t:'0s', label:'Start', done:true},
              {t:'+1s', label:'Connect MLLP', done:true},
              {t:'+2s', label:'Send ORU^R01', done:true, accent:true},
              {t:'+3s', label:'Await ACK', done:false, active:true},
              {t:'+4s', label:'Verify in queue', done:false},
              {t:'+5s', label:'Code lands in triage', done:false},
            ].map((p,i) => (
              <Col key={i} style={{alignItems:'center', gap:4, minWidth:80}}>
                <div className="wf-mono wf-tiny">{p.t}</div>
                <div className="wf-box" style={{width:14, height:14, borderRadius:99, background: p.done? WF.accent : (p.active? WF.paper : WF.paper), borderColor: p.active? WF.accent : (p.done? WF.ink : WF.line), boxShadow: p.active? `0 0 0 3px ${WF.accentSoft}` : 'none'}}/>
                <div className="wf-body" style={{textAlign:'center', fontSize:12, maxWidth:90}}>{p.label}</div>
              </Col>
            ))}
          </Row>
        </div>

        {/* Log panel */}
        <Col style={{flex:1, overflow:'hidden'}}>
          <div className="wf-label">Stream log</div>
          <Col className="wf-mono" style={{fontSize:11, gap:2, marginTop:4, overflow:'auto'}}>
            {[
              ['14:19:44','→','TCP connect localhost:2575'],
              ['14:19:44','→','MLLP VT start block'],
              ['14:19:45','→','MSH|^~\\&|ACME_LAB|ACME_HOSP|…'],
              ['14:19:45','→','OBX|1|NM|UNKNOWN_TEST^Unknown Lab Test^LOCAL|…'],
              ['14:19:45','←','MSA|AA|MSG1776853125726 — ACK received'],
              ['14:19:46','•','Inbound queue accepted · id c630f1…'],
              ['14:19:47','•','Convert: unmapped code → Task created'],
            ].map((r,i) => (
              <Row key={i} style={{gap:8}}>
                <span style={{color:WF.ink3, width:54}}>{r[0]}</span>
                <span className="wf-accent-ink" style={{width:14, fontWeight:600}}>{r[1]}</span>
                <span style={{color:WF.ink2}}>{r[2]}</span>
              </Row>
            ))}
          </Col>
        </Col>
      </div>
    </Col>
  </Screen>
);

Object.assign(window, { SimulateV1, SimulateV1Preview, SimulateV1Structured, SimulateV2, SimulateV3 });
