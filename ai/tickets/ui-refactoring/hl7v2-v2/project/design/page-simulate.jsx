// Simulate Sender — raw HL7 composer, message-type driven

const { useState: useSimState } = React;

// Message types with a built-in sample payload each. The "ORU-unknown" entry is
// the triage-story variant; it reads naturally as "Lab result · unknown code"
// and makes the unmapped-codes demo obvious without a separate toggle.
const MESSAGE_TYPES = [
  {id:'ORU^R01',         label:'ORU^R01',   desc:'Lab result · maps cleanly', tone:'ok',   build:(sender) => [
    `MSH|^~\\&|${sender}|${sender}_FACILITY|ACME_HOSP|DEST|20260422142151||ORU^R01|MSG1776853125726|P|2.5.1`,
    `PID|1||TEST-0041^^^HOSPITAL^MR||TESTPATIENT^GAMMA||19901225|M`,
    `PV1|1|O|LAB||||||||||||||||||VN125726`,
    `ORC|RE|ORD003|FIL003`,
    `OBR|1|ORD003|FIL003|CHEM7^CHEMISTRY PANEL^LOCAL|||20260422142154`,
    `OBX|1|NM|2345-7^Glucose [Mass/volume]^LOINC||96|mg/dL|70-200|||F|`,
  ]},
  {id:'ORU^R01-unknown', label:'ORU^R01 · unknown code', desc:'Lab result · contains a code with no LOINC mapping', tone:'warn', build:(sender) => [
    `MSH|^~\\&|${sender}|${sender}_FACILITY|ACME_HOSP|DEST|20260422142151||ORU^R01|MSG1776853125726|P|2.5.1`,
    `PID|1||TEST-0041^^^HOSPITAL^MR||TESTPATIENT^GAMMA||19901225|M`,
    `PV1|1|O|LAB||||||||||||||||||VN125726`,
    `ORC|RE|ORD003|FIL003`,
    `OBR|1|ORD003|FIL003|CHEM7^CHEMISTRY PANEL^LOCAL|||20260422142154`,
    `OBX|1|NM|UNKNOWN_TEST^Unknown Lab Test^LOCAL||123|mg/dL|70-200|||F|`,
  ]},
  {id:'ADT^A01', label:'ADT^A01', desc:'Admit patient', tone:'ok', build:(sender) => [
    `MSH|^~\\&|${sender}|${sender}_FACILITY|ACME_HOSP|DEST|20260422142151||ADT^A01|MSG1776853125726|P|2.5.1`,
    `EVN|A01|20260422142151`,
    `PID|1||P12345^^^HOSPITAL^MR||DOE^JANE||19850707|F`,
    `PV1|1|I|ICU^1^A||||123456^SMITH^JOHN^^^DR|||CAR`,
  ]},
  {id:'ADT^A08', label:'ADT^A08', desc:'Update patient info', tone:'ok', build:(sender) => [
    `MSH|^~\\&|${sender}|${sender}_FACILITY|ACME_HOSP|DEST|20260422142151||ADT^A08|MSG1776853125726|P|2.5.1`,
    `EVN|A08|20260422142151`,
    `PID|1||00088412^^^HOSPITAL^MR||GARCIA^MARIA||19910304|F|||123 PINE ST^^AUSTIN^TX^78701`,
    `PV1|1|I|MED^2^B`,
  ]},
  {id:'VXU^V04', label:'VXU^V04', desc:'Immunization update · CVX-coded', tone:'ok', build:(sender) => [
    `MSH|^~\\&|${sender}|${sender}_FACILITY|ACME_HOSP|DEST|20260422142151||VXU^V04|MSG1776853125726|P|2.5.1`,
    `PID|1||PED-0412^^^HOSPITAL^MR||CHEN^LUCAS||20190511|M`,
    `ORC|RE||12345^PEDCLINIC`,
    `RXA|0|1|20260422|20260422|88^Influenza, unspecified formulation^CVX|0.5|mL||00^new immunization record|`,
  ]},
  {id:'ORM^O01', label:'ORM^O01', desc:'Order message', tone:'ok', build:(sender) => [
    `MSH|^~\\&|${sender}|${sender}_FACILITY|ACME_HOSP|DEST|20260422142151||ORM^O01|MSG1776853125726|P|2.5.1`,
    `PID|1||TEST-0042^^^HOSPITAL^MR||TESTPATIENT^DELTA||19800615|F`,
    `ORC|NW|ORD004|||SC||^^^20260422142151^^R`,
    `OBR|1|ORD004||CBC^COMPLETE BLOOD COUNT^LOCAL|||20260422142154`,
  ]},
  {id:'BAR^P01', label:'BAR^P01', desc:'Billing account add', tone:'ok', build:(sender) => [
    `MSH|^~\\&|${sender}|${sender}_FACILITY|ACME_HOSP|DEST|20260422142151||BAR^P01|MSG1776853125726|P|2.5.1`,
    `EVN|P01|20260422142151`,
    `PID|1||P12345^^^HOSPITAL^MR||DOE^JANE||19850707|F`,
    `PV1|1|I|MED^2^B`,
    `ACC|20260422|AUTO|12345|NONE`,
  ]},
];

