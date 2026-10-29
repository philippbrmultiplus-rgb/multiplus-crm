import type { Client, Settings } from "./types";

/** equipamentos usados no contrato (como no modelo enviado) */
export const EQUIPAMENTOS_CONTRATO = [
  "Caçamba Roll On - 26m³",
  "Caçamba Poli - 5m³",
  "Caçamba Roll On - 35m³",
  "Porta a Porta",
];

/** logo oficial usada no cabeçalho de todas as páginas */
export const LOGO_CONTRATO = "/contrato-logo.png";

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** pedaços do contrato: o mesmo conteúdo alimenta a prévia e o arquivo do Word */
export type BlocoContrato =
  | { tipo: "numero"; numero: string }
  | { tipo: "titulo"; texto: string }
  | { tipo: "secao"; texto: string }
  | { tipo: "rotulo"; texto: string }
  | {
      tipo: "paragrafo";
      texto: string;
      negrito?: boolean;
      alinhamento?: "justify" | "left" | "center" | "right";
      espacoAntes?: number;
      espacoDepois?: number;
    }
  | { tipo: "tabela"; cabecalho: string[]; linhas: string[][] }
  | { tipo: "assinatura"; nome: string; cargo: string }
  | { tipo: "testemunhas"; nome: string; cpf: string }
  | { tipo: "quebra" };

export interface ContratoMontado {
  numero: string;
  clienteNome: string;
  blocos: BlocoContrato[];
}

export interface OpcoesContrato {
  numero: string;
  cliente: Client;
  settings: Settings;
  /** dia da assinatura (padrão: hoje) */
  data?: Date;
}

