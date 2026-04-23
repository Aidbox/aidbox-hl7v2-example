// Shared shell: sidebar + topbar + icons

const Icon = ({name, className='i', style, ...rest}) => (
  <svg className={className} style={style} {...rest}><use href={`#i-${name}`}/></svg>
);

const NavItem = ({icon, label, count, hot, active, onClick}) => (
  <a className={'nav-item ' + (active?'active':'')} onClick={onClick}>
    <Icon name={icon}/>
    <span>{label}</span>
    {count != null && <span className={'count ' + (hot?'hot':'')}>{count}</span>}
  </a>
);

const Sidebar = ({route, setRoute, counts}) => (
  <aside className="sidebar">
    <div className="brand">
      <div className="brand-mark">h7</div>
      <div>
        <div className="brand-name">Inbound</div>
        <div className="brand-sub">HL7v2 · FHIR bridge</div>
      </div>
    </div>

    <div className="nav">
      <div className="nav-label" style={{paddingTop:0}}>Workspace</div>
      <NavItem icon="home"   label="Dashboard"        active={route==='dashboard'} onClick={()=>setRoute('dashboard')}/>
      <NavItem icon="inbox"  label="Inbound Messages" count={counts.inbound}  active={route==='inbound'}   onClick={()=>setRoute('inbound')}/>
      <NavItem icon="send"   label="Simulate Sender"                      active={route==='simulate'}  onClick={()=>setRoute('simulate')}/>

      <div className="nav-label">Terminology</div>
      <NavItem icon="alert"  label="Unmapped Codes"   count={counts.unmapped} hot active={route==='unmapped'} onClick={()=>setRoute('unmapped')}/>
      <NavItem icon="map"    label="Terminology Map"                        active={route==='terminology'} onClick={()=>setRoute('terminology')}/>
    </div>

    <div className="env">
      <span className="dot"/>
      <div style={{display:'flex', flexDirection:'column', minWidth:0}}>
        <span style={{color:'var(--ink)', fontSize:12.5, fontWeight:500}}>staging</span>
        <span style={{fontSize:11, color:'var(--ink-3)', fontFamily:'var(--mono)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>mllp://10.1.4.22:2575</span>
      </div>
    </div>
  </aside>
);

const Topbar = ({crumb}) => (
  <div className="topbar">
    <div className="crumb">{crumb[0]} <span style={{opacity:.35, margin:'0 8px'}}>/</span> <b>{crumb[1]}</b></div>
    <div className="search">
      <Icon name="search" className="i i-sm"/>
      <span>Search messages, codes, senders…</span>
      <kbd>⌘K</kbd>
    </div>
    <button className="icon-btn" title="Settings"><Icon name="settings" className="i i-sm"/></button>
    <div className="avatar">KV</div>
  </div>
);

Object.assign(window, { Icon, Sidebar, Topbar, NavItem });
