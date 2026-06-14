export const styles = `
:root {
  color-scheme: light;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  background:
    radial-gradient(circle at top left, rgba(94, 142, 105, 0.18), transparent 34rem),
    radial-gradient(circle at bottom right, rgba(181, 205, 164, 0.20), transparent 30rem),
    linear-gradient(145deg, #fbfaf6 0%, #eef5ed 48%, #f7f2ea 100%);
  color: #222621;
  --surface: rgba(255, 255, 255, 0.88);
  --surface-strong: #ffffff;
  --ink: #222621;
  --muted: #657466;
  --line: rgba(58, 91, 64, 0.17);
  --line-strong: rgba(58, 91, 64, 0.28);
  --primary: #2f6b4f;
  --primary-dark: #214b37;
  --primary-soft: #e3f0e3;
  --accent: #5e8e69;
  --accent-soft: #edf7ed;
  --shadow: 0 18px 48px rgba(37, 47, 39, 0.10);
  --shadow-soft: 0 8px 22px rgba(37, 47, 39, 0.07);
}

* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; }
body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(47, 107, 79, 0.038) 1px, transparent 1px),
    linear-gradient(90deg, rgba(47, 107, 79, 0.032) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.7), transparent 70%);
}
a { color: var(--primary-dark); text-decoration-thickness: 1px; text-underline-offset: 3px; }
a:hover { color: var(--primary); }

.shell {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 40px 0 64px;
}

.topbar {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: end;
  margin-bottom: 24px;
}
.topbar h1 {
  font-size: clamp(30px, 4vw, 44px);
  line-height: 1.06;
  margin: 0;
  letter-spacing: 0;
}
.eyebrow {
  color: var(--primary);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  margin: 0 0 8px;
  text-transform: uppercase;
}

.button, button {
  appearance: none;
  border: 1px solid transparent;
  background: var(--primary);
  color: #fff;
  border-radius: 8px;
  padding: 10px 15px;
  min-height: 42px;
  font: inherit;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  box-shadow: var(--shadow-soft);
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}
.button:hover, button:hover {
  background: var(--primary-dark);
  color: #fff;
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(33, 75, 55, 0.18);
}
.button.secondary {
  background: rgba(255, 255, 255, 0.74);
  border-color: var(--line-strong);
  color: var(--primary-dark);
  box-shadow: none;
}
.button.secondary:hover {
  background: #fff;
  color: var(--primary-dark);
}

.filters, .form {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
}
.filters {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 170px 170px auto;
  gap: 14px;
  align-items: end;
  margin-bottom: 22px;
  padding: 16px;
}
.form {
  display: grid;
  gap: 16px;
  padding: 22px;
}
.recipe-list {
  display: grid;
  gap: 14px;
}

label {
  display: grid;
  gap: 7px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
}
input, select, textarea {
  width: 100%;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  padding: 11px 12px;
  font: inherit;
  font-size: 15px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ink);
  outline: none;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    background-color 0.16s ease;
}
input:focus, select:focus, textarea:focus {
  border-color: rgba(47, 107, 79, 0.62);
  background: #fff;
  box-shadow: 0 0 0 4px rgba(47, 107, 79, 0.12);
}
textarea {
  min-height: 132px;
  line-height: 1.65;
  resize: vertical;
}

.recipe-card {
  background: var(--surface-strong);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 16px;
  box-shadow: var(--shadow-soft);
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}
.recipe-card:hover {
  border-color: rgba(47, 107, 79, 0.30);
  box-shadow: var(--shadow);
  transform: translateY(-1px);
}
.recipe-card-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
}
.recipe-card h2 {
  font-size: 19px;
  line-height: 1.35;
  margin: 0 0 7px;
  letter-spacing: 0;
}
.recipe-card h2 a { text-decoration: none; }
.meta {
  color: var(--muted);
  font-size: 13px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 0;
}
.meta span {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 4px 9px;
  background: #f6fbf5;
}
.ingredient-preview {
  display: grid;
  gap: 8px;
  margin: 14px 0 0;
  color: #384038;
}
.ingredient-preview strong {
  color: var(--primary-dark);
  font-size: 13px;
}
.ingredient-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ingredient-list span {
  border: 1px solid rgba(47, 107, 79, 0.13);
  border-radius: 999px;
  background: #f8fbf6;
  color: #384038;
  font-size: 13px;
  line-height: 1.35;
  padding: 5px 8px;
}
.ingredient-list .ingredient-more {
  background: var(--primary-soft);
  color: var(--primary-dark);
  font-weight: 800;
}
.notes {
  white-space: pre-wrap;
}
.notes {
  color: var(--muted);
  line-height: 1.55;
  margin: 10px 0 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tags {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.tag {
  background: var(--primary-soft);
  color: var(--primary-dark);
  border: 1px solid rgba(47, 107, 79, 0.13);
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 13px;
  font-weight: 700;
}
.source-link {
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  color: var(--primary-dark);
  background: rgba(255, 255, 255, 0.72);
  padding: 7px 10px;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
  white-space: nowrap;
  align-self: start;
}
.source-link:hover {
  border-color: rgba(47, 107, 79, 0.38);
  background: var(--primary-soft);
  color: var(--primary-dark);
}
.actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 8px;
}
.error {
  border: 1px solid rgba(181, 75, 54, 0.26);
  background: var(--accent-soft);
  color: #833324;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 14px;
  font-weight: 700;
}

@media (max-width: 760px) {
  .shell { width: min(100% - 24px, 1120px); padding: 28px 0 44px; }
  .topbar, .filters { grid-template-columns: 1fr; display: grid; align-items: stretch; }
  .topbar { gap: 14px; }
  .filters, .form { padding: 14px; }
  .button, button { width: 100%; text-align: center; }
  .recipe-card { padding: 15px; }
  .source-link { width: fit-content; }
  .actions { display: grid; }
}
`;
