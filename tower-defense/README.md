# 🏰 Tower Defense - Déploiement Azure

## Option 1 : Azure Static Web Apps (recommandé)

Le plus simple. Déploie uniquement les fichiers statiques.

1. Créer une **Azure Static Web App** dans le portail Azure
2. Connecter ton repo GitHub (push ce projet dessus)
3. Config du build :
   - **App location** : `/`
   - **Build command** : `npm run build`  
   - **Output location** : `dist`

Ou déployer manuellement le dossier `dist/` via Azure CLI :
```bash
az staticwebapp create --name tower-defense --resource-group <ton-rg>
swa deploy ./dist --env production
```

## Option 2 : Azure App Service (Node.js)

Pour un App Service classique avec serveur Express.

1. Créer un **App Service** (Node 18+)
2. Définir le **Startup Command** : `npm run build && npm start`
3. Déployer via :

```bash
# Zip deploy
az webapp deployment source config-zip \
  --resource-group <ton-rg> \
  --name <ton-app> \
  --src tower-defense.zip

# Ou via GitHub Actions / Azure DevOps
```

### Variables d'environnement
- `PORT` : défini automatiquement par Azure (8080)
- Pas d'autres variables requises

## Structure du projet

```
tower-defense/
├── dist/               ← Fichiers buildés (prêts à déployer)
│   ├── index.html
│   ├── static/js/
│   └── web.config      ← Config IIS pour Azure App Service
├── src/
│   ├── main.jsx        ← Point d'entrée React
│   └── TowerDefense.jsx ← Le jeu complet
├── server.js           ← Serveur Express (Option 2)
├── rsbuild.config.mjs  ← Config Rsbuild
├── package.json
└── index.html          ← Template HTML source
```

## Développement local

```bash
npm install
npm run dev     # Dev server sur http://localhost:3000
npm run build   # Build production dans dist/
npm start       # Serveur Express sur :8080
```

## Notes

- Les highscores sont sauvegardés en **localStorage** (par navigateur, par appareil)
- Pas de backend requis — tout est côté client
- Le jeu est responsive et fonctionne sur mobile
- Build : Rsbuild ~65 KB gzippé, build en ~0.3s
