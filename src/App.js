import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import './App.css';

const BREVET_DATE = new Date('2026-06-25');
const BAC_DATE = new Date('2026-06-17');
const daysUntilExam = (type) => {
  const date = type?.startsWith('bac') ? BAC_DATE : BREVET_DATE;
  return Math.max(0, Math.ceil((date - new Date()) / 86400000));
};

const MAKE_WEBHOOK = 'https://hook.eu1.make.com/74j2nhcm32rvyrvajiuvsuow9shohhqy';
const STRIPE_BREVET = 'https://buy.stripe.com/9B6fZgbpr4DH2LB1Fo33W01';
const STRIPE_BAC = 'https://buy.stripe.com/28E00i8dffil99Z0Bk33W02';

const buildQuizPrompt = (matiere, chapitre, typeExamen = 'brevet') => {
  const niveaux = {
    brevet: 'élève de 3e préparant le Brevet des collèges',
    bac_general: 'lycéen de Terminale préparant le Baccalauréat Général',
    bac_techno: 'lycéen de Terminale préparant le Baccalauréat Technologique',
    bac_pro: 'lycéen de Terminale préparant le Baccalauréat Professionnel',
  };
  const niveau = niveaux[typeExamen] || niveaux.brevet;
  return `Tu es un professeur expert. Génère exactement 10 questions de quiz sur "${chapitre}" en ${matiere} pour un ${niveau}. Respecte le programme officiel de l'Éducation nationale française.

RÈGLES STRICTES :
- Mix de QCM (une seule bonne réponse) et QCM multiple (plusieurs bonnes réponses)
- Réponds UNIQUEMENT en JSON valide, sans texte avant ou après

FORMAT JSON EXACT :
{
  "questions": [
    {
      "id": 1,
      "type": "single",
      "question": "texte de la question",
      "options": ["option A", "option B", "option C", "option D"],
      "correct": [0],
      "explication": "explication courte"
    }
  ]
}

Pour type single : correct contient UN seul index.
Pour type multiple : correct contient PLUSIEURS index.
Génère exactement 10 questions variées et adaptées au niveau.`;
};

const buildPrompt = (mode, matiere, chapitre, typeExamen = 'brevet') => {
  const niveaux = {
    brevet: 'élève de 3e préparant le Brevet des collèges',
    bac_general: 'lycéen de Terminale préparant le Baccalauréat Général',
    bac_techno: 'lycéen de Terminale préparant le Baccalauréat Technologique',
    bac_pro: 'lycéen de Terminale préparant le Baccalauréat Professionnel',
  };
  const niveau = niveaux[typeExamen] || niveaux.brevet;
  const base = `Tu es un professeur expert pour préparer les examens en France. Réponds en français, de façon claire et adaptée à un ${niveau}. Respecte strictement le programme officiel de l'Éducation nationale française.`;
  if (mode === 'Fiche de cours') return `${base}\nGénère une fiche de révision sur "${chapitre}" en ${matiere}.\nStructure :\n🎯 L'essentiel à retenir (3-5 points clés)\n📚 Explication détaillée\n💡 Astuce mémo\n⚠️ Erreur classique à éviter`;
  if (mode === 'Exercice guidé') return `${base}\nCrée un exercice progressif sur "${chapitre}" en ${matiere}.\nFormat : 📝 Énoncé / Étape 1 / Étape 2 / Étape 3 / 🎯 Solution complète`;
};

