import type { GameTacticFinding } from "@/lib/types";

type AiExplanation = Pick<GameTacticFinding, "aiExplanationTeacher" | "aiExplanationStudent" | "whyThisMoveWorks" | "suggestedBadgeProgress" | "cautionIfUncertain">;

function mockExplanation(finding: GameTacticFinding): AiExplanation {
  const caution = finding.confidence === "low" ? "This is only a possible tactic. Review it before approving." : "Review before approving, but this candidate has a clear tactical signal.";
  return {
    aiExplanationTeacher: `[Mock AI] ${finding.moveSan} is a ${finding.tacticTheme} candidate because it creates a forcing moment. ${caution}`,
    aiExplanationStudent: `[Mock AI] This move may be a ${finding.tacticTheme}. Look at what your move attacks or forces next.`,
    whyThisMoveWorks: "The move creates an immediate threat, check, capture, or forcing response.",
    suggestedBadgeProgress: `If approved, count this as one ${finding.tacticTheme} example.`,
    cautionIfUncertain: caution
  };
}

export async function explainTacticWithAI(finding: GameTacticFinding, colorPlayed: "white" | "black") {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return mockExplanation(finding);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: "Analyze this chess position and move as a possible tactic. Be conservative. If the tactic is unclear, say so. Return JSON only. Explain in kid-friendly chess teaching language. Do not invent moves not in the game."
          },
          {
            role: "user",
            content: JSON.stringify({
              fenBefore: finding.fenBefore,
              fenAfter: finding.fenAfter,
              moveSan: finding.moveSan,
              moveUci: finding.moveUci,
              tacticTheme: finding.tacticTheme,
              confidence: finding.confidence,
              colorPlayed
            })
          }
        ],
        text: { format: { type: "json_object" } }
      })
    });
    if (!response.ok) return mockExplanation(finding);
    const parsed = await response.json() as { output_text?: string };
    const data = JSON.parse(parsed.output_text ?? "{}") as Partial<AiExplanation>;
    return {
      ...mockExplanation(finding),
      ...data
    };
  } catch {
    return mockExplanation(finding);
  }
}
