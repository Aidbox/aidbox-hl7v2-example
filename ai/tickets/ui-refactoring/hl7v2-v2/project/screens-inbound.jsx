// Inbound Messages — 3 variations

// ── V1: Familiar list + expandable detail (current structure, refined)
const InboundV1 = () => (
  <Screen nav="inbound" title="Inbound Messages" subtitle="Everything received on MLLP port 2575"
    right={<Row style={{gap:8}}>
      <Row style={{gap:5}}><span className="wf-pulse"><span className="wf-dot" style={{background:WF.accent}}/></span><span className="wf-tiny">Live · 5s</span></Row>
      <button className="wf-btn"><Ico name="refresh" size={11}/> Run now</button>
    </Row>}>
    <Col style={{gap:12, height:'100%'}}>
      {/* Filter chips */}
      <Row style={{gap:6, flexWrap:'wrap'}}>
        {['All · 142','Received','Processed · 137','Warning','Parsing error','Conversion error · 2','Code mapping error · 3','Sending error','Deferred'].map((t,i) => (
          <span key={i} className={'wf-chip ' + (i===0?'wf-chip-accent':'')}>{t}</span>
        ))}
        <div style={{flex:1}}/>
        <Row className="wf-chip" style={{padding:'2px 9px'}}><Ico name="search" size={11}/> <input className="wf-input" style={{border:'none', background:'transparent', width:140, padding:0}} placeholder="search MSH/id/sender…"/></Row>
      </Row>

      {/* List */}
      <div style={{flex:1, overflow:'hidden', display:'flex', flexDirection:'column', gap:8}}>
        {/* Expanded row — shows Structured view (active tab) */}
        <div className="wf-box" style={{padding:0, overflow:'hidden'}}>
          <Row style={{padding:'10px 14px', background:WF.paper, gap:10}}>
            <Ico name="chevD" size={12}/>
            <span className="wf-mono" style={{fontSize:12, flex:1}}>c630f1cb-2b4e-402e-8756-df1aa34601c0</span>
            <StatusChip kind="ok">processed</StatusChip>
            <span className="wf-mono" style={{fontSize:11}}>ADT^A01</span>
            <span className="wf-tiny" style={{width:100}}>hospital-p12345</span>
            <span className="wf-tiny" style={{width:120, textAlign:'right'}}>4/22/2026, 2:17:55 PM</span>
          </Row>
          <div style={{padding:'4px 14px 14px', background:WF.mutedBg, borderTop:`1px dashed ${WF.lineLight}`}}>
            <Row style={{gap:14, marginBottom:8, alignItems:'center'}}>
              <span className="wf-tab" style={{padding:'4px 0'}}>Raw</span>
              <span className="wf-tab wf-tab-on" style={{padding:'4px 0'}}>Structured</span>
              <span className="wf-tab" style={{padding:'4px 0'}}>FHIR bundle</span>
              <div style={{flex:1}}/>
              <span className="wf-tiny">11 segments · 1.2 KB</span>
              <span className="wf-chip wf-chip-ghost" style={{fontSize:11}}>copy</span>
              <span className="wf-chip wf-chip-ghost" style={{fontSize:11}}>download .hl7</span>
            </Row>
            <SegmentTable/>
          </div>
        </div>

        {/* Collapsed rows */}
        {[
          {id:'5227bfc2-c5e7-4961-8c99-bc18b2f6d96e', st:'err', t:'BAR_P01', s:'—', time:'2:15:43 PM'},
          {id:'e8a91c0f-1b2d-4c3a-9f8d-7c8a6b2d1e1a', st:'warn', t:'ORU^R01', s:'ACME_LAB', time:'2:14:12 PM'},
          {id:'a12b34cd-5e6f-7890-abcd-1234567890ab', st:'ok', t:'ORU^R01', s:'ACME_LAB', time:'2:12:01 PM'},
          {id:'f93e11aa-2200-4411-b4cc-d5e6f7890abc', st:'ok', t:'VXU^V04', s:'CHILDRENS', time:'2:10:33 PM'},
          {id:'06cd4411-aabb-ccdd-eeff-001122334455', st:'pend', t:'ADT^A08', s:'hospital', time:'2:09:10 PM'},
        ].map((r,i) => (
          <Row key={i} className="wf-box" style={{padding:'10px 14px', gap:10, background:WF.paper}}>
            <Ico name="chev" size={12}/>
            <span className="wf-mono" style={{fontSize:12, flex:1}}>{r.id}</span>
            <StatusChip kind={r.st}>{r.st==='ok'?'processed':r.st==='warn'?'code mapping':r.st==='err'?'conversion error':'received'}</StatusChip>
            <span className="wf-mono" style={{fontSize:11, width:80}}>{r.t}</span>
            <span className="wf-tiny" style={{width:100}}>{r.s}</span>
            <span className="wf-tiny" style={{width:120, textAlign:'right'}}>{r.time}</span>
          </Row>
        ))}
      </div>
    </Col>
  </Screen>
);

