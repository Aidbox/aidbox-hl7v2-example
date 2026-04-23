// Inbound Messages — 2 variants, warm-paper palette

const MessageRow = ({time, type, sender, note, status, selected, onClick, first}) => (
  <div onClick={onClick} style={{display:'grid', gridTemplateColumns:'14px 80px 96px 180px 1fr 110px', gap:12, alignItems:'center', padding:'11px 20px', borderTop: first?'none':'1px solid var(--line)', cursor:'pointer', background: selected?'var(--paper-2)':'transparent', borderLeft: selected? '2px solid var(--accent)':'2px solid transparent'}}>
    <span className={'dot ' + (status==='ok'?'ok':status==='warn'?'warn':'err')}/>
    <span className="mono" style={{color:'var(--ink-3)', fontSize:11.5, whiteSpace:'nowrap'}}>{time}</span>
    <span className="chip" style={{fontSize:10.5, justifySelf:'start'}}>{type}</span>
    <span style={{fontSize:12.5, color:'var(--ink-2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{sender}</span>
    <span style={{fontSize:13, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0}}>{note}</span>
    <span style={{justifySelf:'end'}}>
      {status==='ok'   && <span className="chip chip-ok">processed</span>}
      {status==='warn' && <span className="chip chip-warn">needs mapping</span>}
      {status==='err'  && <span className="chip chip-err">error</span>}
    </span>
  </div>
);

// ── Variant A: List + detail pane (tabbed)
const InboundA = () => {
  const [sel, setSel] = React.useState(2);
  const [tab, setTab] = React.useState('structured');

  const rows = [
    ['14:21:58','ORU^R01','ACME_LAB','patient TEST-0041 · glucose 96 mg/dL','ok'],
    ['14:21:54','ADT^A08','St.Marys','demographics update · MRN 00088412','ok'],
    ['14:21:51','ORU^R01','ACME_LAB','UNKNOWN_TEST — no LOINC mapping','warn'],
    ['14:21:47','ADT^A01','CHILDRENS','admit · encounter created','ok'],
    ['14:21:44','BAR^P01','billing','account opened · $1,240.00','ok'],
    ['14:21:41','ORM^O01','ACME_LAB','order filled','ok'],
    ['14:21:38','ORU^R01','ACME_LAB','potassium 4.2 mmol/L','ok'],
    ['14:21:33','ADT^A03','St.Marys','discharge · encounter closed','ok'],
    ['14:21:28','VXU^V04','CHILDRENS','CVX 88 Influenza 2026','ok'],
    ['14:21:22','ORU^R01','—','MSH-3 lookup failed','err'],
  ];

  return (
    <div className="page" style={{gap:18}}>
      <div style={{display:'flex', alignItems:'flex-end', gap:16}}>
        <div style={{flex:1}}>
          <h1 className="h1">Inbound messages</h1>
          <div className="sub">142 received today · <span style={{color:'var(--warn)'}}>3 in triage</span> · <span style={{color:'var(--err)'}}>2 errors</span></div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn btn-ghost"><Icon name="filter" className="i i-sm"/> All types</button>
          <button className="btn btn-ghost"><Icon name="clock" className="i i-sm"/> Last hour</button>
          <button className="btn"><Icon name="search" className="i i-sm"/> Search</button>
        </div>
      </div>

      <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
        {[['All','142',true],['ORU^R01','84'],['ADT^A01','18'],['ADT^A08','14'],['ADT^A03','6'],['ORM^O01','8'],['BAR^P01','6'],['VXU^V04','6'],['errors','2','err']].map((t,i) => (
          <span key={i} className={'chip ' + (t[2]===true?'chip-accent':t[2]==='err'?'chip-err':'')} style={{fontSize:11.5, padding:'4px 9px', cursor:'pointer'}}>
            {t[0]} <span style={{opacity:.55, marginLeft:4}}>{t[1]}</span>
          </span>
        ))}
      </div>

      <div style={{display:'grid', gridTemplateColumns:'minmax(560px, 1fr) 1fr', gap:16, minHeight:620}}>
        {/* LEFT: list */}
        <div className="card" style={{display:'flex', flexDirection:'column', overflow:'hidden', alignSelf:'start'}}>
          <div className="card-head">
            <span className="card-title">All messages</span>
            <span className="card-sub">streaming · 14:21:58</span>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'14px 80px 96px 180px 1fr 110px', gap:12, padding:'9px 20px', borderBottom:'1px solid var(--line)', fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--ink-3)', fontWeight:500, background:'var(--paper-2)'}}>
            <span/>
            <span>time</span>
            <span>type</span>
            <span>sender</span>
            <span>message</span>
            <span style={{justifySelf:'end'}}>status</span>
          </div>
          {rows.map((r,i) => (
            <MessageRow key={i} first={i===0} time={r[0]} type={r[1]} sender={r[2]} note={r[3]} status={r[4]} selected={i===sel} onClick={()=>setSel(i)}/>
          ))}
        </div>

        {/* RIGHT: detail */}
        <div className="card" style={{display:'flex', flexDirection:'column', alignSelf:'start', overflow:'hidden'}}>
          <div style={{padding:'16px 20px', borderBottom:'1px solid var(--line)'}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap'}}>
              <span className="chip chip-warn">needs mapping</span>
              <span className="chip">ORU^R01</span>
              <span className="mono" style={{fontSize:11.5, color:'var(--ink-3)'}}>MSG1776853125726 · 14:21:51</span>
              <div style={{marginLeft:'auto', display:'flex', gap:6}}>
                <button className="btn btn-ghost" style={{padding:'4px 10px', fontSize:11.5}}>Replay</button>
                <button className="btn btn-primary" style={{padding:'4px 12px', fontSize:11.5}}>Map code</button>
              </div>
            </div>
            <div className="h2">ACME_LAB → ACME_HOSP</div>
            <div style={{fontSize:13, color:'var(--ink-2)', marginTop:4, lineHeight:1.5}}>OBX-3 code <span className="mono" style={{color:'var(--accent-ink)', fontWeight:600, background:'var(--accent-soft)', padding:'1px 5px', borderRadius:3}}>UNKNOWN_TEST</span> has no LOINC mapping — routed to triage.</div>

            <div style={{display:'flex', gap:2, marginTop:14, borderBottom:'1px solid var(--line)', marginLeft:-20, marginRight:-20, paddingLeft:20, paddingRight:20, marginBottom:-16}}>
              {[['structured','Structured'],['raw','Raw HL7'],['fhir','FHIR resources'],['acks','ACK history']].map(([k,l]) => (
                <button key={k} onClick={()=>setTab(k)} style={{padding:'10px 14px', background:'transparent', border:'none', color: tab===k?'var(--ink)':'var(--ink-3)', fontSize:12.5, fontWeight: tab===k?500:400, borderBottom: tab===k?'2px solid var(--accent)':'2px solid transparent', marginBottom:-1, cursor:'pointer'}}>{l}</button>
              ))}
            </div>
          </div>

          <div style={{padding:'16px 20px'}}>
            {tab==='structured' && (
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                {[
                  {seg:'MSH', desc:'Message header', fields:[['Sending app','ACME_LAB'],['Receiving','ACME_HOSP'],['Timestamp','20260422 14:21:51'],['Type','ORU^R01'],['Version','2.5.1']]},
                  {seg:'PID', desc:'Patient identification', fields:[['MRN','TEST-0041'],['Name','TESTPATIENT GAMMA'],['DOB','1990-12-25'],['Sex','M']]},
                  {seg:'OBR', desc:'Observation request', fields:[['Placer','ORD003'],['Filler','FIL003'],['Panel','CHEM7 · CHEMISTRY PANEL']]},
                  {seg:'OBX', desc:'Observation result', warn:'UNKNOWN_TEST has no LOINC mapping', fields:[['Type','NM'],['Code','UNKNOWN_TEST^Unknown Lab Test^LOCAL', true],['Value','123'],['Units','mg/dL'],['Ref range','70–200'],['Status','F']]},
                ].map((s,i) => (
                  <div key={i} style={{border:'1px solid var(--line)', borderRadius:6, overflow:'hidden', borderLeft: s.warn?'3px solid var(--warn)':'1px solid var(--line)'}}>
                    <div style={{padding:'8px 12px', background:'var(--paper-2)', display:'flex', alignItems:'center', gap:8}}>
                      <span className="mono" style={{color:'var(--accent-ink)', fontWeight:600, fontSize:12}}>{s.seg}</span>
                      <span style={{fontSize:12, color:'var(--ink-2)'}}>{s.desc}</span>
                      {s.warn && <span className="chip chip-warn" style={{fontSize:10.5, marginLeft:'auto'}}>{s.warn}</span>}
                    </div>
                    <div style={{display:'grid', gridTemplateColumns:'120px 1fr', rowGap:6, columnGap:12, padding:'10px 12px'}}>
                      {s.fields.map((f,fi) => (
                        <React.Fragment key={fi}>
                          <div style={{fontSize:11, color:'var(--ink-3)', letterSpacing:'0.02em'}}>{f[0]}</div>
                          <div className="mono" style={{fontSize:12, color: f[2]?'var(--warn)':'var(--ink)', fontWeight: f[2]?600:400}}>{f[1]}</div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab==='raw' && (
              <pre className="mono" style={{fontSize:12, lineHeight:1.7, margin:0, color:'var(--ink-2)', whiteSpace:'pre-wrap', background:'var(--paper-2)', padding:14, borderRadius:6, border:'1px solid var(--line)'}}>
<span style={{color:'var(--accent-ink)', fontWeight:600}}>MSH</span>|^~\&|ACME_LAB|ACME_HOSP|EMR|DEST|20260422142151|ORU^R01|MSG1776853125726|P|2.5.1{'\n'}
<span style={{color:'var(--accent-ink)', fontWeight:600}}>PID</span>|1||TEST-0041^^^HOSPITAL^MR||TESTPATIENT^GAMMA||19901225|M{'\n'}
<span style={{color:'var(--accent-ink)', fontWeight:600}}>PV1</span>|1|O|LAB||||||||||||||||||VN125726{'\n'}
<span style={{color:'var(--accent-ink)', fontWeight:600}}>ORC</span>|RE|ORD003|FIL003{'\n'}
<span style={{color:'var(--accent-ink)', fontWeight:600}}>OBR</span>|1|ORD003|FIL003|CHEM7^CHEMISTRY PANEL^LOCAL|||20260422142154{'\n'}
<span style={{color:'var(--accent-ink)', fontWeight:600}}>OBX</span>|1|NM|<span style={{background:'var(--warn-soft)', color:'var(--warn)', padding:'1px 3px', borderRadius:3, fontWeight:600}}>UNKNOWN_TEST^Unknown Lab Test^LOCAL</span>||123|mg/dL|70-200|||F|
              </pre>
            )}

            {tab==='fhir' && (
              <pre className="mono" style={{fontSize:11.5, lineHeight:1.7, margin:0, color:'var(--ink-2)', whiteSpace:'pre', background:'var(--paper-2)', padding:14, borderRadius:6, border:'1px solid var(--line)', overflow:'auto'}}>
{`{
  "resourceType": "Bundle",
  "type": "message",
  "entry": [
    { "resource": { "resourceType": "Patient",
        "identifier": [{ "value": "TEST-0041" }],
        "name": [{ "family": "TESTPATIENT", "given": ["GAMMA"] }],
        "gender": "male", "birthDate": "1990-12-25" }},
    { "resource": { "resourceType": "Observation",
        "status": "final",
        "code": {`}
        <span style={{background:'var(--warn-soft)', color:'var(--warn)'}}>{`
          "coding": [{ "system": "LOCAL", "code": "UNKNOWN_TEST" }]
          // ⚠ no LOINC mapping — add one to finalize`}</span>
        {`
        },
        "valueQuantity": { "value": 123, "unit": "mg/dL" }
    }}
  ]
}`}
              </pre>
            )}

            {tab==='acks' && (
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                {[
                  ['14:21:51.142', 'MLLP connect', 'localhost:2575', 'ok'],
                  ['14:21:51.188', 'Parsed', '6 segments · 34 fields', 'ok'],
                  ['14:21:51.212', 'Terminology', 'UNKNOWN_TEST · no LOINC', 'warn'],
                  ['14:21:51.218', 'Routed', '→ triage queue', 'warn'],
                  ['14:21:51.224', 'ACK sent', 'MSA|AE — held for mapping', 'warn'],
                ].map((r,i) => (
                  <div key={i} style={{display:'grid', gridTemplateColumns:'120px 110px 1fr', gap:12, fontSize:12, alignItems:'center'}}>
                    <span className="mono" style={{color:'var(--ink-3)'}}>{r[0]}</span>
                    <span className="chip" style={{fontSize:10.5}}>{r[1]}</span>
                    <span style={{color:'var(--ink-2)', display:'flex', alignItems:'center', gap:8}}><span className={'dot '+r[3]}/>{r[2]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Variant B: Grouped by sender (timeline feel)
const InboundB = () => (
  <div className="page" style={{gap:18}}>
    <div>
      <h1 className="h1">Inbound messages</h1>
      <div className="sub">Grouped by sender · live from MLLP listener</div>
    </div>

    <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
      {[['All','142',true],['ACME_LAB','84'],['St.Marys','32'],['CHILDRENS','18'],['billing','8']].map((s,i) => (
        <button key={i} className={'btn ' + (s[2]?'btn-primary':'btn-ghost')} style={{fontSize:12.5}}>{s[0]} <span style={{opacity:.6, marginLeft:4}}>{s[1]}</span></button>
      ))}
      <div style={{flex:1}}/>
      <button className="btn btn-ghost"><Icon name="clock" className="i i-sm"/> Last hour</button>
    </div>

    {[
      {sender:'ACME_LAB', sub:'Laboratory results · ORU^R01 · MLLP 10.4.2.11:2575', stats:['84 today', '100% ACK', 'p50 38ms'],
       messages:[
         {time:'14:21:58', type:'ORU^R01', subject:'TEST-0041', note:'glucose 96 mg/dL · 7 observations', status:'ok'},
         {time:'14:21:51', type:'ORU^R01', subject:'TEST-0039', note:'UNKNOWN_TEST code — routed to triage', status:'warn'},
         {time:'14:21:41', type:'ORM^O01', subject:'TEST-0038', note:'order filled · CHEM7 panel', status:'ok'},
         {time:'14:21:38', type:'ORU^R01', subject:'TEST-0037', note:'potassium 4.2 mmol/L · 3 observations', status:'ok'},
       ]},
      {sender:'St.Marys Hospital', sub:'Admissions · ADT family · MLLP 10.4.2.19:2575', stats:['32 today', '100% ACK', 'p50 44ms'],
       messages:[
         {time:'14:21:54', type:'ADT^A08', subject:'00088412', note:'demographics updated · phone changed', status:'ok'},
         {time:'14:21:33', type:'ADT^A03', subject:'00088401', note:'discharge · encounter closed', status:'ok'},
         {time:'14:21:18', type:'ADT^A08', subject:'00088392', note:'demographics updated', status:'ok'},
       ]},
      {sender:'CHILDRENS', sub:'Admits + immunizations · ADT + VXU', stats:['18 today', '100% ACK'],
       messages:[
         {time:'14:21:47', type:'ADT^A01', subject:'PED-0412', note:'admit · pediatrics ward', status:'ok'},
         {time:'14:21:28', type:'VXU^V04', subject:'PED-0401', note:'CVX 88 · Influenza 2026', status:'ok'},
       ]},
    ].map((g,gi) => (
      <div key={gi} className="card">
        <div className="card-head">
          <span className="dot ok" style={{boxShadow:'0 0 0 3px rgba(63, 138, 92, 0.15)'}}/>
          <span className="card-title" style={{fontFamily:'var(--serif)', fontSize:16, fontWeight:500}}>{g.sender}</span>
          <span style={{marginLeft:8, fontSize:12, color:'var(--ink-3)', fontFamily:'var(--mono)'}}>{g.sub}</span>
          <div style={{marginLeft:'auto', display:'flex', gap:14}}>
            {g.stats.map((s,i) => <span key={i} className="mono" style={{fontSize:11.5, color:'var(--ink-3)'}}>{s}</span>)}
          </div>
        </div>
        {g.messages.map((m,mi) => (
          <div key={mi} style={{display:'grid', gridTemplateColumns:'14px 90px 110px 140px 1fr 120px', gap:12, padding:'12px 20px', borderTop:'1px solid var(--line)', alignItems:'center'}}>
            <span className={'dot ' + m.status}/>
            <span className="mono" style={{color:'var(--ink-3)', fontSize:11.5}}>{m.time}</span>
            <span className="chip" style={{fontSize:10.5, justifySelf:'start'}}>{m.type}</span>
            <span className="mono" style={{fontSize:11.5, color:'var(--ink-2)'}}>{m.subject}</span>
            <span style={{fontSize:13, color:'var(--ink)'}}>{m.note}</span>
            <span style={{justifySelf:'end'}}>
              {m.status==='ok' && <span className="chip chip-ok">processed</span>}
              {m.status==='warn' && <span className="chip chip-warn">needs mapping</span>}
            </span>
          </div>
        ))}
      </div>
    ))}
  </div>
);

Object.assign(window, { InboundA, InboundB });
