'use strict';

const express = require('express');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || 'v23.0'; // Set to a currently supported version in Meta Developer Dashboard.
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || '';
const META_APP_SECRET = process.env.META_APP_SECRET || '';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || '';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const BUSINESS_NAME = process.env.BUSINESS_NAME || 'আমাদের ব্যবসা';
const BUSINESS_INFO = process.env.BUSINESS_INFO || 'ব্যবসার পণ্য, দাম, ডেলিভারি ও নীতিমালা সম্পর্কে নিশ্চিত তথ্য না থাকলে অনুমান করবেন না; কাস্টমারকে মানব সহায়তার জন্য বলুন।';
const BOT_LANGUAGE = process.env.BOT_LANGUAGE || 'বাংলা ও English';
const SIGNATURE_REQUIRED = process.env.WEBHOOK_SIGNATURE_REQUIRED !== 'false';

// Save the raw request body so Meta webhook signatures can be verified.
app.use(cors());
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => { req.rawBody = Buffer.from(buf); }
}));
app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => res.status(200).send('AI Backend API is working!'));
app.get('/api/status', (req, res) => {
  res.json({ status: 'online', message: 'Backend API is running', integrations: {
    openai: Boolean(OPENAI_API_KEY), facebook: Boolean(PAGE_ACCESS_TOKEN),
    whatsapp: Boolean(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID),
    webhookSignatureVerification: Boolean(META_APP_SECRET)
  }});
});

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function validMetaSignature(req) {
  if (!META_APP_SECRET) return !SIGNATURE_REQUIRED;
  const header = req.get('x-hub-signature-256') || '';
  if (!header.startsWith('sha256=') || !req.rawBody) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', META_APP_SECRET).update(req.rawBody).digest('hex');
  return safeEqual(header, expected);
}

async function getAIReply(message, platform, senderId) {
  if (!OPENAI_API_KEY) {
    throw new Error('AI is not configured: set OPENAI_API_KEY in Render Environment Variables.');
  }
  const instructions = [
    `You are the customer-service assistant for ${BUSINESS_NAME}.`,
    `Reply language preference: ${BOT_LANGUAGE}. Understand and respond naturally in Bangla or English based on the customer's message.`,
    `Business information: ${BUSINESS_INFO}`,
    'Be polite, concise, and useful. Never invent product prices, stock, delivery promises, policies, or order status. If information is missing or uncertain, say so and offer human assistance.',
    'Do not ask for passwords, full payment card details, OTPs, or other sensitive credentials.',
    `Channel: ${platform}. Sender reference: ${senderId || 'unknown'}.`
  ].join('\n');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI_MODEL, instructions, input: String(message).slice(0, 6000), max_output_tokens: 400 })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || `OpenAI API returned HTTP ${response.status}`;
    throw new Error(detail);
  }
  const text = data.output_text || (data.output || []).flatMap(item => item.content || []).map(c => c.text || '').join('\n').trim();
  if (!text) throw new Error('AI returned an empty response.');
  return text.slice(0, 3500);
}

app.post('/api/chat', async (req, res) => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) return res.status(400).json({ error: 'message is required' });
    const reply = await getAIReply(message, req.body?.mode || 'web', 'web-user');
    res.json({ reply, response: reply });
  } catch (err) {
    console.error('api/chat error:', err.message);
    const status = err.message.startsWith('AI is not configured') ? 503 : 502;
    res.status(status).json({ error: err.message || 'Could not generate AI response' });
  }
});

async function sendWhatsAppText(to, text) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) throw new Error('WhatsApp credentials are missing.');
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body: text } })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`WhatsApp send failed (${r.status}): ${JSON.stringify(data.error || data)}`);
  return data;
}

async function sendMessengerText(recipientId, text) {
  if (!PAGE_ACCESS_TOKEN) throw new Error('PAGE_ACCESS_TOKEN is missing.');
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN)}`;
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, messaging_type: 'RESPONSE', message: { text: text.slice(0, 2000) } })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Messenger send failed (${r.status}): ${JSON.stringify(data.error || data)}`);
  return data;
}

// Meta can verify this callback URL for subscribed webhook products.
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && VERIFY_TOKEN && safeEqual(token, VERIFY_TOKEN)) {
    return res.status(200).type('text/plain').send(String(challenge || ''));
  }
  return res.sendStatus(403);
});

// Respond quickly to Meta, then process incoming messages asynchronously.
app.post('/webhook', (req, res) => {
  if (!validMetaSignature(req)) {
    console.warn('Rejected webhook: invalid/missing x-hub-signature-256');
    return res.sendStatus(META_APP_SECRET || SIGNATURE_REQUIRED ? 401 : 503);
  }
  res.sendStatus(200);
  setImmediate(() => processWebhook(req.body).catch(err => console.error('Webhook processing error:', err.message)));
});

async function processWebhook(body) {
  if (!body || typeof body !== 'object') return;
  // WhatsApp Cloud API event
  if (body.object === 'whatsapp_business_account') {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;
        const value = change.value || {};
        for (const msg of value.messages || []) {
          if (!msg.from || msg.type !== 'text' || !msg.text?.body) continue;
          // Only reply to inbound text messages. Delivery/read status events have no messages array.
          try {
            const reply = await getAIReply(msg.text.body, 'WhatsApp', msg.from);
            await sendWhatsAppText(msg.from, reply);
          } catch (err) { console.error('WhatsApp reply error:', err.message); }
        }
      }
    }
    return;
  }

  // Facebook Messenger Page event
  if (body.object === 'page') {
    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        if (event.message?.is_echo) continue; // Ignore messages sent by the Page itself.
        const senderId = event.sender?.id;
        const text = event.message?.text;
        if (!senderId || !text) continue;
        try {
          const reply = await getAIReply(text, 'Facebook Messenger', senderId);
          await sendMessengerText(senderId, reply);
        } catch (err) { console.error('Messenger reply error:', err.message); }
      }
    }
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI Backend API listening on port ${PORT}`);
  console.log(`Graph API version: ${GRAPH_API_VERSION}`);
  if (!OPENAI_API_KEY) console.warn('OPENAI_API_KEY is not configured; /api/chat and auto-replies will not work.');
  if (!VERIFY_TOKEN) console.warn('META_VERIFY_TOKEN is not configured; Meta webhook verification will fail.');
  if (!META_APP_SECRET && SIGNATURE_REQUIRED) console.warn('META_APP_SECRET is required for webhook signature verification.');
});
