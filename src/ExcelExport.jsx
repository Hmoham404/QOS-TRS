import { useState } from "react";
import { FileSpreadsheet, LoaderCircle } from "lucide-react";
import { download } from "./data";
import { t as translate } from "./i18n.js";
export default function ExcelExport({
  rows,
  data,
  department = "Injection",
  className = "btn",
  caption = "Exporter Excel"
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function exportFile() {
    if (busy || !rows.length) return;
    setBusy(true);
    setError("");
    try {
      const {
        buildExcelExport
      } = await import("./excel-export.js");
      const bytes = await buildExcelExport(rows, data, {
        department
      });
      download(`QOS-${department}-${new Date().toISOString().slice(0, 10)}.xlsx`, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch (cause) {
      setError(cause.message === "Mettre à jour l’APK pour exporter un fichier Excel." ? cause.message : "Export impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }
  return <span className="excel-export"><button type="button" className={className} disabled={busy || !rows.length} onClick={exportFile} title={translate(rows.length ? "Exporter les données du périmètre" : "Aucun relevé à exporter")}>{busy ? <LoaderCircle size={17} className="pulse" /> : <FileSpreadsheet size={17} />} {translate(busy ? "Export en cours…" : caption)}</button>{error && <span role="alert" className="excel-error">{translate(error)}</span>}</span>;
}
