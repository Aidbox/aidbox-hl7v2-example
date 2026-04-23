// Terminology Map, Accounts, Outgoing — 3 variations each

// ══════════════════════ TERMINOLOGY MAP ══════════════════════

// ── V1: Classic two-column mapping table
const TermV1 = () => (
  <Screen nav="terminology" title="Terminology map" subtitle="Local codes ↔ standard codes · writes to ConceptMap"
    right={<Row style={{gap:8}}>
      <span className="wf-chip wf-chip-ghost">218 mappings · 5 systems</span>
      <button className="wf-btn wf-btn-accent"><Ico name="plus" size={11} color="white"/> Add mapping</button>
    </Row>}>
    <Col style={{gap:10, height:'100%'}}>
      <Row style={{gap:6, flexWrap:'wrap'}}>
        {['All systems · 218','ACME_LAB → LOINC · 142','hospital → SNOMED · 38','billing → CPT · 24','custom · 14'].map((t,i) => (
          <span key={i} className={'wf-chip ' + (i===0?'wf-chip-accent':'')}>{t}</span>
        ))}
        <div style={{flex:1}}/>
        <Row className="wf-chip" style={{padding:'2px 10px'}}><Ico name="search" size={11}/> <input className="wf-input" style={{border:'none', background:'transparent', padding:'0 4px', width:160}} placeholder="search…"/></Row>
      </Row>

      <div className="wf-box" style={{flex:1, background:WF.paper, overflow:'hidden', display:'flex', flexDirection:'column'}}>
        <Row style={{padding:'10px 14px', borderBottom:`1.25px solid ${WF.line}`, gap:12, alignItems:'center'}}>
          <span className="wf-label" style={{width:160}}>Source system</span>
          <span className="wf-label" style={{width:130}}>Local code</span>
          <span className="wf-label" style={{width:180}}>Display</span>
          <span style={{width:28}}/>
          <span className="wf-label" style={{width:130}}>Target code</span>
          <span className="wf-label" style={{flex:1}}>Target display</span>
          <span className="wf-label" style={{width:90}}>Field</span>
          <span className="wf-label" style={{width:70}}>Uses</span>
        </Row>
        <Col style={{overflow:'auto', flex:1}}>
          {[
            ['ACME_LAB','GLUC_FASTING','Glucose (fasting)','1558-6','Fasting glucose [Mass/volume]','Obs.code','142'],
            ['ACME_LAB','NA',         'Sodium',            '2951-2','Sodium [Moles/volume]',          'Obs.code','88'],
            ['ACME_LAB','K',          'Potassium',         '2823-3','Potassium [Moles/volume]',       'Obs.code','84'],
            ['hospital','INP',        'Inpatient',         'IMP',   'Inpatient encounter (ActCode)',   'Enc.class','312'],
            ['hospital','OBS',        'Observation visit', 'OBSENC','Observation encounter',           'Enc.class','41'],
            ['billing', 'BCBS',       'Blue Cross',        'UB04:BC','Blue Cross plan',                'Coverage', '29'],
          ].map((r,i) => (
            <Row key={i} style={{padding:'9px 14px', gap:12, borderBottom:`1px dashed ${WF.lineLight}`, alignItems:'center'}}>
              <Row style={{width:160, gap:5}}>
                <span className="wf-dot" style={{background:WF.accent, opacity:.8}}/>
                <span className="wf-body">{r[0]}</span>
              </Row>
              <span className="wf-mono" style={{width:130, fontSize:12}}>{r[1]}</span>
              <span className="wf-body" style={{width:180, color:WF.ink2}}>{r[2]}</span>
              <div style={{width:28}}><Arrow w={20}/></div>
              <span className="wf-mono" style={{width:130, fontWeight:600, fontSize:12}}>{r[3]}</span>
              <span className="wf-body" style={{flex:1, color:WF.ink2}}>{r[4]}</span>
              <span className="wf-mono wf-tiny" style={{width:90}}>{r[5]}</span>
              <span className="wf-body" style={{width:70}}>{r[6]}×</span>
            </Row>
          ))}
        </Col>
      </div>
    </Col>
  </Screen>
);

