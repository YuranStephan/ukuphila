export function Journey({
  nivelKyc,
  dias,
}: {
  nivelKyc: number;
  dias: number;
}) {
  const steps = [
    { id: "registo", titulo: "Registo", desc: "Número e foto", done: true },
    { id: "caixa", titulo: "Gestão de caixa", desc: "Dois bolsos, todos os dias", done: dias >= 1 },
    { id: "poupanca", titulo: "Poupança", desc: "O dinheiro de casa separado", done: dias >= 7 },
    { id: "xitique", titulo: "Xitique", desc: "Poupar em grupo", done: nivelKyc >= 2 },
    { id: "credito", titulo: "Crédito", desc: "Só no fim do caminho", done: nivelKyc >= 3 },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <div className="journey" aria-label="A tua jornada">
      {steps.map((s, i) => {
        const now = i === (current === -1 ? steps.length - 1 : current);
        return (
          <div className="journey-step" key={s.id}>
            <div className="journey-rail">
              <div className={`node ${s.done ? "done" : ""} ${now ? "now" : ""}`} />
              {i < steps.length - 1 ? <div className={`wire ${s.done ? "done" : ""}`} /> : null}
            </div>
            <div style={{ paddingBottom: 18 }}>
              <strong>{s.titulo}</strong>
              <div style={{ color: "var(--cinza-suave)", fontSize: "0.92rem" }}>{s.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
