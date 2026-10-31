/**
 * Build stamp injected by electron-vite `define` (see electron.vite.config.ts).
 * `typeof` guards keep the module importable when the define is missing (tests, plain Node).
 */
declare const __BUILD_COMMIT__: string
declare const __BUILD_DATE__: string

export const BUILD_COMMIT: string = typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : 'unknown'
export const BUILD_DATE: string = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : 'unknown'
