import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {

  try {

    const { text } = await req.json();

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4o-mini",

        response_format: { type: "json_object" },

        messages: [
          {
            role: "system",
            content:
              "Du bist ein Ernährungsrechner. Antworte ausschließlich mit JSON im Format: { \"calories\": number, \"protein\": number }. Keine Erklärungen."
          },
          {
            role: "user",
            content: text
          }
        ],

        temperature: 0

      });

    const content =
      completion.choices[0].message.content;

    const parsed =
      JSON.parse(content || "{}");

    return Response.json({
      calories: Number(parsed.calories) || 0,
      protein: Number(parsed.protein) || 0
    });

  } catch (error) {

    console.error("OPENAI ERROR:", error);

    return Response.json({
      calories: 0,
      protein: 0
    });

  }

}