// Dashboard — 2 variants. Calm, warm-paper palette. Follows wireframe layouts.

// Small primitives used across the page
const Stat = ({label, value, delta, tone, last}) => (
  <div style={{padding:'16px 20px', borderRight: last?'none':'1px solid var(--line)', display:'flex', flexDirection:'column', gap:6, minWidth:150, whiteSpace:'nowrap'}}>
    <div className="eyebrow">{label}</div>
    <div style={{display:'flex', alignItems:'baseline', gap:8}}>
      <div style={{fontFamily:'var(--serif)', fontSize:26, fontWeight:500, letterSpacing:'-0.02em', color: tone==='warn'?'var(--warn)': tone==='err'?'var(--err)':'var(--ink)'}}>{value}</div>
      {delta && <div style={{fontSize:11.5, color:'var(--ink-3)', fontFamily:'var(--mono)'}}>{delta}</div>}
    </div>
  </div>
);

const Spark = ({highlight}) => {
  const pts = [4,6,5,8,7,10,9,12,11,14,13,16,19,17,22,18,15,20,24,21,26,23,28,25];
  const max = Math.max(...pts);
  const w = 560, h = 90;
  const step = w / (pts.length-1);
  const path = pts.map((p,i)=>`${i===0?'M':'L'} ${(i*step).toFixed(1)} ${(h - (p/max)*h*0.8 - 8).toFixed(1)}`).join(' ');
  const area = path + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{display:'block'}}>
      <defs>
        <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C6532A" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#C6532A" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ga)"/>
      <path d={path} fill="none" stroke="#C6532A" strokeWidth="1.4"/>
      {highlight && pts.map((p,i) => i===pts.length-3 && (
        <circle key={i} cx={i*step} cy={h - (p/max)*h*0.8 - 8} r="3" fill="#C6532A" stroke="#FFFFFF" strokeWidth="1.5"/>
      ))}
    </svg>
  );
};

