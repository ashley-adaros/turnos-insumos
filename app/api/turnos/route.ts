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
}

interface TurnState {
  members: Member[];
  currentIndex: number;
  history: PurchaseRecord[];
}

// ============================================================================
// ALMACENAMIENTO EN MEMORIA TEMPORAL (MOCK DATA)
// Miembros oficiales del equipo: Fanny, Roberto, Erick, Ingrid
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
        timestamp: "Hace 4 días",
        item: "Bidón de Agua 20L",
      },
      {
        id: "mock-2",
        buyerName: "Ingrid",
        timestamp: "Hace 11 días",
        item: "Café en Grano & Azúcar",
      },
      {
        id: "mock-3",
        buyerName: "Erick",
        timestamp: "Hace 18 días",
        item: "Insumos de Limpieza & Papel",
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
  itemPurchased: string
) {
  /*
  -----------------------------------------------------------------------------
  TODO: INYECCIÓN DE WEBHOOK (TELEGRAM / WHATSAPP)
  -----------------------------------------------------------------------------
  Ejemplo Telegram Bot API:
  const telegramMessage = `💧 *Turno de Insumos Actualizado*\n\n` +
    `✅ *${buyer.name}* acaba de comprar: ${itemPurchased}.\n` +
    `👉 *Próximo turno:* ${nextMember.name}`;

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_GROUP_CHAT_ID,
      text: telegramMessage,
      parse_mode: "Markdown",
    }),
  });

  Ejemplo WhatsApp Cloud API (Meta):
  await fetch(`https://graph.facebook.com/v19.0/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.WA_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ... })
  });
  -----------------------------------------------------------------------------
  */
  console.log(
    `[WEBHOOK TRIGGERED] 🔔 ${buyer.name} registró compra de ${itemPurchased}. Próximo turno: ${nextMember.name}`
  );
}

// ============================================================================
// MANEJADORES HTTP
// ============================================================================

export async function GET() {
  const currentMember = state.members[state.currentIndex];
  const nextIndex = getNextActiveIndex(state.currentIndex, state.members);
  const nextMember = state.members[nextIndex];

  return NextResponse.json({
    currentMember,
    nextMember,
    members: state.members,
    history: state.history.slice(0, 3),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({ action: "register" }));
    const { action = "register", memberId, item } = body;

    const currentMember = state.members[state.currentIndex];

    // 1. REGISTRAR COMPRA (Rotación)
    if (action === "register") {
      const nextIndex = getNextActiveIndex(state.currentIndex, state.members);
      const nextMember = state.members[nextIndex];

      const itemPurchased = typeof item === "string" && item.trim() 
        ? item.trim() 
        : "Insumos de Oficina";

      const newPurchase: PurchaseRecord = {
        id: `pur-${Date.now()}`,
        buyerName: currentMember.name,
        timestamp: new Date().toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        item: itemPurchased,
      };

      state.history.unshift(newPurchase);
      state.currentIndex = nextIndex;

      await triggerGroupNotification(currentMember, nextMember, newPurchase.item);

      return NextResponse.json({
        success: true,
        message: `Compra de "${itemPurchased}" registrada para ${currentMember.name}. Turno asignado a ${nextMember.name}`,
        currentMember: state.members[state.currentIndex],
        nextMember: state.members[getNextActiveIndex(state.currentIndex, state.members)],
        history: state.history.slice(0, 3),
      });
    }

    // 2. SALTAR TURNO MANUALMENTE (Ausencia imprevista)
    if (action === "skip") {
      const skippedMember = currentMember;
      const nextIndex = getNextActiveIndex(state.currentIndex, state.members);
      state.currentIndex = nextIndex;

      return NextResponse.json({
        success: true,
        message: `Turno saltado de ${skippedMember.name}`,
        currentMember: state.members[state.currentIndex],
        nextMember: state.members[getNextActiveIndex(state.currentIndex, state.members)],
        history: state.history.slice(0, 3),
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

      return NextResponse.json({
        success: true,
        members: state.members,
        currentMember: state.members[state.currentIndex],
        nextMember: state.members[getNextActiveIndex(state.currentIndex, state.members)],
        history: state.history.slice(0, 3),
      });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (error) {
    console.error("Error en API de turnos:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
