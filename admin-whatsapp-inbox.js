(() => {
  const $ = id => document.getElementById(id);
  const projectsTab = $("projects-tab");
  const whatsappTab = $("whatsapp-tab");
  const contactsTab = $("contacts-tab");
  const contactsView = $("contacts-view");
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
    const isContacts = tab === "contacts";

    inbox.hidden = !isWhatsApp;
    contactsView.hidden = !isContacts;
    projectsTab.classList.toggle("active", !isWhatsApp && !isContacts);
    whatsappTab.classList.toggle("active", isWhatsApp);
    contactsTab.classList.toggle("active", isContacts);
    projectsTab.setAttribute("aria-selected", String(!isWhatsApp && !isContacts));
    whatsappTab.setAttribute("aria-selected", String(isWhatsApp));
    contactsTab.setAttribute("aria-selected", String(isContacts));

    for (const el of [...document.querySelectorAll("#dashboard-view > .crm-tabs, #dashboard-view > .crm-toolbar, #dashboard-view > .crm-layout"), dashboardStatus, pendingBanner]) {
      if (!el) continue;
      if (isWhatsApp || isContacts) {
        if (el.dataset.previousHidden === undefined) el.dataset.previousHidden = String(el.hidden);
        el.hidden = true;
      } else if (el.dataset.previousHidden !== undefined) {
        el.hidden = el.dataset.previousHidden === "true";
        delete el.dataset.previousHidden;
      }
    }

    if (isWhatsApp) loadConversations();
    if (isContacts) document.dispatchEvent(new Event("gd360:contacts:show"));
  }

  function getClient() {
    return typeof client !== "undefined" ? client : null;
  }

  let waRead = {};
  let waBusy = false;
  let waLastSig = "";
  const waBadge = document.createElement("span");
  waBadge.className = "gd360-wa-unread";
  waBadge.hidden = true;
  whatsappTab.appendChild(waBadge);

  async function loadConversations() {
    const db = getClient();
    if (!db || waBusy) return;
    waBusy = true;
    try {
      const { data: authData, error: authError } = await db.auth.getUser();
      if (authError || !authData?.user) return;
      waRead = authData.user.user_metadata?.gd360_wa_read || {};
      const { data: conversations, error } = await db.from("conversations")
        .select("id, contact_id, updated_at, contacts(name, phone)")
        .eq("channel", "whatsapp").order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      const ids = conversations.map(x => x.id);
      let incoming = [];
      if (ids.length) {
        const response = await db.from("messages")
          .select("conversation_id, created_at")
          .in("conversation_id", ids).eq("channel", "whatsapp")
          .eq("role", "customer").order("created_at", { ascending: false })
          .limit(1000);
        if (response.error) throw response.error;
        incoming = response.data || [];
      }
      const counts = {}, latest = {};
      for (const msg of incoming) {
        const id = msg.conversation_id;
        if (!latest[id]) latest[id] = msg.created_at;
        if (msg.created_at > (waRead[id] || "")) counts[id] = (counts[id] || 0) + 1;
      }
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      waBadge.textContent = total > 99 ? "99+" : String(total);
      waBadge.hidden = total === 0;
      whatsappTab.setAttribute("aria-label", "WhatsApp Inbox, " + total + " unread messages");
      conversations.sort((a, b) =>
        Number((counts[b.id] || 0) > 0) - Number((counts[a.id] || 0) > 0) ||
        Date.parse(counts[b.id] ? latest[b.id] : b.updated_at) -
        Date.parse(counts[a.id] ? latest[a.id] : a.updated_at));
      const signature = JSON.stringify(conversations.map(x => [x.id, x.updated_at, counts[x.id] || 0]));
      if (signature !== waLastSig) {
      conversationsList.replaceChildren();
      for (const conversation of conversations) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "whatsapp-conversation-item";
        const n = counts[conversation.id] || 0;
        if (n) button.classList.add("is-unread");
        const contact = conversation.contacts;
        const name = contact?.name || contact?.phone || "WhatsApp customer";
        const nameSpan = document.createElement("span");
        nameSpan.textContent = name;
        button.appendChild(nameSpan);
        if (n) {
          const marker = document.createElement("span");
          marker.className = "gd360-wa-unread";
          marker.textContent = n > 99 ? "99+" : String(n);
          button.appendChild(marker);
        }
        button.addEventListener("click", () => {
          activeConversation = conversation.id;
          chatTitle.textContent = name;
          document.getElementById("whatsapp-reply-form").hidden = false;
          loadMessages(conversation.id);
        });
        conversationsList.appendChild(button);
      }
      waLastSig = signature;
      }
      if (!inbox.hidden) status.textContent = `${conversations.length} WhatsApp conversation(s)`;
      if (activeConversation && !inbox.hidden && counts[activeConversation] && !document.hidden)
        await loadMessages(activeConversation);
    } catch (error) {
      if (!inbox.hidden) status.textContent = "Inbox refresh failed: " + error.message;
    } finally {
      waBusy = false;
    }
  }

  async function markWhatsappRead(conversationId, data) {
    if (inbox.hidden || document.hidden || activeConversation !== conversationId) return;
    const latest = data.filter(x => x.role === "customer").at(-1)?.created_at;
    if (!latest || latest <= (waRead[conversationId] || "")) return;
    const next = { ...waRead, [conversationId]: latest };
    const { error } = await getClient().auth.updateUser({ data: { gd360_wa_read: next } });
    if (error) { status.textContent = "Read status could not be saved: " + error.message; return; }
    waRead = next;
    setTimeout(() => loadConversations(), 0);
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
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      status.textContent = "Unable to load messages: " + error.message;
      return;
    }

    const ordered = [...data].reverse();
    for (const message of ordered) {
      const bubble = document.createElement("div");
      bubble.className = "whatsapp-message";
      const author = document.createElement("strong");
      author.textContent = message.role === "customer" ? "Customer" : "Studio";
      const content = document.createElement("p");
      content.textContent = message.content || "";
      bubble.append(author, content);
      messagesList.appendChild(bubble);
    }
    await markWhatsappRead(conversationId, ordered);
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
      if(error||!data?.ok){const r=error?.context;const d=r?await r.clone().json().catch(()=>null):null;throw Error(d?.error||data?.error||error?.message||"Send failed");}
      input.value="";
      await loadMessages(activeConversation);
      status.textContent=data.warning||"Message sent";
    }catch(err){status.textContent="Send failed: "+err.message;}
    finally{btn.disabled=false;}
  };
  projectsTab.addEventListener("click", () => showTab("projects"));
  whatsappTab.addEventListener("click", () => showTab("whatsapp"));
  contactsTab.addEventListener("click", () => showTab("contacts"));
  document.addEventListener("gd360:open-whatsapp", event => {
    const { conversationId, name } = event.detail || {};
    if (!conversationId) return;
    activeConversation = conversationId;
    chatTitle.textContent = name || "WhatsApp customer";
    $("whatsapp-reply-form").hidden = false;
    showTab("whatsapp");
    loadMessages(conversationId);
  });
  document.addEventListener("gd360:whatsapp:refresh", loadConversations);
  setInterval(() => {
    if (!document.hidden && !document.getElementById("dashboard-view").hidden)
      loadConversations();
  }, 15000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !document.getElementById("dashboard-view").hidden)
      loadConversations();
  });
})();
