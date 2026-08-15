module.exports = async (req, res) => {
  // ── CORS ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // ── Parse body manually (zero-config, works on every Vercel runtime) ──
  const body = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });

  const { message, history } = body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[chat] OPENAI_API_KEY is missing');
    res.status(500).json({ error: 'Service not configured' });
    return;
  }

  const systemPrompt = `أنت مساعد Linvitation، خدمة جزائرية متخصصة في الدعوات الرقمية للمناسبات (عرس، خطوبة، عيد ميلاد، أعراس...).

قواعد صارمة:
- تجاوب دائماً بالدارجة الجزائرية (Algerian Darija) ما لم يطلب المستخدم لغة أخرى صراحة.
- عندك 4 موديلات دعوات:
  1. "Algerian Elegant" — أناقة عصرية باللون البورغوني، مناسب للأعراس الكلاسيكية في الجزائر.
  2. "Oriental Heritage" — دافئ بالألوان الذهبية والتراكوتا، مناسب للأعراس الشرقية والتقليدية.
  3. "Minimal Modern" — بسيط وعصري بالأبيض والأسود، مناسب للأعراس المودرن والسيمبل.
  4. "Kabyle Roots" — أزرق داكن وذهبي، مستوحى من التراث القبائلي، مناسب للأعراس في منطقة القبائل.
- إذا المستخدم قال "عرس" أو "mariage" أو "زواج"، سولو شوية على التفاصيل (المنطقة، الطابع) وبعدها اقترحلو الموديل المناسب.
- إذا المستخدم طلب شيء خارج الدعوات، جاوبو بأدب ووجهو للموضوع.
- خلي الردود قصيرة وواضحة (2-4 جمل).
- إذا اقترحت موديل، ذكر اسم الموديل بالضبط كما هو مكتوب أعلاه باش الـFrontend يقدر يفتح الـDemo تاعو.
- في آخر الرسالة، ديما عرض على المستخدم التواصل عبر WhatsApp باش يكمل الطلب.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(Array.isArray(history) ? history.slice(-6) : []),
    { role: 'user', content: message.trim() }
  ];

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.75,
        max_tokens: 600
      })
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('[chat] OpenAI HTTP', openaiRes.status, errText);
      res.status(502).json({ error: 'AI service unavailable' });
      return;
    }

    const data = await openaiRes.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '';

    if (!reply) {
      res.status(502).json({ error: 'Empty AI response' });
      return;
    }

    // Detect template mention for frontend Demo button
    const templates = ['Algerian Elegant', 'Oriental Heritage', 'Minimal Modern', 'Kabyle Roots'];
    let detectedTemplate = null;
    for (const tpl of templates) {
      if (reply.includes(tpl)) {
        detectedTemplate = tpl;
        break;
      }
    }

    res.status(200).json({
      reply,
      template: detectedTemplate,
      showWhatsApp: true
    });

  } catch (err) {
    console.error('[chat] Exception:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
};
