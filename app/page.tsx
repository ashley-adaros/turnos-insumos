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
  amount?: number;
  date?: string;
  time?: string;
}

interface TurnData {
  currentMember: Member | null;
  nextMember: Member | null;
  members: Member[];
  history: PurchaseRecord[];
  totalSpent?: number;
}

// Colores armoniosos para los avatares
const MEMBER_COLORS: Record<string, { bg: string; text: string }> = {
  Fanny: { bg: "bg-pink-100 text-pink-700", text: "text-pink-600" },
  Roberto: { bg: "bg-blue-100 text-blue-700", text: "text-blue-600" },
  Erick: { bg: "bg-amber-100 text-amber-700", text: "text-amber-600" },
  Ingrid: { bg: "bg-emerald-100 text-emerald-700", text: "text-emerald-600" },
  Alejandro: { bg: "bg-indigo-100 text-indigo-700", text: "text-indigo-600" },
};

// Categorías de compras habituales con precios sugeridos comunes
const PURCHASE_CATEGORIES = [
  { id: "agua", name: "Bidón de Agua", detail: "20 Litros", icon: "💧", defaultAmount: 3500 },
  { id: "cafe", name: "Café & Azúcar", detail: "Despensa y té", icon: "☕", defaultAmount: 8500 },
  { id: "limpieza", name: "Aseo & Baño", detail: "Papel y jabón", icon: "🧻", defaultAmount: 12000 },
  { id: "snacks", name: "Snacks & Fruta", detail: "Desayuno", icon: "🍪", defaultAmount: 6000 },
  { id: "general", name: "Insumos Oficina", detail: "Papelería", icon: "📦", defaultAmount: 15000 },
];

