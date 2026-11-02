import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type InputField, sharedFields, variantFields } from '@/core';
import type { RegisteredAlgorithm } from '../../algorithms/registry';
import type { CompareEngine } from '../../player/compare';
import { formatCompareHash, type Params } from '../../routing/hash';
import { titleOf } from '../../views/registry';
import { TraceChannel } from '../../worker/client';
import { catalogOrder } from '../catalog';
import { FieldEditor } from '../input-editors/InputForm';
import formStyles from '../input-editors/InputForm.module.css';
import { CompareTable } from '../panels/CompareTable';
import { formatCount } from '../panels/CountersPanel';
import { Explanation } from '../panels/Explanation';
import { ViewPane } from '../stage/ViewPane';
import { CompareTransport } from '../transport/CompareTransport';
import { KeyboardHelp } from '../transport/KeyboardHelp';
import { ShareButton } from '../transport/ShareButton';
import type { TraceRequestState } from '../usePlayer';
import { useCompareEngine, useCompareState, useTrace, useTraceChannel } from '../usePlayer';
import { CatalogPage } from './CatalogPage';
import styles from './ComparePage.module.css';
import {
  type CompareInput,
  canCompare,
  compareInputFromParams,
  compareParams,
  defaultPartner,
  type Pair,
  partnersOf,
  resolvePair,
  SIDES,
  type Side,
} from './compare-model';

const URL_DELAY_MS = 500;
const LETTERS: Readonly<Record<Side, string>> = { a: 'A', b: 'B' };

/** Lo que pide el enlace, completado: si falta B se elige uno compatible, y si no lo hay se avisa. */
export function CompareRoute({ ids, params }: { readonly ids: readonly string[]; readonly params: Params }) {
  const resolved = resolvePair(ids);
  if (resolved.kind === 'unknown') return <CatalogPage notFound={resolved.id} />;
  if (resolved.kind === 'alone') return <AlonePage algorithm={resolved.algorithm} />;

  const [a, b] = resolved.pair;
  // Cambiar de algoritmo es navegar: la página empieza de cero con lo que diga el enlace nuevo.
  return <ComparePage key={`${a.id}/${b.id}`} pair={resolved.pair} params={params} />;
}

function AlonePage({ algorithm }: { readonly algorithm: RegisteredAlgorithm }) {
  return (
    <main className={styles.alone}>
      <a className={styles.brand} href="#/">
        StepScope
      </a>
      <h1 className={styles.title}>Comparar</h1>
      <p>
        {algorithm.meta.name} no tiene todavía con quién compararse: ningún otro algoritmo recibe la misma
        entrada.
      </p>
      <p>
        <a href={`#/${algorithm.id}`}>Volver a {algorithm.meta.name}</a>
      </p>
    </main>
  );
}

/** Navega a otra pareja conservando la entrada: lo que no valga para la nueva se queda en su valor por defecto. */
function navigate(ids: Pair<string>, params: Record<string, string>) {
  window.location.hash = formatCompareHash(ids, params);
}

interface PageProps {
  readonly pair: Pair<RegisteredAlgorithm>;
  readonly params: Params;
}

