import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Parse the body - Vercel should parse form-encoded data automatically
    // But Twilio sends application/x-www-form-urlencoded, so we handle it explicitly
    let body: any = {};
    
    if (req.body && typeof req.body === 'object') {
      // Body already parsed by Vercel
      body = req.body;
    } else if (req.body && typeof req.body === 'string') {
      // Parse URL-encoded string manually
      const params = new URLSearchParams(req.body);
      body = Object.fromEntries(params.entries());
    } else {
      // Try to get from query or default to empty
      body = req.query || {};
    }

    console.log('✅ WhatsApp webhook called!', {
      method: req.method,
      body: body,
      headers: req.headers['content-type'],
      rawBody: typeof req.body
    });
    
    const { From = '', Body = '' } = body;
    const phoneNumber = (From || '').replace('whatsapp:', '').trim();
    const message = (Body || '').trim();
    
    const reply = `Hello ${phoneNumber}! You said: "${message}". Webhook works! 🎉`;
    
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${reply}</Message>
</Response>`);

  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    console.error('❌ Error stack:', error.stack);
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Error processing message. Please try again.</Message>
</Response>`);
  }
}
