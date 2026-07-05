// PWA de saisie de recettes — état, navigation, autosave, publication.

import { saveDraft, loadDraft, clearDraft } from "./db.js";
import { compressImage } from "./images.js";
import { getToken, login, checkAccess, clearToken } from "./auth.js";
import { slugify, uniqueSlug, publishRecipe, CATEGORIES } from "./github.js";

const $ = (sel) => document.querySelector(sel);

const AUTHOR_KEY = "tlc_author";

function emptyState() {
  return {
    title: "",
    category: "",
    difficulty: "Facile",
    cost: "Bon Marché",
    prep_time: "",
    cook_time: "",
    serves: "",
    tags: [],
    author: localStorage.getItem(AUTHOR_KEY) || "",
    mainPhoto: null, // Blob
    ingredients: [],
    steps: [], // { text, photos: [Blob] }
    tips: [],
    wine_pairing: "",
    draft: false,
  };
}

let state = emptyState();
let currentStep = 0;
const STEP_COUNT = 5;

// Les URLs d'aperçu sont créées une fois par Blob.
const blobUrls = new WeakMap();
function urlFor(blob) {
  if (!blobUrls.has(blob)) blobUrls.set(blob, URL.createObjectURL(blob));
  return blobUrls.get(blob);
}

/* ----- Autosave ----- */

let saveTimer;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveDraft(state).catch(() => {}), 800);
}

/* ----- Navigation ----- */

function showStep(n) {
  currentStep = n;
  document.querySelectorAll(".step").forEach((s) => {
    s.hidden = s.dataset.step !== String(n);
  });
  document.querySelectorAll(".step-dot").forEach((d, i) => {
    d.classList.toggle("active", i === n);
    d.classList.toggle("done", i < n);
  });
  $("#nav-prev").style.visibility = n === 0 ? "hidden" : "visible";
  $("#nav-next").style.visibility = n === STEP_COUNT - 1 ? "hidden" : "visible";
  $("#nav-bar").hidden = false;
  $("#stepper").hidden = false;
  if (n === STEP_COUNT - 1) renderSummary();
  window.scrollTo(0, 0);
}

function showProgressScreen() {
  document.querySelectorAll(".step").forEach((s) => {
    s.hidden = s.dataset.step !== "progress";
  });
  $("#nav-bar").hidden = true;
  $("#stepper").hidden = true;
  window.scrollTo(0, 0);
}

/* ----- Rendu des listes ----- */

function makeItemRow(text, list, index, rerender) {
  const row = $("#tpl-item-row").content.firstElementChild.cloneNode(true);
  row.querySelector(".item-text").textContent = text;
  const [up, down, del] = row.querySelectorAll(".item-actions button");
  up.disabled = index === 0;
  down.disabled = index === list.length - 1;
  up.onclick = () => { [list[index - 1], list[index]] = [list[index], list[index - 1]]; rerender(); scheduleSave(); };
  down.onclick = () => { [list[index + 1], list[index]] = [list[index], list[index + 1]]; rerender(); scheduleSave(); };
  del.onclick = () => { list.splice(index, 1); rerender(); scheduleSave(); };
  return row;
}

function renderIngredients() {
  const ul = $("#ingredients-list");
  ul.replaceChildren(...state.ingredients.map((t, i) => makeItemRow(t, state.ingredients, i, renderIngredients)));
}

function renderTips() {
  const ul = $("#tips-list");
  ul.replaceChildren(...state.tips.map((t, i) => makeItemRow(t, state.tips, i, renderTips)));
}

function renderTags() {
  const box = $("#tags-list");
  box.replaceChildren(
    ...state.tags.map((tag, i) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = tag;
      const del = document.createElement("button");
      del.textContent = "✕";
      del.setAttribute("aria-label", `Supprimer ${tag}`);
      del.onclick = () => { state.tags.splice(i, 1); renderTags(); scheduleSave(); };
      chip.appendChild(del);
      return chip;
    })
  );
}

function renderMainPhoto() {
  const hasPhoto = !!state.mainPhoto;
  $("#main-photo-btn").hidden = hasPhoto;
  $("#main-photo-preview").hidden = !hasPhoto;
  if (hasPhoto) $("#main-photo-preview img").src = urlFor(state.mainPhoto);
}

function autoGrow(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}

