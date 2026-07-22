import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

/**
 * Import boundaries enforce ARCHITECTURE.md 1.2 and CLAUDE.md law 2. Do not
 * relax them to unblock a feature -- a boundary that gets in the way is
 * usually telling you the code is in the wrong folder.
 *
 * A boundary rule nobody has seen reject anything is not a proven boundary.
 * `pnpm verify:boundaries` writes temporary files that deliberately break each
 * rule, asserts ESLint rejects every one of them, and deletes them again. If
 * this config is ever accidentally loosened, that script fails in CI instead of
 * the architecture quietly eroding.
 *
 * Element order matters: the first matching pattern wins, so narrow patterns
 * (core/money, a module's domain, a module's index.ts) are listed before the
 * broader ones they sit inside.
 */
const elements = [
  { type: 'core-money', pattern: 'src/core/money' },
  { type: 'core-errors', pattern: 'src/core/errors' },
  { type: 'core', pattern: 'src/core' },
  { type: 'lib', pattern: 'src/lib' },
  // domain/ is its own element type, not just a folder inside a module. That is
  // what keeps it from inheriting the looser rules the rest of a module gets.
  { type: 'module-domain', pattern: 'src/modules/*/domain', capture: ['module'] },
  { type: 'module', pattern: 'src/modules/*', capture: ['module'] },
  { type: 'app', pattern: 'src/app' },
];

const el = (type) => ({ element: { type } });
const anyOf = (...types) => types.map((type) => ({ element: { type } }));

/** Another module, reachable only through its public index.ts. */
const PUBLIC_API = { element: { type: 'module', fileInternalPath: 'index.ts' } };

/**
 * A module's server-to-server API (server.ts), for narrow reads another
 * module's own server-side code needs (ARCHITECTURE.md 1.2's own example,
 * e.g. `projects.getMilestoneFunding(projectId)`) but that must never reach
 * a 'use client' file: unlike index.ts, nothing in app/ may import this --
 * see the 'app' policy below, which allows PUBLIC_API but not this.
 */
const SERVER_API = { element: { type: 'module', fileInternalPath: 'server.ts' } };

/** Any file inside the importing file's own module. */
const OWN_MODULE = {
  element: { type: 'module', captured: { module: '{{ from.element.captured.module }}' } },
};

/** The importing file's own domain/ folder. */
const OWN_DOMAIN = {
  element: { type: 'module-domain', captured: { module: '{{ from.element.captured.module }}' } },
};