// ── V1b: "Show all by default" — fixes the current app's sender-gate problem
// Type tabs + Sender dropdown BOTH default to "All"; each row carries its sender as a column
const TermV1NoGate = () => (
  <Screen nav="terminology" title="Terminology Map" subtitle="All mappings across senders · filter to narrow down"
    right={<Row style={{gap:8}}>
      <span className="wf-chip wf-chip-ghost">218 mappings · 5 senders</span>
      <button className="wf-btn wf-btn-accent"><Ico name="plus" size={11} color="white"/> Add Mapping</button>
    </Row>}>
    <Col style={{gap:10, height:'100%'}}>
      {/* Type tabs (from existing app) */}
      <Row style={{gap:6, flexWrap:'wrap'}}>
        {[
          ['All Types','218'],
          ['Observation.code','164'],
          ['Encounter.class','38'],
          ['DiagnosticReport.status','7'],
          ['Observation.status','9'],
        ].map(([t,n],i) => (
          <span key={i} className={'wf-chip ' + (i===0?'wf-chip-accent':'')}>{t} <span style={{opacity:.6}}>· {n}</span></span>
        ))}
      </Row>

      {/* Filter bar — all fields optional, defaults show everything */}
      <Row style={{gap:10, alignItems:'flex-end'}}>
        <Col className="wf-field" style={{width:280}}>
          <div className="wf-label">Sender <span className="wf-tiny" style={{fontFamily:WF.sans, color:WF.ink3, textTransform:'none', letterSpacing:0}}>· optional</span></div>
          <Row className="wf-box" style={{padding:'6px 10px', background:WF.paper, justifyContent:'space-between', alignItems:'center'}}>
            <span className="wf-body">All senders</span>
            <Ico name="chevD" size={11}/>
          </Row>
        </Col>
        <Col className="wf-field" style={{flex:1}}>
          <div className="wf-label">Search codes</div>
          <Row className="wf-box" style={{padding:'6px 10px', background:WF.paper, gap:8, alignItems:'center'}}>
            <Ico name="search" size={11}/>
            <input className="wf-input" style={{border:'none', background:'transparent', padding:0, flex:1}} placeholder="code or display…"/>
          </Row>
        </Col>
        <button className="wf-btn"><Ico name="filter" size={11}/> Clear</button>
      </Row>

      {/* Chip summary of active filters (empty state here, but shows the pattern) */}
      <Row style={{gap:6, alignItems:'center'}}>
        <span className="wf-tiny">active filters:</span>
        <span className="wf-chip wf-chip-ghost" style={{fontSize:11}}>none — showing all 218</span>
        <div style={{flex:1}}/>
        <span className="wf-tiny">sort: most-used first ▾</span>
      </Row>

      {/* Results table with SENDER as a column — no need to pre-select it */}
      <div className="wf-box" style={{flex:1, background:WF.paper, overflow:'hidden', display:'flex', flexDirection:'column'}}>
        <Row style={{padding:'10px 14px', borderBottom:`1.25px solid ${WF.line}`, gap:12, alignItems:'center', background:WF.mutedBg}}>
          <span className="wf-label" style={{width:160}}>Sender</span>
          <span className="wf-label" style={{width:130}}>Local code</span>
          <span className="wf-label" style={{flex:1}}>Display</span>
          <span style={{width:24}}/>
          <span className="wf-label" style={{width:110}}>Target code</span>
          <span className="wf-label" style={{width:130}}>System</span>
          <span className="wf-label" style={{width:110}}>Field</span>
          <span className="wf-label" style={{width:60, textAlign:'right'}}>Uses</span>
        </Row>
        <Col style={{overflow:'auto', flex:1}}>
          {[
            {s:'ACME_LAB', c:'GLUC_FASTING', d:'Glucose (fasting)',   tc:'1558-6',  sys:'LOINC',  f:'Obs.code',     u:'142'},
            {s:'ACME_LAB', c:'NA',           d:'Sodium',              tc:'2951-2',  sys:'LOINC',  f:'Obs.code',     u:'88'},
            {s:'ACME_LAB', c:'K',            d:'Potassium',           tc:'2823-3',  sys:'LOINC',  f:'Obs.code',     u:'84'},
            {s:'ACME_LAB', c:'UNKNOWN_TEST', d:'Unknown Lab Test',    tc:'LP6994-0',sys:'LOINC',  f:'Obs.code',     u:'1',   hi:true},
            {s:'hospital', c:'INP',          d:'Inpatient',           tc:'IMP',     sys:'ActCode',f:'Enc.class',    u:'312'},
            {s:'hospital', c:'OBS',          d:'Observation visit',   tc:'OBSENC',  sys:'ActCode',f:'Enc.class',    u:'41'},
            {s:'hospital', c:'DC-OK',        d:'Discharge routine',   tc:'final',   sys:'FHIR',   f:'DxReport.st',  u:'28'},
            {s:'billing',  c:'BCBS',         d:'Blue Cross',          tc:'UB04:BC', sys:'NUBC',   f:'Coverage',     u:'29'},
            {s:'CHILDRENS',c:'FLU-2026',     d:'Influenza 2026',      tc:'88',      sys:'CVX',    f:'Immunization', u:'17'},
            {s:'custom',   c:'STAT-AMB',     d:'Ambulatory stat',     tc:'AMB',     sys:'ActCode',f:'Enc.class',    u:'5'},
          ].map((r,i) => (
            <Row key={i} style={{padding:'9px 14px', gap:12, borderBottom:`1px dashed ${WF.lineLight}`, alignItems:'center', background: r.hi? WF.accentSoft : 'transparent'}}>
              <Row style={{width:160, gap:6}}>
                <span className="wf-dot" style={{background:WF.accent, opacity:.8}}/>
                <span className="wf-body">{r.s}</span>
              </Row>
              <span className="wf-mono" style={{width:130, fontSize:12, fontWeight: r.hi? 700:400}}>{r.c}</span>
              <span className="wf-body" style={{flex:1, color:WF.ink2}}>{r.d}</span>
              <div style={{width:24}}><Arrow w={18}/></div>
              <span className="wf-mono" style={{width:110, fontWeight:600, fontSize:12, color:WF.accent}}>{r.tc}</span>
              <span className="wf-mono wf-tiny" style={{width:130}}>{r.sys}</span>
              <span className="wf-mono wf-tiny" style={{width:110}}>{r.f}</span>
              <span className="wf-body" style={{width:60, textAlign:'right'}}>{r.u}×</span>
            </Row>
          ))}
        </Col>
        <Row style={{padding:'8px 14px', borderTop:`1px dashed ${WF.lineLight}`, background:WF.mutedBg, justifyContent:'space-between'}}>
          <span className="wf-tiny">10 of 218 · sender shown per-row so you never have to pick one first</span>
          <span className="wf-tiny">page 1 / 22 · ← →</span>
        </Row>
      </div>
    </Col>
  </Screen>
);

