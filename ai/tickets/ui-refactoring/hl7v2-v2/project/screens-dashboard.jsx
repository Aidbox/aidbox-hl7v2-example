// Dashboard — 3 variations, all focused on "show pipeline is live + one-click demo"

// ── V1: Clean ops dashboard — pipeline diagram up top, count tiles, activity feed
const DashV1 = () => (
  <Screen nav="dashboard" title="HL7v2 ↔ FHIR pipeline" subtitle="Live demo environment · inbound & outbound messages"
    right={<Row style={{gap:8}}>
      <span className="wf-chip"><Ico name="clock" size={11}/> Last refresh 2s ago</span>
      <button className="wf-btn wf-btn-accent"><Ico name="play" size={11} color="white"/> Run demo scenario</button>
    </Row>}>
    <Col style={{gap:14, height:'100%'}}>
      {/* Pipeline diagram */}
      <div className="wf-box" style={{padding:'18px 22px'}}>
        <Row style={{justifyContent:'space-between', marginBottom:10}}>
          <div className="wf-h3">Flow</div>
          <div className="wf-note">(hover any step to inspect)</div>
        </Row>
        <Row style={{gap:6, alignItems:'center'}}>
          <PipeStep label="Sender" sub="ACME_LAB" small/>
          <Arrow w={34}/>
          <PipeStep label="MLLP" sub="port 2575" small/>
          <Arrow w={34}/>
          <PipeStep label="Inbound" sub="Queue · 142" active small/>
          <Arrow w={34}/>
          <PipeStep label="Convert" sub="HL7→FHIR" small/>
          <Arrow w={34}/>
          <PipeStep label="Aidbox" sub="FHIR store" small/>
        </Row>
        <Sp h={10}/>
        <Row style={{gap:6, alignItems:'center'}}>
          <PipeStep label="Account" sub="BAR builder" small/>
          <Arrow w={34}/>
          <PipeStep label="Outgoing" sub="Queue · 5" small/>
          <Arrow w={34}/>
          <PipeStep label="Receiver" sub="downstream EHR" small/>
          <div style={{flex:1}}/>
          <span className="wf-note">outbound</span>
        </Row>
      </div>

      {/* Count tiles */}
      <Row style={{gap:12}}>
        <CountTile n="142" label="Received today" trend="+8"/>
        <CountTile n="137" label="Processed" trend="+8" good/>
        <CountTile n="2"   label="Errored" trend="+1" bad/>
        <CountTile n="3"   label="Unmapped codes" trend="pending" accent/>
      </Row>

      {/* Activity */}
      <div className="wf-box" style={{flex:1, padding:'12px 16px', display:'flex', flexDirection:'column', overflow:'hidden'}}>
        <Row style={{justifyContent:'space-between', marginBottom:8}}>
          <div className="wf-h3">Recent activity</div>
          <Row style={{gap:12}}>
            <span className="wf-tab wf-tab-on" style={{padding:'0 4px'}}>All</span>
            <span className="wf-tab" style={{padding:'0 4px'}}>Inbound</span>
            <span className="wf-tab" style={{padding:'0 4px'}}>Outbound</span>
            <span className="wf-tiny" style={{marginLeft:8}}>•••</span>
          </Row>
        </Row>
        <Col style={{gap:0}}>
          {[
            {dir:'in',  t:'ORU^R01', id:'c630f1cb…', status:'ok',   when:'2s ago',  note:'Lab result'},
            {dir:'out', t:'BAR_P01', id:'f9a2b1…',   status:'ok',   when:'5s ago',  note:'to MERCY_EMR'},
            {dir:'in',  t:'ORU^R01', id:'a7d3e…',    status:'warn', when:'12s ago', note:'unknown LOINC'},
            {dir:'in',  t:'ADT^A01', id:'9b4cd…',    status:'ok',   when:'21s ago', note:'Admit'},
            {dir:'out', t:'BAR_P01', id:'e2afc…',    status:'pend', when:'34s ago', note:'queued'},
            {dir:'in',  t:'VXU^V04', id:'5c11a…',    status:'ok',   when:'42s ago', note:'Immunization'},
            {dir:'in',  t:'BAR_P01', id:'5227bfc2…', status:'err',  when:'2m ago',  note:'conversion error'},
          ].map((r,i) => <ActivityRow key={i} {...r}/>)}
        </Col>
      </div>
    </Col>
  </Screen>
);

