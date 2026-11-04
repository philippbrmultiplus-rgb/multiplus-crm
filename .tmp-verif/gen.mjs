import fs from "node:fs";
import { calcularDados } from "./planilha.js";
const d = calcularDados(JSON.parse(fs.readFileSync("public/pln-planilha.json", "utf8")), [], []);
const ids = new Set(["cli-99", ...Array.from({ length: 17 }, (_, i) => "cli-" + (278 + i))]);
const q = (t) => "'" + String(t).replace(/'/g, "''") + "'";
const vols = d.volumes.filter((v) => ids.has(v.clientId));
let sql =
  "insert into client_monthly_volumes (id, client_id, label, month, volume_m3) values\n" +
  vols.map((v) => "(" + q(v.id) + "," + q(v.clientId) + ",null," + q(v.month) + "," + v.volumeM3 + ")").join(",\n") +
  "\non conflict (id) do update set volume_m3 = excluded.volume_m3, client_id = excluded.client_id, label = null;";
fs.writeFileSync("/tmp/pln/vol_novos.sql", sql);
const cols = d.coletas.filter((c) => ids.has(c.clientId));
sql =
  "insert into coletas (client_id, collect_date, volume_m3, trocas) values\n" +
  cols.map((c) => "(" + q(c.clientId) + "," + q(c.collectDate) + "," + c.volume + "," + c.trocas + ")").join(",\n") +
  "\non conflict (client_id, collect_date) do update set volume_m3 = excluded.volume_m3, trocas = excluded.trocas;";
fs.writeFileSync("/tmp/pln/col_novos.sql", sql);
console.log("volumes novos:", vols.length, "| coletas novas:", cols.length);
