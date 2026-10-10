import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const reply = (data: object, status = 200) =>
  Response.json(data, { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return reply({ ok: true });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
    const url = Deno.env.get("SUPABASE_URL") || "";
    const key = Deno.env.get("SUPABASE_ANON_KEY") ||
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SECRET_KEY") || "";

    if (!jwt || !url || !key || !service)
      return reply({ error: "Missing authentication or configuration" }, 401);

    const auth = createClient(url, key);
    const db = createClient(url, service);
    const { data: user, error } = await auth.auth.getUser(jwt);

    if (error || !user.user)
      return reply({ error: "Invalid session" }, 401);
    const {data:admin}=await db.from("admin_users").select("user_id").eq("user_id",user.user.id).maybeSingle();
    if(!admin)return reply({error:"Admin access required"},403);
    const body=await req.json();
    const id=String(body.conversation_id||"");
    const content=String(body.content||"").trim();
    if(!/^[0-9a-f-]{36}$/i.test(id)||!content||content.length>4096)return reply({error:"Invalid message"},400);
    const {data:conversation}=await db.from("conversations").select("id,tenant_id,contacts(phone)").eq("id",id).eq("channel","whatsapp").maybeSingle();
    if(!conversation)return reply({error:"Conversation not found"},404);
    const {data:member}=await db.from("tenant_members").select("role").eq("tenant_id",conversation.tenant_id).eq("user_id",user.user.id).in("role",["owner","admin"]).maybeSingle();
    if(!member)return reply({error:"Access denied"},403);
    const since=new Date(Date.now()-86400000).toISOString();
    const {data:recent}=await db.from("messages").select("id").eq("conversation_id",id).eq("channel","whatsapp").eq("role","customer").gte("created_at",since).limit(1).maybeSingle();
    if(!recent)return reply({error:"24-hour reply window expired"},409);
    const contact=conversation.contacts;
    const phone=String((Array.isArray(contact)?contact[0]?.phone:contact?.phone)||"").replace(/\D/g,"");
    if(!/^\d{7,15}$/.test(phone))return reply({error:"Customer phone missing"},400);
    const token=Deno.env.get("WHATSAPP_ACCESS_TOKEN")||Deno.env.get("META_ACCESS_TOKEN")||"";
    const phoneId=Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")||Deno.env.get("META_PHONE_NUMBER_ID")||"";
    if(!token||!/^\d+$/.test(phoneId))return reply({error:"WhatsApp sending secrets missing"},503);
    const version=Deno.env.get("META_GRAPH_VERSION")||"v24.0";
    const res=await fetch("https://graph.facebook.com/"+version+"/"+phoneId+"/messages",{
      method:"POST",
      headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
      body:JSON.stringify({messaging_product:"whatsapp",recipient_type:"individual",to:phone,type:"text",text:{preview_url:false,body:content}})
    });
    const result=await res.json();
    if(!res.ok||!result.messages?.[0]?.id)return reply({error:result.error?.message||"Meta send failed"},502);
    const messageId=result.messages[0].id;
    const {error:saveError}=await db.from("messages").insert({
      conversation_id:id,channel:"whatsapp",role:"human",
      content,external_message_id:messageId
    });
    await db.from("conversations").update({
      updated_at:new Date().toISOString()
    }).eq("id",id);
    return reply({ok:true,message_id:messageId,
      warning:saveError?"Sent, but CRM history was not saved":null});
  }catch(error){
    console.error("WHATSAPP_REPLY_ERROR",error);
    return reply({error:"Unable to send WhatsApp reply"},500);
  }
});
