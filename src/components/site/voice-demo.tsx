"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls, useIsPresent, useMotionValue, usePresenceData, useTransform } from "motion/react";
import { Icon, type IconName } from "@/components/icon";
import { interpret, parseWalletSms, type Interpretation } from "@/lib/interpret";
import { EXPENSE_CATEGORIES } from "@/lib/labels";
import { formatMT } from "@/lib/money";

type Scenario = { id: string; label: string; icon: IconName; phrase: string; intent: string };
const SCENARIOS: Scenario[] = [
  { id: "vendas", label: "Vendas", icon: "coins", phrase: "Vendi duas caixas de tomate por dois mil", intent: "RECORD_SALE" },
  { id: "saldo", label: "Saldo", icon: "wallet", phrase: "Quanto tenho?", intent: "CHECK_BALANCE" },
  { id: "despesas", label: "Despesas", icon: "arrowUp", phrase: "Gastei 150 de transporte", intent: "RECORD_EXPENSE" },
  { id: "poupanca", label: "Poupança", icon: "piggy", phrase: "Guardei quinhentos para a poupança", intent: "RECORD_SAVING" },
  { id: "stock", label: "Stock", icon: "box", phrase: "Comprei dez sacos de cebola por oito mil", intent: "RECORD_PURCHASE" },
  { id: "casa", label: "Casa", icon: "home", phrase: "Tirei mil e quinhentos para casa", intent: "TRANSFER_HOME" },
  { id: "fiado", label: "Fiado", icon: "users", phrase: "A Rita pagou 300 do fiado", intent: "FIADO_REPAID" },
  { id: "xitique", label: "Xitique", icon: "circle", phrase: "Quanto falta para o Xitique?", intent: "XITIQUE_STATUS" },
  { id: "documentos", label: "Documentos", icon: "shield", phrase: "O meu documento foi aprovado?", intent: "DOCUMENT_STATUS" },
];
const TITLES: Record<string, string> = {
  RECORD_SALE: "Venda", RECORD_FIADO_SALE: "Venda a fiado", RECORD_EXPENSE: "Despesa", RECORD_PURCHASE: "Compra de stock",
  TRANSFER_HOME: "Do Negócio para a Casa", RECORD_SAVING: "Poupança", FIADO_REPAID: "Fiado recebido",
};
const QUERIES: Record<string, { title: string; body: string; items: { icon: IconName; label: string }[]; action: string }> = {
  CHECK_BALANCE: { title: "Cada bolso, à tua vista.", body: "Vê o que tens no negócio, em casa e na poupança, a partir dos teus movimentos.", items: [{ icon: "building", label: "Negócio" }, { icon: "home", label: "Casa" }, { icon: "piggy", label: "Poupança" }], action: "Ver os meus bolsos" },
  XITIQUE_STATUS: { title: "O teu grupo, em sintonia.", body: "Quem já pagou, quem recebe e o que falta. Tudo no mesmo historial.", items: [{ icon: "users", label: "O grupo" }, { icon: "check", label: "Pagamentos" }, { icon: "circle", label: "A ronda" }], action: "Abrir o meu Xitique" },
  DOCUMENT_STATUS: { title: "Cada passo conta.", body: "Acompanha a revisão dos teus documentos e sabe o que falta para avançar.", items: [{ icon: "document", label: "Documentos" }, { icon: "shield", label: "Verificação" }, { icon: "ring", label: "Historial" }], action: "Ver a minha verificação" },
  DAILY_SUMMARY: { title: "O teu dia, com clareza.", body: "Vendas, gastos e movimentos organizados para perceberes como correu o negócio.", items: [{ icon: "coins", label: "Vendas" }, { icon: "arrowUp", label: "Gastos" }, { icon: "chart", label: "Resumo" }], action: "Ver o meu resumo" },
  SAVINGS_STATUS: { title: "O futuro começa aos poucos.", body: "Acompanha o que já guardaste e o caminho até à tua meta.", items: [{ icon: "piggy", label: "Poupança" }, { icon: "flag", label: "Metas" }, { icon: "ring", label: "Progresso" }], action: "Abrir a minha poupança" },
  HUMAN_SUPPORT: { title: "Há uma pessoa por perto.", body: "Fala com o teu agente para esclarecer uma dúvida ou receber apoio no teu mercado.", items: [{ icon: "hand", label: "O teu agente" }, { icon: "chat", label: "Apoio" }, { icon: "map", label: "Mercado" }], action: "Entrar para pedir apoio" },
  KYC_HELP: { title: "Sabe qual é o próximo passo.", body: "Consulta a tua verificação e os documentos que ainda precisas de entregar.", items: [{ icon: "user", label: "Perfil" }, { icon: "document", label: "Documentos" }, { icon: "check", label: "Próximo passo" }], action: "Ver a minha verificação" },
  CREDIT_INFO: { title: "Historial que abre portas.", body: "Conhece o crédito fornecedor e acompanha cada etapa do teu pedido.", items: [{ icon: "ring", label: "Historial" }, { icon: "truck", label: "Fornecedor" }, { icon: "document", label: "Pedido" }], action: "Consultar a minha conta" },
};

