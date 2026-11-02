import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type ShownSource, TraceCursor, type ViewSpec } from '@/core';
import type { RegisteredAlgorithm } from '../../algorithms/registry';
import { formatAlgorithmHash } from '../../routing/hash';
import { keyOf, titleOf } from '../../views/registry';
import { InputForm, inputFromParams, paramsFromInput } from '../input-editors/InputForm';
import { CodePanel } from '../panels/CodePanel';
import { ComplexityPanel } from '../panels/ComplexityPanel';
import { CountersPanel } from '../panels/CountersPanel';
import { Explanation } from '../panels/Explanation';
import { LegendPanel } from '../panels/LegendPanel';
import { VariablesPanel } from '../panels/VariablesPanel';
import { ViewPane } from '../stage/ViewPane';
import { KeyboardHelp } from '../transport/KeyboardHelp';
import { ShareButton } from '../transport/ShareButton';
import { Transport } from '../transport/Transport';
import { NARROW, useMediaQuery } from '../useMediaQuery';
import { useEngine, useTrace } from '../usePlayer';
import styles from './PlayerPage.module.css';

const FRAME_URL_DELAY_MS = 500;

interface Props {
  readonly algorithm: RegisteredAlgorithm;
  readonly initialParams: Readonly<Record<string, string>>;
}

/** La primera vista y las que piden la platina van en ella; en móvil solo cabe la primera. */
function placeViews(views: readonly ViewSpec[], narrow: boolean) {
  const onStage = views.filter((spec, index) => index === 0 || spec.place === 'stage');
  const stage = narrow ? onStage.slice(0, 1) : onStage;
  return { stage, side: views.filter((spec) => !stage.includes(spec)) };
}

