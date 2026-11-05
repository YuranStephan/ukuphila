"use client";

import { AnimatePresence, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";

const MEMBERS = [
  { first: "Maria", last: "Cossa", initials: "MC" },
  { first: "Celeste", last: "Machava", initials: "CM" },
  { first: "Lurdes", last: "Sitoe", initials: "LS" },
  { first: "Teresa", last: "Bila", initials: "TB" },
  { first: "Júlia", last: "Tembe", initials: "JT" },
  { first: "Marta", last: "Langa", initials: "ML" },
  { first: "Rute", last: "Novela", initials: "RN" },
  { first: "Filomena", last: "Cossa", initials: "FC" },
];
const POINTS = MEMBERS.map((_, index) => {
  const angle = index * Math.PI / 4 - Math.PI / 2;
  return { x: Number((250 + Math.cos(angle) * 153).toFixed(3)), y: Number((250 + Math.sin(angle) * 153).toFixed(3)) };
});
const CAPTIONS = ["O grupo reúne-se", "Cada contributo conta", "Uma declara. Outra confirma.", "A ronda continua"];
const SPRING = { type: "spring" as const, stiffness: 260, damping: 25 };

function connection(from: number, to: number) {
  const start = POINTS[from];
  const end = POINTS[to];
  const control = { x: 250 + (start.x + end.x - 500) * .16, y: 250 + (start.y + end.y - 500) * .16 };
  const samples = [0, .25, .5, .75, 1].map((progress) => ({
    x: (1 - progress) ** 2 * start.x + 2 * (1 - progress) * progress * control.x + progress ** 2 * end.x,
    y: (1 - progress) ** 2 * start.y + 2 * (1 - progress) * progress * control.y + progress ** 2 * end.y,
  }));
  return { path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`, samples };
}

/** A visual story of a round, kept separate from account and payment state. */
export function XitiqueStory() {
  const root = useRef<HTMLElement>(null);
  const inView = useInView(root, { amount: .35 });
  const [reduced, setReduced] = useState(false);
  const [step, setStep] = useState(0);
  const [foreground, setForeground] = useState(true);
  const [hovered, setHovered] = useState<number | null>(null);
  const recipient = Math.floor(step / 4) % MEMBERS.length;
  const phase = step % 4;
  const contributor = (recipient + phase + 1) % MEMBERS.length;
  const member = MEMBERS[recipient];
  const route = connection(contributor, recipient);
  const running = inView && foreground && !reduced;
  const transition = reduced ? { duration: 0 } : SPRING;

  useEffect(() => {
    const update = () => setForeground(!document.hidden);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReduced(media.matches);
    update();
    updateMotion();
    document.addEventListener("visibilitychange", update);
    media.addEventListener("change", updateMotion);
    return () => { document.removeEventListener("visibilitychange", update); media.removeEventListener("change", updateMotion); };
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => setStep((value) => value + 1), 2200);
    return () => clearTimeout(timer);
  }, [running, step]);

  return (
    <figure ref={root} className="xitique-visual xitique-story" aria-label="As pessoas ligam-se e a vez de receber passa pelo grupo de Xitique" data-running={running} data-recipient={recipient} data-phase={phase}>
      <span className="xitique-story-heading" aria-hidden="true">O teu círculo de confiança</span>
      <svg className="xitique-connections" viewBox="0 0 500 500" fill="none" aria-hidden="true">
        <circle cx="250" cy="250" r="153" stroke="#d9dcca" strokeWidth="1.4" strokeDasharray="3 8" />
        <motion.circle cx="250" cy="250" r="153" stroke="#88a98a" strokeWidth="2" strokeDasharray="32 930" strokeLinecap="round" style={{ transformOrigin: "250px 250px" }} animate={{ rotate: step * 45 - 90 }} transition={reduced ? { duration: 0 } : { duration: 1.9, ease: [.22, 1, .36, 1] }} />
        <AnimatePresence initial={false}>
          <motion.g key={recipient} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .7 }}>
            {POINTS.map((_, index) => index !== recipient ? <path key={index} d={connection(index, recipient).path} stroke="#bbcfba" strokeWidth="1" opacity=".43" /> : null)}
          </motion.g>
        </AnimatePresence>
        <AnimatePresence initial={false}>
          <motion.g key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .4 }}>
            <motion.path d={route.path} stroke="#0b7f5c" strokeWidth="1.6" strokeLinecap="round" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 1.6, ease: [.22, 1, .36, 1] }} />
            {running ? <motion.circle r="4" fill="#ffb020" stroke="#f6f3ea" strokeWidth="2" initial={{ cx: route.samples[0].x, cy: route.samples[0].y, opacity: 0 }} animate={{ cx: route.samples.map((point) => point.x), cy: route.samples.map((point) => point.y), opacity: [0, 1, 1, 1, 0] }} transition={{ duration: 1.7, delay: .15, ease: "linear", times: [0, .25, .5, .75, 1] }} /> : null}
          </motion.g>
        </AnimatePresence>
        <motion.circle cx={POINTS[recipient].x} cy={POINTS[recipient].y} r="32" stroke="#ffb020" strokeWidth="2" animate={{ cx: POINTS[recipient].x, cy: POINTS[recipient].y, r: running ? [32, 37, 32] : 32, opacity: running ? [.9, .4, .9] : .8 }} transition={{ cx: transition, cy: transition, r: { duration: reduced ? 0 : 2.2, repeat: running ? Infinity : 0 }, opacity: { duration: reduced ? 0 : 2.2, repeat: running ? Infinity : 0 } }} />
      </svg>

      <div className="xitique-story-core" aria-hidden="true">
        <span className="xitique-turn-label">A vez de</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={recipient} className="xitique-recipient-name" initial={reduced ? false : { opacity: 0, y: 12, filter: "blur(3px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: reduced ? 0 : -10, filter: reduced ? "blur(0px)" : "blur(3px)" }} transition={{ duration: reduced ? 0 : .35 }}>
            <strong>{member.first}</strong><span>{member.last}</span>
          </motion.div>
        </AnimatePresence>
        <span className="xitique-core-line" />
        <div className="xitique-story-caption"><AnimatePresence mode="wait" initial={false}><motion.span key={phase} initial={reduced ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -5 }} transition={{ duration: reduced ? 0 : .25 }}>{CAPTIONS[phase]}</motion.span></AnimatePresence></div>
      </div>

      {MEMBERS.map((person, index) => {
        const active = index === recipient;
        const linked = index === contributor;
        const showName = active || linked || index === hovered;
        return <div key={person.initials} className="xitique-person" data-name-above={index === 4} style={{ left: `${POINTS[index].x / 5}%`, top: `${POINTS[index].y / 5}%` }}>
          <motion.button type="button" className="xitique-avatar" data-active={active} data-linked={linked} aria-label={`Ver ${person.first} ${person.last} na ronda`} aria-pressed={active}
            initial={false} animate={{ scale: active ? 1.09 : linked ? 1.035 : 1, backgroundColor: active ? "#0b7f5c" : linked ? "#0f6049" : "#dce6d8", color: active || linked ? "#fffefa" : "#4a6654" }} transition={transition} whileHover={reduced ? undefined : { scale: 1.12 }} whileTap={reduced ? undefined : { scale: .96 }}
            onPointerEnter={() => setHovered(index)} onPointerLeave={() => setHovered(null)} onFocus={() => setHovered(index)} onBlur={() => setHovered(null)} onClick={() => setStep(index * 4)}>
            {person.initials}<AnimatePresence>{linked ? <motion.span className="xitique-link-dot" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={transition}><Icon name="check" size={9} /></motion.span> : null}</AnimatePresence>
          </motion.button>
          <AnimatePresence>{showName ? <motion.span className="xitique-person-name" aria-hidden="true" initial={reduced ? false : { opacity: 0, y: 5, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: reduced ? 0 : -4, x: "-50%" }} transition={{ duration: reduced ? 0 : .35 }}><strong>{person.first}</strong> {person.last}</motion.span> : null}</AnimatePresence>
        </div>;
      })}

    </figure>
  );
}
