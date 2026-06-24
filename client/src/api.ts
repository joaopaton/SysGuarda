import type { DiaEscala, EscalaDTO, Person } from "./types";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getPeople: () =>
    req<{ monitores: Person[]; guardas: Person[] }>("/api/people"),

  addPerson: (p: { num: string; nome: string; isMonitor: boolean }) =>
    req<Person>("/api/people", { method: "POST", body: JSON.stringify(p) }),

  setAvailable: (id: string, available: boolean) =>
    req<Person>(`/api/people/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ available }),
    }),

  removePerson: (id: string) =>
    req<void>(`/api/people/${id}`, { method: "DELETE" }),

  generate: (startDate: string, balancear: boolean) =>
    req<EscalaDTO>("/api/schedule/generate", {
      method: "POST",
      body: JSON.stringify({ startDate, balancear }),
    }),

  save: (startDate: string, escala: DiaEscala[]) =>
    req<{ id: string }>("/api/schedule", {
      method: "POST",
      body: JSON.stringify({ startDate, escala }),
    }),

  list: () =>
    req<{ id: string; startDate: string; createdAt: string }[]>(
      "/api/schedule"
    ),

  get: (id: string) => req<EscalaDTO>(`/api/schedule/${id}`),

  history: (id: string) =>
    req<{ num: string; nome: string; guardas: number }[]>(
      `/api/schedule/${id}/history`
    ),

  // Histórico manual (planilha importada)
  getManualHistory: () =>
    req<{ id: string; num: string; nome: string; guardas: number }[]>(
      "/api/history"
    ),

  // Envia o CSV bruto (contagem OU grade de escala); o backend parseia.
  importHistory: (csv: string, mode: "replace" | "add") =>
    req<{ importadas: number; total: number }>("/api/history", {
      method: "POST",
      body: JSON.stringify({ csv, mode }),
    }),

  clearHistory: () => req<void>("/api/history", { method: "DELETE" }),
};
