# TouteLaCuisine.com

Site de recettes de cuisine communautaire (depuis 2008), reconstruit en site statique.

- **Générateur** : [Hugo](https://gohugo.io/) (extended ≥ 0.163), layouts et CSS custom à la racine (pas de thème séparé)
- **Contenu** : 138 recettes et 71 profils migrés depuis l'ancien site Pligg CMS
  (script `migrate_from_mysql.py` dans le repo d'archive)
- **Dépôt de recettes** : [Decap CMS](https://decapcms.org/) sur `/admin/`, connexion GitHub
  (contributeurs invités sur le repo privé), modération par le propriétaire (workflow éditorial)
- **Hébergement** : Netlify (offre gratuite), build automatique à chaque push — voir [DEPLOY.md](DEPLOY.md)

## Développement local

```bash
hugo server            # site sur http://localhost:1313
npx decap-server       # (optionnel) backend local pour tester /admin/
```

## Structure

```
content/recettes/<categorie>/   recettes en Markdown (front matter : title, date, author, difficulty, …)
content/users/                  profils des cuisiniers historiques
layouts/                        templates Hugo (partials : recipe-card, recipe-badges, …)
assets/css/main.css             feuille de style unique (palette rose/bleu/turquoise historique)
static/images/                  photos de recettes et avatars migrés
static/admin/                   Decap CMS (config.yml : une collection par catégorie)
```
