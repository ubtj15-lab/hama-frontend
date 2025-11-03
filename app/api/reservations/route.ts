// app/api/reservations/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const items = await prisma.reservation.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, items });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:String(e) }, { status:500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // 필수값 아주 간단 검증 (추후 Zod로 개선 가능)
    const required = ["store","address","name","people","date","time"];
    for (const k of required) {
      if (!data[k]) {
        return NextResponse.json({ ok:false, error:`${k} required` }, { status:400 });
      }
    }

    // soft dup check: 같은 가게/날짜/시간
    const dup = await prisma.reservation.findFirst({
      where: { store: data.store, date: data.date, time: data.time },
    });
    if (dup) {
      return NextResponse.json({ ok:false, error:"이미 해당 시간에 예약이 있습니다." }, { status:409 });
    }

    const saved = await prisma.reservation.create({
      data: {
        store: data.store,
        address: data.address,
        phone: data.phone ?? "",
        name: data.name,
        people: Number(data.people) || 1,
        date: data.date,
        time: data.time,
        note: data.note ?? "",
        lat: data.lat ?? null,
        lng: data.lng ?? null,
      },
    });

    return NextResponse.json({ ok:true, item:saved });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:String(e) }, { status:500 });
  }
}
