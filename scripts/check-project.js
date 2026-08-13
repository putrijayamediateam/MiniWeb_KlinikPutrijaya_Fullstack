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

console.log(`Checking repository: ${repoRoot}`);

checkRequiredFiles();
checkNodeVersion();
checkJavaScript();
checkJson();
checkHtmlReferences();
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
