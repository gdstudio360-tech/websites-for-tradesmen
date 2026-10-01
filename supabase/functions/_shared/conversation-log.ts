export async function ensureLeadConversation(
  db: any,
  lead: any,
) {
  if (lead.conversation_id) {
    return lead.conversation_id;
  }

  const {
    data: conversation,
    error: conversationError,
  } =
    await db
      .from("conversations")
      .insert({
        tenant_id:
          lead.tenant_id,

        contact_id:
          lead.contact_id ||
          null,

        channel:
          "email",

        status:
          "open",

        ai_enabled:
          false,

        human_attention_required:
          true,
      })
      .select("id")
      .single();

  if (
    conversationError ||
    !conversation
  ) {
    throw (
      conversationError ||
      new Error(
        "Could not create conversation."
      )
    );
  }

  const conversationId =
    conversation.id;

  const {
    error: leadUpdateError,
  } =
    await db
      .from("leads")
      .update({
        conversation_id:
          conversationId,
      })
      .eq(
        "id",
        lead.id,
      );

  if (leadUpdateError) {
    throw leadUpdateError;
  }

  const initialMessage =
    String(
      lead.message || ""
    ).trim();

  if (initialMessage) {
    const {
      error: messageError,
    } =
      await db
        .from("messages")
        .insert({
          conversation_id:
            conversationId,

          role:
            "customer",

          channel:
            "website",

          content:
            initialMessage,
        });

    if (messageError) {
      console.error(
        "INITIAL_CONVERSATION_MESSAGE_ERROR",
        messageError,
      );
    }
  }

  return conversationId;
}


export async function logClientSystemMessage(
  db: any,
  conversationId: string,
  content: string,
) {
  const {
    error,
  } =
    await db
      .from("messages")
      .insert({
        conversation_id:
          conversationId,

        role:
          "system",

        channel:
          "email",

        content,
      });

  if (error) {
    console.error(
      "CLIENT_COMMUNICATION_LOG_ERROR",
      error,
    );
  }
}