function ComparePage({ pair, params }: PageProps) {
  const [a, b] = pair;
  const shared = useMemo(() => sharedFields(a.input, b.input) ?? {}, [a, b]);
  const [input, setInput] = useState(() => compareInputFromParams([a, b], shared, params));

  const inputA = useMemo(() => ({ ...input.shared, ...input.a }), [input.shared, input.a]);
  const inputB = useMemo(() => ({ ...input.shared, ...input.b }), [input.shared, input.b]);

  const channelA = useTraceChannel(() => new TraceChannel());
  const channelB = useTraceChannel(() => new TraceChannel());
  const requestA = useTrace(a.id, inputA, channelA);
  const requestB = useTrace(b.id, inputB, channelB);

  const help = useRef<HTMLDialogElement>(null);
  const openHelp = useCallback(() => help.current?.showModal(), []);
  const engine = useCompareEngine([requestA.trace, requestB.trace], Number(params.op) || 0, openHelp);

  // Como en el reproductor: si los algoritmos han cambiado desde que se creó el enlace, se avisa.
  const linkFingerprint = useRef(params.fp);
  const [staleLink, setStaleLink] = useState(false);
  useEffect(() => {
    if (!engine) return;
    const expected = linkFingerprint.current;
    linkFingerprint.current = undefined;
    const actual = engine.sides.map((side) => side.trace.header.fingerprint).join(',');
    setStaleLink(expected !== undefined && expected !== actual);
  }, [engine]);

  const currentParams = useCallback(() => compareParams([a, b], shared, input), [a, b, shared, input]);

  const linkFor = useCallback(
    (cost: number) =>
      formatCompareHash([a.id, b.id], {
        ...currentParams(),
        ...(cost > 0 ? { op: String(cost) } : {}),
        ...(engine ? { fp: engine.sides.map((side) => side.trace.header.fingerprint).join(',') } : {}),
      }),
    [a, b, currentParams, engine],
  );

  // La posición va a la URL al pararse, nunca durante la reproducción: Safari limita replaceState.
  useEffect(() => {
    if (!engine) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const write = (cost: number) => window.history.replaceState(null, '', linkFor(cost));
    write(engine.store.getState().cost);

    const unsubscribe = engine.store.subscribe((state, previous) => {
      if (state.playing || (state.cost === previous.cost && state.playing === previous.playing)) return;
      clearTimeout(timer);
      timer = setTimeout(() => write(state.cost), URL_DELAY_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [engine, linkFor]);

  const choose = (side: Side, id: string) => {
    const chosen = catalogOrder.find((algorithm) => algorithm.id === id);
    if (!chosen) return;
    if (side === 'b') {
      navigate([a.id, chosen.id], currentParams());
      return;
    }
    const partner = canCompare(chosen, b) ? b : defaultPartner(chosen);
    navigate([chosen.id, (partner ?? chosen).id], currentParams());
  };

  const shareLink = () =>
    `${window.location.origin}${window.location.pathname}${linkFor(engine?.store.getState().cost ?? 0)}`;

  const requests: Pair<TraceRequestState> = [requestA, requestB];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="#/">
          StepScope
        </a>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Comparar</h1>
          <p className={styles.summary}>
            La misma entrada y un mismo reloj, que avanza por operaciones: se ve quién hace menos trabajo.
          </p>
        </div>
        <div className={styles.actions}>
          {engine ? <ShareButton link={shareLink} label="Copiar enlace a este instante" /> : null}
          <button type="button" className={styles.linkButton} onClick={openHelp}>
            Atajos de teclado
          </button>
        </div>
      </header>

      <KeyboardHelp dialog={help} compare />

      <main className={styles.main}>
        {SIDES.map((side, k) => (
          <SidePanel
            key={side}
            side={side}
            algorithm={pair[k] as RegisteredAlgorithm}
            other={pair[1 - k] as RegisteredAlgorithm}
            request={requests[k] as TraceRequestState}
            engine={engine}
            onChoose={(id) => choose(side, id)}
          />
        ))}

        <section className={styles.details} aria-label="Contadores y entrada">
          {engine ? <CompareTable engine={engine} names={[a.meta.name, b.meta.name]} /> : <div />}
          <InputPanel pair={pair} shared={shared} input={input} onChange={setInput} />
        </section>
      </main>

      <section className={styles.footer} aria-label="Reproductor">
        {staleLink ? (
          <p className={styles.notice} role="status">
            Este enlace se creó con otra versión de los algoritmos: el instante que ves puede no ser el mismo.
          </p>
        ) : null}
        {engine ? <CompareTransport engine={engine} /> : null}
      </section>
    </div>
  );
}

interface SideProps {
  readonly side: Side;
  readonly algorithm: RegisteredAlgorithm;
  readonly other: RegisteredAlgorithm;
  readonly request: TraceRequestState;
  readonly engine: CompareEngine | null;
  readonly onChoose: (id: string) => void;
}

function SidePanel({ side, algorithm, other, request, engine, onChoose }: SideProps) {
  const k = side === 'a' ? 0 : 1;
  const presenter = engine?.sides[k] ?? null;
  const spec = presenter?.trace.header.views[0];
  // A puede ser cualquiera con compañero; B, solo los que comparten entrada con A.
  const options =
    side === 'a' ? catalogOrder.filter((candidate) => defaultPartner(candidate) !== null) : partnersOf(other);

  return (
    <section className={styles.side} data-side={side} aria-labelledby={`side-${side}-title`}>
      <h2 id={`side-${side}-title`} className={styles.hidden}>
        Lado {LETTERS[side]}: {algorithm.meta.name}
      </h2>
      <div className={styles.sideHeader}>
        <label className={styles.picker}>
          <span className={styles.letter} aria-hidden="true">
            {LETTERS[side]}
          </span>
          <span className={styles.hidden}>Algoritmo {LETTERS[side]}</span>
          <select value={algorithm.id} onChange={(event) => onChoose(event.target.value)}>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.meta.name}
              </option>
            ))}
          </select>
        </label>
        {engine ? <SideProgress engine={engine} index={k} /> : null}
      </div>

      <figure className={styles.stage}>
        {request.error ? (
          <p className={styles.message} role="alert">
            No se ha podido ejecutar: {request.error}
          </p>
        ) : presenter && spec ? (
          <ViewPane engine={presenter} spec={spec} title={`${algorithm.meta.name}, ${titleOf(spec)}`} />
        ) : (
          <p className={styles.message}>{request.loading ? 'Calculando la traza…' : 'Sin pasos.'}</p>
        )}
      </figure>

      <div className={styles.explanation}>
        {presenter ? <Explanation engine={presenter} truncated={presenter.trace.header.truncated} /> : null}
      </div>
    </section>
  );
}

