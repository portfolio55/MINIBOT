# SIGMA MDX DEPLOY - Plateforme Multi-Utilisateurs

## 🚀 Installation

1. **Installer les dépendances** :
```bash
npm install
```

2. **Configurer l'environnement** :
```bash
cp .env.example .env
# Éditez .env et changez le mot de passe admin
```

3. **Démarrer le serveur** :
```bash
npm start
```

Le serveur sera accessible sur `http://localhost:3000`

## 📋 Utilisation

### Pour les utilisateurs

1. Accédez à `http://localhost:3000`
2. Entrez votre numéro WhatsApp (format international, ex: 237673941535)
3. Cliquez sur "Générer le code d'appairage"
4. Suivez les instructions pour appairer votre WhatsApp
5. Après connexion, vous recevrez un token unique
6. Accédez à votre dashboard via `/dashboard/:token`

### Pour l'administrateur

1. Accédez à `http://localhost:3000/admin`
2. Entrez le mot de passe admin (configuré dans `.env`)
3. Visualisez tous les bots déployés
4. Gérez les bots (start/stop/restart/delete)

## 🏗️ Architecture

- **Backend** : Express.js + Socket.io
- **Bot Framework** : Baileys (@whiskeysockets/baileys)
- **Stockage** : Fichiers JSON locaux
- **Sessions** : Isolation complète par UUID

## 📁 Structure

```
/sessions/          # Sessions WhatsApp isolées (une par bot)
/storage/           # Métadonnées et tokens (JSON)
/public/            # Interface web
/src/               # Code backend
  /botManager.js    # Gestionnaire d'instances Baileys
  /sessionManager.js # Gestion des sessions et tokens
  /server.js        # Serveur Express principal
```

## 🔐 Sécurité

- Chaque bot a un token unique
- Isolation complète des sessions
- Mot de passe admin requis pour le panneau admin
- Validation stricte des numéros WhatsApp

## ⚙️ Configuration

Voir `.env.example` pour toutes les options de configuration.

## 🐛 Dépannage

### Le pairing code ne s'affiche pas
- Vérifiez que le numéro est au format international
- Attendez quelques secondes (génération asynchrone)
- Vérifiez les logs du serveur

### Le bot ne se connecte pas
- Vérifiez que le code d'appairage n'a pas expiré
- Réessayez avec un nouveau code
- Vérifiez les logs pour plus de détails

### Erreur "Bot existe déjà"
- Un bot est déjà connecté pour ce numéro
- Utilisez le token existant pour accéder au dashboard

## 📝 Notes

- Les sessions sont stockées localement dans `/sessions/`
- Les métadonnées sont dans `/storage/`
- Un redémarrage du serveur ne supprime pas les sessions
- Chaque bot fonctionne de manière totalement indépendante

## 🔄 Migration depuis l'ancien système

L'ancien fichier `index.js` est conservé et peut être utilisé avec `npm run start:legacy` pour le mode mono-utilisateur.

Pour migrer vers le nouveau système :
1. Les sessions existantes dans `./session/` ne sont pas compatibles
2. Créez de nouveaux bots via l'interface web
3. Les commandes existantes dans `/commands/` sont automatiquement chargées
