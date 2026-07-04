# ARCHITECTURE TECHNIQUE - SIGMA MDX DEPLOY

## 📋 ANALYSE TECHNIQUE APPROFONDIE

### 1. COMPRÉHENSION DU SYSTÈME BAILEYS ACTUEL

#### 1.1 Système d'authentification Baileys
- **useMultiFileAuthState** : Gère les credentials WhatsApp dans un dossier
  - Structure : `{dossier}/creds.json` + `{dossier}/keys/`
  - `creds.json` : Informations de session (registered, me, account, etc.)
  - `keys/` : Clés de chiffrement par JID
  - **CRITIQUE** : Chaque instance doit avoir son propre dossier isolé

#### 1.2 Cycle de vie d'une session WhatsApp
1. **État initial** : `creds.registered === false`
2. **Génération pairing code** : `sock.requestPairingCode(number)`
   - Retourne un code à 8 chiffres
   - Code valide ~2 minutes
   - Nécessite que le socket soit connecté
3. **Appairage** : L'utilisateur entre le code dans WhatsApp
4. **Connexion** : `connection.update` avec `connection === "open"`
5. **Sauvegarde** : `creds.update` sauvegarde automatiquement via `saveCreds`
6. **Reconnexion** : Si `creds.registered === true`, reconnexion automatique

#### 1.3 Problèmes fréquents et solutions

**Problème 1 : Timeout du pairing code**
- **Cause** : Code expire après ~2 minutes
- **Solution** : Régénérer le code si timeout détecté

**Problème 2 : Numéro invalide**
- **Cause** : Format incorrect ou numéro inexistant
- **Solution** : Validation stricte du format international

**Problème 3 : Double appairage**
- **Cause** : Tentative d'appairage simultanée
- **Solution** : Lock par numéro pendant le processus d'appairage

**Problème 4 : Crash pendant appairage**
- **Cause** : Erreur réseau ou crash serveur
- **Solution** : Nettoyage automatique des sessions incomplètes

**Problème 5 : Collision de sessions**
- **Cause** : Partage du même dossier de session
- **Solution** : UUID unique par bot + isolation complète

---

## 🏗️ ARCHITECTURE MULTI-UTILISATEURS

### 2. STRUCTURE DES DOSSIERS

```
/sessions/                    # Toutes les sessions WhatsApp
  /bot_<UUID>/               # Une session par bot
    creds.json               # Credentials Baileys
    keys/                    # Clés de chiffrement
    metadata.json            # Métadonnées du bot (numéro, token, état, etc.)

/public/                     # Frontend statique
  /index.html               # Page d'appairage publique
  /dashboard.html           # Dashboard utilisateur
  /admin.html               # Dashboard admin
  /assets/                  # CSS, JS, images

/src/                       # Code backend
  /server.js                # Serveur Express principal
  /botManager.js            # Gestionnaire d'instances Baileys
  /sessionManager.js        # Gestion des sessions et tokens
  /websocket.js             # Gestion WebSocket pour pairing code
  /routes/                  # Routes Express
    /api.js                 # API REST
    /pairing.js             # Routes d'appairage
  /utils/                   # Utilitaires
    /validation.js          # Validation numéros
    /logger.js              # Logger personnalisé

/storage/                   # Stockage JSON
  /bots.json                # Registre de tous les bots
  /tokens.json              # Mapping token -> bot UUID
  /admin.json               # Configuration admin (si nécessaire)

/commands/                  # Commandes existantes (conservées)
```

### 3. ISOLATION DES SESSIONS

#### 3.1 Principe d'isolation
- **Un bot = Un UUID unique**
- **Un bot = Un dossier de session dédié**
- **Un bot = Une instance Baileys isolée**
- **Aucun partage de socket, mémoire ou état**

