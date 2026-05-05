"use client";

import { useRef, useState } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { exportData, importData, resetData, useAppData } from "@/lib/storage";

export default function SettingsPage() {
  return (
    <ClientOnly fallback={<div className="text-ink-600">A carregar…</div>}>
      <Settings />
    </ClientOnly>
  );
}

function Settings() {
  const { accounts, expenses } = useAppData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  function downloadJson() {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simple-expenses-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      importData(text);
      setMessage("Dados importados com sucesso.");
    } catch (err) {
      setMessage(`Erro ao importar: ${(err as Error).message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function reset() {
    if (
      confirm(
        "Apagar todas as contas e despesas guardadas localmente? Não é reversível.",
      )
    ) {
      resetData();
      setMessage("Dados apagados.");
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Definições</h1>

      <div className="card space-y-3">
        <h2 className="font-medium">Backup local</h2>
        <p className="text-sm text-ink-600 dark:text-ink-400">
          Os dados ficam guardados apenas no browser deste dispositivo. Use
          export/import para mover para outro dispositivo.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadJson} className="btn-primary">
            Exportar JSON
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-ghost"
          >
            Importar JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImport}
          />
          <button onClick={reset} className="btn-danger">
            Apagar tudo
          </button>
        </div>
        {message && (
          <p className="text-sm text-ink-600 dark:text-ink-400">{message}</p>
        )}
      </div>

      <div className="card">
        <h2 className="font-medium mb-2">Estado</h2>
        <ul className="text-sm text-ink-600 dark:text-ink-400 space-y-1">
          <li>{accounts.length} contas / cartões</li>
          <li>{expenses.length} despesas</li>
        </ul>
      </div>
    </div>
  );
}
