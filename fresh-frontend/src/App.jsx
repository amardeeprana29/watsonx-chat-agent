import { useEffect, useRef, useState } from 'react'

async function fetchWithTimeout(url, opts={}){
  const { timeoutMs=8000, ...rest } = opts
  const ctrl = new AbortController()
  const id = setTimeout(()=>ctrl.abort(), timeoutMs)
  try{
    const res = await fetch(url, { ...rest, signal: ctrl.signal })
    clearTimeout(id)
    return res
  }catch(e){ clearTimeout(id); throw e }
}

export default function App(){
  const [msg, setMsg] = useState('')
  const [log, setLog] = useState([])
  const [hc, setHc] = useState('checking...')
  const [sending, setSending] = useState(false)
  const endRef = useRef(null)
  const inputRef = useRef(null)
  const [fullscreen, setFullscreen] = useState(true)
  const [theme, setTheme] = useState('light')
  const [lang, setLang] = useState('en')

  useEffect(()=>{(async()=>{
    try{
      const r = await fetchWithTimeout('/api/health', { timeoutMs: 3000 })
      const j = await r.json().catch(()=>({}))
      setHc(r.ok ? (j.ready ? 'ok' : `missing: ${j.missing?.join(',')||'unknown'}`) : `fail ${r.status}`)
    }catch(e){ setHc('unreachable') }
  })()},[])

  useEffect(()=>{ endRef.current?.scrollIntoView({ behavior:'smooth', block: 'end' }) }, [log])
  // Initialize theme from localStorage or OS preference
  useEffect(()=>{
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') { setTheme(saved) }
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) { setTheme('dark') }
    const savedLang = localStorage.getItem('lang')
    if (savedLang === 'en' || savedLang === 'hi' || savedLang === 'hinglish') setLang(savedLang)
  }, [])
  useEffect(()=>{ localStorage.setItem('theme', theme) }, [theme])
  useEffect(()=>{ localStorage.setItem('lang', lang) }, [lang])
  useEffect(()=>{
    const el = inputRef.current; if(!el) return;
    el.style.height = 'auto';
    const maxH = 320; // px
    el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
  }, [msg])

  const send = async()=>{
    const text = msg.trim(); if(!text) return;
    setMsg(''); setSending(true)
    setLog(l=>[...l, { from:'you', text } , { from:'bot', text:'Typing…', loading:true }])
    try{
  const r = await fetchWithTimeout('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ message: text, language: lang }), timeoutMs: 20000 })
  const data = await r.json().catch(()=>({}))
  if (!r.ok) console.warn('chat error', { status: r.status, data })
  if (data?.fallback) console.warn('fallback_reply', { method: data.method, details: data.details })
  const finalText = data?.reply || 'Sorry, abhi mujhe reply generate karne me dikkat ho rahi hai. 🙏'
  setLog(l=>{ const c=[...l]; c.pop(); return [...c, { from:'bot', text: finalText, error: !!data?.fallback, meta: { method: data?.method, usedModel: data?.usedModel } }] })
    }catch(e){
      console.error('chat network fail', e)
      setLog(l=>{ const c=[...l]; c.pop(); return [...c, { from:'bot', text:'Sorry, abhi mujhe reply generate karne me dikkat ho rahi hai. 🙏', error:true }] })
    }
    setSending(false)
  }

  return (
    <div className={`app ${fullscreen? 'fullscreen':''}`} data-theme={theme}>
      <div className="container">
        <div className="app-header">
          <div style={{display:'flex', alignItems:'baseline', gap:10}}>
            <div className="title">🤖 Watsonx Chat</div>
            <div className="health">
              <span className={`dot ${hc==='ok' ? 'ok' : (hc==='checking...' ? '' : 'bad')}`}></span>
              health: {hc}
            </div>
          </div>
          <div className="header-actions">
            <select className="chip select" value={lang} onChange={e=>setLang(e.target.value)}>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="hinglish">Hinglish</option>
            </select>
            <button className="chip" onClick={()=> setTheme(t => t==='dark' ? 'light' : 'dark')}>{theme==='dark' ? 'Light mode' : 'Dark mode'}</button>
            <button className="chip" onClick={()=>setFullscreen(f=>!f)}>{fullscreen? 'Exit full screen':'Full screen'}</button>
          </div>
        </div>
        <div className="card">
          <div className="chat-window">
            {log.length===0 && (
              <div className="placeholder">Start a conversation. Ask anything…</div>
            )}
            {log.map((m,i)=> (
              <div key={i} className={`row ${m.from}`}>
                {m.from==='bot' && <div className="avatar bot">AI</div>}
                <div className={`bubble ${m.from} ${m.loading? 'dim':''} ${m.error? 'error':''}`}>
                  {m.loading ? (
                    <span className="typing" aria-label="AI is typing">
                      <span className="dot-typing" />
                      <span className="dot-typing" />
                      <span className="dot-typing" />
                    </span>
                  ) : m.text}
                </div>
                {m.from==='you' && <div className="avatar you">YOU</div>}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="composer">
            <textarea
              ref={inputRef}
              className="input"
              value={msg}
              placeholder="Type your message… (Shift+Enter for new line)"
              onChange={e=>setMsg(e.target.value)}
              onKeyDown={e=>{
                if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); }
              }}
              rows={2}
            />
            <button className="btn" onClick={send} disabled={sending || !msg.trim()}>Send</button>
          </div>
        </div>
      </div>
    </div>
  )
}