function describe(result: Interpretation) {
  return [result.quantity ? `${result.quantity}${result.item ? ` ${result.item}` : ""}` : result.item, result.person,
    result.category ? EXPENSE_CATEGORIES.find((row) => row.key === result.category)?.label : undefined].filter(Boolean).join(" · ");
}

function VoiceCard({ text, scenario, revision, direction, reduced, onMove, onInteract }: { text: string; scenario: Scenario; revision: number; direction: number; reduced: boolean; onMove: (step: number, manual: boolean) => void; onInteract: () => void }) {
  const present = useIsPresent();
  const presenceDirection = usePresenceData();
  const travel = typeof presenceDirection === "number" ? presenceDirection : direction;
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-14, 0, 14]);
  const rotateY = useTransform(x, [-300, 0, 300], [16, 0, -16]);
  const drag = useDragControls();
  const result = useMemo(() => parseWalletSms(text) ?? interpret(text), [text]);
  const appearance = SCENARIOS.find((item) => item.intent === result.intent) ?? scenario;
  const title = TITLES[result.intent];
  const query = QUERIES[result.intent];
  const detail = describe(result);
  return (
    <motion.article className={`voice-result${present ? "" : " voice-result--outgoing"}`} aria-hidden={!present || undefined} inert={!present} data-scenario={appearance.id} data-present={present} data-motion="native"
      style={{ x, rotate, rotateY, zIndex: present ? 2 : 3 }}
      initial={reduced ? false : { x: travel * 140, y: 48, scale: .88, opacity: 0, rotateX: 16 }} animate={{ x: 0, y: 0, scale: 1, opacity: 1, rotateX: 0 }}
      exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { x: travel * -250, y: -56, scale: .83, opacity: 0, rotateX: -14 }}
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 31, mass: .85, opacity: { duration: .23 } }}
      drag={reduced ? false : "x"} dragControls={drag} dragListener={false} dragConstraints={{ left: 0, right: 0 }} dragElastic={.82} dragMomentum={false}
      dragTransition={{ bounceStiffness: 480, bounceDamping: 30 }} whileDrag={{ scale: 1.025, cursor: "grabbing", boxShadow: "0 22px 46px -18px rgba(0,0,0,.36)" }}
      onPointerDown={(event) => { if (present && !reduced && !(event.target instanceof Element && event.target.closest("a, button, input"))) drag.start(event); }}
      onDragStart={onInteract} onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 66 || Math.abs(info.velocity.x) > 420) onMove((info.offset.x || info.velocity.x) < 0 ? 1 : -1, true); }}>
      <div className="voice-card-top"><span className="voice-kind"><Icon name={appearance.icon} size={16} />{title ?? appearance.label}</span><span className="voice-card-badge"><Icon name={title ? "check" : "lock"} size={12} />{title ? "Para confirmares" : "Na tua conta"}</span></div>
      {title ? <div className="voice-card-body"><strong className="num voice-amount">{result.amountCents ? formatMT(result.amountCents) : "Quanto foi?"}</strong><span className="voice-detail">{detail || "Um registo com os teus detalhes."}</span><div className="voice-record-line"><span /><Icon name={appearance.icon} size={20} /><span /></div><p className="voice-card-copy">Tu dizes o que aconteceu.<br />Tu decides o que fica registado.</p></div>
        : query ? <div className="voice-card-body"><h3 className="voice-query-title">{query.title}</h3><p className="voice-card-copy">{query.body}</p><div className="voice-pocket-grid">{query.items.map((item) => <div key={item.label}><Icon name={item.icon} size={21} /><span>{item.label}</span></div>)}</div></div>
        : <div className="voice-card-body"><h3 className="voice-query-title">Conta-me o que aconteceu.</h3><p className="voice-card-copy">Podes escrever “Vendi 500”, “Guardei 200” ou “Quanto tenho?”.</p></div>}
      <div className="voice-actions"><Link className="btn btn-sun btn-s" href="/entrar">{title ? "Confirmar na minha conta" : query?.action ?? "Abrir a minha conta"}<Icon name="arrowRight" size={15} /></Link>{title ? <span className="voice-note">Nada é registado sem confirmação</span> : null}</div>
    </motion.article>
  );
}