function SideProgress({ engine, index }: { readonly engine: CompareEngine; readonly index: 0 | 1 }) {
  const { cost, total } = useCompareState(engine, (state) => state.sides[index]);
  const finished = cost >= total;
  return (
    <p className={styles.progress} data-finished={finished}>
      {finished
        ? `✓ Terminado: ${formatCount(total)} operaciones`
        : `${formatCount(cost)} de ${formatCount(total)} operaciones`}
    </p>
  );
}

interface InputProps {
  readonly pair: Pair<RegisteredAlgorithm>;
  readonly shared: Readonly<Record<string, InputField<unknown>>>;
  readonly input: CompareInput;
  readonly onChange: (input: CompareInput) => void;
}

/** La entrada común una sola vez, y debajo lo que elige cada lado por su cuenta. */
function InputPanel({ pair, shared, input, onChange }: InputProps) {
  return (
    <form className={styles.inputs} onSubmit={(event) => event.preventDefault()}>
      <h2 className={styles.sectionTitle}>Entrada común</h2>
      <div className={formStyles.form}>
        {Object.entries(shared).map(([name, field]) => (
          <FieldEditor
            key={name}
            name={name}
            field={field}
            value={input.shared[name]}
            onChange={(value) => onChange({ ...input, shared: { ...input.shared, [name]: value } })}
          />
        ))}
      </div>

      {SIDES.map((side, k) => {
        const algorithm = pair[k] as RegisteredAlgorithm;
        const variants = variantFields(algorithm.input);
        if (variants.length === 0) return null;
        return (
          <fieldset key={side} className={styles.variants}>
            <legend>
              Solo {LETTERS[side]}: {algorithm.meta.name}
            </legend>
            <div className={styles.variantFields}>
              {variants.map(([name, field]) => (
                <FieldEditor
                  key={name}
                  name={`${side}.${name}`}
                  field={field}
                  value={input[side][name]}
                  onChange={(value) => onChange({ ...input, [side]: { ...input[side], [name]: value } })}
                />
              ))}
            </div>
          </fieldset>
        );
      })}
    </form>
  );
}
