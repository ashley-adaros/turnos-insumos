"use client";

import { useEffect, useState } from "react";

interface Member {
  id: number;
  name: string;
  isActive: boolean;
}

interface PurchaseRecord {
  id: string;
  buyerName: string;
  timestamp: string;
  item: string;
}

interface TurnData {
  currentMember: Member | null;
  nextMember: Member | null;
  members: Member[];
  history: PurchaseRecord[];
}

// Estilos de diseño para avatares individuales
const MEMBER_STYLES: Record<string, { gradient: string; lightBg: string; text: string }> = {
  Fanny: {
    gradient: "from-fuchsia-500 via-pink-500 to-rose-400",
    lightBg: "bg-pink-50 text-pink-700 border-pink-200",
    text: "text-pink-600",
  },
  Roberto: {
    gradient: "from-blue-600 via-sky-500 to-cyan-400",
    lightBg: "bg-blue-50 text-blue-700 border-blue-200",
    text: "text-blue-600",
  },
  Erick: {
    gradient: "from-amber-500 via-orange-500 to-yellow-400",
    lightBg: "bg-orange-50 text-orange-700 border-orange-200",
    text: "text-orange-600",
  },
  Ingrid: {
    gradient: "from-emerald-500 via-teal-500 to-cyan-400",
    lightBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    text: "text-emerald-600",
  },
  Alejandro: {
    gradient: "from-indigo-600 via-violet-500 to-purple-400",
    lightBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
    text: "text-indigo-600",
  },
};