// ── V2: Graph / system-oriented — systems on left, standards on right
// ── V2: Sender-grouped view — segment by sender (the useful axis), target inline per row
const TermV2 = () => (
  <Screen nav="terminology" title="Terminology Map" subtitle="Grouped by sender · the natural axis for grouping"
    right={<Row style={{gap:8}}>
      <span className="wf-chip wf-chip-ghost">218 mappings · 5 senders</span>
      <button className="wf-btn wf-btn-accent"><Ico name="plus" size={11} color="white"/> Add Mapping</button>
    </Row>}>
    <Col style={{gap:10, height:'100%'}}>
      <Row style={{gap:6, flexWrap:'wrap'}}>
        {['All Types','Observation.code','Encounter.class','DiagnosticReport.status','Observation.status'].map((t,i) => (
          <span key={i} className={'wf-chip ' + (i===0?'wf-chip-accent':'')}>{t}</span>
        ))}
        <div style={{flex:1}}/>
        <Row className="wf-chip" style={{padding:'2px 10px'}}><Ico name="search" size={11}/> <input className="wf-input" style={{border:'none', background:'transparent', padding:'0 4px', width:160}} placeholder="code or display…"/></Row>
      </Row>

      <Row style={{gap:12, flex:1, overflow:'hidden'}}>
        {/* Left: senders as navigable groups */}
        <Col className="wf-box" style={{width:240, padding:'6px 0', background:WF.paper, overflow:'auto'}}>
          <Row style={{padding:'6px 12px 4px'}}>
            <span className="wf-label">Senders</span>
          </Row>
          {[
            {n:'ACME_LAB',  sys:'LOINC',          c:142, active:true},
            {n:'hospital',  sys:'SNOMED · ActCode',c:38},
            {n:'billing',   sys:'CPT · NUBC',     c:24},
            {n:'CHILDRENS', sys:'CVX',            c:14},
            {n:'custom',    sys:'mixed',          c:14, warn:1},
          ].map((s,i) => (
            <Row key={i} style={{padding:'9px 12px', gap:8, background: s.active? WF.accentSoft : 'transparent', borderLeft: s.active? `3px solid ${WF.accent}` : '3px solid transparent', alignItems:'center'}}>
              <Col style={{flex:1, gap:1}}>
                <Row style={{gap:6, alignItems:'center'}}>
                  <span className="wf-dot" style={{background:WF.accent, opacity:.8}}/>
                  <span className="wf-body" style={{fontWeight: s.active? 600:500}}>{s.n}</span>
                </Row>
                <span className="wf-tiny" style={{paddingLeft:12}}>{s.sys}</span>
              </Col>
              <Col style={{alignItems:'flex-end', gap:1}}>
                <span className="wf-mono" style={{fontSize:12}}>{s.c}</span>
                {s.warn && <span className="wf-tiny" style={{color:'#8a5a0a'}}>{s.warn} unmapped</span>}
              </Col>
            </Row>
          ))}
          <Row style={{padding:'8px 12px'}}><span className="wf-chip wf-chip-ghost" style={{fontSize:11}}><Ico name="plus" size={10}/> add sender</span></Row>
        </Col>

        {/* Right: mappings for the selected sender — target is inline per row, no mirror list */}
        <Col className="wf-box" style={{flex:1, padding:0, background:WF.paper, overflow:'hidden'}}>
          <Row style={{padding:'10px 14px', borderBottom:`1.25px solid ${WF.line}`, gap:12, alignItems:'center', background:WF.mutedBg}}>
            <Col style={{flex:1, gap:1}}>
              <Row style={{gap:8, alignItems:'baseline'}}>
                <span className="wf-h3">ACME_LAB</span>
                <span className="wf-tiny">· primarily → LOINC · 142 mappings · 1 unmapped</span>
              </Row>
            </Col>
            <button className="wf-btn" style={{padding:'3px 10px', fontSize:12}}><Ico name="plus" size={10}/> Add</button>
          </Row>
          <Row style={{padding:'8px 14px', borderBottom:`1px dashed ${WF.lineLight}`, gap:12, alignItems:'center'}}>
            <span className="wf-label" style={{width:140}}>Local code</span>
            <span className="wf-label" style={{flex:1}}>Display</span>
            <span style={{width:22}}/>
            <span className="wf-label" style={{width:120}}>Target code</span>
            <span className="wf-label" style={{width:60}}>System</span>
            <span className="wf-label" style={{width:70, textAlign:'right'}}>Uses</span>
          </Row>
          <Col style={{overflow:'auto', flex:1}}>
            {[
              ['GLUC_FASTING','Glucose (fasting)',     '1558-6',  'LOINC', '142'],
              ['NA',          'Sodium',                '2951-2',  'LOINC', '88'],
              ['K',           'Potassium',             '2823-3',  'LOINC', '84'],
              ['CL',          'Chloride',              '2075-0',  'LOINC', '62'],
              ['CREAT',       'Creatinine',            '2160-0',  'LOINC', '54'],
              ['BUN',         'Urea Nitrogen',         '3094-0',  'LOINC', '49'],
              ['HGB',         'Hemoglobin',            '718-7',   'LOINC', '38'],
              ['UNKNOWN_TEST','Unknown Lab Test',      null,      'LOINC', '1', true],
            ].map((r,i) => (
              <Row key={i} style={{padding:'9px 14px', gap:12, borderBottom:`1px dashed ${WF.lineLight}`, alignItems:'center', background: r[5]? '#fef8d6' : 'transparent'}}>
                <span className="wf-mono" style={{width:140, fontSize:12, fontWeight: r[5]? 700:400}}>{r[0]}</span>
                <span className="wf-body" style={{flex:1, color:WF.ink2}}>{r[1]}</span>
                <div style={{width:22}}><Arrow w={16}/></div>
                {r[2] ? (
                  <span className="wf-mono" style={{width:120, fontWeight:600, fontSize:12, color:WF.accent}}>{r[2]}</span>
                ) : (
                  <span className="wf-chip" style={{width:120, fontSize:11, background:'#fef3d6', borderColor:'#e0b85a', color:'#7a5a0a', textAlign:'center'}}>unmapped — map now →</span>
                )}
                <span className="wf-mono wf-tiny" style={{width:60}}>{r[3]}</span>
                <span className="wf-body" style={{width:70, textAlign:'right'}}>{r[4]}×</span>
              </Row>
            ))}
          </Col>
          <Row style={{padding:'8px 14px', borderTop:`1px dashed ${WF.lineLight}`, background:WF.mutedBg, justifyContent:'space-between'}}>
            <span className="wf-tiny">8 of 142 · sender groups on the left, mappings on the right</span>
            <span className="wf-tiny">page 1 / 18</span>
          </Row>
        </Col>
      </Row>
    </Col>
  </Screen>
);

