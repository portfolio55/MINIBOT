# Guide de Déploiement - SIGMA MDX DEPLOY

## ✅ Checklist de Déploiement

### 1. Prérequis
- [ ] Node.js >= 21.0.0 installé
- [ ] npm installé
- [ ] Accès au terminal/SSH sur le serveur

### 2. Installation

```bash
# Cloner ou télécharger le projet
cd knut

# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env

# Éditer .env et configurer :
# - PORT (par défaut 3000)
# - ADMIN_PASSWORD (changez-le !)
# - Autres options selon vos besoins
```

### 3. Configuration

Éditez `.env` :
```env
PORT=3000
ADMIN_PASSWORD=votre_mot_de_passe_securise
NODE_ENV=production
LOG_LEVEL=info
```

### 4. Démarrage

```bash
# Mode production
npm start

# Mode développement (avec auto-reload)
npm run dev
```

### 5. Accès

- **Interface publique** : `http://votre-serveur:3000`
- **Dashboard admin** : `http://votre-serveur:3000/admin`
- **Dashboard utilisateur** : `http://votre-serveur:3000/dashboard/:token`

## 🔒 Sécurité

### Recommandations

1. **Changez le mot de passe admin** immédiatement
2. **Utilisez HTTPS** en production (reverse proxy avec nginx/caddy)
3. **Restreignez l'accès** au panneau admin (firewall/IP whitelist)
4. **Sauvegardez régulièrement** le dossier `/sessions/` et `/storage/`
5. **Surveillez les logs** pour détecter les activités suspectes

### Configuration HTTPS avec Nginx

```nginx
server {
    listen 443 ssl;
    server_name votre-domaine.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📊 Monitoring

### Logs

Les logs sont affichés dans la console. Pour les sauvegarder :

```bash
npm start > logs/app.log 2>&1
```

### Vérification de l'état

- Vérifiez que le serveur répond : `curl http://localhost:3000`
- Vérifiez les bots actifs via le panneau admin
- Surveillez l'utilisation disque (sessions peuvent être volumineuses)

## 🐛 Dépannage

### Le serveur ne démarre pas

1. Vérifiez que le port n'est pas déjà utilisé
2. Vérifiez les logs d'erreur
3. Vérifiez que toutes les dépendances sont installées

### Les bots ne se connectent pas

1. Vérifiez les logs du BotManager
2. Vérifiez que les numéros sont au bon format
3. Vérifiez la connexion internet du serveur
4. Vérifiez que WhatsApp n'a pas bloqué l'appairage

### Erreurs de permissions

```bash
# Donnez les permissions d'écriture aux dossiers
chmod -R 755 sessions/
chmod -R 755 storage/
```

## 🔄 Mise à jour

```bash
# Sauvegarder les sessions et storage
cp -r sessions/ sessions_backup/
cp -r storage/ storage_backup/

# Mettre à jour le code
git pull  # ou télécharger la nouvelle version

# Réinstaller les dépendances si nécessaire
npm install

# Redémarrer
npm start
```

## 📦 Sauvegarde

### Fichiers à sauvegarder

- `/sessions/` : Toutes les sessions WhatsApp (CRITIQUE)
- `/storage/` : Tokens et métadonnées (CRITIQUE)
- `.env` : Configuration (sans le mot de passe en clair)

### Script de sauvegarde automatique

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"

mkdir -p $BACKUP_DIR

tar -czf $BACKUP_DIR/sessions_$DATE.tar.gz sessions/
tar -czf $BACKUP_DIR/storage_$DATE.tar.gz storage/

# Garder seulement les 7 derniers backups
ls -t $BACKUP_DIR/sessions_*.tar.gz | tail -n +8 | xargs rm -f
ls -t $BACKUP_DIR/storage_*.tar.gz | tail -n +8 | xargs rm -f
```

Ajoutez dans crontab :
```bash
0 2 * * * /path/to/backup.sh
```

## 🚀 Performance

### Optimisations

1. **Limitez le nombre de bots simultanés** si nécessaire
2. **Surveillez l'utilisation mémoire** (chaque bot consomme ~50-100MB)
3. **Nettoyez les sessions inactives** régulièrement
4. **Utilisez un SSD** pour de meilleures performances I/O

### Scaling

Pour des centaines de bots :
- Considérez une base de données (MongoDB/PostgreSQL) au lieu de JSON
- Utilisez un load balancer pour plusieurs instances
- Implémentez un système de queue pour les messages

## 📞 Support

En cas de problème :
1. Vérifiez les logs
2. Consultez `ARCHITECTURE.md` pour comprendre le système
3. Vérifiez `README_DEPLOY.md` pour les instructions de base
