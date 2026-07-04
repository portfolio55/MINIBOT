# 🚀 SIGMA MDX - Guide de Déploiement

## 🌐 Options de Déploiement

### 1. **Render** (Recommandé pour débutants)
- **Gratuit** avec Redis intégré
- **Support Node.js nativement**
- **HTTPS automatique**
- **Redémarrage automatique**

```bash
# Étapes :
1. Créez un compte sur https://render.com
2. Fork votre projet sur GitHub
3. Connectez Render à GitHub
4. Créez un "Web Service"
5. Configurez :
   - Build Command: npm install
   - Start Command: npm start
   - Instance Type: Free (512MB RAM)
```

### 2. **Replit** (Plus simple)
- **Gratuit** et très facile
- **IDE en ligne inclus**
- **Pas besoin de Git**

```bash
# Étapes :
1. Allez sur https://replit.com
2. Créez un "Repl" Node.js
3. Importez votre projet (ZIP ou Git)
4. Cliquez sur "Run"
```

### 3. **Heroku** (Classique)
- **Gratuit** (avec limites)
- **Add-ons disponibles**
- **Scaling facile**

```bash
# Étapes :
1. Installez Heroku CLI
2. heroku login
3. heroku create sigma-mdx-bot
4. git push heroku main
```

### 4. **VPS Personnel** (Plus de contrôle)
- **DigitalOcean** ($5/mois)
- **Vultr** ($3.5/mois)
- **AWS EC2** (Gratuit 12 mois)

## ⚙️ Configuration Requise

### Variables d'Environnement
```bash
PORT=3000
NODE_ENV=production
ADMIN_PASSWORD=votre_mot_de_passe_admin
PREFIXE=!
LOG_LEVEL=info
RECONNECT_DELAY=5000
```

### Modifications pour le déploiement

#### 1. **Créer `.env`**
```bash
# Dans le dossier racine
PORT=3000
NODE_ENV=production
ADMIN_PASSWORD=admin123
PREFIXE=!
LOG_LEVEL=info
RECONNECT_DELAY=5000
```

#### 2. **Modifier `package.json`**
```json
{
  "scripts": {
    "start": "node start.js",
    "build": "echo 'No build needed'"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

#### 3. **Ajouter `Procfile`** (Heroku)
```
web: npm start
```

#### 4. **Créer `Dockerfile`** (Optionnel)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔧 Optimisations pour le Déploiement

### 1. **Gestion de la mémoire**
```javascript
// Dans start.js
if (process.env.NODE_ENV === 'production') {
  process.setMaxListeners(20);
}
```

### 2. **Sécurité**
```javascript
// Dans server.js
app.use((req, res, next) => {
  if (req.path === '/health') {
    return res.status(200).send('OK');
  }
  next();
});
```

### 3. **Persistance des données**
```javascript
// Utiliser des dossiers persistants
const SESSION_DIR = process.env.RENDER ? '/app/data/sessions' : './sessions';
const STORAGE_DIR = process.env.RENDER ? '/app/data/storage' : './storage';
```

## 🚀 Déploiement Rapide (Render)

### Préparation
```bash
# 1. Créez un dépôt GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/votre-username/sigma-mdx.git
git push -u origin main
```

### Configuration Render
1. **Connectez Render à GitHub**
2. **Créez un Web Service**
3. **Paramètres :**
   - Name: sigma-mdx
   - Runtime: Node
   - Build Command: `npm install --legacy-peer-deps`
   - Start Command: `npm start`
   - Instance Type: Free

### Variables d'Environnement Render
```
PORT=3000
NODE_ENV=production
ADMIN_PASSWORD=votre_password
PREFIXE=!
```

## 📱 Accès au Bot Déployé

### URL d'accès
- **Interface web**: `https://sigma-mdx.onrender.com`
- **API**: `https://sigma-mdx.onrender.com/api`
- **Health check**: `https://sigma-mdx.onrender.com/health`

### WhatsApp Pairing
1. Accédez à l'interface web
2. Entrez votre numéro WhatsApp
3. Scannez le QR code ou entrez le code de pairage
4. Le bot se connectera automatiquement

## 🔄 Maintenance

### Monitoring
```bash
# Logs Render
heroku logs --tail --app sigma-mdx

# Health check
curl https://sigma-mdx.onrender.com/health
```

### Redémarrage automatique
```javascript
// Dans server.js
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});
```

## 💡 Conseils

1. **Test local d'abord** : Vérifiez que tout fonctionne en local
2. **Git propre** : Assurez-vous que `.gitignore` exclut `node_modules`
3. **Logs** : Activez les logs pour le debugging
4. **Backup** : Sauvegardez régulièrement vos sessions
5. **HTTPS** : Utilisez toujours HTTPS en production

## 🆘 Support

- **Render**: https://render.com/docs
- **Heroku**: https://devcenter.heroku.com
- **Replit**: https://docs.replit.com
- **Communauté**: Discord WhatsApp Bot Development

---

**⚠️ Important**: Testez toujours en local avant de déployer en production !