const PipeStep = ({label, sub, active, small}) => (
  <div className="wf-box" style={{padding: small?'6px 10px':'10px 14px', borderColor: active? WF.accent : WF.line, background: active? WF.accentSoft : WF.paper, minWidth: small? 88: 110, textAlign:'center'}}>
    <div className="wf-hand" style={{fontSize: small?14:16, fontWeight:600, color:WF.ink}}>{label}</div>
    <div className="wf-tiny">{sub}</div>
  </div>
);

const CountTile = ({n, label, trend, good, bad, accent}) => (
  <div className="wf-box" style={{flex:1, padding:'14px 16px', borderColor: accent? WF.accent : WF.line, background: accent? WF.accentSoft : WF.paper}}>
    <Row style={{justifyContent:'space-between', alignItems:'flex-start'}}>
      <div className="wf-hand" style={{fontSize:40, fontWeight:600, lineHeight:1, color: bad? '#8a2a1a' : (good? '#1f6a3a' : WF.ink)}}>{n}</div>
      {trend && <span className="wf-tiny" style={{color: bad? '#8a2a1a' : (good? '#1f6a3a' : WF.ink3)}}>{trend}</span>}
    </Row>
    <div className="wf-label" style={{marginTop:4}}>{label}</div>
  </div>
);

const ActivityRow = ({dir, t, id, status, when, note}) => {
  const arrow = dir === 'in' ? '↓' : '↑';
  return (
    <Row style={{padding:'7px 4px', borderBottom:`1px dashed ${WF.lineLight}`, gap:10, fontSize:13}}>
      <span className="wf-hand" style={{color: dir==='in'? WF.accent : WF.ink2, fontSize:18, width:14}}>{arrow}</span>
      <span className="wf-mono" style={{width:88, fontSize:12}}>{t}</span>
      <span className="wf-mono wf-tiny" style={{width:100}}>{id}</span>
      <StatusChip kind={status}>{status==='ok'?'processed':status==='warn'?'needs mapping':status==='err'?'error':'pending'}</StatusChip>
      <span className="wf-note" style={{flex:1}}>{note}</span>
      <span className="wf-tiny">{when}</span>
    </Row>
  );
};

