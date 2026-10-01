// Rebuilds index.html and assets/catalog.js from each mock's own <title>,
// description and mock-requirements meta tags, and <select data-mock-state> options.
// Usage: node docs/mocks/build-index.mjs   (no dependencies)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOCKS = dirname(fileURLToPath(import.meta.url));

const areas = [
  ['auth', 'Sign in and session', ['login.html']],
  ['shell', 'Shell and navigation', ['navigation.html', 'status-pages.html', 'unsaved-changes-dialog.html']],
  ['home', 'Home', ['home.html']],
  ['leads', 'Leads', ['lead-directory.html', 'lead-detail.html', 'lead-form-dialog.html', 'lead-delete-dialog.html']],
  ['projects', 'Projects', ['project-list.html', 'project-overview.html', 'project-form-dialog.html', 'mode-change-dialog.html', 'project-delete-dialog.html']],
  ['work', 'Work hierarchy', ['work-hierarchy.html', 'work-list.html', 'work-item-detail.html', 'work-item-form-dialog.html', 'reparent-dialog.html', 'move-position-dialog.html', 'work-item-delete-dialog.html']],
  ['backlog', 'Backlog', ['backlog.html']],
  ['kanban', 'Kanban', ['kanban-board.html', 'move-story-dialog.html', 'unfinished-tasks-dialog.html']],
  ['scrum', 'Scrum', ['sprints.html', 'sprint-form-dialog.html', 'sprint-planning.html', 'start-sprint-dialog.html', 'sprint-board.html', 'sprint-scope-dialog.html', 'close-sprint-dialog.html', 'sprint-history.html']],
  ['admin', 'Administration', ['accounts.html', 'account-detail.html', 'account-form-dialog.html', 'replace-password-dialog.html', 'account-status-dialog.html', 'audit-log.html']],
  ['feedback', 'Notifications and feedback', ['notifications.html']],
];

