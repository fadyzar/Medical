import type { Metadata } from 'next'
import Link from 'next/link'
import HeroCarousel from './HeroCarousel'

export const metadata: Metadata = {
  title: 'טלמדיסן למרפאות — SaaS רפואי ישראלי',
  description: 'הקם קליניקה דיגיטלית תוך 24 שעות. ניהול תורים, וידאו HD, סיכומי AI, מיתוג אישי ותמיכה ישראלית. ניסיון חינם 14 ימים.',
  keywords: ['telemedicine saas', 'SaaS מרפאות', 'ניהול קליניקה דיגיטלית', 'טלמדיסן'],
  openGraph: {
    title: 'טלמדיסן למרפאות — הפלטפורמה שמכפילה הכנסות',
    description: 'הקם קליניקה דיגיטלית תוך 24 שעות.',
    type: 'website', locale: 'he_IL',
  },
}

// ── Icons ─────────────────────────────────────────────────────────

function Check({ c = '#34d399' }: { c?: string }) {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────

export default function ForClinicsPage() {
  return (
    <div className="min-h-screen" dir="rtl" style={{ background: '#07090f' }}>

      {/* ── NAV ── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between h-16 px-4 max-w-7xl mx-auto"
        dir="rtl"
      >
        <Link href="/" className="text-xl font-black text-white tracking-tight">טלמדיסן</Link>
        <div className="hidden md:flex items-center gap-7 text-sm" style={{ color: '#64748b' }}>
          <Link href="#features" className="hover:text-white transition-colors">פיצ׳רים</Link>
          <Link href="#pricing" className="hover:text-white transition-colors">מחירים</Link>
          <Link href="#compare" className="hover:text-white transition-colors">השוואה</Link>
          <Link href="/doctors" className="hover:text-white transition-colors">לרופאים</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-sm font-medium transition-colors hover:text-white" style={{ color: '#64748b' }}>התחברות</Link>
          <Link href="/auth/register?type=clinic"
            className="text-sm font-bold text-white px-5 py-2.5 rounded-lg transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}>
            14 ימי ניסיון חינם
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden" dir="rtl">
        {/* Mesh gradients */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute w-[600px] h-[600px] rounded-full blur-3xl"
            style={{ top: '-20%', right: '-10%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)' }} />
          <div className="absolute w-[400px] h-[400px] rounded-full blur-3xl"
            style={{ bottom: '-10%', left: '10%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)' }} />
        </div>
        {/* Grid */}
        <div className="pointer-events-none absolute inset-0"
          style={{
            opacity: 0.025,
            backgroundImage: ['linear-gradient(rgba(255,255,255,1) 1px, transparent 1px)', 'linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)'].join(', '),
            backgroundSize: '64px 64px',
          }} />

        {/* Hero headline section */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-0 text-center">
          {/* Social proof badge */}
          <div className="inline-flex items-center gap-2.5 mb-8 rounded-full border px-5 py-2.5 text-sm font-bold"
            style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.2)', color: '#93c5fd' }}>
            <div className="flex -space-x-1.5 rtl:space-x-reverse">
              {['#3b82f6','#10b981','#8b5cf6'].map((c, i) => (
                <div key={i} className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-white text-[8px] font-black"
                  style={{ background: c, borderColor: '#07090f' }}>מ</div>
              ))}
            </div>
            <span style={{ color: '#64748b' }}>|</span>
            <span>50+ מרפאות כבר פועלות על הפלטפורמה</span>
          </div>

          <h1 className="font-black text-white mx-auto"
            style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', lineHeight: '0.92', maxWidth: '900px', letterSpacing: '-0.02em' }}>
            הפלטפורמה שמכפילה<br />
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #60a5fa 0%, #818cf8 50%, #a78bfa 100%)' }}>
              הכנסות המרפאה שלך
            </span>
          </h1>

          <p className="mt-6 text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: '#94a3b8' }}>
            קליניקה דיגיטלית מלאה תוך 24 שעות — ייעוצי וידאו, AI שכותב תיעוד,
            ניהול תורים אוטומטי, ומיתוג אישי. בלי בזבוז זמן.
          </p>

          <div className="flex flex-wrap gap-4 justify-center mt-10 mb-16">
            <Link href="/auth/register?type=clinic"
              className="inline-flex items-center gap-2 text-white font-black px-10 py-5 rounded-2xl text-lg transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)', boxShadow: '0 8px 32px rgba(59,130,246,0.35)' }}>
              התחל ניסיון חינם — 14 יום
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
            </Link>
            <a href="#features"
              className="inline-flex items-center gap-2 font-bold px-10 py-5 rounded-2xl text-lg transition-all hover:scale-105"
              style={{ border: '1.5px solid rgba(255,255,255,0.15)', color: '#e2e8f0', background: 'rgba(255,255,255,0.05)' }}>
              ראה דמו חי ↓
            </a>
          </div>

          {/* Inline stats */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm pb-0" style={{ color: '#64748b' }}>
            {[
              { icon: '🔒', t: 'HIPAA & GDPR' },
              { icon: '⚡', t: 'הפעלה תוך 24ש׳' },
              { icon: '🇮🇱', t: 'תמיכה בעברית' },
              { icon: '💳', t: 'ביטול בכל עת' },
            ].map((b, i) => (
              <span key={i} className="flex items-center gap-1.5 font-medium">{b.icon} {b.t}</span>
            ))}
          </div>
        </div>

        {/* Carousel (features demo) */}
        <div id="features">
          <HeroCarousel />
        </div>
      </section>

      {/* ── ROI STRIP ── */}
      <div style={{ background: 'linear-gradient(135deg,#1e1b4b,#172554)', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { v: '+40%', l: 'הכנסות ממוצעות תוך 3 חודשים', c: '#34d399' },
            { v: '-3 שעות', l: 'פחות תיעוד ידני ביום', c: '#60a5fa' },
            { v: '0%', l: 'no-show עם תזכורות אוטומטיות', c: '#a78bfa' },
            { v: '× 2.4', l: 'תפוקת ייעוצים לרופא', c: '#fbbf24' },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-3xl font-black" style={{ color: s.c }}>{s.v}</p>
              <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#94a3b8' }}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES GRID ── */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0"
          style={{
            opacity: 0.02,
            backgroundImage: ['linear-gradient(rgba(255,255,255,1) 1px, transparent 1px)', 'linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)'].join(', '),
            backgroundSize: '64px 64px',
          }} />
        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-black tracking-widest uppercase px-4 py-2 rounded-full"
              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}>
              הכל כלול
            </span>
            <h2 className="font-black text-white mt-5 mb-3" style={{ fontSize: 'clamp(1.8rem,4vw,3rem)' }}>
              כל מה שמרפאה מודרנית צריכה
            </h2>
            <p className="text-lg" style={{ color: '#64748b' }}>פלטפורמה אחת — פתרון מלא</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                from: '#3b82f6', to: '#6366f1',
                icon: '📹',
                title: 'ייעוצי וידאו HD',
                desc: 'שיחות וידאו מוצפנות ויציבות. חדר המתנה דיגיטלי ובדיקת ציוד אוטומטית לפני כל ייעוץ.',
                points: ['LiveKit מוצפן', 'חדר המתנה', 'הקלטה אופציונלית'],
              },
              {
                from: '#8b5cf6', to: '#ec4899',
                icon: '🤖',
                title: 'AI — 4 סוכנים חכמים',
                desc: 'מיון, SOAP notes אוטומטיים, טיוטת מרשם ושאלון קליטה דינמי. שעות חיסכון ביום.',
                points: ['Triage agent', 'SOAP אוטומטי', 'טיוטת מרשם'],
                badge: '🔥 חם',
              },
              {
                from: '#10b981', to: '#0891b2',
                icon: '📅',
                title: 'ניהול תורים חכם',
                desc: 'מטופל בוחר מועד מהסלוטים הפנויים. הרופא מאשר או מציע חלופה. אפס ג\'אגלינג.',
                points: ['בחירת מועד עצמאית', 'אישור דיגיטלי', 'תזכורות WhatsApp'],
              },
              {
                from: '#f59e0b', to: '#ef4444',
                icon: '🎨',
                title: 'White-Label מלא',
                desc: 'לוגו, צבעים, subdomain ייחודיים. המטופלים רואים רק את שם המרפאה שלך.',
                points: ['Subdomain מותאם', 'צבעים ולוגו', 'דומיין אישי'],
              },
              {
                from: '#06b6d4', to: '#6366f1',
                icon: '📋',
                title: 'מסמכים דיגיטליים',
                desc: 'מרשמים, אישורי מחלה וסיכומים נשלחים ישירות למטופל. חתימה דיגיטלית מאובטחת.',
                points: ['מרשמים דיגיטליים', 'אישורי מחלה', 'חתימה מאובטחת'],
              },
              {
                from: '#84cc16', to: '#10b981',
                icon: '📊',
                title: 'דוחות ואנליטיקה',
                desc: 'הכנסות, זמני המתנה, AI usage, no-show rate. כל מה שצריך לקבל החלטות.',
                points: ['הכנסות בזמן אמת', 'AI usage tracking', 'No-show analytics'],
              },
            ].map((f, i) => (
              <div key={i} className="rounded-2xl p-6 group transition-all hover:-translate-y-1 hover:scale-[1.01] relative overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at top right, ${f.from}10, transparent 60%)` }} />
                <div className="absolute top-0 right-0 left-0 h-0.5 rounded-t-2xl"
                  style={{ background: `linear-gradient(90deg, ${f.from}, ${f.to})` }} />

                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: `${f.from}20`, border: `1px solid ${f.from}30` }}>
                      {f.icon}
                    </div>
                    {f.badge && (
                      <span className="text-xs font-black px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                        {f.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="font-black text-white text-lg mb-2">{f.title}</h3>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: '#64748b' }}>{f.desc}</p>
                  <div className="space-y-1.5">
                    {f.points.map(p => (
                      <div key={p} className="flex items-center gap-2">
                        <Check c={f.from} />
                        <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ── */}
      <section id="compare" className="py-24 px-4" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-black tracking-widest uppercase px-4 py-2 rounded-full"
              style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa' }}>
              למה טלמדיסן?
            </span>
            <h2 className="font-black text-white mt-5 mb-2" style={{ fontSize: 'clamp(1.8rem,4vw,3rem)' }}>
              בואו נשווה בכנות
            </h2>
            <p style={{ color: '#64748b' }}>מה שאחרים לא נותנים — אנחנו כן</p>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            {/* Header */}
            <div className="grid grid-cols-4 text-center text-xs font-black uppercase tracking-wide"
              style={{ background: '#1e293b', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="py-4 text-right px-6" style={{ color: '#475569' }}>פיצ׳ר</div>
              {[
                { name: 'טלמדיסן', from: '#3b82f6', to: '#4f46e5', highlight: true },
                { name: 'HiDoc', from: '#64748b', to: '#475569' },
                { name: 'ביקורופא', from: '#64748b', to: '#475569' },
              ].map((h, i) => (
                <div key={i} className="py-4 relative">
                  {h.highlight && (
                    <div className="absolute top-0 left-0 right-0 h-0.5"
                      style={{ background: `linear-gradient(90deg, ${h.from}, ${h.to})` }} />
                  )}
                  <span className="font-black" style={{ color: h.highlight ? '#e2e8f0' : '#475569' }}>{h.name}</span>
                  {h.highlight && (
                    <div className="text-[9px] mt-0.5 font-bold" style={{ color: '#60a5fa' }}>המומלץ</div>
                  )}
                </div>
              ))}
            </div>
            {/* Rows */}
            {[
              { f: 'White-Label מלא', vals: [true, false, false] },
              { f: 'AI SOAP notes', vals: [true, false, false] },
              { f: 'מרשמים דיגיטליים', vals: [true, true, false] },
              { f: 'ממשק עברית מלא', vals: [true, false, true] },
              { f: 'תורים + אישור רופא', vals: [true, true, true] },
              { f: 'Subdomain אישי', vals: [true, false, false] },
              { f: 'תמיכה ישראלית', vals: [true, false, false] },
              { f: 'ביטול בכל עת', vals: [true, false, false] },
            ].map((row, i) => (
              <div key={i} className="grid grid-cols-4 text-center text-sm items-center"
                style={{
                  borderBottom: i < 7 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}>
                <div className="py-3.5 px-6 text-right font-medium" style={{ color: '#94a3b8' }}>{row.f}</div>
                {row.vals.map((v, j) => (
                  <div key={j} className="py-3.5">
                    {v
                      ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-black"
                          style={{ background: j === 0 ? 'linear-gradient(135deg,#2563eb,#4f46e5)' : 'rgba(52,211,153,0.15)', color: j === 0 ? '#fff' : '#34d399' }}>
                          ✓
                        </span>
                      : <span className="text-slate-600">—</span>
                    }
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-black tracking-widest uppercase px-4 py-2 rounded-full"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
              תמחור
            </span>
            <h2 className="font-black text-white mt-5 mb-2" style={{ fontSize: 'clamp(1.8rem,4vw,3rem)' }}>
              מחיר פשוט, שקוף, ללא הפתעות
            </h2>
            <p style={{ color: '#64748b' }}>14 ימי ניסיון חינם בכל תוכנית · אין כרטיס אשראי</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Starter', price: '₪299', sub: 'לחודש',
                desc: 'למרפאה קטנה שמתחילה',
                from: '#3b82f6', to: '#6366f1',
                points: ['עד 2 רופאים', '100 ייעוצים/חודש', 'וידאו HD', 'מרשמים דיגיטליים', 'White-Label'],
                cta: 'התחל ניסיון',
              },
              {
                name: 'Pro', price: '₪799', sub: 'לחודש',
                desc: 'למרפאה מתפתחת עם AI',
                from: '#8b5cf6', to: '#ec4899',
                highlight: true,
                badge: 'הכי פופולרי',
                points: ['עד 10 רופאים', 'ייעוצים ללא הגבלה', 'AI — 4 סוכנים', 'אנליטיקה מלאה', 'תמיכה עדיפות'],
                cta: 'התחל ניסיון',
              },
              {
                name: 'Enterprise', price: 'צור קשר', sub: '',
                desc: 'לרשת מרפאות וארגונים',
                from: '#10b981', to: '#0891b2',
                points: ['רופאים ללא הגבלה', 'Multi-clinic', 'SLA מותאם', 'Dedicated support', 'API access'],
                cta: 'צור קשר',
              },
            ].map((plan, i) => (
              <div key={i} className="rounded-2xl p-7 relative overflow-hidden transition-all hover:-translate-y-1"
                style={{
                  background: plan.highlight ? `linear-gradient(160deg, ${plan.from}18, ${plan.to}10)` : 'rgba(255,255,255,0.03)',
                  border: plan.highlight ? `1px solid ${plan.from}50` : '1px solid rgba(255,255,255,0.07)',
                  boxShadow: plan.highlight ? `0 20px 60px ${plan.from}20` : 'none',
                }}>
                {plan.badge && (
                  <div className="absolute top-0 left-0 right-0 h-0.5"
                    style={{ background: `linear-gradient(90deg, ${plan.from}, ${plan.to})` }} />
                )}
                {plan.badge && (
                  <span className="absolute top-4 left-5 text-xs font-black px-3 py-1 rounded-full"
                    style={{ background: `${plan.from}25`, color: plan.from, border: `1px solid ${plan.from}40` }}>
                    {plan.badge}
                  </span>
                )}

                <h3 className="font-black text-white text-xl mb-1 mt-6">{plan.name}</h3>
                <p className="text-sm mb-5" style={{ color: '#64748b' }}>{plan.desc}</p>
                <div className="mb-6">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                  {plan.sub && <span className="text-sm mr-1" style={{ color: '#64748b' }}>{plan.sub}</span>}
                </div>
                <Link href={plan.price === 'צור קשר' ? '/contact' : '/auth/register?type=clinic'}
                  className="block text-center font-black py-3.5 rounded-xl mb-6 text-white transition-all hover:scale-105 text-sm"
                  style={{
                    background: plan.highlight
                      ? `linear-gradient(135deg, ${plan.from}, ${plan.to})`
                      : 'rgba(255,255,255,0.08)',
                    boxShadow: plan.highlight ? `0 8px 24px ${plan.from}40` : 'none',
                  }}>
                  {plan.cta}
                </Link>
                <div className="space-y-2.5">
                  {plan.points.map(p => (
                    <div key={p} className="flex items-center gap-2.5">
                      <Check c={plan.from} />
                      <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-24 px-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-black tracking-widest uppercase px-4 py-2 rounded-full"
              style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
              לקוחות מרוצים
            </span>
            <h2 className="font-black text-white mt-5 mb-2" style={{ fontSize: 'clamp(1.8rem,4vw,3rem)' }}>
              מה אומרות המרפאות שלנו
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'ד"ר שרה לוי', role: 'מנהלת מרפאת השרון', text: 'הכנסות עלו ב-45% תוך חודשיים. הרופאים שלי חסכו שעתיים ביום על תיעוד. ה-AI פשוט עושה את העבודה.',
                from: '#3b82f6', to: '#6366f1', stars: 5,
              },
              {
                name: 'ד"ר אמיר כהן', role: 'קליניקת כרמל', text: 'הייתי סקפטי בהתחלה. אחרי שבוע — לא מבין איך עבדתי בלי. המטופלים מגיעים לשיחה עם שאלון מלא ו-AI מיון כבר.',
                from: '#8b5cf6', to: '#ec4899', stars: 5,
              },
              {
                name: 'נדב ברק', role: 'מנכ"ל רשת רפואה פרטית', text: 'ניהלנו 3 מרפאות עם 3 מערכות שונות. היום — מערכת אחת, לוח שלים, תמיכה מדהימה. ממליץ בחום לכל רשת.',
                from: '#10b981', to: '#0891b2', stars: 5,
              },
            ].map((t, i) => (
              <div key={i} className="rounded-2xl p-6 relative overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-5"
                  style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }} />
                <div className="flex gap-0.5 mb-4">
                  {[...Array(t.stars)].map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-6" style={{ color: '#94a3b8' }}>&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black"
                    style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{t.name}</p>
                    <p className="text-xs" style={{ color: '#475569' }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 px-4" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-black text-white" style={{ fontSize: 'clamp(1.8rem,4vw,3rem)' }}>שאלות נפוצות</h2>
          </div>
          <div className="space-y-4">
            {[
              { q: 'כמה זמן לוקחת ההפעלה?', a: 'פחות מ-24 שעות. אחרי הרשמה, צוות התמיכה שלנו מגדיר את הסביבה, מעלה את הלוגו והצבעים שלך, ומכשיר את הרופאים.' },
              { q: 'האם ה-AI בוחר עבור הרופא?', a: 'לא. ה-AI מסכם, מציג ומציע — אבל הרופא מאשר הכל. לא ניתן לשמור סיכום ללא אישור הרופא.' },
              { q: 'מה קורה עם נתוני המטופלים?', a: 'הנתונים מוצפנים AES-256, מאוחסנים בישראל, ועומדים בדרישות HIPAA ו-GDPR. אתה הבעלים של הנתונים.' },
              { q: 'האם ניתן לבטל בכל עת?', a: 'כן. אין חוזים, אין קנסות. מבטל — המנוי נגמר בסוף התקופה הנוכחית ואתה מקבל ייצוא מלא של הנתונים.' },
              { q: 'מה כלול בתמיכה?', a: 'שיחה, מייל ו-WhatsApp. זמן תגובה ממוצע של 2 שעות בשעות העסקים. בפרו ומעלה — SLA מוגדר.' },
            ].map((faq, i) => (
              <div key={i} className="rounded-2xl p-6"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="font-black text-white mb-2">{faq.q}</p>
                <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute w-[500px] h-[500px] rounded-full blur-3xl"
            style={{ top: '-20%', right: '-10%', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)' }} />
          <div className="absolute w-[400px] h-[400px] rounded-full blur-3xl"
            style={{ bottom: '-10%', left: '0%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)' }} />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2.5 mb-8 rounded-full border px-5 py-2.5 text-sm font-bold"
            style={{ background: 'rgba(52,211,153,0.08)', borderColor: 'rgba(52,211,153,0.2)', color: '#6ee7b7' }}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
            </span>
            מגדירים קליניקות חדשות כל שבוע
          </div>
          <h2 className="font-black text-white mb-5"
            style={{ fontSize: 'clamp(2rem,5vw,3.75rem)', lineHeight: '0.95' }}>
            מוכן לקחת את<br />
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #60a5fa, #818cf8, #a78bfa)' }}>
              המרפאה קדימה?
            </span>
          </h2>
          <p className="text-xl mb-10" style={{ color: '#94a3b8' }}>
            14 ימי ניסיון חינם. ללא כרטיס אשראי. הפעלה תוך 24 שעות.
          </p>
          <div className="flex flex-wrap gap-4 justify-center mb-8">
            <Link href="/auth/register?type=clinic"
              className="inline-flex items-center gap-2 text-white font-black px-10 py-5 rounded-2xl text-lg transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)', boxShadow: '0 8px 32px rgba(59,130,246,0.4)' }}>
              התחל ניסיון חינם — 14 יום
            </Link>
            <Link href="/contact"
              className="inline-flex items-center gap-2 font-bold px-10 py-5 rounded-2xl text-lg transition-all hover:scale-105"
              style={{ border: '1.5px solid rgba(255,255,255,0.15)', color: '#e2e8f0', background: 'rgba(255,255,255,0.05)' }}>
              דבר עם המכירות
            </Link>
          </div>
          <p className="text-sm" style={{ color: '#334155' }}>
            ביטול בכל עת · HIPAA &amp; GDPR · תמיכה בעברית
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-14 px-4" style={{ background: '#020408', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm mb-10" style={{ color: '#334155' }}>
            <div>
              <h5 className="font-black text-white text-xl mb-3">טלמדיסן</h5>
              <p className="leading-relaxed" style={{ color: '#475569' }}>פלטפורמת ייעוץ רפואי אונליין — SaaS White-Label לישראל.</p>
            </div>
            <div>
              <h5 className="font-bold text-white mb-3">פלטפורמה</h5>
              <div className="space-y-2">
                {['#features:פיצ׳רים', '#pricing:מחירים', '#compare:השוואה', '/for-clinics:למרפאות'].map(l => {
                  const [href, label] = l.split(':')
                  return <p key={href}><a href={href} className="hover:text-white transition-colors">{label}</a></p>
                })}
              </div>
            </div>
            <div>
              <h5 className="font-bold text-white mb-3">לרופאים</h5>
              <div className="space-y-2">
                {['/doctors:הרופאים שלנו', '/auth/register?type=doctor:הצטרף כרופא', '/blog:בלוג', '/auth/login:התחברות'].map(l => {
                  const [href, label] = l.split(':')
                  return <p key={href}><Link href={href} className="hover:text-white transition-colors">{label}</Link></p>
                })}
              </div>
            </div>
            <div>
              <h5 className="font-bold text-white mb-3">משפטי</h5>
              <div className="space-y-2">
                {['/terms:תנאי שימוש', '/privacy:מדיניות פרטיות', '/accessibility:נגישות', '/cookies:עוגיות'].map(l => {
                  const [href, label] = l.split(':')
                  return <p key={href}><Link href={href} className="hover:text-white transition-colors">{label}</Link></p>
                })}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs pt-8"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: '#1e293b' }}>
            <span style={{ color: '#334155' }}>&copy; {new Date().getFullYear()} טלמדיסן. כל הזכויות שמורות.</span>
            <span style={{ color: '#475569' }}>נבנה ב NFD — Next Flow Digital</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