// ── V2: "Demo conductor" — giant demo button + live ticker vibe
const DashV2 = () => (
  <Screen nav="dashboard" title="Demo control" subtitle="One click runs a scripted HL7v2 scenario end-to-end">
    <Col style={{gap:14, height:'100%'}}>
      {/* Demo hero */}
      <div className="wf-box wf-grid-dots" style={{padding:'20px 24px', background:WF.paper}}>
        <Row style={{gap:20, alignItems:'center'}}>
          <Col style={{flex:1, gap:6}}>
            <div className="wf-h2">Run scripted demo <span className="wf-under">in 4 steps</span></div>
            <Row style={{gap:10, marginTop:4}}>
              <DemoStep n="1" label="ADT^A01" sub="admit patient"/>
              <Arrow w={22}/>
              <DemoStep n="2" label="ORU^R01" sub="known LOINC"/>
              <Arrow w={22}/>
              <DemoStep n="3" label="VXU^V04" sub="immunization"/>
              <Arrow w={22}/>
              <DemoStep n="4" label="ORU (unknown)" sub="triggers triage" accent/>
            </Row>
            <div className="wf-note" style={{marginTop:6}}>2s spacing · last run 4 min ago · all green ✓</div>
          </Col>
          <Col style={{gap:8, alignItems:'flex-end'}}>
            <button className="wf-btn wf-btn-accent" style={{fontSize:18, padding:'10px 18px'}}>
              <Ico name="play" size={14} color="white"/> Run demo now
            </button>
            <Row style={{gap:6}}>
              <span className="wf-chip wf-chip-ghost"><Ico name="bolt" size={10}/> Send single</span>
              <span className="wf-chip wf-chip-ghost"><Ico name="refresh" size={10}/> Reset</span>
            </Row>
          </Col>
        </Row>
      </div>

      <Col style={{gap:10, flex:1, overflow:'hidden'}}>
        {/* Compact stats strip */}
        <div className="wf-box" style={{padding:'8px 14px', background:WF.paper}}>
          <Row style={{gap:0, alignItems:'stretch'}}>
            <StatInline n="142" label="received today" foot="+8 this minute"/>
            <div className="wf-vdivider" style={{margin:'2px 14px'}}/>
            <StatInline n="3" label="need mapping" foot="go to triage →" accent/>
            <div className="wf-vdivider" style={{margin:'2px 14px'}}/>
            <StatInline n="2" label="errors" foot="1 parsing · 1 conversion" bad/>
            <div className="wf-vdivider" style={{margin:'2px 14px'}}/>
            <Col style={{flex:1.2, gap:2, justifyContent:'center'}}>
              <Row style={{gap:10}}>
                {[['ORU processor', true], ['BAR builder', true], ['BAR sender', true]].map(([n,on],i) => (
                  <Row key={i} style={{gap:4}}>
                    <span className="wf-dot" style={{background: on? '#3fb56b':WF.ink3}}/>
                    <span className="wf-body" style={{fontSize:12}}>{n}</span>
                  </Row>
                ))}
              </Row>
              <span className="wf-tiny">workers · polling every 5s</span>
            </Col>
          </Row>
        </div>

        {/* Live ticker (full-width) */}
        <div className="wf-box" style={{flex:1, padding:'12px 14px', display:'flex', flexDirection:'column', overflow:'hidden'}}>
          <Row style={{justifyContent:'space-between', marginBottom:8}}>
            <Row style={{gap:6}}>
              <span className="wf-pulse"><span className="wf-dot" style={{background:WF.accent}}/></span>
              <div className="wf-h3">Live ticker</div>
            </Row>
            <span className="wf-tiny">auto-refresh 5s · <u>pause</u></span>
          </Row>
          <Col style={{gap:0, overflow:'auto'}}>
            {[
              ['14:19:46','ORU^R01','unknown LOINC — routed to triage','warn'],
              ['14:19:44','ORU^R01','processed (3 observations)','ok'],
              ['14:19:40','VXU^V04','processed (1 immunization)','ok'],
              ['14:19:38','ADT^A01','processed · patient P12345','ok'],
              ['14:19:36','—',      'polling services started','info'],
              ['14:19:34','ADT^A01','received','pend'],
            ].map((r,i) => (
              <Row key={i} style={{padding:'6px 2px', borderBottom:`1px dashed ${WF.lineLight}`, gap:10, fontSize:12}}>
                <span className="wf-mono wf-tiny" style={{width:60}}>{r[0]}</span>
                <span className="wf-mono" style={{width:90, fontSize:11}}>{r[1]}</span>
                <span className="wf-body" style={{flex:1}}>{r[2]}</span>
                <StatusChip kind={r[3]}>{r[3]}</StatusChip>
              </Row>
            ))}
          </Col>
        </div>
      </Col>
    </Col>
  </Screen>
);

const StatInline = ({n, label, foot, accent, bad}) => (
  <Col style={{flex:1, gap:0}}>
    <Row style={{gap:6, alignItems:'baseline'}}>
      <div className="wf-hand" style={{fontSize:22, fontWeight:600, lineHeight:1, color: bad? '#8a2a1a' : (accent? WF.accent : WF.ink)}}>{n}</div>
      <div className="wf-label" style={{fontSize:13}}>{label}</div>
    </Row>
    <div className="wf-tiny" style={{marginTop:2}}>{foot}</div>
  </Col>
);

const DemoStep = ({n,label,sub,accent}) => (
  <Col style={{alignItems:'center', gap:2, minWidth:94}}>
    <div className="wf-box" style={{width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:99, background: accent? WF.accent:WF.paper, color: accent?'white':WF.ink, fontFamily:WF.hand, fontSize:15, fontWeight:600, borderColor: accent? WF.ink : WF.line}}>{n}</div>
    <div className="wf-mono" style={{fontSize:11}}>{label}</div>
    <div className="wf-tiny">{sub}</div>
  </Col>
);

const MiniTile = ({big, label, foot, accent, bad}) => (
  <div className="wf-box" style={{padding:'10px 12px', borderColor: accent? WF.accent : WF.line, background: accent? WF.accentSoft : WF.paper}}>
    <Row style={{alignItems:'baseline', gap:8}}>
      <div className="wf-hand" style={{fontSize:32, fontWeight:600, color: bad? '#8a2a1a' : WF.ink, lineHeight:1}}>{big}</div>
      <div className="wf-label">{label}</div>
    </Row>
    <div className="wf-tiny" style={{marginTop:2}}>{foot}</div>
  </div>
);

