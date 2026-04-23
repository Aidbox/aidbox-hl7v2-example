// Unmapped Codes — 3 variations (inbox-zero triage vibe)

// ── V1: Inbox triage — big list, keyboard-driven, quick-action chips
const UnmappedV1 = () => (
  <Screen nav="unmapped" title="Unmapped codes" subtitle="Inbox-zero · map each local code to a standard"
    right={<Row style={{gap:8}}>
      <span className="wf-chip wf-chip-ghost">3 pending</span>
      <span className="wf-chip wf-chip-ghost">127 resolved this week</span>
    </Row>}>
    <Row style={{gap:14, height:'100%'}}>
      <Col style={{flex:1.2, gap:10}}>
        <Row style={{gap:6}}>
          {['All · 3','Observation.code · 2','Encounter.class · 1','Status','History'].map((t,i) => (
            <span key={i} className={'wf-chip ' + (i===0?'wf-chip-accent':'')}>{t}</span>
          ))}
        </Row>
        <Col style={{gap:8, flex:1, overflow:'auto'}}>
          <UnmappedRow selected code="UNKNOWN_TEST" target="Observation.code" src="ACME_LAB | ACME_HOSP" disp="Unknown Lab Test" seen="2 min ago" n={1}/>
          <UnmappedRow code="LOCAL_GLUC" target="Observation.code" src="ACME_LAB | ACME_HOSP" disp="Glucose (fasting)" seen="14 min ago" n={4}/>
          <UnmappedRow code="OBS" target="Encounter.class" src="hospital | EMR" disp="Observation visit" seen="1 hr ago" n={12}/>
        </Col>
        <Row style={{gap:8, alignItems:'center'}}>
          <span className="wf-tiny">Use</span>
          <span className="wf-kbd">↑</span><span className="wf-kbd">↓</span>
          <span className="wf-tiny">navigate ·</span>
          <span className="wf-kbd">↵</span>
          <span className="wf-tiny">map ·</span>
          <span className="wf-kbd">D</span>
          <span className="wf-tiny">defer ·</span>
          <span className="wf-kbd">X</span>
          <span className="wf-tiny">dismiss</span>
        </Row>
      </Col>

      <Col className="wf-box" style={{flex:1.4, padding:'16px 18px', background:WF.paper}}>
        <Row style={{justifyContent:'space-between', marginBottom:8}}>
          <Col style={{gap:2}}>
            <Row style={{gap:8}}>
              <span className="wf-h2 wf-mono">UNKNOWN_TEST</span>
              <StatusChip kind="pend">pending</StatusChip>
            </Row>
            <div className="wf-note">Unknown Lab Test · first seen 2 min ago · 1 occurrence</div>
          </Col>
          <Row style={{gap:6}}>
            <span className="wf-chip wf-chip-ghost">defer</span>
            <span className="wf-chip wf-chip-ghost">dismiss</span>
          </Row>
        </Row>

        <div className="wf-divider" style={{margin:'6px 0 10px'}}/>

        <Row style={{gap:20, marginBottom:10}}>
          <Stat label="sender"       v="ACME_LAB | ACME_HOSP"/>
          <Stat label="local system" v="LOCAL"/>
          <Stat label="source field" v="OBX-3"/>
          <Stat label="target field" v="Observation.code"/>
        </Row>

        {/* Suggestions */}
        <div className="wf-label" style={{marginBottom:4}}>Suggested LOINC codes <span className="wf-tiny" style={{fontFamily:WF.sans, color:WF.ink3}}>(from display text)</span></div>
        <Col style={{gap:6, marginBottom:10}}>
          {[
            {c:'2345-7',  d:'Glucose [Mass/volume] in Serum or Plasma',  conf:'92%', top:true},
            {c:'6777-7',  d:'Lab test [Identifier] in Specimen — general', conf:'64%'},
            {c:'33762-6', d:'Unspecified lab test',                        conf:'48%'},
          ].map((s,i) => (
            <Row key={i} className="wf-box" style={{padding:'8px 10px', gap:10, borderColor: s.top? WF.accent : WF.lineMid, background: s.top? WF.accentSoft : WF.paper}}>
              <span className="wf-mono" style={{width:70, fontWeight:600}}>{s.c}</span>
              <span className="wf-body" style={{flex:1}}>{s.d}</span>
              <span className="wf-chip" style={{fontSize:11}}>{s.conf}</span>
              <button className="wf-btn" style={{padding:'3px 10px', fontSize:13, borderColor: s.top? WF.ink : WF.lineMid}}>Pick</button>
            </Row>
          ))}
        </Col>

        <div className="wf-label" style={{marginBottom:4}}>Or search LOINC</div>
        <Row className="wf-box" style={{padding:'6px 10px', background:WF.paper, gap:8, marginBottom:12}}>
          <Ico name="search" size={12}/>
          <input className="wf-input" style={{border:'none', background:'transparent', padding:0, flex:1}} placeholder="search code or display text…"/>
        </Row>

        <Row style={{gap:8, marginTop:'auto'}}>
          <button className="wf-btn wf-btn-accent"><Ico name="check" size={11} color="white"/> Save mapping</button>
          <button className="wf-btn">Skip</button>
          <div style={{flex:1}}/>
          <span className="wf-tiny">writes to ConceptMap · affects future messages</span>
        </Row>
      </Col>
    </Row>
  </Screen>
);