// ── V4: Edit mapping — inline-expanded row on the "Show all" list (matches the user's pattern)
const TermEdit = () => (
  <Screen nav="terminology" title="Terminology Map" subtitle="Editing UNKNOWN_TEST · inline row expansion from the list"
    right={<Row style={{gap:8}}>
      <span className="wf-chip wf-chip-ghost">218 mappings · 5 senders</span>
      <button className="wf-btn wf-btn-accent"><Ico name="plus" size={11} color="white"/> Add Mapping</button>
    </Row>}>
    <Col style={{gap:10, height:'100%'}}>
      <Row style={{gap:6, flexWrap:'wrap'}}>
        {[['All Types','218'],['Observation.code','164'],['Encounter.class','38'],['DiagnosticReport.status','7'],['Observation.status','9']].map(([t,n],i) => (
          <span key={i} className={'wf-chip ' + (i===0?'wf-chip-accent':'')}>{t} <span style={{opacity:.6}}>· {n}</span></span>
        ))}
      </Row>
      <Row style={{gap:10, alignItems:'flex-end'}}>
        <Col className="wf-field" style={{width:280}}>
          <div className="wf-label">Sender <span className="wf-tiny" style={{fontFamily:WF.sans, color:WF.ink3, textTransform:'none', letterSpacing:0}}>· optional</span></div>
          <Row className="wf-box" style={{padding:'6px 10px', background:WF.paper, justifyContent:'space-between', alignItems:'center'}}>
            <span className="wf-body">All senders</span>
            <Ico name="chevD" size={11}/>
          </Row>
        </Col>
        <Col className="wf-field" style={{flex:1}}>
          <div className="wf-label">Search codes</div>
          <Row className="wf-box" style={{padding:'6px 10px', background:WF.paper, gap:8, alignItems:'center'}}>
            <Ico name="search" size={11}/>
            <input className="wf-input" style={{border:'none', background:'transparent', padding:0, flex:1}} placeholder="code or display…"/>
          </Row>
        </Col>
        <button className="wf-btn"><Ico name="filter" size={11}/> Clear</button>
      </Row>

      <div className="wf-box" style={{flex:1, background:WF.paper, overflow:'hidden', display:'flex', flexDirection:'column'}}>
        <Row style={{padding:'10px 14px', borderBottom:`1.25px solid ${WF.line}`, gap:12, alignItems:'center', background:WF.mutedBg}}>
          <span style={{width:14}}/>
          <span className="wf-label" style={{width:150}}>Sender</span>
          <span className="wf-label" style={{width:130}}>Local code</span>
          <span className="wf-label" style={{flex:1}}>Display</span>
          <span style={{width:24}}/>
          <span className="wf-label" style={{width:110}}>Target code</span>
          <span className="wf-label" style={{width:130}}>System</span>
          <span className="wf-label" style={{width:110}}>Field</span>
          <span className="wf-label" style={{width:60, textAlign:'right'}}>Uses</span>
        </Row>
        <Col style={{overflow:'auto', flex:1}}>
          {/* Row above */}
          <Row style={{padding:'9px 14px', gap:12, borderBottom:`1px dashed ${WF.lineLight}`, alignItems:'center'}}>
            <Ico name="chev" size={11}/>
            <Row style={{width:150, gap:6}}>
              <span className="wf-dot" style={{background:WF.accent, opacity:.8}}/>
              <span className="wf-body">ACME_LAB</span>
            </Row>
            <span className="wf-mono" style={{width:130, fontSize:12}}>K</span>
            <span className="wf-body" style={{flex:1, color:WF.ink2}}>Potassium</span>
            <div style={{width:24}}><Arrow w={18}/></div>
            <span className="wf-mono" style={{width:110, fontWeight:600, fontSize:12, color:WF.accent}}>2823-3</span>
            <span className="wf-mono wf-tiny" style={{width:130}}>LOINC</span>
            <span className="wf-mono wf-tiny" style={{width:110}}>Obs.code</span>
            <span className="wf-body" style={{width:60, textAlign:'right'}}>84×</span>
          </Row>

          {/* EXPANDED ROW — edit form */}
          <Col style={{borderBottom:`1px dashed ${WF.lineLight}`, background:WF.accentSoft, borderLeft:`3px solid ${WF.accent}`}}>
            <Row style={{padding:'11px 14px', gap:12, alignItems:'center'}}>
              <Ico name="chevD" size={11}/>
              <Row style={{width:150, gap:6}}>
                <span className="wf-dot" style={{background:WF.accent}}/>
                <span className="wf-body" style={{fontWeight:600}}>ACME_LAB</span>
              </Row>
              <span className="wf-mono" style={{width:130, fontSize:12, fontWeight:700}}>UNKNOWN_TEST</span>
              <span className="wf-body" style={{flex:1, color:WF.ink2}}>Unknown Lab Test</span>
              <div style={{width:24}}><Arrow w={18}/></div>
              <span className="wf-mono" style={{width:110, fontWeight:600, fontSize:12, color:WF.accent}}>LP6994-0</span>
              <span className="wf-mono wf-tiny" style={{width:130}}>LOINC</span>
              <span className="wf-mono wf-tiny" style={{width:110}}>Obs.code</span>
              <span className="wf-body" style={{width:60, textAlign:'right'}}>1×</span>
            </Row>

            <div style={{padding:'0 14px 14px 40px', background:WF.accentSoft}}>
              <div className="wf-box" style={{background:WF.paper, padding:'14px 16px'}}>
                {/* Source (read-only) + Target (editable) + Field selector */}
                <Row style={{gap:20, alignItems:'flex-start'}}>
                  {/* SOURCE — immutable (it's what came in on the wire) */}
                  <Col style={{flex:1, gap:10}}>
                    <Row style={{gap:8, alignItems:'baseline'}}>
                      <div className="wf-h3">Source</div>
                      <span className="wf-tiny">· from HL7v2 · read-only</span>
                    </Row>
                    <Row style={{gap:10}}>
                      <Col style={{flex:1, gap:2}}>
                        <div className="wf-label">System</div>
                        <div className="wf-box" style={{padding:'6px 10px', background:WF.mutedBg}}>
                          <span className="wf-mono" style={{fontSize:12}}>LOCAL</span>
                        </div>
                      </Col>
                      <Col style={{flex:1, gap:2}}>
                        <div className="wf-label">Code</div>
                        <div className="wf-box" style={{padding:'6px 10px', background:WF.mutedBg}}>
                          <span className="wf-mono" style={{fontSize:12}}>UNKNOWN_TEST</span>
                        </div>
                      </Col>
                    </Row>
                    <Col style={{gap:2}}>
                      <div className="wf-label">Display</div>
                      <div className="wf-box" style={{padding:'6px 10px', background:WF.mutedBg}}>
                        <span className="wf-body">Unknown Lab Test</span>
                      </div>
                    </Col>
                    <Col style={{gap:2}}>
                      <div className="wf-label">Field</div>
                      <Row className="wf-box" style={{padding:'6px 10px', background:WF.paper, justifyContent:'space-between', alignItems:'center'}}>
                        <span className="wf-mono" style={{fontSize:12}}>Observation.code</span>
                        <Ico name="chevD" size={11}/>
                      </Row>
                      <span className="wf-tiny">changing the field re-scopes the mapping</span>
                    </Col>
                  </Col>

                  <div className="wf-vdivider"/>

                  {/* TARGET — editable; this is what the user is here to do */}
                  <Col style={{flex:1.2, gap:10}}>
                    <Row style={{gap:8, alignItems:'baseline'}}>
                      <div className="wf-h3 wf-accent-ink">Target · what it should map to</div>
                    </Row>
                    <Row style={{gap:10}}>
                      <Col style={{width:160, gap:2}}>
                        <div className="wf-label">System</div>
                        <div className="wf-box" style={{padding:'6px 10px', background:WF.mutedBg}}>
                          <span className="wf-mono" style={{fontSize:12}}>LOINC</span>
                        </div>
                      </Col>
                      <Col style={{flex:1, gap:2}}>
                        <div className="wf-label">Code</div>
                        <Row className="wf-box" style={{padding:'6px 10px', background:WF.paper, gap:8, alignItems:'center', borderColor:WF.accent, boxShadow:`0 0 0 2px ${WF.accentSoft}`}}>
                          <Ico name="search" size={11}/>
                          <input className="wf-input wf-mono" style={{border:'none', background:'transparent', padding:0, flex:1, fontSize:13, fontWeight:600, color:WF.accent}} defaultValue="LP6994-0"/>
                          <span className="wf-tiny">picked</span>
                        </Row>
                      </Col>
                    </Row>

                    {/* Code picker suggestions */}
                    <Col className="wf-box" style={{padding:0, background:WF.paper, maxHeight:180, overflow:'auto'}}>
                      {[
                        ['LP6994-0','Abscess',                                 true, 'exact name match'],
                        ['2345-7',  'Glucose [Mass/volume] in Serum or Plasma', false, '82% similar'],
                        ['3141-9',  'Body weight',                             false, ''],
                        ['718-7',   'Hemoglobin [Mass/volume]',                false, ''],
                      ].map((r,i) => (
                        <Row key={i} style={{padding:'7px 10px', gap:10, borderBottom: i<3? `1px dashed ${WF.lineLight}`:'none', background: r[2]? WF.accentSoft : 'transparent', alignItems:'center'}}>
                          <span className="wf-mono" style={{width:90, fontSize:12, fontWeight:600, color:WF.accent}}>{r[0]}</span>
                          <span className="wf-body" style={{flex:1, color:WF.ink2}}>{r[1]}</span>
                          <span className="wf-tiny">{r[3]}</span>
                          {r[2] && <Ico name="check" size={11} color={WF.accent}/>}
                        </Row>
                      ))}
                    </Col>

                    <Col style={{gap:2}}>
                      <div className="wf-label">Display (optional override)</div>
                      <input className="wf-input" defaultValue="Abscess"/>
                    </Col>
                  </Col>
                </Row>

                {/* Footer: save / delete / cancel + impact note */}
                <div className="wf-divider" style={{margin:'14px 0 10px'}}/>
                <Row style={{justifyContent:'space-between', alignItems:'center'}}>
                  <Row style={{gap:6, alignItems:'center'}}>
                    <Ico name="info" size={11} color={WF.accent}/>
                    <span className="wf-tiny">applies to all future messages · 1 message already in triage will be reprocessed</span>
                  </Row>
                  <Row style={{gap:8}}>
                    <span className="wf-chip wf-chip-ghost" style={{color:'#a4342a', borderColor:'#d07a6a'}}>Delete mapping</span>
                    <button className="wf-btn">Cancel</button>
                    <button className="wf-btn wf-btn-accent">Save mapping</button>
                  </Row>
                </Row>
              </div>
            </div>
          </Col>

          {/* Row below */}
          <Row style={{padding:'9px 14px', gap:12, borderBottom:`1px dashed ${WF.lineLight}`, alignItems:'center'}}>
            <Ico name="chev" size={11}/>
            <Row style={{width:150, gap:6}}>
              <span className="wf-dot" style={{background:WF.accent, opacity:.8}}/>
              <span className="wf-body">hospital</span>
            </Row>
            <span className="wf-mono" style={{width:130, fontSize:12}}>INP</span>
            <span className="wf-body" style={{flex:1, color:WF.ink2}}>Inpatient</span>
            <div style={{width:24}}><Arrow w={18}/></div>
            <span className="wf-mono" style={{width:110, fontWeight:600, fontSize:12, color:WF.accent}}>IMP</span>
            <span className="wf-mono wf-tiny" style={{width:130}}>ActCode</span>
            <span className="wf-mono wf-tiny" style={{width:110}}>Enc.class</span>
            <span className="wf-body" style={{width:60, textAlign:'right'}}>312×</span>
          </Row>
        </Col>
      </div>
    </Col>
  </Screen>
);

