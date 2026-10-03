import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "client-content";

const ALLOWED_ORIGINS = new Set([
  "https://gdstudio360.co.uk",
  "https://www.gdstudio360.co.uk",
  "https://gdstudio360-tech.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin":
      ALLOWED_ORIGINS.has(origin)
        ? origin
        : "https://gdstudio360.co.uk",

    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",

    "Access-Control-Allow-Methods":
      "POST, OPTIONS",

    "Vary": "Origin",
  };
}

function clean(value: unknown, max = 500) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function cleanContent(raw: any) {
  const services = Array.isArray(raw?.services)
    ? raw.services.slice(0, 10).map((item: any) => ({
        name: clean(item?.name, 100),
        description: clean(item?.description, 500),
      }))
    : [];

  const reviews = Array.isArray(raw?.reviews)
    ? raw.reviews.map((item: any) => ({
        name: clean(item?.name, 100),
        text: clean(item?.text, 800),
      }))
    : [];

  return {
    business_name: clean(raw?.business_name, 150),
    hero_title: clean(raw?.hero_title, 140),
    hero_text: clean(raw?.hero_text, 700),
    about_text: clean(raw?.about_text, 2000),

    services,
    reviews,

    contact: {
      email: clean(raw?.contact?.email, 200),
      phone: clean(raw?.contact?.phone, 100),
      area: clean(raw?.contact?.area, 200),
      hours: clean(raw?.contact?.hours, 500),
    },

    socials: {
      website: clean(raw?.socials?.website, 300),
      facebook: clean(raw?.socials?.facebook, 300),
      instagram: clean(raw?.socials?.instagram, 300),
    },

    pages: Array.isArray(raw?.pages)
      ? raw.pages.slice(0, 8).map((item: any) => ({
          name: clean(item?.name, 100),

          type:
            clean(
              item?.type,
              30
            ) === "service"
              ? "service"
              : "standard",

          notes: clean(item?.notes, 1200),
        }))
      : [],

    service_areas: Array.isArray(raw?.service_areas)
      ? raw.service_areas.slice(0, 10).map((item: any) => ({
          name: clean(item?.name, 120),
          notes: clean(item?.notes, 800),
        }))
      : [],

    faqs: Array.isArray(raw?.faqs)
      ? raw.faqs.slice(0, 8).map((item: any) => ({
          question: clean(item?.question, 250),
          answer: clean(item?.answer, 1200),
        }))
      : [],

    branding: {
      primary_color:
        clean(raw?.branding?.primary_color, 50),

      secondary_color:
        clean(raw?.branding?.secondary_color, 50),

      style_notes:
        clean(raw?.branding?.style_notes, 1500),
    },

    domain: {
      status:
        clean(raw?.domain?.status, 50),

      name:
        clean(raw?.domain?.name, 250),

      registrar:
        clean(raw?.domain?.registrar, 150),

      notes:
        clean(raw?.domain?.notes, 1000),
    },

    seo: {
      priority_services:
        clean(
          raw?.seo?.priority_services,
          1500
        ),

      priority_locations:
        clean(
          raw?.seo?.priority_locations,
          1500
        ),

      search_phrases:
        clean(
          raw?.seo?.search_phrases,
          2000
        ),

      examples:
        clean(
          raw?.seo?.examples,
          1500
        ),
    },

    enquiry: {
      primary_action:
        clean(
          raw?.enquiry?.primary_action,
          100
        ),

      destination:
        clean(
          raw?.enquiry?.destination,
          300
        ),

      questions:
        clean(
          raw?.enquiry?.questions,
          2500
        ),

      notes:
        clean(
          raw?.enquiry?.notes,
          1500
        ),
    },
  };
}

function cleanFiles(raw: any) {
  return {
    logo: raw?.logo || null,
    hero: raw?.hero || null,
    about: raw?.about || null,

    gallery: Array.isArray(raw?.gallery)
      ? raw.gallery.slice(0, 12)
      : [],
  };
}

async function withSignedUrl(db: any, item: any) {
  if (!item?.path) {
    return null;
  }

  const { data } = await db.storage
    .from(BUCKET)
    .createSignedUrl(item.path, 3600);

  return {
    ...item,
    url: data?.signedUrl || null,
  };
}

