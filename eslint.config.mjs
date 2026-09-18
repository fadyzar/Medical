import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'supabase/functions/**', // Deno runtime — different globals and import style
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Unused args prefixed with _ are intentional (callback signatures, catch bindings).
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      // ── React Compiler rules: advisory, not gating ──────────────────────────
      // These fire almost entirely on patterns that are correct here:
      //   immutability      — `useEffect(() => { load() }, [])` with `load` declared
      //                       below it (runs after the body, so it is safe), and
      //                       `window.location.href = url` for a full navigation.
      //   set-state-in-effect — deliberate deferral of client-only values (e.g. the
      //                       clock in lib/hooks/useNow) to avoid hydration mismatch.
      //   purity            — `Date.now()` inside async event handlers, not render.
      // The genuine instances (time read during render, ref written during render)
      // are fixed. Kept as warnings so new violations stay visible without blocking.
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
]

export default config
