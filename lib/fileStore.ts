// frontend_next/lib/fileStore.ts
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const RES_FILE = path.join(DATA_DIR, "reservations.json");

type Reservation = {
  id: string;
  when: string;              // ISO
  placeId: string;
  placeName: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string | null;
  user: { id: string; name: string };
  status: "confirmed" | "canceled";
};

async function ensureFile() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch {}
  try { await fs.access(RES_FILE); } 
  catch { await fs.writeFile(RES_FILE, JSON.stringify([])); }
}

export async function readReservations(): Promise<Reservation[]> {
  await ensureFile();
  const raw = await fs.readFile(RES_FILE, "utf-8");
  return JSON.parse(raw) as Reservation[];
}

export async function writeReservations(list: Reservation[]) {
  await ensureFile();
  await fs.writeFile(RES_FILE, JSON.stringify(list, null, 2));
}

export type { Reservation };
