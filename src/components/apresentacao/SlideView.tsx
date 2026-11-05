import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CORES, PX, ptPx, type Slide } from "@/lib/apresentacaoSlides";
import type { SegmentoResumo } from "@/lib/apresentacao";
import { formatM3 } from "@/lib/geo";

const AZUL_CLARO_TXT = "#2F7DE1";

const FONTE_TITULO = "'Arial Narrow', 'Liberation Sans Narrow', Arial, sans-serif";

/** mede o título com a fonte que o navegador realmente usa, para caber na faixa */
let medidor: CanvasRenderingContext2D | null = null;
function tamanhoTituloPx(texto: string): number {
  const base = ptPx(26);
  if (typeof document === "undefined") return base;
  medidor = medidor ?? document.createElement("canvas").getContext("2d");
  if (!medidor) return base;
  medidor.font = `bold ${base}px ${FONTE_TITULO}`;
  const largura = medidor.measureText(texto.toUpperCase()).width;
  const alvo = polegada(7.5);
  const minimo = ptPx(16);
  return Math.max(minimo, largura > alvo ? (base * alvo) / largura : base);
}

const num = (n: number, casas = 1) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
const pct = (n: number) => `${n > 0 ? "+" : ""}${num(n)}%`;

/** slide em px (13,333 x 7,5 in a 96 dpi) */
const L = 13.333 * PX;
const A = 7.5 * PX;
const polegada = (v: number) => v * PX;

