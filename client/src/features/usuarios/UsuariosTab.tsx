import { useCallback, useEffect, useState } from "react";
import { CircleUserRound, RotateCw, Trash2, Plus, X, Check } from "lucide-react";
import { api } from "../../lib/api";
import type { Papel, Usuario } from "../../lib/types";
import { useAppData } from "../../state/AppDataContext";
import { useNav } from "../../state/NavContext";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Label, Input, Select } from "../../components/ui/Field";
import { Badge } from "../../components/ui/Badge";

export function UsuariosTab() {
  const { turmas } = useAppData();
  const { setErro } = useNav();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<Papel>("instrutor");
  const [turmaId, setTurmaId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  const idDaTurma = (codigo?: string) => turmas.find((t) => t.codigo === codigo)?.id ?? "";

  const carregar = useCallback(async () => {
    try {
      setUsuarios(await api.getUsers());
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [setErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const adicionar = async () => {
    setErro(null);
    setMsg(null);
    try {
      await api.addUser(nome.trim(), senha, role, turmaId || null);
      setMsg(`Usuário "${nome.trim().toLowerCase()}" criado.`);
      setNome("");
      setSenha("");
      setTurmaId("");
      setRole("instrutor");
      setMostrarForm(false);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const trocarPapel = async (id: string, novo: Papel) => {
    try {
      await api.updateUser(id, { role: novo });
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };
  const trocarTurma = async (id: string, novo: string) => {
    try {
      await api.updateUser(id, { turmaId: novo || null });
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };
  const remover = async (id: string, username: string) => {
    setErro(null);
    if (!confirm(`Remover o usuário "${username}"?`)) return;
    try {
      await api.removeUser(id);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };
  const redefinir = async (id: string, username: string) => {
    const nova = prompt(`Nova senha para "${username}" (mín. 4):`);
    if (!nova) return;
    try {
      await api.resetUserPassword(id, nova);
      setMsg(`Senha de "${username}" redefinida.`);
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const papelLabel = (r: Papel) =>
    r === "superadmin" ? "Comandante" : r === "monitor" ? "Monitor" : "Instrutor";
  const papelTone = (r: Papel) =>
    r === "superadmin" ? "verde" : r === "monitor" ? "ambar" : ("neutro" as const);

  const linha = (u: Usuario) => (
    <Card key={u.id} className="flex items-center gap-3 px-3 py-2.5 flex-wrap">
      <CircleUserRound size={20} className="text-verde shrink-0" />
      <div className="min-w-[110px] flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-texto truncate">{u.username}</span>
          <Badge tone={papelTone(u.role)}>{papelLabel(u.role)}</Badge>
        </div>
      </div>
      <Select value={u.role} onChange={(e) => trocarPapel(u.id, e.target.value as Papel)} className="w-auto" title="Papel">
        <option value="instrutor">Instrutor</option>
        <option value="monitor">Monitor</option>
        <option value="superadmin">Comandante</option>
      </Select>
      <Select value={idDaTurma(u.turma?.codigo)} onChange={(e) => trocarTurma(u.id, e.target.value)} className="w-auto" title="Turma">
        <option value="">— turma —</option>
        {turmas.map((t) => (
          <option key={t.id} value={t.id}>
            {t.codigo} {t.apelido}
          </option>
        ))}
      </Select>
      <Button variant="ghost" size="sm" onClick={() => redefinir(u.id, u.username)} title="Redefinir senha">
        <RotateCw size={14} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => remover(u.id, u.username)} title="Remover" className="hover:text-vermelho">
        <Trash2 size={14} />
      </Button>
    </Card>
  );

  const comando = usuarios.filter((u) => u.role === "superadmin");
  const semTurma = usuarios.filter((u) => u.role !== "superadmin" && !u.turma);
  const secoes = [
    { titulo: "Comando", users: comando },
    ...turmas.map((t) => ({
      titulo: `${t.codigo} · ${t.apelido}`,
      users: usuarios.filter((u) => u.role !== "superadmin" && u.turma?.codigo === t.codigo),
    })),
    { titulo: "Sem turma", users: semTurma },
  ];

  return (
    <div className="max-w-[820px]">
      <SectionHeader
        title="Usuários de acesso"
        subtitle={`${usuarios.length} ativo(s) · Comandante vê tudo · Sgt só a sua turma`}
        right={
          <Button variant={mostrarForm ? "outline" : "primary"} onClick={() => { setMsg(null); setMostrarForm((v) => !v); }}>
            {mostrarForm ? <X size={15} /> : <Plus size={15} />}
            {mostrarForm ? "Fechar" : "Novo usuário"}
          </Button>
        }
      />

      {mostrarForm && (
        <Card className="p-5 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Usuário</Label>
              <Input placeholder="ex.: schutz" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label>Senha (mín. 4)</Label>
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => e.key === "Enter" && adicionar()} />
            </div>
            <div>
              <Label>Papel</Label>
              <Select value={role} onChange={(e) => setRole(e.target.value as Papel)}>
                <option value="instrutor">Instrutor</option>
                <option value="monitor">Monitor</option>
                <option value="superadmin">Comandante</option>
              </Select>
            </div>
            <div>
              <Label>Turma {role === "superadmin" && "(opcional)"}</Label>
              <Select value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
                <option value="">— sem turma —</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.codigo} {t.apelido}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button variant="primary" onClick={adicionar} className="mt-4 w-full">
            <Plus size={15} /> Criar usuário
          </Button>
        </Card>
      )}

      {msg && (
        <p className="mb-4 text-sm text-verdeTexto flex items-center gap-1.5">
          <Check size={14} /> {msg}
        </p>
      )}

      <div className="flex flex-col gap-5">
        {secoes.map((s) => (
          <div key={s.titulo}>
            <h3 className="text-sm font-semibold text-texto mb-2">
              {s.titulo} <span className="text-textoTen font-normal">({s.users.length})</span>
            </h3>
            {s.users.length === 0 ? (
              <p className="text-xs text-textoTen">Nenhum usuário.</p>
            ) : (
              <div className="flex flex-col gap-2">{s.users.map(linha)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
