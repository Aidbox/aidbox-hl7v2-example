// Unmapped Codes — 2 variants, warm-paper palette

// Variant A: Triage inbox — queue + editor
const UnmappedA = () => {
  const [sel, setSel] = React.useState(0);

  const codes = [
    {code:'UNKNOWN_TEST', sender:'ACME_LAB', field:'OBX-3', type:'Observation.code', count:12, firstSeen:'14:21:51', display:'Unknown Lab Test', unit:'mg/dL',
     suggestions:[
       {code:'LP6994-0', display:'Unknown', score:92, system:'LOINC'},
       {code:'2345-7',   display:'Glucose [Mass/volume] in Serum or Plasma', score:64, system:'LOINC'},
       {code:'15074-8',  display:'Glucose [Moles/volume] in Blood', score:58, system:'LOINC'},
     ]},
    {code:'DC-HOME-HEALTH', sender:'St.Marys Hospital', field:'PV1-36', type:'Encounter.dischargeDisposition', count:4, firstSeen:'13:48:02', display:'Discharge to home health', suggestions:[]},
    {code:'STAT-AMB', sender:'billing', field:'ACC-6', type:'Account.status', count:1, firstSeen:'12:04:17', display:'Ambulatory stat', suggestions:[]},
  ];

  const active = codes[sel];

  return (
    <div className="page" style={{gap:18}}>
      <div style={{display:'flex', alignItems:'flex-end', gap:16}}>
        <div style={{flex:1}}>
          <div className="eyebrow" style={{marginBottom:6}}>Triage · 3 codes holding 17 messages</div>
          <h1 className="h1">Unmapped codes</h1>
          <div className="sub">Map once, the backlog replays automatically. <em style={{fontFamily:'var(--serif)', fontStyle:'italic'}}>No lost messages, no manual fixups.</em></div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn btn-ghost">Skip all</button>
          <button className="btn"><Icon name="sparkle" className="i i-sm"/> Suggest with AI</button>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'300px 1fr', gap:16, alignItems:'start'}}>
        {/* Queue */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Queue</span>
            <span className="card-sub">{codes.length} codes</span>
          </div>
          {codes.map((c,i) => (
            <div key={i} onClick={()=>setSel(i)} style={{padding:'14px 16px', borderTop: i===0?'none':'1px solid var(--line)', cursor:'pointer', background: i===sel?'var(--paper-2)':'transparent', borderLeft: i===sel?'2px solid var(--accent)':'2px solid transparent'}}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                <span className="mono" style={{fontSize:12.5, fontWeight:600, color: i===sel?'var(--accent-ink)':'var(--ink)'}}>{c.code}</span>
                <span style={{marginLeft:'auto', fontSize:11, color:'var(--ink-3)', fontFamily:'var(--mono)'}}>{c.count} msg</span>
              </div>
              <div style={{fontSize:11.5, color:'var(--ink-3)'}}>{c.sender} · {c.field}</div>
            </div>
          ))}
        </div>

        {/* Editor */}
        <div className="card">
          <div style={{padding:'22px 26px', borderBottom:'1px solid var(--line)'}}>
            <div className="eyebrow" style={{marginBottom:10}}>
              Incoming code · {active.sender} · {active.field} · first seen {active.firstSeen}
            </div>
            <div style={{display:'flex', alignItems:'center', gap:16}}>
              <div style={{flex:1}}>
                <div className="mono" style={{fontSize:30, fontWeight:600, letterSpacing:'-0.01em', color:'var(--accent-ink)'}}>{active.code}</div>
                <div style={{fontSize:14, color:'var(--ink-2)', marginTop:4, fontFamily:'var(--serif)', fontStyle:'italic'}}>"{active.display}"</div>
              </div>
              <div style={{textAlign:'right', paddingLeft:20, borderLeft:'1px solid var(--line)'}}>
                <div style={{fontFamily:'var(--serif)', fontSize:30, fontWeight:500, color:'var(--ink)', letterSpacing:'-0.02em'}}>{active.count}</div>
                <div className="eyebrow" style={{marginTop:-2}}>messages waiting</div>
              </div>
            </div>

            <div style={{marginTop:18, padding:'10px 14px', background:'var(--paper-2)', borderRadius:6, border:'1px solid var(--line)', fontFamily:'var(--mono)', fontSize:11.5, color:'var(--ink-2)', lineHeight:1.7, overflowX:'auto'}}>
              <span style={{color:'var(--ink-3)'}}>OBX|1|NM|</span>
              <span style={{color:'var(--warn)', background:'var(--warn-soft)', padding:'1px 3px', borderRadius:3, fontWeight:600}}>{active.code}^{active.display}^LOCAL</span>
              <span style={{color:'var(--ink-3)'}}>||123|{active.unit || 'units'}|70-200|||F</span>
              <div style={{fontSize:10.5, color:'var(--ink-3)', marginTop:6, fontFamily:'var(--sans)'}}>example from MSG1776853125726 · 4 minutes ago</div>
            </div>
          </div>

          <div style={{padding:'20px 26px'}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:14}}>
              <Icon name="sparkle" className="i i-sm" />
              <span style={{fontSize:12, fontWeight:500, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--accent-ink)'}}>Suggested LOINC matches</span>
              <span style={{fontSize:11.5, color:'var(--ink-3)'}}>based on display text + 218 existing mappings</span>
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {(active.suggestions || []).map((s,i) => (
                <div key={i} style={{display:'grid', gridTemplateColumns:'24px 110px 1fr 80px 120px', gap:14, padding:'12px 14px', background: i===0?'var(--accent-soft)':'var(--paper-2)', border: i===0?'1px solid var(--accent)':'1px solid var(--line)', borderRadius:7, alignItems:'center'}}>
                  <div style={{width:20, height:20, borderRadius:'50%', border: i===0?'2px solid var(--accent)':'1.5px solid var(--ink-3)', display:'grid', placeItems:'center'}}>
                    {i===0 && <div style={{width:10, height:10, borderRadius:'50%', background:'var(--accent)'}}/>}
                  </div>
                  <span className="mono" style={{fontSize:12.5, fontWeight:600, color:'var(--accent-ink)'}}>{s.code}</span>
                  <span style={{fontSize:13, color:'var(--ink)'}}>{s.display}</span>
                  <span className="chip" style={{fontSize:10.5, justifySelf:'start'}}>{s.system}</span>
                  <div style={{display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end'}}>
                    <div style={{width:60, height:3, background:'var(--line)', borderRadius:2, overflow:'hidden'}}>
                      <div style={{width: s.score+'%', height:'100%', background: s.score>80?'var(--accent)': s.score>60?'var(--warn)':'var(--ink-3)'}}/>
                    </div>
                    <span className="mono" style={{fontSize:11.5, color:'var(--ink-2)', minWidth:28, textAlign:'right'}}>{s.score}%</span>
                  </div>
                </div>
              ))}
              {(!active.suggestions || active.suggestions.length===0) && (
                <div style={{padding:'20px', background:'var(--paper-2)', border:'1px dashed var(--line)', borderRadius:7, textAlign:'center', color:'var(--ink-3)', fontSize:13}}>
                  No strong suggestions — search below to pick a code manually.
                </div>
              )}

              <div style={{padding:'12px 14px', background:'var(--paper-2)', border:'1px dashed var(--line)', borderRadius:7, display:'flex', alignItems:'center', gap:12}}>
                <div style={{width:20, height:20, borderRadius:'50%', border:'1.5px solid var(--ink-3)'}}/>
                <Icon name="search" className="i i-sm" />
                <input placeholder="Search LOINC, SNOMED, or browse all…" style={{flex:1, background:'transparent', border:'none', outline:'none', color:'var(--ink)', fontSize:13, fontFamily:'inherit'}}/>
              </div>
            </div>
          </div>

          <div style={{padding:'16px 26px', borderTop:'1px solid var(--line)', display:'flex', alignItems:'center', gap:12, background:'var(--paper-2)', borderBottomLeftRadius:8, borderBottomRightRadius:8}}>
            <div style={{flex:1, fontSize:12, color:'var(--ink-3)'}}>Saving replays {active.count} queued messages and applies to future {active.sender} traffic.</div>
            <button className="btn btn-ghost">Skip</button>
            <button className="btn btn-primary"><Icon name="check" className="i i-sm"/> Save mapping</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Variant B: Bulk table
const UnmappedB = () => (
  <div className="page" style={{gap:18}}>
    <div style={{display:'flex', alignItems:'flex-end', gap:16}}>
      <div style={{flex:1}}>
        <h1 className="h1">Unmapped codes</h1>
        <div className="sub">3 codes · 17 messages waiting · <span style={{fontFamily:'var(--serif)', fontStyle:'italic', color:'var(--accent-ink)'}}>maps are write-once, replay is automatic.</span></div>
      </div>
      <div style={{display:'flex', gap:8}}>
        <button className="btn btn-ghost">Export CSV</button>
        <button className="btn btn-primary"><Icon name="sparkle" className="i i-sm"/> Auto-map all (3)</button>
      </div>
    </div>

    <div className="card">
      <div className="card-head">
        <span className="card-title">Waiting for a decision</span>
        <span className="card-sub">sorted by impact</span>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'180px 140px 180px 1fr 90px 180px 140px', gap:14, padding:'10px 20px', borderBottom:'1px solid var(--line)', fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--ink-3)', fontWeight:500, background:'var(--paper-2)'}}>
        <span>Code</span>
        <span>Sender</span>
        <span>Field · type</span>
        <span>Display</span>
        <span style={{textAlign:'right'}}>Msgs</span>
        <span>Top suggestion</span>
        <span style={{textAlign:'right'}}>Action</span>
      </div>
      {[
        {code:'UNKNOWN_TEST', sender:'ACME_LAB', field:'OBX-3', type:'Observation.code', display:'Unknown Lab Test', count:12,
         sugg:{code:'LP6994-0', display:'Unknown', score:92, system:'LOINC'}},
        {code:'DC-HOME-HEALTH', sender:'St.Marys', field:'PV1-36', type:'Encounter.dispo', display:'Discharge to home health', count:4,
         sugg:{code:'306689006', display:'Discharge to home health', score:88, system:'SNOMED'}},
        {code:'STAT-AMB', sender:'billing', field:'ACC-6', type:'Account.status', display:'Ambulatory stat', count:1,
         sugg:{code:'active', display:'Active', score:71, system:'FHIR'}},
      ].map((r,i) => (
        <div key={i} style={{display:'grid', gridTemplateColumns:'180px 140px 180px 1fr 90px 180px 140px', gap:14, padding:'14px 20px', borderTop:'1px solid var(--line)', alignItems:'center', fontSize:12.5}}>
          <span className="mono" style={{fontSize:12.5, fontWeight:600, color:'var(--accent-ink)'}}>{r.code}</span>
          <span style={{color:'var(--ink)'}}>{r.sender}</span>
          <div>
            <div className="mono" style={{fontSize:11.5, color:'var(--ink-2)'}}>{r.field}</div>
            <div style={{fontSize:10.5, color:'var(--ink-3)', marginTop:1}}>{r.type}</div>
          </div>
          <span style={{color:'var(--ink-2)'}}>{r.display}</span>
          <span className="mono" style={{fontSize:14, fontWeight:600, color: r.count>5?'var(--warn)':'var(--ink)', textAlign:'right', fontFamily:'var(--serif)'}}>{r.count}</span>
          <div>
            <div className="mono" style={{fontSize:11.5, fontWeight:600, color:'var(--accent-ink)'}}>{r.sugg.code}</div>
            <div style={{display:'flex', alignItems:'center', gap:6, marginTop:3}}>
              <div style={{flex:1, height:3, background:'var(--line)', borderRadius:2, overflow:'hidden', maxWidth:80}}>
                <div style={{width: r.sugg.score+'%', height:'100%', background:'var(--accent)'}}/>
              </div>
              <span style={{fontSize:10.5, color:'var(--ink-3)', fontFamily:'var(--mono)'}}>{r.sugg.score}%</span>
            </div>
          </div>
          <div style={{display:'flex', gap:6, justifyContent:'flex-end'}}>
            <button className="btn btn-ghost" style={{padding:'4px 8px', fontSize:11.5}}>Edit</button>
            <button className="btn btn-primary" style={{padding:'4px 10px', fontSize:11.5}}>Accept</button>
          </div>
        </div>
      ))}
    </div>

    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
      <div className="card card-pad">
        <div className="eyebrow" style={{marginBottom:10}}>Last 7 days</div>
        <div style={{display:'flex', alignItems:'baseline', gap:10, marginBottom:12}}>
          <div style={{fontFamily:'var(--serif)', fontSize:28, fontWeight:500, letterSpacing:'-0.02em'}}>142</div>
          <div style={{fontSize:13, color:'var(--ink-2)'}}>codes mapped · 3.8k messages replayed</div>
        </div>
        <div style={{display:'flex', gap:3, alignItems:'flex-end', height:40}}>
          {[18,22,14,28,32,16,12].map((h,i) => (
            <div key={i} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
              <div style={{width:'100%', height: h, background:'var(--accent)', opacity:.65, borderRadius:2}}/>
              <span style={{fontSize:10, color:'var(--ink-3)'}}>{['M','T','W','T','F','S','S'][i]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card card-pad" style={{background:'var(--paper-2)', borderStyle:'dashed'}}>
        <div style={{fontFamily:'var(--serif)', fontStyle:'italic', fontSize:16, lineHeight:1.5, color:'var(--ink-2)', marginBottom:12}}>
          "Every unmapped code is a hallway conversation the integration team never had time for. We turned the hallway into a queue."
        </div>
        <div className="eyebrow">Why we built this</div>
      </div>
    </div>
  </div>
);

Object.assign(window, { UnmappedA, UnmappedB });
