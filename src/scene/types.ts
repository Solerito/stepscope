import type { Frame, Role, TraceHeader, ViewSpec } from '@/core';

export type SceneId = string;

export interface SceneBox {
  kind: 'box';
  id: SceneId;
  shape: 'rect' | 'circle';
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  labelSize?: number;
  /** Dentro de la caja o encima: una barra estrecha no admite el texto dentro. */
  labelAt?: 'center' | 'top';
  badge?: string;
  role?: Role;
  /** Se apaga cuando el glifo sería ruido: barras muy estrechas, o si la posición ya lo dice. */
  showGlyph?: boolean;
  /** Caja desde la que entra: así sube un valor devuelto o se copia un elemento. */
  enterFrom?: SceneId;
  opacity?: number;
}

/** Une dos cajas por ID, sin coordenadas: sigue a sus extremos durante cualquier transición. */
export interface SceneLink {
  kind: 'link';
  id: SceneId;
  from: SceneId;
  to: SceneId;
  directed?: boolean;
  label?: string;
  role?: Role;
  opacity?: number;
}

export interface SceneText {
  kind: 'text';
  id: SceneId;
  x: number;
  y: number;
  text: string;
  size?: number;
  role?: Role;
  opacity?: number;
}

export type SceneNode = SceneBox | SceneLink | SceneText;

export interface Scene {
  readonly nodes: readonly SceneNode[];
}

export const EMPTY_SCENE: Scene = { nodes: [] };

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface ViewDefinition {
  readonly kinds: readonly ViewSpec['view'][];
  /** Se ejecuta una vez por traza: aquí se calcula, por ejemplo, la disposición del árbol final. */
  prepare?(header: TraceHeader, finalState: Frame['state'], viewport: Viewport, spec: ViewSpec): unknown;
  /** Función pura: mismo frame, mismo resultado. Se prueba sin navegador. */
  build(frame: Frame, spec: ViewSpec, viewport: Viewport, prepared: unknown): Scene;
  /** Primitivas máximas previstas: decide entre SVG y Canvas. */
  estimate(header: TraceHeader, finalState: Frame['state']): number;
  /** El estado en palabras, para lectores de pantalla. */
  describe(frame: Frame, spec: ViewSpec): string;
}

export interface Renderer {
  /** Solo toca lo que difiere de lo último pintado. */
  paint(scene: Scene): void;
  resize(viewport: Viewport): void;
  destroy(): void;
}
