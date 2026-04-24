// App shell — routes between pages, holds variant state

const { useState, useEffect } = React;

const ROUTES = {
  dashboard:   {crumb:['Workspace','Dashboard'],        variants:[['A','Overview']]},
  inbound:     {crumb:['Workspace','Inbound messages'], variants:[['A','List + detail'],['B','Grouped by sender']]},
  simulate:    {crumb:['Workspace','Simulate sender'],  variants:[['A','Composer']]},
  unmapped:    {crumb:['Terminology','Unmapped codes'], variants:[['A','Triage inbox']]},
  terminology: {crumb:['Terminology','Terminology map'],variants:[['A','Coming soon']]},
};

const PAGES = {
  'dashboard:A':   () => <DashboardB/>,
  'inbound:A':     () => <InboundA/>,
  'inbound:B':     () => <InboundB/>,
  'unmapped:A':    () => <UnmappedA/>,
  'unmapped:B':    () => <UnmappedB/>,
  'simulate:A':    () => <SimulateA/>,
  'terminology:A': () => <TerminologyA/>,
};

const ComingSoon = ({label}) => (
  <div className="page" style={{display:'grid', placeItems:'center', minHeight:'60vh'}}>
    <div style={{textAlign:'center', maxWidth:400}}>
      <div style={{fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--ink-3)', marginBottom:8}}>In design</div>
      <h1 className="h1">{label}</h1>
      <div className="sub">Wireframe locked · hi-fi in the next cut. Click the other nav items to see what's ready.</div>
    </div>
  </div>
);

const App = () => {
  const [route, setRoute] = useState(() => localStorage.getItem('hl7-route') || 'dashboard');
  const [variant, setVariant] = useState(() => JSON.parse(localStorage.getItem('hl7-variants') || '{}'));

  useEffect(() => { localStorage.setItem('hl7-route', route); }, [route]);
  useEffect(() => { localStorage.setItem('hl7-variants', JSON.stringify(variant)); }, [variant]);

  const v = variant[route] || 'A';
  const Page = PAGES[`${route}:${v}`] || PAGES[`${route}:A`];
  const meta = ROUTES[route];

  return (
    <div className="app">
      <Sidebar route={route} setRoute={setRoute} counts={{inbound:'12.8k', unmapped:'17'}}/>
      <main className="main">
        <Page/>
      </main>

      {meta.variants.length > 1 && (
        <div className="variant-bar">
          <span className="label">Variant</span>
          {meta.variants.map(([id, label]) => (
            <button key={id} className={v===id?'on':''} onClick={()=>setVariant({...variant, [route]:id})}>
              {id} · {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
