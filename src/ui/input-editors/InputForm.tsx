import { useEffect, useId, useRef, useState } from 'react';
import { type ChoiceField, InputError, type InputField, type InputSpec } from '@/core';
import type { RegisteredAlgorithm } from '../../algorithms/registry';
import styles from './InputForm.module.css';

const APPLY_DELAY_MS = 250;

type InputValue = Record<string, unknown>;

// biome-ignore lint/suspicious/noExplicitAny: el registro de algoritmos es heterogéneo
const fieldsOf = (spec: InputSpec<any>) => Object.entries(spec.fields) as [string, InputField<unknown>][];

/** La entrada que indica la URL. Lo que no se entienda se sustituye por su valor por defecto. */
// biome-ignore lint/suspicious/noExplicitAny: el registro de algoritmos es heterogéneo
export function inputFromParams(spec: InputSpec<any>, params: Readonly<Record<string, string>>): InputValue {
  const input: InputValue = {};
  for (const [name, field] of fieldsOf(spec)) {
    const text = params[name];
    input[name] = field.default;
    if (text === undefined) continue;
    try {
      const parsed = field.parse(text);
      if (field.validate(parsed) === null) input[name] = parsed;
    } catch (error) {
      if (!(error instanceof InputError)) throw error;
    }
  }
  return input;
}

// biome-ignore lint/suspicious/noExplicitAny: el registro de algoritmos es heterogéneo
export function paramsFromInput(spec: InputSpec<any>, input: InputValue): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [name, field] of fieldsOf(spec)) params[name] = field.format(input[name]);
  return params;
}

interface FieldEditorProps {
  readonly name: string;
  readonly field: InputField<unknown>;
  readonly value: unknown;
  readonly onChange: (value: unknown) => void;
}

function FieldEditor({ name, field, value, onChange }: FieldEditorProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const [text, setText] = useState(() => field.format(value));
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Cuando cambia desde fuera (un ejemplo, un generador), el texto se pone al día.
  useEffect(() => {
    setText(field.format(value));
    setError(null);
  }, [field, value]);

  const apply = (next: string) => {
    setText(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        const parsed = field.parse(next);
        const problem = field.validate(parsed);
        setError(problem);
        if (problem === null) onChange(parsed);
      } catch (caught) {
        if (!(caught instanceof InputError)) throw caught;
        setError(caught.message);
      }
    }, APPLY_DELAY_MS);
  };

  const generators = Object.entries(field.generators ?? {});

  if (field.kind === 'choice') {
    const { options } = field as unknown as ChoiceField<string>;
    return (
      <div className={styles.field}>
        <label className={styles.label} htmlFor={id}>
          {field.label}
        </label>
        <select
          id={id}
          name={name}
          className={styles.select}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        >
          {Object.entries(options).map(([option, label]) => (
            <option key={option} value={option}>
              {label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {field.label}
      </label>
      <input
        id={id}
        name={name}
        className={styles.text}
        type="text"
        inputMode={field.kind === 'int' ? 'numeric' : 'text'}
        autoComplete="off"
        spellCheck={false}
        value={text}
        aria-invalid={error !== null}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => apply(event.target.value)}
      />
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {generators.length > 0 ? (
        <div className={styles.generators}>
          {generators.map(([label, generate]) => (
            <button
              key={label}
              type="button"
              className={styles.generator}
              onClick={() => onChange(generate(Math.random, value))}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface Props {
  readonly algorithm: RegisteredAlgorithm;
  readonly value: InputValue;
  readonly onChange: (value: InputValue) => void;
}

export function InputForm({ algorithm, value, onChange }: Props) {
  const examples = algorithm.examples ?? [];
  const exampleId = useId();

  return (
    <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
      {fieldsOf(algorithm.input).map(([name, field]) => (
        <FieldEditor
          key={name}
          name={name}
          field={field}
          value={value[name]}
          onChange={(next) => onChange({ ...value, [name]: next })}
        />
      ))}

      {examples.length > 1 ? (
        <div className={styles.field}>
          <label className={styles.label} htmlFor={exampleId}>
            Casos preparados
          </label>
          <select
            id={exampleId}
            className={styles.select}
            value=""
            onChange={(event) => {
              const example = examples[Number(event.target.value)];
              if (example) onChange(example.input);
            }}
          >
            <option value="" disabled>
              Elige un caso
            </option>
            {examples.map((example, index) => (
              <option key={example.name} value={index}>
                {example.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </form>
  );
}
