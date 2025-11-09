// Helper to prefix all resource paths with BASE_PATH
export function withBasePath(path: string) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (!base || path.startsWith(base)) return path;
  if (!path.startsWith('/')) path = '/' + path;
  return base + path;
}