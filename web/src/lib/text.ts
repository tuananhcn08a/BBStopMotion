/** Bỏ dấu tiếng Việt để so khớp tìm kiếm không phân biệt dấu — F7 (Library search). */
export function stripDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

export function matchesSearch(title: string, query: string): boolean {
  if (!query.trim()) return true
  return stripDiacritics(title).includes(stripDiacritics(query))
}
