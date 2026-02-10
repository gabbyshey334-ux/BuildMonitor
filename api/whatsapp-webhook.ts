import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('WhatsApp webhook called!', req.body);
  
  const { From, Body = '' } = req.body;
  const phoneNumber = (From || '').replace('whatsapp:', '');
  
  const reply = `Hello! Your number is ${phoneNumber}. You said: "${Body}"`;
  
  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${reply}</Message>
</Response>`);
}