// Pipeline step (hero flow diagram)
const PipeStep = ({label, sub, count, active}) => (
  <div style={{flex:'1 1 0', minWidth:0, padding:'12px 10px', background: active?'var(--accent-soft)':'var(--surface)', border:'1px solid ' + (active?'var(--accent)':'var(--line)'), borderRadius:7, textAlign:'center', position:'relative'}}>
    <div style={{fontFamily:'var(--serif)', fontSize:20, fontWeight:500, letterSpacing:'-0.02em', color: active?'var(--accent-ink)':'var(--ink)'}}>{count}</div>
    <div style={{fontSize:12.5, color:'var(--ink)', fontWeight:500, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{label}</div>
    <div style={{fontSize:10.5, color:'var(--ink-3)', marginTop:1, fontFamily:'var(--mono)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{sub}</div>
  </div>
);
const Arrow = () => (
  <svg width="22" height="12" style={{flexShrink:0, color:'var(--ink-3)', opacity:.6}}>
    <path d="M1 6 L20 6 M15 2 L20 6 L15 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TickerRow = ({time, type, note, status, first}) => (
  <div style={{display:'grid', gridTemplateColumns:'80px 96px minmax(180px, 1fr) 130px', gap:12, alignItems:'center', padding:'10px 20px', borderTop: first?'none':'1px solid var(--line)', fontSize:13}}>
    <span className="mono" style={{color:'var(--ink-3)', fontSize:11.5}}>{time}</span>
    <span className="chip" style={{fontSize:10.5, justifySelf:'start'}}>{type}</span>
    <span style={{color:'var(--ink-2)', minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{note}</span>
    <span style={{justifySelf:'end'}}>
      {status==='ok'   && <span className="chip chip-ok">processed</span>}
      {status==='warn' && <span className="chip chip-warn">needs mapping</span>}
      {status==='err'  && <span className="chip chip-err">error</span>}
      {status==='pend' && <span className="chip">pending</span>}
    </span>
  </div>
);

// ── Variant A: Overview — "A message's journey" hero + stats + ticker
const DashboardA = () => (
  <div className="page">
    <div style={{display:'flex', alignItems:'flex-end', gap:16}}>
      <div style={{flex:1}}>
        <div className="eyebrow" style={{marginBottom:6}}>Staging · last refresh 2s ago</div>
        <h1 className="h1">Good morning, Kyrylo.</h1>
        <div className="sub">Everything's flowing. 3 codes are waiting on a decision before tomorrow's replay.</div>
      </div>
      <div style={{display:'flex', gap:8}}>
        <button className="btn"><Icon name="clock" className="i i-sm"/> Last 24h</button>
        <button className="btn btn-primary"><Icon name="play" className="i i-sm"/> Run demo scenario</button>
      </div>
    </div>

    {/* Pipeline hero */}
    <div className="card" style={{padding:'22px 24px'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:16}}>
        <span className="h2">A message's journey</span>
        <span style={{fontSize:12, color:'var(--ink-3)', fontFamily:'var(--serif)', fontStyle:'italic'}}>— from sender to FHIR, today</span>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <PipeStep count="142" label="Received" sub="ACME_LAB · 4 senders"/>
        <Arrow/>
        <PipeStep count="142" label="MLLP" sub="port 2575"/>
        <Arrow/>
        <PipeStep count="140" label="Parsed" sub="HL7v2 segments"/>
        <Arrow/>
        <PipeStep count="137" label="Converted" sub="HL7v2 → FHIR" active/>
        <Arrow/>
        <PipeStep count="137" label="Aidbox" sub="FHIR store"/>
      </div>
      <div style={{marginTop:14, display:'flex', gap:14, alignItems:'center', fontSize:12, color:'var(--ink-3)'}}>
        <span><span className="dot ok" style={{marginRight:6, verticalAlign:'middle'}}/>workers healthy</span>
        <span style={{opacity:.4}}>·</span>
        <span>3 messages routed to triage</span>
        <span style={{opacity:.4}}>·</span>
        <span>2 conversion errors — see below</span>
      </div>
    </div>

    {/* Stats strip */}
    <div className="card clean-scroll" style={{display:'flex', alignItems:'stretch', overflowX:'auto'}}>
      <Stat label="Received · 24h" value="142" delta="+8 last min"/>
      <Stat label="Acknowledged" value="99.4%" delta="2 errors"/>
      <Stat label="Needs mapping" value="3" delta="from ACME_LAB" tone="warn"/>
      <Stat label="Avg latency" value="42ms" delta="p99 · 118ms"/>
      <Stat label="Workers" value="3 / 3" last/>
      <div style={{flex:1, minWidth:220, padding:'8px 16px', display:'flex', alignItems:'center'}}>
        <Spark highlight/>
      </div>
    </div>

    <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) 320px', gap:20, alignItems:'start'}}>
      {/* Live ticker */}
      <div className="card">
        <div className="card-head">
          <span className="dot ok" style={{boxShadow:'0 0 0 3px rgba(63, 138, 92, 0.15)'}}/>
          <span className="card-title">Live ticker</span>
          <span className="card-sub">auto-refresh · 5s</span>
          <button className="btn btn-ghost" style={{marginLeft:10, padding:'4px 10px', fontSize:12}}><Icon name="filter" className="i i-sm"/> filter</button>
        </div>
        {[
          ['14:19:46','ORU^R01','ACME_LAB → unknown LOINC — routed to triage','warn'],
          ['14:19:44','ORU^R01','ACME_LAB → processed (3 observations)','ok'],
          ['14:19:40','VXU^V04','CHILDRENS → immunization CVX 88','ok'],
          ['14:19:38','ADT^A01','St.Marys → admit · patient P12345','ok'],
          ['14:19:34','ADT^A08','St.Marys → demographics updated','ok'],
          ['14:19:28','ORM^O01','ACME_LAB → order filled','ok'],
          ['14:19:22','BAR^P01','billing → conversion error','err'],
          ['14:19:18','ORU^R01','ACME_LAB → potassium 4.2 mmol/L','ok'],
          ['14:19:12','ADT^A03','St.Marys → discharge · encounter closed','ok'],
        ].map((r,i) => <TickerRow key={i} first={i===0} time={r[0]} type={r[1]} note={r[2]} status={r[3]}/>)}
      </div>

      {/* Right rail */}
      <div style={{display:'flex', flexDirection:'column', gap:16}}>
        <div className="card" style={{borderColor:'var(--accent)', background:'var(--accent-soft)'}}>
          <div style={{padding:'18px 20px'}}>
            <div className="eyebrow" style={{color:'var(--accent-ink)', marginBottom:8}}>Needs a decision</div>
            <div style={{fontFamily:'var(--serif)', fontSize:22, fontWeight:500, letterSpacing:'-0.02em', lineHeight:1.2, marginBottom:6, color:'var(--ink)'}}>3 codes are holding 17 messages.</div>
            <div style={{fontSize:12.5, color:'var(--ink-2)', marginBottom:14, lineHeight:1.45}}>Map them once, the backlog replays automatically.</div>
            <div style={{display:'flex', flexDirection:'column', gap:5, marginBottom:14}}>
              {[
                ['UNKNOWN_TEST', 'ACME_LAB · OBX-3', 12],
                ['DC-HOME-HEALTH', 'St.Marys · PV1-36', 4],
                ['STAT-AMB', 'billing · ACC-6', 1],
              ].map((r,i) => (
                <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'6px 0'}}>
                  <span className="mono" style={{fontSize:12, fontWeight:600, color:'var(--accent-ink)'}}>{r[0]}</span>
                  <span style={{fontSize:11.5, color:'var(--ink-3)', fontFamily:'var(--mono)'}}>{r[1]}</span>
                  <span style={{marginLeft:'auto', fontSize:11.5, color:'var(--ink-2)'}}>{r[2]} msg</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{width:'100%', justifyContent:'center'}}>Open triage <Icon name="arrow-right" className="i i-sm"/></button>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><span className="card-title">Active senders</span><span className="card-sub">24h</span></div>
          {[
            ['ACME_LAB', '84', 100, 'ok'],
            ['St.Marys Hospital', '32', 38, 'ok'],
            ['CHILDRENS', '18', 22, 'ok'],
            ['billing', '8', 10, 'warn'],
          ].map((s,i) => (
            <div key={i} style={{padding:'10px 20px', borderTop:'1px solid var(--line)', display:'flex', alignItems:'center', gap:10}}>
              <span className={'dot ' + s[3]}/>
              <span style={{fontSize:13, color:'var(--ink)', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s[0]}</span>
              <span className="mono" style={{color:'var(--ink-3)', fontSize:11.5}}>{s[1]}</span>
              <div style={{width:50, height:3, background:'var(--line)', borderRadius:2, overflow:'hidden'}}>
                <div style={{width: s[2]+'%', height:'100%', background:'var(--accent)', opacity:.7}}/>
              </div>
            </div>
          ))}
        </div>

        <div style={{padding:'4px 4px'}}>
          <div style={{fontFamily:'var(--serif)', fontStyle:'italic', fontSize:15, lineHeight:1.5, color:'var(--ink-2)'}}>
            "HL7v2 isn't broken — it's just lived-in. We built this for the team cleaning up after it."
          </div>
          <div className="eyebrow" style={{marginTop:10}}>Product principles · 01</div>
        </div>
      </div>
    </div>
  </div>
);

// ── Variant B: Demo conductor — wireframe V2 layout, hi-fi
const DemoStep = ({n, label, sub, accent}) => (
  <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:6, minWidth:100}}>
    <div style={{width:34, height:34, borderRadius:'50%', display:'grid', placeItems:'center', background: accent?'var(--accent)':'var(--surface)', color: accent?'#fff':'var(--ink)', border: '1px solid ' + (accent?'var(--accent)':'var(--line-2)'), fontFamily:'var(--serif)', fontSize:15, fontWeight:500}}>{n}</div>
    <div className="mono" style={{fontSize:11.5, color:'var(--ink)'}}>{label}</div>
    <div style={{fontSize:10.5, color:'var(--ink-3)', textAlign:'center'}}>{sub}</div>
  </div>
);

const DashboardB = () => (
  <div className="page">
    <div>
      <div className="eyebrow" style={{marginBottom:6}}>Staging · scripted demo</div>
      <h1 className="h1">Demo control</h1>
      <div className="sub">One click runs a full HL7v2 scenario end-to-end — so any prospect sees the whole story in under a minute.</div>
    </div>

    {/* Hero — demo conductor */}
    <div className="card" style={{padding:'26px 28px', background:'linear-gradient(180deg, var(--surface) 0%, var(--paper-2) 100%)'}}>
      <div style={{display:'flex', alignItems:'center', gap:28}}>
        <div style={{flex:1}}>
          <div style={{fontFamily:'var(--serif)', fontSize:26, fontWeight:500, letterSpacing:'-0.02em', marginBottom:4}}>Run scripted demo <em style={{fontStyle:'italic', color:'var(--accent)'}}>in 4 steps</em></div>
          <div style={{fontSize:12.5, color:'var(--ink-3)', marginBottom:20}}>2s spacing between sends · last run 4 minutes ago · all green</div>
          <div style={{display:'flex', alignItems:'center', gap:0}}>
            <DemoStep n="1" label="ADT^A01" sub="admit patient"/>
            <div style={{flex:'0 1 24px'}}><Arrow/></div>
            <DemoStep n="2" label="ORU^R01" sub="known LOINC"/>
            <div style={{flex:'0 1 24px'}}><Arrow/></div>
            <DemoStep n="3" label="VXU^V04" sub="immunization"/>
            <div style={{flex:'0 1 24px'}}><Arrow/></div>
            <DemoStep n="4" label="ORU (unknown)" sub="triggers triage" accent/>
          </div>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:8, alignItems:'stretch'}}>
          <button className="btn btn-primary" style={{fontSize:15, padding:'12px 22px', justifyContent:'center'}}><Icon name="play" className="i i-sm"/> Run demo now</button>
          <div style={{display:'flex', gap:6}}>
            <button className="btn btn-ghost" style={{padding:'4px 10px', fontSize:11.5, flex:1, justifyContent:'center'}}>Send single</button>
            <button className="btn btn-ghost" style={{padding:'4px 10px', fontSize:11.5, flex:1, justifyContent:'center'}}>Reset</button>
          </div>
        </div>
      </div>
    </div>

    {/* Stats + Live ticker */}
    <div className="card clean-scroll" style={{display:'flex', alignItems:'stretch', overflowX:'auto'}}>
      <Stat label="Received · today" value="142" delta="+8 this minute"/>
      <Stat label="Need mapping" value="3" delta="go to triage →" tone="warn"/>
      <Stat label="Errors" value="2" delta="1 parse · 1 conv" tone="err"/>
      <Stat label="Avg latency" value="42ms"/>
      <div style={{flex:1, minWidth:260, padding:'14px 18px', display:'flex', flexDirection:'column', gap:6, justifyContent:'center'}}>
        <div style={{display:'flex', gap:14, flexWrap:'wrap'}}>
          {[['ORU processor', true], ['BAR builder', true], ['BAR sender', true]].map(([n,on],i) => (
            <span key={i} style={{display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--ink-2)'}}>
              <span className={'dot ' + (on?'ok':'')}/> {n}
            </span>
          ))}
        </div>
        <div style={{fontSize:11, color:'var(--ink-3)'}}>workers · polling every 5s</div>
      </div>
    </div>

    <div className="card">
      <div className="card-head">
        <span className="dot accent" style={{boxShadow:'0 0 0 3px rgba(198, 83, 42, 0.15)'}}/>
        <span className="card-title">Live ticker</span>
        <span className="card-sub">auto-refresh · 5s — pause</span>
      </div>
      {[
        ['14:19:46','ORU^R01','ACME_LAB → unknown LOINC — routed to triage','warn'],
        ['14:19:44','ORU^R01','ACME_LAB → processed (3 observations)','ok'],
        ['14:19:40','VXU^V04','CHILDRENS → immunization CVX 88','ok'],
        ['14:19:38','ADT^A01','St.Marys → admit · patient P12345','ok'],
        ['14:19:36','—','polling services started','pend'],
        ['14:19:34','ADT^A08','St.Marys → demographics updated','ok'],
        ['14:19:22','BAR^P01','billing → conversion error','err'],
      ].map((r,i) => <TickerRow key={i} first={i===0} time={r[0]} type={r[1]} note={r[2]} status={r[3]}/>)}
    </div>
  </div>
);

Object.assign(window, { DashboardA, DashboardB });
