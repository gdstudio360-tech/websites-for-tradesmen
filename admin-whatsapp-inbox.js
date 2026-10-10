(() => {
  const $ = id => document.getElementById(id);
  const projectsTab = $("projects-tab");
  const whatsappTab = $("whatsapp-tab");
  const inbox = $("whatsapp-inbox");
  const heading = document.querySelector("#dashboard-view > .dashboard-heading");
  const stats = document.querySelector("#dashboard-view > .stats-grid");
  const toolbar = document.querySelector("#dashboard-view > .toolbar");
  const leadList = $("lead-list");
  const dashboardStatus = $("dashboard-status");
  const pendingBanner = $("pending-enquiry-banner");
  const status = $("whatsapp-status");
  const conversationsList = $("whatsapp-conversation-list");
  const messagesList = $("whatsapp-message-list");
  const chatTitle = $("whatsapp-chat-title");

  if (!projectsTab || !whatsappTab || !inbox) return;

  let activeConversation = null;

  function showTab(tab) {
    const isWhatsApp = tab === "whatsapp";

    inbox.hidden = !isWhatsApp;
    projectsTab.classList.toggle("active", !isWhatsApp);
    whatsappTab.classList.toggle("active", isWhatsApp);
    projectsTab.setAttribute("aria-selected", String(!isWhatsApp));
    whatsappTab.setAttribute("aria-selected", String(isWhatsApp));

    for (const el of [...document.querySelectorAll("#dashboard-view > .crm-tabs, #dashboard-view > .crm-toolbar, #dashboard-view > .crm-layout"), dashboardStatus, pendingBanner]) {
      if (!el) continue;
      if (isWhatsApp) {
        el.dataset.previousHidden = String(el.hidden);
        el.hidden = true;
      } else if (el.dataset.previousHidden !== undefined) {
        el.hidden = el.dataset.previousHidden === "true";
        delete el.dataset.previousHidden;
      }
    }

    if (isWhatsApp) loadConversations();
  }

  function getClient() {
    return typeof client !== "undefined" ? client : null;
  }

  async function loadConversations() {
    const db = getClient();
    if (!db) return;

    status.textContent = "Loading conversations…";
    conversationsList.replaceChildren();

    const { data, error } = await db
      .from("conversations")
      .select("id, contact_id, updated_at, contacts(name, phone)")
      .eq("channel", "whatsapp")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) {
      status.textContent = "Unable to load conversations: " + error.message;
      return;
    }

    status.textContent = `${data.length} WhatsApp conversation(s)`;

    for (const conversation of data) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "whatsapp-conversation-item";

      const contact = conversation.contacts;
      const name = contact?.name || contact?.phone || "WhatsApp customer";
      button.textContent = name;
      button.addEventListener("click", () => {
        activeConversation = conversation.id;
        chatTitle.textContent = name;
        document.getElementById("whatsapp-reply-form").hidden = false;
        loadMessages(conversation.id);
      });
      conversationsList.appendChild(button);
    }

    if (activeConversation && data.some(c => c.id === activeConversation)) {
      await loadMessages(activeConversation);
    }
  }

  async function loadMessages(conversationId) {
    const db = getClient();
    if (!db) return;

    messagesList.replaceChildren();
    const { data, error } = await db
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .eq("channel", "whatsapp")
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      status.textContent = "Unable to load messages: " + error.message;
      return;
    }

    for (const message of data) {
      const bubble = document.createElement("div");
      bubble.className = "whatsapp-message";
      const author = document.createElement("strong");
      author.textContent = message.role === "customer" ? "Customer" : "Studio";
      const content = document.createElement("p");
      content.textContent = message.content || "";
      bubble.append(author, content);
      messagesList.appendChild(bubble);
    }
  }

  $("whatsapp-reply-form").onsubmit=async e=>{
    e.preventDefault();
    if(!activeConversation)return;
    const input=$("whatsapp-reply-text");
    const btn=$("whatsapp-send");
    const content=input.value.trim();
    if(!content)return;
    btn.disabled=true;
    status.textContent="Sending...";
    try{
      const {data,error}=await getClient().functions.invoke("whatsapp-reply",{body:{conversation_id:activeConversation,content}});
      if(error||!data?.ok)throw Error(data?.error||error?.message||"Send failed");
      input.value="";
      await loadMessages(activeConversation);
      status.textContent=data.warning||"Message sent";
    }catch(err){status.textContent="Send failed: "+err.message;}
    finally{btn.disabled=false;}
  };
  projectsTab.addEventListener("click", () => showTab("projects"));
  whatsappTab.addEventListener("click", () => showTab("whatsapp"));
  $("whatsapp-refresh")?.addEventListener("click", loadConversations);
})();
