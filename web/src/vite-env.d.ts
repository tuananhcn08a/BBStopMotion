/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** NAS upload endpoint — e.g. https://bb-share.bapbean.com/api/upload */
  readonly VITE_UPLOAD_ENDPOINT: string
  /** Shared upload token sent as X-Upload-Token header. Never commit the real value. */
  readonly VITE_UPLOAD_TOKEN: string
  /**
   * Neo Steam embed — allowlist origin host cho phép nhận PRACTICE_CONTEXT/PRACTICE_EVENT_ACK
   * (comma-separated), vd "https://neo-steam.bapbean.com,http://localhost:5173". Xem
   * src/lib/neoSteamEmbed.ts + Embedded Practice App Contract §3.2 (T-218). Không set → app
   * KHÔNG tin bất kỳ context nào (an toàn mặc định), không ảnh hưởng standalone.
   */
  readonly VITE_NEO_STEAM_ORIGINS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
