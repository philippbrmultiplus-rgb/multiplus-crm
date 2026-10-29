import { Download, FileSignature, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LOGO_CONTRATO, partesDoTexto, type BlocoContrato, type ContratoMontado } from "@/lib/contrato";

/** parágrafo do contrato na prévia (mesmo texto usado no Word) */
function Bloco({ bloco }: { bloco: BlocoContrato }) {
  switch (bloco.tipo) {
    case "numero":
      return (
        <p className="text-right text-[14px]">
          Contrato nº <span className="text-[16px] font-bold">{bloco.numero}</span>
        </p>
      );
    case "titulo":
      return (
        <p className="mt-2 mb-8 whitespace-pre-line text-center text-[16px] font-bold uppercase leading-snug">
          {partesDoTexto(bloco.texto).map((parte, i) =>
            parte.negrito ? (
              <strong key={i} className="font-bold">
                {parte.texto}
              </strong>
            ) : (
              <span key={i}>{parte.texto}</span>
            ),
          )}
        </p>
      );
    case "secao":
      return <p className="mt-6 mb-2 text-[14px] font-bold">{bloco.texto}</p>;
    case "rotulo":
      return <p className="mt-5 mb-1 text-[14px] font-bold">{bloco.texto}</p>;
    case "paragrafo":
      return (
        <p
          className={[
            "mb-3 text-[13.5px] leading-relaxed",
            bloco.negrito ? "font-bold" : "",
            bloco.alinhamento === "center"
              ? "text-center"
              : bloco.alinhamento === "right"
                ? "text-right"
                : bloco.alinhamento === "left"
                  ? "text-left"
                  : "text-justify",
          ].join(" ")}
          style={{ marginTop: bloco.espacoAntes ? bloco.espacoAntes / 20 : undefined }}
        >
          {partesDoTexto(bloco.texto).map((parte, i) =>
            parte.negrito ? (
              <strong key={i} className="font-bold">
                {parte.texto}
              </strong>
            ) : (
              <span key={i}>{parte.texto}</span>
            ),
          )}
        </p>
      );
    case "tabela":
      return (
        <table className="my-4 w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {bloco.cabecalho.map((titulo) => (
                <th
                  key={titulo}
                  className="border border-neutral-500 bg-[#8EA9C1] px-2 py-2 text-center font-bold italic"
                >
                  {titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bloco.linhas.map((linha, i) => (
              <tr key={i}>
                {linha.map((valor, j) => (
                  <td
                    key={j}
                    className={`border border-neutral-500 px-2 py-2 text-center ${
                      bloco.negritoValores ? "font-bold" : ""
                    }`}
                  >
                    {valor}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "assinatura":
      return (
        <div className="mt-12">
          <p className="text-[13.5px]">______________________________________________</p>
          <p className="text-[13.5px] font-bold">{bloco.nome}</p>
          <p className="text-[13.5px]">{bloco.cargo}</p>
        </div>
      );
    case "testemunhas":
      return (
        <div className="mt-10">
          <p className="text-[13.5px]">Testemunhas:</p>
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <div>
              <p className="text-[13.5px]">_______________________________</p>
              <p className="text-[13.5px]">Nome: {bloco.nome || "______________________"}</p>
              <p className="text-[13.5px]">CPF: {bloco.cpf || "_________________"}</p>
            </div>
            <div>
              <p className="text-[13.5px]">_______________________________</p>
              <p className="text-[13.5px]">Nome: ______________________</p>
              <p className="text-[13.5px]">Cpf: _________________</p>
            </div>
          </div>
        </div>
      );
    case "quebra":
      return <div className="my-8 border-t border-dashed border-neutral-300" />;
  }
}

/**
 * Pré-visualização do contrato antes de baixar: mostra exatamente o conteúdo e a
 * formatação que vão para o arquivo do Word.
 */
export function ContratoPreviewDialog({
  montado,
  onClose,
  onBaixar,
  baixando,
}: {
  montado: ContratoMontado | null;
  onClose: () => void;
  onBaixar: () => void;
  baixando: boolean;
}) {
  if (!montado) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSignature className="h-4 w-4" /> Pré-visualização do contrato
          </DialogTitle>
          <DialogDescription>
            Contrato nº {montado.numero} · {montado.clienteNome} — confira os dados antes de baixar.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(100dvh-14rem)] overflow-y-auto overscroll-contain bg-muted/40 p-3 sm:p-5">
          {/* folha do documento */}
          <div className="mx-auto w-full max-w-[760px] rounded-sm bg-white px-6 py-8 text-neutral-900 shadow-sm sm:px-10">
            <img src={LOGO_CONTRATO} alt="Multiplus" className="mb-6 h-10 w-auto sm:h-12" />
            {montado.blocos.map((bloco, i) => (
              <Bloco key={i} bloco={bloco} />
            ))}
          </div>
        </div>

        <DialogFooter className="border-t px-4 py-3 sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={onBaixar} disabled={baixando}>
            {baixando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Baixar em Word
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