// ── V3: Single-mapping detail — edit one wire, see usage history
const TermV3 = () => (
  <Screen nav="terminology" title="Terminology map" subtitle="Edit one mapping">
    <Row style={{gap:12, height:'100%'}}>
      {/* narrow list */}
      <Col className="wf-box" style={{width:280, padding:'8px 0', background:WF.paper, overflow:'auto'}}>
        <Row style={{padding:'6px 10px', gap:6}}>
          <Ico name="search" size={11}/><input className="wf-input" style={{border:'none', background:'transparent', padding:0, flex:1}} placeholder="filter…"/>
        </Row>
        {[
          ['GLUC_FASTING','1558-6', true],
          ['NA','2951-2'],
          ['K','2823-3'],
          ['INP','IMP'],
          ['OBS','OBSENC'],
          ['BCBS','UB04:BC'],
          ['CREAT','2160-0'],
        ].map((r,i) => (
          <Row key={i} style={{padding:'8px 12px', background: r[2]? WF.accentSoft : 'transparent', gap:6, borderBottom:`1px dashed ${WF.lineLight}`}}>
            <span className="wf-mono" style={{width:110, fontSize:12, fontWeight:600}}>{r[0]}</span>
            <Arrow w={16}/>
            <span className="wf-mono" style={{fontSize:12, flex:1}}>{r[1]}</span>
          </Row>
        ))}
      </Col>

      <Col className="wf-box" style={{flex:1, padding:'18px 22px', background:WF.paper, overflow:'auto'}}>
        <Row style={{justifyContent:'space-between'}}>
          <Col style={{gap:2}}>
            <div className="wf-label">mapping</div>
            <Row style={{gap:10, alignItems:'baseline'}}>
              <span className="wf-mono" style={{fontSize:22, fontWeight:600}}>GLUC_FASTING</span>
              <Arrow w={28}/>
              <span className="wf-mono" style={{fontSize:22, fontWeight:600, color:WF.accent}}>1558-6</span>
            </Row>
          </Col>
          <Row style={{gap:6}}>
            <span className="wf-chip wf-chip-ghost">disable</span>
            <span className="wf-chip wf-chip-ghost">duplicate</span>
            <button className="wf-btn wf-btn-accent">Save</button>
          </Row>
        </Row>

        <div className="wf-divider" style={{margin:'14px 0'}}/>

        <Row style={{gap:20}}>
          <Col style={{flex:1, gap:12}}>
            <div className="wf-h3">Source</div>
            {[['System','ACME_LAB | ACME_HOSP'],['Code','GLUC_FASTING'],['Display','Glucose (fasting)'],['Field','Observation.code']].map((r,i) => (
              <Col key={i} className="wf-field">
                <div className="wf-label">{r[0]}</div>
                <input className="wf-input" defaultValue={r[1]}/>
              </Col>
            ))}
          </Col>
          <div className="wf-vdivider"/>
          <Col style={{flex:1, gap:12}}>
            <div className="wf-h3">Target</div>
            {[['System','LOINC'],['Code','1558-6'],['Display','Fasting glucose [Mass/volume]'],['Unit','mg/dL (mg:m{L})']].map((r,i) => (
              <Col key={i} className="wf-field">
                <div className="wf-label">{r[0]}</div>
                <input className="wf-input" defaultValue={r[1]}/>
              </Col>
            ))}
          </Col>
        </Row>

        <div className="wf-divider" style={{margin:'16px 0 12px'}}/>
        <div className="wf-h3" style={{marginBottom:6}}>Usage · last 7 days</div>
        <Row className="wf-box-dashed" style={{padding:'10px 12px', gap:4, alignItems:'flex-end', height:70}}>
          {[6,14,8,22,11,19,4].map((h,i) => (
            <Col key={i} style={{flex:1, alignItems:'center', gap:3}}>
              <div style={{width:'100%', height:h*2, background: WF.accent, opacity:.7, borderRadius:2}}/>
              <span className="wf-tiny">{['M','T','W','T','F','S','S'][i]}</span>
            </Col>
          ))}
        </Row>
      </Col>
    </Row>
  </Screen>
);

// ══════════════════════ ACCOUNTS ══════════════════════

// ── V1: List of accounts with status + BAR counts
const AccountsV1 = () => (
  <Screen nav="accounts" title="Accounts" subtitle="FHIR Account resources built from BAR messages"
    right={<Row style={{gap:8}}><span className="wf-chip wf-chip-ghost">42 accounts · 5 pending</span><button className="wf-btn"><Ico name="refresh" size={11}/> Run now (5)</button></Row>}>
    <Col style={{gap:10, height:'100%'}}>
      <Row style={{gap:6}}>
        {['All · 42','Active · 35','Pending BAR · 5','Error · 2'].map((t,i) => (
          <span key={i} className={'wf-chip ' + (i===0?'wf-chip-accent':'')}>{t}</span>
        ))}
      </Row>
      <Col style={{gap:8, flex:1, overflow:'auto'}}>
        {[
          {n:'Smith, John (P12345)', id:'acct-001', st:'ok',   ins:'BCBS · Group GRP001', enc:3, bar:1, last:'2m ago'},
          {n:'Doe, Jane (P67890)',   id:'acct-002', st:'pend', ins:'Aetna · Group AX-22', enc:1, bar:0, last:'5m ago'},
          {n:'Lee, Ava (P11001)',    id:'acct-003', st:'ok',   ins:'Medicare Part B',     enc:8, bar:3, last:'12m ago'},
          {n:'Garcia, M (P22002)',   id:'acct-004', st:'err',  ins:'—',                   enc:0, bar:0, last:'1h ago', err:'missing IN1 segment'},
          {n:'Patel, R (P33003)',    id:'acct-005', st:'ok',   ins:'Humana · HMO-7',      enc:2, bar:2, last:'2h ago'},
        ].map((a,i) => (
          <div key={i} className="wf-box" style={{padding:'12px 14px', background:WF.paper}}>
            <Row style={{justifyContent:'space-between', alignItems:'baseline'}}>
              <Row style={{gap:8, alignItems:'baseline'}}>
                <span className="wf-h3">{a.n}</span>
                <StatusChip kind={a.st}>{a.st==='ok'?'active':a.st==='pend'?'BAR pending':'error'}</StatusChip>
              </Row>
              <span className="wf-mono wf-tiny">{a.id}</span>
            </Row>
            <Row style={{gap:18, marginTop:6}}>
              <Stat label="insurance" v={a.ins}/>
              <Stat label="encounters" v={String(a.enc)}/>
              <Stat label="BAR built" v={String(a.bar)}/>
              <Stat label="last update" v={a.last}/>
              {a.err && <Row style={{gap:5, alignItems:'center', marginLeft:'auto'}}><Ico name="warn" size={12} color="#8a2a1a"/><span className="wf-body" style={{color:'#8a2a1a'}}>{a.err}</span></Row>}
            </Row>
          </div>
        ))}
      </Col>
    </Col>
  </Screen>
);

