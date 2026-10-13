import { NextResponse } from "next/server";

export interface Member {
  id: number;
  name: string;
  isActive: boolean; // Permite manejar vacaciones / ausencias
}

export interface PurchaseRecord {
  id: string;
  buyerName: string;
  timestamp: string;
  item: string;
  amount?: number;
  date?: string;
  time?: string;
}

interface TurnState {
  members: Member[];
  currentIndex: number;
  history: PurchaseRecord[];
}

// ============================================================================
// ALMACENAMIENTO EN MEMORIA TEMPORAL (MOCK DATA)
// Miembros oficiales del equipo: Fanny, Roberto, Erick, Ingrid, Alejandro
// ============================================================================
const globalStore = globalThis as unknown as { __TURNO_STATE__?: TurnState };

const DEFAULT_MEMBERS: Member[] = [
  { id: 1, name: "Fanny", isActive: true },
  { id: 2, name: "Roberto", isActive: true },
  { id: 3, name: "Erick", isActive: true },
  { id: 4, name: "Ingrid", isActive: true },
  { id: 5, name: "Alejandro", isActive: true },
];

if (!globalStore.__TURNO_STATE__ || globalStore.__TURNO_STATE__.members.length !== 5) {
  globalStore.__TURNO_STATE__ = {
    members: DEFAULT_MEMBERS,
    currentIndex: 0,
    history: [
      {
        id: "mock-1",
        buyerName: "Alejandro",
        timestamp: "10 oct, 11:30",
        item: "Bidón de Agua 20L",
        amount: 3500,
        date: "2026-10-10",
        time: "11:30",
      },
      {
        id: "mock-2",
        buyerName: "Ingrid",
        timestamp: "03 oct, 15:45",
        item: "Café en Grano & Azúcar",
        amount: 8900,
        date: "2026-10-03",
        time: "15:45",
      },
      {
        id: "mock-3",
        buyerName: "Erick",
        timestamp: "25 sep, 09:15",
        item: "Insumos de Limpieza & Papel",
        amount: 12400,
        date: "2026-09-25",
        time: "09:15",
      },
    ],
  };
}

const state = globalStore.__TURNO_STATE__;

/**
 * Calcula el siguiente índice de usuario disponible que esté activo (no de vacaciones).
 */
function getNextActiveIndex(fromIndex: number, members: Member[]): number {
  const total = members.length;
  for (let i = 1; i <= total; i++) {
    const candidateIndex = (fromIndex + i) % total;
    if (members[candidateIndex].isActive) {
      return candidateIndex;
    }
  }
  return fromIndex;
}

// ============================================================================
// [HOOK / INTEGRACIÓN FUTURA]: DISPARADOR DE NOTIFICACIÓN (TELEGRAM / WHATSAPP)
// ============================================================================
async function triggerGroupNotification(
  buyer: Member,
  nextMember: Member,
  itemPurchased: string,
  amount?: number
) {
  const amountText = amount ? ` por $${amount.toLocaleString("es-CL")}` : "";
  console.log(
    `[WEBHOOK TRIGGERED] 🔔 ${buyer.name} registró compra de ${itemPurchased}${amountText}. Próximo turno: ${nextMember.name}`
  );
}

// ============================================================================
// MANEJADORES HTTP
// ============================================================================

