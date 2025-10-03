import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.API_KEY;
const PROJECT_ID = process.env.PROJECT_ID;
const MODEL_ID = process.env.MODEL_ID || 'ibm/granite-13b-chat-v2';
const WATSONX_URL = (process.env.URL || 'https://us-south.ml.cloud.ibm.com').replace(/\/$/, '');
const PORT = process.env.PORT || 5000;
const FALLBACK_MSG = 'Sorry, abhi mujhe reply generate karne me dikkat ho rahi hai. 🙏';

function log(...args) { console.log(new Date().toISOString(), ...args); }
function logErr(...args) { console.error(new Date().toISOString(), ...args); }

function checkConfig() {
  const missing = [];
  if (!API_KEY) missing.push('API_KEY');
  if (!PROJECT_ID) missing.push('PROJECT_ID');
  if (!WATSONX_URL) missing.push('URL');
  return { ok: missing.length === 0, missing };
}

app.get('/api/health', (req, res) => {
  const cfg = checkConfig();
  res.json({ status: 'ok', ready: cfg.ok, missing: cfg.missing });
});

function languageInstruction(lang) {
  const val = (lang || '').toString().toLowerCase();
  if (val === 'hi' || val === 'hindi') return 'Please reply in Hindi (Devanagari script) only.';
  if (val === 'hinglish') return 'Please reply in Hinglish: Hindi written using Roman (English) letters, casual and easy to read. Avoid Devanagari.';
  return 'Please reply in English.';
}

async function getAccessToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'urn:ibm:params:oauth:grant-type:apikey');
  params.append('apikey', API_KEY || '');
  const resp = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: params.toString(),
  });
  let data = {};
  try { data = await resp.json(); } catch {}
  if (!resp.ok || !data.access_token) {
    const msg = data.error_description || data.error || `iam_status_${resp.status}`;
    throw new Error(msg);
  }
  return data.access_token;
}

async function tryGenerationOnly({ message, headers, modelId, lang }) {
  const instr = languageInstruction(lang);
  const genResp = await fetch(`${WATSONX_URL}/ml/v1/text/generation?version=2023-05-29`, {
    method: 'POST', headers, body: JSON.stringify({
      input: `${instr}\n\nHuman: ${message}\n\nAssistant:`, project_id: PROJECT_ID, model_id: modelId,
      parameters: { decoding_method: 'sample', max_new_tokens: 200, temperature: 0.7, top_p: 1, top_k: 50 }
    })
  });
  const genData = await genResp.json().catch(()=>({}));
  if (genResp.ok && Array.isArray(genData?.results) && genData.results[0]?.generated_text) {
    const generated = genData.results[0].generated_text;
    const cleaned = generated.replace(`Human: ${message}\n\nAssistant:`, '').trim();
    return { ok: true, reply: cleaned || generated, method: 'generation' };
  }
  return { ok: false, error: 'Error from Watsonx API', details: genData?.error || genData, method: 'generation' };
}