/** área que encolhe o slide 1280x720 para a largura disponível */
export function SlideFrame({ children, className }: { children: ReactNode; className?: string }) {
  const alvo = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    const el = alvo.current;
    if (!el) return;
    const obs = new ResizeObserver(([entrada]) => setLargura(entrada.contentRect.width));
    obs.observe(el);
    setLargura(el.clientWidth);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={alvo} className={`relative w-full overflow-hidden rounded-lg bg-card shadow-sm ${className ?? ""}`} style={{ aspectRatio: "16 / 9" }}>
      <div
        style={{
          width: L,
          height: A,
          transform: `scale(${largura ? largura / L : 0})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Caixa({ style, children }: { style: CSSProperties; children?: ReactNode }) {
  return <div style={{ position: "absolute", ...style }}>{children}</div>;
}

function Titulo({ texto, subtitulo }: { texto: string; subtitulo?: string }) {
  return (
    <>
      <Caixa
        style={{
          left: polegada(0.75),
          top: polegada(0.32),
          width: polegada(7.75),
          whiteSpace: "nowrap",
          fontSize: tamanhoTituloPx(texto),
          lineHeight: 1.15,
          fontWeight: 700,
          color: CORES.navy,
          fontFamily: FONTE_TITULO,
        }}
      >
        {texto.toUpperCase()}
      </Caixa>
      {subtitulo && (
        <Caixa
          style={{
            left: polegada(0.75),
            top: polegada(0.95),
            width: polegada(10.2),
            fontSize: ptPx(10.5),
            color: CORES.cinza,
          }}
        >
          {subtitulo}
        </Caixa>
      )}
    </>
  );
}

function Selo({ texto }: { texto: string }) {
  return (
    <Caixa
      style={{
        left: polegada(8.55),
        top: polegada(0.24),
        width: polegada(4.05),
        height: polegada(0.92),
        background: CORES.navy3,
        borderRadius: polegada(0.42),
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingRight: polegada(0.3),
        color: CORES.branco,
        fontWeight: 700,
        fontSize: ptPx(19),
      }}
    >
      {texto}
    </Caixa>
  );
}

/** gráfico de colunas agrupadas dos meses comparados */
function Barras({ meses, dados }: { meses: string[]; dados: SegmentoResumo[] }) {
  const topo = Math.max(1, ...dados.flatMap((d) => d.valores.map((v) => v.valor)));
  const comVariacao = meses.length > 1;
  const altura = polegada(3.6);
  const largura = polegada(11.9);
  return (
    <Caixa style={{ left: polegada(0.75), top: polegada(1.3), width: largura }}>
      <div
        style={{
          display: "flex",
          gap: polegada(0.34),
          alignItems: "flex-end",
          height: altura,
          borderBottom: `1px solid ${CORES.linha}`,
        }}
      >
        {dados.map((d) => (
          <div key={d.nome} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: polegada(0.08), height: "100%" }}>
              {d.valores.map((v, i) => (
                <div key={v.mes} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%" }}>
                  <span style={{ fontSize: ptPx(10), color: CORES.tinta, fontWeight: 700, marginBottom: 2 }}>
                    {v.valor > 0 ? formatM3(Math.round(v.valor)) : ""}
                  </span>
                  <div
                    style={{
                      width: "100%",
                      height: `${Math.max(2, (v.valor / topo) * 82)}%`,
                      background: CORES.serie[(meses.length - d.valores.length + i) % CORES.serie.length],
                      borderRadius: `2px 2px 0 0`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: polegada(0.1), fontSize: ptPx(10), fontWeight: 700, color: CORES.navy }}>
              {d.nome}
              <div style={{ fontSize: ptPx(9), fontWeight: 600, color: d.variacao >= 0 ? CORES.verde : CORES.vermelho }}>
                {comVariacao ? pct(d.variacao) : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Caixa>
  );
}

function Participacao({ dados, rotulo, topo }: { dados: SegmentoResumo[]; rotulo: string; topo: number }) {
  const total = dados.reduce((acc, d) => acc + d.atual, 0) || 1;
  return (
    <Caixa
      style={{
        left: polegada(0.75),
        top: polegada(topo),
        width: polegada(11.8),
        background: "#F1F5FB",
        borderRadius: polegada(0.42),
        padding: `${polegada(0.1)} ${polegada(0.2)}`,
        display: "flex",
        gap: polegada(0.3),
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: ptPx(7.5), fontWeight: 700, color: CORES.cinza }}>{rotulo.toUpperCase()}</span>
      <span style={{ fontSize: ptPx(8.3), fontWeight: 700, color: CORES.navy }}>
        {dados.map((d) => `${d.nome} ${Math.round((d.atual / total) * 100)}%`).join(" · ")}
      </span>
    </Caixa>
  );
}

function Rodape({ texto, topo = 6.3 }: { texto: string; topo?: number }) {
  return (
    <Caixa style={{ left: polegada(0.75), top: polegada(topo), width: polegada(11.8), fontSize: ptPx(9.5), color: CORES.cinza, fontWeight: 600 }}>
      {texto}
    </Caixa>
  );
}

function Logotipo({ escuro = false }: { escuro?: boolean }) {
  return (
    <img
      src={escuro ? "/apresentacao/logo-branco.png" : "/apresentacao/logo-azul.png"}
      alt="Multiplus"
      style={{ position: "absolute", left: polegada(0.75), top: polegada(6.98), width: polegada(1.05) }}
    />
  );
}

function Cartao({ x, y, rotulo, valor, detalhe, cor }: { x: number; y: number; rotulo: string; valor: string; detalhe: string; cor: string }) {
  return (
    <Caixa
      style={{
        left: polegada(x),
        top: polegada(y),
        width: polegada(3.7),
        height: polegada(2.0),
        background: CORES.branco,
        border: `1px solid ${CORES.linha}`,
        borderRadius: polegada(0.22),
        overflow: "hidden",
        padding: polegada(0.28),
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: polegada(0.14), background: cor }} />
      <div style={{ fontSize: ptPx(8.5), letterSpacing: 0.4, fontWeight: 700, color: CORES.cinza, marginTop: polegada(0.1) }}>{rotulo}</div>
      <div style={{ fontSize: ptPx(21), fontWeight: 700, color: CORES.navy, marginTop: polegada(0.1), lineHeight: 1.15 }}>{valor}</div>
      <div style={{ fontSize: ptPx(9), color: CORES.cinza, marginTop: polegada(0.12) }}>{detalhe}</div>
    </Caixa>
  );
}

export function SlideView({ slide }: { slide: Slide }) {
  if (slide.tipo === "capa" || slide.tipo === "obrigado") {
    return (
      <img
        src={slide.tipo === "capa" ? "/apresentacao/capa-paulinia.jpg" : "/apresentacao/obrigado.jpg"}
        alt={slide.tipo === "capa" ? "Capa da apresentação" : "Obrigado"}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    );
  }

  if (slide.tipo === "volume") {
    return (
      <div style={{ width: "100%", height: "100%", position: "relative", background: CORES.navy }}>
        <img src="/apresentacao/capa-volume.jpg" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: polegada(7.5 * 0.3389),
            width: `${(2 * 0.2876) * 100}%`,
            transform: "translateY(-50%)",
            textAlign: "center",
            fontSize: ptPx(50.2),
            fontWeight: 700,
            color: CORES.branco,
          }}
        >
          {slide.mesNome}
        </div>
        <div style={{ position: "absolute", top: polegada(7.5 * 0.5592), left: polegada(13.333 * 0.1533), transform: "translateY(-50%)", display: "flex", gap: polegada(0.1), whiteSpace: "nowrap", alignItems: "baseline" }}>
          <span style={{ fontSize: ptPx(43), fontWeight: 700, color: CORES.branco }}>Meta:</span>
          <span style={{ fontSize: ptPx(43), fontWeight: 700, color: CORES.branco }}>{formatM3(slide.meta)} m³</span>
        </div>
        <div style={{ position: "absolute", top: polegada(7.5 * 0.6931), left: polegada(13.333 * 0.1533), transform: "translateY(-50%)", display: "flex", gap: polegada(0.1), whiteSpace: "nowrap", alignItems: "baseline" }}>
          <span style={{ fontSize: ptPx(34), color: "#B2B2AF" }}>Volume atingido:</span>
          <span style={{ fontSize: ptPx(43), fontWeight: 700, color: CORES.branco }}>{formatM3(slide.total)} m³</span>
        </div>
        <div style={{ position: "absolute", top: polegada(7.5 * 0.8223), left: polegada(13.333 * 0.1744), transform: "translateY(-50%)", fontSize: ptPx(43), fontWeight: 700, color: CORES.branco }}>
          {num(slide.atingimento, 0)}%
        </div>
        {slide.parcial && slide.corteEm && (
          <div style={{ position: "absolute", left: polegada(0.75), bottom: polegada(0.35), fontSize: ptPx(9), color: "#BDD3EE" }}>
            Mês em andamento · dados até {slide.corteEm}
          </div>
        )}

      </div>
    );
  }

  if (slide.tipo === "metas") {
    const cards = slide.segmentos.slice(0, 4);
    const largura = 3.05;
    const vao = 0.22;
    const inicio = (13.333 - (cards.length * largura + (cards.length - 1) * vao)) / 2;
    const pctTotal = slide.total > 0 ? (slide.realizado / slide.total) * 100 : 0;
    const corTotal = pctTotal >= 100 ? CORES.verde : pctTotal >= 90 ? CORES.dourado : "#FF8F9B";
    return (
      <div style={{ width: "100%", height: "100%", background: CORES.navy, position: "relative", overflow: "hidden" }}>
        <Caixa
          style={{
            left: polegada(0.85),
            top: polegada(0.75),
            fontSize: ptPx(11.5),
            letterSpacing: 1.5,
            fontWeight: 700,
            color: "#6FA8F5",
          }}
        >
          — META MENSAL POR SEGMENTO —
        </Caixa>
        <Caixa style={{ left: polegada(0.85), top: polegada(1.1), fontSize: ptPx(40), fontWeight: 700, color: CORES.branco }}>
          {slide.mesNome}
        </Caixa>
        <Caixa style={{ left: polegada(0.85), top: polegada(1.95), fontSize: ptPx(20), fontWeight: 700, color: AZUL_CLARO_TXT }}>
          — {slide.ano} —
        </Caixa>

        {/* logo branco no canto superior direito, igual ao das capas */}
        <img
          src="/apresentacao/logo-branco.png"
          alt="Multiplus"
          style={{ position: "absolute", right: polegada(0.5), top: polegada(0.42), width: polegada(5.6) }}
        />

        {cards.map((item, i) => {
          const pctv = item.meta > 0 ? (item.realizado / item.meta) * 100 : 0;
          const cor = pctv >= 100 ? CORES.verde : pctv >= 90 ? CORES.dourado : "#FF8F9B";
          return (
            <Caixa
              key={item.nome}
              style={{
                left: polegada(inicio + i * (largura + vao)),
                top: polegada(2.95),
                width: polegada(largura),
                height: polegada(2.35),
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: polegada(0.2),
                padding: polegada(0.24),
              }}
            >
              <div style={{ fontSize: ptPx(12.5), fontWeight: 700, color: CORES.branco, letterSpacing: 0.4 }}>
                {item.nome.toUpperCase()}
              </div>
              <div style={{ fontSize: ptPx(10), color: "#9CC0F0", marginTop: polegada(0.06) }}>
                {formatM3(item.dia)} m³ por dia útil
              </div>
              <div style={{ fontSize: ptPx(28), fontWeight: 700, color: CORES.branco, marginTop: polegada(0.3), lineHeight: 1.1 }}>
                {formatM3(Math.round(item.meta * 10) / 10)}
              </div>
              <div style={{ fontSize: ptPx(10), color: "#9CC0F0" }}>m³ de meta no mês</div>
              <div style={{ marginTop: polegada(0.18), display: "flex", alignItems: "baseline", gap: polegada(0.08) }}>
                <span style={{ fontSize: ptPx(9), color: "#9CC0F0" }}>realizado</span>
                <span style={{ fontSize: ptPx(13), fontWeight: 700, color: CORES.branco }}>
                  {formatM3(Math.round(item.realizado * 10) / 10)}
                </span>
                <span style={{ fontSize: ptPx(11), fontWeight: 700, color: cor }}>{num(pctv)}%</span>
              </div>
            </Caixa>
          );
        })}

        <Caixa
          style={{
            left: polegada(0.85),
            top: polegada(5.6),
            display: "flex",
            alignItems: "baseline",
            gap: polegada(0.22),
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: ptPx(12), fontWeight: 700, letterSpacing: 1.2, color: "#9CC0F0" }}>
            META DO MÊS
          </span>
          <span style={{ fontSize: ptPx(34), fontWeight: 700, color: CORES.dourado }}>
            {formatM3(Math.round(slide.total * 10) / 10)} m³
          </span>
          <span style={{ fontSize: ptPx(12), color: "#9CC0F0" }}>
            · realizado {formatM3(Math.round(slide.realizado * 10) / 10)} m³
          </span>
          <span style={{ fontSize: ptPx(15), fontWeight: 700, color: corTotal }}>{num(pctTotal)}%</span>
          <span style={{ fontSize: ptPx(11), color: "#9CC0F0" }}>· {slide.diasUteis} dias úteis</span>
        </Caixa>
        <Logotipo escuro />
      </div>
    );
  }

  if (slide.tipo === "segmentos") {
    return (
      <div style={{ width: "100%", height: "100%", background: CORES.fundo, position: "relative" }}>
        <Titulo texto={slide.titulo} subtitulo={slide.subtitulo} />
        <Selo texto={slide.selo} />
        <Barras meses={slide.meses} dados={slide.dados} />
        <Participacao dados={slide.dados} rotulo={`Participação em ${slide.meses[slide.meses.length - 1]}`} topo={5.55} />
        <Rodape texto={slide.nota} />
        <Logotipo />
      </div>
    );
  }

  if (slide.tipo === "top10") {
    const [primeiro, segundo, terceiro, ...resto] = slide.clientes;
    const podio = [
      { cliente: primeiro, cor: CORES.dourado, trofeu: "/apresentacao/trofeu1.png" },
      { cliente: segundo, cor: CORES.prata, trofeu: "/apresentacao/trofeu2.png" },
      { cliente: terceiro, cor: CORES.bronze, trofeu: "/apresentacao/trofeu3.png" },
    ].filter((p) => p.cliente);
    return (
      <div style={{ width: "100%", height: "100%", background: CORES.fundo, position: "relative" }}>
        <Caixa style={{ left: 0, top: polegada(0.26), width: L, textAlign: "center", fontSize: ptPx(26), fontWeight: 700, color: CORES.navy, fontFamily: "'Arial Narrow', Arial, sans-serif" }}>
          TOP 10 — CLIENTES DO MÊS
        </Caixa>
        <Caixa style={{ left: 0, top: polegada(0.75), width: L, textAlign: "center", fontSize: ptPx(10), color: CORES.cinza }}>
          {slide.subtitulo}
        </Caixa>
        {podio.map((p, i) => (
          <Caixa
            key={p.cliente.nome}
            style={{
              left: polegada(0.67 + i * 4.07),
              top: polegada(1.22),
              width: polegada(3.85),
              height: polegada(2.35),
              background: CORES.branco,
              border: `1px solid ${CORES.linha}`,
              borderRadius: polegada(0.22),
              overflow: "hidden",
              textAlign: "center",
            }}
          >
            <div style={{ height: polegada(0.12), background: p.cor }} />
            <img src={p.trofeu} alt="" style={{ height: polegada(0.78), marginTop: polegada(0.08) }} />
            <div style={{ fontSize: ptPx(12.5), fontWeight: 700, color: CORES.navy, marginTop: polegada(0.04), padding: `0 ${polegada(0.15)}` }}>
              {p.cliente.nome}
            </div>
            <div style={{ fontSize: ptPx(19), fontWeight: 700, color: CORES.azul, marginTop: polegada(0.02) }}>
              {formatM3(p.cliente.atual)} m³
            </div>
            <div
              style={{
                display: "inline-block",
                marginTop: polegada(0.05),
                padding: `${polegada(0.03)} ${polegada(0.16)}`,
                borderRadius: polegada(0.14),
                fontSize: ptPx(9.5),
                fontWeight: 700,
                color: p.cliente.variacao >= 0 ? CORES.verde : CORES.vermelho,
                background: p.cliente.variacao >= 0 ? "#E6F6EE" : "#FCECEE",
              }}
            >
              {pct(p.cliente.variacao)}
            </div>
            <div style={{ marginTop: polegada(0.03), fontSize: ptPx(9.5), fontWeight: 700, color: CORES.cinza }}>
              {num(p.cliente.participacao)}% do mês
            </div>
          </Caixa>
        ))}
        <Caixa style={{ left: polegada(0.72), top: polegada(3.72), fontSize: ptPx(8.5), fontWeight: 700, color: CORES.cinza }}>
          4º AO 10º
        </Caixa>
        {resto.map((c, i) => {
          const y = 4 + i * 0.435;
          return (
            <Caixa
              key={c.nome}
              style={{
                left: polegada(0.67),
                top: polegada(y),
                width: polegada(11.99),
                height: polegada(0.39),
                background: i % 2 === 0 ? CORES.branco : "#F3F7FC",
                borderRadius: polegada(0.18),
                display: "flex",
                alignItems: "center",
                paddingLeft: polegada(0.16),
                paddingRight: polegada(0.16),
                gap: polegada(0.1),
              }}
            >
              <div style={{ width: polegada(0.21), height: polegada(0.21), borderRadius: "50%", background: CORES.azulClaro, display: "grid", placeItems: "center", fontSize: ptPx(8.5), fontWeight: 700, color: CORES.navy }}>
                {i + 4}
              </div>
              <div style={{ flex: 1, fontSize: ptPx(11), fontWeight: 700, color: CORES.tinta, paddingLeft: polegada(0.4) }}>{c.nome}</div>
              <div style={{ width: polegada(2.1), textAlign: "right", fontSize: ptPx(11.5), fontWeight: 700, color: CORES.navy }}>{formatM3(c.atual)} m³</div>
              <div style={{ width: polegada(1.6), textAlign: "right", fontSize: ptPx(10.5), fontWeight: 700, color: c.variacao >= 0 ? CORES.verde : CORES.vermelho }}>
                {pct(c.variacao)}
              </div>
              <div style={{ width: polegada(1.4), textAlign: "right", fontSize: ptPx(10.5), fontWeight: 700, color: CORES.cinza }}>
                {num(c.participacao)}%
              </div>
            </Caixa>
          );
        })}
        <Logotipo />
      </div>
    );
  }

  if (slide.tipo === "comparativo") {
    const topo = Math.max(1, ...slide.meses.map((m) => Math.max(m.valor, m.meta)));
    return (
      <div style={{ width: "100%", height: "100%", background: CORES.fundo, position: "relative" }}>
        <Titulo texto="Comparativo de volume mensal 2026" subtitulo={slide.subtitulo} />
        <Selo texto={slide.selo} />
        <Caixa style={{ left: polegada(0.75), top: polegada(1.3), width: polegada(8.0) }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: polegada(0.5), height: polegada(4.4), borderBottom: `1px solid ${CORES.linha}` }}>
            {slide.meses.map((m) => (
              <div key={m.mes} style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: polegada(0.12), height: "100%" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%" }}>
                  <span style={{ fontSize: ptPx(8), fontWeight: 600, color: CORES.cinza }}>{formatM3(Math.round(m.meta))}</span>
                  <div style={{ width: "100%", height: `${(m.meta / topo) * 80}%`, background: "#D9E2F2", borderRadius: "2px 2px 0 0" }} />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%" }}>
                  <span style={{ fontSize: ptPx(8.5), fontWeight: 700, color: CORES.navy }}>{formatM3(Math.round(m.valor))}</span>
                  <div style={{ width: "100%", height: `${(m.valor / topo) * 80}%`, background: "#0B3D91", borderRadius: "2px 2px 0 0" }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: polegada(0.5), marginTop: polegada(0.1) }}>
            {slide.meses.map((m) => (
              <div key={m.mes} style={{ flex: 1, textAlign: "center", fontSize: ptPx(10), fontWeight: 700, color: CORES.navy }}>
                {m.nome}
              </div>
            ))}
          </div>
        </Caixa>
        <Caixa style={{ left: polegada(9.1), top: polegada(1.35), fontSize: ptPx(8.5), fontWeight: 700, color: CORES.cinza }}>
          ATINGIMENTO POR MÊS
        </Caixa>
        {slide.meses.map((m, i) => {
          const y = 1.7 + i * 0.95;
          const cor = m.atingimento >= 100 ? CORES.verde : m.atingimento >= 90 ? CORES.dourado : CORES.vermelho;
          return (
            <div key={m.mes}>
              <Caixa style={{ left: polegada(9.1), top: polegada(y), fontSize: ptPx(10), fontWeight: 700, color: CORES.cinza }}>{m.nome}</Caixa>
              <Caixa style={{ left: polegada(11.0), top: polegada(y), width: polegada(1.7), textAlign: "right", fontSize: ptPx(11), fontWeight: 700, color: cor }}>
                {num(m.atingimento)}%
              </Caixa>
              <Caixa style={{ left: polegada(9.1), top: polegada(y + 0.22), fontSize: ptPx(7.5), fontWeight: 700, color: CORES.azul }}>
                {m.parcial ? `${m.diasUteis} de ${m.diasUteisMes} dias úteis` : `${m.diasUteis} dias úteis`}
              </Caixa>
              <Caixa style={{ left: polegada(9.1), top: polegada(y + 0.47), width: polegada(3.6), height: polegada(0.1), background: "#E7ECF4", borderRadius: polegada(0.05) }}>
                <div style={{ width: `${Math.min(100, (m.atingimento / 110) * 100)}%`, height: "100%", background: cor, borderRadius: polegada(0.05) }} />
              </Caixa>
            </div>
          );
        })}
        <Caixa
          style={{
            left: polegada(0.75),
            top: polegada(6.32),
            width: polegada(11.9),
            padding: `${polegada(0.14)} ${polegada(0.2)}`,
            background: CORES.branco,
            border: `1px solid ${CORES.linha}`,
            borderRadius: polegada(0.2),
            fontSize: ptPx(8.5),
            color: CORES.cinza,
          }}
        >
          {slide.nota}
        </Caixa>
        <Logotipo />
      </div>
    );
  }

  if (slide.tipo === "comparativoAnual") {
    const topo = Math.max(
      1,
      ...slide.meses.flatMap((m) => [m.v2025, m.v2026]),
    );
    const larguraGrafico = polegada(8.1);
    return (
      <div style={{ width: "100%", height: "100%", background: CORES.fundo, position: "relative" }}>
        <Titulo texto="Comparativo de volume mensal 2025 x 2026" subtitulo={slide.subtitulo} />

        {/* legenda */}
        <Caixa style={{ left: polegada(0.7), top: polegada(1.22), display: "flex", gap: polegada(0.3) }}>
          {[
            { nome: "2026 (m³)", cor: CORES.azul },
            { nome: "2025 (m³)", cor: CORES.dourado },
          ].map((item) => (
            <span key={item.nome} style={{ display: "flex", alignItems: "center", gap: polegada(0.06), fontSize: ptPx(9), fontWeight: 700, color: CORES.tinta }}>
              <span style={{ width: polegada(0.12), height: polegada(0.12), borderRadius: "50%", background: item.cor, display: "inline-block" }} />
              {item.nome}
            </span>
          ))}
        </Caixa>

        <Caixa style={{ left: polegada(0.7), top: polegada(1.6), width: larguraGrafico }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: polegada(0.06), height: polegada(4.5), borderBottom: `1px solid ${CORES.linha}` }}>
            {slide.meses.map((m) => (
              <div key={m.mes} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-end", gap: polegada(0.04), height: "100%" }}>
                {[
                  { valor: m.v2025, cor: CORES.dourado },
                  { valor: m.v2026, cor: CORES.azul },
                ].map((barra, i) => (
                  <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%" }}>
                    <span
                      style={{
                        fontSize: ptPx(10),
                        fontWeight: 700,
                        color: CORES.tinta,
                        marginBottom: 1,
                        whiteSpace: "nowrap",
                        transform: "rotate(-45deg)",
                        transformOrigin: "center bottom",
                      }}
                    >
                      {barra.valor > 0 ? String(Math.round(barra.valor)) : ""}
                    </span>
                    <div
                      style={{
                        width: "100%",
                        height: barra.valor > 0 ? `${Math.max(1, (barra.valor / topo) * 84)}%` : 0,
                        background: barra.cor,
                        borderRadius: "2px 2px 0 0",
                      }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: polegada(0.06), marginTop: polegada(0.08) }}>
            {slide.meses.map((m) => (
              <div key={m.mes} style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: ptPx(11), fontWeight: 700, color: CORES.navy }}>
                {m.nome}
              </div>
            ))}
          </div>
        </Caixa>

        {/* dias úteis e crescimento */}
        <Caixa style={{ left: polegada(9.05), top: polegada(1.3), width: polegada(3.6) }}>
          <table style={{ width: "100%", tableLayout: "fixed", fontSize: ptPx(10.5) }}>
            <thead>
              <tr style={{ color: CORES.cinza, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ width: "30%", textAlign: "left", paddingBottom: polegada(0.04) }}>Mês</th>
                <th style={{ width: "36%", textAlign: "right", paddingBottom: polegada(0.04), fontWeight: 600 }}>
                  Dias 25/26
                </th>
                <th style={{ width: "34%", textAlign: "right", paddingBottom: polegada(0.04) }}>Δ%</th>
              </tr>
            </thead>
            <tbody>
              {slide.meses.map((m) => (
                <tr key={m.mes} style={{ borderTop: `1px solid ${CORES.linha}` }}>
                  <td style={{ padding: `${polegada(0.05)} 0`, fontWeight: 700, color: CORES.navy }}>{m.nome}</td>
                  <td style={{ textAlign: "right", color: CORES.cinza, whiteSpace: "nowrap" }}>
                    {m.dias2025} / {m.dias2026}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontWeight: 700,
                      color:
                        m.crescimento == null
                          ? CORES.cinza
                          : m.crescimento >= 0
                            ? CORES.verde
                            : CORES.vermelho,
                    }}
                  >
                    {m.crescimento == null ? "—" : `${m.crescimento > 0 ? "+" : ""}${num(m.crescimento)}%`}
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: `1px solid ${CORES.navy}` }}>
                <td style={{ paddingTop: polegada(0.05), fontWeight: 700, color: CORES.navy }}>Total</td>
                <td style={{ paddingTop: polegada(0.05), textAlign: "right", color: CORES.cinza }}>
                  {formatM3(Math.round(slide.total2025))} / {formatM3(Math.round(slide.total2026))}
                </td>
                <td
                  style={{
                    paddingTop: polegada(0.05),
                    textAlign: "right",
                    fontWeight: 700,
                    color: (slide.crescimentoTotal ?? 0) >= 0 ? CORES.verde : CORES.vermelho,
                  }}
                >
                  {slide.crescimentoTotal == null
                    ? "—"
                    : `${slide.crescimentoTotal > 0 ? "+" : ""}${num(slide.crescimentoTotal)}%`}
                </td>
              </tr>
            </tbody>
          </table>
        </Caixa>
        <Logotipo />
      </div>
    );
  }

  if (slide.tipo === "forecast") {
    const total = slide.participacao.reduce((acc, p) => acc + p.valor, 0) || 1;
    return (
      <div style={{ width: "100%", height: "100%", background: CORES.fundo, position: "relative" }}>
        <Titulo texto="Forecast — 2026" subtitulo="Realizado no período, média mensal e projeção do ano" />
        {slide.cards.map((c, i) => (
          <Cartao key={c.rotulo} x={0.75 + i * 4} y={1.6} rotulo={c.rotulo} valor={c.valor} detalhe={c.detalhe} cor={[CORES.azul, CORES.navy3, CORES.dourado][i]} />
        ))}
        <Caixa style={{ left: polegada(0.75), top: polegada(4.0), width: polegada(11.8), height: polegada(1.1), background: CORES.branco, border: `1px solid ${CORES.linha}`, borderRadius: polegada(0.2) }}>
          {slide.barra.map((b, i) => (
            <div key={b.rotulo} style={{ position: "absolute", left: polegada(0.25 + i * 3.9), top: polegada(0.18) }}>
              <div style={{ fontSize: ptPx(8.5), fontWeight: 700, color: CORES.cinza }}>{b.rotulo}</div>
              <div style={{ fontSize: ptPx(16), fontWeight: 700, color: i === 2 ? CORES.vermelho : CORES.navy, marginTop: polegada(0.04) }}>{b.valor}</div>
            </div>
          ))}
        </Caixa>
        <Participacao
          dados={slide.participacao.map((p) => ({ nome: p.nome, valores: [], atual: p.valor, anterior: 0, variacao: 0, participacao: (p.valor / total) * 100 }))}
          rotulo="Participação no realizado"
          topo={5.4}
        />
        <Logotipo />
      </div>
    );
  }

  if (slide.tipo === "tabela") {
    return (
      <div style={{ width: "100%", height: "100%", background: CORES.fundo, position: "relative" }}>
        <Titulo texto={slide.titulo} subtitulo={slide.subtitulo} />
        <Caixa style={{ left: polegada(0.75), top: polegada(1.45), width: polegada(11.8) }}>
          <div style={{ display: "grid", gridTemplateColumns: `2.4fr 1.2fr 1.2fr 0.9fr`, background: CORES.navy3, color: CORES.branco, fontSize: ptPx(10), fontWeight: 700, padding: `${polegada(0.08)} ${polegada(0.14)}`, borderRadius: `${polegada(0.1)} ${polegada(0.1)} 0 0` }}>
            {slide.colunas.map((c, i) => (
              <div key={c} style={{ textAlign: i === 0 ? "left" : "right" }}>
                {c}
              </div>
            ))}
          </div>
          {slide.linhas.map((linha, i) => (
            <div
              key={`${linha[0]}-${i}`}
              style={{
                display: "grid",
                gridTemplateColumns: `2.4fr 1.2fr 1.2fr 0.9fr`,
                background: i % 2 === 0 ? CORES.branco : "#F1F5FB",
                fontSize: ptPx(10),
                padding: `${polegada(slide.linhas.length <= 8 ? 0.16 : 0.11)} ${polegada(0.14)}`,
                color: CORES.tinta,
                borderBottom: `1px solid ${CORES.linha}`,
              }}
            >
              {linha.map((v, j) => (
                <div key={j} style={{ textAlign: j === 0 ? "left" : "right", fontWeight: j === 0 ? 600 : 700 }}>
                  {v}
                </div>
              ))}
            </div>
          ))}
        </Caixa>
        <Caixa style={{ left: polegada(0.75), top: polegada(5.2), fontSize: ptPx(11), fontWeight: 700, color: CORES.navy }}>{slide.rodape}</Caixa>
        {slide.nota && <Rodape texto={slide.nota} topo={5.55} />}
        <Logotipo />
      </div>
    );
  }

  // resultado comercial
  const total = slide.segmentos.reduce((acc, s) => acc + s.atual, 0) || 1;
  return (
    <div style={{ width: "100%", height: "100%", background: CORES.fundo, position: "relative" }}>
      <Titulo texto="Resultado comercial do mês" subtitulo={slide.subtitulo} />
      {slide.cards.map((c, i) => (
        <Cartao key={c.rotulo} x={0.75 + i * 4} y={1.6} rotulo={c.rotulo} valor={c.valor} detalhe={c.detalhe} cor={[CORES.azul, CORES.dourado, CORES.navy3][i]} />
      ))}
      <Caixa style={{ left: polegada(0.75), top: polegada(4.0), width: polegada(11.8) }}>
        <div style={{ fontSize: ptPx(8.5), fontWeight: 700, color: CORES.cinza, marginBottom: polegada(0.12) }}>PARTICIPAÇÃO DOS SEGMENTOS</div>
        <div style={{ display: "flex", height: polegada(0.34), borderRadius: polegada(0.17), overflow: "hidden" }}>
          {slide.segmentos.map((s, i) => (
            <div
              key={s.nome}
              style={{ width: `${(s.atual / total) * 100}%`, background: ["#0B3D91", "#1B6FD0", "#4B5CF5", "#5ED2D8", "#8FA8E8", "#C9D6EE"][i % 6], display: "flex", alignItems: "center", justifyContent: "center", color: CORES.branco, fontSize: ptPx(8), fontWeight: 700 }}
            >
              {(s.atual / total) * 100 > 8 ? `${s.nome} ${Math.round((s.atual / total) * 100)}%` : ""}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: polegada(0.2), marginTop: polegada(0.12), fontSize: ptPx(8.5), color: CORES.cinza }}>
          {slide.segmentos.map((s, i) => (
            <span key={s.nome}>
              <span style={{ color: ["#0B3D91", "#1B6FD0", "#4B5CF5", "#5ED2D8", "#8FA8E8", "#C9D6EE"][i % 6], fontWeight: 700 }}>■</span> {s.nome}
            </span>
          ))}
        </div>
      </Caixa>
      <Rodape texto={slide.nota} topo={6.2} />
      <Logotipo />
    </div>
  );
}
