/**
 * The mark: three nested arcs opening upward, one for each word of the tagline, with a seed rising from them. It reads
 * as a U, as tree rings and as a woven basket seen from the side. Everything else in the identity comes from these arcs.
 */
export function LogoMark({ size = 32, tone = "auto" }: { size?: number; tone?: "auto" | "light" | "dark" }) {
  const stroke = tone === "light" ? "#f6f3ea" : tone === "dark" ? "#071f1a" : "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M4 11v9a16 16 0 0 0 32 0v-9" stroke={stroke} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M11 11v9a9 9 0 0 0 18 0v-9" stroke={stroke} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M18 14v6a2 2 0 0 0 4 0v-6" stroke="#ffb020" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="20" cy="6" r="3.2" fill="#ffb020" />
    </svg>
  );
}

export function Logo({ size = 30, tone = "auto" }: { size?: number; tone?: "auto" | "light" | "dark" }) {
  const color = tone === "light" ? "#f6f3ea" : tone === "dark" ? "#071f1a" : "currentColor";
  return (
    <span className="logo" style={{ color }}>
      <LogoMark size={size} tone={tone} />
      <span className="logo-word">ukuphila</span>
    </span>
  );
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

export function arcPath(cx: number, cy: number, radius: number, start: number, end: number) {
  const from = polar(cx, cy, radius, start);
  const to = polar(cx, cy, radius, end);
  const large = end - start > 180 ? 1 : 0;
  return `M${from.x.toFixed(2)} ${from.y.toFixed(2)}A${radius} ${radius} 0 ${large} 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}

/** The merchant's four rings. Reached rings glow, the current one is drawn in progress, the rest wait in outline. */
export function Rings({ ring, progress = 1, size = 180, labels, tone = "light" }: { ring: number; progress?: number; size?: number; labels?: boolean; tone?: "light" | "night" }) {
  const c = 100;
  const radii = [34, 52, 70, 88];
  const track = tone === "night" ? "#1f4a41" : "#e0dbcc";
  const colors = ["#0b7f5c", "#2aa57c", "#ffb020", "#d94a24"];
  const names = ["Caixa", "Poupança", "Xitique", "Crédito"];
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={`Anel ${ring} de 4: ${names[ring - 1]}`}>
      {radii.map((radius, index) => {
        const reached = index + 1 < ring;
        const current = index + 1 === ring;
        const share = reached ? 1 : current ? Math.max(0.08, Math.min(1, progress)) : 0;
        return (
          <g key={radius}>
            <circle cx={c} cy={c} r={radius} fill="none" stroke={track} strokeWidth="9" strokeDasharray="2 5.5" strokeLinecap="round" />
            {share >= 1 ? <circle cx={c} cy={c} r={radius} fill="none" stroke={colors[index]} strokeWidth="9" /> : null}
            {share > 0 && share < 1 ? <path d={arcPath(c, c, radius, 0, share * 359.9)} fill="none" stroke={colors[index]} strokeWidth="9" strokeLinecap="round" /> : null}
          </g>
        );
      })}
      <circle cx={c} cy={c} r="9" fill="#ffb020" />
      {labels ? <title>{names.slice(0, ring).join(", ")}</title> : null}
    </svg>
  );
}

/** Woven rings for the hero. Pure SVG and CSS, so it costs no JavaScript and stops for people who prefer less motion. */
export function WovenRings({ className }: { className?: string }) {
  const c = 400;
  const dots = [
    [268, 20], [268, 134], [268, 248], [196, 70], [196, 190], [196, 310], [124, 40], [124, 160], [124, 280],
  ] as const;
  return (
    <svg className={className} viewBox="0 0 800 800" fill="none" aria-hidden="true">
      <g className="ring-a">
        <circle cx={c} cy={c} r="340" stroke="#ffb020" strokeOpacity=".22" strokeWidth="46" strokeDasharray="4 15" />
        <circle cx={c} cy={c} r="340" stroke="#ffb020" strokeWidth="2" strokeOpacity=".9" strokeDasharray="560 200 300 1076" strokeLinecap="round" />
      </g>
      <g className="ring-b">
        <circle cx={c} cy={c} r="268" stroke="#2aa57c" strokeOpacity=".28" strokeWidth="40" strokeDasharray="4 13" />
        <circle cx={c} cy={c} r="268" stroke="#bfe8d5" strokeWidth="2" strokeDasharray="420 180 200 884" strokeLinecap="round" />
      </g>
      <g className="ring-a-slow">
        <circle cx={c} cy={c} r="196" stroke="#bfe8d5" strokeOpacity=".2" strokeWidth="34" strokeDasharray="4 11" />
        <circle cx={c} cy={c} r="196" stroke="#ffb020" strokeWidth="2" strokeDasharray="300 140 180 612" strokeLinecap="round" />
      </g>
      <g className="ring-b-slow">
        <circle cx={c} cy={c} r="124" stroke="#ffb020" strokeOpacity=".3" strokeWidth="28" strokeDasharray="4 9" />
      </g>
      {dots.map(([radius, angle]) => {
        const point = polar(c, c, radius, angle);
        return <circle key={`${radius}-${angle}`} cx={point.x} cy={point.y} r="5" fill="#ffb020" className="ring-dot" />;
      })}
      <circle cx={c} cy={c} r="58" fill="#ffb020" />
      <circle cx={c} cy={c} r="58" fill="#ffb020" className="ring-pulse" />
    </svg>
  );
}

/** The Xitique drawn as what it is: people around a circle, with the pot moving from one to the next. */
export function XitiqueCircle({ members, recipient, size = 280 }: { members: { name: string; state: "confirmada" | "declarada" | "pendente" | "atrasada" }[]; recipient: number; size?: number }) {
  const c = 150;
  const radius = 104;
  const step = 360 / members.length;
  const tone = { confirmada: "#0b7f5c", declarada: "#c98600", pendente: "#c9c3b1", atrasada: "#d94a24" };
  return (
    <svg width={size} height={size} viewBox="0 0 300 300" role="img" aria-label="Círculo do Xitique">
      <circle cx={c} cy={c} r={radius} fill="none" stroke="#e0dbcc" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
      {members.map((member, index) => {
        const point = polar(c, c, radius, index * step);
        const isRecipient = index === recipient;
        return (
          <g key={member.name}>
            {isRecipient ? <circle cx={point.x} cy={point.y} r="27" fill="none" stroke="#ffb020" strokeWidth="3" /> : null}
            <circle cx={point.x} cy={point.y} r="21" fill={tone[member.state]} />
            <text x={point.x} y={point.y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" style={{ fontFamily: "var(--font-sans)" }}>
              {member.name.split(" ").map((word) => word[0]).slice(0, 2).join("")}
            </text>
            <title>{`${member.name}: ${member.state}`}</title>
          </g>
        );
      })}
    </svg>
  );
}
