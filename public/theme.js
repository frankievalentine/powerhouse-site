// Runs in <head> before the page paints: applies a theme picked with the
// System / Light / Dark switch (main.js). "System" sets nothing and lets
// prefers-color-scheme decide. Same key and attribute as the app.
try {
  const t = localStorage.getItem("powerhouse-theme");
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch {}