const SegmentTable = () => (
  <div className="wf-box-soft" style={{background:WF.paper}}>
    {[
      ['MSH','Message header','ADT_A01 · v2.5.1 · SENDER→RECEIVER'],
      ['EVN','Event type','A01 · 20260422101654 · OPERATOR'],
      ['PID','Patient ID','P12345 · Smith, John Robert · 1985-03-15 · M'],
      ['PV1','Patient visit','Inpatient · WARD1 · Dr. ATTENDING'],
      ['NK1','Next of kin','Smith, Jane · Mother'],
      ['DG1','Diagnosis','I10 · Essential Hypertension · Dr. PHYSICIAN'],
      ['AL1','Allergy','Penicillin · RXNORM · Rash'],
      ['IN1','Insurance','BCBS · Blue Cross · Group GRP001'],
    ].map((r,i) => (
      <Row key={i} style={{padding:'6px 10px', borderBottom: i<7? `1px dashed ${WF.lineLight}`:'none', gap:12}}>
        <span className="wf-mono" style={{width:38, fontWeight:600, color:WF.accent, fontSize:12}}>{r[0]}</span>
        <span className="wf-label" style={{width:120}}>{r[1]}</span>
        <span className="wf-body" style={{flex:1, color:WF.ink2}}>{r[2]}</span>
      </Row>
    ))}
  </div>
);