function renderSteps() {
  const ol = $("#steps-list");
  ol.replaceChildren(
    ...state.steps.map((step, i) => {
      const card = $("#tpl-step-card").content.firstElementChild.cloneNode(true);
      card.querySelector(".step-num").textContent = `Étape ${i + 1}`;

      const [up, down, del] = card.querySelectorAll(".item-actions button");
      up.disabled = i === 0;
      down.disabled = i === state.steps.length - 1;
      up.onclick = () => { [state.steps[i - 1], state.steps[i]] = [state.steps[i], state.steps[i - 1]]; renderSteps(); scheduleSave(); };
      down.onclick = () => { [state.steps[i + 1], state.steps[i]] = [state.steps[i], state.steps[i + 1]]; renderSteps(); scheduleSave(); };
      del.onclick = () => { state.steps.splice(i, 1); renderSteps(); scheduleSave(); };

      const ta = card.querySelector("textarea");
      ta.value = step.text;
      ta.oninput = () => { step.text = ta.value; autoGrow(ta); scheduleSave(); };
      requestAnimationFrame(() => autoGrow(ta));

      const photosBox = card.querySelector(".step-photos");
      photosBox.replaceChildren(
        ...step.photos.map((blob, j) => {
          const thumb = $("#tpl-step-thumb").content.firstElementChild.cloneNode(true);
          thumb.querySelector("img").src = urlFor(blob);
          thumb.querySelector(".thumb-del").onclick = () => {
            step.photos.splice(j, 1);
            renderSteps();
            scheduleSave();
          };
          return thumb;
        })
      );

      const fileInput = card.querySelector(".step-photo-add input");
      fileInput.onchange = async () => {
        const file = fileInput.files[0];
        fileInput.value = "";
        if (!file) return;
        step.photos.push(await compressImage(file));
        renderSteps();
        scheduleSave();
      };
      return card;
    })
  );
}

function renderSummary() {
  const photoCount = (state.mainPhoto ? 1 : 0) + state.steps.reduce((n, s) => n + s.photos.length, 0);
  const cat = CATEGORIES[state.category] || "—";
  $("#summary").innerHTML =
    `<strong>${escapeHtml(state.title) || "(sans titre)"}</strong> · ${cat}<br>` +
    `${state.ingredients.length} ingrédient(s) · ${state.steps.length} étape(s) · ${photoCount} photo(s)` +
    (state.draft ? "<br>Sera enregistrée comme <strong>brouillon</strong>." : "");
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function renderAll() {
  $("#f-title").value = state.title;
  $("#f-category").value = state.category;
  $("#f-prep").value = state.prep_time;
  $("#f-cook").value = state.cook_time;
  $("#f-serves").value = state.serves;
  $("#f-author").value = state.author;
  $("#f-wine").value = state.wine_pairing;
  $("#f-draft").checked = state.draft;
  document.querySelectorAll("#f-difficulty button").forEach((b) =>
    b.classList.toggle("active", b.dataset.value === state.difficulty));
  document.querySelectorAll("#f-cost button").forEach((b) =>
    b.classList.toggle("active", b.dataset.value === state.cost));
  renderTags();
  renderMainPhoto();
  renderIngredients();
  renderSteps();
  renderTips();
}

/* ----- Câblage des champs ----- */

function bindText(sel, key) {
  $(sel).addEventListener("input", (e) => { state[key] = e.target.value; scheduleSave(); });
}

function bindSegmented(sel, key) {
  $(sel).addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state[key] = btn.dataset.value;
    $(sel).querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
    scheduleSave();
  });
}

function bindAddRow(inputSel, btnSel, list, rerender) {
  const add = () => {
    const input = $(inputSel);
    const value = input.value.trim();
    if (!value) return;
    list.push(value);
    input.value = "";
    input.focus();
    rerender();
    scheduleSave();
  };
  $(btnSel).addEventListener("click", add);
  $(inputSel).addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); add(); }
  });
}

async function updateSlugPreview() {
  const preview = $("#slug-preview");
  if (!state.title.trim() || !state.category) { preview.hidden = true; return; }
  const base = slugify(state.title);
  preview.hidden = false;
  preview.classList.remove("slug-taken");
  preview.textContent = `→ toutelacuisine.com/recettes/${state.category}/${base}/`;
  try {
    const slug = await uniqueSlug(state.title, state.category);
    if (slug !== base) {
      preview.classList.add("slug-taken");
      preview.textContent = `Une recette « ${base} » existe déjà — celle-ci sera publiée en « ${slug} ».`;
    }
  } catch { /* hors-ligne ou token absent : l'aperçu simple suffit */ }
}

