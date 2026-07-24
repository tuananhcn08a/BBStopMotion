/**
 * T-XW21 — ánh xạ `ImportErrorCode` (`bbsprojArchive.ts`) → key i18n (`i18n.ts`), dùng chung bởi
 * `TransferScreen.tsx` (S6) và `App.tsx` (nhập nhanh từ sheet Dự án mới, §S2). Tách riêng module
 * (không phải const trong 1 file component) để tránh cảnh báo `react-refresh/only-export-components`
 * (fast refresh chỉ hoạt động đúng khi 1 file component CHỈ export component).
 */
import { ImportErrorCode } from './bbsprojArchive'
import { StringKey } from '../../i18n'

export const BBSPROJ_ERROR_LABEL_KEY: Record<ImportErrorCode, StringKey> = {
  fileTooLarge: 'bbsproj.error.fileTooLarge',
  invalidZip: 'bbsproj.error.invalidZip',
  unsupportedCompression: 'bbsproj.error.unsupportedCompression',
  schemaVersionTooNew: 'bbsproj.error.schemaVersionTooNew',
  invalidProjectData: 'bbsproj.error.invalidProjectData',
  tooManyFrames: 'bbsproj.error.tooManyFrames',
  frameFileTooLarge: 'bbsproj.error.frameFileTooLarge',
  totalTooLarge: 'bbsproj.error.totalTooLarge',
}