// ── V2: Card grid — summary tile per account
const AccountsV2 = () => (
  <Screen nav="accounts" title="Accounts" subtitle="Grid view · click a card to open">
    <Col style={{gap:12, height:'100%'}}>
      <Row style={{gap:6}}>
        <span className="wf-chip wf-chip-accent">All · 42</span>
        <span className="wf-chip">Active · 35</span>
        <span className="wf-chip">Pending · 5</span>
        <span className="wf-chip">Error · 2</span>
        <div style={{flex:1}}/>
        <Row className="wf-chip" style={{padding:'2px 10px'}}><Ico name="search" size={11}/> <input className="wf-input" style={{border:'none', background:'transparent', padding:0, width:140}} placeholder="search accounts…"/></Row>
      </Row>
      <div style={{flex:1, overflow:'auto', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12}}>
        {[
          {n:'Smith, John',  p:'P12345', st:'ok',  ins:'BCBS', bar:1, enc:3, accent:true},
          {n:'Doe, Jane',    p:'P67890', st:'pend',ins:'Aetna', bar:0, enc:1},
          {n:'Lee, Ava',     p:'P11001', st:'ok',  ins:'Medicare', bar:3, enc:8},
          {n:'Garcia, M',    p:'P22002', st:'err', ins:'—',   bar:0, enc:0},
          {n:'Patel, R',     p:'P33003', st:'ok',  ins:'Humana', bar:2, enc:2},
          {n:'Nguyen, Q',    p:'P44004', st:'ok',  ins:'Kaiser',bar:5, enc:5},
          {n:'Brown, T',     p:'P55005', st:'pend',ins:'Aetna', bar:0, enc:1},
          {n:'Khan, S',      p:'P66006', st:'ok',  ins:'BCBS',  bar:1, enc:2},
        ].map((a,i) => (
          <Col key={i} className="wf-box" style={{padding:'12px 14px', background: a.accent? WF.accentSoft : WF.paper, borderColor: a.accent? WF.accent : WF.line, gap:4}}>
            <Row style={{justifyContent:'space-between'}}>
              <div className="wf-h3">{a.n}</div>
              <StatusChip kind={a.st}>{a.st==='ok'?'active':a.st==='pend'?'pending':'error'}</StatusChip>
            </Row>
            <div className="wf-mono wf-tiny">{a.p}</div>
            <div className="wf-note" style={{marginTop:4}}>Insurance · {a.ins}</div>
            <Row style={{gap:12, marginTop:6}}>
              <Col><div className="wf-tiny">enc</div><div className="wf-hand" style={{fontSize:20, fontWeight:600}}>{a.enc}</div></Col>
              <Col><div className="wf-tiny">BAR</div><div className="wf-hand" style={{fontSize:20, fontWeight:600}}>{a.bar}</div></Col>
            </Row>
          </Col>
        ))}
      </div>
    </Col>
  </Screen>
);

// ── V3: Account detail — single account with history timeline
const AccountsV3 = () => (
  <Screen nav="accounts" title="Smith, John · P12345" subtitle="Account detail · activity & outbound BAR">
    <Row style={{gap:14, height:'100%'}}>
      <Col style={{width:300, gap:8}}>
        {/* mini list */}
        {['Smith, John','Doe, Jane','Lee, Ava','Garcia, M','Patel, R','Nguyen, Q'].map((n,i) => (
          <Row key={i} className="wf-box" style={{padding:'8px 10px', background: i===0? WF.accentSoft: WF.paper, borderColor: i===0? WF.accent : WF.lineLight, gap:6}}>
            <span className="wf-body" style={{flex:1, fontWeight: i===0?600:400}}>{n}</span>
            <span className="wf-tiny">P{10000+i}</span>
          </Row>
        ))}
      </Col>
      <Col style={{flex:1, gap:10}}>
        <Row style={{gap:12}}>
          <div className="wf-box" style={{flex:1, padding:'12px 14px', background:WF.paper}}>
            <div className="wf-label">Patient</div>
            <div className="wf-h2">Smith, John Robert</div>
            <div className="wf-note">DOB 1985-03-15 · male · MRN P12345</div>
          </div>
          <div className="wf-box" style={{flex:1, padding:'12px 14px', background:WF.paper}}>
            <div className="wf-label">Coverage</div>
            <div className="wf-h3">Blue Cross Blue Shield</div>
            <div className="wf-note">Group GRP001 · HMO · 2023-01-01 → 2023-12-31</div>
          </div>
          <div className="wf-box" style={{flex:1, padding:'12px 14px', background:WF.accentSoft, borderColor:WF.accent}}>
            <div className="wf-label">BAR pipeline</div>
            <div className="wf-h2">1 pending</div>
            <div className="wf-note">last sent 2m ago · ACK OK</div>
          </div>
        </Row>

        <div className="wf-box" style={{flex:1, padding:'12px 16px', background:WF.paper, overflow:'hidden'}}>
          <div className="wf-h3" style={{marginBottom:8}}>Activity</div>
          <Col style={{gap:0, overflow:'auto'}}>
            {[
              {t:'14:19',dir:'in', type:'ADT^A01', note:'Admit · WARD1 · Dr. ATTENDING', st:'ok'},
              {t:'14:20',dir:'sys', type:'Account',  note:'Account resource created · version 1',    st:'info'},
              {t:'14:21',dir:'in', type:'DG1',     note:'Diagnosis attached · I10 Hypertension',     st:'ok'},
              {t:'14:22',dir:'sys', type:'BAR builder', note:'BAR_P01 built · 3 segments',            st:'ok'},
              {t:'14:23',dir:'out',type:'BAR_P01', note:'Sent to downstream EHR · ACK OK',           st:'ok'},
              {t:'14:45',dir:'in', type:'ADT^A08', note:'Update · diagnosis addendum',               st:'ok'},
              {t:'14:46',dir:'sys', type:'BAR builder', note:'BAR_P01 pending (queued)',              st:'pend'},
            ].map((r,i) => (
              <Row key={i} style={{gap:10, padding:'7px 0', borderBottom:`1px dashed ${WF.lineLight}`}}>
                <span className="wf-mono" style={{width:42, fontSize:12}}>{r.t}</span>
                <span className="wf-hand" style={{width:18, fontSize:16, color: r.dir==='in'?WF.accent:r.dir==='out'?WF.ink2:WF.ink3}}>{r.dir==='in'?'↓':r.dir==='out'?'↑':'•'}</span>
                <span className="wf-mono" style={{width:100, fontSize:11}}>{r.type}</span>
                <span className="wf-body" style={{flex:1}}>{r.note}</span>
                <StatusChip kind={r.st}>{r.st}</StatusChip>
              </Row>
            ))}
          </Col>
        </div>
      </Col>
    </Row>
  </Screen>
);

