export const styles = `
:root {
  color-scheme: light;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f7f5ef;
  color: #25231f;
}
body { margin: 0; }
a { color: #235c8f; }
.shell { max-width: 1040px; margin: 0 auto; padding: 28px 18px 48px; }
.topbar { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 24px; }
.topbar h1 { font-size: 28px; margin: 0; }
.button, button {
  border: 1px solid #2f5d50;
  background: #2f5d50;
  color: #fff;
  border-radius: 6px;
  padding: 9px 13px;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}
.button.secondary { background: #fff; color: #2f5d50; }
.filters, .form, .recipe-list { display: grid; gap: 12px; }
.filters { grid-template-columns: 1fr 170px 170px auto; align-items: end; margin-bottom: 20px; }
label { display: grid; gap: 6px; font-weight: 600; }
input, select, textarea {
  border: 1px solid #c8c1b4;
  border-radius: 6px;
  padding: 9px 10px;
  font: inherit;
  background: #fff;
  color: inherit;
}
textarea { min-height: 110px; resize: vertical; }
.recipe-card {
  background: #fff;
  border: 1px solid #ded7ca;
  border-radius: 8px;
  padding: 16px;
}
.recipe-card h2 { font-size: 19px; margin: 0 0 8px; }
.meta { color: #665f54; font-size: 14px; display: flex; gap: 10px; flex-wrap: wrap; }
.tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.tag { background: #e8f0eb; color: #29483e; border-radius: 999px; padding: 3px 8px; font-size: 13px; }
.actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 14px; }
.error { border: 1px solid #b64b3a; background: #fff1ed; color: #7d2d20; border-radius: 6px; padding: 10px; }
@media (max-width: 760px) {
  .topbar, .filters { grid-template-columns: 1fr; display: grid; align-items: stretch; }
}
`;