function moeda(valor: number | null | undefined, padrao = 1400): string {
  const numero = valor == null || Number.isNaN(valor) ? padrao : valor;
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** valor do modelo escrito por extenso (quando é o padrão de R$ 1.400,00) */
function valorComExtenso(valor: number | null | undefined): string {
  const numero = valor == null ? 1400 : valor;
  return numero === 1400 ? `${moeda(1400)} (mil e quatrocentos reais)` : moeda(numero);
}

function dataPorExtenso(data: Date): string {
  return `${data.getDate()} de ${MESES[data.getMonth()]} de ${data.getFullYear()}`;
}

/** próximo número de contrato sugerido, a partir dos já gravados nos clientes */
export function proximoNumeroContrato(clients: Client[]): string {
  const numeros = clients
    .map((c) => Number(String(c.contratoNumero ?? "").replace(/\D/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
  const maior = numeros.length > 0 ? Math.max(...numeros) : 26350;
  return String(maior + 1);
}

/** monta o contrato (texto + dados do cliente) na mesma ordem do modelo */
export function montarContrato({ numero, cliente, settings, data = new Date() }: OpcoesContrato): ContratoMontado {
  const emp = {
    razao: settings.empresaRazao || "MULTIPLUS RECICLAGEM DE GESSO LTDA",
    cnpj: settings.empresaCnpj || "54.927.423/0001-80",
    ie: settings.empresaIe || "096/4011336",
    endereco: settings.empresaEndereco || "AV SEVERO DULLIUS, N°125, ANCHIETA",
    cidade: settings.empresaCidade || "Porto Alegre",
    uf: settings.empresaUf || "RS",
    cep: settings.empresaCep || "90200-310",
  };
  const cli = {
    razao: cliente.name,
    endereco: [cliente.address, cliente.city, cliente.state].filter(Boolean).join(" - "),
    cidade: [cliente.city, cliente.state].filter(Boolean).join("/"),
  };
  const foro = settings.contratoForo || `${emp.cidade}/${emp.uf}`;
  const prazo = settings.contratoPrazoMeses ?? 36;
  const valorViagem = valorComExtenso(settings.contratoValorViagem);
  const valorEquipamento = valorComExtenso(settings.contratoValorEquipamento);
  const equipamento = cliente.equipamento || EQUIPAMENTOS_CONTRATO[0];
  const quantidade = cliente.equipamentosQtd ?? 1;
  const trocas = cliente.trocasMinimas ?? 1;
  const valorTroca = cliente.valorTroca || "R$ 300,00";
  const diaPagamento = cliente.diaPagamento ?? 10;
  const formaPagamento = cliente.formaPagamento || "Fechamento mensal";
  const localColeta =
    cliente.localColeta || `${cliente.address || ""}${cli.cidade ? ` - ${cli.cidade}` : ""}`;
  const testemunha = settings.contratoTestemunhaNome || "";
  const testemunhaCpf = settings.contratoTestemunhaCpf || "";

  const p = (texto: string, extra?: Partial<Extract<BlocoContrato, { tipo: "paragrafo" }>>) =>
    ({ tipo: "paragrafo", texto, ...extra }) as BlocoContrato;

  const blocos: BlocoContrato[] = [
    { tipo: "numero", numero },
    { tipo: "titulo", texto: "INSTRUMENTO PARTICULAR\nDE CONTRATO DE PRESTAÇÃO DE SERVIÇOS" },

    p(
      `Pelo presente instrumento particular e na melhor forma de direito, de um lado, a pessoa jurídica de direito privado ${cli.razao}, estabelecida na ${cli.endereco}${cliente.cnpj ? `, inscrita no CNPJ n° ${cliente.cnpj}` : ""}; Inscrição Estadual n° ${cliente.inscricaoEstadual || "ISENTO"}, doravante denominada de CONTRATANTE e;`,
      { espacoAntes: 240 },
    ),
    p(
      `${emp.razao}, pessoa jurídica de direito privado, estabelecida na cidade e Comarca de ${emp.cidade}/${emp.uf}, na ${emp.endereco} CEP: ${emp.cep} inscrita no CNPJ do MF sob no ${emp.cnpj} e Inscrição Estadual no ${emp.ie}, neste ato e data representada por seus representantes ao final assinado, doravante denominada simplesmente de CONTRATADA têm justo e contratado o seguinte que mutuamente aceitam e outorgam, a saber:`,
    ),

    { tipo: "secao", texto: "CLÁUSULA I – Objeto" },
    p(
      "1.1 – Constitui objeto deste contrato, a prestação, pela CONTRATADA à CONTRATANTE, de serviços especializados em coleta e transporte de Resíduo de Gesso (Drywall, Blocos de gesso, painéis, forros, gesso em pó, granulado e farelado), gerado no local indicado no Anexo Único do presente contrato, o qual para todos os efeitos, fica parte integrante deste instrumento.",
    ),

    { tipo: "secao", texto: "CLÁUSULA II – Forma de Execução" },
    p(
      "2.1 – EQUIPAMENTOS – Para a perfeita execução do presente, a CONTRATADA colocará à disposição da CONTRATANTE, a título de comodato, pelo prazo deste contrato, no local indicado para a coleta, o(s) equipamento(s) descrito(s) e relacionado(s) no Anexo Único do presente contrato, devendo revisá-lo periodicamente e manter em ordem seus acessórios, dispositivos e efetuando os reparos e ou substituindo aquele que não oferecer condições ideais de uso.",
    ),
    p(
      "2.1.1 – A CONTRATADA, somente colocará o equipamento descrito e relacionado no Anexo Único do presente contrato, em lugar fechado e de fácil acesso.",
    ),
    p(
      "2.2 – NÚMERO DE COLETAS – A CONTRATADA realizará o número de coletas estabelecido no Anexo Único do presente contrato, entendendo-se por coleta o volume total acondicionado no equipamento mencionado no item 2.1 acima.",
    ),
    p(
      "2.2.1 – Na hipótese de a CONTRATANTE, em caráter de emergência, necessitar elevar o número de coletas estabelecido, a CONTRATANTE deverá solicitá-las, por telefone, formalizando por escrito, ao setor comercial da CONTRATADA, com antecedência de no mínimo 24 (Vinte e Quatro) horas, o qual a CONTRATADA providenciará a programação da execução da mesma, conforme descrito no item 2.3 deste.",
    ),
    p(
      "2.2.2 – A prestação dos serviços descritos na CLÁUSULA I poderá ser suspensa temporariamente, nas seguintes situações:",
    ),
    p(
      "a) CONTRATANTE – Férias coletivas e feriados prolongados, devendo fazer tal comunicação, verbal e escrita, à CONTRATADA com antecedência mínima de 48 (quarenta e oito) horas.",
    ),
    p(
      "b) CONTRATADA – Quando aberturas recorrentes de RNC (Relatório de Não Conformidade), sem providências, devendo a CONTRATADA, avisar imediatamente a CONTRATANTE.",
    ),
    p(
      "2.2.3 – A CONTRATANTE se compromete a diligenciar no sentido de que tanto a entrada às suas instalações como o acesso ao local do equipamento, descrito e relacionado no Anexo Único do presente contrato, seja facilitada ao máximo para os veículos coletores da CONTRATADA, evitando demora desnecessária na execução dos serviços.",
    ),
    p(
      "2.2.4 – O prazo máximo de espera para início da execução do serviço descrito na CLÁUSULA I, é de 30 (Trinta) minutos, podendo a CONTRATADA deixar o local sem a execução do serviço, sendo considerada tentativa de coleta frustrada, sujeita à cobrança de viagem improdutiva, podendo a CONTRATADA exercer o disposto na cláusula 2.5.4.",
    ),
    p(
      "2.3 – PLANO DE TRABALHO – A frequência de coleta e o número de equipamentos necessários à execução dos serviços, constantes no Anexo Único do presente contrato, é resultante de um plano de trabalho elaborado pela CONTRATADA, com base nas informações e levantamento de dados de geração de produto, descrito na CLÁUSULA I, junto a CONTRATANTE, após visita nas instalações da fonte geradora descrita no Anexo Único do presente contrato.",
    ),
    p(
      "2.3.1 – Na hipótese de, no decorrer do contrato, verificar-se a necessidade de alteração do plano de trabalho com respectivo aumento ou diminuição do número de coletas e/ou equipamentos, poderá a CONTRATANTE solicitá-lo, por escrito, à CONTRATADA.",
    ),
    p("2.3.2 – Aprovação do item 2.3.1, a CONTRATADA o colocará em prática em até 7 dias."),
    p(
      "2.3.3 – Qualquer mudança ou alteração no Anexo Único do presente contrato, a CONTRATANTE deverá comunicar por escrito à CONTRATADA, que após estudo e aprovação do novo local, deverá implantar ou não a coleta no mesmo prazo descrito no item 2.3.2, ficando sujeita a celebração de termo aditivo ou novo contrato, conforme avaliação da CONTRATADA, revisando as condições comerciais, onde se definirá a manutenção de cobrança ou não.",
    ),
    p(
      "2.4 – DESTINAÇÃO FINAL DOS RESÍDUOS – A CONTRATADA será a única e exclusiva responsável pela execução do descrito na CLÁUSULA I, objeto deste, através das vias públicas e pela escolha dos locais apropriados para a destinação final.",
    ),
    p(
      "2.5 – RESÍDUOS NÃO COLETÁVEIS – A CONTRATADA se reserva o direito de não coletar resíduos e detritos não constante na CLÁUSULA I, denominados contaminantes ao processo.",
    ),
    p(
      "Ou ainda, que prejudiquem ou danifiquem seus equipamentos e coloque em risco a integridade física de seus funcionários, uma vez identificado tal infração a CONTRATADA notificará a CONTRATANTE.",
    ),
    p(
      "2.5.1 – A CONTRATANTE reembolsará a CONTRATADA por todos os danos, obrigações e demais despesas decorrentes na hipótese da não rigorosa observação do contido no item 2.5, bem como eventuais autuações fiscais e procedimentos havidos quanto à irregularidade evidenciada.",
    ),
    p(
      "2.5.2 – Não existirá obrigatoriedade por parte da CONTRATADA de retirar materiais de alto peso específico e/ou de grandes dimensões, através deste contrato que não seja gesso.",
    ),
    p(
      "2.5.3 – A CONTRATANTE, somente utilizará dos serviços objeto deste contrato para remoção de resíduos de gesso (materiais não perigosos), se comprometendo a não depositar resíduos Classe I (perigosos), ou seja, com características de inflamabilidade, corrosividade, reatividade, toxicidade e patogenicidade, segundo preconiza a NBR 10004 e CETESB, no equipamento descrito no Anexo Único deste contrato, colocado à sua disposição pela CONTRATADA.",
    ),
    p(
      `2.5.4 – A CONTRATANTE em caso de descumprimento do disposto de quaisquer disposições da presente cláusula e impossibilidade de remoção das caçambas pagará a CONTRATADA o valor de ${valorViagem} a título de "viagem perdida".`,
    ),

    { tipo: "secao", texto: "CLÁUSULA III – Responsabilidade Civil" },
    p(
      "3.1 – RESPONSABILIDADE – A CONTRATADA será a única responsável perante terceiros, por todos os danos eventualmente causados em decorrência de atos ilícitos praticados por seus funcionários e prepostos quando no exercício das funções objeto deste contrato, inclusive por acidentes provocados por seus veículos e equipamentos, dentro ou fora das instalações da CONTRATANTE.",
    ),
    p(
      "3.1.1 – Os danos eventualmente causados aos equipamentos colocados à disposição da CONTRATANTE serão por ela mesma suportada, desde que não causados por funcionários, veículos ou prepostos da CONTRATADA.",
    ),

    { tipo: "secao", texto: "CLÁUSULA IV – Prazo e Rescisão do Contrato" },
    p(
      `4.1 – PRAZO – O presente contrato vigorará pelo prazo de ${prazo} (${prazo === 36 ? "trinta e seis" : prazo}) meses, iniciando-se a contar da data assinada pelo mesmo, podendo de comum acordo entre as partes, ser renovado por igual período e mediante termo aditivo assinado pelas partes ou não havendo aditamento o contrato vigorará a partir de então por prazo indeterminado.`,
    ),
    p(
      "4.2 – RESCISÃO – As partes poderão rescindir imotivadamente o presente contrato, desde que a parte interessada comunique a outra por escrito, com antecedência de 90 (noventa) dias, ou indenize o período de aviso prévio, em todo caso tomando-se por base o cumprimento da média dos últimos 03 (três) meses e considerando apenas os valores faturados em período mínimo de 30 dias, sendo desconsiderada da média os valores faturados em período menor ou parcialmente.",
    ),
    p(
      "4.2.2 – O presente contrato também será objeto de rescisão de pleno direito quando se verificar:",
    ),
    p("a) Recuperação judicial, recuperação extrajudicial ou falência."),
    p(
      "b) Seja apurado culpa imprudência, imperícia ou negligência no cumprimento das obrigações contratuais, desde que comprovada.",
    ),
    p(
      "c) Após realizado o teste de viabilidade de até 90 dias corridos, caso não haja volume suficiente para manter a caçamba, a CONTRATADA poderá rescindir o mesmo imediatamente.",
    ),
    p(
      "4.2.3 – Em caso de rescisão antecipada e imotivada do contrato fica estipulada multa no valor de 20% do valor total do contrato, sem prejuízo da indenização do aviso prévio e apuração de perdas e danos.",
    ),
    p(
      "4.2.4 – Considera-se valor total do contrato para fins de apuração da multa constante na cláusula anterior o valor da multiplicação do valor mensal pelo prazo estipulado na cláusula 4.1.",
    ),
    p(
      `4.2.5 – Sem prejuízos de outras apurações a título de perdas e danos, fica estipulado como indenização prévia pela disponibilização do equipamento a que se refere a cláusula 2.1 o valor mensal de ${valorEquipamento} a título de indenização pela disponibilização do equipamento em caso de rescisão antecipada e imotivada.`,
    ),
    p(
      "4.3 – A CONTRATADA reserva-se o direito de rescindir ou suspender a execução do presente contrato na eventualidade de ocorrência de evento grave de natureza governamental, política e econômica, causas fortuitas ou de força maior que impeçam o recebimento dos resíduos no destino final, não podendo ser responsabilizada pela CONTRATANTE a qualquer título.",
    ),

    { tipo: "secao", texto: "CLÁUSULA V – Código de Conduta e Regras Anticorrupção" },
    p(
      '5.1 – As PARTES declaram que estão cientes, conhecem, entendem e observam integralmente as regras estabelecidas na Lei n.º 12.846, de 2013 ("Lei Anticorrupção", em conjunto, as "Regras Anticorrupção"), abstendo-se de qualquer atividade que constitua uma violação às Normas de Conduta e das Regras Anticorrupção. As PARTES se obrigam, ainda, a conduzir suas práticas comerciais de forma ética e em conformidade com o Código de Conduta e as Regras Anticorrupção.',
    ),

    { tipo: "secao", texto: "CLÁUSULA VI – Da Lei Geral de Proteção de Dados (LGPD)" },
    p(
      "6.1 – As PARTES autorizam entre si a coleta de dados pessoais imprescindíveis a execução deste contrato, tendo sido informado quanto ao tratamento de dados que se realizará nos termos do artigo 7° da Lei 13.709/2018 (Lei Geral de Proteção de Dados Pessoais).",
    ),
    p(
      "6.2 – Os dados coletados terão por finalidade a comprovação de prestação de serviços, cobrança judicial e extrajudicial, fins contábeis e outras finalidades legais que independem de autorização nos termos da lei.",
    ),
    p(
      "6.3 – Para fins de preservação da privacidade da CONTRATANTE a CONTRATADA se compromete em reter a menor quantidade possível de dados e excluí-los tão logo atingida a finalidade de seu uso, sem prejuízo pela guarda de dados pelo prazo necessário para cobrança e cumprimento de obrigações legais.",
    ),

    { tipo: "secao", texto: "CLÁUSULA VII – Disposições Finais" },
    p(
      "7.1 – RELAÇÃO ENTRE TERCEIROS – Fica compactuada entre as partes e seus prepostos a total inexistência de vínculo trabalhista entre as partes contratantes, excluindo as obrigações previdenciárias e os encargos sociais, não havendo entre CONTRATADA e CONTRATANTE qualquer tipo de relação de subordinação.",
    ),
    p(
      "7.2 – TRIBUTOS – Os tributos (impostos, taxas, emolumentos, contribuições fiscais e parafiscais) que sejam devidos em decorrência direta ou indireta do presente contrato ou de sua execução, serão de exclusiva responsabilidade do contribuinte assim definido na norma tributária, sem direito a reembolso. A CONTRATANTE, quando fonte retentora, se o caso descontará e recolherá, nos prazos da lei, dos pagamentos que efetuar os tributos que estejam obrigados pela legislação vigente. Qualquer alteração na carga tributária ou qualquer outro tipo de legislação e/ou prática incidente sobre o presente contrato que venha a alterar o equilíbrio contratual existente nesta data, importará na revisão dos preços aqui estipulados, a fim de adequá-los as modificações havidas.",
    ),
    p(
      "7.3 – NOVAÇÃO – A omissão no exercício de qualquer direito ou a forma de exercê-lo em determinada oportunidade não estabelecerá obrigação para a outra parte de, posteriormente, agir da mesma maneira, nem poderá ser alegada como precedente ou novação.",
    ),
    p(
      `7.4 – FORO – Para dirimir as questões decorrentes do ajustado entre as partes fica eleito o foro da cidade de ${foro}, com renúncia a qualquer outro, por mais privilegiado que seja.`,
    ),
    p(
      "E, por estarem assim justas e contratadas na presença das testemunhas abaixo, assinam o presente contrato em 02 (duas) vias de igual teor e para os mesmos efeitos de direito.",
      { espacoAntes: 240 },
    ),
    p(`${emp.cidade}/${emp.uf}, ${dataPorExtenso(data)}`, {
      alinhamento: "right",
      espacoAntes: 360,
      espacoDepois: 480,
    }),
    { tipo: "assinatura", nome: emp.razao, cargo: "Contratada" },
    { tipo: "assinatura", nome: cli.razao, cargo: "Contratante" },
    { tipo: "testemunhas", nome: testemunha, cpf: testemunhaCpf },

    { tipo: "quebra" },

    { tipo: "titulo", texto: "ANEXO ÚNICO AO CONTRATO DE PRESTAÇÃO DE SERVIÇOS" },
    p(
      `Este anexo único faz parte integrante ao contrato nº ${numero} de prestação de serviços, conforme cláusula 1 objeto deste, firmado entre as partes, contendo condições básicas e norteadoras do contratado, a saber:`,
      { espacoAntes: 240 },
    ),
    { tipo: "rotulo", texto: "Local da Coleta:" },
    p(localColeta, { espacoDepois: 240 }),
    { tipo: "rotulo", texto: "Equipamentos Alocados a título de comodato:" },
    {
      tipo: "tabela",
      cabecalho: ["Quantidade", "Equipamento", "Mínimo de Trocas Mensais", "R$/troca"],
      linhas: [[String(quantidade), equipamento, String(trocas), valorTroca]],
    },
    p(
      `A medição será realizada mensalmente, com o pagamento para o dia ${diaPagamento} do mês subsequente da CONTRATADA ${emp.razao} para a ${cli.razao}. Forma de pagamento: ${formaPagamento}.`,
      { negrito: true, espacoAntes: 480 },
    ),
    p(
      "O início do contrato se dará vinte e quatro horas (24:00h) após a data de assinatura do presente contrato, estando em conformidade com a cláusula II do mesmo.",
      { espacoAntes: 240, espacoDepois: 480 },
    ),
    { tipo: "assinatura", nome: emp.razao, cargo: "Contratada" },
    { tipo: "assinatura", nome: cli.razao, cargo: "Contratante" },
    { tipo: "testemunhas", nome: testemunha, cpf: testemunhaCpf },
  ];

  return { numero, clienteNome: cliente.name, blocos };
}

/** busca o arquivo da logo (usada no cabeçalho do Word e na prévia) */
export async function carregarLogoContrato(): Promise<Uint8Array | null> {
  try {
    const res = await fetch(LOGO_CONTRATO);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** gera o arquivo .docx com o mesmo conteúdo e a mesma formatação do modelo */
export async function gerarContratoDocx(
  montado: ContratoMontado,
  logo?: Uint8Array | ArrayBuffer | null,
): Promise<Blob> {
  // carregado sob demanda: a biblioteca de Word só baixa quando o contrato é gerado
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    Header,
    ImageRun,
    PageBreak,
    PageNumber,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");

  const FONTE = "Arial";
  const CORPO = 22; // 11pt
  const imagem = logo ?? (await carregarLogoContrato());

  const paragrafo = (
    texto: string,
    opcoes?: {
      negrito?: boolean;
      alinhamento?: "justify" | "left" | "center" | "right";
      espacoAntes?: number;
      espacoDepois?: number;
      tamanho?: number;
    },
  ) =>
    new Paragraph({
      alignment:
        opcoes?.alinhamento === "center"
          ? AlignmentType.CENTER
          : opcoes?.alinhamento === "right"
            ? AlignmentType.RIGHT
            : opcoes?.alinhamento === "left"
              ? AlignmentType.LEFT
              : AlignmentType.JUSTIFIED,
      spacing: { before: opcoes?.espacoAntes ?? 0, after: opcoes?.espacoDepois ?? 120, line: 276 },
      children: [
        new TextRun({
          text: texto,
          font: FONTE,
          size: opcoes?.tamanho ?? CORPO,
          bold: opcoes?.negrito ?? false,
        }),
      ],
    });

  const borda = { style: BorderStyle.SINGLE, size: 4, color: "666666" };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };

  const filhos: Array<Paragraph | Table> = montado.blocos.map((bloco) => {
    switch (bloco.tipo) {
      case "numero":
        return new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 240 },
          children: [
            new TextRun({ text: "Contrato nº ", font: FONTE, size: CORPO }),
            new TextRun({ text: bloco.numero, font: FONTE, size: 26, bold: true }),
          ],
        });
      case "titulo":
        return new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 360 },
          children: bloco.texto.split("\n").flatMap((linha, i) => [
            ...(i > 0 ? [new TextRun({ text: "", break: 1 })] : []),
            new TextRun({ text: linha, font: FONTE, size: 30, bold: true }),
          ]),
        });
      case "secao":
        return paragrafo(bloco.texto, { negrito: true, alinhamento: "left", espacoAntes: 280 });
      case "rotulo":
        return paragrafo(bloco.texto, { negrito: true, alinhamento: "left", espacoAntes: 240 });
      case "paragrafo":
        return paragrafo(bloco.texto, {
          negrito: bloco.negrito,
          alinhamento: bloco.alinhamento,
          espacoAntes: bloco.espacoAntes,
          espacoDepois: bloco.espacoDepois,
        });
      case "tabela":
        return new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [1701, 2976, 2126, 1701],
          rows: [
            new TableRow({
              tableHeader: true,
              children: bloco.cabecalho.map(
                (titulo, i) =>
                  new TableCell({
                    borders: bordas,
                    shading: { type: ShadingType.CLEAR, fill: "8EA9C1" },
                    margins: { top: 120, bottom: 120, left: 100, right: 100 },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: titulo, font: FONTE, size: CORPO, bold: true, italics: true }),
                        ],
                      }),
                    ],
                    width: { size: [20, 35, 25, 20][i] ?? 25, type: WidthType.PERCENTAGE },
                  }),
              ),
            }),
            ...bloco.linhas.map(
              (linha) =>
                new TableRow({
                  children: linha.map(
                    (valor) =>
                      new TableCell({
                        borders: bordas,
                        margins: { top: 120, bottom: 120, left: 100, right: 100 },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: valor, font: FONTE, size: CORPO })],
                          }),
                        ],
                      }),
                  ),
                }),
            ),
          ],
        });
      case "assinatura":
        return new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 600, after: 0 },
          children: [
            new TextRun({ text: "______________________________________________", font: FONTE, size: CORPO }),
            new TextRun({ text: "", break: 1 }),
            new TextRun({ text: bloco.nome, font: FONTE, size: CORPO, bold: true }),
            new TextRun({ text: "", break: 1 }),
            new TextRun({ text: bloco.cargo, font: FONTE, size: CORPO }),
          ],
        });
      case "testemunhas":
        return new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [paragrafo("Testemunhas:", { alinhamento: "left", espacoAntes: 480 })],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    paragrafo("_______________________________", { alinhamento: "left", espacoAntes: 480, espacoDepois: 0 }),
                    paragrafo(`Nome: ${bloco.nome || "______________________"}`, {
                      alinhamento: "left",
                      espacoDepois: 0,
                    }),
                    paragrafo(`CPF: ${bloco.cpf || "_________________"}`, { alinhamento: "left" }),
                  ],
                }),
                new TableCell({
                  children: [
                    paragrafo("_______________________________", { alinhamento: "left", espacoAntes: 480, espacoDepois: 0 }),
                    paragrafo("Nome: ______________________", { alinhamento: "left", espacoDepois: 0 }),
                    paragrafo("Cpf: _________________", { alinhamento: "left" }),
                  ],
                }),
              ],
            }),
          ],
        });
      case "quebra":
        return new Paragraph({ children: [new PageBreak()] });
    }
  });

  const documento = new Document({
    creator: montado.clienteNome,
    title: `Contrato ${montado.numero} - ${montado.clienteNome}`,
    styles: { default: { document: { run: { font: FONTE, size: CORPO } } } },
    sections: [
      {
        properties: {
          page: { margin: { top: 1701, bottom: 1418, left: 1701, right: 1701, header: 567, footer: 567 } },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { after: 240 },
                children: imagem
                  ? [
                      new ImageRun({
                        type: "png",
                        data: imagem instanceof ArrayBuffer ? new Uint8Array(imagem) : imagem,
                        transformation: { width: 150, height: 71 },
                      }),
                    ]
                  : [],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ children: [PageNumber.CURRENT], font: FONTE, size: 20 }),
                ],
              }),
            ],
          }),
        },
        children: filhos,
      },
    ],
  });

  return Packer.toBlob(documento);
}

/** nome do arquivo .docx do contrato */
export function nomeArquivoContrato(clienteNome: string, numero: string): string {
  const limpo = clienteNome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `Contrato ${numero} - ${limpo}.docx`;
}

/** baixa o contrato no navegador */
export function baixarArquivo(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
