'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const frontendRoot = path.join(repoRoot, 'frontend');
const ignoredDirectories = new Set([
  '.git',
  '.firebase',
  'node_modules',
  'deployment-backup',
]);

const failures = [];
const warnings = [];

function relative(filePath) {
  return path.relative(repoRoot, filePath) || '.';
}

function walk(directory, predicate) {
  if (!fs.existsSync(directory)) return [];

  const files = [];

  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true,
  })) {
    if (
      entry.isDirectory() &&
      ignoredDirectories.has(entry.name)
    ) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath, predicate));
    } else if (entry.isFile() && predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
    ...options,
  });
}

function checkRequiredFiles() {
  const requiredFiles = [
    'AGENTS.md',
    'README.md',
    'PROJECT.md',
    'MEMORY.md',
    'ENDGAME.md',
    'ROADMAP.md',
    'docs/ARCHITECTURE.md',
    'docs/DEVELOPMENT.md',
    'docs/BASELINE_AUDIT.md',
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(repoRoot, file))) {
      failures.push(`Required project file is missing: ${file}`);
    }
  }

  console.log(`Required guidance: ${requiredFiles.length} checked`);
}

function checkNodeVersion() {
  const packageJson = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, 'backend', 'package.json'),
      'utf8'
    )
  );

  const declared = String(
    packageJson.engines?.node || ''
  ).trim();

  const currentMajor = Number(
    process.versions.node.split('.')[0]
  );

  const declaredMajorMatch = declared.match(/^(\d+)/);

  if (
    declaredMajorMatch &&
    currentMajor !== Number(declaredMajorMatch[1])
  ) {
    failures.push(
      `Node ${process.versions.node} does not match the declared ${declared} runtime.`
    );
  }

  console.log(
    `Node runtime: ${process.versions.node} (declared ${declared || 'unspecified'})`
  );
}

function checkJavaScript() {
  const files = walk(
    repoRoot,
    (file) => path.extname(file).toLowerCase() === '.js'
  );

  for (const file of files) {
    const result = run(process.execPath, ['--check', file]);

    if (result.status !== 0) {
      failures.push(
        `JavaScript syntax failed: ${relative(file)}\n${String(
          result.stderr || result.stdout
        ).trim()}`
      );
    }
  }

  console.log(`JavaScript syntax: ${files.length} files checked`);
}

function checkJson() {
  const files = walk(
    repoRoot,
    (file) => path.extname(file).toLowerCase() === '.json'
  );

  for (const file of files) {
    try {
      const source = fs
        .readFileSync(file, 'utf8')
        .replace(/^\uFEFF/, '');
      JSON.parse(source);
    } catch (error) {
      failures.push(
        `JSON parse failed: ${relative(file)} (${error.message})`
      );
    }
  }

  console.log(`JSON parsing: ${files.length} files checked`);
}