/** The public interpreter prepares a proposal; account actions take place after sign-in. */
export function VoiceDemo() {
  const root = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLElement>(null);
  const dockId = useId();
  const [index, setIndex] = useState(0);
  const [revision, setRevision] = useState(0);
  const [typed, setTyped] = useState<string | null>(null);
  const [direction, setDirection] = useState("next");
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(true);
  const [reduced, setReduced] = useState(false);
  const text = typed ?? SCENARIOS[index].phrase;
  const playing = !paused && !hovered && !focused && visible && foreground && !reduced && typed === null;

  const move = useCallback((step: number, manual: boolean) => {
    if (step === 0) return;
    setDirection(step < 0 ? "previous" : "next");
    setIndex((value) => (value + step + SCENARIOS.length) % SCENARIOS.length);
    setRevision((value) => value + 1);
    setTyped(null);
    if (manual) setPaused(true);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReduced(media.matches);
    const updateVisibility = () => setForeground(!document.hidden);
    updateMotion();
    updateVisibility();
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    if (root.current) observer.observe(root.current);
    return () => { media.removeEventListener("change", updateMotion); document.removeEventListener("visibilitychange", updateVisibility); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => move(1, false), 6200);
    return () => clearTimeout(timer);
  }, [playing, move, index]);

  useEffect(() => {
    const rail = dock.current;
    const selected = rail?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (rail && selected) rail.scrollTo({ left: selected.offsetLeft - (rail.clientWidth - selected.clientWidth) / 2, behavior: reduced ? "auto" : "smooth" });
  }, [index, reduced]);

  return (
    <div ref={root} className="voice-demo voice-carousel" role="region" aria-roledescription="carrossel" aria-label="O que podes fazer com o Ukuphila" data-direction={direction} data-playing={playing} data-reduced={reduced}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }} onPointerLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onKeyDown={(event) => { if (event.target instanceof HTMLInputElement) return; if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1, true); } }}>
      <div className="voice-overline"><span><i />O teu dia, organizado</span><span className="voice-count num">{String(index + 1).padStart(2, "0")}<span> / {String(SCENARIOS.length).padStart(2, "0")}</span></span></div>
      <label className="voice-input"><span className="voice-mic"><Icon name="mic" size={19} /></span><input aria-label="Escreve uma frase como dirias ao telefone" value={text} maxLength={180} autoComplete="off" spellCheck={false} onChange={(event) => { setTyped(event.target.value); setPaused(true); }} onFocus={() => { setTyped(text); setPaused(true); }} /><span className="voice-wave" aria-hidden="true">{[8, 17, 11, 23, 14].map((height, position) => <i key={position} style={{ height, animationDelay: `${position * 120}ms` }} />)}</span></label>
      <div className="voice-deck"><motion.div className="voice-underlay" aria-hidden="true" animate={{ rotate: index % 2 ? -2.5 : 2.5, y: 3, scale: .98 }} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 22 }} /><div className="voice-current" aria-live={playing ? "off" : "polite"} aria-atomic="true"><AnimatePresence initial={false} custom={direction === "next" ? 1 : -1}><VoiceCard key={revision} text={text} scenario={SCENARIOS[index]} revision={revision} direction={direction === "next" ? 1 : -1} reduced={reduced} onMove={move} onInteract={() => setPaused(true)} /></AnimatePresence></div></div>
      <motion.nav ref={dock} layoutScroll className="voice-dock" aria-label="Escolher função">{SCENARIOS.map((scenario, position) => <motion.button key={scenario.id} type="button" aria-label={scenario.label} aria-pressed={position === index} onClick={() => move(position - index, true)} whileTap={{ scale: .87 }} transition={{ type: "spring", stiffness: 420, damping: 25 }}>{position === index ? <motion.span className="voice-dock-selected" layoutId={`selection-${dockId}`} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 29 }} /> : null}<Icon name={scenario.icon} size={19} /><span className="voice-dock-tip">{scenario.label}</span></motion.button>)}</motion.nav>
      <div className="voice-carousel-footer"><span className="voice-now"><Icon name={SCENARIOS[index].icon} size={14} />{SCENARIOS[index].label}</span><div className="voice-controls"><motion.button whileTap={{ scale: .9 }} type="button" onClick={() => move(-1, true)} aria-label="Cartão anterior"><Icon name="arrowLeft" size={18} /></motion.button>{!reduced ? <motion.button whileTap={{ scale: .9 }} type="button" aria-label={playing ? "Pausar cartões" : "Reproduzir cartões"} onClick={() => { if (playing) setPaused(true); else { setPaused(false); setHovered(false); setFocused(false); setTyped(null); } }}><Icon name={playing ? "pause" : "play"} size={16} /></motion.button> : null}<motion.button whileTap={{ scale: .9 }} type="button" onClick={() => move(1, true)} aria-label="Próximo cartão"><Icon name="arrowRight" size={18} /></motion.button></div></div>
      <div className="voice-bottom-line"><span>{typed !== null ? "À tua maneira. Escreve como falas." : `${SCENARIOS[index].label} · Feito para o teu dia a dia.`}</span>{typed !== null ? <button type="button" onClick={() => { setTyped(null); setPaused(false); setFocused(false); setHovered(false); }}>Retomar cartões <Icon name="arrowRight" size={12} /></button> : <span className="voice-pause-hint">Pausa ao interagir</span>}</div>
    </div>
  );
}
