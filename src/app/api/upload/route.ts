import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DOCUMENTS_BUCKET = "property-documents";

const PROPERTY_FIELDS = [
  "name",
  "address",
  "wifi_name",
  "wifi_password",
  "check_in",
  "check_out",
  "house_rules",
  "emergency_contact",
] as const;

type ImportedProperty = Record<(typeof PROPERTY_FIELDS)[number], string>;

function storageFilename(filename: string) {
  const safeFilename = filename
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/^-+|-+$/g, "");
  return safeFilename || "property-information.pdf";
}

async function ensureDocumentsBucket() {
  const supabase = getSupabaseAdmin();
  const { data: bucket, error: getBucketError } = await supabase.storage.getBucket(
    DOCUMENTS_BUCKET
  );

  if (getBucketError && getBucketError.status !== 404) throw getBucketError;

  if (!bucket) {
    const { error } = await supabase.storage.createBucket(DOCUMENTS_BUCKET, {
      public: false,
      allowedMimeTypes: ["application/pdf"],
    });
    if (error && error.status !== 409) throw error;
  }

  return supabase;
}

async function extractProperty(fileId: string): Promise<ImportedProperty> {
  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          { type: "input_file", file_id: fileId },
          {
            type: "input_text",
            text: "Extract the property details from this standardized property-information PDF. Copy only information explicitly present in the document. Use an empty string for a missing field.",
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "property_details",
        strict: true,
        schema: {
          type: "object",
          properties: Object.fromEntries(
            PROPERTY_FIELDS.map((field) => [field, { type: "string" }])
          ),
          required: PROPERTY_FIELDS,
          additionalProperties: false,
        },
      },
    },
  });

  const extracted = JSON.parse(response.output_text) as Partial<ImportedProperty>;
  const property = Object.fromEntries(
    PROPERTY_FIELDS.map((field) => [
      field,
      typeof extracted[field] === "string" ? extracted[field].trim() : "",
    ])
  ) as ImportedProperty;

  if (!property.name) {
    throw new Error("The PDF does not include a property name.");
  }

  return property;
}

export async function POST(req: Request) {
  let storagePath: string | null = null;
  let propertyId: number | null = null;
  let vectorStoreId: string | null = null;
  let openaiFileId: string | null = null;
  let supabase: ReturnType<typeof getSupabaseAdmin> | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported." },
        { status: 400 }
      );
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    if (
      fileBytes.length < 5 ||
      new TextDecoder().decode(fileBytes.subarray(0, 5)) !== "%PDF-"
    ) {
      return NextResponse.json(
        { error: "The uploaded file is not a valid PDF." },
        { status: 400 }
      );
    }

    const pdf = new File([fileBytes], file.name, { type: "application/pdf" });
    const uploadedFile = await openai.files.create({
      file: pdf,
      purpose: "assistants",
    });
    openaiFileId = uploadedFile.id;
    const importedProperty = await extractProperty(uploadedFile.id);

    supabase = await ensureDocumentsBucket();
    const { data: property, error: insertError } = await supabase
      .from("properties")
      .insert(importedProperty)
      .select()
      .single();

    if (insertError || !property) throw insertError || new Error("Property creation failed.");
    propertyId = property.id;

    const vectorStore = await openai.vectorStores.create({
      name: `GuestFlow - ${property.name}`,
    });
    vectorStoreId = vectorStore.id;

    const { error: updateError } = await supabase
      .from("properties")
      .update({ vector_store_id: vectorStoreId })
      .eq("id", propertyId);
    if (updateError) throw updateError;

    storagePath = `${propertyId}/${crypto.randomUUID()}-${storageFilename(file.name)}`;
    const { error: storageError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, pdf, {
        cacheControl: "3600",
        contentType: "application/pdf",
        upsert: false,
      });
    if (storageError) throw storageError;

    await openai.vectorStores.files.createAndPoll(vectorStoreId, {
      file_id: uploadedFile.id,
    });

    return NextResponse.json({
      success: true,
      property,
      fileId: uploadedFile.id,
      filename: file.name,
      storageBucket: DOCUMENTS_BUCKET,
      storagePath,
      vectorStoreId,
    });
  } catch (error) {
    if (supabase && storagePath) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
    }
    if (supabase && propertyId) {
      await supabase.from("properties").delete().eq("id", propertyId);
    }
    if (vectorStoreId) {
      await openai.vectorStores.delete(vectorStoreId);
    }
    if (openaiFileId) {
      await openai.files.delete(openaiFileId);
    }

    console.error("Property import error:", error);
    const message = error instanceof Error ? error.message : "Property import failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