const SimulateA = () => {
  const [typeId, setTypeId] = useSimState('ORU^R01-unknown');
  const [sender, setSender] = useSimState('ACME_LAB');

  const def = MESSAGE_TYPES.find(t => t.id === typeId) || MESSAGE_TYPES[0];
  const [raw, setRaw] = useSimState(def.build(sender).join('\n'));

  // Refresh buffer whenever the dropdowns change
  React.useEffect(() => {
    const d = MESSAGE_TYPES.find(t => t.id === typeId) || MESSAGE_TYPES[0];
    setRaw(d.build(sender).join('\n'));
  }, [typeId, sender]);

  const parsed = raw.split('\n').filter(Boolean).map((line) => {
    const [seg] = line.split('|');
    return { seg, line };
  });
  const hasUnknown = /UNKNOWN_TEST|\^LOCAL/.test(raw);

  const renderLine = (line, i) => {
    const m = line.match(/^([A-Z0-9]{2,3})(\|.*)?$/);
    if (!m) return <div key={i}>{line || '\u00A0'}</div>;
    const [, seg, tail=''] = m;
    const highlighted = tail.split(/(UNKNOWN_TEST\^[^|]*\^LOCAL)/).map((part, pi) =>
      part.startsWith('UNKNOWN_TEST')
        ? <span key={pi} style={{background:'var(--warn-soft)', color:'var(--warn)', padding:'0 3px', borderRadius:3, fontWeight:600}}>{part}</span>
        : <span key={pi}>{part}</span>
    );
    return (
      <div key={i} style={{display:'flex', gap:14, padding:'2px 0'}}>
        <span style={{width:24, textAlign:'right', color:'var(--ink-3)', userSelect:'none', flexShrink:0}}>{i+1}</span>
        <span style={{flex:1, minWidth:0}}>
          <span style={{color:'var(--accent-ink)', fontWeight:600}}>{seg}</span>
          {highlighted}
        </span>
      </div>
    );
  };

  return (
    <div className="page">
      <div style={{display:'flex', alignItems:'flex-end', gap:16}}>
        <div style={{flex:1}}>
          <div className="eyebrow" style={{marginBottom:6}}>Compose & send · staging MLLP · 10.1.4.22:2575</div>
          <h1 className="h1">Simulate sender</h1>
          <div className="sub">Pick a message type, tweak the text, fire it at the listener. <em style={{fontFamily:'var(--serif)', fontStyle:'italic'}}>Pairs with Inbound to show the whole loop.</em></div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) 360px', gap:22, alignItems:'start'}}>
        {/* LEFT — the HL7 buffer */}
        <div className="card" style={{display:'flex', flexDirection:'column', overflow:'hidden'}}>
          <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 18px', borderBottom:'1px solid var(--line)', background:'var(--paper-2)'}}>
            <span className="mono" style={{fontSize:11.5, color:'var(--ink-2)', fontWeight:500}}>message.hl7</span>
            <span className="chip" style={{fontSize:10.5}}>HL7v2 · 2.5.1</span>
            <span className="chip" style={{fontSize:10.5}}>{parsed.length} segments</span>
            {hasUnknown
              ? <span className="chip chip-warn" style={{fontSize:10.5}}>contains unmapped code</span>
              : <span className="chip chip-ok" style={{fontSize:10.5}}>all codes resolvable</span>}
          </div>

          <div style={{position:'relative', display:'grid', gridTemplateColumns:'1fr', background:'var(--surface)'}}>
            <pre className="mono" aria-hidden style={{margin:0, padding:'20px 22px', fontSize:13, lineHeight:1.7, color:'var(--ink-2)', whiteSpace:'pre-wrap', wordBreak:'break-all', minHeight:360, pointerEvents:'none'}}>
              {parsed.map((p, i) => renderLine(p.line, i))}
              {parsed.length === 0 && <span style={{color:'var(--ink-3)'}}>Empty — paste or type HL7v2 here.</span>}
            </pre>
            <textarea
              value={raw}
              onChange={e => setRaw(e.target.value)}
              spellCheck={false}
              style={{position:'absolute', inset:0, width:'100%', height:'100%', padding:'20px 22px 20px 58px', fontFamily:'var(--mono)', fontSize:13, lineHeight:1.7, border:'none', outline:'none', background:'transparent', color:'transparent', caretColor:'var(--accent)', resize:'none', whiteSpace:'pre-wrap', wordBreak:'break-all'}}
            />
          </div>

          <div style={{display:'flex', alignItems:'center', gap:14, padding:'10px 18px', borderTop:'1px solid var(--line)', background:'var(--paper-2)', fontSize:11.5, color:'var(--ink-3)', fontFamily:'var(--mono)'}}>
            <span>pipe-delimited · CR or LF endings ok</span>
            <span style={{marginLeft:'auto'}}>{raw.length} chars · {parsed.length} segments</span>
          </div>
        </div>

        {/* RIGHT — tweaks + what happens */}
        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          <div className="card" style={{padding:'20px 22px'}}>
            <div className="eyebrow" style={{marginBottom:12}}>Quick tweaks</div>
            <div style={{display:'flex', flexDirection:'column', gap:12}}>
              <div>
                <label style={{fontSize:11, color:'var(--ink-3)', letterSpacing:'0.04em', textTransform:'uppercase'}}>Sender (MSH-3)</label>
                <select value={sender} onChange={e=>setSender(e.target.value)} style={{width:'100%', marginTop:4, padding:'8px 10px', fontSize:13, fontFamily:'var(--mono)', background:'var(--paper-2)', border:'1px solid var(--line)', borderRadius:6, color:'var(--ink)'}}>
                  <option>ACME_LAB</option>
                  <option>StMarys</option>
                  <option>CHILDRENS</option>
                  <option>billing</option>
                </select>
              </div>
              <div>
                <label style={{fontSize:11, color:'var(--ink-3)', letterSpacing:'0.04em', textTransform:'uppercase'}}>Message type</label>
                <select value={typeId} onChange={e=>setTypeId(e.target.value)} style={{width:'100%', marginTop:4, padding:'8px 10px', fontSize:13, fontFamily:'var(--mono)', background:'var(--paper-2)', border:'1px solid var(--line)', borderRadius:6, color:'var(--ink)'}}>
                  {MESSAGE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <div style={{marginTop:6, fontSize:11.5, color: def.tone==='warn'?'var(--warn)':'var(--ink-3)', lineHeight:1.5}}>
                  {def.tone==='warn' && <span style={{marginRight:6, fontWeight:600}}>⚠</span>}
                  {def.desc}
                </div>
              </div>
            </div>
          </div>

          <SendCard hasUnknown={hasUnknown}/>
        </div>
      </div>
    </div>
  );
};