// ══════════════════════ OUTGOING MESSAGES ══════════════════════

// ── V1: List (mirror of inbound with "Run now" + destination)
const OutgoingV1 = () => (
  <Screen nav="outgoing" title="Outgoing Messages" subtitle="BAR messages waiting to be sent downstream"
    right={<Row style={{gap:8}}>
      <Row style={{gap:5}}><span className="wf-pulse"><span className="wf-dot" style={{background:WF.accent}}/></span><span className="wf-tiny">Live · 5s</span></Row>
      <button className="wf-btn"><Ico name="refresh" size={11}/> Run now (5 pending)</button>
    </Row>}>
    <Col style={{gap:10, height:'100%'}}>
      <Row style={{gap:6}}>
        {['All · 37','Pending · 5','Sent · 30','Sending error · 2','Deferred · 0'].map((t,i) => (
          <span key={i} className={'wf-chip ' + (i===0?'wf-chip-accent':'')}>{t}</span>
        ))}
      </Row>
      <Col style={{gap:8, flex:1, overflow:'auto'}}>
        {[
          {id:'f9a2b1c0-…', t:'BAR_P01', dest:'MERCY_EMR',  ack:'AA', st:'ok',   acct:'acct-001', when:'2s ago'},
          {id:'e2afc1aa-…', t:'BAR_P01', dest:'MERCY_EMR',  ack:'—',  st:'pend', acct:'acct-003', when:'12s ago'},
          {id:'5227bfc2-…', t:'BAR_P01', dest:'MERCY_EMR',  ack:'AE', st:'err',  acct:'acct-004', when:'2m ago', err:'AE: missing segment'},
          {id:'a7d3ec11-…', t:'BAR_P01', dest:'CHILDRENS',  ack:'AA', st:'ok',   acct:'acct-005', when:'5m ago'},
          {id:'01caa91f-…', t:'BAR_P01', dest:'MERCY_EMR',  ack:'—',  st:'pend', acct:'acct-002', when:'10m ago'},
        ].map((r,i) => (
          <Row key={i} className="wf-box" style={{padding:'10px 14px', gap:10, background:WF.paper}}>
            <span className="wf-hand" style={{fontSize:18, color:WF.ink2, width:14}}>↑</span>
            <span className="wf-mono" style={{fontSize:12, width:140}}>{r.id}</span>
            <StatusChip kind={r.st}>{r.st==='ok'?'sent':r.st==='err'?'sending error':'pending'}</StatusChip>
            <span className="wf-mono" style={{fontSize:11, width:70}}>{r.t}</span>
            <span className="wf-body" style={{width:120}}>→ {r.dest}</span>
            <span className="wf-mono wf-tiny" style={{width:100}}>{r.acct}</span>
            <span className="wf-tiny" style={{width:80}}>ACK · {r.ack}</span>
            <span className="wf-tiny" style={{flex:1, textAlign:'right'}}>{r.when}</span>
          </Row>
        ))}
      </Col>
    </Col>
  </Screen>
);

// ── V2: Queue + detail (ACK roundtrip panel)
const OutgoingV2 = () => (
  <Screen nav="outgoing" title="Outgoing Messages" subtitle="Queue on left · ACK detail on right">
    <Row style={{gap:12, height:'100%'}}>
      <Col style={{width:340, gap:8}}>
        <Row style={{gap:6}}>
          <span className="wf-chip wf-chip-accent">Pending · 5</span>
          <span className="wf-chip">Sent · 30</span>
          <span className="wf-chip">Errors · 2</span>
        </Row>
        {[
          {id:'f9a2b1c0', dest:'MERCY_EMR', st:'ok', time:'2s', sel:true},
          {id:'e2afc1aa', dest:'MERCY_EMR', st:'pend', time:'12s'},
          {id:'5227bfc2', dest:'MERCY_EMR', st:'err',  time:'2m'},
          {id:'a7d3ec11', dest:'CHILDRENS', st:'ok',   time:'5m'},
          {id:'01caa91f', dest:'MERCY_EMR', st:'pend', time:'10m'},
          {id:'92b1fc01', dest:'MERCY_EMR', st:'ok',   time:'14m'},
        ].map((r,i) => (
          <div key={i} className="wf-box" style={{padding:'8px 10px', background: r.sel? WF.accentSoft : WF.paper, borderColor: r.sel? WF.accent : WF.lineLight}}>
            <Row style={{justifyContent:'space-between'}}>
              <span className="wf-mono" style={{fontSize:12, fontWeight:600}}>BAR_P01</span>
              <StatusChip kind={r.st}>{r.st}</StatusChip>
            </Row>
            <div className="wf-mono wf-tiny" style={{marginTop:2}}>{r.id}…</div>
            <Row style={{justifyContent:'space-between', marginTop:3}}>
              <span className="wf-tiny">→ {r.dest}</span>
              <span className="wf-tiny">{r.time} ago</span>
            </Row>
          </div>
        ))}
      </Col>

      <Col style={{flex:1, gap:10}}>
        <div className="wf-box" style={{padding:'14px 18px', background:WF.paper}}>
          <Row style={{justifyContent:'space-between'}}>
            <Col style={{gap:2}}>
              <Row style={{gap:10, alignItems:'baseline'}}>
                <span className="wf-h2 wf-mono">BAR_P01</span>
                <StatusChip kind="ok">sent</StatusChip>
              </Row>
              <span className="wf-mono wf-tiny">f9a2b1c0-6e77-4801-9aaa-cc37dd1122ee</span>
            </Col>
            <Row style={{gap:6}}>
              <span className="wf-chip wf-chip-ghost">resend</span>
              <span className="wf-chip wf-chip-ghost">open account</span>
            </Row>
          </Row>
          <Row style={{gap:18, marginTop:10}}>
            <Stat label="destination" v="MERCY_EMR"/>
            <Stat label="account" v="acct-001"/>
            <Stat label="sent" v="14:19:44"/>
            <Stat label="ACK" v="AA · 38ms"/>
          </Row>
        </div>

        <Row style={{gap:12, flex:1, overflow:'hidden'}}>
          <div className="wf-box" style={{flex:1, padding:'12px 14px', background:WF.paper, overflow:'auto'}}>
            <div className="wf-h3" style={{marginBottom:6}}>Message out →</div>
            <Col className="wf-mono" style={{fontSize:11, gap:2}}>
              {['MSH|^~\\&|US|EMR|MERCY_EMR|DEST|20260422|BAR_P01|MSG…|P|2.5',
                'EVN|P01|20260422',
                'PID|1||P12345^^^HOSPITAL^MR||Smith^John',
                'PV1|1|I|WARD1^ROOM1^BED1',
                'GT1|1||Smith^John||123 Main St^^Anytown^CA^12345',
                'IN1|1|BCBS^Blue Cross Blue Shield||GRP001|Blue Cross Group'].map((l,i) => (
                  <Row key={i} style={{gap:8}}><span style={{width:18, color:WF.ink3}}>{i+1}</span><span style={{whiteSpace:'pre'}}><span style={{color:WF.accent, fontWeight:600}}>{l.slice(0,3)}</span>{l.slice(3)}</span></Row>
              ))}
            </Col>
          </div>
          <div className="wf-box" style={{flex:1, padding:'12px 14px', background:'#e3f3e8', borderColor:'#7fbf9a'}}>
            <Row style={{gap:8, marginBottom:4}}><Ico name="check" size={12} color="#1f6a3a"/><div className="wf-h3" style={{color:'#1f6a3a'}}>ACK ←</div></Row>
            <Col className="wf-mono" style={{fontSize:11, gap:2, color:'#1f6a3a'}}>
              <div>MSH|^~\&|MERCY_EMR|DEST|…|ACK|MSG1776853070180|P|2.4</div>
              <div>MSA|AA|MSG1776853014445</div>
            </Col>
            <div className="wf-divider" style={{margin:'12px 0 10px'}}/>
            <div className="wf-h3">Roundtrip</div>
            <Row style={{gap:10, marginTop:6, alignItems:'center'}}>
              <span className="wf-chip">TCP 8ms</span><Arrow w={16}/>
              <span className="wf-chip">MLLP 4ms</span><Arrow w={16}/>
              <span className="wf-chip">ACK 38ms</span>
            </Row>
          </div>
        </Row>
      </Col>
    </Row>
  </Screen>
);