const UnmappedRow = ({selected, code, target, src, disp, seen, n}) => (
  <div className="wf-box" style={{padding:'10px 12px', background: selected? WF.accentSoft : WF.paper, borderColor: selected? WF.accent : WF.lineLight}}>
    <Row style={{gap:8, alignItems:'baseline'}}>
      <span className="wf-mono" style={{fontWeight:600}}>{code}</span>
      <span className="wf-tiny">→ {target}</span>
      <div style={{flex:1}}/>
      <span className="wf-tiny">{n}× · {seen}</span>
    </Row>
    <div className="wf-body" style={{color:WF.ink2}}>{disp}</div>
    <div className="wf-tiny" style={{marginTop:2}}>from {src}</div>
  </div>
);

// ── V2: Batch / bulk-map table — pick from suggestions in a table
const UnmappedV2 = () => (
  <Screen nav="unmapped" title="Unmapped codes" subtitle="Review all and bulk-apply suggestions">
    <Col style={{gap:10, height:'100%'}}>
      <Row style={{gap:8}}>
        <span className="wf-chip wf-chip-accent">Pending · 3</span>
        <span className="wf-chip wf-chip-ghost">History · 127</span>
        <div style={{flex:1}}/>
        <Row style={{gap:6}}>
          <button className="wf-btn"><Ico name="check" size={11}/> Accept all top picks (3)</button>
          <button className="wf-btn wf-btn-accent"><Ico name="bolt" size={11} color="white"/> Auto-suggest</button>
        </Row>
      </Row>

      <div className="wf-box" style={{flex:1, background:WF.paper, overflow:'hidden', display:'flex', flexDirection:'column'}}>
        {/* Table header */}
        <Row style={{padding:'10px 14px', borderBottom:`1.25px solid ${WF.line}`, gap:12}}>
          <div style={{width:18}}><span className="wf-box" style={{width:14, height:14, display:'inline-block', borderRadius:3}}/></div>
          <span className="wf-label" style={{width:140}}>Local code</span>
          <span className="wf-label" style={{width:140}}>Display</span>
          <span className="wf-label" style={{width:140}}>Target field</span>
          <span className="wf-label" style={{flex:1}}>Suggested mapping</span>
          <span className="wf-label" style={{width:70, textAlign:'right'}}>Count</span>
          <span className="wf-label" style={{width:90}}>Action</span>
        </Row>
        <Col style={{overflow:'auto', flex:1}}>
          {[
            {code:'UNKNOWN_TEST', disp:'Unknown Lab Test',  target:'Observation.code', s:{c:'2345-7', d:'Glucose [Mass/volume]', conf:'92%'}, n:1, pick:true},
            {code:'LOCAL_GLUC',   disp:'Glucose (fasting)', target:'Observation.code', s:{c:'1558-6', d:'Fasting glucose [Mass/volume]', conf:'96%'}, n:4, pick:true},
            {code:'OBS',          disp:'Observation visit', target:'Encounter.class',  s:{c:'OBSENC', d:'ActCode: Observation encounter', conf:'84%'}, n:12, pick:true},
          ].map((r,i) => (
            <Row key={i} style={{padding:'10px 14px', gap:12, borderBottom:`1px dashed ${WF.lineLight}`, alignItems:'center'}}>
              <div style={{width:18}}>
                <div className="wf-box" style={{width:14, height:14, background: r.pick? WF.accent : WF.paper, borderColor: r.pick? WF.ink : WF.lineMid, display:'flex', alignItems:'center', justifyContent:'center'}}>
                  {r.pick && <Ico name="check" size={10} color="white"/>}
                </div>
              </div>
              <span className="wf-mono" style={{width:140, fontSize:12, fontWeight:600}}>{r.code}</span>
              <span className="wf-body" style={{width:140, color:WF.ink2}}>{r.disp}</span>
              <span className="wf-mono wf-tiny" style={{width:140}}>{r.target}</span>
              <Row style={{flex:1, gap:6, alignItems:'center'}}>
                <span className="wf-mono" style={{fontWeight:600, width:70}}>{r.s.c}</span>
                <span className="wf-body" style={{flex:1, color:WF.ink2}}>{r.s.d}</span>
                <span className="wf-chip" style={{fontSize:11}}>{r.s.conf}</span>
                <span className="wf-chip wf-chip-ghost" style={{fontSize:11}}>change…</span>
              </Row>
              <span className="wf-body" style={{width:70, textAlign:'right'}}>{r.n}×</span>
              <Row style={{width:90, gap:4}}>
                <span className="wf-chip" style={{fontSize:11}}>defer</span>
                <span className="wf-chip" style={{fontSize:11}}>skip</span>
              </Row>
            </Row>
          ))}
        </Col>
        <Row style={{padding:'8px 14px', justifyContent:'space-between', background:WF.mutedBg, borderTop:`1px dashed ${WF.lineLight}`}}>
          <span className="wf-body"><b>3 selected</b> · will be written to ConceptMap</span>
          <button className="wf-btn wf-btn-accent"><Ico name="check" size={11} color="white"/> Save 3 mappings</button>
        </Row>
      </div>
    </Col>
  </Screen>
);