const CORE_ANY = ['core', 'core-money', 'core-errors'];
const NON_LOCAL = { module: { origin: ['external', 'core'] } };

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'src/core/db/database.types.ts',
      'next-env.d.ts',
    ],
  },

  js.configs.recommended,

  // Type-aware linting, restricted to the app source. Config files at the repo
  // root are not in the TS project and would otherwise fail to parse.
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts', 'supabase/tests/**/*.ts', 'e2e/**/*.ts'],
  })),
  {
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts', 'supabase/tests/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Import boundaries (ARCHITECTURE.md 1.2)
  //
  // Policies are evaluated last-write-wins: a later policy overrides an
  // earlier one for the same dependency. The domain-purity policies are
  // therefore last, so nothing below can re-open them.
  // -------------------------------------------------------------------------
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': elements,
      'boundaries/include': ['src/**/*'],
      // Without this, the plugin cannot resolve `@/...` imports to a local
      // file, so it classifies every one of them as an external package --
      // which silently ALLOWS every cross-module and app-into-module-internals
      // violation (they get swept into the "third-party is unrestricted"
      // policy below) and, just as bad, silently BLOCKS legitimate local
      // imports from domain/ (they get swept into the "no infrastructure"
      // disallow). scripts/verify-boundaries.ts is what caught this -- five of
      // its checks failed silently before this was configured correctly.
      //
      // The deprecated `boundaries/alias` setting looks like the obvious fix
      // and takes a config value without complaint, but it is dead code in v7
      // -- it only emits the deprecation warning and resolves nothing (read
      // Settings/Settings.js: deprecateAlias does exactly one thing, warn).
      // `import/resolver` plus a real resolver package is the only path that
      // works, which is why eslint-import-resolver-typescript is a direct
      // devDependency rather than a transitive one pulled in by
      // eslint-config-next -- relying on a transitive dependency here would
      // make this silently break again on an unrelated dependency bump.
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkAllOrigins: true,
          message:
            '{{ from.element.type }} may not import {{ to.element.type }}. See ARCHITECTURE.md 1.2.',
          policies: [
            // Third-party and node builtins are unrestricted by default. The
            // domain layer takes this away again at the bottom of the list.
            { allow: { to: NON_LOCAL } },

            // lib sits at the bottom of the stack: generic utilities, no domain.
            { from: el('lib'), allow: anyOf('lib') },

            // core/money and core/errors are the only core pieces the domain
            // layer may reach, so they must stay dependency-light themselves.
            { from: el('core-money'), allow: anyOf('core-money', 'core-errors', 'lib') },
            { from: el('core-errors'), allow: anyOf('core-errors', 'lib') },

            // core is the shared kernel. It knows nothing about any domain module.
            { from: el('core'), allow: anyOf(...CORE_ANY, 'lib') },

            // The functional core: pure decision logic.
            {
              from: el('module-domain'),
              allow: [...anyOf('core-money', 'core-errors', 'lib'), OWN_DOMAIN],
              message:
                "domain/ is pure logic. Allowed: core/money, core/errors, lib, and this module's own domain files. See ARCHITECTURE.md 4.1.",
            },

            // A module may use core, lib, anything inside itself, and other
            // modules only through their public index.ts or server.ts.
            // Another module's internals match no allow entry, so they are
            // rejected by default.
            {
              from: el('module'),
              allow: [...anyOf(...CORE_ANY, 'lib'), PUBLIC_API, SERVER_API, OWN_MODULE, OWN_DOMAIN],
              message:
                "A module may only reach another module through its public index.ts (or server.ts, for a server-only read). See ARCHITECTURE.md 1.2.",
            },

            // Routing is thin: core, lib, and module public APIs only.
            {
              from: el('app'),
              allow: [...anyOf(...CORE_ANY, 'lib', 'app'), PUBLIC_API],
              message:
                "app/ may import core, lib, and a module's public index.ts -- never a module's internals. See ARCHITECTURE.md 1.1.",
            },

            // Domain purity, last so nothing above can undo it: no supabase,
            // no react, no next, no node builtins.
            {
              from: el('module-domain'),
              disallow: { to: NON_LOCAL },
              message:
                'domain/ must stay free of infrastructure -- no supabase, react, next, or node builtins. Move the I/O to data/ or actions/. See CLAUDE.md 0.2.',
            },
            // Zod is the one exception: schema types, no I/O.
            {
              from: el('module-domain'),
              allow: { to: { module: { source: 'zod' } } },
            },
            // vitest is the other: a domain *test* file (funding-coverage.test.ts
            // next to funding-coverage.ts) legitimately imports a test framework
            // to exercise pure logic -- categorically different from the source
            // file importing infrastructure, which this whole block still blocks.
            // Nothing but a .test.ts file ever imports vitest, so this can't
            // widen what a domain *source* file is allowed to reach.
            {
              from: el('module-domain'),
              allow: { to: { module: { source: 'vitest' } } },
            },
          ],
        },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // The domain layer must be deterministic: time is always a parameter, never
  // read from the ambient clock (ARCHITECTURE.md 4.1).
  // -------------------------------------------------------------------------
  {
    files: ['src/modules/*/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Pass time in as a parameter. domain/ must be deterministic.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message: 'Pass time in as a parameter. domain/ must be deterministic.',
        },
        {
          object: 'Math',
          property: 'random',
          message: 'Pass randomness in as a parameter. domain/ must be deterministic.',
        },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Money is bigint (CLAUDE.md law 1). Guard the two ways that quietly breaks.
  // core/money itself is exempt: it is where the conversions legitimately live.
  // -------------------------------------------------------------------------
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/core/money/**/*'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='Number'] > Identifier[name=/([aA]mount|Rp)$/]",
          message:
            'Never widen a rupiah amount to Number -- it silently loses precision above 2^53. Use core/money. See CLAUDE.md 0.1.',
        },
        {
          // Scoped to a money-suggestive identifier appearing anywhere in
          // the call, the same heuristic the Number-widening rule above
          // already uses -- not a blanket ban on Math.round/floor/ceil
          // everywhere. Found while writing Fase 4's photo-compression
          // (image pixel dimensions) and storage-threshold (byte counts)
          // code: neither has anything to do with Rupiah, and the original
          // unscoped selector blocked them anyway, contradicting its own
          // message ("if this is money"). A real money case --
          // `Math.round(contractAmount)` -- still matches.
          selector:
            "CallExpression[callee.object.name='Math'][callee.property.name=/^(round|floor|ceil)$/]:has(Identifier[name=/([aA]mount|Rp)$/])",
          message:
            'Math.round/floor/ceil implies float arithmetic. If this is money, use the integer helpers in core/money. See CLAUDE.md 0.1.',
        },
      ],
    },
  },

  // Scripts and tests run in Node and are not part of the app's element graph.
  {
    files: ['scripts/**/*.ts', 'supabase/tests/**/*.ts', 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Root config files: parsed as TypeScript but outside the type-aware project.
  // `process` is declared explicitly rather than pulling in a `globals`
  // dependency for one identifier -- vitest.config.ts never needed it (no
  // process.env reference), playwright.config.ts is the first to.
  {
    files: ['*.ts', '*.mts'],
    languageOptions: { parser: tseslint.parser, globals: { process: 'readonly' } },
  },
);