function isSkippableReference(reference) {
  return (
    !reference ||
    reference.startsWith('#') ||
    reference.startsWith('//') ||
    /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(reference) ||
    /\$\{|{{|<%/.test(reference)
  );
}

function localReferenceCandidates(htmlFile, rawReference) {
  const reference = rawReference
    .split('#')[0]
    .split('?')[0]
    .trim();

  if (!reference || reference.startsWith('/api/')) {
    return [];
  }

  let decoded = reference;

  try {
    decoded = decodeURIComponent(reference);
  } catch {
    // The browser may still receive the literal path. Check it as written.
  }

  const isFrontendSnippet = path
    .relative(frontendRoot, htmlFile)
    .split(path.sep)
    .includes('snippets');

  const referenceDirectory = isFrontendSnippet
    ? frontendRoot
    : path.dirname(htmlFile);

  const basePath = decoded.startsWith('/')
    ? path.resolve(frontendRoot, `.${decoded}`)
    : path.resolve(referenceDirectory, decoded);

  if (
    basePath !== frontendRoot &&
    !basePath.startsWith(`${frontendRoot}${path.sep}`)
  ) {
    return [];
  }

  const candidates = [basePath];

  if (decoded === '/' || decoded.endsWith('/')) {
    candidates.push(path.join(basePath, 'index.html'));
  }

  if (!path.extname(basePath)) {
    candidates.push(`${basePath}.html`);
    candidates.push(path.join(basePath, 'index.html'));
  }

  return [...new Set(candidates)];
}

function checkHtmlReferences() {
  const htmlFiles = walk(
    frontendRoot,
    (file) => path.extname(file).toLowerCase() === '.html'
  );

  const attributePattern = /\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi;
  let referenceCount = 0;

  for (const htmlFile of htmlFiles) {
    const source = fs.readFileSync(htmlFile, 'utf8');

    for (const match of source.matchAll(attributePattern)) {
      const reference = match[2].trim();

      if (isSkippableReference(reference)) continue;

      const candidates = localReferenceCandidates(
        htmlFile,
        reference
      );

      if (candidates.length === 0) continue;

      referenceCount += 1;

      if (!candidates.some((candidate) => fs.existsSync(candidate))) {
        failures.push(
          `Missing local reference in ${relative(htmlFile)}: ${reference}`
        );
      }
    }
  }

  console.log(
    `HTML local references: ${referenceCount} checked across ${htmlFiles.length} pages`
  );
}

function checkKpContentOsPublicPages() {
  const expectations = new Map([
    [
      'frontend/kp-content-os.html',
      [
        'AMAZ LEGACY SDN. BHD.',
        'kp-content-os-terms.html',
        'kp-content-os-privacy.html',
        'No automatic posting',
        'No patient data',
      ],
    ],
    [
      'frontend/kp-content-os-terms.html',
      [
        'id="english"',
        'id="bahasa-melayu"',
        'putrijayamediateam@gmail.com',
        'does not guarantee',
        'tidak menjamin',
      ],
    ],
    [
      'frontend/kp-content-os-privacy.html',
      [
        'id="english"',
        'id="bahasa-melayu"',
        'putrijayamediateam@gmail.com',
        'read-only TikTok integration',
        'integrasi TikTok read-only',
      ],
    ],
  ]);

  for (const [file, requiredText] of expectations) {
    const fullPath = path.join(repoRoot, file);

    if (!fs.existsSync(fullPath)) {
      failures.push(`Required KP Content OS public page is missing: ${file}`);
      continue;
    }

    const source = fs.readFileSync(fullPath, 'utf8');

    for (const text of requiredText) {
      if (!source.includes(text)) {
        failures.push(`Missing required KP Content OS text in ${file}: ${text}`);
      }
    }
  }

  const sharedFooter = fs.readFileSync(
    path.join(frontendRoot, 'js', 'main.js'),
    'utf8'
  );
  const sitemap = fs.readFileSync(
    path.join(frontendRoot, 'sitemap.xml'),
    'utf8'
  );

  for (const page of [
    'kp-content-os.html',
    'kp-content-os-terms.html',
    'kp-content-os-privacy.html',
  ]) {
    if (!sharedFooter.includes(`href="${page}"`)) {
      failures.push(`Shared footer is missing KP Content OS link: ${page}`);
    }
  }

  for (const canonical of [
    'https://klinikputrijaya.com/kp-content-os',
    'https://klinikputrijaya.com/kp-content-os-terms',
    'https://klinikputrijaya.com/kp-content-os-privacy',
  ]) {
    if (!sitemap.includes(`<loc>${canonical}</loc>`)) {
      failures.push(`Sitemap is missing KP Content OS URL: ${canonical}`);
    }
  }

  console.log(`KP Content OS public pages: ${expectations.size} checked`);
}

function checkTrackedSecrets() {
  const safeDirectory = repoRoot.replaceAll('\\', '/');
  const result = run('git', [
    '-c',
    `safe.directory=${safeDirectory}`,
    '-C',
    repoRoot,
    'ls-files',
  ]);

  if (result.status !== 0) {
    warnings.push(
      `Tracked-secret filename check skipped: ${String(
        result.stderr || result.stdout
      ).trim()}`
    );
    return;
  }

  const trackedFiles = result.stdout
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);

  const forbidden = trackedFiles.filter((file) => {
    const normalized = file.replaceAll('\\', '/');
    const baseName = path.posix.basename(normalized);

    if (/\.env\.example$/i.test(normalized)) return false;

    return (
      /(^|\/)\.env(?:\.|$)/i.test(normalized) ||
      /(^|\/)credentials?(\/|$)/i.test(normalized) ||
      /(?:private[-_]?key|service[-_]?account|google[-_]?search).*\.json$/i.test(
        baseName
      )
    );
  });

  for (const file of forbidden) {
    failures.push(`Forbidden tracked secret/credential filename: ${file}`);
  }

  console.log(
    `Tracked secret filenames: ${trackedFiles.length} tracked paths checked`
  );
}

function checkGitWhitespace() {
  const safeDirectory = repoRoot.replaceAll('\\', '/');
  const result = run('git', [
    '-c',
    `safe.directory=${safeDirectory}`,
    '-C',
    repoRoot,
    'diff',
    '--check',
  ]);

  if (result.status !== 0) {
    failures.push(
      `git diff --check failed:\n${String(
        result.stdout || result.stderr
      ).trim()}`
    );
  } else {
    console.log('Git whitespace: clean');
  }
}

// Patient-facing WhatsApp wording from the admin Bookings inbox.
function checkWhatsAppMessages() {
  const { buildMessage } = require(path.join(frontendRoot, 'js', 'booking-whatsapp-message.js'));
  const today = '2026-11-23'; // a Monday
  const base = {
    patient_name: 'NADZIRAH BINTI YAHYA',
    gender: 'female',
    branch_name: 'Klinik Putrijaya Cheras',
    preferred_time: '18:30:00',
  };
  const cases = [
    [{ status: 'pending', preferred_date: '2026-11-24' },
      'Assalamualaikum Puan Nadzirah, saya dari Klinik Putrijaya Cheras. Puan ada buat temujanji dengan kami esok, pukul 6.30 petang kan? Saya nak confirmkan, puan boleh datang ya?'],
    [{ status: 'pending', preferred_date: '2026-12-11' },
      'Assalamualaikum Puan Nadzirah, saya dari Klinik Putrijaya Cheras. Puan ada buat temujanji dengan kami pada Jumaat, 11 Disember, pukul 6.30 petang kan? Saya nak confirmkan, puan boleh datang ya?'],
    [{ status: 'confirmed', preferred_date: '2026-11-23' },
      'Hi Puan Nadzirah, Klinik Putrijaya Cheras ni. Nak ingatkan, puan ada temujanji hari ni, pukul 6.30 petang ya. Kalau ada apa-apa perubahan, WhatsApp je kami. Jumpa nanti 😊'],
    [{ status: 'confirmed', preferred_date: '2026-11-27' },
      'Hi Puan Nadzirah, Klinik Putrijaya Cheras ni. Nak ingatkan, puan ada temujanji hari Jumaat ni, 27 November, pukul 6.30 petang ya. Kalau ada apa-apa perubahan, WhatsApp je kami. Jumpa nanti 😊'],
    [{ status: 'confirmed', preferred_date: '2026-11-22' },
      'Assalamualaikum Puan Nadzirah, saya dari Klinik Putrijaya Cheras. Temujanji puan semalam, pukul 6.30 petang dah lepas. Kalau puan masih nak datang, bagitahu je masa yang sesuai, nanti kami aturkan semula ya.'],
    [{ status: 'pending', preferred_date: '2026-11-16' },
      'Assalamualaikum Puan Nadzirah, saya dari Klinik Putrijaya Cheras. Temujanji puan pada Isnin, 16 November, pukul 6.30 petang dah lepas. Kalau puan masih nak datang, bagitahu je masa yang sesuai, nanti kami aturkan semula ya.'],
    [{ status: 'completed', preferred_date: '2026-11-23' },
      'Assalamualaikum Puan Nadzirah, terima kasih sebab datang ke Klinik Putrijaya Cheras tadi. Semoga cepat sembuh ya. Kalau ada apa-apa soalan lepas rawatan, WhatsApp je kami.'],
    [{ status: 'cancelled', preferred_date: '2026-11-16' },
      'Assalamualaikum Puan Nadzirah, saya dari Klinik Putrijaya Cheras. Temujanji puan pada Isnin, 16 November, pukul 6.30 petang dah dibatalkan. Kalau puan nak buat temujanji baru, bagitahu je masa yang sesuai, nanti kami aturkan ya.'],
    [{ status: 'pending', preferred_date: '2026-11-24', patient_name: 'Muhammad Amirul bin Abdullah', gender: 'male', branch_name: 'Sungai Besi', preferred_time: '09:00' },
      'Assalamualaikum Encik Muhammad Amirul, saya dari Klinik Putrijaya Sungai Besi. Encik ada buat temujanji dengan kami esok, pukul 9 pagi kan? Saya nak confirmkan, encik boleh datang ya?'],
    [{ status: 'pending', preferred_date: '2026-11-25', patient_name: 'Kavitha a/p Raman', branch_name: 'Puchong', preferred_time: '20:00' },
      'Assalamualaikum Puan Kavitha, saya dari Klinik Putrijaya Puchong. Puan ada buat temujanji dengan kami hari Rabu ni, 25 November, pukul 8 malam kan? Saya nak confirmkan, puan boleh datang ya?'],
    [{ status: 'pending', preferred_date: '2026-11-24', patient_name: 'AHMAD AL-AMIN BIN ZAKARIA', gender: 'male' },
      'Assalamualaikum Encik Ahmad Al-Amin, saya dari Klinik Putrijaya Cheras. Encik ada buat temujanji dengan kami esok, pukul 6.30 petang kan? Saya nak confirmkan, encik boleh datang ya?'],
    [{ status: 'confirmed', preferred_date: '2026-11-23', patient_name: 'Lim Wei Ming', gender: '', branch_name: 'Puchong', preferred_time: '12:30' },
      'Hi Lim Wei Ming, Klinik Putrijaya Puchong ni. Nak ingatkan, tuan/puan ada temujanji hari ni, pukul 12.30 tengah hari ya. Kalau ada apa-apa perubahan, WhatsApp je kami. Jumpa nanti 😊'],
  ];

  for (const [overrides, expected] of cases) {
    const booking = { ...base, ...overrides };
    const actual = buildMessage(booking, today);

    if (actual !== expected) {
      failures.push(
        `WhatsApp message for ${booking.status} on ${booking.preferred_date} changed:\n` +
        `  expected: ${expected}\n  actual:   ${actual}`
      );
    }
  }

  const { whatsappNumber } = require(path.join(frontendRoot, 'js', 'booking-whatsapp-message.js'));
  const numbers = [
    ['012-345 6789', '60123456789'],
    ['+6012-345 6789', '60123456789'],
    ['6012 345 6789', '60123456789'],
    ['12-345 6789', '60123456789'],
    ['03-9876 5432', '60398765432'],
    ['+65 9123 4567', '6591234567'],
    ['0065 9123 4567', '6591234567'],
    ['+44 7911 123456', '447911123456'],
    ['', ''],
  ];

  for (const [phone, expected] of numbers) {
    const actual = whatsappNumber(phone);

    if (actual !== expected) {
      failures.push(`WhatsApp number for "${phone}" should be "${expected}", got "${actual}"`);
    }
  }

  console.log(`WhatsApp messages: ${cases.length} checked, numbers: ${numbers.length} checked`);
}

console.log(`Checking repository: ${repoRoot}`);

checkRequiredFiles();
checkNodeVersion();
checkJavaScript();
checkJson();
checkHtmlReferences();
checkKpContentOsPublicPages();
checkWhatsAppMessages();
checkTrackedSecrets();
checkGitWhitespace();

for (const warning of warnings) {
  console.warn(`WARN: ${warning}`);
}

if (failures.length > 0) {
  console.error(`\nProject checks failed (${failures.length}):`);

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exitCode = 1;
} else {
  console.log('\nProject checks passed.');
}
