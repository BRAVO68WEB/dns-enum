import { readFileSync } from 'fs'
import { join } from 'path'

let cachedWordlist: string[] | null = null

export function loadWordlist(maxEntries?: number): string[] {
  if (cachedWordlist) return cachedWordlist

  try {
    const wordlistPath = join(process.cwd(), 'data', 'subdomains-top1million-full.txt')
    const content = readFileSync(wordlistPath, 'utf-8')
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'))
    
    cachedWordlist = maxEntries ? lines.slice(0, maxEntries) : lines
    return cachedWordlist
  } catch {
    // Fallback to hardcoded top5000
    return []
  }
}

export function getWordlistSize(): number {
  return loadWordlist().length
}
