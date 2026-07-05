// Publication : un commit atomique (md + photos) via l'API git data de GitHub.
// BRANCH est basculable sur une branche de test (ex : "pwa-test") pour valider
// sans toucher au site en production.

import { getToken, REPO } from "./auth.js";
import { blobToBase64 } from "./images.js";

const BRANCH = "main";
const API = `https://api.github.com/repos/${REPO}`;

export const CATEGORIES = {
  "plat-principal": "Plat principal",
  "dessert": "Dessert",
  "entree": "Entrée",
  "accompagnement": "Accompagnement",
  "aperitif": "Apéritif",
  "cocktail": "Cocktail",
  "sauce": "Sauce",
};

async function gh(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/vnd.github+json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) {
    const err = new Error(`GitHub ${path} : ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export function slugify(title) {
  return title
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Slug unique dans la catégorie : suffixe -2, -3… en cas de collision.
export async function uniqueSlug(title, category) {
  const base = slugify(title);
  let existing = [];
  try {
    const files = await gh(`/contents/content/recettes/${category}?ref=${BRANCH}`);
    existing = files.map((f) => f.name);
  } catch (e) {
    if (e.status !== 404) throw e; // dossier absent = aucune collision possible
  }
  let slug = base;
  for (let i = 2; existing.includes(`${slug}.md`); i++) slug = `${base}-${i}`;
  return slug;
}

// YAML : chaque chaîne passée par JSON.stringify est un scalaire YAML
// double-quoté valide (accents, apostrophes, deux-points…).
export function buildMarkdown(state, slug, imagePaths) {
  const q = JSON.stringify;
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
  const lines = ["---"];
  lines.push(`title: ${q(state.title.trim())}`);
  lines.push(`date: ${now}`);
  lines.push(`lastmod: ${now}`);
  if (state.author.trim()) lines.push(`author: ${q(state.author.trim())}`);
  lines.push(`categories: [${q(CATEGORIES[state.category])}]`);
  if (state.tags.length) lines.push(`tags: [${state.tags.map(q).join(", ")}]`);
  lines.push(`difficulty: ${q(state.difficulty)}`);
  lines.push(`cost: ${q(state.cost)}`);
  if (state.prep_time.trim()) lines.push(`prep_time: ${q(state.prep_time.trim())}`);
  if (state.cook_time.trim()) lines.push(`cook_time: ${q(state.cook_time.trim())}`);
  if (state.serves.trim()) lines.push(`serves: ${q(state.serves.trim())}`);
  if (imagePaths.main) lines.push(`image: ${q(imagePaths.main)}`);
  lines.push("ingredients:");
  for (const ing of state.ingredients) lines.push(`  - ${q(ing)}`);
  lines.push("steps:");
  state.steps.forEach((step, i) => {
    lines.push(`  - text: ${q(step.text.trim())}`);
    const paths = imagePaths.steps[i] || [];
    if (paths.length) {
      lines.push("    images:");
      for (const p of paths) lines.push(`      - ${q(p)}`);
    }
  });
  if (state.tips.length) {
    lines.push("tips:");
    for (const tip of state.tips) lines.push(`  - ${q(tip)}`);
  }
  if (state.wine_pairing.trim()) lines.push(`wine_pairing: ${q(state.wine_pairing.trim())}`);
  lines.push(`slug: ${q(slug)}`);
  lines.push(`draft: ${state.draft}`);
  lines.push("---");
  return lines.join("\n") + "\n";
}

// Publie la recette : blobs images → tree → commit → maj de la branche.
// onProgress(texte) alimente l'écran de progression.
export async function publishRecipe(state, onProgress) {
  onProgress("Vérification du titre…");
  const slug = await uniqueSlug(state.title, state.category);
  const dir = `static/images/recettes/${slug}`;

  // Chemins publics des images (le YAML les référence) + entrées du commit.
  const imagePaths = { main: null, steps: [] };
  const imageFiles = []; // { path repo, blob }
  if (state.mainPhoto) {
    imagePaths.main = `/images/recettes/${slug}/${slug}.jpg`;
    imageFiles.push({ path: `${dir}/${slug}.jpg`, blob: state.mainPhoto });
  }
  state.steps.forEach((step, i) => {
    imagePaths.steps[i] = step.photos.map((blob, j) => {
      imageFiles.push({ path: `${dir}/etape-${i + 1}-${j + 1}.jpg`, blob });
      return `/images/recettes/${slug}/etape-${i + 1}-${j + 1}.jpg`;
    });
  });

  const tree = [
    {
      path: `content/recettes/${state.category}/${slug}.md`,
      mode: "100644",
      type: "blob",
      content: buildMarkdown(state, slug, imagePaths),
    },
  ];

  for (let i = 0; i < imageFiles.length; i++) {
    onProgress(`Envoi des photos (${i + 1}/${imageFiles.length})…`);
    const { sha } = await gh("/git/blobs", {
      method: "POST",
      body: JSON.stringify({ content: await blobToBase64(imageFiles[i].blob), encoding: "base64" }),
    });
    tree.push({ path: imageFiles[i].path, mode: "100644", type: "blob", sha });
  }

  const message = `Nouvelle recette : ${state.title.trim()}`;
  for (let attempt = 0; ; attempt++) {
    onProgress("Création du commit…");
    const { object: { sha: headSha } } = await gh(`/git/ref/heads/${BRANCH}`);
    const { tree: { sha: baseTreeSha } } = await gh(`/git/commits/${headSha}`);
    const { sha: treeSha } = await gh("/git/trees", {
      method: "POST",
      body: JSON.stringify({ base_tree: baseTreeSha, tree }),
    });
    const { sha: commitSha } = await gh("/git/commits", {
      method: "POST",
      body: JSON.stringify({ message, tree: treeSha, parents: [headSha] }),
    });
    try {
      await gh(`/git/refs/heads/${BRANCH}`, {
        method: "PATCH",
        body: JSON.stringify({ sha: commitSha }),
      });
      break;
    } catch (e) {
      // Push concurrent : on refait le commit sur la nouvelle tête (les blobs restent valides).
      if (attempt === 0 && (e.status === 409 || e.status === 422)) continue;
      throw e;
    }
  }

  return { slug, url: `${location.origin}/recettes/${state.category}/${slug}/` };
}
