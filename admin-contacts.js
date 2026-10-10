/* GD Studio 360 Contact Book — uses existing Supabase contacts/leads/conversations. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const view = $('contacts-view');
  if (!view) return;
  const list = $('gd-contacts-list');
  const details = $('gd-contact-details');
  const status = $('gd-contacts-status');
  const search = $('gd-contacts-search');
  const form = $('gd-contact-form');
  const formPanel = $('gd-contact-form-panel');
  const formStatus = $('gd-contact-form-status');
  const save = $('gd-contact-save');
  const add = $('gd-contact-add');
  const cancel = $('gd-contact-cancel');
  const formTitle = $('gd-contact-form-title');
  let tenantId = null;
  let groups = [];
  let allContacts = [];
  let allLeads = [];
  let allChats = [];
  let allLinks = [];
  let selected = null;
  let editing = null;
  let loading = false;

  function db() {
    return (typeof client !== 'undefined' && client) || null;
  }
  // Match UK local, international and WhatsApp E.164 numbers.
  function phoneKey(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('0044') && digits.length === 14) digits = digits.slice(2);
    else if (digits.startsWith('00') && digits.length >= 9) digits = digits.slice(2);
    if (/^0\d{10}$/.test(digits)) digits = '44' + digits.slice(1);
    if (/^7\d{9}$/.test(digits)) digits = '44' + digits;
    return digits.length >= 7 && digits.length <= 15 ? digits : '';
  }
  function emailKey(value) { return String(value || '').trim().toLowerCase(); }
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined && text !== null) el.textContent = String(text);
    if (className) el.className = className;
    return el;
  }
  function button(text, callback, cls = '') {
    const el = node('button', text, cls);
    el.type = 'button';
    el.addEventListener('click', callback);
    return el;
  }
  function message(text) { status.textContent = text; }
  function groupKey(c) {
    const phone = phoneKey(c.phone);
    return phone ? 'phone:' + phone : c.email ? 'email:' + emailKey(c.email) : 'id:' + c.id;
  }
  function rank(c) {
    let score = 0;
    if (allLeads.some(l => l.contact_id === c.id)) score += 10;
    if (c.email) score += 4;
    if (c.business_name) score += 3;
    if (c.name && !/^WhatsApp customer$/i.test(c.name)) score += 2;
    if (c.source === 'manual') score += 1;
    return score;
  }
  function rebuildGroups() {
    const map = new Map();
    for (const c of allContacts) {
      const key = groupKey(c);
      if (!map.has(key)) map.set(key, { key, records: [] });
      map.get(key).records.push(c);
    }
    groups = [...map.values()].map(g => {
      g.records.sort((a,b) => rank(b) - rank(a));
      g.primary = g.records[0];
      const ids = new Set(g.records.map(x => x.id));
      const pk = phoneKey(g.primary.phone);
      const emails = new Set(g.records.map(x => emailKey(x.email)).filter(Boolean));
      g.leads = allLeads.filter(l => ids.has(l.contact_id) ||
        (pk && phoneKey(l.phone) === pk) ||
        (!pk && emailKey(l.email) && emails.has(emailKey(l.email))));
      g.chats = allChats.filter(x => ids.has(x.contact_id) ||
        allLinks.some(link => link.conversation_id === x.id && ids.has(link.contact_id)) ||
        (pk && phoneKey(x.contacts?.phone) === pk));
      g.business = g.records.find(x => x.business_name)?.business_name || g.leads.find(x => x.business)?.business || '';
      g.name = g.records.map(x => x.name).find(x => x && !/^WhatsApp customer$/i.test(x)) ||
        g.leads.find(x => x.name)?.name || g.business || g.primary.name || g.primary.phone || 'Unknown contact';
      g.phone = g.records.find(x => x.phone)?.phone || g.leads.find(x => x.phone)?.phone || '';
      g.email = g.records.find(x => x.email)?.email || g.leads.find(x => x.email)?.email || '';
      return g;
    }).sort((a,b) => Number(b.leads.length > 0) - Number(a.leads.length > 0) ||
        String(a.name).localeCompare(String(b.name)));
  }
  function renderList() {
    if (!list) return;
    const term = String(search.value || '').trim().toLowerCase();
    const filtered = groups.filter(g => !term || [g.name,g.business,g.email,g.phone,phoneKey(g.phone)]
      .some(v => String(v||'').toLowerCase().includes(term)));
    list.replaceChildren();
    if (!filtered.length) list.appendChild(node('p', 'No contacts found.', 'gd-contact-muted'));
    for (const g of filtered) {
      const item = button('', () => { selected = g.key; hideForm(); renderList(); renderDetails(); }, 'gd-contact-item');
      if (selected === g.key) item.classList.add('active');
      const title = node('strong', g.name);
      const sub = node('small', [g.business, g.phone].filter(Boolean).join(' · ') || g.email || 'No phone or email');
      item.append(title, sub);
      if (g.leads.length) item.appendChild(node('span', 'Project', 'gd-contact-pill'));
      else if (g.chats.length) item.appendChild(node('span', 'WhatsApp', 'gd-contact-pill'));
      list.appendChild(item);
    }
    $('gd-contacts-count').textContent = groups.length + ' contacts';
  }
  function addField(parent, label, value) {
    if (!value) return;
    const row = node('div', null, 'gd-contact-field');
    row.append(node('span', label), node('strong', value));
    parent.appendChild(row);
  }
  function renderDetails() {
    if (!details) return;
    details.replaceChildren();
    const g = groups.find(x => x.key === selected);
    if (!g) { details.appendChild(node('p', 'Select a contact or add a new one.', 'gd-contact-muted')); return; }
    details.append(node('h3', g.name));
    if (g.business) details.append(node('p', g.business, 'gd-contact-muted'));
    const fields = node('div', null, 'gd-contact-fields');
    addField(fields, 'WhatsApp / telephone', g.phone);
    addField(fields, 'Email', g.email);
    addField(fields, 'Source', g.primary.source || 'Unknown');
    const note = g.records.find(c => c.notes)?.notes;
    addField(fields, 'Notes', note);
    details.appendChild(fields);
    const actions = node('div', null, 'gd-contact-actions');
    actions.appendChild(button('Edit contact', () => openForm(g.primary), 'ghost-button'));
    actions.appendChild(button('Delete contact', () => deleteContactGroup(g.key), 'gd-contact-delete'));
    if (g.phone) actions.appendChild(button('Copy number', async () => {
      try { await navigator.clipboard.writeText(g.phone); message('Phone number copied.'); }
      catch (_) { message('Copy unavailable. Select the phone number above.'); }
    }, 'ghost-button'));
    if (g.email) {
      const link = node('a', 'Send email', 'ghost-button');
      link.href = 'mailto:' + g.email;
      actions.appendChild(link);
    }
    details.appendChild(actions);

    const projects = node('div', null, 'gd-contact-related');
    projects.appendChild(node('h4', 'Projects / enquiries (' + g.leads.length + ')'));
    if (!g.leads.length) projects.appendChild(node('p','No website enquiries linked.','gd-contact-muted'));
    for (const l of g.leads) {
      const item = node('div', null, 'gd-contact-related-item');
      item.append(node('strong', l.business || l.name || 'Website enquiry'));
      item.append(node('small', [l.package, l.status].filter(Boolean).join(' · ')));
      projects.appendChild(item);
    }
    details.appendChild(projects);

    const chats = node('div', null, 'gd-contact-related');
    chats.appendChild(node('h4', 'WhatsApp conversations (' + g.chats.length + ')'));
    if (!g.chats.length) chats.appendChild(node('p','No incoming WhatsApp conversations yet.','gd-contact-muted'));
    for (const chat of g.chats) {
      chats.appendChild(button('Open WhatsApp conversation', () => {
        document.dispatchEvent(new CustomEvent('gd360:open-whatsapp', {
          detail: { conversationId: chat.id, name: g.name }
        }));
      }, 'gd-contact-chat-button'));
    }
    details.appendChild(chats);
    if (g.records.length > 1) details.appendChild(node('p',
      'This phone has ' + g.records.length + ' existing database records. They are shown together here; no data was deleted or merged.', 'gd-contact-muted'));
  }
  async function deleteContactGroup(key) {
    const group = groups.find(g => g.key === key);
    if (!group || !db()) return;
    const ids = [...new Set(group.records.map(c => c.id))];
    const extra = ids.length > 1 ? ` (${ids.length} linked contact records)` : '';
    if (!window.confirm(
      `Delete "${group.name}" from the Contact Book${extra}?\n\n` +
      'This hides the contact from the address book. It does NOT delete website enquiries, ' +
      'projects, WhatsApp conversations or messages.\n\nContinue?'
    )) return;
    const deleteButtons = [...details.querySelectorAll('.gd-contact-delete')];
    deleteButtons.forEach(el => { el.disabled = true; });
    message('Removing contact from the book…');
    try {
      const tenant = await resolveTenant();
      const now = new Date().toISOString();
      const { data, error } = await db().from('contacts')
        .update({ deleted_at: now, updated_at: now })
        .eq('tenant_id', tenant).in('id', ids).is('deleted_at', null)
        .select('id');
      if (error) throw error;
      if ((data || []).length !== ids.length) throw new Error('Not all contact records could be archived. Refresh to verify.');
      selected = null;
      hideForm();
      await loadContacts();
      message('Contact removed from the book. Related projects and WhatsApp messages were preserved.');
    } catch (error) {
      message('Could not remove contact: ' + error.message);
    } finally {
      deleteButtons.forEach(el => { el.disabled = false; });
    }
  }
  function hideForm() { formPanel.hidden = true; editing = null; form.reset(); formStatus.textContent = ''; }
  function openForm(contact = null) {
    editing = contact?.id || null;
    form.reset();
    formStatus.textContent = '';
    formTitle.textContent = editing ? 'Edit contact' : 'Add contact';
    $('gd-contact-name').value = contact?.name || '';
    $('gd-contact-business').value = contact?.business_name || '';
    $('gd-contact-phone').value = contact?.phone || '';
    $('gd-contact-email').value = contact?.email || '';
    $('gd-contact-notes').value = contact?.notes || '';
    formPanel.hidden = false;
    $('gd-contact-name').focus();
  }
  async function resolveTenant() {
    if (tenantId) return tenantId;
    const {data,error} = await db().from('tenant_members').select('tenant_id,role')
      .in('role',['owner','admin']).limit(5);
    if (error) throw error;
    if (!data?.length) throw new Error('Owner/admin tenant membership not found.');
    // GD Studio 360 currently has one business tenant.
    tenantId = data[0].tenant_id;
    return tenantId;
  }
  async function loadContacts() {
    if (view.hidden || loading || !db()) return;
    loading = true;
    message('Loading contact book…');
    try {
      const id = await resolveTenant();
      const [c, l, w, links] = await Promise.all([
        db().from('contacts').select('id,name,business_name,email,phone,source,notes,created_at,updated_at')
          .eq('tenant_id',id).is('deleted_at',null).order('created_at',{ascending:false}).limit(1000),
        db().from('leads').select('id,contact_id,name,business,email,phone,package,status,created_at')
          .eq('tenant_id',id).order('created_at',{ascending:false}).limit(1000),
        db().from('conversations').select('id,contact_id,channel,updated_at,contacts(phone)')
          .eq('tenant_id',id).eq('channel','whatsapp').limit(1000),
        db().from('gd360_contact_links').select('conversation_id,contact_id')
          .eq('tenant_id',id).limit(1000)
      ]);
      if (c.error || l.error || w.error || links.error) throw (c.error || l.error || w.error || links.error);
      allContacts = c.data || [];
      allLeads = l.data || [];
      allChats = w.data || [];
      allLinks = links.data || [];
      rebuildGroups();
      if (!groups.some(x => x.key === selected)) selected = groups[0]?.key || null;
      renderList();
      if (formPanel.hidden) renderDetails();
      message('Contact book is up to date.');
    } catch (error) { message('Could not load contacts: ' + error.message); }
    finally { loading = false; }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!db()) return;
    const name = $('gd-contact-name').value.trim();
    const business_name = $('gd-contact-business').value.trim();
    const rawPhone = $('gd-contact-phone').value.trim();
    const phone = rawPhone ? phoneKey(rawPhone) : '';
    const email = emailKey($('gd-contact-email').value);
    const notes = $('gd-contact-notes').value.trim();
    if (!name && !business_name) { formStatus.textContent = 'Enter a name or business.'; return; }
    if (!phone && !email) { formStatus.textContent = 'Enter a valid phone number or email.'; return; }
    if (rawPhone && !phone) { formStatus.textContent = 'Check the phone number (7–15 digits, with country code if needed).'; return; }
    if (notes.length > 2000) { formStatus.textContent = 'Notes must be under 2000 characters.'; return; }
    // Prevent accidental duplicates. Preserve existing lead / WhatsApp data.
    const existing = allContacts.find(c => c.id !== editing &&
      (phone && phoneKey(c.phone) === phone || email && emailKey(c.email) === email));
    if (existing) {
      selected = groupKey(existing);
      formStatus.textContent = 'This phone number or email already exists. Select the contact instead.';
      renderList();
      return;
    }
    save.disabled = true;
    formStatus.textContent = 'Saving…';
    try {
      const id = await resolveTenant();
      const values = {name:name || null, business_name:business_name || null,
        phone:phone ? '+' + phone : null, email:email || null, notes:notes || null, updated_at:new Date().toISOString()};
      let result;
      if (editing) {
        result = await db().from('contacts').update(values).eq('tenant_id',id).eq('id',editing).select('id').single();
      } else {
        result = await db().from('contacts').insert({...values,tenant_id:id,source:'manual'}).select('id').single();
      }
      if (result.error) throw result.error;
      const newId = result.data.id;
      hideForm();
      await loadContacts();
      const g = groups.find(x => x.records.some(y => y.id === newId));
      if (g) selected = g.key;
      renderList(); renderDetails();
      message('Contact saved.');
    } catch (error) { formStatus.textContent = 'Could not save: ' + error.message; }
    finally { save.disabled = false; }
  });
  add.addEventListener('click', () => openForm());
  cancel.addEventListener('click', hideForm);
  search.addEventListener('input', renderList);
  document.addEventListener('gd360:contacts:refresh', loadContacts);
  document.addEventListener('gd360:contacts:show', loadContacts);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !view.hidden) loadContacts();
  });
})();