// Categorías de compras habituales de oficina
const PURCHASE_PRESETS = [
  { id: "agua", label: "Bidón de Agua 20L", icon: "💧", badge: "bg-cyan-50 text-cyan-800 border-cyan-200" },
  { id: "cafe", label: "Café, Té & Azúcar", icon: "☕", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  { id: "limpieza", label: "Aseo & Limpieza", icon: "🧻", badge: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { id: "snacks", label: "Snacks & Desayuno", icon: "🍪", badge: "bg-orange-50 text-orange-800 border-orange-200" },
  { id: "papeleria", label: "Papelería & Oficina", icon: "📦", badge: "bg-indigo-50 text-indigo-800 border-indigo-200" },
];

export default function Home() {
  const [data, setData] = useState<TurnData>({
    currentMember: null,
    nextMember: null,
    members: [],
    history: [],
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState("Bidón de Agua 20L");
  const [customItem, setCustomItem] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; type: "success" | "info" | "error" } | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/turnos");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Error al cargar datos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (msg: string, type: "success" | "info" | "error" = "success") => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Registrar compra (rotación de turno con insumo dinámico)
  const handleRegisterPurchase = async () => {
    if (submitting) return;
    setSubmitting(true);

    const finalItem = showCustomInput && customItem.trim() ? customItem.trim() : selectedItem;

    try {
      const res = await fetch("/api/turnos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", item: finalItem }),
      });
      const json = await res.json();
      if (res.ok) {
        setData((prev) => ({
          ...prev,
          currentMember: json.currentMember,
          nextMember: json.nextMember,
          history: json.history,
        }));
        showToast(`🛍️ ¡Compra de "${finalItem}" registrada! Próximo turno: ${json.nextMember?.name}`, "success");
        if (showCustomInput) {
          setCustomItem("");
          setShowCustomInput(false);
        }
      }
    } catch {
      showToast("Error al registrar la compra", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Saltar turno actual
  const handleSkipTurn = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/turnos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      });
      const json = await res.json();
      if (res.ok) {
        setData((prev) => ({
          ...prev,
          currentMember: json.currentMember,
          nextMember: json.nextMember,
        }));
        showToast("⏭️ Turno saltado. Ahora le toca a " + json.currentMember?.name, "info");
      }
    } catch {
      showToast("Error al saltar turno", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Alternar disponibilidad (Vacaciones / Activo)
  const handleToggleMember = async (id: number) => {
    try {
      const res = await fetch("/api/turnos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_active", memberId: id }),
      });
      const json = await res.json();
      if (res.ok) {
        setData((prev) => ({
          ...prev,
          members: json.members,
          currentMember: json.currentMember,
          nextMember: json.nextMember,
          history: json.history,
        }));
        const target = json.members.find((m: Member) => m.id === id);
        showToast(
          target?.isActive
            ? `🟢 ${target.name} disponible para compras`
            : `🏖️ ${target.name} en vacaciones (se saltará su turno)`,
          "info"
        );
      }
    } catch {
      showToast("Error al cambiar estado", "error");
    }
  };

  const getItemIcon = (itemName: string) => {
    const lower = itemName.toLowerCase();
    if (lower.includes("agua") || lower.includes("bidón")) return "💧";
    if (lower.includes("café") || lower.includes("té") || lower.includes("azúcar")) return "☕";
    if (lower.includes("limpieza") || lower.includes("aseo") || lower.includes("papel")) return "🧻";
    if (lower.includes("snack") || lower.includes("gallet") || lower.includes("desayuno")) return "🍪";
    return "📦";
  };

  const getInitials = (name?: string) => (name ? name.slice(0, 2).toUpperCase() : "--");

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-sm">🛍️</div>
          </div>
          <p className="text-sm text-slate-500 font-medium tracking-wide">Cargando turnos de compras...</p>
        </div>
      </main>
    );
  }

  const currentStyle = (data.currentMember && MEMBER_STYLES[data.currentMember.name]) || {
    gradient: "from-blue-600 to-cyan-500",
    lightBg: "bg-blue-50 text-blue-700 border-blue-200",
    text: "text-blue-600",
  };

  return (
    <div className="min-h-screen bg-subtle-mesh text-slate-900 py-6 px-4 sm:px-6 lg:px-8 flex flex-col justify-between">
      {/* Toast Flotante */}
      {feedback && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] transition-all animate-bounce">
          <div
            className={`px-4 py-3 rounded-2xl border backdrop-blur-md flex items-center gap-3 shadow-xl ${
              feedback.type === "success"
                ? "bg-white/95 border-emerald-300 text-emerald-900 shadow-emerald-500/10"
                : feedback.type === "info"
                ? "bg-white/95 border-blue-300 text-blue-900 shadow-blue-500/10"
                : "bg-white/95 border-rose-300 text-rose-900 shadow-rose-500/10"
            }`}
          >
            <span className="text-xl">
              {feedback.type === "success" ? "🛒" : feedback.type === "info" ? "ℹ️" : "⚠️"}
            </span>
            <span className="text-sm font-semibold">{feedback.msg}</span>
          </div>
        </div>
      )}

      {/* Contenedor Centrado */}
      <div className="max-w-6xl mx-auto w-full">
        {/* HEADER SUPERIOR */}
        <header className="card-modern rounded-2xl px-5 py-3.5 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold text-xl shadow-md shadow-blue-500/20">
              🛒
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-900">
                  Turnos de Compras & Insumos
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Oficina
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Rotación justa para agua, café, despensa, limpieza y compras generales
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{data.members.filter((m) => m.isActive).length} de {data.members.length} disponibles</span>
            </div>

            <button
              onClick={fetchData}
              title="Refrescar datos"
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </header>

        {/* GRID PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUMNA IZQUIERDA: HERO CARD DEL TURNO ACTUAL */}
          <section className="lg:col-span-7 flex flex-col gap-6">
            <div className="card-modern relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-white via-blue-50/20 to-sky-50/40 border-blue-100">


              {/* Tag de Encabezado */}
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider uppercase bg-blue-600 text-white shadow-md shadow-blue-500/25">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  Turno Actual de Compra
                </span>

                <span className="text-xs text-slate-400 font-semibold capitalize bg-white/80 px-3 py-1 rounded-full border border-slate-200">
                  {new Date().toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
                </span>
              </div>

              {/* Avatar + Nombre Grande */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 my-3 text-center sm:text-left relative z-10">
                <div className="relative group">
                  <div
                    className={`w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr ${currentStyle.gradient} p-1 shadow-xl shadow-blue-500/15 flex items-center justify-center transition-transform duration-300 group-hover:scale-105`}
                  >
                    <div className="w-full h-full rounded-[22px] bg-white/25 backdrop-blur-xs flex items-center justify-center">
                      <span className="text-3xl sm:text-4xl font-black text-white tracking-wider drop-shadow-md">
                        {getInitials(data.currentMember?.name)}
                      </span>
                    </div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md">
                    Le toca
                  </div>
                </div>

                <div className="flex-1">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400 block mb-1">
                    Responsable de la próxima compra
                  </span>
                  <h2 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight capitalize leading-none">
                    {data.currentMember?.name ?? "Sin Asignar"}
                  </h2>

                  {/* Próximo Turno Pill */}
                  <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 shadow-xs">
                    <span className="text-slate-500 font-medium">Siguiente en la lista:</span>
                    <strong className="text-slate-900 font-extrabold flex items-center gap-1.5">
                      <span>{data.nextMember?.name ?? "N/A"}</span>
                      <span className="text-blue-600 font-bold">→</span>
                    </strong>
                  </div>
                </div>
              </div>

              {/* SELECTOR INTERACTIVO DE INSUMO A COMPRAR */}
              <div className="mt-6 pt-5 border-t border-slate-200/80">
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <span>🛍️ Selecciona qué se va a comprar:</span>
                  </label>
                  <button
                    onClick={() => setShowCustomInput(!showCustomInput)}
                    className="text-[11px] text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    {showCustomInput ? "Usar lista rápida" : "+ Otro insumo"}
                  </button>
                </div>

                {showCustomInput ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ej: Café descafeinado, toallas de papel, té..."
                      value={customItem}
                      onChange={(e) => setCustomItem(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm text-slate-800"
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {PURCHASE_PRESETS.map((preset) => {
                      const isSelected = selectedItem === preset.label;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => setSelectedItem(preset.label)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/25 scale-[1.02]"
                              : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <span>{preset.icon}</span>
                          <span>{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECUENCIA DE ROTACIÓN (FILA DE 5 INTEGRANTES) */}
              <div className="mt-6 pt-5 border-t border-slate-200/80">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Fila de Turnos
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Secuencia de rotación</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  {data.members.map((m, idx) => {
                    const isCurrent = m.id === data.currentMember?.id;
                    const isNext = m.id === data.nextMember?.id;
                    const style = MEMBER_STYLES[m.name] || currentStyle;

                    return (
                      <div
                        key={m.id}
                        className={`p-3 rounded-2xl border text-center transition-all ${
                          isCurrent
                            ? "bg-blue-50 border-2 border-blue-500 shadow-md shadow-blue-500/15"
                            : isNext
                            ? "bg-white border-blue-200 shadow-xs"
                            : !m.isActive
                            ? "bg-rose-50/70 border-rose-200 opacity-70"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-center mb-1.5">
                          <span
                            className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black text-white bg-gradient-to-tr ${style.gradient} shadow-xs`}
                          >
                            {getInitials(m.name)}
                          </span>
                        </div>
                        <div className="text-xs font-extrabold text-slate-900 truncate">
                          {m.name}
                        </div>
                        <div className="text-[10px] font-bold mt-1">
                          {isCurrent ? (
                            <span className="text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded-md">
                              ● Actual
                            </span>
                          ) : isNext ? (
                            <span className="text-blue-600">Siguiente</span>
                          ) : !m.isActive ? (
                            <span className="text-rose-600">Vacaciones</span>
                          ) : (
                            <span className="text-slate-400">#{idx + 1}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                {/* Botón Principal Destacado */}
                <button
                  onClick={handleRegisterPurchase}
                  disabled={submitting}
                  className="flex-1 h-15 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 active:scale-[0.98] text-white font-black text-base sm:text-lg shadow-xl shadow-blue-500/25 transition-all flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Registrar Compra ({showCustomInput && customItem ? customItem : selectedItem})</span>
                      <span className="text-xl">🛒</span>
                    </>
                  )}
                </button>

                {/* Botón Saltar Turno */}
                <button
                  onClick={handleSkipTurn}
                  disabled={submitting}
                  title="Saltar si el usuario está ausente hoy"
                  className="h-15 px-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-300 active:scale-[0.98] text-slate-700 hover:text-slate-900 font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>Saltar turno</span>
                  <span className="text-base">⏭️</span>
                </button>
              </div>
            </div>
          </section>

          {/* COLUMNA DERECHA: DISPONIBILIDAD Y HISTORIAL */}
          <section className="lg:col-span-5 flex flex-col gap-6">
            {/* TARJETA 1: DISPONIBILIDAD DEL EQUIPO */}
            <div className="card-modern rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                    Disponibilidad del Equipo
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Marca compañeros ausentes o de vacaciones
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-extrabold">
                  {data.members.length} miembros
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {data.members.map((member) => {
                  const style = MEMBER_STYLES[member.name] || currentStyle;

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 border border-slate-200 hover:bg-white transition"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white bg-gradient-to-tr ${style.gradient} shadow-xs`}
                        >
                          {getInitials(member.name)}
                        </span>
                        <div>
                          <span className={`text-sm font-bold block ${member.isActive ? "text-slate-900" : "text-slate-400 line-through"}`}>
                            {member.name}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">
                            {member.isActive ? "🟢 En oficina" : "🏖️ Vacaciones"}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleMember(member.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          member.isActive
                            ? "bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs"
                            : "bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100"
                        }`}
                      >
                        {member.isActive ? "Marcar Ausente" : "Reactivar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TARJETA 2: HISTORIAL DE ÚLTIMAS 3 COMPRAS */}
            <div className="card-modern rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                    Historial de Compras
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Últimas 3 compras registradas
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 font-extrabold">
                  Registro
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {data.history.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-2xl border border-slate-200">
                    No hay compras registradas aún.
                  </div>
                ) : (
                  data.history.map((record, index) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200 hover:bg-white transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-200 text-base shadow-xs">
                          {getItemIcon(record.item)}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">
                              {record.buyerName}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200/70 text-slate-600">
                              #{index + 1}
                            </span>
                          </div>
                          <span className="text-xs text-slate-600 font-medium">
                            {record.item}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 block font-semibold shadow-2xs">
                          {record.timestamp}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>

        {/* FOOTER */}
        <footer className="mt-8 pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 text-center">
          <p>© {new Date().getFullYear()} HydroTurn • Sistema de Compras & Turnos de Oficina</p>
          <p className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            Webhook Telegram / WhatsApp preparado para alertas grupales
          </p>
        </footer>
      </div>
    </div>
  );
}
