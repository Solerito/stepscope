import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Simulación de daltonismo sobre las tinciones de la platina. Cada rol ya lleva glifo y patrón, así que
 * el color nunca es la única señal; esto comprueba además que el color tampoco engaña: las tinciones se
 * siguen distinguiendo entre sí y del fondo con cualquier tipo de daltonismo.
 */

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(tokens);
  if (!match?.[1]) throw new Error(`Falta el token --${name} en tokens.css`);
  return match[1];
}

type Rgb = readonly [number, number, number];
type Matrix = readonly [Rgb, Rgb, Rgb];

const toLinear = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const linearRgb = (hex: string): Rgb => [
  toLinear(Number.parseInt(hex.slice(1, 3), 16) / 255),
  toLinear(Number.parseInt(hex.slice(3, 5), 16) / 255),
  toLinear(Number.parseInt(hex.slice(5, 7), 16) / 255),
];

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const apply = (matrix: Matrix, [r, g, b]: Rgb): Rgb =>
  matrix.map((row) => clamp(row[0] * r + row[1] * g + row[2] * b)) as unknown as Rgb;

/** Machado, Oliveira y Fernandes (2009), con severidad 1: la forma completa de cada daltonismo. */
const DEFICIENCIES: Readonly<Record<string, (color: Rgb) => Rgb>> = {
  ninguno: (color) => color,
  protanopia: (color) =>
    apply(
      [
        [0.152286, 1.052583, -0.204868],
        [0.114503, 0.786281, 0.099216],
        [-0.003882, -0.048116, 1.051998],
      ],
      color,
    ),
  deuteranopia: (color) =>
    apply(
      [
        [0.367322, 0.860646, -0.227968],
        [0.280085, 0.672501, 0.047413],
        [-0.01182, 0.04294, 0.968881],
      ],
      color,
    ),
  tritanopia: (color) =>
    apply(
      [
        [1.255528, -0.076749, -0.178779],
        [-0.078411, 0.930809, 0.147602],
        [0.004733, 0.691367, 0.3039],
      ],
      color,
    ),
  acromatopsia: ([r, g, b]) => {
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return [luminance, luminance, luminance];
  },
};

/** OKLab: la distancia euclídea se parece a la diferencia que percibe el ojo. */
function oklab([r, g, b]: Rgb): Rgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const distance = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Unas cinco veces la diferencia mínima perceptible en OKLab (~0,02). Con la paleta de hoy, la pareja
 * más justa es hematoxilina frente a eosina sin color ninguno: 0,11.
 */
const MIN_DISTANCE = 0.1;

const SURFACES = ['stain-neutral', 'hematoxylin', 'eosin', 'ink', 'slide'] as const;

describe('las tinciones con daltonismo', () => {
  const pairs = SURFACES.flatMap((a, i) => SURFACES.slice(i + 1).map((b) => [a, b] as const));

  it.each(Object.keys(DEFICIENCIES))('se distinguen entre sí y del fondo: %s', (deficiency) => {
    const simulate = DEFICIENCIES[deficiency] as (color: Rgb) => Rgb;
    for (const [a, b] of pairs) {
      const apart = distance(oklab(simulate(linearRgb(token(a)))), oklab(simulate(linearRgb(token(b)))));
      expect(apart, `${a} frente a ${b}`).toBeGreaterThanOrEqual(MIN_DISTANCE);
    }
  });
});