// Try chat first; if unsupported, fall back to generation and optionally swap chat->instruct for Granite
async function tryChatThenGeneration({ message, headers, modelId, lang }) {
  const instr = languageInstruction(lang);
  // 1) Try Chat endpoint
  const chatResp = await fetch(`${WATSONX_URL}/ml/v1/text/chat?version=2024-03-20`, {
    method: 'POST', headers, body: JSON.stringify({
      messages: [
        { role: 'system', content: [{ type: 'text', text: instr }] },
        { role: 'user', content: [{ type: 'text', text: message }] }
      ],
      project_id: PROJECT_ID, model_id: modelId,
      parameters: { decoding_method: 'sample', max_new_tokens: 200, temperature: 0.7, top_p: 1, top_k: 50 }
    })
  });
  const chatData = await chatResp.json().catch(()=>({}));
  let reply = chatData?.output_text
    || (Array.isArray(chatData?.results) && chatData.results[0]?.generated_text)
    || (Array.isArray(chatData?.output) && chatData.output[0]?.content?.[0]?.text);

  // 2) If Chat failed, try Generation with same model
  if (!chatResp.ok || !reply) {
    const genResp = await fetch(`${WATSONX_URL}/ml/v1/text/generation?version=2023-05-29`, {
      method: 'POST', headers, body: JSON.stringify({
        input: `${instr}\n\nHuman: ${message}\n\nAssistant:`, project_id: PROJECT_ID, model_id: modelId,
        parameters: { decoding_method: 'sample', max_new_tokens: 200, temperature: 0.7, top_p: 1, top_k: 50 }
      })
    });
    const genData = await genResp.json().catch(()=>({}));
    if (genResp.ok && Array.isArray(genData?.results) && genData.results[0]?.generated_text) {
      const generated = genData.results[0].generated_text;
      const cleaned = generated.replace(`Human: ${message}\n\nAssistant:`, '').trim();
      return { ok: true, reply: cleaned || generated, method: 'generation' };
    }

    // 3) If still failing with model_not_supported and model looks like a Granite chat, swap to instruct variant and retry generation
    const errorObj = chatData?.error || genData?.error || chatData || genData;
    const code = errorObj?.code || errorObj?.errors?.[0]?.code;
    if (code === 'model_not_supported' && /granite-\d{1,3}b-.*chat/i.test(modelId)) {
      const instructModel = modelId.replace(/-chat-/i, '-instruct-');
      const genResp2 = await fetch(`${WATSONX_URL}/ml/v1/text/generation?version=2023-05-29`, {
        method: 'POST', headers, body: JSON.stringify({
          input: `${instr}\n\nHuman: ${message}\n\nAssistant:`, project_id: PROJECT_ID, model_id: instructModel,
          parameters: { decoding_method: 'sample', max_new_tokens: 200, temperature: 0.7, top_p: 1, top_k: 50 }
        })
      });
      const genData2 = await genResp2.json().catch(()=>({}));
      if (genResp2.ok && Array.isArray(genData2?.results) && genData2.results[0]?.generated_text) {
        const generated2 = genData2.results[0].generated_text;
        const cleaned2 = generated2.replace(`Human: ${message}\n\nAssistant:`, '').trim();
        return { ok: true, reply: cleaned2 || generated2, usedModel: instructModel, method: 'generation-instruct' };
      }
      return { ok: false, error: 'Error from Watsonx API', details: genData2?.error || errorObj, method: 'generation-instruct', usedModel: instructModel };
    }

    return { ok: false, error: 'Error from Watsonx API', details: errorObj, method: 'chat->generation' };
  }

  return { ok: true, reply, method: 'chat' };
}

app.post('/api/chat', async (req, res) => {
  try {
    const reqId = Math.random().toString(36).slice(2, 8);
    const cfg = checkConfig();
    if (!cfg.ok) return res.status(400).json({ error: 'Backend not configured', details: { missing: cfg.missing } });
    const message = (req.body?.message || '').toString().trim();
    if (!message) return res.status(400).json({ error: 'Message is required' });
    const modelOverride = (req.body?.model_id || '').toString().trim();
    const modelId = modelOverride || MODEL_ID;
    const lang = (req.body?.language || 'en').toString().toLowerCase();

    log(`[${reqId}] /api/chat start`, { modelId, lang, len: message.length });
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' };

    // If using an instruct model, skip chat and go straight to generation
    if (/instruct/i.test(modelId)) {
      const resultGen = await tryGenerationOnly({ message, headers, modelId, lang });
      if (resultGen.ok) {
        log(`[${reqId}] reply`, { method: resultGen.method, model: modelId, lang });
        return res.json({ reply: resultGen.reply, usedModel: modelId, language: lang, method: resultGen.method });
      }
      logErr(`[${reqId}] fail`, { method: resultGen.method, model: modelId, lang, error: resultGen.error, details: resultGen.details });
      return res.json({ reply: FALLBACK_MSG, fallback: true, error: resultGen.error, details: resultGen.details, language: lang, method: resultGen.method });
    }

    const result = await tryChatThenGeneration({ message, headers, modelId, lang });
    if (result.ok) {
      log(`[${reqId}] reply`, { method: result.method, model: result.usedModel || modelId, lang });
      const payload = { reply: result.reply, language: lang, method: result.method };
      if (result.usedModel) payload.usedModel = result.usedModel;
      return res.json(payload);
    }
    logErr(`[${reqId}] fail`, { method: result.method, model: result.usedModel || modelId, lang, error: result.error, details: result.details });
    return res.json({ reply: FALLBACK_MSG, fallback: true, error: result.error, details: result.details, language: lang, method: result.method, usedModel: result.usedModel || undefined });
  } catch (e) {
    logErr(`[server] fatal`, e.message);
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
});

app.listen(PORT, () => console.log(`fresh-backend running http://localhost:${PORT}`));