const coverage = [
  ['Sign in, sign out, and session end', ['auth/login.html', 'shell/navigation.html', 'shell/unsaved-changes-dialog.html']],
  ['Home summaries', ['home/home.html']],
  ['Lead directory, details, and forms', ['leads/lead-directory.html', 'leads/lead-detail.html', 'leads/lead-form-dialog.html', 'leads/lead-delete-dialog.html']],
  ['Projects and delivery mode', ['projects/project-list.html', 'projects/project-overview.html', 'projects/project-form-dialog.html', 'projects/mode-change-dialog.html', 'projects/project-delete-dialog.html']],
  ['Work hierarchy', ['work/work-hierarchy.html', 'work/work-item-detail.html', 'work/work-item-form-dialog.html', 'work/reparent-dialog.html', 'work/work-item-delete-dialog.html']],
  ['Backlog prioritisation', ['backlog/backlog.html', 'work/move-position-dialog.html']],
  ['Kanban board', ['kanban/kanban-board.html', 'kanban/move-story-dialog.html', 'kanban/unfinished-tasks-dialog.html']],
  ['Scrum planning, board, and closure', ['scrum/sprints.html', 'scrum/sprint-form-dialog.html', 'scrum/sprint-planning.html', 'scrum/start-sprint-dialog.html', 'scrum/sprint-board.html', 'scrum/sprint-scope-dialog.html', 'scrum/close-sprint-dialog.html', 'scrum/sprint-history.html']],
  ['Account management and audit', ['admin/accounts.html', 'admin/account-detail.html', 'admin/account-form-dialog.html', 'admin/replace-password-dialog.html', 'admin/account-status-dialog.html', 'admin/audit-log.html']],
  ['Feedback, errors, and pop-ups', ['feedback/notifications.html', 'shell/status-pages.html']],
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const meta = (html, name) => decode(html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`))?.[1] ?? '');

const catalog = [];
const missing = [];
for (const [folder, area, files] of areas) {
  for (const name of files) {
    const path = `${folder}/${name}`;
    const full = join(MOCKS, path);
    if (!existsSync(full)) { missing.push(path); continue; }
    const html = readFileSync(full, 'utf8');
    const title = decode((html.match(/<title>([^<]*)<\/title>/)?.[1] ?? name).replace(/\s*·\s*Mission Control mock\s*$/, ''));
    const select = html.match(/<select data-mock-state>([\s\S]*?)<\/select>/)?.[1] ?? '';
    const states = [...select.matchAll(/<option value="([^"]+)"[^>]*>([^<]*)<\/option>/g)].map((m) => ({ id: m[1], label: decode(m[2].trim()) }));
    catalog.push({
      area, folder, path, title,
      dialog: /role="(alert)?dialog"/.test(html),
      description: meta(html, 'description'),
      requirements: meta(html, 'mock-requirements'),
      states,
    });
  }
}

const byPath = Object.fromEntries(catalog.map((m) => [m.path, m]));
const stateCount = catalog.reduce((n, m) => n + m.states.length, 0);

const card = (m) => `          <li class="mc-card mock-index__item">
            <div class="mc-cluster mc-cluster--between">
              <h3 class="mc-h4"><a href="${m.path}">${esc(m.title)}</a></h3>
              <span class="mc-pill${m.dialog ? ' mc-pill--info' : ''}">${m.dialog ? 'Dialog' : 'Page'}</span>
            </div>
            <p class="mc-text-sm mc-muted">${esc(m.description)}</p>
            <p class="mc-text-xs mc-muted">${esc(m.requirements)}</p>
            <ul class="mock-index__states" aria-label="States of ${esc(m.title)}">
${m.states.map((s) => `              <li><a href="${m.path}#state=${s.id}">${esc(s.label)}</a></li>`).join('\n')}
            </ul>
            <p class="mc-text-sm"><a href="viewer.html?mock=${encodeURIComponent(m.path)}">Preview at 320–1920px</a></p>
          </li>`;

const groups = areas
  .map(([folder, area]) => [area, catalog.filter((m) => m.folder === folder)])
  .filter(([, list]) => list.length)
  .map(([area, list]) => `      <section class="mock-index__group" aria-labelledby="area-${list[0].folder}">
        <h2 id="area-${list[0].folder}">${esc(area)}</h2>
        <ul class="mock-index__list">
${list.map(card).join('\n')}
        </ul>
      </section>`).join('\n\n');

const coverageRows = coverage.map(([workflow, paths]) => `            <tr>
              <td class="mc-table__primary">${esc(workflow)}</td>
              <td data-label="Mocks">${paths.filter((p) => byPath[p]).map((p) => `<a href="${p}">${esc(byPath[p].title)}</a>`).join(' · ')}</td>
            </tr>`).join('\n');

const index = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mission Control mocks</title>
  <meta name="description" content="Catalog of Mission Control workflow mocks: every page, dialog, notification, and state.">
  <link rel="stylesheet" href="assets/tokens.css">
  <link rel="stylesheet" href="assets/mocks.css">
  <script src="assets/mocks.js" defer></script>
</head>
<body>
  <div class="mock-bar" role="region" aria-label="Mock controls">
    <span class="mock-bar__badge">MOCK</span>
    <span class="mock-bar__text"><span class="mock-bar__long">Design artifact · </span>Fictitious data · Nothing is saved</span>
    <div class="mock-bar__controls">
      <a href="viewer.html">Responsive viewer</a>
    </div>
  </div>

  <main class="mock-index" id="main">
    <header class="mock-index__hero">
      <p class="mc-eyebrow">FaithTech Toronto · Design artifact</p>
      <h1>Mission Control workflow mocks</h1>
      <p class="mc-muted">Static HTML mocks of every page, dialog, notification, and pop-up described in the
        <a href="../PRD.md">PRD</a> and <a href="../specs/L2.md">L2 requirements</a>: ${catalog.length} mocks with ${stateCount} states.
        Use the <strong>State</strong> menu in each mock's dark MOCK bar to switch between its states, or follow a state link below.</p>
    </header>

    <section class="mock-index__group" aria-labelledby="about-heading">
      <h2 id="about-heading">About these mocks</h2>
      <div class="mc-grid mc-grid--fit">
        <div class="mc-card mc-stack mc-stack--sm">
          <h3 class="mc-h4">Nothing here is live</h3>
          <p class="mc-text-sm mc-muted">Every mock is labelled MOCK. Forms never submit, nothing is saved or sent, and simulated
            results only change what the page shows. Contact and work data is fictitious (example.org addresses,
            555-01xx phone numbers); the only real identity is Quinntyne Brown, the City Lead.</p>
        </div>
        <div class="mc-card mc-stack mc-stack--sm">
          <h3 class="mc-h4">Responsive by design</h3>
          <p class="mc-text-sm mc-muted">Each mock adapts from 320px to 1920px without page-level horizontal scrolling. Review at
            375, 768, and 1440px in the <a href="viewer.html">responsive viewer</a>, or resize the browser. Design notes
            under the MOCK bar describe behaviour a picture can't show: focus, announcements, and rules.</p>
        </div>
        <div class="mc-card mc-stack mc-stack--sm">
          <h3 class="mc-h4">Tokens and language</h3>
          <p class="mc-text-sm mc-muted">Visual values come from the <code>--mc-</code> tokens in <a href="assets/tokens.css">assets/tokens.css</a>.
            The standalone design system will adopt them as its authoritative copy. Mocks are design artifacts: they are
            reviewed manually and have no tests.</p>
        </div>
      </div>
    </section>

    <section class="mock-index__group" aria-labelledby="coverage-heading">
      <h2 id="coverage-heading">L2-048 workflow coverage</h2>
      <div class="mc-table-wrap">
        <table class="mc-table mc-table--stack">
          <caption class="mc-visually-hidden">Workflows and the mocks that illustrate them</caption>
          <thead>
            <tr><th scope="col">Workflow</th><th scope="col">Mocks</th></tr>
          </thead>
          <tbody>
${coverageRows}
          </tbody>
        </table>
      </div>
    </section>

${groups}
  </main>
</body>
</html>
`;

writeFileSync(join(MOCKS, 'index.html'), index);
writeFileSync(join(MOCKS, 'assets/catalog.js'), `/* Generated mock manifest used by viewer.html. */\nwindow.MOCK_CATALOG = ${JSON.stringify(catalog.map(({ area, path, title, states }) => ({ area, path, title, states })), null, 2)};\n`);
console.log(`${catalog.length} mocks, ${stateCount} states`);
if (missing.length) {
  console.log(`missing: ${missing.join(', ')}`);
  process.exitCode = 1;
}