// ── V3: Narrative — vertical "journey" layout (good for demos, screenshots)
const DashV3 = () => (
  <Screen nav="dashboard" title="Today's traffic" subtitle="Walk the integration from left to right">
    <div className="wf-box" style={{padding:'20px 26px', height:'100%', overflow:'hidden'}}>
      <Row style={{justifyContent:'space-between', marginBottom:18}}>
        <div className="wf-h2">A message's journey</div>
        <Row style={{gap:8}}>
          <button className="wf-btn"><Ico name="bolt" size={12}/> Fire sample</button>
          <button className="wf-btn wf-btn-accent"><Ico name="play" size={11} color="white"/> Run full scenario</button>
        </Row>
      </Row>

      {/* Horizontal journey w/ lane markers */}
      <div style={{position:'relative', padding:'20px 0'}}>
        <div style={{position:'absolute', top:76, left:0, right:0, height:2, background:WF.accent, opacity:.35}}/>
        <Row style={{justifyContent:'space-between', gap:8, position:'relative'}}>
          {[
            {t:'ACME_LAB', s:'hospital sender', n:'142', tag:'sent'},
            {t:'MLLP :2575', s:'accepted on port', n:'142', tag:'bytes in'},
            {t:'Inbound Queue', s:'polled every 5s', n:'142', tag:'stored'},
            {t:'Convert', s:'HL7v2 → FHIR', n:'137', tag:'converted', active:true},
            {t:'Aidbox', s:'FHIR resources', n:'137', tag:'persisted'},
            {t:'BAR Builder', s:'accounts updated', n:'42', tag:'accounts'},
            {t:'Outgoing Queue', s:'BAR ready', n:'5', tag:'queued'},
            {t:'Receiver', s:'downstream EHR', n:'37', tag:'delivered'},
          ].map((step,i) => (
            <Col key={i} style={{alignItems:'center', gap:6, flex:1}}>
              <div className="wf-hand" style={{fontSize:22, fontWeight:600, color:WF.ink}}>{step.n}</div>
              <div className="wf-tiny" style={{color:WF.ink3}}>{step.tag}</div>
              <div className="wf-box" style={{width:20, height:20, borderRadius:99, background: step.active? WF.accent : WF.paper, borderColor: step.active? WF.ink : WF.line}}/>
              <div className="wf-hand" style={{fontSize:14, fontWeight:600, textAlign:'center'}}>{step.t}</div>
              <div className="wf-tiny" style={{textAlign:'center'}}>{step.s}</div>
            </Col>
          ))}
        </Row>
      </div>

      <div className="wf-divider" style={{margin:'10px 0 16px'}}/>

      <Row style={{gap:18, alignItems:'stretch'}}>
        {/* Callouts */}
        <Col style={{flex:1, gap:10}}>
          <div className="wf-h3">What's flowing right now</div>
          <Col style={{gap:6}}>
            {[
              ['ORU^R01','Lab result · Na, K, Cl','2s ago'],
              ['ADT^A01','Admit · P12345','21s ago'],
              ['ORU^R01','Lab result · needs mapping','32s ago'],
              ['VXU^V04','Immunization · flu','58s ago'],
            ].map((r,i) => (
              <Row key={i} style={{padding:'6px 10px', border:`1px dashed ${WF.lineLight}`, borderRadius:6, gap:10}}>
                <span className="wf-mono" style={{width:80, fontSize:12}}>{r[0]}</span>
                <span className="wf-body" style={{flex:1}}>{r[1]}</span>
                <span className="wf-tiny">{r[2]}</span>
              </Row>
            ))}
          </Col>
        </Col>
        <div className="wf-vdivider" style={{alignSelf:'stretch'}}/>
        <Col style={{flex:1, gap:10}}>
          <div className="wf-h3">Needs your attention</div>
          <div className="wf-box wf-accent-bg" style={{padding:'10px 12px', borderColor:WF.accent}}>
            <Row style={{justifyContent:'space-between'}}>
              <div className="wf-h3"><span className="wf-accent-ink">3</span> unmapped codes</div>
              <span className="wf-chip wf-chip-accent">triage →</span>
            </Row>
            <div className="wf-note" style={{marginTop:4}}>UNKNOWN_TEST · ACME_LAB / Observation.code · first seen 2 min ago</div>
          </div>
          <div className="wf-box" style={{padding:'10px 12px'}}>
            <Row style={{justifyContent:'space-between'}}>
              <div className="wf-h3">2 conversion errors</div>
              <span className="wf-chip">view →</span>
            </Row>
            <div className="wf-note" style={{marginTop:4}}>BAR_P01 · invalid coverage segment</div>
          </div>
        </Col>
      </Row>
    </div>
  </Screen>
);

Object.assign(window, { DashV1, DashV2, DashV3 });