function wireForm() {
  bindText("#f-title", "title");
  $("#f-title").addEventListener("blur", updateSlugPreview);
  $("#f-category").addEventListener("change", (e) => {
    state.category = e.target.value;
    scheduleSave();
    updateSlugPreview();
  });
  bindSegmented("#f-difficulty", "difficulty");
  bindSegmented("#f-cost", "cost");
  bindText("#f-prep", "prep_time");
  bindText("#f-cook", "cook_time");
  bindText("#f-serves", "serves");
  bindText("#f-wine", "wine_pairing");
  $("#f-author").addEventListener("input", (e) => {
    state.author = e.target.value;
    localStorage.setItem(AUTHOR_KEY, e.target.value);
    scheduleSave();
  });
  $("#f-draft").addEventListener("change", (e) => {
    state.draft = e.target.checked;
    renderSummary();
    scheduleSave();
  });

  bindAddRow("#f-tag", "#tag-add", state.tags, renderTags);
  bindAddRow("#f-ingredient", "#ingredient-add", state.ingredients, renderIngredients);
  bindAddRow("#f-tip", "#tip-add", state.tips, renderTips);

  // Photo principale
  $("#main-photo-btn").addEventListener("click", () => $("#f-main-photo").click());
  $("#f-main-photo").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    state.mainPhoto = await compressImage(file);
    renderMainPhoto();
    scheduleSave();
  });
  $("#main-photo-preview .photo-remove").addEventListener("click", () => {
    state.mainPhoto = null;
    renderMainPhoto();
    scheduleSave();
  });

  $("#step-add").addEventListener("click", () => {
    state.steps.push({ text: "", photos: [] });
    renderSteps();
    scheduleSave();
    $("#steps-list .step-card:last-child textarea").focus();
  });

  // Navigation
  $("#nav-prev").addEventListener("click", () => showStep(Math.max(0, currentStep - 1)));
  $("#nav-next").addEventListener("click", () => showStep(Math.min(STEP_COUNT - 1, currentStep + 1)));
  $("#stepper").addEventListener("click", (e) => {
    const dot = e.target.closest("[data-goto]");
    if (dot) showStep(Number(dot.dataset.goto));
  });

  $("#publish-btn").addEventListener("click", publish);
  $("#new-recipe-btn").addEventListener("click", () => {
    state = emptyState();
    renderAll();
    $("#success-box").hidden = true;
    $("#progress-box").hidden = false;
    showStep(0);
  });
}

/* ----- Publication ----- */

function validate() {
  const problems = [];
  if (!state.title.trim()) problems.push("le titre");
  if (!state.category) problems.push("la catégorie");
  if (!state.ingredients.length) problems.push("au moins un ingrédient");
  state.steps = state.steps.filter((s) => s.text.trim() || s.photos.length);
  if (!state.steps.length) problems.push("au moins une étape");
  return problems;
}

async function publish() {
  const errorBox = $("#publish-error");
  errorBox.hidden = true;
  const problems = validate();
  if (problems.length) {
    errorBox.textContent = `Il manque : ${problems.join(", ")}.`;
    errorBox.hidden = false;
    return;
  }

  showProgressScreen();
  const progressText = $("#progress-text");
  try {
    const { url } = await publishRecipe(state, (msg) => { progressText.textContent = msg; });
    await clearDraft();
    $("#progress-box").hidden = true;
    $("#success-box").hidden = false;
    $("#success-text").textContent = state.draft
      ? "Enregistrée comme brouillon — passez draft à false (Decap ou GitHub) pour la mettre en ligne."
      : "Le site est en cours de reconstruction : la recette sera en ligne d'ici 2 minutes.";
    $("#success-link").href = url;
    $("#success-link").textContent = url;
  } catch (e) {
    showStep(STEP_COUNT - 1);
    errorBox.textContent = `Échec de la publication : ${e.message}`;
    errorBox.hidden = false;
  }
}

/* ----- Démarrage ----- */

async function showLogin(message) {
  $("#app").hidden = true;
  $("#login-screen").hidden = false;
  const errorBox = $("#login-error");
  errorBox.hidden = !message;
  if (message) errorBox.textContent = message;
}

async function startApp() {
  $("#login-screen").hidden = true;
  $("#app").hidden = false;

  checkAccess().then(
    ({ login: ghLogin }) => {
      const chip = $("#user-chip");
      chip.hidden = false;
      chip.textContent = `@${ghLogin}`;
    },
    (e) => {
      if (e.code === "expired" || e.code === "forbidden") showLogin(e.message);
      // Erreur réseau : on laisse saisir, la publication réessaiera.
    }
  );

  const draft = await loadDraft().catch(() => null);
  if (draft && (draft.title || draft.ingredients.length || draft.steps.length)) {
    const banner = $("#draft-banner");
    banner.hidden = false;
    $("#draft-resume").onclick = () => {
      state = { ...emptyState(), ...draft };
      renderAll();
      banner.hidden = true;
    };
    $("#draft-discard").onclick = () => {
      clearDraft();
      banner.hidden = true;
    };
  }

  renderAll();
  showStep(0);
}

$("#login-btn").addEventListener("click", async () => {
  try {
    await login();
    startApp();
  } catch (e) {
    showLogin(e.message);
  }
});

wireForm();
if (getToken()) startApp();
else showLogin();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" }).catch(() => {});
}
