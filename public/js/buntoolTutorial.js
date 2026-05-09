const TUTORIAL_KEY = 'buntool_tutorial_seen';

const STEPS = [
  {
    element: null,
    title: 'Welcome to BunTool',
    body: 'BunTool creates PDF bundles for use in court, tribunals, meetings and other legal settings. You give it the PDFs you need, and the bundle will be created automatically.',
  },
  {
    element: null,
    title: '🔒 Your documents stay private',
    body: 'Everything is handled entirely on your device. No files are uploaded and no information is transmitted anywhere. Your documents never leave your computer.',
  },
  {
    element: 'step-1-info',
    title: 'Step 1: Basic Information',
    body: 'Start by entering the bundle title, court, and claim number. Choose "Confidential" if you want a confidential label added to the title page.',
  },
  {
    element: 'file-drop-zone',
    title: 'Step 2: Add Your Documents',
    body: 'Add PDF documents by clicking the button, or dragging and dropping them here. They stay on your device — nothing is uploaded.',
  },
  {
    element: 'coversheet-section',
    title: 'Optional coversheet',
    body: 'If you have a pre-made cover page — a firm letterhead or a court-specific template — you can add it here. BunTool will place it before the index as the first page of the bundle.',
  },
  {
    element: 'file-table',
    title: 'Step 3: Review & Reorder',
    body: [
      'Here you can check document names and dates, and drag rows to reorder them. BunTool extracts dates from filenames automatically — click any title or date to edit it.',
      'It\'s best to save documents in a single folder and give them useful names including dates — like "Claim Form 2 June 2024.pdf" or "Witness Statement of A Smith 2026-03-22.pdf".',
    ],
    showPlaceholderRows: true,
  },
  {
    element: 'add-section-break-btn',
    title: 'Section Breaks',
    body: 'Add section breaks to divide your bundle into named parts — like "Part 1: Evidence". Drag them into the right position in the table.',
  },
  {
    element: 'step-4-choice',
    title: 'Step 4: Create Your Bundle',
    body: '"Create Bundle" generates your complete PDF with an index, page numbers, and bookmarks. "Preview Index" shows just the table of contents so you can check it first.',
  },
  {
    element: 'show-advanced-btn',
    title: 'Advanced Settings',
    body: 'Customise page numbering style, fonts, date formats, and more. You can save your preferred settings as defaults for future bundles.',
  },
  {
    element: 'edit-bundle-panel',
    title: 'Save & load controls',
    body: [
      '"Save progress" saves your current documents and settings to your browser\'s local storage — handy if you need to take a break mid-way.',
      '"Load saved progress" brings up a list of previous saves so you can pick up exactly where you left off. Saves are stored only on your device.',
    ],
  },
  {
    element: 'edit-bundle-panel',
    title: 'Load from a previous bundle',
    body: "If you have a finished BunTool bundle PDF, you can load it back in with \"Load from previous bundle\". BunTool will unpack the documents and restore your settings so you can continue editing.",
  },
];

let currentStep = 0;
let placeholderRowsAdded = false;

document.addEventListener('DOMContentLoaded', () => {
  if (!localStorage.getItem(TUTORIAL_KEY)) startTutorial();
});

function startTutorial() {
  buildUI();
  goToStep(0);
}

