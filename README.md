# 🚀 PassIt — Guide de déploiement

## Structure du projet
```
passit-app/
├── public/
│   ├── index.html
│   └── manifest.json
├── src/
│   ├── App.js          ← L'app complète
│   ├── App.css         ← Les styles
│   ├── index.js        ← Point d'entrée
│   └── supabaseClient.js ← Connexion Supabase
├── package.json
├── vercel.json
└── README.md
```

---

## Étape 1 — Préparer le code sur GitHub

1. Va sur **github.com** → clique **"New repository"**
2. Nom : `passit-app`
3. Laisse tout par défaut → clique **"Create repository"**
4. GitHub affiche une page vide avec des instructions
5. Sur cette page, clique sur **"uploading an existing file"**
6. Glisse-dépose **tous les fichiers du dossier passit-app** dans la zone
7. Clique **"Commit changes"** → ton code est en ligne ✅

---

## Étape 2 — Déployer sur Vercel

1. Va sur **vercel.com** → connecte-toi avec GitHub
2. Clique **"Add New Project"**
3. Sélectionne le repo `passit-app`
4. Clique **"Configure Project"**

### Variables d'environnement à ajouter ⚠️ (IMPORTANT)

Dans la section **"Environment Variables"**, ajoute ces 3 variables :

| Nom | Valeur |
|---|---|
| `REACT_APP_SUPABASE_URL` | Ton API URL Supabase (ex: https://xxx.supabase.co) |
| `REACT_APP_SUPABASE_ANON_KEY` | Ta clé anon/public Supabase |
| `REACT_APP_ANTHROPIC_KEY` | Ta clé API Anthropic (sk-ant-...) |

5. Clique **"Deploy"** → Vercel build et déploie automatiquement
6. Dans 2-3 minutes, ton app est en ligne sur **passit-app.vercel.app** ✅

---

## Étape 3 — Configurer les liens Stripe

Dans le fichier `src/App.js`, remplace les 3 liens Stripe :

```js
// Ligne ~130 — PaywallScreen
brevet: 'https://buy.stripe.com/REMPLACER_BREVET',
vacances: 'https://buy.stripe.com/REMPLACER_VACANCES',
annuel: 'https://buy.stripe.com/REMPLACER_ANNUEL',

// Ligne ~220 — ProfilScreen
href="https://buy.stripe.com/REMPLACER_BREVET"
```

Après modification → re-upload sur GitHub → Vercel redéploie automatiquement.

---

## Étape 4 — Configurer Supabase Auth

Dans Supabase → **Authentication → URL Configuration** :

- **Site URL** : `https://passit-app.vercel.app`
- **Redirect URLs** : `https://passit-app.vercel.app`

---

## Étape 5 — Adapter les scénarios Make

Dans chaque scénario Make, remplace les modules **Airtable** par des modules **HTTP** :

**Pour lire/écrire dans Supabase depuis Make :**

```
URL : https://TON_API_URL.supabase.co/rest/v1/NOM_TABLE
Headers :
  apikey: TA_ANON_KEY
  Authorization: Bearer TA_ANON_KEY
  Content-Type: application/json
  Prefer: return=representation
```

**Créer un user (POST) :**
```
Method : POST
URL : .../rest/v1/users
Body : {"email":"...","prenom":"...","statut":"trial",...}
```

**Mettre à jour un user (PATCH) :**
```
Method : PATCH
URL : .../rest/v1/users?email=eq.EMAIL_USER
Body : {"statut":"premium"}
```

**Chercher un user (GET) :**
```
Method : GET
URL : .../rest/v1/users?email=eq.EMAIL_USER&select=*
```

---

## 🎉 C'est tout !

Ton app PassIt est maintenant :
- ✅ En ligne sur passit-app.vercel.app
- ✅ Installable comme PWA sur mobile (iOS + Android)
- ✅ Connectée à Supabase (base de données)
- ✅ Avec authentification par magic link
- ✅ Avec génération IA par Claude
- ✅ Avec contrôle d'accès (trial / premium / expired)
- ✅ Avec paywall Stripe intégré
