// Authentification GitHub via le broker OAuth de Netlify — même mécanisme que
// Decap : le site_id est le nom d'hôte courant (netlify.app ou domaine custom,
// tous deux connus du broker). Depuis localhost, on retombe sur le sous-domaine
// Netlify pour que l'auth fonctionne aussi en développement.

const NETLIFY_ORIGIN = "https://api.netlify.com";
const SITE_ID = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? "toutelacuisine.netlify.app"
  : location.hostname;
const TOKEN_KEY = "tlc_gh_token";

export const REPO = "lama5415/toutelacuisine-site";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// À appeler depuis un handler de clic (sinon la popup est bloquée).
export function login() {
  return new Promise((resolve, reject) => {
    const popup = window.open(
      `${NETLIFY_ORIGIN}/auth?provider=github&scope=public_repo&site_id=${SITE_ID}`,
      "tlc-auth",
      "width=600,height=700"
    );
    if (!popup) {
      reject(new Error("Popup bloquée : autorisez les popups pour ce site."));
      return;
    }

    function onMessage(e) {
      if (e.origin !== NETLIFY_ORIGIN) return;
      if (e.data === "authorizing:github") {
        // Handshake : la popup attend un écho avant d'envoyer le token.
        e.source.postMessage("authorizing:github", e.origin);
        return;
      }
      const OK = "authorization:github:success:";
      const KO = "authorization:github:error:";
      if (typeof e.data !== "string") return;
      if (e.data.startsWith(OK)) {
        window.removeEventListener("message", onMessage);
        popup.close();
        const { token } = JSON.parse(e.data.slice(OK.length));
        localStorage.setItem(TOKEN_KEY, token);
        resolve(token);
      } else if (e.data.startsWith(KO)) {
        window.removeEventListener("message", onMessage);
        popup.close();
        reject(new Error("Connexion GitHub refusée."));
      }
    }
    window.addEventListener("message", onMessage);
  });
}

// Vérifie le token : renvoie { login } si l'utilisateur a les droits d'écriture.
// Lève une erreur avec .code = "expired" (token invalide) ou "forbidden" (pas
// de droit de push sur le dépôt).
export async function checkAccess() {
  const token = getToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };

  const userRes = await fetch("https://api.github.com/user", { headers });
  if (userRes.status === 401) {
    clearToken();
    throw Object.assign(new Error("Session expirée, reconnectez-vous."), { code: "expired" });
  }
  if (!userRes.ok) throw new Error(`GitHub /user : ${userRes.status}`);
  const user = await userRes.json();

  const repoRes = await fetch(`https://api.github.com/repos/${REPO}`, { headers });
  if (!repoRes.ok || !(await repoRes.json()).permissions?.push) {
    throw Object.assign(
      new Error("Votre compte GitHub n'a pas les droits d'écriture sur le dépôt des recettes."),
      { code: "forbidden" }
    );
  }
  return { login: user.login };
}
