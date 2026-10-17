import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * Configuración de ESLint.
 *
 * Antes este archivo existía pero NINGUNA de sus dependencias estaba instalada:
 * el linter no se podía ejecutar y tampoco había script `lint` en package.json.
 * Por eso pasaban desapercibidos los imports sin usar y las variables muertas.
 *
 * Se añade eslint-plugin-react porque sin él ESLint no ve que un componente
 * usado en JSX está siendo usado, y marcaba como "definido pero nunca usado"
 * a App, BrowserRouter y compañía.
 */
export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // El proyecto no usa PropTypes; el contrato de props se documenta en
      // comentarios. Activarlo generaría cientos de avisos sin valor añadido.
      'react/prop-types': 'off',
      // Aviso, no error: hay variables muertas heredadas y romper el build por
      // ellas impediría usar el linter como herramienta de mejora progresiva.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Dentro del Canvas de React Three Fiber, <primitive object>,
    // <ambientLight intensity> o <directionalLight position> son props de
    // three.js, no atributos DOM. Solo se relaja en la carpeta del visor 3D.
    files: ['src/Components/three/**/*.{js,jsx}'],
    rules: {
      'react/no-unknown-property': ['error', {
        ignore: ['object', 'intensity', 'position', 'rotation', 'args', 'dispose'],
      }],
    },
  },
])
