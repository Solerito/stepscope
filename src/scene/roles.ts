import type { Role } from '@/core';

export type Pattern = 'solid' | 'hatch' | 'dots' | 'cross';
export type Stain = 'neutral' | 'hematoxylin' | 'eosin' | 'ink';
export type Outline = 'thin' | 'thick' | 'dashed' | 'double';

export interface RoleStyle {
  /** Para la leyenda y los lectores de pantalla. */
  readonly label: string;
  readonly glyph: string;
  readonly pattern: Pattern;
  readonly stain: Stain;
  readonly outline: Outline;
}

// U+FE0E pide la variante de texto: sin ella, iOS pinta ✎ y ✂ como emoji de colores.
const TEXT = '︎';

/**
 * Cada rol se distingue por glifo y patrón además de por su tinción: el color nunca es la única señal.
 * Al ser un Record, TypeScript obliga a definir el aspecto de cualquier rol nuevo.
 */
export const ROLE_STYLES: Readonly<Record<Role, RoleStyle>> = {
  active: { label: 'Activo', glyph: '●', pattern: 'solid', stain: 'hematoxylin', outline: 'thick' },
  compare: { label: 'Comparando', glyph: '?', pattern: 'solid', stain: 'eosin', outline: 'thick' },
  write: { label: 'Escribiendo', glyph: `✎${TEXT}`, pattern: 'dots', stain: 'eosin', outline: 'thick' },
  swap: { label: 'Intercambiando', glyph: '⇄', pattern: 'solid', stain: 'eosin', outline: 'double' },
  pivot: { label: 'Pivote', glyph: '◆', pattern: 'cross', stain: 'hematoxylin', outline: 'thick' },
  min: { label: 'Mínimo', glyph: '▾', pattern: 'dots', stain: 'hematoxylin', outline: 'thin' },
  sorted: { label: 'Ya en su sitio', glyph: '✓', pattern: 'hatch', stain: 'hematoxylin', outline: 'thin' },
  visited: { label: 'Visitado', glyph: '•', pattern: 'hatch', stain: 'neutral', outline: 'thin' },
  frontier: { label: 'Frontera', glyph: '◌', pattern: 'solid', stain: 'neutral', outline: 'dashed' },
  path: { label: 'Camino', glyph: '★', pattern: 'solid', stain: 'hematoxylin', outline: 'double' },
  discarded: { label: 'Descartado', glyph: '×', pattern: 'cross', stain: 'neutral', outline: 'thin' },
  waiting: { label: 'En espera', glyph: '…', pattern: 'solid', stain: 'neutral', outline: 'dashed' },
  done: { label: 'Terminada', glyph: '▲', pattern: 'solid', stain: 'neutral', outline: 'thin' },
  'base-case': { label: 'Caso base', glyph: '⊥', pattern: 'dots', stain: 'neutral', outline: 'thick' },
  'memo-hit': { label: 'Ya calculado', glyph: '⧉', pattern: 'solid', stain: 'eosin', outline: 'double' },
  pruned: { label: 'Podado', glyph: `✂${TEXT}`, pattern: 'cross', stain: 'eosin', outline: 'dashed' },
  conflict: { label: 'Conflicto', glyph: '!', pattern: 'hatch', stain: 'eosin', outline: 'thick' },
  returned: { label: 'Valor que sube', glyph: '↑', pattern: 'solid', stain: 'eosin', outline: 'thin' },
  'rb-red': { label: 'Rojo', glyph: 'R', pattern: 'solid', stain: 'eosin', outline: 'thin' },
  'rb-black': { label: 'Negro', glyph: 'N', pattern: 'solid', stain: 'ink', outline: 'thin' },
};
