# Déploiement — toutelacuisine.com (Netlify + repo GitHub)

Architecture : site statique Hugo + Decap CMS, hébergé gratuitement sur Netlify.
Pas de base de données, pas de serveur : le contenu vit dans le repo git,
Netlify construit et sert le site, et fait office de service OAuth pour le CMS.

## 1. Repo GitHub (public)

1. Créer le repo **public** `toutelacuisine-site` sur GitHub et pousser ce dossier.
   Public obligatoire : le plan gratuit Netlify n'accepte qu'un seul « Git
   contributor » sur les repos privés et bloque les builds dès qu'un autre compte
   pousse (contributeur Decap, second compte du propriétaire…). En public,
   contributeurs illimités ; l'écriture reste réservée aux collaborateurs invités.
2. Vérifier `static/admin/config.yml` → `backend.repo: <owner>/toutelacuisine-site`.
3. Inviter les contributeurs : repo → Settings → Collaborators → Add people
   (rôle **Write**). Chacun doit avoir un compte GitHub (gratuit) et accepter
   l'invitation reçue par email.

## 2. Netlify

1. Créer un compte sur https://app.netlify.com (offre gratuite).
2. « Add new site » → « Import an existing project » → GitHub → choisir
   `toutelacuisine-site`. Netlify lit `netlify.toml` (build `hugo --minify`,
   dossier `public/`) — rien à configurer.
3. Chaque push sur `main` (dont les publications du CMS) redéploie le site
   automatiquement (build ~30 s ; l'offre gratuite inclut 300 min/mois, très large).

## 3. GitHub OAuth App (login du CMS)

1. GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App :
   - Homepage URL : `https://toutelacuisine.com`
   - **Authorization callback URL : `https://api.netlify.com/auth/done`**
   - Noter le Client ID et générer un Client Secret.
2. Dans Netlify : Site configuration → **Access & security → OAuth** →
   « Install provider » → GitHub → coller Client ID / Client Secret.

C'est tout : Decap utilise le service OAuth de Netlify par défaut (aucun
`base_url` dans `config.yml`).

## 4. Domaine

Netlify : Domain management → Add domain → `toutelacuisine.com`, puis suivre les
instructions DNS (CNAME/ALIAS vers Netlify ou délégation des nameservers).
HTTPS Let's Encrypt automatique.

## 5. Flux de dépôt d'une recette

1. Un contributeur va sur `https://toutelacuisine.com/admin/` → « Login with GitHub ».
2. Il choisit une catégorie, remplit le formulaire, clique **Save** : la recette
   part en **Brouillon** (une PR est créée dans le repo, invisible pour lui).
3. Le propriétaire ouvre l'onglet **Workflow** de `/admin/`, relit, fait glisser
   l'entrée vers « Prêt » puis **Publish** (= merge de la PR).
4. Netlify redéploie : la recette est en ligne en ~1 minute.

## 6. Test local du CMS

```bash
npx decap-server      # backend local (proxy filesystem), terminal 1
hugo server           # terminal 2
# → http://localhost:1313/admin/  (login sans authentification)
```
Note : le workflow éditorial (brouillon/PR) n'est pas simulé par le backend local
en mode fichier — la publication écrit directement le fichier. Le comportement PR
ne se voit qu'en production avec le backend GitHub.

## 7. PWA de saisie mobile (`/app/`)

Alternative à Decap pour saisir une recette depuis un téléphone : formulaire en
cinq écrans (infos, photo, ingrédients, étapes avec photos, publication), photos
compressées côté client, brouillon conservé sur l'appareil (IndexedDB).

**Aucun build, aucune configuration supplémentaire.** Les fichiers de
`static/app/` sont servis tels quels par Hugo/Netlify (JavaScript vanilla en
modules ES). L'authentification réutilise la GitHub OAuth App déjà installée
dans Netlify (§3) : rien à créer de plus. Seuls les collaborateurs avec le rôle
**Write** (§1) peuvent publier — la publication est un commit direct sur `main`
via l'API GitHub (pas de workflow éditorial), qui déclenche le rebuild Netlify.

### Utilisation

1. Ouvrir `https://toutelacuisine.com/app/` sur le téléphone → « Se connecter
   avec GitHub » (une seule fois, le jeton est mémorisé).
2. Pour l'installer comme appli : menu du navigateur → « Ajouter à l'écran
   d'accueil » (iOS Safari) ou invite d'installation (Android Chrome).

### Entretien

- **Modification d'un fichier de l'appli** : incrémenter la version du cache
  dans `static/app/sw.js` (`const CACHE = "tlc-app-vN"`), sinon les téléphones
  gardent l'ancien shell en cache.
- **Tester la publication sans toucher au site** : créer une branche `pwa-test`
  sur GitHub et pointer `const BRANCH` dessus dans `static/app/github.js`
  (remettre `"main"` ensuite).
- **Icônes** : régénérées par `python3 scripts/make_icons.py` (nécessite Pillow).
- **En local** : `hugo server` sert `/app/` ; le login OAuth fonctionne depuis
  `localhost` (`static/app/auth.js` utilise alors `toutelacuisine.netlify.app`
  comme `site_id` ; sinon c'est le nom d'hôte courant, qui marche sur le
  sous-domaine Netlify comme sur le domaine final). Le service worker et
  l'installation ne se testent qu'en HTTPS sur le site déployé.