export function PlayerPage({ algorithm, initialParams }: Props) {
  const [input, setInput] = useState(() => inputFromParams(algorithm.input, initialParams));
  const [source, setSource] = useState<ShownSource | null>(null);
  const [activeTab, setActiveTab] = useState('code');
  const narrow = useMediaQuery(NARROW);

  const help = useRef<HTMLDialogElement>(null);
  const openHelp = useCallback(() => help.current?.showModal(), []);

  const { trace, error, loading } = useTrace(algorithm.id, input);
  const engine = useEngine(trace, Number(initialParams.f) || 0, openHelp);

  // Un enlace guarda el fingerprint de su traza. Si el algoritmo ha cambiado desde entonces, el mismo
  // número de paso ya no es el mismo momento: se avisa. Solo vale para la traza del enlace.
  const linkFingerprint = useRef(initialParams.fp);
  const [staleLink, setStaleLink] = useState(false);
  useEffect(() => {
    if (!trace) return;
    const expected = linkFingerprint.current;
    linkFingerprint.current = undefined;
    setStaleLink(expected !== undefined && expected !== trace.header.fingerprint);
  }, [trace]);

  useEffect(() => {
    let current = true;
    void algorithm.loadSource().then((loaded) => {
      if (current) setSource(loaded);
    });
    return () => {
      current = false;
    };
  }, [algorithm]);

  const linkFor = useCallback(
    (frame: number) => {
      const params = paramsFromInput(algorithm.input, input);
      return formatAlgorithmHash(algorithm.id, {
        ...params,
        ...(frame > 0 ? { f: String(frame) } : {}),
        ...(trace ? { fp: trace.header.fingerprint } : {}),
      });
    },
    [algorithm, input, trace],
  );

  // El paso va a la URL al pararse, nunca durante la reproducción: Safari limita replaceState.
  useEffect(() => {
    if (!engine) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const write = (frame: number) => window.history.replaceState(null, '', linkFor(frame));

    write(engine.store.getState().index);

    const unsubscribe = engine.store.subscribe((state, previous) => {
      if (state.playing || (state.index === previous.index && state.playing === previous.playing)) return;
      clearTimeout(timer);
      timer = setTimeout(() => write(state.index), FRAME_URL_DELAY_MS);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [engine, linkFor]);

  const shareLink = () => {
    const frame = engine?.store.getState().index ?? 0;
    return `${window.location.origin}${window.location.pathname}${linkFor(frame)}`;
  };

  const { stage, side } = placeViews(trace?.header.views ?? [], narrow);

  const tabs = [
    { id: 'code', label: 'Código' },
    ...side.map((spec) => ({ id: keyOf(spec), label: titleOf(spec) })),
    { id: 'vars', label: 'Variables' },
    { id: 'counters', label: 'Contadores' },
    { id: 'complexity', label: 'Complejidad' },
    { id: 'input', label: 'Entrada' },
  ];

  const panelProps = (id: string) => ({
    id: `panel-${id}`,
    role: 'tabpanel' as const,
    'aria-labelledby': `tab-${id}`,
    'data-active': activeTab === id,
    className: styles.panel,
  });

  const final = useMemo(
    () => (trace ? new TraceCursor(trace).countersAt(trace.header.frameCount - 1) : null),
    [trace],
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="#/">
          StepScope
        </a>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{algorithm.meta.name}</h1>
          <p className={styles.summary}>{algorithm.meta.summary}</p>
        </div>
        <div className={styles.actions}>
          {engine ? <ShareButton link={shareLink} /> : null}
          <button type="button" className={styles.helpButton} onClick={openHelp}>
            Atajos de teclado
          </button>
        </div>
      </header>

      <KeyboardHelp dialog={help} />

      <main className={styles.stage}>
        {error ? (
          <p className={styles.message} role="alert">
            No se ha podido ejecutar: {error}
          </p>
        ) : engine && stage.length > 0 ? (
          <div className={styles.stageViews}>
            {stage.map((spec) => (
              <figure key={keyOf(spec)} className={styles.stageView} style={{ flexGrow: spec.weight ?? 1 }}>
                {stage.length > 1 ? (
                  <figcaption className={styles.caption}>{titleOf(spec)}</figcaption>
                ) : null}
                <ViewPane engine={engine} spec={spec} title={titleOf(spec)} />
              </figure>
            ))}
          </div>
        ) : (
          <p className={styles.message}>
            {loading ? 'Calculando la traza…' : 'Esta ejecución no tiene pasos.'}
          </p>
        )}
      </main>

      <section className={styles.side} aria-label="Detalles de la ejecución">
        <div className={styles.tabs} role="tablist" aria-label="Paneles">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              className={styles.tab}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section {...panelProps('code')}>
          <h2 className={styles.panelTitle}>Código</h2>
          {source && engine ? <CodePanel engine={engine} source={source} /> : null}
        </section>

        {engine
          ? side.map((spec) => (
              <section key={keyOf(spec)} {...panelProps(keyOf(spec))}>
                <h2 className={styles.panelTitle}>{titleOf(spec)}</h2>
                <div className={styles.secondaryView}>
                  <ViewPane engine={engine} spec={spec} title={titleOf(spec)} />
                </div>
              </section>
            ))
          : null}

        <div className={styles.panelRow}>
          <section {...panelProps('vars')}>
            <h2 className={styles.panelTitle}>Variables</h2>
            {engine ? <VariablesPanel engine={engine} /> : null}
          </section>

          <section {...panelProps('counters')}>
            <h2 className={styles.panelTitle}>Contadores</h2>
            {engine && final ? <CountersPanel engine={engine} final={final} /> : null}
          </section>
        </div>

        <section {...panelProps('complexity')}>
          <h2 className={styles.panelTitle}>Complejidad</h2>
          {final ? <ComplexityPanel algorithm={algorithm} input={input} final={final} /> : null}
        </section>

        <section {...panelProps('input')}>
          <h2 className={styles.panelTitle}>Entrada</h2>
          <InputForm algorithm={algorithm} value={input} onChange={setInput} />
          {trace ? <LegendPanel roles={trace.header.roles} /> : null}
        </section>
      </section>

      <section className={styles.footer} aria-label="Reproductor">
        {staleLink ? (
          <p className={styles.notice} role="status">
            Este enlace se creó con otra versión del algoritmo: el paso que ves puede no ser el mismo.
          </p>
        ) : null}
        {engine ? (
          <>
            <Explanation engine={engine} truncated={trace?.header.truncated ?? null} />
            <Transport engine={engine} />
          </>
        ) : null}
      </section>
    </div>
  );
}
