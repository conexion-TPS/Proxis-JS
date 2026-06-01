'use client'

import React from 'react'

/* Renderer de markdown ligero, sin dependencias, para los documentos legales
   (encabezados, negritas, enlaces, listas, citas, reglas y tablas GFM).
   Cubre el subconjunto que usan los .md de Términos/Política/DPA/Consentimiento. */

function inline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Patrón combinado: **negrita**, `código`, [texto](url)
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1] !== undefined) {
      nodes.push(<strong key={`${keyBase}-b${i}`}>{m[1]}</strong>)
    } else if (m[2] !== undefined) {
      nodes.push(<code key={`${keyBase}-c${i}`} style={{ background: '#f0ede8', padding: '1px 5px', borderRadius: 4, fontSize: '0.9em' }}>{m[2]}</code>)
    } else if (m[3] !== undefined) {
      const href = m[4]
      nodes.push(<a key={`${keyBase}-a${i}`} href={href} style={{ color: '#1a56c4' }}>{m[3]}</a>)
    }
    last = re.lastIndex
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function splitRow(line: string): string[] {
  return line.replace(/^\||\|$/g, '').split('|').map(c => c.trim())
}

export default function MarkdownDoc({ md }: { md: string }) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Línea en blanco
    if (trimmed === '') { i++; continue }

    // Regla horizontal
    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid #e8e6e3', margin: '28px 0' }} />)
      i++; continue
    }

    // Encabezados
    const h = /^(#{1,4})\s+(.*)$/.exec(trimmed)
    if (h) {
      const level = h[1].length
      const sizes = [0, 30, 22, 17, 15]
      blocks.push(
        <div key={key++} style={{
          fontSize: sizes[level], fontWeight: level <= 2 ? 800 : 700,
          letterSpacing: '-0.02em', color: '#0b0a09',
          margin: level === 1 ? '0 0 16px' : '26px 0 10px',
        }}>{inline(h[2], `h${key}`)}</div>
      )
      i++; continue
    }

    // Tabla GFM
    if (trimmed.startsWith('|') && i + 1 < lines.length && /^\|?[\s:|-]+\|?$/.test(lines[i + 1].trim())) {
      const header = splitRow(trimmed)
      i += 2 // saltar header + separador
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i].trim())); i++
      }
      blocks.push(
        <div key={key++} style={{ overflowX: 'auto', margin: '14px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>{header.map((c, j) => (
                <th key={j} style={{ textAlign: 'left', padding: '8px 10px', background: '#fafaf7', border: '1px solid #e8e6e3', fontWeight: 700, color: '#0b0a09' }}>{inline(c, `th${key}-${j}`)}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{header.map((_, ci) => (
                  <td key={ci} style={{ padding: '8px 10px', border: '1px solid #e8e6e3', color: '#2b2926', verticalAlign: 'top' }}>{inline(r[ci] ?? '', `td${key}-${ri}-${ci}`)}</td>
                ))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Cita
    if (trimmed.startsWith('>')) {
      const quote: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, '')); i++
      }
      blocks.push(
        <blockquote key={key++} style={{ borderLeft: '3px solid #cbf135', background: '#fafaf7', padding: '10px 16px', margin: '14px 0', color: '#2b2926', fontSize: 14 }}>
          {inline(quote.join(' '), `q${key}`)}
        </blockquote>
      )
      continue
    }

    // Lista (ordenada o no)
    if (/^([-*]|\d+\.)\s+/.test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed)
      const items: string[] = []
      while (i < lines.length && /^([-*]|\d+\.)\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^([-*]|\d+\.)\s+/, '')); i++
      }
      const ListTag = (ordered ? 'ol' : 'ul') as 'ol' | 'ul'
      blocks.push(
        <ListTag key={key++} style={{ margin: '10px 0', paddingLeft: 22, color: '#2b2926', fontSize: 15, lineHeight: 1.7 }}>
          {items.map((it, j) => <li key={j} style={{ marginBottom: 4 }}>{inline(it, `li${key}-${j}`)}</li>)}
        </ListTag>
      )
      continue
    }

    // Párrafo
    blocks.push(
      <p key={key++} style={{ margin: '10px 0', color: '#2b2926', fontSize: 15, lineHeight: 1.7 }}>{inline(trimmed, `p${key}`)}</p>
    )
    i++
  }

  return <>{blocks}</>
}