// ── V2: Master-detail, two-pane
const InboundV2 = () => (
  <Screen nav="inbound" title="Inbound Messages" subtitle="Two-pane view · select a message on the left"
    right={<Row style={{gap:6}}>
      <span className="wf-chip wf-chip-ghost"><Ico name="filter" size={11}/> Filter</span>
      <button className="wf-btn"><Ico name="refresh" size={11}/> Run now</button>
    </Row>}>
    <Row style={{gap:12, height:'100%'}}>
      {/* Left list */}
      <Col style={{width:320, gap:8}}>
        <Row className="wf-chip" style={{padding:'4px 10px', background:WF.paper}}>
          <Ico name="search" size={11}/>
          <input className="wf-input" style={{border:'none', background:'transparent', padding:'0 4px', flex:1}} placeholder="search…" />
        </Row>
        <Col style={{gap:6, overflow:'auto', flex:1}}>
          {[
            {t:'ORU^R01', s:'ACME_LAB',    st:'warn', time:'2s',   note:'unknown LOINC', sel:false},
            {t:'ORU^R01', s:'ACME_LAB',    st:'ok',   time:'12s',  note:'Na, K, Cl',     sel:true},
            {t:'ADT^A01', s:'hospital',    st:'ok',   time:'21s',  note:'Admit P12345'},
            {t:'VXU^V04', s:'CHILDRENS',   st:'ok',   time:'42s',  note:'Flu shot'},
            {t:'BAR_P01', s:'billing',     st:'err',  time:'2m',   note:'conversion error'},
            {t:'ADT^A08', s:'hospital',    st:'pend', time:'3m',   note:'update P12345'},
            {t:'ORU^R01', s:'ACME_LAB',    st:'ok',   time:'4m',   note:'CBC panel'},
            {t:'ADT^A01', s:'hospital',    st:'ok',   time:'7m',   note:'Admit P90012'},
          ].map((r,i) => (
            <div key={i} className="wf-box" style={{padding:'8px 10px', borderColor: r.sel? WF.accent : WF.lineLight, background: r.sel? WF.accentSoft : WF.paper}}>
              <Row style={{justifyContent:'space-between', marginBottom:2}}>
                <span className="wf-mono" style={{fontSize:12, fontWeight:600}}>{r.t}</span>
                <StatusChip kind={r.st}>{r.st}</StatusChip>
              </Row>
              <div className="wf-body" style={{color:WF.ink2}}>{r.note}</div>
              <Row style={{justifyContent:'space-between', marginTop:3}}>
                <span className="wf-tiny">from {r.s}</span>
                <span className="wf-tiny">{r.time} ago</span>
              </Row>
            </div>
          ))}
        </Col>
      </Col>

      {/* Right detail */}
      <Col style={{flex:1, gap:10}}>
        <div className="wf-box" style={{padding:'14px 16px', background:WF.paper}}>
          <Row style={{justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
            <Col style={{gap:2}}>
              <Row style={{gap:8}}>
                <span className="wf-h2">ORU^R01</span>
                <StatusChip kind="ok">processed</StatusChip>
              </Row>
              <span className="wf-mono wf-tiny">c630f1cb-2b4e-402e-8756-df1aa34601c0</span>
            </Col>
            <Row style={{gap:6}}>
              <span className="wf-chip wf-chip-ghost">copy id</span>
              <span className="wf-chip wf-chip-ghost">reprocess</span>
              <span className="wf-chip wf-chip-ghost">open in Aidbox</span>
            </Row>
          </Row>
          <Row style={{gap:14, marginBottom:6}}>
            <Stat label="sender" v="ACME_LAB"/>
            <Stat label="receiver" v="ACME_HOSP"/>
            <Stat label="received" v="4/22 14:19:44"/>
            <Stat label="processed" v="+ 120ms"/>
          </Row>
        </div>
        <Row style={{gap:12, flex:1, overflow:'hidden'}}>
          {/* Raw HL7 */}
          <Col className="wf-box" style={{flex:1, padding:'10px 12px', background:WF.paper, overflow:'hidden'}}>
            <Row style={{justifyContent:'space-between', marginBottom:6}}>
              <div className="wf-h3">HL7v2 source</div>
              <span className="wf-tiny">1.2 KB · 11 segments</span>
            </Row>
            <Col style={{gap:3, overflow:'auto', flex:1}}>
              {['MSH|^~\\&|ACME_LAB|ACME_HOSP|EMR|DEST|20260422101845|…',
                'PID|1||TEST-0003^^^HOSPITAL^MR||TESTPATIENT^GAMMA||19901225|M',
                'PV1|1|O|LAB||||||||||||||||||VN125726',
                'ORC|RE|ORD003|FIL003',
                'OBR|1|ORD003|FIL003|CHEM7^CHEMISTRY PANEL^LOCAL|…',
                'OBX|1|NM|2345-7^Glucose^LN||92|mg/dL|70-110|N|||F|…',
                'OBX|2|NM|2951-2^Sodium^LN||140|mmol/L|135-145|N|||F|…',
                'OBX|3|NM|2823-3^Potassium^LN||4.1|mmol/L|3.5-5.1|N|||F|…'].map((s,i) => (
                <Row key={i} style={{gap:8}}>
                  <span className="wf-mono wf-tiny" style={{width:20, textAlign:'right', color:WF.ink3}}>{i+1}</span>
                  <span className="wf-mono" style={{fontSize:11, color:WF.ink, whiteSpace:'nowrap'}}>
                    <span style={{color:WF.accent, fontWeight:600}}>{s.slice(0,3)}</span>{s.slice(3)}
                  </span>
                </Row>
              ))}
            </Col>
          </Col>
          {/* FHIR */}
          <Col className="wf-box" style={{flex:1, padding:'10px 12px', background:WF.paper, overflow:'hidden'}}>
            <Row style={{justifyContent:'space-between', marginBottom:6}}>
              <div className="wf-h3">FHIR bundle</div>
              <span className="wf-tiny">Patient · Encounter · DiagnosticReport · 3 Obs</span>
            </Row>
            <Col style={{gap:3, overflow:'auto', flex:1, fontSize:11}} className="wf-mono">
              {[
                '{',
                '  "resourceType": "Bundle",',
                '  "type": "transaction",',
                '  "entry": [',
                '    { "resource": {',
                '        "resourceType": "Patient",',
                '        "identifier": [{ "value": "TEST-0003" }],',
                '        "name": [{ "family": "TESTPATIENT",',
                '                  "given": ["GAMMA"] }],',
                '        "birthDate": "1990-12-25",',
                '        "gender": "male"',
                '    }},',
                '    { "resource": {',
                '        "resourceType": "Observation",',
                '        "code": { "coding": [{',
                '           "system": "http://loinc.org",',
                '           "code": "2345-7",',
                '           "display": "Glucose" }] },',
                '        "valueQuantity": {',
                '           "value": 92, "unit": "mg/dL" }',
                '    }} ...',
                '  ]',
                '}',
              ].map((l,i) => <div key={i} style={{whiteSpace:'pre'}}>{l}</div>)}
            </Col>
          </Col>
        </Row>
      </Col>
    </Row>
  </Screen>
);

const Stat = ({label, v}) => (
  <Col style={{gap:0}}>
    <div className="wf-tiny">{label}</div>
    <div className="wf-mono" style={{fontSize:12}}>{v}</div>
  </Col>
);

// ── V1-Raw: same list+expand shell, "Raw" tab active
const InboundV1Raw = () => (
  <Screen nav="inbound" title="Inbound Messages" subtitle="Same list — Raw tab active in expanded row"
    right={<button className="wf-btn"><Ico name="refresh" size={11}/> Run now</button>}>
    <Col style={{gap:12, height:'100%'}}>
      <Row style={{gap:6, flexWrap:'wrap'}}>
        {['All · 142','Processed · 137','Warning','Conversion error · 2','Code mapping · 3'].map((t,i) => (
          <span key={i} className={'wf-chip ' + (i===0?'wf-chip-accent':'')}>{t}</span>
        ))}
      </Row>
      <div style={{flex:1, overflow:'hidden', display:'flex', flexDirection:'column', gap:8}}>
        <div className="wf-box" style={{padding:0, overflow:'hidden'}}>
          <Row style={{padding:'10px 14px', background:WF.paper, gap:10}}>
            <Ico name="chevD" size={12}/>
            <span className="wf-mono" style={{fontSize:12, flex:1}}>c630f1cb-2b4e-402e-8756-df1aa34601c0</span>
            <StatusChip kind="ok">processed</StatusChip>
            <span className="wf-mono" style={{fontSize:11}}>ADT^A01</span>
            <span className="wf-tiny" style={{width:120, textAlign:'right'}}>2:17:55 PM</span>
          </Row>
          <div style={{padding:'4px 14px 14px', background:WF.mutedBg, borderTop:`1px dashed ${WF.lineLight}`}}>
            <Row style={{gap:14, marginBottom:8, alignItems:'center'}}>
              <span className="wf-tab wf-tab-on" style={{padding:'4px 0'}}>Raw</span>
              <span className="wf-tab" style={{padding:'4px 0'}}>Structured</span>
              <span className="wf-tab" style={{padding:'4px 0'}}>FHIR bundle</span>
              <div style={{flex:1}}/>
              <span className="wf-tiny">1.2 KB · MLLP framed</span>
              <span className="wf-chip wf-chip-ghost" style={{fontSize:11}}>copy</span>
              <span className="wf-chip wf-chip-ghost" style={{fontSize:11}}>download .hl7</span>
            </Row>
            <div className="wf-box-soft" style={{background:WF.paper, padding:'10px 12px'}}>
              <Col className="wf-mono" style={{fontSize:11, gap:2}}>
                {['MSH|^~\\&|SENDER|ACME|EMR|DEST|20260422101654||ADT^A01|MSG00001|P|2.5.1',
                  'EVN|A01|20260422101654|||OPERATOR^Smith^Jane',
                  'PID|1||P12345^^^HOSPITAL^MR||Smith^John^Robert||19850315|M|||123 Main St^^Boston^MA^02101',
                  'PV1|1|I|WARD1^101^A||||ATTENDING^Dr^Johnson|||MED||||ADM|A0',
                  'NK1|1|Smith^Jane^M|MTH|123 Main St^^Boston^MA^02101|555-1234',
                  'DG1|1|I10|I10^Essential Hypertension^ICD10||20260422|A',
                  'AL1|1|DA|^Penicillin^RXNORM||Rash',
                  'IN1|1|BCBS^Blue Cross Blue Shield||GRP001|Blue Cross Group|||||||20260101',
                ].map((l,i) => (
                  <Row key={i} style={{gap:10}}>
                    <span style={{width:20, textAlign:'right', color:WF.ink3}}>{i+1}</span>
                    <span style={{whiteSpace:'pre', flex:1, overflow:'hidden', textOverflow:'ellipsis'}}>
                      <span style={{color:WF.accent, fontWeight:600}}>{l.slice(0,3)}</span>{l.slice(3)}
                    </span>
                  </Row>
                ))}
              </Col>
            </div>
            <Row style={{gap:6, marginTop:8}}>
              <span className="wf-tiny">tip: pipe (|) splits fields · caret (^) splits components · tilde (~) splits repetitions</span>
            </Row>
          </div>
        </div>
        {[
          {id:'5227bfc2…d96e', st:'err',  t:'BAR_P01', s:'—',         time:'2:15:43 PM'},
          {id:'e8a91c0f…1e1a', st:'warn', t:'ORU^R01', s:'ACME_LAB',  time:'2:14:12 PM'},
          {id:'a12b34cd…90ab', st:'ok',   t:'ORU^R01', s:'ACME_LAB',  time:'2:12:01 PM'},
        ].map((r,i) => (
          <Row key={i} className="wf-box" style={{padding:'10px 14px', gap:10, background:WF.paper}}>
            <Ico name="chev" size={12}/>
            <span className="wf-mono" style={{fontSize:12, flex:1}}>{r.id}</span>
            <StatusChip kind={r.st}>{r.st==='ok'?'processed':r.st==='warn'?'code mapping':'conversion error'}</StatusChip>
            <span className="wf-mono" style={{fontSize:11, width:80}}>{r.t}</span>
            <span className="wf-tiny" style={{width:100}}>{r.s}</span>
            <span className="wf-tiny" style={{width:120, textAlign:'right'}}>{r.time}</span>
          </Row>
        ))}
      </div>
    </Col>
  </Screen>
);

// ── V1-FHIR: same list+expand shell, "FHIR bundle" tab active — shows the f*cking huge JSON
const InboundV1FHIR = () => (
  <Screen nav="inbound" title="Inbound Messages" subtitle="Same list — FHIR bundle tab active · yes it is huge"
    right={<button className="wf-btn"><Ico name="refresh" size={11}/> Run now</button>}>
    <Col style={{gap:12, height:'100%'}}>
      <Row style={{gap:6, flexWrap:'wrap'}}>
        {['All · 142','Processed · 137','Warning','Conversion error · 2','Code mapping · 3'].map((t,i) => (
          <span key={i} className={'wf-chip ' + (i===0?'wf-chip-accent':'')}>{t}</span>
        ))}
      </Row>
      <div style={{flex:1, overflow:'hidden', display:'flex', flexDirection:'column', gap:8}}>
        <div className="wf-box" style={{padding:0, overflow:'hidden'}}>
          <Row style={{padding:'10px 14px', background:WF.paper, gap:10}}>
            <Ico name="chevD" size={12}/>
            <span className="wf-mono" style={{fontSize:12, flex:1}}>c630f1cb-2b4e-402e-8756-df1aa34601c0</span>
            <StatusChip kind="ok">processed</StatusChip>
            <span className="wf-mono" style={{fontSize:11}}>ADT^A01</span>
            <span className="wf-tiny" style={{width:120, textAlign:'right'}}>2:17:55 PM</span>
          </Row>
          <div style={{padding:'4px 14px 14px', background:WF.mutedBg, borderTop:`1px dashed ${WF.lineLight}`}}>
            <Row style={{gap:14, marginBottom:8, alignItems:'center'}}>
              <span className="wf-tab" style={{padding:'4px 0'}}>Raw</span>
              <span className="wf-tab" style={{padding:'4px 0'}}>Structured</span>
              <span className="wf-tab wf-tab-on" style={{padding:'4px 0'}}>FHIR bundle</span>
              <div style={{flex:1}}/>
              <span className="wf-tiny">6 resources · 4.8 KB · transaction</span>
              <span className="wf-chip wf-chip-ghost" style={{fontSize:11}}>collapse all</span>
              <span className="wf-chip wf-chip-ghost" style={{fontSize:11}}>copy JSON</span>
              <span className="wf-chip wf-chip-ghost" style={{fontSize:11}}>open in Aidbox ↗</span>
            </Row>
            {/* Jump-to resource strip */}
            <Row style={{gap:6, marginBottom:8, flexWrap:'wrap'}}>
              <span className="wf-tiny" style={{marginRight:4}}>jump to:</span>
              {['Bundle','Patient','Encounter','Condition','AllergyIntolerance','Coverage','Practitioner'].map((r,i) => (
                <span key={i} className="wf-chip wf-chip-ghost" style={{fontSize:11}}>{r}</span>
              ))}
            </Row>
            {/* Giant JSON viewer */}
            <div className="wf-box-soft" style={{background:WF.paper, padding:'10px 12px', maxHeight:420, overflow:'auto'}}>
              <Col className="wf-mono" style={{fontSize:11, gap:1}}>
                {[
                  ['{', 0],
                  ['"resourceType": "Bundle",', 1],
                  ['"id": "b-0a1b2c3d",', 1],
                  ['"type": "transaction",', 1],
                  ['"timestamp": "2026-04-22T14:17:55Z",', 1],
                  ['"entry": [', 1],
                  ['{', 2],
                  ['"fullUrl": "urn:uuid:patient-1",', 3],
                  ['"resource": {', 3],
                  ['"resourceType": "Patient",', 4, 'r'],
                  ['"id": "P12345",', 4],
                  ['"identifier": [{', 4],
                  ['"system": "urn:oid:2.16.840.1.113883.4.1",', 5],
                  ['"value": "P12345"', 5],
                  ['}],', 4],
                  ['"name": [{', 4],
                  ['"family": "Smith",', 5],
                  ['"given": ["John", "Robert"]', 5],
                  ['}],', 4],
                  ['"gender": "male",', 4],
                  ['"birthDate": "1985-03-15",', 4],
                  ['"address": [{', 4],
                  ['"line": ["123 Main St"],', 5],
                  ['"city": "Boston", "state": "MA", "postalCode": "02101"', 5],
                  ['}]', 4],
                  ['},', 3],
                  ['"request": { "method": "PUT", "url": "Patient/P12345" }', 3],
                  ['},', 2],
                  ['{', 2],
                  ['"fullUrl": "urn:uuid:encounter-1",', 3],
                  ['"resource": {', 3],
                  ['"resourceType": "Encounter",', 4, 'r'],
                  ['"status": "in-progress",', 4],
                  ['"class": { "system": "v3-ActCode", "code": "IMP", "display": "inpatient" },', 4],
                  ['"subject": { "reference": "Patient/P12345" },', 4],
                  ['"participant": [{ "individual": { "reference": "Practitioner/dr-johnson" } }],', 4],
                  ['"location": [{ "location": { "display": "WARD1 · 101A" } }]', 4],
                  ['},', 3],
                  ['"request": { "method": "POST", "url": "Encounter" }', 3],
                  ['},', 2],
                  ['{ "resource": { "resourceType": "Condition",', 2, 'r'],
                  ['"code": { "coding": [{ "system": "http://hl7.org/fhir/sid/icd-10",', 4],
                  ['"code": "I10", "display": "Essential hypertension" }] },', 5],
                  ['"subject": { "reference": "Patient/P12345" } } },', 4],
                  ['{ "resource": { "resourceType": "AllergyIntolerance",', 2, 'r'],
                  ['"code": { "coding": [{ "system": "http://www.nlm.nih.gov/research/umls/rxnorm",', 4],
                  ['"code": "7980", "display": "Penicillin" }] },', 5],
                  ['"reaction": [{ "manifestation": [{ "text": "Rash" }] }],', 4],
                  ['"patient": { "reference": "Patient/P12345" } } },', 4],
                  ['{ "resource": { "resourceType": "Coverage", "...": "..." } },', 2, 'r'],
                  ['{ "resource": { "resourceType": "Practitioner", "...": "..." } }', 2, 'r'],
                  [']', 1],
                  ['}', 0],
                ].map(([line, indent, mark], i) => (
                  <div key={i} style={{whiteSpace:'pre', color: mark==='r'? WF.accent : WF.ink, fontWeight: mark==='r'? 600:400}}>
                    {' '.repeat(indent*2)}{line}
                  </div>
                ))}
              </Col>
            </div>
            <Row style={{gap:6, marginTop:8, justifyContent:'space-between'}}>
              <span className="wf-tiny">showing collapsed view · Coverage &amp; Practitioner truncated</span>
              <span className="wf-tiny">full bundle: 312 lines · 4.8 KB</span>
            </Row>
          </div>
        </div>
        {[
          {id:'5227bfc2…d96e', st:'err',  t:'BAR_P01', s:'—',         time:'2:15:43 PM'},
          {id:'e8a91c0f…1e1a', st:'warn', t:'ORU^R01', s:'ACME_LAB',  time:'2:14:12 PM'},
        ].map((r,i) => (
          <Row key={i} className="wf-box" style={{padding:'10px 14px', gap:10, background:WF.paper}}>
            <Ico name="chev" size={12}/>
            <span className="wf-mono" style={{fontSize:12, flex:1}}>{r.id}</span>
            <StatusChip kind={r.st}>{r.st==='warn'?'code mapping':'conversion error'}</StatusChip>
            <span className="wf-mono" style={{fontSize:11, width:80}}>{r.t}</span>
            <span className="wf-tiny" style={{width:100}}>{r.s}</span>
            <span className="wf-tiny" style={{width:120, textAlign:'right'}}>{r.time}</span>
          </Row>
        ))}
      </div>
    </Col>
  </Screen>
);

// ── V3: Timeline / stream view — more narrative, demo-oriented
const InboundV3 = () => (
  <Screen nav="inbound" title="Inbound stream" subtitle="Timeline of recent messages · newest on top">
    <Col style={{gap:10, height:'100%'}}>
      <Row style={{gap:8, alignItems:'center'}}>
        <Row style={{gap:5}}><span className="wf-pulse"><span className="wf-dot" style={{background:WF.accent}}/></span><span className="wf-tiny">streaming</span></Row>
        <div style={{flex:1}}/>
        <Row style={{gap:6}}>
          {['All','ADT','ORU','VXU','BAR','errors only'].map((t,i) => (
            <span key={i} className={'wf-chip ' + (i===0?'wf-chip-accent':'')} style={{fontSize:12}}>{t}</span>
          ))}
        </Row>
      </Row>

      <div style={{flex:1, overflow:'hidden', position:'relative'}}>
        {/* Timeline rail */}
        <div style={{position:'absolute', top:0, bottom:0, left:76, width:2, background:WF.lineLight}}/>
        <Col style={{gap:0, overflow:'auto', height:'100%'}}>
          {[
            {ts:'14:19:46', rel:'just now', t:'ORU^R01', s:'ACME_LAB → ACME_HOSP', st:'warn', title:'Lab result — UNKNOWN_TEST has no LOINC mapping', body:'1 observation could not be mapped · routed to Unmapped Codes', action:'triage →'},
            {ts:'14:19:44', rel:'2s ago',   t:'ORU^R01', s:'ACME_LAB → ACME_HOSP', st:'ok',   title:'Lab result — CHEM7 panel',                                   body:'3 observations · Na, K, Cl · patient TEST-0003'},
            {ts:'14:19:42', rel:'5s ago',   t:'ADT^A01', s:'hospital → EMR',       st:'ok',   title:'Admit — Smith, John Robert (P12345)',                        body:'Inpatient · WARD1 · Dr. ATTENDING · Hypertension'},
            {ts:'14:19:38', rel:'12s ago',  t:'VXU^V04', s:'CHILDRENS → EMR',      st:'ok',   title:'Immunization — Influenza 2026',                              body:'Patient MRN 8899 · lot IFLX-2026 · intramuscular'},
            {ts:'14:15:43', rel:'4m ago',   t:'BAR_P01', s:'billing → EMR',        st:'err',  title:'Billing — conversion error',                                 body:'Invalid IN1 segment · missing coverage type', action:'view error →'},
          ].map((e,i) => (
            <Row key={i} style={{gap:14, padding:'14px 0', borderBottom:`1px dashed ${WF.lineLight}`}}>
              <Col style={{width:62, alignItems:'flex-end', paddingTop:2}}>
                <span className="wf-mono" style={{fontSize:12}}>{e.ts}</span>
                <span className="wf-tiny">{e.rel}</span>
              </Col>
              <div className="wf-box" style={{width:16, height:16, borderRadius:99, marginTop:4, background: e.st==='warn'?'#fef3d6':(e.st==='err'?'#fce1dc':WF.paper), borderColor: e.st==='warn'?'#e0b85a':(e.st==='err'?'#d07a6a':WF.line), zIndex:1}}/>
              <Col className="wf-box" style={{flex:1, padding:'10px 14px', background:WF.paper, gap:3}}>
                <Row style={{justifyContent:'space-between', gap:8}}>
                  <Row style={{gap:8}}>
                    <span className="wf-mono" style={{fontSize:12, fontWeight:600}}>{e.t}</span>
                    <StatusChip kind={e.st}>{e.st==='ok'?'processed':e.st==='warn'?'needs mapping':'error'}</StatusChip>
                  </Row>
                  <span className="wf-tiny">{e.s}</span>
                </Row>
                <div className="wf-body" style={{fontWeight:500}}>{e.title}</div>
                <div className="wf-note">{e.body}</div>
                {e.action && <div style={{marginTop:4}}><span className="wf-chip wf-chip-accent">{e.action}</span></div>}
              </Col>
            </Row>
          ))}
        </Col>
      </div>
    </Col>
  </Screen>
);

Object.assign(window, { InboundV1, InboundV1Raw, InboundV1FHIR, InboundV2, InboundV3 });
