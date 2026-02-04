/**
 * Parses [UNKNOWN_TERM]...[/UNKNOWN_TERM] tags from Henry's responses
 * and saves them to the database for admin review.
 */

interface UnknownTermData {
  term: string;
  user_message: string;
  context: string;
}

/**
 * Parses the UNKNOWN_TERM block from assistant content
 */
export function parseUnknownTerm(content: string): {
  cleanContent: string;
  unknownTerm: UnknownTermData | null;
} {
  const match = content.match(/\[UNKNOWN_TERM\]([\s\S]*?)\[\/UNKNOWN_TERM\]/);

  if (!match) {
    return { cleanContent: content, unknownTerm: null };
  }

  const cleanContent = content.replace(match[0], "").trim();
  
  // Parse the structured content
  const block = match[1];
  const termMatch = block.match(/term:\s*"?([^"\n]+)"?/i);
  const userMessageMatch = block.match(/user_message:\s*"?([^"\n]+)"?/i);
  const contextMatch = block.match(/context:\s*"?([^"\n]+)"?/i);

  if (!termMatch || !userMessageMatch) {
    console.warn("Failed to parse UNKNOWN_TERM block:", block);
    return { cleanContent, unknownTerm: null };
  }

  return {
    cleanContent,
    unknownTerm: {
      term: termMatch[1].trim(),
      user_message: userMessageMatch[1].trim(),
      context: contextMatch ? contextMatch[1].trim() : "",
    },
  };
}

/**
 * Saves an unknown term escalation to the database
 */
export async function saveUnknownTermEscalation(
  data: UnknownTermData,
  conversationId?: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-escalation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          term: data.term,
          user_message: data.user_message,
          context: data.context,
          conversation_id: conversationId,
        }),
      }
    );

    if (!response.ok) {
      console.error("Failed to save escalation:", await response.text());
      return false;
    }

    console.log("Escalation saved successfully for term:", data.term);
    return true;
  } catch (error) {
    console.error("Error saving escalation:", error);
    return false;
  }
}