export async function GET() {
  const currentMember = state.members[state.currentIndex];
  const nextIndex = getNextActiveIndex(state.currentIndex, state.members);
  const nextMember = state.members[nextIndex];
  const totalSpent = state.history.reduce((sum, h) => sum + (h.amount || 0), 0);

  return NextResponse.json({
    currentMember,
    nextMember,
    members: state.members,
    history: state.history.slice(0, 5),
    totalSpent,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({ action: "register" }));
    const { action = "register", memberId, item, amount, date, time } = body;

    const currentMember = state.members[state.currentIndex];

    // 1. REGISTRAR COMPRA (Rotación + Monto + Fecha + Hora)
    if (action === "register") {
      const nextIndex = getNextActiveIndex(state.currentIndex, state.members);
      const nextMember = state.members[nextIndex];

      const itemPurchased = typeof item === "string" && item.trim() 
        ? item.trim() 
        : "Insumos de Oficina";

      let formattedDate = "";
      if (date && time) {
        const parts = date.split("-");
        const monthNames = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
        const mIndex = parseInt(parts[1], 10) - 1;
        formattedDate = `${parseInt(parts[2], 10)} ${monthNames[mIndex] || parts[1]}, ${time}`;
      } else {
        formattedDate = new Date().toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
      }

      const parsedAmount = typeof amount === "number" 
        ? amount 
        : (typeof amount === "string" ? parseFloat(amount.replace(/[^0-9.]/g, "")) : undefined);

      const newPurchase: PurchaseRecord = {
        id: `pur-${Date.now()}`,
        buyerName: currentMember.name,
        timestamp: formattedDate,
        item: itemPurchased,
        amount: !isNaN(parsedAmount as number) ? parsedAmount : undefined,
        date: date || new Date().toISOString().split("T")[0],
        time: time || new Date().toTimeString().slice(0, 5),
      };

      state.history.unshift(newPurchase);
      state.currentIndex = nextIndex;

      await triggerGroupNotification(currentMember, nextMember, newPurchase.item, newPurchase.amount);

      const totalSpent = state.history.reduce((sum, h) => sum + (h.amount || 0), 0);

      return NextResponse.json({
        success: true,
        message: `Compra de "${itemPurchased}" registrada para ${currentMember.name}. Turno asignado a ${nextMember.name}`,
        currentMember: state.members[state.currentIndex],
        nextMember: state.members[getNextActiveIndex(state.currentIndex, state.members)],
        history: state.history.slice(0, 5),
        totalSpent,
      });
    }

    // 2. SALTAR TURNO MANUALMENTE
    if (action === "skip") {
      const skippedMember = currentMember;
      const nextIndex = getNextActiveIndex(state.currentIndex, state.members);
      state.currentIndex = nextIndex;

      const totalSpent = state.history.reduce((sum, h) => sum + (h.amount || 0), 0);

      return NextResponse.json({
        success: true,
        message: `Turno saltado de ${skippedMember.name}`,
        currentMember: state.members[state.currentIndex],
        nextMember: state.members[getNextActiveIndex(state.currentIndex, state.members)],
        history: state.history.slice(0, 5),
        totalSpent,
      });
    }

    // 3. ACTIVAR / DESACTIVAR USUARIO (Vacaciones / Licencia)
    if (action === "toggle_active" && typeof memberId === "number") {
      const target = state.members.find((m) => m.id === memberId);
      if (target) {
        target.isActive = !target.isActive;

        // Si el usuario que tenía el turno quedó inactivo, rotar automáticamente
        if (!state.members[state.currentIndex].isActive) {
          state.currentIndex = getNextActiveIndex(state.currentIndex, state.members);
        }
      }

      const totalSpent = state.history.reduce((sum, h) => sum + (h.amount || 0), 0);

      return NextResponse.json({
        success: true,
        members: state.members,
        currentMember: state.members[state.currentIndex],
        nextMember: state.members[getNextActiveIndex(state.currentIndex, state.members)],
        history: state.history.slice(0, 5),
        totalSpent,
      });
    }

    // 4. FIJAR TURNO ACTUAL DIRECTAMENTE
    if (action === "set_current" && typeof memberId === "number") {
      const idx = state.members.findIndex((m) => m.id === memberId);
      if (idx !== -1) {
        state.currentIndex = idx;
      }

      const totalSpent = state.history.reduce((sum, h) => sum + (h.amount || 0), 0);
      return NextResponse.json({
        success: true,
        message: `Turno asignado directamente a ${state.members[state.currentIndex]?.name}`,
        members: state.members,
        currentMember: state.members[state.currentIndex],
        nextMember: state.members[getNextActiveIndex(state.currentIndex, state.members)],
        history: state.history.slice(0, 5),
        totalSpent,
      });
    }

    // 5. MOVER INTEGRANTE EN LA FILA (IZQUIERDA O DERECHA)
    if (action === "move_member" && typeof memberId === "number") {
      const { direction = "right" } = body;
      const index = state.members.findIndex((m) => m.id === memberId);

      if (index !== -1) {
        const targetIndex = direction === "left" ? index - 1 : index + 1;
        if (targetIndex >= 0 && targetIndex < state.members.length) {
          // Intercambiar posiciones
          const temp = state.members[index];
          state.members[index] = state.members[targetIndex];
          state.members[targetIndex] = temp;

          // Al reorganizar o mover integrantes en la fila, la posición #1 (o primer activo)
          // pasa a ser el turno actual para que la cabecera "Turno Actual" se sincronice inmediatamente
          const firstActive = state.members.findIndex((m) => m.isActive);
          state.currentIndex = firstActive !== -1 ? firstActive : 0;
        }
      }

      const totalSpent = state.history.reduce((sum, h) => sum + (h.amount || 0), 0);
      return NextResponse.json({
        success: true,
        members: state.members,
        currentMember: state.members[state.currentIndex],
        nextMember: state.members[getNextActiveIndex(state.currentIndex, state.members)],
        history: state.history.slice(0, 5),
        totalSpent,
      });
    }

    // 6. AGREGAR NUEVO INTEGRANTE
    if (action === "add_member") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name) {
        const newMember: Member = {
          id: Date.now(),
          name,
          isActive: true,
        };
        state.members.push(newMember);
      }

      const totalSpent = state.history.reduce((sum, h) => sum + (h.amount || 0), 0);
      return NextResponse.json({
        success: true,
        members: state.members,
        currentMember: state.members[state.currentIndex],
        nextMember: state.members[getNextActiveIndex(state.currentIndex, state.members)],
        history: state.history.slice(0, 5),
        totalSpent,
      });
    }

    // 7. ELIMINAR INTEGRANTE
    if (action === "remove_member" && typeof memberId === "number" && state.members.length > 2) {
      state.members = state.members.filter((m) => m.id !== memberId);
      if (state.currentIndex >= state.members.length) {
        state.currentIndex = 0;
      }

      const totalSpent = state.history.reduce((sum, h) => sum + (h.amount || 0), 0);
      return NextResponse.json({
        success: true,
        members: state.members,
        currentMember: state.members[state.currentIndex],
        nextMember: state.members[getNextActiveIndex(state.currentIndex, state.members)],
        history: state.history.slice(0, 5),
        totalSpent,
      });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (error) {
    console.error("Error en API de turnos:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