function buildUI() {
  const backdrop = document.createElement('div');
  backdrop.id = 'tutorial-backdrop';
  backdrop.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:10000',
    'background:rgba(0,0,0,0.55)', 'pointer-events:auto',
    'transition:clip-path 0.35s ease',
  ].join(';');
  backdrop.setAttribute('aria-hidden', 'true');

  const card = document.createElement('div');
  card.id = 'tutorial-card';
  card.style.cssText = [
    'position:fixed', 'z-index:10001',
    'bottom:20px', 'left:50%', 'transform:translateX(-50%)',
    'width:min(500px,calc(100vw - 24px))',
    'background:#fff', 'border-radius:16px',
    'box-shadow:0 24px 64px rgba(0,0,0,0.35)',
    'border:1px solid #e2e8f0',
    'font-family:inherit',
  ].join(';');
  card.innerHTML = `
    <div style="padding:20px 22px 18px;">
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px;">
        <div style="flex:1;min-width:0;">
          <div id="tut-counter" style="font-size:11px;color:#94a3b8;margin-bottom:3px;font-weight:500;"></div>
          <h3 id="tut-title" style="margin:0;font-size:15px;font-weight:700;color:#0f172a;line-height:1.3;"></h3>
        </div>
        <button id="tut-skip" style="flex-shrink:0;padding:7px 14px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-weight:600;color:#475569;cursor:pointer;white-space:nowrap;line-height:1;">
          Skip tutorial
        </button>
      </div>
      <p id="tut-body" style="margin:0 0 16px;font-size:13px;color:#475569;line-height:1.65;"></p>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div id="tut-dots" style="display:flex;gap:5px;flex-shrink:0;"></div>
        <div style="display:flex;gap:8px;">
          <button id="tut-prev" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-weight:500;color:#64748b;cursor:pointer;display:none;">
            ← Back
          </button>
          <button id="tut-next" style="padding:8px 22px;background:#ec4899;border:none;border-radius:8px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;">
            Next →
          </button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(backdrop);
  document.body.appendChild(card);

  document.getElementById('tut-skip').addEventListener('click', endTutorial);
  document.getElementById('tut-prev').addEventListener('click', () => goToStep(currentStep - 1));
  document.getElementById('tut-next').addEventListener('click', () => {
    if (currentStep === STEPS.length - 1) endTutorial();
    else goToStep(currentStep + 1);
  });
}

function goToStep(index) {
  currentStep = index;
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  document.getElementById('tut-counter').textContent = `Tutorial page ${index + 1} of ${STEPS.length}`;
  document.getElementById('tut-title').textContent = step.title;
  const bodyEl = document.getElementById('tut-body');
  const paras = Array.isArray(step.body) ? step.body : [step.body];
  bodyEl.innerHTML = paras.map((p, i) =>
    `<span style="${i > 0 ? 'display:block;margin-top:10px;' : ''}">${p}</span>`
  ).join('');
  document.getElementById('tut-next').textContent = isLast ? 'Finish ✓' : 'Next →';
  document.getElementById('tut-prev').style.display = index === 0 ? 'none' : '';

  const dots = document.getElementById('tut-dots');
  dots.innerHTML = STEPS.map((_, i) => {
    const active = i === index;
    return `<div style="width:${active ? 18 : 6}px;height:6px;border-radius:3px;background:${active ? '#ec4899' : '#cbd5e1'};transition:width 0.2s,background 0.2s;"></div>`;
  }).join('');

  clearPlaceholderRows();
  if (step.showPlaceholderRows) injectPlaceholderRows();

  const backdrop = document.getElementById('tutorial-backdrop');
  if (!backdrop) return;

  if (step.element) {
    const el = document.getElementById(step.element);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Wait for scroll to settle before measuring position
      setTimeout(() => updateSpotlight(el), 380);
    }
  } else {
    backdrop.style.clipPath = '';
  }
}

function updateSpotlight(el) {
  const backdrop = document.getElementById('tutorial-backdrop');
  if (!backdrop) return;
  const rect = el.getBoundingClientRect();
  const pad = 8;
  const t = Math.max(0, rect.top - pad);
  const l = Math.max(0, rect.left - pad);
  const b = Math.min(window.innerHeight, rect.bottom + pad);
  const r = Math.min(window.innerWidth, rect.right + pad);
  const w = window.innerWidth;
  const h = window.innerHeight;
  backdrop.style.clipPath = `polygon(0px 0px,0px ${h}px,${l}px ${h}px,${l}px ${t}px,${r}px ${t}px,${r}px ${b}px,${l}px ${b}px,${l}px ${h}px,${w}px ${h}px,${w}px 0px)`;
}

function injectPlaceholderRows() {
  const tbody = document.getElementById('file-table-body');
  if (!tbody) return;
  const rows = [
    { filename: 'claim-form-N1.pdf',           title: 'Claim Form (N1)',           date: '15 Jan 2024', pages: 4 },
    { filename: 'defence-2024-02-01.pdf',       title: 'Defence',                  date: '01 Feb 2024', pages: 7 },
    { filename: 'witness-statement-jones.pdf',  title: 'Witness Statement — Jones', date: '20 Mar 2024', pages: 12 },
  ];
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.dataset.tutorialPlaceholder = 'true';
    tr.style.opacity = '0.6';
    tr.innerHTML = `
      <td class="px-2 py-2"></td>
      <td class="px-3 py-2 text-xs text-gray-500">${r.filename}</td>
      <td class="px-4 py-2 text-xs text-gray-500">${r.title}</td>
      <td class="px-4 py-2 text-xs text-gray-500">${r.date}</td>
      <td class="px-4 py-2 text-xs text-gray-500 pages-cell">${r.pages}</td>
      <td class="px-4 py-2 text-xs text-gray-400">—</td>`;
    tbody.appendChild(tr);
  }
  placeholderRowsAdded = true;
}

function clearPlaceholderRows() {
  if (!placeholderRowsAdded) return;
  document.querySelectorAll('[data-tutorial-placeholder]').forEach(r => r.remove());
  placeholderRowsAdded = false;
}

function endTutorial() {
  clearPlaceholderRows();
  document.getElementById('tutorial-backdrop')?.remove();
  document.getElementById('tutorial-card')?.remove();
  localStorage.setItem(TUTORIAL_KEY, '1');
}
