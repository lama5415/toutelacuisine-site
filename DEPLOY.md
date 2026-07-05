# Déploiement — toutelacuisine.com (Netlify + repo GitHub privé)

Architecture : site statique Hugo + Decap CMS, hébergé gratuitement sur Netlify.
Pas de base de données, pas de serveur : le contenu vit dans le repo git (privé),
Netlify construit et sert le site, et fait office de service OAuth pour le CMS.

## 1. Repo GitHub (privé)

1. Créer le repo **privé** `toutelacuisine-site` sur GitHub et pousser ce dossier.
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