async function signedFiles(db: any, raw: any) {
  const files = cleanFiles(raw);

  const gallery = [];

  for (const item of files.gallery) {
    gallery.push(
      await withSignedUrl(db, item)
    );
  }

  return {
    logo: await withSignedUrl(db, files.logo),
    hero: await withSignedUrl(db, files.hero),
    about: await withSignedUrl(db, files.about),
    gallery: gallery.filter(Boolean),
  };
}

Deno.serve(async (req) => {
  const origin =
    req.headers.get("origin") || "";

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: cors(origin),
    });
  }

  if (req.method !== "POST") {
    return Response.json(
      {
        ok: false,
        error: "Method not allowed.",
      },
      {
        status: 405,
        headers: cors(origin),
      }
    );
  }

  if (
    origin &&
    !ALLOWED_ORIGINS.has(origin)
  ) {
    return Response.json(
      {
        ok: false,
        error: "Origin not allowed.",
      },
      {
        status: 403,
        headers: cors(origin),
      }
    );
  }

  try {
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL")!;

    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SECRET_KEY");

    if (!serviceKey) {
      throw new Error(
        "Supabase service role key is not configured."
      );
    }

    const db = createClient(
      supabaseUrl,
      serviceKey,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const contentType =
      req.headers.get("content-type") || "";

    let body: any = null;
    let form: FormData | null = null;

    let action = "";
    let token = "";

    if (
      contentType.includes(
        "multipart/form-data"
      )
    ) {
      form = await req.formData();

      action = clean(
        form.get("action"),
        40
      );

      token = clean(
        form.get("token"),
        100
      );
    } else {
      body = await req.json();

      action = clean(
        body?.action,
        40
      );

      token = clean(
        body?.token,
        100
      );
    }

    if (!token) {
      throw new Error(
        "Missing content portal token."
      );
    }

    const {
      data: lead,
      error: leadError,
    } = await db
      .from("leads")
      .select(
        "id,name,business,email,phone,area,package,content_token"
      )
      .eq("content_token", token)
      .single();

    if (
      leadError ||
      !lead
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "This content portal link is not valid.",
        },
        {
          status: 404,
          headers: cors(origin),
        }
      );
    }

    if (
      lead.package !==
      "Pro — £599"
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "This project does not use the Pro Content Portal.",
        },
        {
          status: 403,
          headers: cors(origin),
        }
      );
    }

    const { data: existing } =
      await db
        .from("project_content")
        .select("*")
        .eq("lead_id", lead.id)
        .maybeSingle();

    const existingContent =
      existing?.content || {};

    const existingFiles =
      cleanFiles(existing?.files);

    if (action === "load") {
      const content =
        cleanContent({
          business_name:
            existingContent.business_name ||
            lead.business,

          hero_title:
            existingContent.hero_title,

          hero_text:
            existingContent.hero_text,

          about_text:
            existingContent.about_text,

          services:
            existingContent.services,

          reviews:
            existingContent.reviews,

          contact: {
            email:
              existingContent.contact?.email ||
              lead.email,

            phone:
              existingContent.contact?.phone ||
              lead.phone,

            area:
              existingContent.contact?.area ||
              lead.area,

            hours:
              existingContent.contact?.hours,
          },

          socials:
            existingContent.socials,

          pages:
            existingContent.pages,

          service_areas:
            existingContent.service_areas,

          faqs:
            existingContent.faqs,

          branding:
            existingContent.branding,

          domain:
            existingContent.domain,

          seo:
            existingContent.seo,

          enquiry:
            existingContent.enquiry,
        });

      return Response.json(
        {
          ok: true,
          package: "Pro",
          client_name: lead.name,
          business: lead.business,
          content,

          files:
            await signedFiles(
              db,
              existingFiles
            ),

          submitted_at:
            existing?.submitted_at ||
            null,
        },
        {
          headers: cors(origin),
        }
      );
    }

    if (
      action === "save" ||
      action === "submit"
    ) {
      const content =
        cleanContent(
          body?.content || {}
        );

      const now =
        new Date().toISOString();

      const submittedAt =
        action === "submit"
          ? now
          : existing?.submitted_at ||
            null;

      const { error } =
        await db
          .from("project_content")
          .upsert(
            {
              lead_id: lead.id,
              package_type: "pro",
              content,
              files: existingFiles,
              submitted_at: submittedAt,
              updated_at: now,
            },
            {
              onConflict: "lead_id",
            }
          );

      if (error) {
        throw error;
      }

      return Response.json(
        {
          ok: true,
          submitted_at:
            submittedAt,
        },
        {
          headers: cors(origin),
        }
      );
    }

    if (action === "upload") {
      if (!form) {
        throw new Error(
          "Invalid upload request."
        );
      }

      const slot =
        clean(
          form.get("slot"),
          30
        );

      const allowedSlots =
        new Set([
          "logo",
          "hero",
          "about",
          "gallery",
        ]);

      if (
        !allowedSlots.has(slot)
      ) {
        throw new Error(
          "Invalid upload slot."
        );
      }

      const file =
        form.get("file");

      if (
        !(file instanceof File)
      ) {
        throw new Error(
          "No file received."
        );
      }

      const allowedTypes =
        new Set([
          "image/jpeg",
          "image/png",
          "image/webp",
        ]);

      if (
        !allowedTypes.has(
          file.type
        )
      ) {
        throw new Error(
          "Please upload JPG, PNG or WEBP."
        );
      }

      if (
        file.size >
        8 * 1024 * 1024
      ) {
        throw new Error(
          "Maximum file size is 8 MB."
        );
      }

      if (
        slot === "gallery" &&
        existingFiles.gallery.length >= 12
      ) {
        throw new Error(
          "Pro package allows up to 12 gallery images."
        );
      }

      const extension =
        file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg";

      const objectPath =
        `${lead.id}/${slot}/${crypto.randomUUID()}.${extension}`;

      const {
        error: uploadError,
      } = await db.storage
        .from(BUCKET)
        .upload(
          objectPath,
          file,
          {
            contentType:
              file.type,

            upsert: false,
          }
        );

      if (uploadError) {
        throw uploadError;
      }

      const item = {
        path: objectPath,
        name: clean(
          file.name,
          180
        ),
        type: file.type,
        size: file.size,
      };

      const nextFiles =
        cleanFiles(
          existingFiles
        );

      if (
        slot === "gallery"
      ) {
        nextFiles.gallery.push(
          item
        );
      } else {
        const key =
          slot as
            | "logo"
            | "hero"
            | "about";

        const old =
          nextFiles[key];

        nextFiles[key] =
          item;

        if (old?.path) {
          await db.storage
            .from(BUCKET)
            .remove([
              old.path,
            ]);
        }
      }

      const { error: saveError } =
        await db
          .from("project_content")
          .upsert(
            {
              lead_id: lead.id,
              package_type: "pro",
              content:
                cleanContent(
                  existingContent
                ),
              files: nextFiles,
              updated_at:
                new Date()
                  .toISOString(),
            },
            {
              onConflict: "lead_id",
            }
          );

      if (saveError) {
        throw saveError;
      }

      return Response.json(
        {
          ok: true,
        },
        {
          headers: cors(origin),
        }
      );
    }

    if (
      action === "remove_file"
    ) {
      const slot =
        clean(
          body?.slot,
          30
        );

      const index =
        Number(
          body?.index
        );

      const nextFiles =
        cleanFiles(
          existingFiles
        );

      let removePath:
        string | null = null;

      if (
        slot === "gallery"
      ) {
        if (
          Number.isInteger(index) &&
          index >= 0 &&
          index <
            nextFiles.gallery.length
        ) {
          const removed =
            nextFiles.gallery.splice(
              index,
              1
            )[0];

          removePath =
            removed?.path ||
            null;
        }
      } else if (
        [
          "logo",
          "hero",
          "about",
        ].includes(slot)
      ) {
        const key =
          slot as
            | "logo"
            | "hero"
            | "about";

        removePath =
          nextFiles[key]?.path ||
          null;

        nextFiles[key] =
          null;
      }

      if (removePath) {
        await db.storage
          .from(BUCKET)
          .remove([
            removePath,
          ]);
      }

      const { error } =
        await db
          .from("project_content")
          .upsert(
            {
              lead_id: lead.id,
              package_type: "pro",
              content:
                cleanContent(
                  existingContent
                ),
              files: nextFiles,
              updated_at:
                new Date()
                  .toISOString(),
            },
            {
              onConflict: "lead_id",
            }
          );

      if (error) {
        throw error;
      }

      return Response.json(
        {
          ok: true,
        },
        {
          headers: cors(origin),
        }
      );
    }

    throw new Error(
      "Unknown action."
    );

  } catch (error) {
    console.error(
      "CONTENT_PORTAL_ERROR",
      error
    );

    return Response.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown error.",
      },
      {
        status: 400,
        headers: cors(origin),
      }
    );
  }
});