export default function Home() {
  const [data, setData] = useState<TurnData>({
    currentMember: null,
    nextMember: null,
    members: [],
    history: [],
    totalSpent: 0,
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Bidón de Agua (20 Litros)");
  const [customItem, setCustomItem] = useState("");
  const [isCustom, setIsCustom] = useState(false);

  // Estados de Monto, Calendario y Hora
  const [amount, setAmount] = useState<string>("3500");
  const [purchaseDate, setPurchaseDate] = useState<string>("");
  const [purchaseTime, setPurchaseTime] = useState<string>("");

  const [toast, setToast] = useState<{ msg: string; type: "success" | "info" | "error" } | null>(null);

  // Inicializar fecha y hora actual local
  useEffect(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");

    setPurchaseDate(`${yyyy}-${mm}-${dd}`);
    setPurchaseTime(`${hh}:${min}`);
  }, []);

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

  const resetToCurrentDateTime = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");

    setPurchaseDate(`${yyyy}-${mm}-${dd}`);
    setPurchaseTime(`${hh}:${min}`);
  };

  const showToast = (msg: string, type: "success" | "info" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Registrar compra (con monto, fecha y hora)
  const handleRegisterPurchase = async () => {
    if (submitting) return;
    setSubmitting(true);

    const finalItem = isCustom && customItem.trim() ? customItem.trim() : selectedCategory;
    const finalAmount = amount ? parseFloat(amount) : undefined;

    try {
      const res = await fetch("/api/turnos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          item: finalItem,
          amount: finalAmount,
          date: purchaseDate,
          time: purchaseTime,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setData((prev) => ({
          ...prev,
          currentMember: json.currentMember,
          nextMember: json.nextMember,
          history: json.history,
          totalSpent: json.totalSpent,
        }));
        const amountDisplay = finalAmount ? ` por $${finalAmount.toLocaleString("es-CL")}` : "";
        showToast(`¡Compra de "${finalItem}"${amountDisplay} registrada! Próximo turno: ${json.nextMember?.name}`, "success");
        if (isCustom) {
          setCustomItem("");
          setIsCustom(false);
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
          history: json.history,
          totalSpent: json.totalSpent,
        }));
        showToast("Turno saltado al siguiente compañero: " + json.currentMember?.name, "info");
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
          totalSpent: json.totalSpent,
        }));
        const target = json.members.find((m: Member) => m.id === id);
        showToast(
          target?.isActive
            ? `🟢 ${target.name} disponible para turnos`
            : `🏖️ ${target.name} en vacaciones (se saltará su turno)`,
          "info"
        );
      }
    } catch {
      showToast("Error al cambiar estado", "error");
    }
  };

  const getInitials = (name?: string) => (name ? name.slice(0, 2).toUpperCase() : "--");

  const getItemIcon = (itemName: string) => {
    const lower = itemName.toLowerCase();
    if (lower.includes("agua") || lower.includes("bidón")) return "💧";
    if (lower.includes("café") || lower.includes("azúcar") || lower.includes("té")) return "☕";
    if (lower.includes("limpieza") || lower.includes("aseo") || lower.includes("papel")) return "🧻";
    if (lower.includes("snack") || lower.includes("fruta") || lower.includes("desayuno")) return "🍪";
    return "📦";
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Cargando sistema de compras...</p>
        </div>
      </main>
    );
  }

  const activeCount = data.members.filter((m) => m.isActive).length;
  const currentItemLabel = isCustom && customItem.trim() ? customItem.trim() : selectedCategory;
  const totalAccumulated = data.totalSpent || data.history.reduce((acc, h) => acc + (h.amount || 0), 0);

  return (
    <div className="min-h-screen bg-canvas py-8 px-4 sm:px-6 lg:px-8 flex flex-col justify-between">
      {/* Toast Flotante */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] transition-all">
          <div
            className={`px-4 py-3 rounded-2xl border shadow-xl flex items-center gap-3 bg-white ${
              toast.type === "success"
                ? "border-emerald-300 text-emerald-900"
                : toast.type === "info"
                ? "border-blue-300 text-blue-900"
                : "border-rose-300 text-rose-900"
            }`}
          >
            <span className="text-xl">
              {toast.type === "success" ? "✅" : toast.type === "info" ? "ℹ️" : "⚠️"}
            </span>
            <span className="text-sm font-semibold">{toast.msg}</span>
          </div>
        </div>
      )}

      {/* Contenedor Principal */}
      <div className="max-w-6xl mx-auto w-full">
        {/* HEADER SUPERIOR CON METRICAS */}
        <header className="card-premium rounded-2xl p-4 sm:p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 text-lg font-black">
              🛍️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none">
                  HydroTurn
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Control de Compras & Insumos
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Rotación justa con registro de gastos, fecha y hora
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Métrica de gasto total acumulado */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
              <span>💰 Total Registrado:</span>
              <span className="text-emerald-900">${totalAccumulated.toLocaleString("es-CL")}</span>
            </div>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{activeCount} de {data.members.length} activos</span>
            </div>

            <button
              onClick={fetchData}
              title="Actualizar datos"
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </header>

        {/* CUERPO DEL DASHBOARD (GRID) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUMNA IZQUIERDA: HERO CARD (TURNO ACTUAL Y FORMULARIO DE COMPRA) */}
          <section className="lg:col-span-7 flex flex-col gap-6">
            <div className="card-premium rounded-3xl p-6 sm:p-7 relative overflow-hidden">
              {/* Encabezado del Hero */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  TURNO ACTUAL DE COMPRA
                </div>

                <span className="text-xs font-medium text-slate-400 capitalize">
                  {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })}
                </span>
              </div>

              {/* Perfil del Responsable Actual */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 py-5">
                {/* Avatar Circular con iniciales */}
                <div className="relative">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-blue-500/15 flex items-center justify-center">
                    <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-wider">
                        {getInitials(data.currentMember?.name)}
                      </span>
                    </div>
                  </div>
                  <span className="absolute -bottom-2 -right-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold uppercase shadow-sm">
                    Le toca
                  </span>
                </div>

                {/* Información y Nombre */}
                <div className="flex-1 text-center sm:text-left">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400 block mb-1">
                    Responsable de la compra
                  </span>
                  <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight capitalize leading-none">
                    {data.currentMember?.name ?? "Sin Asignar"}
                  </h2>

                  {/* Próximo turno en línea */}
                  <div className="mt-3.5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    <span className="text-slate-400">Próximo en turno:</span>
                    <strong className="text-slate-900 font-bold flex items-center gap-1">
                      <span>{data.nextMember?.name ?? "N/A"}</span>
                      <span className="text-blue-600">→</span>
                    </strong>
                  </div>
                </div>
              </div>

              {/* SELECTOR DE INSUMO A COMPRAR */}
              <div className="pt-5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Insumo adquirido
                  </span>
                  <button
                    onClick={() => setIsCustom(!isCustom)}
                    className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
                  >
                    {isCustom ? "Volver a lista" : "+ Escribir otro"}
                  </button>
                </div>

                {isCustom ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ej: Toallas de papel, té gourmet, pilas..."
                      value={customItem}
                      onChange={(e) => setCustomItem(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm text-slate-900 font-medium"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {PURCHASE_CATEGORIES.map((cat) => {
                      const label = `${cat.name} (${cat.detail})`;
                      const isSelected = selectedCategory === label;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategory(label);
                            setAmount(String(cat.defaultAmount));
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? "bg-blue-50 border-blue-500 shadow-sm shadow-blue-500/10"
                              : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70"
                          }`}
                        >
                          <span className="text-lg block mb-0.5">{cat.icon}</span>
                          <span className={`text-xs font-bold block leading-tight ${isSelected ? "text-blue-900" : "text-slate-900"}`}>
                            {cat.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                            {cat.detail}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* NUEVA SECCIÓN: MONTO GASTADO + CALENDARIO Y HORA */}
              <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-12 gap-4">
                {/* 2. Monto Gastado ($) */}
                <div className="sm:col-span-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      2. Monto Gastado ($)
                    </label>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm font-bold text-slate-900 shadow-2xs"
                    />
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {[3500, 5000, 8500, 12000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAmount(String(val))}
                        className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-slate-600 transition cursor-pointer"
                      >
                        ${val.toLocaleString("es-CL")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Calendario y Hora */}
                <div className="sm:col-span-7">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      3. Fecha y Hora de Compra
                    </label>
                    <button
                      type="button"
                      onClick={resetToCurrentDateTime}
                      className="text-[11px] text-blue-600 font-semibold hover:underline cursor-pointer"
                    >
                      Ahora mismo
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input
                        type="date"
                        value={purchaseDate}
                        onChange={(e) => setPurchaseDate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-xs font-semibold text-slate-800 shadow-2xs"
                      />
                    </div>
                    <div className="relative">
                      <input
                        type="time"
                        value={purchaseTime}
                        onChange={(e) => setPurchaseTime(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-xs font-semibold text-slate-800 shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* FILA DE TURNOS (ORDEN DE ROTACIÓN) */}
              <div className="mt-5 pt-5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Fila de Turnos del Equipo
                  </span>
                  <span className="text-xs text-slate-400">Orden de rotación</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {data.members.map((m, idx) => {
                    const isCurrent = m.id === data.currentMember?.id;
                    const isNext = m.id === data.nextMember?.id;
                    const colors = MEMBER_COLORS[m.name] || { bg: "bg-slate-100 text-slate-700" };

                    return (
                      <div
                        key={m.id}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          isCurrent
                            ? "bg-blue-50/70 border-blue-500 shadow-xs"
                            : isNext
                            ? "bg-white border-blue-200 shadow-2xs"
                            : !m.isActive
                            ? "bg-slate-50 border-slate-200 opacity-60"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-center mb-1.5">
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${colors.bg}`}>
                            {getInitials(m.name)}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {m.name}
                        </div>
                        <div className="text-[10px] font-semibold mt-1">
                          {isCurrent ? (
                            <span className="text-blue-700 font-bold">● Actual</span>
                          ) : isNext ? (
                            <span className="text-blue-600">Siguiente</span>
                          ) : !m.isActive ? (
                            <span className="text-rose-600 font-medium">🏖️ Ausente</span>
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
              <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleRegisterPurchase}
                  disabled={submitting}
                  className="flex-1 h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>
                        Registrar Compra: {currentItemLabel.split("(")[0]}
                        {amount ? ` ($${parseFloat(amount).toLocaleString("es-CL")})` : ""}
                      </span>
                      <span>🛒</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleSkipTurn}
                  disabled={submitting}
                  title="Saltar turno si la persona no se encuentra hoy"
                  className="h-14 px-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 active:scale-[0.99] text-slate-700 hover:text-slate-900 font-semibold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>Saltar turno</span>
                  <span>⏭️</span>
                </button>
              </div>
            </div>
          </section>

          {/* COLUMNA DERECHA: EQUIPO Y HISTORIAL CON DETALLES FINANCIEROS */}
          <section className="lg:col-span-5 flex flex-col gap-6">
            {/* TARJETA 1: DISPONIBILIDAD DEL EQUIPO */}
            <div className="card-premium rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Disponibilidad del Equipo
                  </h3>
                  <p className="text-xs text-slate-500">
                    Marca compañeros ausentes o de vacaciones
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold">
                  {data.members.length} miembros
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {data.members.map((member) => {
                  const colors = MEMBER_COLORS[member.name] || { bg: "bg-slate-100 text-slate-700" };

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-white transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${colors.bg}`}>
                          {getInitials(member.name)}
                        </span>
                        <div>
                          <span className={`text-sm font-bold block ${member.isActive ? "text-slate-900" : "text-slate-400 line-through"}`}>
                            {member.name}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {member.isActive ? "🟢 En oficina" : "🏖️ Vacaciones"}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleMember(member.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                          member.isActive
                            ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-2xs"
                            : "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                        }`}
                      >
                        {member.isActive ? "Marcar Ausente" : "Reactivar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TARJETA 2: HISTORIAL DE COMPRAS CON MONTO, FECHA Y HORA */}
            <div className="card-premium rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Historial de Compras & Gastos
                  </h3>
                  <p className="text-xs text-slate-500">
                    Últimas compras con fecha, hora y costo
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  Finanzas
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
                      className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-white transition flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg shadow-2xs">
                          {getItemIcon(record.item)}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-900">
                              {record.buyerName}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-200/70 text-slate-600">
                              #{index + 1}
                            </span>
                          </div>
                          <span className="text-xs text-slate-600 font-medium block">
                            {record.item}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                            📅 {record.timestamp}
                          </span>
                        </div>
                      </div>

                      {/* Monto Gastado Destacado */}
                      <div className="text-right">
                        {record.amount ? (
                          <span className="text-sm font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl inline-block shadow-2xs">
                            ${record.amount.toLocaleString("es-CL")}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Sin monto
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>

        {/* FOOTER */}
        <footer className="mt-8 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 text-center">
          <p>© {new Date().getFullYear()} HydroTurn • Sistema de Compras & Gastos de Oficina</p>
          <p className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Notificaciones y registro contable activos
          </p>
        </footer>
      </div>
    </div>
  );
}
