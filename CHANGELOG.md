# CHANGELOG - Améliorations SIGMA MDX DEPLOY

## Version améliorée (25 Juin 2026)

### Sécurité
- **Helmet** : Ajout des en-têtes de sécurité HTTP (CSP, X-Frame-Options, etc.)
- **Authentification admin renforcée** : Comparaison à temps constant (anti timing-attack), verrouillage automatique après 5 tentatives échouées, nettoyage mémoire des entrées expirées
- **Validation des tokens** : Vérification du format (64 hex chars) avant toute requête DB
- **CORS configurable** : Variable d'environnement `ALLOWED_ORIGINS` pour restreindre les origines en production
- **Rate limiting global** : Protection DDoS basique sur toutes les routes
- **HPP** : Protection contre la pollution de paramètres HTTP
- **Compression** : Gzip/Brotli activé pour réduire la bande passante
- **Body limit** : Limitation de la taille des requêtes à 1MB
- **WebSocket sécurisé** : Limitation de la taille des paquets à 1MB

### Stabilité
- **Graceful shutdown** : Arrêt propre des bots sur SIGTERM/SIGINT avec timeout de 10s
- **Compteur d'erreurs fatales** : Arrêt automatique si plus de 10 erreurs non gérées en 1 minute
- **Validation du PORT** : Vérification que le port est un entier valide avant `execSync`
- **Queue d'envoi bornée** : Limite de 500 messages par bot (configurable), rejet des excédents
- **TTL des messages** : Messages en queue expirés après 30s (configurable)
- **Arrêt de la queue sur déconnexion** : Détection des erreurs de connexion fermée

### Performances
- **Métriques enrichies** : `getRuntimeStats()` retourne les infos de queue, mémoire formatée, et plateforme
- **Pool DB monitoring** : Compteurs de requêtes, erreurs, requêtes lentes, et taille du pool
- **Health check complet** : `/health` vérifie la DB, la mémoire, et retourne les métriques
- **Probes Kubernetes** : `/health/live` et `/health/ready` pour les orchestrateurs
- **Memory Guard** : Surveillance périodique du heap avec alertes et GC forcé si critique
- **Logging des commandes lentes** : Alerte si une commande prend plus de 10s

### Qualité du Code
- **Configuration centralisée** : `src/config.js` regroupe toutes les variables d'environnement
- **Module d'authentification** : `src/middleware/auth.js` réutilisable et testable
- **Module de sécurité** : `src/middleware/security.js` applique tous les middlewares
- **Sanitisation des entrées** : `src/utils/inputSanitizer.js` pour valider téléphones, UUID, tokens, JID, URLs
- **Rate limiter commandes** : `src/utils/commandRateLimiter.js` anti-spam par utilisateur
- **Logger amélioré** : Métriques intégrées, logging structuré, compteurs exportables
- **`.env.example` complet** : Documentation de toutes les variables avec valeurs par défaut

### Fichiers Ajoutés
```
src/middleware/security.js      — Middlewares de sécurité (helmet, compression, hpp)
src/middleware/auth.js          — Authentification admin renforcée
src/utils/inputSanitizer.js     — Validation et sanitisation des entrées
src/utils/memoryGuard.js        — Surveillance mémoire avec alertes
src/utils/commandRateLimiter.js — Rate limiting des commandes bot
src/routes/health.js            — Health check complet avec probes
src/config.js                   — Configuration centralisée
.env.example                    — Template de configuration documenté
CHANGELOG.md                    — Ce fichier
```

### Fichiers Modifiés
```
src/server.js      — Intégration des middlewares de sécurité, validation, health router
src/botManager.js  — Queue bornée, TTL, métriques enrichies, timeout amélioré
src/db.js          — Pool monitoring, health check DB, statistiques
src/utils/logger.js — Métriques intégrées, logging structuré
start.js           — Graceful shutdown, validation env, compteur erreurs fatales
package.json       — Ajout des dépendances de sécurité
```

### Aucun Fichier Supprimé
Tous les fichiers existants ont été conservés conformément à la demande.
