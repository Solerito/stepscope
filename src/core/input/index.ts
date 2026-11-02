import type { InputField, InputSpec } from '../algorithm';

/** Error de entrada con un mensaje listo para mostrar al usuario. */
export class InputError extends Error {}

export function form<I extends object>(fields: { readonly [K in keyof I]: InputField<I[K]> }): InputSpec<I> {
  const defaults = {} as Record<string, unknown>;
  for (const name of Object.keys(fields)) {
    defaults[name] = (fields as Record<string, InputField<unknown>>)[name]?.default;
  }
  return { fields, default: defaults as I };
}

export interface IntArrayBounds {
  readonly minLength: number;
  readonly maxLength: number;
  readonly min: number;
  readonly max: number;
}

export interface IntArrayField extends InputField<readonly number[]>, IntArrayBounds {
  readonly kind: 'int-array';
  /** El algoritmo exige la entrada ordenada de menor a mayor, como la búsqueda binaria. */
  readonly sorted: boolean;
}

const ascending = (a: number, b: number) => a - b;

export function intArray(
  options: IntArrayBounds & { label?: string; default: readonly number[]; sorted?: boolean },
): IntArrayField {
  const { minLength, maxLength, min, max } = options;
  const sorted = options.sorted ?? false;
  const span = max - min + 1;
  // Los generadores dan valores pequeños y positivos, que se leen mejor, dentro del rango permitido.
  const lowest = Math.max(min, Math.min(max, 1));

  const randomValue = (random: () => number, high: number) =>
    lowest + Math.floor(random() * (Math.max(lowest, high) - lowest + 1));

  /** Los ejemplos suelen ser cortos: un generador sobre muy pocos valores no enseña nada. */
  const lengthFor = (current: readonly number[]) =>
    Math.min(maxLength, Math.max(minLength, current.length < 4 ? 12 : current.length));

  // Valores pequeños y legibles, salvo que el usuario haya elegido un array largo.
  const readableHigh = (length: number) => Math.min(max, Math.max(length * 2, 20));

  const randomArray = (random: () => number, current: readonly number[]) => {
    const length = lengthFor(current);
    return Array.from({ length }, () => randomValue(random, readableHigh(length)));
  };

  const withDuplicates = (random: () => number, current: readonly number[]) => {
    const length = lengthFor(current);
    const pool = Array.from({ length: Math.max(2, Math.ceil(length / 4)) }, () =>
      randomValue(random, Math.min(max, 20)),
    );
    return Array.from({ length }, () => pool[Math.floor(random() * pool.length)] as number);
  };

  const generators: NonNullable<IntArrayField['generators']> = sorted
    ? {
        Aleatorio: (random, current) => randomArray(random, current).sort(ascending),
        'Con duplicados': (random, current) => withDuplicates(random, current).sort(ascending),
      }
    : {
        Aleatorio: randomArray,
        Ordenado: (random, current) => randomArray(random, current).sort(ascending),
        Inverso: (random, current) => randomArray(random, current).sort((a, b) => b - a),
        'Con duplicados': withDuplicates,
      };

  return {
    kind: 'int-array',
    label: options.label ?? 'Array',
    default: options.default,
    minLength,
    maxLength,
    min,
    max,
    sorted,

    parse(text) {
      const tokens = text.split(/[\s,;]+/).filter(Boolean);
      return tokens.map((token) => {
        const value = Number(token);
        if (!Number.isInteger(value)) throw new InputError(`«${token}» no es un número entero.`);
        return value;
      });
    },

    format(value) {
      return value.join(',');
    },

    validate(value) {
      if (value.length < minLength || value.length > maxLength) {
        return `Escribe entre ${minLength} y ${maxLength} valores; ahora hay ${value.length}.`;
      }
      const outside = value.find((item) => item < min || item > max);
      if (outside !== undefined) return `${outside} se sale del rango: usa valores de ${min} a ${max}.`;
      if (sorted && value.some((item, index) => index > 0 && (value[index - 1] as number) > item)) {
        return 'Este algoritmo necesita el array ordenado de menor a mayor.';
      }
      return null;
    },

    generators,

    maximal() {
      const values = Array.from({ length: maxLength }, (_, i) => min + (i % span));
      return sorted ? values.sort(ascending) : values;
    },
  };
}

export interface IntField extends InputField<number> {
  readonly kind: 'int';
  readonly min: number;
  readonly max: number;
}

export function intInRange(options: {
  label: string;
  min: number;
  max: number;
  default: number;
  /** Configura el algoritmo, como una semilla, en vez de ser un dato: ver `InputField.variant`. */
  variant?: boolean;
}): IntField {
  const { min, max } = options;

  return {
    kind: 'int',
    label: options.label,
    default: options.default,
    min,
    max,
    variant: options.variant ?? false,

    parse(text) {
      const value = Number(text.trim());
      if (text.trim() === '' || !Number.isInteger(value)) {
        throw new InputError(`«${text}» no es un número entero.`);
      }
      return value;
    },

    format(value) {
      return String(value);
    },

    validate(value) {
      return value < min || value > max ? `Usa un valor de ${min} a ${max}.` : null;
    },

    maximal() {
      return max;
    },
  };
}

export interface ChoiceField<O extends string> extends InputField<O> {
  readonly kind: 'choice';
  /** Valor → texto que ve el usuario. */
  readonly options: Readonly<Record<O, string>>;
}

/** Una opción entre varias, como la regla del pivote de quicksort. Elige una variante, no un dato. */
export function choice<const O extends string>(options: {
  label: string;
  options: Readonly<Record<O, string>>;
  default: NoInfer<O>;
}): ChoiceField<O> {
  const keys = Object.keys(options.options) as O[];
  const isOption = (value: string): value is O => (keys as string[]).includes(value);

  return {
    kind: 'choice',
    label: options.label,
    default: options.default,
    options: options.options,
    variant: true,

    parse(text) {
      if (!isOption(text)) {
        throw new InputError(`«${text}» no es una opción válida: elige entre ${keys.join(', ')}.`);
      }
      return text;
    },

    format(value) {
      return value;
    },

    validate(value) {
      return isOption(value) ? null : `Elige entre ${keys.join(', ')}.`;
    },

    maximal() {
      return options.default;
    },
  };
}
