/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** NAS upload endpoint — e.g. https://bb-share.bapbean.com/api/upload */
  readonly VITE_UPLOAD_ENDPOINT: string
  /** Shared upload token sent as X-Upload-Token header. Never commit the real value. */
  readonly VITE_UPLOAD_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