#### 3.2 Structure de session
```javascript
{
  uuid: "550e8400-e29b-41d4-a716-446655440000",
  phoneNumber: "237673941535",
  token: "abc123def456...",
  status: "pairing" | "connected" | "disconnected" | "error",
  createdAt: "2026-01-26T10:00:00Z",
  lastConnected: "2026-01-26T10:05:00Z",
  sessionPath: "./sessions/bot_550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 🔧 COMPOSANTS PRINCIPAUX

### 4. BOT MANAGER (`botManager.js`)

**Responsabilités** :
- Créer des instances Baileys isolées
- Gérer le cycle de vie (start/stop/restart)
- Gérer l'appairage WhatsApp
- Émettre des événements (pairing code, connexion, erreur)

**API** :
```javascript
class BotManager {
  async createBot(uuid, phoneNumber)     // Créer une nouvelle instance
  async startBot(uuid)                   // Démarrer un bot
  async stopBot(uuid)                    // Arrêter un bot
  async restartBot(uuid)                 // Redémarrer un bot
  async deleteBot(uuid)                  // Supprimer complètement un bot
  async getBotStatus(uuid)               // Obtenir l'état d'un bot
  async requestPairingCode(uuid)         // Générer un pairing code
}
```

**Isolation garantie** :
- Chaque bot utilise `useMultiFileAuthState` avec un chemin unique
- Chaque bot a son propre socket WebSocket Baileys
- Aucune variable globale partagée entre bots

### 5. SESSION MANAGER (`sessionManager.js`)

**Responsabilités** :
- Générer des UUID uniques
- Générer des tokens sécurisés
- Sauvegarder/charger les métadonnées
- Gérer le mapping token -> UUID

**Stockage** :
- `storage/bots.json` : Registre de tous les bots
- `storage/tokens.json` : Mapping token -> UUID

### 6. SERVEUR WEB (`server.js`)

**Stack** :
- Express.js pour les routes HTTP
- Socket.io pour WebSocket temps réel
- Serveur de fichiers statiques pour le frontend

**Routes principales** :
- `GET /` : Page d'appairage publique
- `POST /api/pairing/start` : Démarrer le processus d'appairage
- `GET /api/pairing/status/:uuid` : Statut d'appairage
- `GET /dashboard/:token` : Dashboard utilisateur
- `GET /admin` : Dashboard admin (avec authentification)
- `POST /api/bot/:token/start` : Démarrer le bot
- `POST /api/bot/:token/stop` : Arrêter le bot
- `POST /api/bot/:token/restart` : Redémarrer le bot
- `DELETE /api/bot/:token` : Supprimer le bot

**WebSocket** :
- Namespace `/pairing` : Événements d'appairage en temps réel
  - `pairing-code` : Nouveau pairing code généré
  - `pairing-success` : Appairage réussi
  - `pairing-error` : Erreur d'appairage
  - `connection-status` : Changement d'état de connexion

### 7. INTERFACE WEB

#### 7.1 Page d'appairage (`/public/index.html`)
- Champ de saisie : Numéro WhatsApp (format international)
- Bouton : "Générer le pairing code"
- Affichage dynamique :
  - Pairing code (grand, visible)
  - État (en attente, connecté, erreur)
  - Instructions WhatsApp
- Connexion WebSocket pour mise à jour temps réel

#### 7.2 Dashboard utilisateur (`/public/dashboard.html`)
- Accès via `/dashboard/:token`
- Affichage :
  - Numéro WhatsApp connecté
  - État du bot (connecté/déconnecté)
  - Token (pour partage)
- Actions :
  - Démarrer le bot
  - Arrêter le bot
  - Redémarrer le bot
  - Supprimer le bot (avec confirmation)
- WebSocket pour mise à jour temps réel de l'état

#### 7.3 Dashboard admin (`/public/admin.html`)
- Liste de tous les bots déployés
- Pour chaque bot :
  - Numéro WhatsApp
  - État
  - Token
  - Date de création
- Actions admin :
  - Stop (forcé)
  - Restart (forcé)
  - Delete (forcé)

---

## 🔐 SÉCURITÉ & ROBUSTESSE

### 8. PROTECTION CONTRE LES COLLISIONS

#### 8.1 Isolation des sessions
- UUID unique généré avec `crypto.randomUUID()`
- Vérification d'unicité avant création
- Lock par numéro pendant l'appairage

#### 8.2 Gestion des erreurs
- Try-catch autour de toutes les opérations Baileys
- Nettoyage automatique des sessions incomplètes
- Logging détaillé pour debugging

#### 8.3 Gestion des crashes
- Process manager pour redémarrer les bots en cas de crash
- Sauvegarde périodique des états
- Récupération automatique au redémarrage

### 9. GESTION DES TOKENS

- Token généré avec `crypto.randomBytes(32).toString('hex')`
- Stockage sécurisé dans `storage/tokens.json`
- Validation stricte sur toutes les routes protégées

---

## 📊 FLUX D'UTILISATION

### 10. PROCESSUS D'APPAIRAGE

1. **Utilisateur saisit son numéro** sur `/`
2. **POST /api/pairing/start** avec `{ phoneNumber: "..." }`
3. **Backend** :
   - Valide le numéro
   - Génère un UUID unique
   - Crée le dossier de session
   - Crée une instance Baileys
   - Génère le pairing code
4. **WebSocket** : Émet `pairing-code` avec le code
5. **Frontend** : Affiche le code en temps réel
6. **Utilisateur** : Entre le code dans WhatsApp
7. **Baileys** : Détecte la connexion, émet `connection.update`
8. **WebSocket** : Émet `pairing-success`
9. **Backend** : Génère un token unique
10. **Frontend** : Redirige vers `/dashboard/:token`

### 11. GESTION DU BOT

1. **Utilisateur accède** à `/dashboard/:token`
2. **Backend** : Valide le token, charge les métadonnées
3. **Frontend** : Affiche l'état et les actions
4. **Actions** : POST vers `/api/bot/:token/{action}`
5. **BotManager** : Exécute l'action (start/stop/restart/delete)
6. **WebSocket** : Met à jour l'état en temps réel

---

## 🚀 DÉPLOIEMENT

### 12. CONFIGURATION

**Variables d'environnement** :
```env
PORT=3000
NODE_ENV=production
ADMIN_PASSWORD=changeme123  # Pour l'accès admin
SESSION_TIMEOUT=120000      # Timeout pairing code (2 min)
```

### 13. DÉMARRAGE

```bash
npm install
npm start
```

Le serveur démarre sur `http://localhost:3000`

---

## 📝 NOTES IMPORTANTES

### 14. LIMITATIONS BAILEYS

- Un numéro WhatsApp ne peut être connecté qu'une seule fois
- Le pairing code expire après ~2 minutes
- Les reconnexions automatiques sont gérées par Baileys
- Les déconnexions forcées nécessitent un nouvel appairage

### 15. SCALABILITÉ

- Architecture conçue pour des centaines d'utilisateurs simultanés
- Isolation complète garantit qu'un bot ne peut pas affecter les autres
- Stockage local suffisant pour des milliers de bots
- Pour une scalabilité supérieure, migrer vers une base de données

---

## ✅ CHECKLIST DE VALIDATION

- [x] Analyse technique complète
- [x] Architecture détaillée
- [ ] Structure de dossiers créée
- [ ] BotManager implémenté
- [ ] SessionManager implémenté
- [ ] Serveur Express + WebSocket
- [ ] Interface web publique
- [ ] Dashboard utilisateur
- [ ] Dashboard admin
- [ ] Tests d'isolation
- [ ] Gestion des erreurs robuste
