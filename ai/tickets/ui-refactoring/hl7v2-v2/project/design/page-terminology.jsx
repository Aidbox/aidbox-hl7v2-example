// Terminology Map — canonical ledger of all established code mappings.
// Organized by FHIR target field: the MEANING of a code, not its byte offset in HL7.
// HL7 field paths (OBX-3, DG1-3) are implementation detail — they appear only in the
// detail panel where they belong. The tabs answer "what does this code *become*?"

const TerminologyA = () => {
  const [sel, setSel] = React.useState(0);
  const [q, setQ] = React.useState('');
  const [fhirFilter, setFhirFilter] = React.useState([]); // [] means "all"
  const [senderFilter, setSenderFilter] = React.useState([]);
  const [openFilter, setOpenFilter] = React.useState(null); // null | 'fhir' | 'sender'
  const [formMode, setFormMode] = React.useState(null); // null | 'add' | 'edit'
  const [draft, setDraft] = React.useState({localSystem:'', localCode:'', localDisplay:'', targetCode:'', targetDisplay:'', fhirField:''});

  const openAdd = () => {
    setDraft({localSystem:'', localCode:'', localDisplay:'', targetCode:'', targetDisplay:'', fhirField:''});
    setFormMode('add');
  };
  const openEdit = (m) => {
    setDraft({
      localSystem: m.system,
      localCode: m.local,
      localDisplay: m.display,
      targetCode: m.std,
      targetDisplay: m.stdDisp,
      fhirField: m.fhirField,
    });
    setFormMode('edit');
  };
  const closeForm = () => setFormMode(null);

  React.useEffect(() => {
    if (!formMode) return;
    const k = (e) => { if (e.key === 'Escape') closeForm(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [formMode]);

  // The FHIR target for the form:
  //  - edit mode: locked to the row being edited (stored in draft.fhirField)
  //  - add mode:  whatever the user picked in the target dropdown (stored in draft.fhirField)
  const addTarget = draft.fhirField || 'Observation.code';
  const targetSystem = {
    'Observation.code': 'LOINC',
    'Observation.interpretation': 'v3 Interp',
    'Condition.code': 'ICD-10',
    'Encounter.class': 'v3 Act',
    'Encounter.dischargeDisposition': 'SNOMED',
    'MedicationRequest.medicationCodeableConcept': 'RxNorm',
    'DiagnosticReport.status': 'FHIR',
  }[addTarget] || 'LOINC';

  const mappings = [
    // Observation.code — lab results, LOINC-bound
    {local:'GLU',        display:'Glucose',                     std:'2345-7',    stdDisp:'Glucose [Mass/volume] in Serum or Plasma',    system:'LOINC',  sender:'Quest Diagnostics', hl7Field:'OBX-3',  fhirField:'Observation.code',                          usage:4820, lastSeen:'2 min ago',  mappedBy:'N. Park',   mappedOn:'Aug 12, 2024', status:'active'},
    {local:'HGB',        display:'Hemoglobin',                  std:'718-7',     stdDisp:'Hemoglobin [Mass/volume] in Blood',           system:'LOINC',  sender:'Quest Diagnostics', hl7Field:'OBX-3',  fhirField:'Observation.code',                          usage:3114, lastSeen:'3 min ago',  mappedBy:'N. Park',   mappedOn:'Aug 12, 2024', status:'active'},
    {local:'K',          display:'Potassium',                   std:'2823-3',    stdDisp:'Potassium [Moles/volume] in Serum or Plasma', system:'LOINC',  sender:'ACME_LAB',          hl7Field:'OBX-3',  fhirField:'Observation.code',                          usage:2687, lastSeen:'5 min ago',  mappedBy:'M. Reyes',  mappedOn:'Aug 14, 2024', status:'active'},
    {local:'CREAT',      display:'Creatinine',                  std:'2160-0',    stdDisp:'Creatinine [Mass/volume] in Serum or Plasma', system:'LOINC',  sender:'ACME_LAB',          hl7Field:'OBX-3',  fhirField:'Observation.code',                          usage:2541, lastSeen:'6 min ago',  mappedBy:'M. Reyes',  mappedOn:'Aug 14, 2024', status:'active'},
    {local:'A1C',        display:'Hemoglobin A1c',              std:'4548-4',    stdDisp:'Hemoglobin A1c/Hemoglobin.total in Blood',    system:'LOINC',  sender:'LabCorp',           hl7Field:'OBX-3',  fhirField:'Observation.code',                          usage:1902, lastSeen:'11 min ago', mappedBy:'J. Okafor', mappedOn:'Jul 30, 2024', status:'active'},
    {local:'TSH',        display:'Thyroid stimulating hormone', std:'3016-3',    stdDisp:'Thyrotropin [Units/volume] in Serum',         system:'LOINC',  sender:'LabCorp',           hl7Field:'OBX-3',  fhirField:'Observation.code',                          usage:1344, lastSeen:'24 min ago', mappedBy:'J. Okafor', mappedOn:'Jul 30, 2024', status:'active'},
    {local:'GLUC-OLD',   display:'Glucose (legacy alias)',      std:'2345-7',    stdDisp:'Glucose [Mass/volume] in Serum or Plasma',    system:'LOINC',  sender:'ACME_LAB',          hl7Field:'OBX-3',  fhirField:'Observation.code',                          usage:42,   lastSeen:'3 d ago',    mappedBy:'M. Reyes',  mappedOn:'Mar 04, 2024', status:'deprecated'},
    {local:'CHOL-FRAC',  display:'Cholesterol fractionation',   std:'2093-3',    stdDisp:'Cholesterol [Mass/volume] in Serum or Plasma',system:'LOINC',  sender:'LabCorp',           hl7Field:'OBX-3',  fhirField:'Observation.code',                          usage:204,  lastSeen:'2 d ago',    mappedBy:'N. Park',   mappedOn:'Feb 18, 2024', status:'review'},

    // Observation.interpretation — H/L/N/A flags → v3 ObservationInterpretation
    {local:'H',          display:'High',                        std:'H',         stdDisp:'High',                                        system:'v3 Interp', sender:'Quest Diagnostics', hl7Field:'OBX-8',  fhirField:'Observation.interpretation',            usage:1820, lastSeen:'4 min ago',  mappedBy:'N. Park',   mappedOn:'Aug 12, 2024', status:'active'},
    {local:'L',          display:'Low',                         std:'L',         stdDisp:'Low',                                         system:'v3 Interp', sender:'Quest Diagnostics', hl7Field:'OBX-8',  fhirField:'Observation.interpretation',            usage:1564, lastSeen:'4 min ago',  mappedBy:'N. Park',   mappedOn:'Aug 12, 2024', status:'active'},
    {local:'A',          display:'Abnormal',                    std:'A',         stdDisp:'Abnormal',                                    system:'v3 Interp', sender:'ACME_LAB',          hl7Field:'OBX-8',  fhirField:'Observation.interpretation',            usage:428,  lastSeen:'12 min ago', mappedBy:'M. Reyes',  mappedOn:'Aug 14, 2024', status:'active'},

    // Condition.code — ICD-10 problem list
    {local:'I10',        display:'Essential hypertension',      std:'I10',       stdDisp:'Essential (primary) hypertension',            system:'ICD-10', sender:'St.Marys Hospital', hl7Field:'DG1-3',  fhirField:'Condition.code',                            usage:1210, lastSeen:'1 hr ago',   mappedBy:'N. Park',   mappedOn:'Jun 04, 2024', status:'active'},
    {local:'E11.9',      display:'Type 2 diabetes',             std:'E11.9',     stdDisp:'Type 2 diabetes without complications',       system:'ICD-10', sender:'St.Marys Hospital', hl7Field:'DG1-3',  fhirField:'Condition.code',                            usage:986,  lastSeen:'1 hr ago',   mappedBy:'N. Park',   mappedOn:'Jun 04, 2024', status:'active'},

    // Encounter.dischargeDisposition — SNOMED
    {local:'DC-HOME',    display:'Discharge home',              std:'306689006', stdDisp:'Discharge to home',                           system:'SNOMED', sender:'St.Marys Hospital', hl7Field:'PV1-36', fhirField:'Encounter.dischargeDisposition',            usage:642,  lastSeen:'2 hr ago',   mappedBy:'M. Reyes',  mappedOn:'May 22, 2024', status:'active'},
    {local:'DC-SNF',     display:'Discharge skilled nursing',   std:'183919006', stdDisp:'Referral to skilled nursing service',         system:'SNOMED', sender:'St.Marys Hospital', hl7Field:'PV1-36', fhirField:'Encounter.dischargeDisposition',            usage:118,  lastSeen:'4 hr ago',   mappedBy:'M. Reyes',  mappedOn:'May 22, 2024', status:'active'},

    // Encounter.class — v3 ActCode
    {local:'I',          display:'Inpatient',                   std:'IMP',       stdDisp:'Inpatient encounter',                         system:'v3 Act', sender:'St.Marys Hospital', hl7Field:'PV1-2',  fhirField:'Encounter.class',                           usage:3204, lastSeen:'1 min ago',  mappedBy:'N. Park',   mappedOn:'May 22, 2024', status:'active'},
    {local:'O',          display:'Outpatient',                  std:'AMB',       stdDisp:'Ambulatory',                                  system:'v3 Act', sender:'St.Marys Hospital', hl7Field:'PV1-2',  fhirField:'Encounter.class',                           usage:2890, lastSeen:'2 min ago',  mappedBy:'N. Park',   mappedOn:'May 22, 2024', status:'active'},
    {local:'E',          display:'Emergency',                   std:'EMER',      stdDisp:'Emergency',                                   system:'v3 Act', sender:'St.Marys Hospital', hl7Field:'PV1-2',  fhirField:'Encounter.class',                           usage:1104, lastSeen:'6 min ago',  mappedBy:'N. Park',   mappedOn:'May 22, 2024', status:'active'},

    // MedicationRequest.medicationCodeableConcept — RxNorm
    {local:'ASA81',      display:'Aspirin 81mg',                std:'243670',    stdDisp:'Aspirin 81 MG Oral Tablet',                   system:'RxNorm', sender:'Epic RX',           hl7Field:'RXE-2',  fhirField:'MedicationRequest.medicationCodeableConcept', usage:2104, lastSeen:'8 min ago',  mappedBy:'J. Okafor', mappedOn:'Jul 12, 2024', status:'active'},
    {local:'MET500',     display:'Metformin 500mg',             std:'860975',    stdDisp:'Metformin HCl 500 MG Oral Tablet',            system:'RxNorm', sender:'Epic RX',           hl7Field:'RXE-2',  fhirField:'MedicationRequest.medicationCodeableConcept', usage:1788, lastSeen:'14 min ago', mappedBy:'J. Okafor', mappedOn:'Jul 12, 2024', status:'active'},
    {local:'LIS10',      display:'Lisinopril 10mg',             std:'314076',    stdDisp:'Lisinopril 10 MG Oral Tablet',                system:'RxNorm', sender:'Epic RX',           hl7Field:'RXE-2',  fhirField:'MedicationRequest.medicationCodeableConcept', usage:1421, lastSeen:'19 min ago', mappedBy:'J. Okafor', mappedOn:'Jul 12, 2024', status:'active'},

    // DiagnosticReport.status
    {local:'F',          display:'Final',                       std:'final',     stdDisp:'Final results; results stored and verified',  system:'FHIR',   sender:'Quest Diagnostics', hl7Field:'OBR-25', fhirField:'DiagnosticReport.status',                   usage:2418, lastSeen:'3 min ago',  mappedBy:'N. Park',   mappedOn:'Aug 12, 2024', status:'active'},
    {local:'P',          display:'Preliminary',                 std:'preliminary',stdDisp:'Preliminary results',                        system:'FHIR',   sender:'Quest Diagnostics', hl7Field:'OBR-25', fhirField:'DiagnosticReport.status',                   usage:812,  lastSeen:'7 min ago',  mappedBy:'N. Park',   mappedOn:'Aug 12, 2024', status:'active'},
  ];

  // FHIR target options, sorted by volume
  const fhirOptions = React.useMemo(() => {
    const counts = {};
    mappings.forEach(m => { counts[m.fhirField] = (counts[m.fhirField]||0) + 1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({name:k, count:v}));
  }, []);

  const senderOptions = React.useMemo(() => {
    const counts = {};
    mappings.forEach(m => { counts[m.sender] = (counts[m.sender]||0) + 1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({name:k, count:v}));
  }, []);

  const toggleInArray = (arr, v) => arr.includes(v) ? arr.filter(x=>x!==v) : [...arr, v];

  const filtered = mappings.filter(m =>
    (fhirFilter.length===0 || fhirFilter.includes(m.fhirField)) &&
    (senderFilter.length===0 || senderFilter.includes(m.sender)) &&
    (q==='' || m.local.toLowerCase().includes(q.toLowerCase()) || m.std.toLowerCase().includes(q.toLowerCase()) || m.display.toLowerCase().includes(q.toLowerCase()) || m.stdDisp.toLowerCase().includes(q.toLowerCase()))
  );

  React.useEffect(() => { if (sel >= filtered.length) setSel(0); }, [fhirFilter, q, senderFilter]);
  const active = filtered[sel] || filtered[0];

  const systemColor = (s) => ({
    'LOINC':      {bg:'rgba(52,211,153,0.10)',  ink:'#047857', bd:'rgba(52,211,153,0.35)'},
    'SNOMED':     {bg:'rgba(56,189,248,0.10)',  ink:'#0369a1', bd:'rgba(56,189,248,0.35)'},
    'ICD-10':     {bg:'rgba(251,146,60,0.10)',  ink:'#9a3412', bd:'rgba(251,146,60,0.35)'},
    'RxNorm':     {bg:'rgba(167,139,250,0.12)', ink:'#5b21b6', bd:'rgba(167,139,250,0.40)'},
    'v3 Interp':  {bg:'rgba(251,191,36,0.12)',  ink:'#92400e', bd:'rgba(251,191,36,0.35)'},
    'v3 Act':     {bg:'rgba(236,72,153,0.10)',  ink:'#9d174d', bd:'rgba(236,72,153,0.35)'},
    'FHIR':       {bg:'rgba(148,163,184,0.12)', ink:'#475569', bd:'rgba(148,163,184,0.40)'},
  }[s] || {bg:'var(--paper-2)', ink:'var(--ink-2)', bd:'var(--line)'});

  const SysChip = ({s, size=11}) => {
    const c = systemColor(s);
    return <span style={{display:'inline-flex', alignItems:'center', padding:'2px 8px', fontSize:size, fontWeight:600, letterSpacing:'0.02em', background:c.bg, color:c.ink, border:`1px solid ${c.bd}`, borderRadius:4, fontFamily:'var(--mono)', whiteSpace:'nowrap'}}>{s}</span>;
  };

  const StatusDot = ({s}) => {
    const m = {active:{c:'var(--accent)', l:'Active'}, deprecated:{c:'var(--ink-3)', l:'Deprecated'}, review:{c:'var(--warn)', l:'Needs review'}}[s];
    return (
      <span style={{display:'inline-flex', alignItems:'center', gap:6, fontSize:11.5, color:'var(--ink-2)'}}>
        <span style={{width:6, height:6, borderRadius:'50%', background:m.c}}/>{m.l}
      </span>
    );
  };

  // Split "Resource.path" for two-weight typography
  const FhirLabel = ({f, size=13, active=false}) => {
    if (f==='All') return <span style={{fontSize:size, fontWeight:500, color: active?'var(--ink)':'var(--ink-2)'}}>All fields</span>;
    const dot = f.indexOf('.');
    const res = f.slice(0, dot);
    const path = f.slice(dot);
    return (
      <span style={{fontSize:size, color: active?'var(--ink)':'var(--ink-2)', whiteSpace:'nowrap'}}>
        <span style={{color: active?'var(--accent-ink)':'var(--ink-3)', fontWeight:500}}>{res}</span>
        <span style={{fontWeight: active?500:400}}>{path}</span>
      </span>
    );
  };

  return (
    <div className="page" style={{gap:18}}>
      {/* Hero */}
      <div style={{display:'flex', alignItems:'flex-end', gap:16}}>
        <div style={{flex:1}}>
          <div className="eyebrow" style={{marginBottom:6}}>Terminology · canonical ledger</div>
          <h1 className="h1">Terminology map</h1>
          <div className="sub">Every local code, bound to a FHIR field — <em style={{fontFamily:'var(--serif)', fontStyle:'italic'}}>written once, replayed forever.</em></div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" className="i i-sm"/> Add mapping</button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="card" style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', padding:0, overflow:'hidden'}}>
        {[
          {label:'Total mappings', value:String(mappings.length), sub:'across 7 code systems'},
          {label:'Coverage',       value:'94%', sub:'of incoming codes resolve'},
          {label:'Messages/mo',    value:'3.2M',sub:'routed through these maps'},
          {label:'Needs review',   value:'1',   sub:'deprecated upstream'},
        ].map((s,i) => (
          <div key={i} style={{padding:'20px 24px', borderLeft: i===0?'none':'1px solid var(--line)', minWidth:140}}>
            <div className="eyebrow" style={{marginBottom:6}}>{s.label}</div>
            <div style={{display:'flex', alignItems:'baseline', gap:8}}>
              <div style={{fontFamily:'var(--serif)', fontSize:30, fontWeight:500, letterSpacing:'-0.02em', color:'var(--ink)'}}>{s.value}</div>
            </div>
            <div style={{fontSize:11.5, color:'var(--ink-3)', marginTop:2}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {formMode && (
        <div onClick={closeForm}
          style={{position:'fixed', inset:0, background:'rgba(20,16,12,0.45)', backdropFilter:'blur(3px)', WebkitBackdropFilter:'blur(3px)', display:'grid', placeItems:'center', zIndex:200, padding:20}}>
          <div onClick={e=>e.stopPropagation()} className="card" style={{width:'min(620px, 100%)', maxHeight:'90vh', overflow:'hidden', padding:0, boxShadow:'0 30px 80px rgba(20,20,22,0.25), 0 4px 12px rgba(20,20,22,0.10)', display:'flex', flexDirection:'column'}}>
          <div style={{padding:'18px 22px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:12, flexShrink:0}}>
            <div style={{flex:1}}>
              <div style={{fontFamily:'var(--serif)', fontSize:20, fontWeight:500, letterSpacing:'-0.02em', color:'var(--ink)'}}>{formMode==='edit' ? 'Edit mapping' : 'Add new mapping'}</div>
              <div style={{fontSize:12.5, color:'var(--ink-3)', marginTop:4}}>
                {formMode==='edit' ? <>Bound to <FhirLabel f={addTarget} size={12.5} active={true}/> <span style={{marginLeft:4}}>— target is locked</span></> : 'One local code → one FHIR element, then every future message routes through it.'}
              </div>
            </div>
            <button onClick={closeForm} aria-label="Close"
              style={{flexShrink:0, background:'transparent', border:'none', padding:6, cursor:'pointer', color:'var(--ink-3)', borderRadius:4, display:'inline-flex'}}>
              <Icon name="x" className="i i-sm"/>
            </button>
          </div>

          <div style={{padding:'20px 22px', display:'flex', flexDirection:'column', gap:16, overflowY:'auto', overflowX:'hidden', flex:1}}>
            {formMode==='add' && (
              <Field label="FHIR target">
                <div style={{position:'relative'}}>
                  <select value={draft.fhirField} onChange={e=>setDraft({...draft, fhirField:e.target.value})}
                    className="inp" style={{width:'100%', appearance:'none', paddingRight:32, cursor:'pointer'}}>
                    <option value="">Select a target field…</option>
                    {fhirOptions.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
                  </select>
                  <Icon name="chev-down" className="i i-sm" style={{position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)', pointerEvents:'none'}}/>
                </div>
              </Field>
            )}

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
              <Field label="Local system">
                <input value={draft.localSystem} onChange={e=>setDraft({...draft, localSystem:e.target.value})} placeholder="e.g. ACME-LAB-CODES" className="inp mono"/>
              </Field>
              <Field label="Local code">
                <input value={draft.localCode} onChange={e=>setDraft({...draft, localCode:e.target.value.toUpperCase()})} placeholder="e.g. K_SERUM" className="inp mono"/>
              </Field>
            </div>

            <Field label="Local display">
              <input value={draft.localDisplay} onChange={e=>setDraft({...draft, localDisplay:e.target.value})} placeholder="e.g. Potassium [Serum/Plasma]" className="inp"/>
            </Field>

            <Field label={<span>Map to <span className="mono" style={{color:'var(--accent-ink)'}}>{addTarget}</span></span>}>
              <div style={{position:'relative'}}>
                <Icon name="search" className="i i-sm" style={{position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)', pointerEvents:'none'}}/>
                <input value={draft.targetCode} onChange={e=>setDraft({...draft, targetCode:e.target.value})} placeholder={`Search ${targetSystem} codes…`} className="inp" style={{width:'100%', paddingLeft:32}}/>
              </div>
              {formMode==='edit' && draft.targetDisplay && (
                <div style={{fontSize:11.5, color:'var(--ink-3)', marginTop:6, paddingLeft:2}}>
                  <span className="mono" style={{color:'var(--accent-ink)'}}>{draft.targetCode}</span>
                  <span style={{margin:'0 6px', opacity:0.5}}>·</span>
                  {draft.targetDisplay}
                </div>
              )}
            </Field>
          </div>

          <div style={{padding:'14px 22px', borderTop:'1px solid var(--line)', background:'var(--paper-2)', display:'flex', alignItems:'center', gap:12, flexShrink:0}}>
            <div style={{flex:1, fontSize:12, color:'var(--ink-3)'}}>{formMode==='edit' ? 'Changes apply to new messages immediately; backlog replays on request.' : 'Applies to every future message & replays the backlog automatically.'}</div>
            <button className="btn btn-ghost" onClick={closeForm}>Cancel</button>
            <button className="btn btn-primary" onClick={closeForm} disabled={!draft.localCode || !draft.targetCode}><Icon name="check" className="i i-sm"/> {formMode==='edit' ? 'Save changes' : 'Create mapping'}</button>
          </div>
          </div>
        </div>
      )}

      {/* Main — table + detail */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 380px', gap:16, alignItems:'start'}}>
        {/* Table */}
        <div className="card" style={{overflow:'visible'}}>
          {/* Toolbar — search + active filter chips */}
          <div style={{padding:'12px 16px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:10, background:'var(--paper-2)', flexWrap:'wrap'}}>
            <Icon name="search" className="i i-sm" style={{color:'var(--ink-3)', flexShrink:0}}/>
            <input value={q} onChange={e=>setQ(e.target.value)}
              placeholder="Search local code, standard code, or display…"
              style={{flex:'1 1 200px', minWidth:0, background:'transparent', border:'none', outline:'none', color:'var(--ink)', fontSize:13, fontFamily:'inherit'}}/>
            {(fhirFilter.length>0 || senderFilter.length>0) && (
              <button onClick={()=>{setFhirFilter([]); setSenderFilter([]);}}
                style={{fontSize:11.5, color:'var(--accent-ink)', background:'var(--accent-soft)', border:'1px solid rgba(198,83,42,0.2)', borderRadius:4, padding:'3px 9px', cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:5}}>
                <Icon name="x" className="i" style={{width:10, height:10}}/>
                Clear {fhirFilter.length + senderFilter.length} filter{fhirFilter.length+senderFilter.length===1?'':'s'}
              </button>
            )}
            <span style={{fontSize:11.5, color:'var(--ink-3)', fontFamily:'var(--mono)', flexShrink:0}}>{filtered.length} of {mappings.length}</span>
          </div>

          {/* Column header with per-column filter popovers */}
          <div style={{display:'grid', gridTemplateColumns:'150px 82px 1fr 180px 140px', padding:'10px 18px', background:'var(--paper-2)', borderBottom:'1px solid var(--line)', fontSize:10.5, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--ink-3)', gap:8, position:'relative'}}>
            <div>Local code</div>
            <div>System</div>
            <div>Standard</div>
            <ColHeader label="FHIR target" active={fhirFilter.length>0} activeCount={fhirFilter.length} open={openFilter==='fhir'} onToggle={()=>setOpenFilter(openFilter==='fhir'?null:'fhir')} onClose={()=>setOpenFilter(null)}>
              <FilterList options={fhirOptions} selected={fhirFilter} onToggle={v=>setFhirFilter(arr=>toggleInArray(arr,v))} onClear={()=>setFhirFilter([])} renderLabel={name => <FhirLabel f={name} size={12.5}/>}/>
            </ColHeader>
            <ColHeader label="Sender" active={senderFilter.length>0} activeCount={senderFilter.length} open={openFilter==='sender'} onToggle={()=>setOpenFilter(openFilter==='sender'?null:'sender')} onClose={()=>setOpenFilter(null)} align="left">
              <FilterList options={senderOptions} selected={senderFilter} onToggle={v=>setSenderFilter(arr=>toggleInArray(arr,v))} onClear={()=>setSenderFilter([])} renderLabel={name => <span style={{fontSize:12.5, color:'var(--ink)'}}>{name}</span>}/>
            </ColHeader>
          </div>

          <div>
            {filtered.map((m, i) => (
              <div key={m.local+m.sender+m.hl7Field} onClick={()=>setSel(i)}
                style={{display:'grid', gridTemplateColumns:'150px 82px 1fr 180px 140px', padding:'12px 18px', borderBottom:'1px solid var(--line)', cursor:'pointer', alignItems:'center', gap:8, background: i===sel?'var(--paper-2)':'transparent', borderLeft: i===sel?'2px solid var(--accent)':'2px solid transparent'}}>
                <div style={{minWidth:0}}>
                  <div className="mono" style={{fontSize:12.5, fontWeight:600, color: i===sel?'var(--accent-ink)':'var(--ink)', opacity: m.status==='deprecated'?0.55:1, textDecoration: m.status==='deprecated'?'line-through':'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{m.local}</div>
                  <div style={{fontSize:11, color:'var(--ink-3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{m.display}</div>
                </div>
                <div><SysChip s={m.system}/></div>
                <div style={{minWidth:0}}>
                  <div className="mono" style={{fontSize:12.5, color:'var(--ink)'}}>{m.std}</div>
                  <div style={{fontSize:11, color:'var(--ink-3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{m.stdDisp}</div>
                </div>
                <div style={{minWidth:0}}><FhirLabel f={m.fhirField} size={12}/></div>
                <div style={{fontSize:11.5, color:'var(--ink-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{m.sender}</div>
              </div>
            ))}
            {filtered.length===0 && (
              <div style={{padding:40, textAlign:'center', color:'var(--ink-3)', fontSize:13}}>No mappings match your filters.</div>
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="card" style={{position:'sticky', top:16}}>
          {active && (
            <>
              {/* FHIR target — now the opening line */}
              <div style={{padding:'18px 22px 14px', borderBottom:'1px solid var(--line)', background:'linear-gradient(180deg, var(--paper-2), transparent)'}}>
                <div className="eyebrow" style={{marginBottom:6}}>FHIR target</div>
                <div style={{fontSize:17, letterSpacing:'-0.01em'}}>
                  <FhirLabel f={active.fhirField} size={17} active={true}/>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:10, marginTop:10}}>
                  <SysChip s={active.system}/>
                  <StatusDot s={active.status}/>
                </div>
              </div>

              {/* The mapping itself */}
              <div style={{padding:'22px 22px 18px'}}>
                <div className="eyebrow" style={{marginBottom:4}}>Local</div>
                <div className="mono" style={{fontSize:22, fontWeight:600, letterSpacing:'-0.01em', color:'var(--ink)'}}>{active.local}</div>
                <div style={{fontSize:13, color:'var(--ink-2)', fontFamily:'var(--serif)', fontStyle:'italic', marginTop:2}}>"{active.display}"</div>

                <div style={{display:'flex', alignItems:'center', gap:8, margin:'14px 0', color:'var(--ink-3)'}}>
                  <div style={{flex:1, height:1, background:'var(--line)'}}/>
                  <span style={{fontSize:10, letterSpacing:'0.15em', textTransform:'uppercase'}}>maps to</span>
                  <div style={{flex:1, height:1, background:'var(--line)'}}/>
                </div>

                <div className="eyebrow" style={{marginBottom:4}}>Standard · {active.system}</div>
                <div className="mono" style={{fontSize:22, fontWeight:600, letterSpacing:'-0.01em', color:'var(--accent-ink)', wordBreak:'break-all'}}>{active.std}</div>
                <div style={{fontSize:13, color:'var(--ink-2)', marginTop:4, lineHeight:1.4}}>{active.stdDisp}</div>
              </div>

              {/* Source — HL7 path lives HERE, as implementation detail */}
              <div style={{padding:'14px 22px', borderTop:'1px solid var(--line)', background:'var(--paper-2)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
                <div>
                  <div className="eyebrow" style={{marginBottom:4}}>Source</div>
                  <div style={{fontSize:13, color:'var(--ink)'}}>{active.sender}</div>
                  <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginTop:2}}>HL7 {active.hl7Field}</div>
                </div>
                <div>
                  <div className="eyebrow" style={{marginBottom:4}}>Last seen</div>
                  <div style={{fontSize:13, color:'var(--ink)'}}>{active.lastSeen}</div>
                  <div style={{fontSize:11, color:'var(--ink-3)', marginTop:2}}>from this mapping</div>
                </div>
              </div>

              <div style={{padding:'16px 22px', borderTop:'1px solid var(--line)'}}>
                <div className="eyebrow" style={{marginBottom:10}}>Lineage</div>
                <div style={{display:'flex', flexDirection:'column', gap:10, fontSize:12}}>
                  <div style={{display:'flex', gap:10}}>
                    <div style={{width:6, height:6, borderRadius:'50%', background:'var(--accent)', marginTop:6}}/>
                    <div style={{flex:1}}>
                      <div style={{color:'var(--ink)'}}>Mapping created</div>
                      <div style={{color:'var(--ink-3)', fontSize:11, marginTop:1}}>{active.mappedBy} · {active.mappedOn}</div>
                    </div>
                  </div>
                  <div style={{display:'flex', gap:10}}>
                    <div style={{width:6, height:6, borderRadius:'50%', background:'var(--ink-3)', marginTop:6}}/>
                    <div style={{flex:1}}>
                      <div style={{color:'var(--ink-2)'}}>Backlog replayed</div>
                      <div style={{color:'var(--ink-3)', fontSize:11, marginTop:1}}>128 messages · same day</div>
                    </div>
                  </div>
                  <div style={{display:'flex', gap:10}}>
                    <div style={{width:6, height:6, borderRadius:'50%', background:'var(--ink-3)', opacity:0.5, marginTop:6}}/>
                    <div style={{flex:1}}>
                      <div style={{color:'var(--ink-2)'}}>Applied to {active.sender}</div>
                      <div style={{color:'var(--ink-3)', fontSize:11, marginTop:1}}>every {active.hl7Field} since</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{padding:'14px 22px', borderTop:'1px solid var(--line)', display:'flex', gap:8}}>
                <button className="btn btn-ghost" style={{flex:1, justifyContent:'center'}}>Deprecate</button>
                <button className="btn" style={{flex:1, justifyContent:'center'}} onClick={()=>openEdit(active)}>Edit</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Field = ({label, mono, children}) => (
  <label style={{display:'flex', flexDirection:'column', gap:6}}>
    <span className="eyebrow">{label}</span>
    {children}
  </label>
);

// Column header with a filter popover — used on filterable columns (FHIR target, Sender).
const ColHeader = ({label, active, activeCount, open, onToggle, onClose, children, align='right'}) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [open, onClose]);
  return (
    <div ref={ref} style={{position:'relative', display:'flex', alignItems:'center', gap:6, justifyContent: align==='right'?'space-between':'flex-start'}}>
      <span>{label}</span>
      <button onClick={(e)=>{e.stopPropagation(); onToggle();}}
        title={`Filter ${label.toLowerCase()}`}
        style={{display:'inline-flex', alignItems:'center', gap:4, border:'none', background: active?'var(--accent-soft)':'transparent', color: active?'var(--accent-ink)':'var(--ink-3)', padding:'3px 6px', borderRadius:3, cursor:'pointer', fontFamily:'inherit'}}>
        <Icon name="filter" className="i" style={{width:10, height:10}}/>
        {active && <span className="mono" style={{fontSize:9.5, fontWeight:600}}>{activeCount}</span>}
      </button>
      {open && (
        <div onClick={e=>e.stopPropagation()}
          style={{position:'absolute', top:'calc(100% + 6px)', [align==='right'?'right':'left']:0, zIndex:50, background:'var(--paper)', border:'1px solid var(--line)', borderRadius:8, boxShadow:'0 10px 30px rgba(20,20,22,0.12), 0 2px 6px rgba(20,20,22,0.06)', minWidth:280, maxWidth:340, overflow:'hidden', textTransform:'none', letterSpacing:'normal', fontWeight:400, color:'var(--ink)'}}>
          {children}
        </div>
      )}
    </div>
  );
};

const FilterList = ({options, selected, onToggle, onClear, renderLabel}) => {
  const [q, setQ] = React.useState('');
  const filtered = options.filter(o => o.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div style={{padding:'10px 12px 8px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:8}}>
        <Icon name="search" className="i i-sm" style={{color:'var(--ink-3)', flexShrink:0}}/>
        <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…"
          style={{flex:1, minWidth:0, background:'transparent', border:'none', outline:'none', fontSize:12.5, fontFamily:'inherit', color:'var(--ink)'}}/>
      </div>
      <div style={{maxHeight:280, overflowY:'auto', padding:'4px 0'}}>
        {filtered.map(o => {
          const isOn = selected.includes(o.name);
          return (
            <label key={o.name} style={{display:'flex', alignItems:'center', gap:10, padding:'7px 12px', cursor:'pointer', userSelect:'none', background: isOn?'var(--paper-2)':'transparent'}}>
              <input type="checkbox" checked={isOn} onChange={()=>onToggle(o.name)}
                style={{accentColor:'var(--accent)', margin:0, cursor:'pointer'}}/>
              <span style={{flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{renderLabel(o.name)}</span>
              <span className="mono" style={{fontSize:10.5, color:'var(--ink-3)', flexShrink:0}}>{o.count}</span>
            </label>
          );
        })}
        {filtered.length===0 && <div style={{padding:'16px 12px', fontSize:12, color:'var(--ink-3)', textAlign:'center'}}>No matches.</div>}
      </div>
      {selected.length > 0 && (
        <div style={{padding:'8px 12px', borderTop:'1px solid var(--line)', background:'var(--paper-2)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <span style={{fontSize:11.5, color:'var(--ink-3)'}}>{selected.length} selected</span>
          <button onClick={onClear} style={{fontSize:11.5, color:'var(--accent-ink)', background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit'}}>Clear</button>
        </div>
      )}
    </div>
  );
};