const S = {
  app: { maxWidth: 430, margin: '0 auto', minHeight: '100vh', background: '#080812', color: '#F0F0FF', fontFamily: "'Outfit', sans-serif", position: 'relative' },
  statusBar: { background: '#080812', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', fontSize: 12, color: 'rgba(255,255,255,0.5)', flexShrink: 0 },
  screen: { height: 'calc(100vh - 44px)', overflowY: 'auto', paddingBottom: 80 },
  btn: (bg = '#00F5A0', color = '#080812') => ({ background: bg, color, border: 'none', borderRadius: 14, padding: '14px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%', fontFamily: "'Outfit', sans-serif" }),
  backBtn: { background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, padding: '8px 14px', color: '#F0F0FF', cursor: 'pointer', fontSize: 13, fontFamily: "'Outfit', sans-serif", marginBottom: 16 },
  card: (bg = '#12121F') => ({ background: bg, borderRadius: 18, padding: '16px 18px', border: '1px solid rgba(255,255,255,0.07)' }),
  input: { background: '#12121F', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '14px 16px', color: '#F0F0FF', fontSize: 15, width: '100%', fontFamily: "'Outfit', sans-serif", outline: 'none' },
  label: { fontSize: 12, color: '#64748B', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, display: 'block' },
};

const Logo = ({ size = 32 }) => (
  <span style={{ fontFamily: "'Unbounded', sans-serif", fontWeight: 900, fontSize: size }}>
    <span style={{ color: '#00F5A0' }}>P</span><span style={{ color: '#F0F0FF' }}>ass</span><span style={{ color: '#00F5A0' }}>I</span><span style={{ color: '#F0F0FF' }}>t</span>
  </span>
);

// ── AUTH ─────────────────────────────────────────────────────
const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [prenom, setPrenom] = useState('');
  const [isLogin, setIsLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [minor, setMinor] = useState(false);
  const [parentEmail, setParentEmail] = useState('');
  const [typeExamen, setTypeExamen] = useState('brevet');
  const [filiereBac, setFiliereBac] = useState('bac_general');
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!email) return setError('Adresse email requise');
    if (!password) return setError('Mot de passe requis');
    if (!isLogin && password.length < 8) return setError('Mot de passe trop court (8 caractères minimum)');
    if (!isLogin && password !== confirmPassword) return setError('Les mots de passe ne correspondent pas');
    if (!isLogin && !prenom) return setError('Prénom requis');
    if (!isLogin && !consent) return setError('Tu dois accepter les CGU');
    setLoading(true);
    try {
      if (isLogin) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email: email.toLowerCase(), password });
        if (signInErr) throw signInErr;
      } else {
        const { error: signUpErr } = await supabase.auth.signUp({ email: email.toLowerCase(), password });
        if (signUpErr) throw signUpErr;
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 3);
        const { error: upsertErr } = await supabase.from('users').upsert({
          email: email.toLowerCase(),
          prenom,
          date_inscription: new Date().toISOString(),
          trial_end: trialEnd.toISOString(),
          statut: 'trial',
          consentement_rgpd: consent,
          type_examen: typeExamen === 'bac' ? filiereBac : 'brevet',
        }, { onConflict: 'email', ignoreDuplicates: true });
        if (upsertErr) throw upsertErr;
        if (parentEmail) {
          await supabase.from('parents_emails').upsert({
            user_email: email.toLowerCase(), parent_email: parentEmail.toLowerCase(), actif: true
          }, { onConflict: 'user_email' });
        }
        await fetch(MAKE_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'inscription', email: email.toLowerCase(), prenom }),
        });
      }
    } catch (e) {
      const msg = e.message || 'Une erreur est survenue';
      if (msg.includes('Invalid login credentials')) setError('Email ou mot de passe incorrect');
      else if (msg.includes('already registered')) setError('Cet email est déjà utilisé');
      else setError(msg);
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) return setError('Entre ton email pour réinitialiser ton mot de passe');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setError(error.message);
    else setResetSent(true);
    setLoading(false);
  };

  if (resetSent) return (
    <div style={S.app}>
      <div style={{ ...S.screen, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 24 }}>📬</div>
        <Logo size={28} />
        <div style={{ marginTop: 24, fontSize: 20, fontWeight: 700 }}>Email envoyé !</div>
        <div style={{ marginTop: 12, color: '#64748B', fontSize: 15, lineHeight: 1.6 }}>Vérifie ta boîte mail pour réinitialiser ton mot de passe.</div>
        <button style={{ ...S.btn('rgba(255,255,255,0.06)', '#F0F0FF'), marginTop: 32, width: 'auto', padding: '12px 24px' }} onClick={() => setResetSent(false)}>← Retour</button>
      </div>
    </div>
  );

  return (
    <div style={S.app}>
      <div style={{ ...S.screen, padding: '0 24px', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', padding: '48px 0 32px' }}>
          <Logo size={42} />
          <div style={{ marginTop: 12, color: '#64748B', fontSize: 14 }}>L'app de révision propulsée par l'IA</div>
          <div style={{ marginTop: 20, background: 'linear-gradient(135deg, #7B2FFF20, #00F5A015)', border: '1px solid #00F5A030', borderRadius: 14, padding: '10px 20px', display: 'inline-block' }}>
            <span style={{ color: '#00F5A0', fontSize: 13, fontWeight: 600 }}>✓ 3 jours gratuits · Sans CB</span>
          </div>
        </div>
        <div style={{ display: 'flex', background: '#12121F', borderRadius: 12, padding: 4, marginBottom: 24 }}>
          {['Inscription', 'Connexion'].map((t, i) => (
            <button key={t} onClick={() => { setIsLogin(i === 1); setError(''); }} style={{ flex: 1, background: isLogin === (i === 1) ? '#00F5A0' : 'transparent', color: isLogin === (i === 1) ? '#080812' : '#64748B', border: 'none', borderRadius: 9, padding: '10px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isLogin && <div><label style={S.label}>Prénom</label><input style={S.input} placeholder="Ton prénom" value={prenom} onChange={e => setPrenom(e.target.value)} /></div>}
          <div><label style={S.label}>Email</label><input style={S.input} placeholder="ton@email.com" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div><label style={S.label}>Mot de passe</label><input style={S.input} placeholder={isLogin ? 'Ton mot de passe' : '8 caractères minimum'} type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
          {!isLogin && <div><label style={S.label}>Confirmer le mot de passe</label><input style={S.input} placeholder="Répète ton mot de passe" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></div>}
          {!isLogin && (
            <>
              <div>
                <label style={S.label}>Je prépare</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  {[{ id: 'brevet', label: '🎓 Brevet' }, { id: 'bac', label: '📚 Bac' }].map(({ id, label }) => (
                    <button key={id} type="button" onClick={() => setTypeExamen(id)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${typeExamen === id ? '#00F5A0' : 'rgba(255,255,255,0.1)'}`, background: typeExamen === id ? '#00F5A015' : 'transparent', color: typeExamen === id ? '#00F5A0' : '#64748B', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>{label}</button>
                  ))}
                </div>
                {typeExamen === 'bac' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={S.label}>Ma filière</label>
                    {[{ id: 'bac_general', label: '🎯 Bac Général' }, { id: 'bac_techno', label: '⚙️ Bac Technologique' }, { id: 'bac_pro', label: '🔧 Bac Professionnel' }].map(({ id, label }) => (
                      <button key={id} type="button" onClick={() => setFiliereBac(id)} style={{ padding: '10px', borderRadius: 10, border: `2px solid ${filiereBac === id ? '#00F5A0' : 'rgba(255,255,255,0.1)'}`, background: filiereBac === id ? '#00F5A015' : 'transparent', color: filiereBac === id ? '#00F5A0' : '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit', sans-serif", textAlign: 'left' }}>{label}</button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label style={S.label}>Email d'un parent (optionnel)</label>
                <input style={S.input} placeholder="parent@email.com" type="email" value={parentEmail} onChange={e => setParentEmail(e.target.value)} />
                <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>Pour recevoir le rapport quotidien de progression</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3, accentColor: '#00F5A0', width: 16, height: 16 }} />
                  <span style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>J'accepte les <span style={{ color: '#00F5A0' }}>CGU</span> et la <span style={{ color: '#00F5A0' }}>Politique de confidentialité</span></span>
                </label>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={minor} onChange={e => setMinor(e.target.checked)} style={{ marginTop: 3, accentColor: '#00F5A0', width: 16, height: 16 }} />
                  <span style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>Si mineur(e) : j'ai l'accord de mes parents</span>
                </label>
              </div>
            </>
          )}
          {error && <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', color: '#991B1B', fontSize: 13 }}>⚠️ {error}</div>}
          <button style={S.btn()} onClick={handleSubmit} disabled={loading}>
            {loading ? '...' : isLogin ? '🔓 Se connecter' : '🚀 Démarrer 3 jours gratuits'}
          </button>
          {isLogin && <button style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 13, cursor: 'pointer', textAlign: 'center', marginTop: 4 }} onClick={handleForgotPassword}>Mot de passe oublié ?</button>}
        </div>
        <div style={{ textAlign: 'center', marginTop: 32, color: '#334155', fontSize: 12, lineHeight: 1.6, paddingBottom: 32 }}>🔒 Sans publicité · Sans données revendues · Conforme RGPD</div>
      </div>
    </div>
  );
};

// ── PAYWALL ──────────────────────────────────────────────────
const PaywallScreen = ({ user, onLogout }) => (
  <div style={S.app}>
    <div style={{ ...S.screen, padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Logo size={28} />
      <div style={{ marginTop: 24, fontSize: 22, fontWeight: 700, textAlign: 'center' }}>Ton essai gratuit est terminé</div>
      <div style={{ marginTop: 8, color: '#64748B', textAlign: 'center', fontSize: 14 }}>Choisis une formule pour continuer</div>
      <div style={{ width: '100%', marginTop: 32 }}>
        <div style={{ ...S.card(), border: '1px solid #00F5A030' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.type_examen?.startsWith('bac') ? '📚 Bac' : '🎓 Brevet'}</div>
              <div style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>Jusqu'à l'examen</div>
            </div>
            <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 18, fontWeight: 900, color: '#00F5A0' }}>5€</div>
          </div>
          <a href={user?.type_examen?.startsWith('bac') ? STRIPE_BAC : STRIPE_BREVET} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', background: '#00F5A0', color: '#080812', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            Choisir cette formule →
          </a>
        </div>
      </div>
      <div style={{ marginTop: 24, color: '#334155', fontSize: 12, textAlign: 'center' }}>🔒 Paiement sécurisé par Stripe</div>
      <button style={{ marginTop: 20, background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 13 }} onClick={onLogout}>Se déconnecter</button>
    </div>
  </div>
);

// ── QUIZ ─────────────────────────────────────────────────────
const QuizScreen = ({ matiere, chapitre, onBack, userEmail, typeExamen = 'brevet' }) => {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => { loadQuiz(); }, []);

  const loadQuiz = async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: buildQuizPrompt(matiere.nom, chapitre.titre, typeExamen) }),
      });
      const data = await response.json();
      const cleaned = data.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      setQuestions(parsed.questions || []);
    } catch (e) { setError('Erreur de génération du quiz. Réessaie.'); }
    setLoading(false);
  };

  const toggleAnswer = (qId, optIndex) => {
    if (submitted) return;
    const q = questions.find(q => q.id === qId);
    setAnswers(prev => {
      const current = prev[qId] || [];
      if (q.type === 'single') return { ...prev, [qId]: [optIndex] };
      return current.includes(optIndex) ? { ...prev, [qId]: current.filter(i => i !== optIndex) } : { ...prev, [qId]: [...current, optIndex] };
    });
  };

  const handleSubmit = async () => {
    let correct = 0;
    questions.forEach(q => {
      const userAns = (answers[q.id] || []).sort().join(',');
      const rightAns = [...q.correct].sort().join(',');
      if (userAns === rightAns) correct++;
    });
    const pct = Math.round((correct / questions.length) * 100);
    setScore(correct); setSubmitted(true);
    await supabase.from('quiz_results').insert({
      user_email: userEmail, matiere: matiere.nom, chapitre: chapitre.titre,
      score: correct, total_questions: questions.length, pourcentage: pct,
      questions: questions.map(q => ({
        question: q.question, correct: q.correct, user_answer: answers[q.id] || [],
        is_correct: (answers[q.id] || []).sort().join(',') === [...q.correct].sort().join(','),
        explication: q.explication,
      })),
      date_quiz: new Date().toISOString(),
    });
  };

  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${matiere.couleur_hex}30`, borderTop: `3px solid ${matiere.couleur_hex}`, animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
      <div style={{ color: '#64748B' }}>Génération du quiz en cours…</div>
    </div>
  );

  if (error) return (
    <div style={{ padding: 20 }}>
      <button style={S.backBtn} onClick={onBack}>← Retour</button>
      <div style={{ background: '#FEF2F2', borderRadius: 12, padding: 16, color: '#991B1B' }}>{error}</div>
      <button style={{ ...S.btn(), marginTop: 16 }} onClick={loadQuiz}>Réessayer</button>
    </div>
  );

  if (submitted) return (
    <div style={{ padding: '0 16px 24px' }}>
      <div style={{ background: matiere.couleur_hex + 'CC', padding: '20px 20px 24px', margin: '0 -16px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{pct >= 80 ? '🎉' : pct >= 50 ? '💪' : '📚'}</div>
        <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 42, fontWeight: 900, color: '#fff' }}>{pct}%</div>
        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, marginTop: 4 }}>{score} / {questions.length} bonnes réponses</div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>{matiere.emoji} {chapitre.titre}</div>
      </div>
      <div style={{ marginBottom: 16, padding: '12px 16px', background: '#12121F', borderRadius: 14, fontSize: 13, color: '#94A3B8', textAlign: 'center' }}>
        {pct >= 80 ? '🌟 Excellent ! Tu maîtrises ce chapitre.' : pct >= 50 ? '👍 Pas mal ! Quelques notions à revoir.' : '📖 Continue à réviser ce chapitre !'}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Correction détaillée</div>
      {questions.map((q, qi) => {
        const userAns = answers[q.id] || [];
        const isCorrect = userAns.sort().join(',') === [...q.correct].sort().join(',');
        return (
          <div key={q.id} style={{ ...S.card(isCorrect ? '#0D2A1A' : '#2A0D0D'), marginBottom: 12, border: `1px solid ${isCorrect ? '#10B98130' : '#EF444430'}` }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>{isCorrect ? '✅' : '❌'}</span>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F0FF', flex: 1 }}>Q{qi + 1}. {q.question}</div>
            </div>
            {q.options.map((opt, oi) => {
              const isRight = q.correct.includes(oi);
              const wasChosen = userAns.includes(oi);
              let bg = 'transparent', color = '#64748B', prefix = '';
              if (isRight) { bg = '#10B98115'; color = '#10B981'; prefix = '✓ '; }
              if (wasChosen && !isRight) { bg = '#EF444415'; color = '#EF4444'; prefix = '✗ '; }
              return (
                <div key={oi} style={{ padding: '6px 10px', borderRadius: 8, marginBottom: 4, background: bg }}>
                  <span style={{ fontSize: 12, color, fontWeight: isRight || wasChosen ? 600 : 400 }}>{prefix}{opt}</span>
                </div>
              );
            })}
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, fontSize: 12, color: '#94A3B8', lineHeight: 1.5 }}>💡 {q.explication}</div>
          </div>
        );
      })}
      <button style={{ ...S.btn(), marginTop: 8 }} onClick={onBack}>← Retour aux modes</button>
      <button style={{ ...S.btn('#12121F', '#F0F0FF'), marginTop: 10, border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => { setSubmitted(false); setAnswers({}); loadQuiz(); }}>🔄 Nouveau quiz</button>
    </div>
  );

  return (
    <div style={{ padding: '0 16px 24px' }}>
      <div style={{ background: matiere.couleur_hex + 'CC', padding: '16px 20px 20px', margin: '0 -16px 20px' }}>
        <button style={S.backBtn} onClick={onBack}>← Retour</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{matiere.emoji} {chapitre.titre}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>❓ Quiz — 10 questions</div>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{Object.keys(answers).length}/{questions.length} répondues</div>
        </div>
        <div style={{ marginTop: 10, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }}>
          <div style={{ height: '100%', borderRadius: 2, background: '#fff', width: `${(Object.keys(answers).length / questions.length) * 100}%`, transition: 'width 0.3s' }} />
        </div>
      </div>
      {questions.map((q, qi) => (
        <div key={q.id} style={{ ...S.card(), marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <span style={{ background: matiere.couleur_hex + '25', color: matiere.couleur_hex, borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 800, flexShrink: 0, height: 'fit-content' }}>Q{qi + 1}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F0F0FF', lineHeight: 1.5 }}>{q.question}</div>
              {q.type === 'multiple' && <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>Plusieurs réponses possibles</div>}
            </div>
          </div>
          {q.options.map((opt, oi) => {
            const selected = (answers[q.id] || []).includes(oi);
            return (
              <button key={oi} onClick={() => toggleAnswer(q.id, oi)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: selected ? matiere.couleur_hex + '15' : 'rgba(255,255,255,0.03)', border: `1.5px solid ${selected ? matiere.couleur_hex : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, padding: '10px 12px', marginBottom: 8, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 16, height: 16, borderRadius: q.type === 'multiple' ? 4 : '50%', border: `2px solid ${selected ? matiere.couleur_hex : '#334155'}`, background: selected ? matiere.couleur_hex : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selected && <span style={{ fontSize: 9, color: '#080812', fontWeight: 900 }}>✓</span>}
                </div>
                <span style={{ fontSize: 13, color: selected ? '#F0F0FF' : '#94A3B8', fontWeight: selected ? 600 : 400 }}>{opt}</span>
              </button>
            );
          })}
        </div>
      ))}
      <button style={{ ...S.btn(), opacity: Object.keys(answers).length === questions.length ? 1 : 0.5 }} onClick={handleSubmit} disabled={Object.keys(answers).length !== questions.length}>
        {Object.keys(answers).length === questions.length ? '✅ Voir mes résultats' : `Réponds à toutes les questions (${Object.keys(answers).length}/${questions.length})`}
      </button>
    </div>
  );
};

// ── CONTENU IA ───────────────────────────────────────────────
const ContentScreen = ({ matiere, chapitre, mode, onBack, typeExamen = 'brevet' }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => { generateContent(); }, []);

  const generateContent = async () => {
    setContent(''); setLoading(true); setError(null);
    const cacheKey = `${mode}_${matiere.nom}_${chapitre.titre}`.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const { data: cached } = await supabase.from('cache_ia').select('contenu_ia').eq('cle_cache', cacheKey).single();
    if (cached?.contenu_ia) { setContent(cached.contenu_ia); setLoading(false); return; }
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: buildPrompt(mode, matiere.nom, chapitre.titre, typeExamen) }),
      });
      const data = await response.json();
      const text = data.text || '';
      setContent(text); setLoading(false);
      if (text) await supabase.from('cache_ia').insert({ cle_cache: cacheKey, mode, contenu_ia: text, nb_reutilisations: 1 });
    } catch (e) { setError('Erreur de génération. Vérifie ta connexion.'); setLoading(false); }
  };

  const modeIcons = { 'Fiche de cours': '📚', 'Exercice guidé': '✏️' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 44px)' }}>
      <div style={{ background: matiere.couleur_hex + 'CC', padding: '16px 20px 20px', flexShrink: 0 }}>
        <button style={S.backBtn} onClick={onBack}>← Retour</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{modeIcons[mode]}</span>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{matiere.emoji} {chapitre.titre}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{mode}</div>
          </div>
        </div>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loading && <div style={{ textAlign: 'center', padding: '40px 0' }}><div style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${matiere.couleur_hex}30`, borderTop: `3px solid ${matiere.couleur_hex}`, animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} /><div style={{ color: '#64748B' }}>L'IA prépare ton contenu…</div></div>}
        {error && <div style={{ background: '#FEF2F2', borderRadius: 12, padding: 14, color: '#991B1B' }}>{error}</div>}
        {content && <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.8, color: '#E2E8F0' }}>{content}</div>}
      </div>
    </div>
  );
};

// ── HOME ─────────────────────────────────────────────────────
const HomeScreen = ({ user, matieres, onSelectMatiere }) => {
  const trialEnd = user?.trial_end ? new Date(user.trial_end) : null;
  const trialDays = trialEnd ? Math.max(0, Math.ceil((trialEnd - new Date()) / 86400000)) : 0;
  const examLabel = user?.type_examen?.startsWith('bac') ? 'le Bac' : 'le Brevet';
  return (
    <div style={{ paddingBottom: 16 }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1830 0%, #080812 100%)', padding: '24px 20px 28px' }}>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 4 }}>Bonjour {user?.prenom || ''} 👋</div>
        <Logo size={28} />
        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <div style={{ ...S.card('#0A0A18'), flex: 1, textAlign: 'center', border: '1px solid #7B2FFF30' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#00F5A0', fontFamily: "'Unbounded', sans-serif" }}>{daysUntilExam(user?.type_examen)}</div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>jours avant<br />{examLabel}</div>
          </div>
          {user?.statut === 'trial' && (
            <div style={{ ...S.card('#0A0A18'), flex: 1, textAlign: 'center', border: '1px solid #00F5A030' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#FCD34D', fontFamily: "'Unbounded', sans-serif" }}>{trialDays}</div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>jours<br />d'essai restants</div>
            </div>
          )}
          {user?.statut === 'premium' && (
            <div style={{ ...S.card('#0A0A18'), flex: 1, textAlign: 'center', border: '1px solid #00F5A030' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>✅</div>
              <div style={{ fontSize: 11, color: '#00F5A0', fontWeight: 700 }}>Accès<br />Premium</div>
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Choisir une matière</div>
        {matieres.map(m => (
          <button key={m.id} onClick={() => onSelectMatiere(m)} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#12121F', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', width: '100%', marginBottom: 10 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: m.couleur_hex + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{m.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F0FF', fontFamily: "'Unbounded', sans-serif" }}>{m.nom}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>5 chapitres</div>
            </div>
            <div style={{ color: '#334155', fontSize: 20 }}>›</div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ── CHAPITRES ────────────────────────────────────────────────
const ChapitresScreen = ({ matiere, chapitres, onSelect, onBack }) => (
  <div>
    <div style={{ background: matiere.couleur_hex + 'CC', padding: '20px 20px 24px' }}>
      <button style={S.backBtn} onClick={onBack}>← Retour</button>
      <div style={{ fontSize: 32 }}>{matiere.emoji}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginTop: 6, fontFamily: "'Unbounded', sans-serif" }}>{matiere.nom}</div>
    </div>
    <div style={{ padding: '20px 16px' }}>
      {chapitres.map((ch, i) => (
        <button key={ch.id} onClick={() => onSelect(ch)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: '#12121F', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px 16px', marginBottom: 8, cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: matiere.couleur_hex + '25', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: matiere.couleur_hex, fontFamily: "'Unbounded', sans-serif", flexShrink: 0 }}>{i + 1}</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#F0F0FF' }}>{ch.titre}</span>
          <span style={{ marginLeft: 'auto', color: '#334155', fontSize: 18 }}>›</span>
        </button>
      ))}
    </div>
  </div>
);

// ── MODE ─────────────────────────────────────────────────────
const ModeScreen = ({ matiere, chapitre, onSelect, onBack }) => (
  <div>
    <div style={{ background: matiere.couleur_hex + 'CC', padding: '20px 20px 24px' }}>
      <button style={S.backBtn} onClick={onBack}>← Retour</button>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>{matiere.emoji} {matiere.nom}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'Unbounded', sans-serif" }}>{chapitre.titre}</div>
    </div>
    <div style={{ padding: '20px 16px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Comment réviser ?</div>
      {[
        { mode: 'Fiche de cours', emoji: '📚', desc: "L'essentiel du chapitre, clair et structuré", color: '#3B82F6' },
        { mode: 'Quiz', emoji: '❓', desc: '10 questions · Correction à la fin', color: '#EC4899' },
        { mode: 'Exercice guidé', emoji: '✏️', desc: 'Un exercice pas à pas avec corrigé', color: '#10B981' },
      ].map(({ mode, emoji, desc, color }) => (
        <button key={mode} onClick={() => onSelect(mode)} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, width: '100%', background: '#12121F', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px', marginBottom: 10, cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>{emoji}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F0FF', fontFamily: "'Unbounded', sans-serif" }}>{mode}</div>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>{desc}</div>
          </div>
        </button>
      ))}
    </div>
  </div>
);

// ── CGU ──────────────────────────────────────────────────────
const CGUScreen = ({ onBack }) => (
  <div style={S.app}>
    <div style={{ ...S.screen, padding: '0 0 32px' }}>
      <div style={{ background: '#12121F', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <button style={S.backBtn} onClick={onBack}>← Retour</button>
        <Logo size={22} />
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>Conditions Générales d'Utilisation</div>
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Version 1.0 — 2026</div>
      </div>
      <div style={{ padding: '20px', fontSize: 13, color: '#94A3B8', lineHeight: 1.8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0FF', marginBottom: 8, marginTop: 16 }}>Article 1 — Éditeur</div>
        <p>PassIt est édité par Optimeo Agency. Contact : contact@passit.fr</p>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0FF', marginBottom: 8, marginTop: 20 }}>Article 2 — Acceptation des CGU</div>
        <p>L'utilisation de PassIt implique l'acceptation pleine et entière des présentes CGU. Pour les utilisateurs mineurs de moins de 15 ans, le consentement parental est requis.</p>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0FF', marginBottom: 8, marginTop: 20 }}>Article 3 — Description du service</div>
        <p>PassIt propose des fiches de cours, quiz et exercices générés par IA pour préparer le Brevet et le Baccalauréat. Le contenu ne remplace pas l'enseignement scolaire.</p>
        <div style={{ background: '#FEF2F220', borderRadius: 10, padding: '12px 14px', marginTop: 10, border: '1px solid #EF444430' }}>
          <span style={{ color: '#EF4444', fontWeight: 600, fontSize: 12 }}>PassIt n'est pas un outil de triche. Toute utilisation pendant un examen est interdite.</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0FF', marginBottom: 8, marginTop: 20 }}>Article 4 — Essai gratuit</div>
        <p>3 jours d'accès complet offerts à l'inscription. Un seul essai par adresse email.</p>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0FF', marginBottom: 8, marginTop: 20 }}>Article 5 — Tarifs</div>
        <p>Brevet ou Bac : 5€ jusqu'à l'examen. Paiement unique sécurisé par Stripe.</p>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0FF', marginBottom: 8, marginTop: 20 }}>Article 6 — Résiliation</div>
        <p>Suppression du compte possible à tout moment depuis le Profil.</p>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0FF', marginBottom: 8, marginTop: 20 }}>Article 7 — Droit applicable</div>
        <p>Droit français. Contact : contact@passit.fr</p>
        <div style={{ marginTop: 24, padding: '14px', background: '#12121F', borderRadius: 12, fontSize: 12, color: '#475569', textAlign: 'center' }}>Optimeo Agency · CGU v1.0 · 2026</div>
      </div>
    </div>
  </div>
);

// ── RGPD ─────────────────────────────────────────────────────
const RGPDScreen = ({ onBack }) => (
  <div style={S.app}>
    <div style={{ ...S.screen, padding: '0 0 32px' }}>
      <div style={{ background: '#12121F', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <button style={S.backBtn} onClick={onBack}>← Retour</button>
        <Logo size={22} />
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>Politique de confidentialité</div>
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Version 1.0 — 2026 · Conforme RGPD</div>
      </div>
      <div style={{ padding: '20px', fontSize: 13, color: '#94A3B8', lineHeight: 1.8 }}>
        <div style={{ background: '#00F5A010', border: '1px solid #00F5A030', borderRadius: 12, padding: '14px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#00F5A0', marginBottom: 6 }}>Résumé simple</div>
          <p style={{ fontSize: 12 }}>PassIt collecte uniquement email et prénom. Aucune donnée bancaire. Aucune pub. Suppression possible à tout moment.</p>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0FF', marginBottom: 8 }}>Article 1 — Responsable</div>
        <p>Optimeo Agency · privacy@passit.fr</p>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0FF', marginBottom: 8, marginTop: 20 }}>Article 2 — Données collectées</div>
        <p>Email, prénom, progression quiz, consentement RGPD, ID Stripe (audit comptable uniquement).</p>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0FF', marginBottom: 8, marginTop: 20 }}>Article 3 — Protection des mineurs</div>
        <p>Consentement parental requis pour les moins de 15 ans. Aucun profilage commercial.</p>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0FF', marginBottom: 8, marginTop: 20 }}>Article 4 — Tes droits</div>
        <p>Accès, rectification, effacement, portabilité. Contact : privacy@passit.fr — Réponse sous 30 jours.</p>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0FF', marginBottom: 8, marginTop: 20 }}>Article 5 — Cookies</div>
        <p>Cookie de session uniquement. Aucun cookie publicitaire.</p>
        <div style={{ marginTop: 24, padding: '14px', background: '#12121F', borderRadius: 12, fontSize: 12, color: '#475569', textAlign: 'center' }}>Conforme RGPD (UE) 2016/679 · Optimeo Agency · 2026</div>
      </div>
    </div>
  </div>
);

// ── RESET PASSWORD ───────────────────────────────────────────
const ResetPasswordScreen = ({ onDone }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    setError('');
    if (!password) return setError('Mot de passe requis');
    if (password.length < 8) return setError('8 caractères minimum');
    if (password !== confirmPassword) return setError('Les mots de passe ne correspondent pas');
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else setSuccess(true);
    setLoading(false);
  };

  if (success) return (
    <div style={S.app}>
      <div style={{ ...S.screen, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 24 }}>✅</div>
        <Logo size={28} />
        <div style={{ marginTop: 24, fontSize: 20, fontWeight: 700 }}>Mot de passe modifié !</div>
        <div style={{ marginTop: 12, color: '#64748B', fontSize: 15 }}>Tu peux maintenant te connecter.</div>
        <button style={{ ...S.btn(), marginTop: 32 }} onClick={onDone}>Se connecter →</button>
      </div>
    </div>
  );

  return (
    <div style={S.app}>
      <div style={{ ...S.screen, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Logo size={32} />
          <div style={{ marginTop: 12, fontSize: 18, fontWeight: 700 }}>Nouveau mot de passe</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={S.label}>Nouveau mot de passe</label><input style={S.input} placeholder="8 caractères minimum" type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
          <div><label style={S.label}>Confirmer</label><input style={S.input} placeholder="Répète ton mot de passe" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></div>
          {error && <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', color: '#991B1B', fontSize: 13 }}>⚠️ {error}</div>}
          <button style={S.btn()} onClick={handleReset} disabled={loading}>{loading ? '...' : '🔒 Modifier mon mot de passe'}</button>
        </div>
      </div>
    </div>
  );
};

// ── PROFIL ───────────────────────────────────────────────────
const ProfilScreen = ({ user, onLogout, onShowCGU, onShowRGPD }) => {
  const statusColors = { trial: '#378ADD', premium: '#10B981', expired: '#EF4444' };
  const statusLabels = { trial: 'Essai gratuit', premium: 'Premium ✅', expired: 'Expiré' };
  const examLabels = { brevet: 'Brevet des collèges', bac_general: 'Bac Général', bac_techno: 'Bac Technologique', bac_pro: 'Bac Professionnel' };
  return (
    <div style={{ padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}><Logo size={22} /><div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>Mon profil</div></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={S.card()}>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 14, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Compte</div>
          {[['👤 Prénom', user?.prenom], ['📧 Email', user?.email], ['🎓 Examen', examLabels[user?.type_examen] || 'Brevet'], ['📅 Inscrit le', user?.date_inscription ? new Date(user.date_inscription).toLocaleDateString('fr-FR') : '—']].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: 13, color: '#64748B' }}>{label}</span>
              <span style={{ fontSize: 13, color: '#F0F0FF', fontWeight: 500 }}>{value || '—'}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748B' }}>📊 Statut</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: statusColors[user?.statut], background: (statusColors[user?.statut] || '#64748B') + '20', padding: '4px 12px', borderRadius: 20 }}>{statusLabels[user?.statut] || '—'}</span>
          </div>
        </div>
        {user?.statut !== 'premium' && (
          <div style={{ ...S.card(), border: '1px solid #00F5A030' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>🚀 Passer à Premium</div>
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 14 }}>Accès illimité jusqu'à l'examen pour 5€</div>
            <a href={user?.type_examen?.startsWith('bac') ? STRIPE_BAC : STRIPE_BREVET} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', background: '#00F5A0', color: '#080812', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>S'abonner →</a>
          </div>
        )}
        <div style={S.card()}>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 14, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Légal</div>
          <div onClick={() => onShowCGU()} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>CGU →</div>
          <div onClick={() => onShowRGPD()} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>Politique de confidentialité →</div>
          <div style={{ padding: '10px 0', fontSize: 13, color: '#EF4444', cursor: 'pointer' }}>Supprimer mon compte →</div>
        </div>
        <button style={{ ...S.btn('rgba(255,255,255,0.06)', '#F0F0FF'), marginTop: 8 }} onClick={onLogout}>Se déconnecter</button>
      </div>
    </div>
  );
};

// ── NAV ──────────────────────────────────────────────────────
const NavBar = ({ active, onChange }) => (
  <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, background: '#0A0A18', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', padding: '8px 0 20px', zIndex: 100 }}>
    {[{ id: 'home', emoji: '🏠', label: 'Accueil' }, { id: 'profil', emoji: '👤', label: 'Profil' }].map(tab => (
      <button key={tab.id} onClick={() => onChange(tab.id)} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 0' }}>
        <span style={{ fontSize: 22 }}>{tab.emoji}</span>
        <span style={{ fontSize: 11, fontWeight: active === tab.id ? 700 : 400, color: active === tab.id ? '#00F5A0' : '#475569' }}>{tab.label}</span>
        {active === tab.id && <div style={{ width: 18, height: 3, borderRadius: 2, background: '#00F5A0' }} />}
      </button>
    ))}
  </div>
);

// ── APP ──────────────────────────────────────────────────────
export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [matieres, setMatieres] = useState([]);
  const [chapitres, setChapitres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('home');
  const [selectedMatiere, setSelectedMatiere] = useState(null);
  const [selectedChapitre, setSelectedChapitre] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);
  const [showCGU, setShowCGU] = useState(false);
  const [showRGPD, setShowRGPD] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      if (session?.user) loadUserData(session.user.email);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      if (session?.user) loadUserData(session.user.email);
      else { setDbUser(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (email) => {
    setLoading(true);
    const { data: user } = await supabase.from('users').select('*').eq('email', email).single();
    const typeExamen = user?.type_examen || 'brevet';
    const [{ data: mats }, { data: chaps }] = await Promise.all([
      supabase.from('matieres').select('*').eq('actif', true).eq('type_examen', typeExamen).order('ordre'),
      supabase.from('chapitres').select('*').eq('actif', true).order('ordre'),
    ]);
    setDbUser(user); setMatieres(mats || []); setChapitres(chaps || []);
    setLoading(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setAuthUser(null); setDbUser(null); };
  const hasAccess = dbUser?.statut === 'trial' || dbUser?.statut === 'premium';
  const filteredChapitres = selectedMatiere ? chapitres.filter(c => c.matiere_id === selectedMatiere.id) : [];

  if (loading) return <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ textAlign: 'center' }}><Logo size={32} /><div style={{ marginTop: 20, color: '#334155' }}>Chargement…</div></div></div>;
  if (!authUser) return <AuthScreen />;

  const isResetPassword = window.location.pathname === '/reset-password' || window.location.hash.includes('type=recovery');
  if (isResetPassword && authUser) return <ResetPasswordScreen onDone={() => { window.history.pushState({}, '', '/'); window.location.reload(); }} />;

  if (showCGU) return <CGUScreen onBack={() => setShowCGU(false)} />;
  if (showRGPD) return <RGPDScreen onBack={() => setShowRGPD(false)} />;
  if (!hasAccess) return <PaywallScreen user={dbUser} onLogout={handleLogout} />;

  return (
    <div style={S.app}>
      <div style={S.statusBar}><span>9:41</span><span>●●● 🔋</span></div>
      <div style={S.screen}>
        {!selectedMatiere && tab === 'home' && <HomeScreen user={dbUser} matieres={matieres} onSelectMatiere={m => { setSelectedMatiere(m); setSelectedChapitre(null); setSelectedMode(null); }} />}
        {selectedMatiere && !selectedChapitre && <ChapitresScreen matiere={selectedMatiere} chapitres={filteredChapitres} onSelect={ch => setSelectedChapitre(ch)} onBack={() => setSelectedMatiere(null)} />}
        {selectedMatiere && selectedChapitre && !selectedMode && <ModeScreen matiere={selectedMatiere} chapitre={selectedChapitre} onSelect={m => setSelectedMode(m)} onBack={() => setSelectedChapitre(null)} />}
        {selectedMatiere && selectedChapitre && selectedMode === 'Quiz' && <QuizScreen matiere={selectedMatiere} chapitre={selectedChapitre} onBack={() => setSelectedMode(null)} userEmail={dbUser?.email} typeExamen={dbUser?.type_examen || 'brevet'} />}
        {selectedMatiere && selectedChapitre && selectedMode && selectedMode !== 'Quiz' && <ContentScreen matiere={selectedMatiere} chapitre={selectedChapitre} mode={selectedMode} onBack={() => setSelectedMode(null)} typeExamen={dbUser?.type_examen || 'brevet'} />}
        {tab === 'profil' && !selectedMatiere && <ProfilScreen user={dbUser} onLogout={handleLogout} onShowCGU={() => setShowCGU(true)} onShowRGPD={() => setShowRGPD(true)} />}
      </div>
      {!selectedMatiere && <NavBar active={tab} onChange={t => setTab(t)} />}
    </div>
  );
}
