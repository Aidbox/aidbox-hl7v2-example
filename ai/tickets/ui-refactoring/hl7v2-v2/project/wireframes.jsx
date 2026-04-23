// Wireframe primitives — sketchy low-fi + one accent. Kept tiny & composable.

// --- Base tokens ---
const WF = {
  ink: '#1e1a17',
  ink2: '#4a4239',
  ink3: '#8a8176',
  paper: '#fdfcf9',
  paper2: '#f4f1ea',
  line: '#2c2620',
  lineLight: 'rgba(44,38,32,0.25)',
  lineMid: 'rgba(44,38,32,0.55)',
  muted: 'rgba(44,38,32,0.12)',
  mutedBg: 'rgba(44,38,32,0.04)',
  // accent is resolved from CSS var so Tweaks can swap it
  accent: 'var(--wf-accent, #d9623f)',
  accentSoft: 'var(--wf-accent-soft, #f6d3c6)',
  hand: '"Caveat", "Patrick Hand", "Comic Sans MS", cursive',
  sans: '"Kalam", "Caveat", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
};

// inject shared wireframe css once
if (typeof document !== 'undefined' && !document.getElementById('wf-styles')) {
  const s = document.createElement('style');
  s.id = 'wf-styles';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&family=Kalam:wght@300;400;700&family=Patrick+Hand&family=JetBrains+Mono:wght@400;500&display=swap');
    .wf { font-family: ${WF.sans}; color: ${WF.ink}; background: ${WF.paper}; }
    .wf-hand { font-family: ${WF.hand}; }
    .wf-mono { font-family: ${WF.mono}; }
    .wf-h1 { font-family: ${WF.hand}; font-weight: 700; font-size: 32px; letter-spacing: -.5px; line-height: 1; }
    .wf-h2 { font-family: ${WF.hand}; font-weight: 600; font-size: 22px; line-height: 1.05; }
    .wf-h3 { font-family: ${WF.hand}; font-weight: 600; font-size: 17px; letter-spacing: .2px; }
    .wf-label { font-family: ${WF.hand}; font-weight: 500; font-size: 14px; color: ${WF.ink2}; }
    .wf-body { font-family: ${WF.sans}; font-weight: 400; font-size: 13px; line-height: 1.35; }
    .wf-tiny { font-family: ${WF.sans}; font-weight: 400; font-size: 11px; color: ${WF.ink3}; }
    .wf-note { font-family: ${WF.hand}; color: ${WF.ink3}; font-size: 14px; }
    /* rough border using double-box-shadow trick */
    .wf-box { border: 1.5px solid ${WF.line}; border-radius: 6px; background: ${WF.paper}; position: relative; }
    .wf-box-soft { border: 1.25px solid ${WF.lineMid}; border-radius: 5px; background: ${WF.paper}; }
    .wf-box-dashed { border: 1.5px dashed ${WF.lineMid}; border-radius: 6px; }
    .wf-chip { display: inline-flex; align-items: center; gap: 4px; border: 1.25px solid ${WF.line}; border-radius: 999px; padding: 2px 9px; font-family: ${WF.hand}; font-size: 13px; background: ${WF.paper}; }
    .wf-chip-accent { background: ${WF.accentSoft}; border-color: ${WF.accent}; color: ${WF.ink}; }
    .wf-chip-ghost { border-style: dashed; color: ${WF.ink3}; }
    .wf-hscroll::-webkit-scrollbar { height: 9px; -webkit-appearance: none; }
    .wf-hscroll::-webkit-scrollbar-track { background: ${WF.mutedBg}; border: 1px dashed ${WF.lineLight}; border-radius: 5px; }
    .wf-hscroll::-webkit-scrollbar-thumb { background: ${WF.line}; border-radius: 5px; border: 1.5px solid ${WF.paper}; }
    .wf-hscroll::-webkit-scrollbar-thumb:hover { background: ${WF.ink2}; }
    .wf-hscroll { scrollbar-width: thin; scrollbar-color: ${WF.line} ${WF.mutedBg}; }
    .wf-btn { display: inline-flex; align-items: center; gap: 6px; border: 1.5px solid ${WF.line}; padding: 6px 12px; border-radius: 6px; font-family: ${WF.hand}; font-size: 15px; background: ${WF.paper}; cursor: pointer; }
    .wf-btn-accent { background: ${WF.accent}; color: white; border-color: ${WF.ink}; box-shadow: 2px 2px 0 ${WF.ink}; }
    .wf-accent-ink { color: ${WF.accent}; }
    .wf-accent-bg { background: ${WF.accentSoft}; }
    .wf-accent-border { border-color: ${WF.accent}; }
    .wf-dashed { border: 1.5px dashed ${WF.lineLight}; }
    .wf-scrib { background-image: repeating-linear-gradient(115deg, transparent 0 6px, ${WF.lineLight} 6px 7px); }
    .wf-under { background-image: linear-gradient(${WF.accent}, ${WF.accent}); background-repeat: no-repeat; background-size: 100% 4px; background-position: 0 95%; padding-bottom: 1px; }
    .wf-tab { font-family: ${WF.hand}; font-size: 15px; padding: 7px 12px 8px; color: ${WF.ink2}; cursor: pointer; position: relative; }
    .wf-tab-on { color: ${WF.ink}; }
    .wf-tab-on::after { content: ''; position: absolute; left: 6px; right: 6px; bottom: -2px; height: 3px; background: ${WF.accent}; border-radius: 2px; }
    .wf-divider { height: 1.25px; background: ${WF.lineLight}; }
    .wf-vdivider { width: 1.25px; background: ${WF.lineLight}; }
    .wf-dot { width: 7px; height: 7px; border-radius: 99px; display: inline-block; }
    .wf-pulse { position: relative; }
    .wf-pulse::after { content:''; position:absolute; inset:-3px; border-radius:99px; border: 1.5px solid ${WF.accent}; animation: wfPulse 1.6s ease-out infinite; }
    @keyframes wfPulse { 0%{transform:scale(.7);opacity:.8} 100%{transform:scale(1.6);opacity:0} }
    .wf-scroll-hint { background: repeating-linear-gradient(90deg, ${WF.lineLight} 0 8px, transparent 8px 14px); height: 1.5px; }
    .wf-ph-line { height: 8px; border-radius: 2px; background: ${WF.muted}; }
    .wf-skel { background: ${WF.mutedBg}; border-radius: 3px; }
    .wf-strike { text-decoration: line-through; color: ${WF.ink3}; }
    .wf-arrow { color: ${WF.accent}; }
    .wf-grid-dots { background-image: radial-gradient(${WF.lineLight} 1px, transparent 1px); background-size: 14px 14px; }
    input.wf-input, textarea.wf-input, .wf-input { font-family: ${WF.mono}; font-size: 12px; background: ${WF.paper}; border: 1.25px solid ${WF.lineMid}; border-radius: 4px; padding: 5px 8px; width: 100%; color: ${WF.ink}; }
    .wf-field { display: flex; flex-direction: column; gap: 3px; }
    .wf-kbd { font-family: ${WF.mono}; font-size: 10px; border: 1px solid ${WF.lineMid}; border-bottom-width: 2px; padding: 1px 4px; border-radius: 3px; color: ${WF.ink2}; }
    .wf-squiggle { border-bottom: 2.5px solid ${WF.accent}; border-radius: 50%; height: 0; width: 100%; }
  `;
  document.head.appendChild(s);
}

// ── Tiny primitives ─────────────────────────────────────────
const Row = ({children, style, ...p}) => <div {...p} style={{display:'flex', alignItems:'center', ...style}}>{children}</div>;
const Col = ({children, style, ...p}) => <div {...p} style={{display:'flex', flexDirection:'column', ...style}}>{children}</div>;
const Sp = ({h=8, w=0}) => <div style={{height:h, width:w, flexShrink:0}} />;

// rough horizontal scribble used where real content would go
const Scribble = ({w='70%', thickness=6, style}) => (
  <div style={{width:w, height:thickness, borderRadius:3, background:WF.muted, ...style}} />
);

// sketchy arrow (single svg, jittery path)
const Arrow = ({w=60, h=14, dir='right', color}) => {
  const c = color || WF.accent;
  const pts = dir === 'right'
    ? `M2,${h/2} C ${w*0.3},${h*0.2} ${w*0.5},${h*0.85} ${w-8},${h/2}`
    : `M${w-2},${h/2} C ${w*0.7},${h*0.2} ${w*0.5},${h*0.85} 8,${h/2}`;
  const head = dir === 'right'
    ? `M${w-8},${h/2-5} L${w-2},${h/2} L${w-8},${h/2+5}`
    : `M8,${h/2-5} L2,${h/2} L8,${h/2+5}`;
  return (
    <svg width={w} height={h} style={{overflow:'visible'}}>
      <path d={pts} fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" />
      <path d={head} fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// hand-drawn checkbox/circle/etc icons
const Ico = ({name, size=14, color}) => {
  const c = color || WF.ink;
  const s = size;
  const common = { width: s, height: s, stroke: c, fill: 'none', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const svgs = {
    check: <svg viewBox="0 0 16 16" {...common}><path d="M3 9 l3 3 l7-8" /></svg>,
    x: <svg viewBox="0 0 16 16" {...common}><path d="M4 4 l8 8 M12 4 l-8 8" /></svg>,
    warn: <svg viewBox="0 0 16 16" {...common}><path d="M8 2 L15 14 L1 14 z M8 7 v3 M8 12.5 v.1" /></svg>,
    info: <svg viewBox="0 0 16 16" {...common}><circle cx="8" cy="8" r="6"/><path d="M8 7 v4 M8 5 v.1"/></svg>,
    dot: <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.5" fill={c}/></svg>,
    search: <svg viewBox="0 0 16 16" {...common}><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 l3.5 3.5"/></svg>,
    plus: <svg viewBox="0 0 16 16" {...common}><path d="M8 3 v10 M3 8 h10"/></svg>,
    chev: <svg viewBox="0 0 16 16" {...common}><path d="M6 4 l4 4 l-4 4"/></svg>,
    chevD: <svg viewBox="0 0 16 16" {...common}><path d="M4 6 l4 4 l4-4"/></svg>,
    play: <svg viewBox="0 0 16 16"><path d="M4 3 L13 8 L4 13 z" fill={c}/></svg>,
    clock: <svg viewBox="0 0 16 16" {...common}><circle cx="8" cy="8" r="6"/><path d="M8 5 v3.5 l2 1.5"/></svg>,
    grip: <svg viewBox="0 0 16 16"><g fill={c}><circle cx="6" cy="4" r="1"/><circle cx="10" cy="4" r="1"/><circle cx="6" cy="8" r="1"/><circle cx="10" cy="8" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="10" cy="12" r="1"/></g></svg>,
    up: <svg viewBox="0 0 16 16" {...common}><path d="M8 13 V4 M4 8 l4-4 l4 4"/></svg>,
    down: <svg viewBox="0 0 16 16" {...common}><path d="M8 3 V12 M4 8 l4 4 l4-4"/></svg>,
    refresh: <svg viewBox="0 0 16 16" {...common}><path d="M13 8 a5 5 0 1 1 -1.4 -3.5 M13 2 v3 h-3"/></svg>,
    bolt: <svg viewBox="0 0 16 16" {...common}><path d="M9 2 L3 9 h4 l-1 5 l6-7 h-4 z"/></svg>,
    link: <svg viewBox="0 0 16 16" {...common}><path d="M7 9 a3 3 0 0 0 4 0 l2-2 a3 3 0 0 0 -4 -4 l-1 1 M9 7 a3 3 0 0 0 -4 0 l-2 2 a3 3 0 0 0 4 4 l1 -1"/></svg>,
    filter: <svg viewBox="0 0 16 16" {...common}><path d="M2 3 h12 l-5 6 v4 l-2 1 v-5 z"/></svg>,
    pause: <svg viewBox="0 0 16 16"><rect x="4" y="3" width="3" height="10" fill={c}/><rect x="9" y="3" width="3" height="10" fill={c}/></svg>,
  };
  return svgs[name] || null;
};

// top app nav (all screens)
const AppNav = ({active='dashboard', showGroups=true}) => {
  const tabs = showGroups ? [
    {id:'dashboard', label:'Home', group:null},
    {id:'inbound', label:'Inbound Messages', group:'inbound'},
    {id:'simulate', label:'Simulate Sender', group:'inbound'},
    {id:'unmapped', label:'Unmapped Codes', group:'inbound', badge:'3'},
    {id:'accounts', label:'Accounts', group:'outbound'},
    {id:'outgoing', label:'Outgoing Messages', group:'outbound'},
    {id:'terminology', label:'Terminology Map', group:'ref'},
  ] : [
    {id:'inbound', label:'Inbound Messages'},
    {id:'simulate', label:'Simulate Sender'},
    {id:'unmapped', label:'Unmapped Codes', badge:'3'},
    {id:'accounts', label:'Accounts'},
    {id:'outgoing', label:'Outgoing Messages'},
    {id:'terminology', label:'Terminology Map'},
  ];
  return (
    <div style={{borderBottom:`1.25px solid ${WF.lineLight}`, padding:'10px 20px 0', display:'flex', alignItems:'flex-end', gap:16, background:WF.paper}}>
      <div style={{fontFamily:WF.hand, fontWeight:700, fontSize:18, paddingBottom:10, color:WF.ink, display:'flex', alignItems:'center', gap:6}}>
        <div style={{width:18, height:18, border:`1.5px solid ${WF.ink}`, borderRadius:4, transform:'rotate(8deg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11}}>h7</div>
        hl7.demo
      </div>
      <div style={{width:1, background:WF.lineLight, alignSelf:'stretch', margin:'4px 4px 8px'}} />
      {tabs.map((t,i) => {
        const groupBreak = showGroups && i>0 && tabs[i-1].group !== t.group && t.group;
        return (
          <React.Fragment key={t.id}>
            {groupBreak && <div style={{width:1, background:WF.lineLight, alignSelf:'stretch', margin:'4px 2px 8px'}} />}
            <div className={'wf-tab ' + (active===t.id ? 'wf-tab-on' : '')} style={{display:'flex', alignItems:'center', gap:5}}>
              {t.label}
              {t.badge && <span className="wf-chip wf-chip-accent" style={{padding:'0 6px', fontSize:11, height:16, lineHeight:'14px'}}>{t.badge}</span>}
            </div>
          </React.Fragment>
        );
      })}
      <div style={{flex:1}} />
      <Row style={{paddingBottom:10, gap:10}}>
        <span className="wf-chip" style={{fontSize:11, padding:'1px 8px', borderColor:WF.lineMid, color:WF.ink2}}>DEV</span>
        <Row style={{gap:5}}>
          <span className="wf-dot" style={{background:'#3fb56b'}} />
          <span className="wf-tiny">Aidbox</span>
        </Row>
      </Row>
    </div>
  );
};

// Page shell (nav + content + optional title/subtitle)
const Screen = ({nav='dashboard', title, subtitle, right, showNav=true, navGroups=true, children, pad=24, bg}) => (
  <Col style={{height:'100%', background:bg||WF.paper2}}>
    {showNav && <AppNav active={nav} showGroups={navGroups} />}
    {(title || subtitle || right) && (
      <Row style={{padding:`${pad-6}px ${pad}px 10px`, alignItems:'flex-end', gap:16}}>
        <Col style={{flex:1, gap:2}}>
          {title && <div className="wf-h1">{title}</div>}
          {subtitle && <div className="wf-note">{subtitle}</div>}
        </Col>
        {right}
      </Row>
    )}
    <div style={{flex:1, padding:`0 ${pad}px ${pad}px`, overflow:'hidden'}}>{children}</div>
  </Col>
);

// Status chip presets
const StatusChip = ({kind, children}) => {
  const map = {
    ok: {bg:'#e3f3e8', fg:'#1f6a3a', bd:'#7fbf9a', ico:'check'},
    warn: {bg:'#fef3d6', fg:'#7a5a0a', bd:'#e0b85a', ico:'warn'},
    err: {bg:'#fce1dc', fg:'#8a2a1a', bd:'#d07a6a', ico:'x'},
    info: {bg:'#e0ebf8', fg:'#2a4a7a', bd:'#8aa7cc', ico:'info'},
    pend: {bg:'#ece8e0', fg:'#5a4a2a', bd:'#b5a98f', ico:'clock'},
    accent: {bg:'var(--wf-accent-soft)', fg:WF.ink, bd:'var(--wf-accent)', ico:'bolt'},
  };
  const s = map[kind] || map.info;
  return (
    <span style={{display:'inline-flex', alignItems:'center', gap:4, fontFamily:WF.hand, fontSize:13, padding:'1px 8px', borderRadius:10, background:s.bg, color:s.fg, border:`1px solid ${s.bd}`}}>
      <Ico name={s.ico} size={10} color={s.fg}/>{children}
    </span>
  );
};

Object.assign(window, { WF, Row, Col, Sp, Scribble, Arrow, Ico, AppNav, Screen, StatusChip });
