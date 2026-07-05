# TouteLaCuisine.com

Site de recettes de cuisine communautaire (depuis 2008), reconstruit en site statique.

- **Générateur** : [Hugo](https://gohugo.io/) (extended ≥ 0.163), layouts et CSS custom à la racine (pas de thème séparé)
- **Contenu** : 138 recettes et 71 profils migrés depuis l'ancien site Pligg CMS
  (script `migrate_from_mysql.py` dans le repo d'archive)
- **Dépôt de recettes** : [Decap CMS](https://decapcms.org/) sur `/admin/`, connexion GitHub
  (contributeurs invités sur le repo privé), modération par le propriétaire (workflow éditorial)
- **Saisie mobile** : PWA maison sur `/app/` (installable sur téléphone), publication
  directe sur `main` via l'API GitHub — voir [DEPLOY.md §7](DEPLOY.md)
- **Hébergement** : Netlify (offre gratuite), build automatique à chaque push — voir [DEPLOY.md](DEPLOY.md)

## Développement local

```bash
hugo server            # site sur http://localhost:1313 (sert aussi /app/ et /admin/)
npx decap-server       # (optionnel) backend local pour tester /admin/
```

La PWA n'a **aucune étape de build** : c'est du JavaScript vanilla (modules ES)
servi tel quel depuis `static/app/`, comme le reste des fichiers statiques.
`hugo server` suffit pour la développer ; seuls le service worker et
l'installation sur téléphone demandent le site déployé (HTTPS).

## Structure

```
content/recettes/<categorie>/   recettes en Markdown (front matter : title, date, author, difficulty, …)
content/users/                  profils des cuisiniers historiques
layouts/                        templates Hugo (partials : recipe-card, recipe-badges, …)
assets/css/main.css             feuille de style unique (palette rose/bleu/turquoise historique)
static/images/                  photos de recettes et avatars migrés
static/admin/                   Decap CMS (config.yml : une collection par catégorie)
static/app/                     PWA de saisie mobile (vanilla JS, sans build — voir DEPLOY.md §7)
scripts/make_icons.py           régénération des icônes de la PWA (Pillow)
```

## Format des recettes

Deux formats de front matter coexistent, rendus par `layouts/recettes/single.html` :

- **structuré** (PWA et Decap depuis 2026) : champs `ingredients` (liste),
  `steps` (liste `{text, images}`), `tips` et `wine_pairing` optionnels ;
- **historique** (recettes migrées) : corps Markdown avec `## Ingrédients` /
  `## Préparation` — détecté par l'absence du champ `ingredients`.
