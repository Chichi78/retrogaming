# 🏰 Tower Defense - Déploiement Azure

## Option recommandée : Azure Static Web Apps

Le projet est un front React statique. Le plus simple et le plus robuste est **Azure Static Web Apps**.

### Configuration build (important pour ce repo)

Le code applicatif est dans le dossier `tower-defense/`.

- **App location** : `/tower-defense`
- **Build command** : `npm run build`
- **Output location** : `dist`

## Domaine personnalisé : retrogaming-online.com

### 1) Ajouter les domaines dans Azure

Dans ta ressource Azure Static Web Apps :

1. **Custom domains** → Add
2. Ajouter d'abord `www.retrogaming-online.com`
3. Ajouter ensuite `retrogaming-online.com`

### 2) DNS conseillé (simple et fiable)

- `www` : **CNAME** vers `<nom-app>.azurestaticapps.net`
- `@` (apex) :
   - soit **ALIAS/ANAME** vers `<nom-app>.azurestaticapps.net` (si ton registrar le supporte),
   - soit redirection HTTP 301 de l'apex vers `https://www.retrogaming-online.com` depuis le registrar.

> Azure te donne les enregistrements exacts (validation TXT incluse) au moment de l'ajout du domaine. Utilise exactement ceux affichés dans le portail.

### 3) HTTPS

Après validation DNS, le certificat TLS est géré automatiquement par Azure.

## Alternative : Azure App Service (Node + Express)

Si tu veux garder `server.js`, c'est possible, mais plus lourd pour ce cas d'usage.

- Runtime : Node 18+
- Startup command : `cd tower-defense && npm run build && npm start`

Pour le domaine custom sur App Service :

- `www` : CNAME vers `<app>.azurewebsites.net`
- `@` : A record vers l'IP de l'App Service + TXT de validation `asuid`

## Bonnes pratiques Git

- Ne pas versionner les builds (`dist/`, `tower-defense-dist/`) ✅
- Déployer depuis la source via GitHub + Azure (build automatique)

## Commandes locales utiles

```bash
cd tower-defense
npm install
npm run dev
npm run build
```