const SendCard = ({hasUnknown}) => {
  // state: 'idle' | 'sending' | 'sent' | 'held' | 'error'
  const [state, setState] = React.useState('idle');
  const [elapsed, setElapsed] = React.useState(0);

  const send = () => {
    setState('sending');
    setElapsed(0);
    const started = Date.now();
    const tick = setInterval(() => setElapsed(Date.now() - started), 50);
    setTimeout(() => {
      clearInterval(tick);
      setState(hasUnknown ? 'held' : 'sent');
    }, 1400);
  };

  const reset = () => setState('idle');

  return (
    <div className="card" style={{padding:'20px 22px'}}>
      {state === 'idle' && (
        <>
          <button onClick={send} className="btn btn-primary" style={{width:'100%', justifyContent:'center', padding:'10px 12px'}}>Send</button>
          <div style={{marginTop:10, fontSize:11.5, color:'var(--ink-3)', textAlign:'center'}}>then jump to <a style={{color:'var(--accent-ink)', textDecoration:'none', borderBottom:'1px solid var(--accent)'}}>Inbound</a> to see it land</div>
        </>
      )}

      {state === 'sending' && (
        <div>
          <button disabled className="btn btn-primary" style={{width:'100%', justifyContent:'center', padding:'10px 12px', opacity:0.9, gap:10, cursor:'default'}}>
            <span className="spinner"/> Sending…
          </button>
          <div style={{marginTop:14, display:'flex', flexDirection:'column', gap:6}}>
            {[
              ['Open MLLP connection', elapsed > 200],
              ['Transmit message', elapsed > 600],
              ['Await ACK from listener', elapsed > 1100],
            ].map(([label, done], i) => (
              <div key={i} style={{display:'flex', alignItems:'center', gap:10, fontSize:12, color: done?'var(--ink-2)':'var(--ink-3)'}}>
                {done
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  : <span className="spinner" style={{width:10, height:10, borderWidth:1.5, color:'var(--ink-3)'}}/>}
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:12, textAlign:'center', fontSize:10.5, color:'var(--ink-3)', fontFamily:'var(--mono)'}}>{(elapsed/1000).toFixed(1)}s · MLLP 10.1.4.22:2575</div>
        </div>
      )}

      {state === 'sent' && (
        <div>
          <div style={{padding:'12px 14px', background:'var(--ok-soft)', border:'1px solid transparent', borderRadius:7, display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M20 6 9 17l-5-5"/></svg>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:13, fontWeight:500, color:'var(--ok)'}}>Sent · accepted</div>
              <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:1}}>ACK MSA|AA · MSG1776853125726</div>
            </div>
          </div>
          <button onClick={reset} className="btn" style={{width:'100%', justifyContent:'center'}}>Send another</button>
          <div style={{marginTop:8, fontSize:11, color:'var(--ink-3)', textAlign:'center'}}>or jump to <a style={{color:'var(--accent-ink)', textDecoration:'none', borderBottom:'1px solid var(--accent)'}}>Inbound</a> to see it land</div>
        </div>
      )}

      {state === 'held' && (
        <div>
          <div style={{padding:'12px 14px', background:'var(--warn-soft)', border:'1px solid rgba(163, 115, 25, 0.25)', borderRadius:7, display:'flex', alignItems:'flex-start', gap:10, marginBottom:12}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0, marginTop:1}}><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 8v5M12 16h.01"/></svg>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:13, fontWeight:500, color:'var(--warn)'}}>Held for mapping</div>
              <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:1}}>ACK MSA|AE · UNKNOWN_TEST unmapped</div>
              <div style={{fontSize:11.5, color:'var(--ink-2)', marginTop:6, lineHeight:1.5}}>Message parked in triage queue. Map the code to release it — or replay automatically once mapped.</div>
            </div>
          </div>
          <button onClick={reset} className="btn" style={{width:'100%', justifyContent:'center'}}>Send another</button>
          <div style={{marginTop:8, fontSize:11, color:'var(--ink-3)', textAlign:'center'}}>see it in <a style={{color:'var(--accent-ink)', textDecoration:'none', borderBottom:'1px solid var(--accent)'}}>Unmapped codes</a></div>
        </div>
      )}
    </div>
  );
};

Object.assign(window, { SimulateA });