// ── V3: Throughput dashboard — stats + retry controls
const OutgoingV3 = () => (
  <Screen nav="outgoing" title="Outgoing throughput" subtitle="Last hour · failures and retries">
    <Col style={{gap:12, height:'100%'}}>
      <Row style={{gap:12}}>
        <div className="wf-box" style={{flex:1, padding:'12px 14px', background:WF.paper}}>
          <div className="wf-label">Sent · last hour</div>
          <div className="wf-hand" style={{fontSize:36, fontWeight:600}}>37</div>
          <div className="wf-tiny">median 42ms · p95 120ms</div>
        </div>
        <div className="wf-box" style={{flex:1, padding:'12px 14px', background:WF.accentSoft, borderColor:WF.accent}}>
          <div className="wf-label">Pending</div>
          <div className="wf-hand" style={{fontSize:36, fontWeight:600}}>5</div>
          <div className="wf-tiny">oldest queued 10m ago</div>
        </div>
        <div className="wf-box" style={{flex:1, padding:'12px 14px', background:WF.paper}}>
          <div className="wf-label">Errors</div>
          <div className="wf-hand" style={{fontSize:36, fontWeight:600, color:'#8a2a1a'}}>2</div>
          <div className="wf-tiny">1 AE, 1 timeout</div>
        </div>
        <div className="wf-box" style={{flex:1, padding:'12px 14px', background:WF.paper}}>
          <div className="wf-label">Worker</div>
          <Row style={{gap:6, alignItems:'baseline', marginTop:4}}>
            <span className="wf-dot" style={{background:'#3fb56b'}}/>
            <span className="wf-hand" style={{fontSize:22, fontWeight:600}}>running</span>
          </Row>
          <div className="wf-tiny">polls every 5s</div>
        </div>
      </Row>

      {/* Chart area */}
      <div className="wf-box" style={{padding:'14px 18px', background:WF.paper}}>
        <Row style={{justifyContent:'space-between'}}>
          <div className="wf-h3">Messages / minute</div>
          <Row style={{gap:6}}>
            <span className="wf-chip wf-chip-ghost">1h</span>
            <span className="wf-chip">6h</span>
            <span className="wf-chip">24h</span>
          </Row>
        </Row>
        <Row style={{alignItems:'flex-end', gap:3, height:80, marginTop:10, borderBottom:`1px solid ${WF.lineLight}`}}>
          {[4,6,3,8,5,7,12,9,6,4,8,10,14,7,5,3,6,9,11,8,4,2,7,9].map((v,i) => (
            <div key={i} style={{flex:1, height: v*5, background: i===12? WF.ink : WF.accent, opacity: i===12? 1 : .75, borderRadius:2, position:'relative'}}>
              {v >= 12 && i===12 && <div className="wf-tiny" style={{position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)', whiteSpace:'nowrap'}}>peak</div>}
            </div>
          ))}
        </Row>
        <Row style={{justifyContent:'space-between', marginTop:4}}>
          <span className="wf-tiny">60m ago</span>
          <span className="wf-tiny">now</span>
        </Row>
      </div>

      {/* Error table */}
      <div className="wf-box" style={{flex:1, padding:'10px 14px', background:WF.paper, overflow:'hidden'}}>
        <Row style={{justifyContent:'space-between', marginBottom:8}}>
          <div className="wf-h3">Requires attention</div>
          <Row style={{gap:6}}>
            <button className="wf-btn" style={{padding:'3px 10px', fontSize:13}}>Retry all</button>
            <button className="wf-btn" style={{padding:'3px 10px', fontSize:13}}>Defer all</button>
          </Row>
        </Row>
        <Col style={{gap:6}}>
          {[
            {t:'14:17',id:'5227bfc2', dest:'MERCY_EMR', err:'AE · missing IN1 segment', age:'2m'},
            {t:'13:58',id:'41aecbcd', dest:'CHILDRENS', err:'timeout · no ACK within 5s', age:'21m'},
          ].map((r,i) => (
            <Row key={i} style={{padding:'8px 10px', border:`1px dashed ${WF.lineLight}`, borderRadius:6, gap:10}}>
              <Ico name="warn" size={14} color="#8a2a1a"/>
              <span className="wf-mono" style={{fontSize:12, width:90}}>{r.id}…</span>
              <span className="wf-body" style={{width:120}}>→ {r.dest}</span>
              <span className="wf-body" style={{flex:1}}>{r.err}</span>
              <span className="wf-tiny">{r.age} ago</span>
              <span className="wf-chip wf-chip-accent" style={{fontSize:11}}>retry</span>
            </Row>
          ))}
        </Col>
      </div>
    </Col>
  </Screen>
);

Object.assign(window, { TermV1, TermV1NoGate, TermV2, TermV3, TermEdit, AccountsV1, AccountsV2, AccountsV3, OutgoingV1, OutgoingV2, OutgoingV3 });