// ── V3: Card-based triage / kanban-ish — Pending | Deferred | Resolved
const UnmappedV3 = () => (
  <Screen nav="unmapped" title="Unmapped codes" subtitle="Drag a card to defer or resolve">
    <Row style={{gap:12, height:'100%'}}>
      {[
        {title:'Pending', n:3, accent:true, cards:[
          {code:'UNKNOWN_TEST', d:'Unknown Lab Test', t:'Observation.code', seen:'2m', n:1, highlight:true},
          {code:'LOCAL_GLUC',   d:'Glucose (fasting)', t:'Observation.code', seen:'14m', n:4},
          {code:'OBS',          d:'Observation visit', t:'Encounter.class', seen:'1h', n:12},
        ]},
        {title:'Deferred', n:2, cards:[
          {code:'XYZ_LAB', d:'Vendor-specific', t:'Observation.code', seen:'yesterday', n:8, note:'waiting on vendor docs'},
          {code:'HOME_BP',  d:'Home BP reading', t:'Observation.code', seen:'2d',       n:21},
        ]},
        {title:'Resolved (today)', n:5, cards:[
          {code:'FAST_GLU',  d:'Fasting Glucose', t:'Observation.code', by:'you · 10m ago', to:'1558-6'},
          {code:'BP_SYS',   d:'Systolic BP',     t:'Observation.code', by:'auto · 1h ago', to:'8480-6'},
          {code:'INP',      d:'Inpatient',      t:'Encounter.class',  by:'you · 2h ago',  to:'IMP'},
        ]},
      ].map((col,i) => (
        <Col key={i} style={{flex:1, gap:8}}>
          <Row style={{justifyContent:'space-between', padding:'0 4px'}}>
            <Row style={{gap:6}}>
              <div className="wf-h3">{col.title}</div>
              <span className={'wf-chip ' + (col.accent?'wf-chip-accent':'')} style={{fontSize:11}}>{col.n}</span>
            </Row>
            <span className="wf-tiny">•••</span>
          </Row>
          <Col className="wf-box-dashed wf-grid-dots" style={{flex:1, padding:8, gap:8, overflow:'auto', background:'transparent'}}>
            {col.cards.map((c,j) => (
              <div key={j} className="wf-box" style={{padding:'10px 12px', background:WF.paper, borderColor: c.highlight? WF.accent : WF.lineLight}}>
                <Row style={{justifyContent:'space-between', alignItems:'baseline'}}>
                  <span className="wf-mono" style={{fontWeight:600, fontSize:13}}>{c.code}</span>
                  {c.n && <span className="wf-tiny">{c.n}×</span>}
                </Row>
                <div className="wf-body" style={{color:WF.ink2, marginTop:2}}>{c.d}</div>
                <div className="wf-tiny" style={{marginTop:2}}>→ {c.t}</div>
                {c.note && <div className="wf-note" style={{marginTop:6, padding:'4px 6px', background:WF.mutedBg, borderRadius:4, fontSize:12}}>{c.note}</div>}
                {c.to && <Row style={{marginTop:6, gap:6, alignItems:'center'}}>
                  <Arrow w={20}/>
                  <span className="wf-mono" style={{fontWeight:600, fontSize:12}}>{c.to}</span>
                </Row>}
                {c.by && <div className="wf-tiny" style={{marginTop:4}}>{c.by}</div>}
                {c.seen && !c.by && <div className="wf-tiny" style={{marginTop:4}}>first seen {c.seen}</div>}
                {col.accent && (
                  <Row style={{gap:6, marginTop:8}}>
                    <span className="wf-chip wf-chip-accent" style={{fontSize:11}}>map →</span>
                    <span className="wf-chip" style={{fontSize:11}}>defer</span>
                  </Row>
                )}
              </div>
            ))}
          </Col>
        </Col>
      ))}
    </Row>
  </Screen>
);

Object.assign(window, { UnmappedV1, UnmappedV2, UnmappedV3 });
