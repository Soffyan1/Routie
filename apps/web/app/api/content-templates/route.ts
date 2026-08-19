import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { contentTemplates, createDatabase, withTenant } from "@routie/db";
import { requireSession } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

const PRESET_TEMPLATES = [
  {
    id: "preset-1",
    kind: "CAPTION",
    channel: "INSTAGRAM",
    name: "Storytelling & Engagement Hook",
    body: "Pernah nggak ngerasa [problem/frustrasi terbesar audience]? 🤔\n\nSebenarnya kuncinya bukan [kesalahan umum], tapi bagaimana kamu [solusi/strategi unik].\n\nBerikut 3 tips praktis yang bisa langsung dicoba:\n1️⃣ [Langkah 1]\n2️⃣ [Langkah 2]\n3️⃣ [Langkah 3]\n\n👉 Komen \"MAU\" kalau kamu mau template gratisnya dikirim ke DM!",
    tags: ["Storytelling", "Tips", "Engagement"],
    isPreset: true
  },
  {
    id: "preset-2",
    kind: "CAPTION",
    channel: "TIKTOK",
    name: "Fast-Paced Hook & Viral Reveal",
    body: "Stop scroll kalau kamu masih ngelakuin ini di 2026! 🚨\n\nBanyak orang mikir [mitos umum], padahal faktanya [fakta mengejutkan]. Tonton sampai habis biar gak boncos!\n\n#fyp #edukasi #tipsbisnis",
    tags: ["Viral", "Hook", "Fast-Paced"],
    isPreset: true
  },
  {
    id: "preset-3",
    kind: "HASHTAG",
    channel: "ALL",
    name: "Branded SaaS & AI Growth Pack",
    body: "#Routie #SocialMediaAutomation #AIContent #DigitalMarketingID #ContentCreatorIndonesia #MarketingStrategy #ProductivityTools #SocialMediaManager",
    tags: ["Growth", "Branding", "Marketing"],
    isPreset: true
  },
  {
    id: "preset-4",
    kind: "CTA",
    channel: "ALL",
    name: "High-Converting Lead Magnet CTA",
    body: "🚀 Siap scale up konten tanpa burnout? Klik link di bio untuk coba gratis sekarang!",
    tags: ["Conversion", "Bio Link", "CTA"],
    isPreset: true
  },
  {
    id: "preset-5",
    kind: "PROMPT",
    channel: "ALL",
    name: "Persona Social Media Expert (Gen-Z & Millennial)",
    body: "Bertindaklah sebagai Senior Social Media Strategist yang mahir membuat konten edukasi bernada santai, profesional, dan to-the-point untuk audiens muda Indonesia. Gunakan analogi sehari-hari dan kalimat aktif.",
    tags: ["AI Persona", "Prompt", "Strategy"],
    isPreset: true
  }
];

export async function GET() {
  try {
    const session = await requireSession();
    const db = createDatabase(serverEnv().DATABASE_URL);
    const customTemplates = await withTenant(db, session.workspaceId, async (tx) => {
      return tx
        .select()
        .from(contentTemplates)
        .where(eq(contentTemplates.workspaceId, session.workspaceId))
        .orderBy(desc(contentTemplates.createdAt));
    });

    return NextResponse.json({
      templates: [...customTemplates, ...PRESET_TEMPLATES]
    });
  } catch (error) {
    return apiError(error);
  }
}

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["CAPTION", "HASHTAG", "CTA", "PROMPT"]),
  channel: z.string().default("ALL"),
  name: z.string().min(2).max(100),
  body: z.string().min(2).max(5000),
  tags: z.array(z.string().max(50)).default([])
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== "OWNER" && session.role !== "EDITOR") {
      throw new Error("Only owners or editors can create content templates");
    }

    const input = templateSchema.parse(await request.json());
    const db = createDatabase(serverEnv().DATABASE_URL);

    const saved = await withTenant(db, session.workspaceId, async (tx) => {
      if (input.id) {
        const [updated] = await tx
          .update(contentTemplates)
          .set({
            kind: input.kind,
            channel: input.channel,
            name: input.name,
            body: input.body,
            tags: input.tags,
            updatedAt: new Date()
          })
          .where(and(eq(contentTemplates.workspaceId, session.workspaceId), eq(contentTemplates.id, input.id)))
          .returning();
        return updated;
      }

      const [created] = await tx
        .insert(contentTemplates)
        .values({
          workspaceId: session.workspaceId,
          kind: input.kind,
          channel: input.channel,
          name: input.name,
          body: input.body,
          tags: input.tags,
          isPreset: false
        })
        .returning();
      return created;
    });

    return NextResponse.json({ template: saved });
  } catch (error) {
    return apiError(error);
  }
}

const deleteSchema = z.object({
  id: z.string().uuid()
});

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== "OWNER" && session.role !== "EDITOR") {
      throw new Error("Only owners or editors can delete templates");
    }

    const input = deleteSchema.parse(await request.json());
    const db = createDatabase(serverEnv().DATABASE_URL);

    await withTenant(db, session.workspaceId, async (tx) => {
      await tx
        .delete(contentTemplates)
        .where(and(eq(contentTemplates.workspaceId, session.workspaceId), eq(contentTemplates.id, input.id)));
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
