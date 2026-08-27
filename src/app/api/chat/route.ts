import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { messages = [], property = {} } = await req.json();

    const vectorStoreId = property.vector_store_id;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",

      input: [
        {
          role: "system",
          content: `You are GuestFlow AI, an AI assistant for an Airbnb property.

Use the property's information and uploaded knowledge base to answer guest questions.

PROPERTY INFORMATION:
${JSON.stringify(property)}

Rules:
- Answer questions using the property information and uploaded documents.
- If the uploaded documents contain the answer, use that information.
- If you cannot find the answer in either source, say you don't know.
- Never invent property information.
- Be helpful, concise, and friendly.`,
        },

        ...(Array.isArray(messages) ? messages : []),
      ],

      ...(vectorStoreId
        ? {
            tools: [
              {
                type: "file_search",
                vector_store_ids: [vectorStoreId],
              },
            ],
          }
        : {}),
    });

    return NextResponse.json({
      reply: response.output_text,
    });
  } catch (error) {
    console.error("Chat error:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}